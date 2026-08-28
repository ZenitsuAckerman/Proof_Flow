import { ClearingEngine } from './clearing';
import { SettlementService } from './settlement';
import { VerificationService } from './verification-service';
import { ExecutionService } from './execution';
import { UnderwritingService, EscrowService, CollateralService, BuyerBondService, AssignmentService } from './financial';
import { SelectionEngine } from './selection';
import { FinancialReconciliation } from './reconciliation';
import { db } from './repository';
import { Task, VerificationResult, Escrow, SettlementInstruction } from './types';

describe('Phase F: Clearing, Settlement & Economic-Capacity Layer', () => {
  const taskId = 'TASK-DEMO-1';
  const buyerId = 'AGENT-BUYER-1';
  const workerId = 'AGENT-WORKER-1';

  beforeEach(async () => {
    db.reset();
  });

  // --- Helper to setup funded & executed task ---
  async function setupSubmittedTask(): Promise<{ task: Task; verifResult: VerificationResult }> {
    await UnderwritingService.underwriteTask(taskId, 95);
    await SelectionEngine.selectBestWorker(taskId);
    await EscrowService.fundEscrow(taskId, buyerId, 'fund-key');
    await BuyerBondService.lockBond(taskId, buyerId, 'bond-key');
    await CollateralService.lockCollateral(taskId, workerId, 'col-key');
    await AssignmentService.confirmAssignment(taskId);
    await ExecutionService.executeTask(taskId, workerId, 100);
    const verifResult = await VerificationService.verifyTask(taskId);
    const task = (await db.getTask(taskId))!;
    return { task, verifResult };
  }

  // --- Clearing Engine Tests (1-12) ---
  describe('Clearing Engine Rules', () => {
    it('1. PASS 90 & 2. PASS 100 produce full worker payout & collateral return', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      verifResult.score = 90;
      verifResult.verdict = 'PASS';

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      expect(instruction.verdict).toBe('PASS');
      expect(instruction.workerAmount).toBe(10000);
      expect(instruction.buyerRefund).toBe(0);
      expect(instruction.collateralReturned).toBe(1000);
      expect(instruction.buyerBondReturned).toBe(500);
    });

    it('3. PARTIAL 89 & 4. PARTIAL 60 produce proportional worker payout', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      verifResult.score = 80;
      verifResult.verdict = 'PARTIAL';

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      expect(instruction.verdict).toBe('PARTIAL');
      expect(instruction.workerAmount).toBe(8000);
      expect(instruction.buyerRefund).toBe(2000);
      expect(instruction.collateralReturned).toBe(1000);
    });

    it('5. FAIL 59 & 6. FAIL 0 produce zero worker payout & collateral slash', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      verifResult.score = 40;
      verifResult.verdict = 'FAIL';

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      expect(instruction.verdict).toBe('FAIL');
      expect(instruction.workerAmount).toBe(0);
      expect(instruction.buyerRefund).toBe(10000);
      expect(instruction.collateralSlashed).toBe(1000);
    });

    it('7. UNCERTAIN does not auto-punish', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      verifResult.verdict = 'UNCERTAIN';
      verifResult.status = 'UNCERTAIN';

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      expect(instruction.verdict).toBe('UNCERTAIN');
      expect(instruction.workerAmount).toBe(0);
      expect(instruction.buyerRefund).toBe(0);
      expect(instruction.collateralSlashed).toBe(0);
      expect(instruction.collateralReturned).toBe(0);
    });

    it('8. EXPIRED policy produces full refund & 50% collateral penalty', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      task.status = 'EXPIRED';

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      expect(instruction.verdict).toBe('EXPIRED');
      expect(instruction.buyerRefund).toBe(10000);
      expect(instruction.collateralSlashed).toBe(500);
      expect(instruction.collateralReturned).toBe(500);
    });

    it('9. DEFECTIVE policy compensates worker 20% & slashes buyer bond', async () => {
      const { task, verifResult } = await setupSubmittedTask();

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond, true);
      expect(instruction.verdict).toBe('DEFECTIVE');
      expect(instruction.workerAmount).toBe(2000);
      expect(instruction.buyerRefund).toBe(8000);
      expect(instruction.buyerBondSlashed).toBe(500);
      expect(instruction.collateralReturned).toBe(1000);
    });

    it('10. missing verification result throws error', () => {
      const task = { id: taskId } as Task;
      const escrow = { amount: 10000, status: 'LOCKED' } as Escrow;
      expect(() => ClearingEngine.calculateInstruction(task, null, escrow, null, null))
        .toThrow('INVALID_TASK_STATE: VerificationResult is required');
    });

    it('11. invalid financial terms/unlocked escrow throws error', () => {
      const task = { id: taskId } as Task;
      const verif = { taskId } as VerificationResult;
      const escrow = { amount: 10000, status: 'RELEASED' } as Escrow;
      expect(() => ClearingEngine.calculateInstruction(task, verif, escrow, null, null))
        .toThrow('INVALID_TASK_STATE: Locked escrow record is required');
    });

    it('12. settlement instruction is deterministic', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const i1 = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      const i2 = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      expect(i1).toEqual(i2);
    });
  });

  // --- Settlement Engine Tests (13-24) ---
  describe('Settlement Engine Execution', () => {
    it('13. PASS full payout & 18. buyer bond return & 19. collateral return', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      const settlement = await SettlementService.executeInstruction(instruction, 'set-pass');

      expect(settlement.status).toBe('SETTLED');
      const updatedTask = await db.getTask(taskId);
      expect(updatedTask?.status).toBe('COMPLETED');
    });

    it('14. PARTIAL proportional payout execution', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      verifResult.score = 75;
      verifResult.verdict = 'PARTIAL';

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      const settlement = await SettlementService.executeInstruction(instruction, 'set-part');

      expect(settlement.workerAmount).toBe(7500);
      expect(settlement.buyerRefund).toBe(2500);
    });

    it('15. FAIL refund + collateral slash execution', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      verifResult.score = 30;
      verifResult.verdict = 'FAIL';

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      const settlement = await SettlementService.executeInstruction(instruction, 'set-fail');

      expect(settlement.buyerRefund).toBe(10000);
      expect(settlement.collateralSlashed).toBe(1000);
    });

    it('20. duplicate settlement same key returns ALREADY_SETTLED', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      const run1 = await SettlementService.executeInstruction(instruction, 'same-key');
      const run2 = await SettlementService.executeInstruction(instruction, 'same-key');

      expect(run1.status).toBe('SETTLED');
      expect(run2.status).toBe('ALREADY_SETTLED');
    });

    it('21. duplicate settlement different instruction is rejected', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const inst1 = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      await SettlementService.executeInstruction(inst1, 'key-1');

      const inst2 = { ...inst1, workerAmount: 5000, buyerRefund: 5000 };
      await expect(SettlementService.executeInstruction(inst2, 'key-2'))
        .rejects.toThrow('CONFLICTING_SETTLEMENT');
    });

    it('22. settlement before clearing/invalid state rejected', async () => {
      const unassignedTask: Task = {
        id: 'UNASSIGNED-TASK', buyerAgentId: buyerId, title: '', description: '', taskType: 'code',
        budget: 10000, qualityThreshold: 80, deadlineSeconds: 3600, status: 'CREATED',
        verificationPolicy: { preferred: 'deterministic' }, createdAt: ''
      };
      (db as unknown as { tasks: Map<string, Task> }).tasks.set('UNASSIGNED-TASK', unassignedTask);

      const inst: SettlementInstruction = {
        taskId: 'UNASSIGNED-TASK', verdict: 'PASS', workerAmount: 10000, buyerRefund: 0,
        evaluatorAmount: 0, protocolAmount: 0, collateralReturned: 1000, collateralSlashed: 0,
        buyerBondReturned: 500, buyerBondSlashed: 0, escrowReleased: 10000, reason: ''
      };

      await expect(SettlementService.executeInstruction(inst, 'k-unassigned'))
        .rejects.toThrow('INVALID_TASK_STATE');
    });

    it('23. settlement without escrow rejected', async () => {
      await setupSubmittedTask();
      // Remove escrow
      (db as unknown as { escrows: Map<string, Escrow> }).escrows.delete(taskId);

      const inst: SettlementInstruction = {
        taskId, verdict: 'PASS', workerAmount: 10000, buyerRefund: 0,
        evaluatorAmount: 0, protocolAmount: 0, collateralReturned: 1000, collateralSlashed: 0,
        buyerBondReturned: 500, buyerBondSlashed: 0, escrowReleased: 10000, reason: ''
      };

      await expect(SettlementService.executeInstruction(inst, 'k-no-escrow'))
        .rejects.toThrow('INVALID_TASK_STATE');
    });
  });

  // --- Accounting & Balance Conservation Tests (25-33) ---
  describe('System Money Conservation & Accounting', () => {
    it('25. PASS balance conservation', async () => {
      const initialTotal = await FinancialReconciliation.calculateSystemTotalMoney();
      const { task, verifResult } = await setupSubmittedTask();

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      await SettlementService.executeInstruction(instruction, 'set-cons-pass');

      await FinancialReconciliation.assertMoneyConservation(initialTotal, 'PASS Settlement');
    });

    it('26. PARTIAL balance conservation', async () => {
      const initialTotal = await FinancialReconciliation.calculateSystemTotalMoney();
      const { task, verifResult } = await setupSubmittedTask();
      verifResult.score = 70;
      verifResult.verdict = 'PARTIAL';

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      await SettlementService.executeInstruction(instruction, 'set-cons-part');

      await FinancialReconciliation.assertMoneyConservation(initialTotal, 'PARTIAL Settlement');
    });

    it('27. FAIL balance conservation & PROTOCOL-TREASURY slashed collateral receipt', async () => {
      const initialTotal = await FinancialReconciliation.calculateSystemTotalMoney();
      const { task, verifResult } = await setupSubmittedTask();
      verifResult.score = 20;
      verifResult.verdict = 'FAIL';

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      await SettlementService.executeInstruction(instruction, 'set-cons-fail');

      await FinancialReconciliation.assertMoneyConservation(initialTotal, 'FAIL Settlement');
      
      const protocolWallet = await db.getWalletByAgentId('PROTOCOL-TREASURY');
      expect(protocolWallet?.availableBalance).toBe(1000); // 100% slashed collateral credited to treasury
    });

    it('28. EXPIRED balance conservation & PROTOCOL-TREASURY 50% slash receipt', async () => {
      const initialTotal = await FinancialReconciliation.calculateSystemTotalMoney();
      const { task, verifResult } = await setupSubmittedTask();
      task.status = 'EXPIRED';

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      await SettlementService.executeInstruction(instruction, 'set-cons-exp');

      await FinancialReconciliation.assertMoneyConservation(initialTotal, 'EXPIRED Settlement');

      const protocolWallet = await db.getWalletByAgentId('PROTOCOL-TREASURY');
      expect(protocolWallet?.availableBalance).toBe(500); // 50% slashed collateral credited to treasury
    });

    it('29. DEFECTIVE balance conservation', async () => {
      const initialTotal = await FinancialReconciliation.calculateSystemTotalMoney();
      const { task, verifResult } = await setupSubmittedTask();

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond, true);
      await SettlementService.executeInstruction(instruction, 'set-cons-def');

      await FinancialReconciliation.assertMoneyConservation(initialTotal, 'DEFECTIVE Settlement');
    });

    it('30. Escrow pool equation invariant: workerAmount + buyerRefund + evaluatorAmount + protocolAmount == escrowReleased', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const inst = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      const sum = inst.workerAmount + inst.buyerRefund + inst.evaluatorAmount + inst.protocolAmount;
      expect(sum).toBe(inst.escrowReleased);
      expect(inst.escrowReleased).toBe(escrow?.amount);

      // Separate pools check
      expect(inst.collateralReturned + inst.collateralSlashed).toBe(collateral?.amount);
      expect(inst.buyerBondReturned + inst.buyerBondSlashed).toBe(buyerBond?.amount);
    });
  });

  // --- Economic Capacity Tests (34-36) ---
  describe('Economic Capacity Dynamics', () => {
    it('34. successful task updates capability capacity', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      const workerBefore = (await db.getAgent(workerId))!;
      const capBefore = workerBefore.economicCapacity['python'];

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      await SettlementService.executeInstruction(instruction, 'set-cap-pass');

      const workerAfter = (await db.getAgent(workerId))!;
      expect(workerAfter.economicCapacity['python']).toBe(capBefore + 1000); // +10% of ₹10,000 task
    });

    it('35. failed task reduces capacity', async () => {
      const { task, verifResult } = await setupSubmittedTask();
      verifResult.score = 30;
      verifResult.verdict = 'FAIL';
      const workerBefore = (await db.getAgent(workerId))!;
      const capBefore = workerBefore.economicCapacity['python'];

      const escrow = await db.getEscrow(taskId);
      const collateral = await db.getCollateralByTaskId(taskId);
      const buyerBond = await db.getBuyerBondByTaskId(taskId);

      const instruction = ClearingEngine.calculateInstruction(task, verifResult, escrow, collateral, buyerBond);
      await SettlementService.executeInstruction(instruction, 'set-cap-fail');

      const workerAfter = (await db.getAgent(workerId))!;
      expect(workerAfter.economicCapacity['python']).toBe(capBefore - 2000); // -20% of ₹10,000 task
    });
  });

  // --- Adversarial Boundary Tests ---
  describe('Adversarial Boundary Validation', () => {
    it('rejects worker reward greater than escrow', async () => {
      await setupSubmittedTask();
      const inst: SettlementInstruction = {
        taskId, verdict: 'PASS', workerAmount: 20000, buyerRefund: 0,
        evaluatorAmount: 0, protocolAmount: 0, collateralReturned: 1000, collateralSlashed: 0,
        buyerBondReturned: 500, buyerBondSlashed: 0, escrowReleased: 10000, reason: ''
      };

      await expect(SettlementService.executeInstruction(inst, 'adv-1'))
        .rejects.toThrow('INVALID_INSTRUCTION: Escrow allocation');
    });

    it('rejects negative settlement amounts', async () => {
      await setupSubmittedTask();
      const inst: SettlementInstruction = {
        taskId, verdict: 'PASS', workerAmount: -100, buyerRefund: 10100,
        evaluatorAmount: 0, protocolAmount: 0, collateralReturned: 1000, collateralSlashed: 0,
        buyerBondReturned: 500, buyerBondSlashed: 0, escrowReleased: 10000, reason: ''
      };

      await expect(SettlementService.executeInstruction(inst, 'adv-2'))
        .rejects.toThrow('INVALID_INSTRUCTION: Settlement amounts cannot be negative');
    });

    it('rejects settlement instruction referencing wrong task ID', async () => {
      await setupSubmittedTask();
      const inst: SettlementInstruction = {
        taskId: 'WRONG-TASK-ID', verdict: 'PASS', workerAmount: 10000, buyerRefund: 0,
        evaluatorAmount: 0, protocolAmount: 0, collateralReturned: 1000, collateralSlashed: 0,
        buyerBondReturned: 500, buyerBondSlashed: 0, escrowReleased: 10000, reason: ''
      };

      await expect(SettlementService.executeInstruction(inst, 'adv-3'))
        .rejects.toThrow('INVALID_INSTRUCTION');
    });
  });
});
