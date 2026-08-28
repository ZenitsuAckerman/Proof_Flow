import { VerificationService } from './verification-service';
import { VerificationRouter } from './verification-router';
import { ExecutionService } from './execution';
import { UnderwritingService, EscrowService, CollateralService, AssignmentService } from './financial';
import { SelectionEngine } from './selection';
import { db } from './repository';
import { Task } from './types';

describe('Phase E: Adaptive Verification Layer', () => {
  const codeTaskId = 'TASK-DEMO-1';       // Python code task
  const researchTaskId = 'TASK-DEMO-2';   // Research task
  const buyerId = 'AGENT-BUYER-1';
  const workerId = 'AGENT-WORKER-1';

  beforeEach(async () => {
    db.reset();

    // Setup codeTaskId through full lifecycle: CREATED -> UNDERWRITING -> FUNDED -> ASSIGNED -> EXECUTING -> SUBMITTED
    await UnderwritingService.underwriteTask(codeTaskId, 95);
    await SelectionEngine.selectBestWorker(codeTaskId);
    await EscrowService.fundEscrow(codeTaskId, buyerId, 'fund-key-1');
    await CollateralService.lockCollateral(codeTaskId, workerId, 'col-key-1');
    await AssignmentService.confirmAssignment(codeTaskId);
    await ExecutionService.executeTask(codeTaskId, workerId, 100); // Now SUBMITTED

    // Setup researchTaskId through full lifecycle
    await UnderwritingService.underwriteTask(researchTaskId, 90);
    await SelectionEngine.selectBestWorker(researchTaskId);
    const researchTask = (await db.getTask(researchTaskId))!;
    const researchWorkerId = researchTask.selectedWorkerId!;
    await EscrowService.fundEscrow(researchTaskId, buyerId, 'fund-key-2');
    await CollateralService.lockCollateral(researchTaskId, researchWorkerId, 'col-key-2');
    await AssignmentService.confirmAssignment(researchTaskId);
    await ExecutionService.executeTask(researchTaskId, researchWorkerId, 100); // Now SUBMITTED
  });

  // --- Router Tests (1-6) ---
  describe('Verification Router Decision Tree', () => {
    it('1. code task routes to deterministic verifier', async () => {
      const task = (await db.getTask(codeTaskId))!;
      const evidence = (await db.getEvidenceByTaskId(codeTaskId))!;

      const route = VerificationRouter.selectRoute(task, evidence);
      expect(route.selectedRoute).toBe('DETERMINISTIC');
      expect(route.estimatedCost).toBe(50);
      expect(route.viable).toBe(true);
    });

    it('2. reference task routes to reference verifier', async () => {
      const task = (await db.getTask(codeTaskId))!;
      task.verificationPolicy = { preferred: 'reference', fallbackPolicy: 'blind_jury' };
      const evidence = (await db.getEvidenceByTaskId(codeTaskId))!;

      const route = VerificationRouter.selectRoute(task, evidence);
      expect(route.selectedRoute).toBe('REFERENCE');
      expect(route.estimatedCost).toBe(150);
    });

    it('3. subjective task routes to Blind Jury', async () => {
      const task = (await db.getTask(researchTaskId))!;
      const evidence = (await db.getEvidenceByTaskId(researchTaskId))!;

      const route = VerificationRouter.selectRoute(task, evidence);
      expect(route.selectedRoute).toBe('BLIND_JURY');
      expect(route.estimatedCost).toBe(500);
    });

    it('4. no valid verifier produces UNCERTAIN/NO_VALID_VERIFIER when budget exceeded', async () => {
      const task = (await db.getTask(researchTaskId))!;
      task.budget = 100; // Small task budget ₹100 < Blind Jury cost ₹500
      task.financialTerms = undefined;
      const evidence = (await db.getEvidenceByTaskId(researchTaskId))!;

      const route = VerificationRouter.selectRoute(task, evidence);
      expect(route.viable).toBe(false);
      expect(route.reason).toContain('REPRICE_REQUIRED');

      const result = await VerificationService.verifyTask(researchTaskId);
      expect(result.status).toBe('NO_VALID_VERIFIER');
      expect(result.verdict).toBe('UNCERTAIN');
    });

    it('5. verification budget constraint is respected', async () => {
      const task = (await db.getTask(codeTaskId))!;
      const evidence = (await db.getEvidenceByTaskId(codeTaskId))!;

      // Allowed budget override ₹30 < Deterministic cost ₹50
      const route = VerificationRouter.selectRoute(task, evidence, 30);
      expect(route.viable).toBe(false);
    });

    it('6. router is deterministic for identical inputs', async () => {
      const task = (await db.getTask(codeTaskId))!;
      const evidence = (await db.getEvidenceByTaskId(codeTaskId))!;

      const r1 = VerificationRouter.selectRoute(task, evidence);
      const r2 = VerificationRouter.selectRoute(task, evidence);
      expect(r1).toEqual(r2);
    });
  });

  // --- Deterministic Verification Tests (7-15) ---
  describe('Deterministic Verification Engine', () => {
    it('7. all tests pass → PASS', async () => {
      const result = await VerificationService.verifyTask(codeTaskId);
      expect(result.routeType).toBe('DETERMINISTIC');
      expect(result.score).toBe(100);
      expect(result.verdict).toBe('PASS');
      expect(result.status).toBe('VERIFIED');
    });

    it('8. partial tests → PARTIAL', async () => {
      const evidence = (await db.getEvidenceByTaskId(codeTaskId))!;
      // Simulate partial pass (3/5 passed = 60%)
      evidence.evidencePayload.passedCount = 3;
      evidence.evidencePayload.failedCount = 2;

      // Recompute evidenceHash so integrity check passes
      evidence.evidenceHash = ExecutionService.computeEvidenceHash(
        evidence.evidencePayload, evidence.outputHash, evidence.taskId, evidence.workerAgentId
      );

      const result = await VerificationService.verifyTask(codeTaskId);
      expect(result.score).toBe(60);
      expect(result.verdict).toBe('PARTIAL');
    });

    it('9. failed tests → FAIL', async () => {
      const evidence = (await db.getEvidenceByTaskId(codeTaskId))!;
      // Simulate failed pass (1/5 passed = 20%)
      evidence.evidencePayload.passedCount = 1;
      evidence.evidencePayload.failedCount = 4;

      evidence.evidenceHash = ExecutionService.computeEvidenceHash(
        evidence.evidencePayload, evidence.outputHash, evidence.taskId, evidence.workerAgentId
      );

      const result = await VerificationService.verifyTask(codeTaskId);
      expect(result.score).toBe(20);
      expect(result.verdict).toBe('FAIL');
      expect(result.status).toBe('FAILED');
    });

    it('10. invalid output hash → FAIL', async () => {
      const result = await VerificationService.verifyTask(codeTaskId, {
        outputCodeOverride: '# Tampered output code'
      });
      expect(result.verdict).toBe('FAIL');
      expect(result.status).toBe('FAILED');
      expect(result.message).toContain('Integrity check failed');
    });

    it('11. invalid evidence hash → FAIL', async () => {
      const evidence = (await db.getEvidenceByTaskId(codeTaskId))!;
      evidence.evidenceHash = '0000000000000000000000000000000000000000000000000000000000000000'; // Tampered hash

      const result = await VerificationService.verifyTask(codeTaskId);
      expect(result.verdict).toBe('FAIL');
      expect(result.status).toBe('FAILED');
    });

    it('12. wrong task ID → FAIL', async () => {
      const evidence = (await db.getEvidenceByTaskId(codeTaskId))!;
      evidence.taskId = 'WRONG-TASK-ID';

      const result = await VerificationService.verifyTask(codeTaskId);
      expect(result.verdict).toBe('FAIL');
    });

    it('13. wrong worker ID → FAIL', async () => {
      const evidence = (await db.getEvidenceByTaskId(codeTaskId))!;
      evidence.workerAgentId = 'WRONG-WORKER-ID';

      const result = await VerificationService.verifyTask(codeTaskId);
      expect(result.verdict).toBe('FAIL');
    });

    it('14. missing required evidence → FAIL', async () => {
      // Create a task without evidence
      const noEvidTaskId = 'TASK-NO-EVID';
      const task: Task = {
        id: noEvidTaskId, buyerAgentId: buyerId, title: 'No Evid', description: '', taskType: 'code',
        budget: 10000, qualityThreshold: 80, deadlineSeconds: 3600, status: 'SUBMITTED', verificationPolicy: { preferred: 'deterministic' }, createdAt: ''
      };
      (db as unknown as { tasks: Map<string, Task> }).tasks.set(noEvidTaskId, task);

      const result = await VerificationService.verifyTask(noEvidTaskId);
      expect(result.verdict).toBe('FAIL');
      expect(result.message).toContain('Missing required evidence');
    });

    it('15. testPassRate is distinct from verification confidence', async () => {
      const result = await VerificationService.verifyTask(codeTaskId);
      expect(result.score).toBe(100);
      expect(result.confidence).toBe('HIGH');
    });
  });

  // --- Blind Jury Tests (16-25) ---
  describe('Blind Jury Verification Engine', () => {
    it('16. exactly 5 evaluators selected', async () => {
      const result = await VerificationService.verifyTask(researchTaskId);
      expect(result.routeType).toBe('BLIND_JURY');
      expect(result.verifierIds?.length).toBe(5);
    });

    it('17. commit stored & 18. reveal validates commitment', async () => {
      const result = await VerificationService.verifyTask(researchTaskId);
      expect(result.commitReveals?.length).toBe(5);

      for (const cr of result.commitReveals!) {
        expect(cr.commitmentHash).toBeDefined();
        expect(cr.revealStatus).toBe('REVEALED');
        expect(cr.revealedScore).toBeDefined();
      }
    });

    it('19. valid scores produce median consensus score', async () => {
      const customVotes = [
        { evaluatorId: 'E1', score: 92, nonce: 'n1' },
        { evaluatorId: 'E2', score: 89, nonce: 'n2' },
        { evaluatorId: 'E3', score: 94, nonce: 'n3' },
        { evaluatorId: 'E4', score: 87, nonce: 'n4' },
        { evaluatorId: 'E5', score: 91, nonce: 'n5' },
      ];

      const result = await VerificationService.verifyTask(researchTaskId, { customVotes });
      // Median of [87, 89, 91, 92, 94] = 91
      expect(result.score).toBe(91);
      expect(result.verdict).toBe('PASS');
    });

    it('20. low disagreement produces normal verdict', async () => {
      const customVotes = [
        { evaluatorId: 'E1', score: 90, nonce: 'n1' },
        { evaluatorId: 'E2', score: 91, nonce: 'n2' },
        { evaluatorId: 'E3', score: 89, nonce: 'n3' },
        { evaluatorId: 'E4', score: 92, nonce: 'n4' },
        { evaluatorId: 'E5', score: 90, nonce: 'n5' },
      ];

      const result = await VerificationService.verifyTask(researchTaskId, { customVotes });
      expect(result.disagreementScore).toBeLessThanOrEqual(15);
      expect(result.verdict).toBe('PASS');
      expect(result.status).toBe('VERIFIED');
    });

    it('21. high disagreement produces UNCERTAIN', async () => {
      // Scores: [95, 93, 91, 40, 35] -> stdDev ~ 27 > 15
      const customVotes = [
        { evaluatorId: 'E1', score: 95, nonce: 'n1' },
        { evaluatorId: 'E2', score: 93, nonce: 'n2' },
        { evaluatorId: 'E3', score: 91, nonce: 'n3' },
        { evaluatorId: 'E4', score: 40, nonce: 'n4' },
        { evaluatorId: 'E5', score: 35, nonce: 'n5' },
      ];

      const result = await VerificationService.verifyTask(researchTaskId, { customVotes });
      expect(result.disagreementScore).toBeGreaterThan(15);
      expect(result.verdict).toBe('UNCERTAIN');
      expect(result.status).toBe('UNCERTAIN');
    });

    it('22. invalid reveal is rejected', async () => {
      const customVotes = [
        { evaluatorId: 'E1', score: 90, nonce: 'n1' },
        { evaluatorId: 'E2', score: 90, nonce: 'n2' },
        { evaluatorId: 'E3', score: 90, nonce: 'n3' },
        { evaluatorId: 'E4', score: 90, nonce: 'n4' },
        { evaluatorId: 'E5', score: 90, nonce: 'n5', simulateInvalidReveal: true }, // Invalid reveal
      ];

      const result = await VerificationService.verifyTask(researchTaskId, { customVotes });
      const invalidCR = result.commitReveals?.find(c => c.evaluatorId === 'E5');
      expect(invalidCR?.revealStatus).toBe('INVALID_REVEAL');
    });

    it('23. evaluator timeout is handled', async () => {
      const customVotes = [
        { evaluatorId: 'E1', score: 90, nonce: 'n1' },
        { evaluatorId: 'E2', score: 90, nonce: 'n2' },
        { evaluatorId: 'E3', score: 90, nonce: 'n3' },
        { evaluatorId: 'E4', score: 90, nonce: 'n4' },
        { evaluatorId: 'E5', score: 90, nonce: 'n5', simulateTimeout: true }, // Timeout
      ];

      const result = await VerificationService.verifyTask(researchTaskId, { customVotes });
      const timeoutCR = result.commitReveals?.find(c => c.evaluatorId === 'E5');
      expect(timeoutCR?.revealStatus).toBe('TIMEOUT');
    });

    it('24. insufficient quorum is handled (fewer than 3 valid reveals)', async () => {
      const customVotes = [
        { evaluatorId: 'E1', score: 90, nonce: 'n1' },
        { evaluatorId: 'E2', score: 90, nonce: 'n2' },
        { evaluatorId: 'E3', score: 90, nonce: 'n3', simulateTimeout: true },
        { evaluatorId: 'E4', score: 90, nonce: 'n4', simulateTimeout: true },
        { evaluatorId: 'E5', score: 90, nonce: 'n5', simulateTimeout: true }, // 3 timeouts -> 2 valid
      ];

      const result = await VerificationService.verifyTask(researchTaskId, { customVotes });
      expect(result.status).toBe('NO_VALID_VERIFIER');
      expect(result.verdict).toBe('UNCERTAIN');
      expect(result.message).toContain('Insufficient valid evaluator quorum');
    });

    it('25. minority vote is NOT automatically marked malicious', async () => {
      // 4 evaluators vote 90, 1 evaluator votes 30
      const customVotes = [
        { evaluatorId: 'E1', score: 90, nonce: 'n1' },
        { evaluatorId: 'E2', score: 90, nonce: 'n2' },
        { evaluatorId: 'E3', score: 90, nonce: 'n3' },
        { evaluatorId: 'E4', score: 90, nonce: 'n4' },
        { evaluatorId: 'E5', score: 30, nonce: 'n5' }, // Minority score
      ];

      const result = await VerificationService.verifyTask(researchTaskId, { customVotes });
      const minorityCR = result.commitReveals?.find(c => c.evaluatorId === 'E5');
      // Minority evaluator's reveal is still validly recorded as REVEALED, not marked invalid or malicious
      expect(minorityCR?.revealStatus).toBe('REVEALED');
      expect(result.score).toBe(90); // Median excludes outlier safely
    });
  });

  // --- Economics Tests (26-28) ---
  describe('Verification Economics Policy', () => {
    it('26. cheap verifier preferred when sufficient', async () => {
      const task = (await db.getTask(codeTaskId))!;
      const evidence = (await db.getEvidenceByTaskId(codeTaskId))!;

      const route = VerificationRouter.selectRoute(task, evidence);
      expect(route.selectedRoute).toBe('DETERMINISTIC');
      expect(route.estimatedCost).toBe(50);
    });

    it('27. expensive verifier selected only when necessary', async () => {
      const task = (await db.getTask(researchTaskId))!;
      const evidence = (await db.getEvidenceByTaskId(researchTaskId))!;

      const route = VerificationRouter.selectRoute(task, evidence);
      expect(route.selectedRoute).toBe('BLIND_JURY');
      expect(route.estimatedCost).toBe(500);
    });

    it('28. economically irrational verification is rejected/escalated', async () => {
      const smallTask: Task = {
        id: 'TASK-SMALL', buyerAgentId: buyerId, title: 'Small Task', description: '', taskType: 'research',
        budget: 100, qualityThreshold: 80, deadlineSeconds: 3600, status: 'SUBMITTED',
        verificationPolicy: { preferred: 'blind_jury' }, createdAt: ''
      };
      const evidence = (await db.getEvidenceByTaskId(researchTaskId))!;

      const route = VerificationRouter.selectRoute(smallTask, evidence);
      expect(route.viable).toBe(false);
      expect(route.reason).toContain('REPRICE_REQUIRED');
    });

    it('29. Financial Isolation Guarantee: verifyTask does NOT mutate wallet balances', async () => {
      const buyerWalletBefore = await db.getWalletByAgentId(buyerId);
      const workerWalletBefore = await db.getWalletByAgentId(workerId);

      await VerificationService.verifyTask(codeTaskId);

      const buyerWalletAfter = await db.getWalletByAgentId(buyerId);
      const workerWalletAfter = await db.getWalletByAgentId(workerId);

      expect(buyerWalletAfter?.availableBalance).toBe(buyerWalletBefore?.availableBalance);
      expect(buyerWalletAfter?.lockedBalance).toBe(buyerWalletBefore?.lockedBalance);
      expect(workerWalletAfter?.availableBalance).toBe(workerWalletBefore?.availableBalance);
      expect(workerWalletAfter?.lockedBalance).toBe(workerWalletBefore?.lockedBalance);
    });
  });
});
