import { ExecutionService } from './execution';
import { UnderwritingService, EscrowService, CollateralService, AssignmentService } from './financial';
import { SelectionEngine } from './selection';
import { db } from './repository';
import { Evidence } from './types';

describe('Phase D: Task Execution & Proof-Carrying Evidence Package', () => {
  const taskId = 'TASK-DEMO-1';
  const buyerId = 'AGENT-BUYER-1';
  const workerId = 'AGENT-WORKER-1';

  beforeEach(async () => {
    db.reset();
    // Setup task through valid lifecycle: CREATED -> DISCOVERING -> BIDDING -> UNDERWRITING -> FUNDED -> ASSIGNED
    await UnderwritingService.underwriteTask(taskId, 95);
    await SelectionEngine.selectBestWorker(taskId);
    await EscrowService.fundEscrow(taskId, buyerId, 'fund-key');
    await CollateralService.lockCollateral(taskId, workerId, 'col-key');
    await AssignmentService.confirmAssignment(taskId); // Task status is now ASSIGNED
  });

  it('1. valid ASSIGNED → EXECUTING transition & 2. valid EXECUTING → SUBMITTED transition', async () => {
    const taskBefore = await db.getTask(taskId);
    expect(taskBefore?.status).toBe('ASSIGNED');

    const result = await ExecutionService.executeTask(taskId, workerId, 100);
    expect(result.status).toBe('SUCCESS');

    const taskAfter = await db.getTask(taskId);
    expect(taskAfter?.status).toBe('SUBMITTED');
  });

  it('3. execution cannot begin before ASSIGNED', async () => {
    const unassignedTaskId = 'TASK-DEMO-2';
    await UnderwritingService.underwriteTask(unassignedTaskId, 95);
    // Task is in CREATED / UNDERWRITING, not ASSIGNED

    await expect(ExecutionService.executeTask(unassignedTaskId, workerId, 100))
      .rejects.toThrow('INVALID_TASK_STATE: Cannot execute task');
  });

  it('4. submission cannot happen before EXECUTING', async () => {
    // Attempting to directly save evidence or call execution without going through EXECUTING throws state validation error
    const unassignedTaskId = 'TASK-DEMO-2';
    await expect(ExecutionService.executeTask(unassignedTaskId, workerId, 100))
      .rejects.toThrow('INVALID_TASK_STATE');
  });

  it('5. assigned worker ID is required and checked against caller', async () => {
    const wrongWorkerId = 'AGENT-WORKER-2';
    await expect(ExecutionService.executeTask(taskId, wrongWorkerId, 100))
      .rejects.toThrow('UNAUTHORIZED_WORKER');
  });

  it('6. successful deterministic code task execution', async () => {
    const result = await ExecutionService.executeTask(taskId, workerId, 100);
    expect(result.status).toBe('SUCCESS');
    expect(result.outputCode).toContain('def solve_bounty()');
  });

  it('7. test results are captured in evidence payload', async () => {
    const result = await ExecutionService.executeTask(taskId, workerId, 100);
    const payload = result.evidence?.evidencePayload;

    expect(payload?.testCount).toBe(5);
    expect(payload?.passedCount).toBe(5);
    expect(payload?.failedCount).toBe(0);
    expect(Array.isArray(payload?.testResults)).toBe(true);
  });

  it('8. output hash is generated via SHA-256', async () => {
    const result = await ExecutionService.executeTask(taskId, workerId, 100);
    expect(result.evidence?.outputHash).toBeDefined();
    expect(result.evidence?.outputHash.length).toBe(64); // SHA-256 hex length
  });

  it('9. evidence hash is generated via SHA-256', async () => {
    const result = await ExecutionService.executeTask(taskId, workerId, 100);
    expect(result.evidence?.evidenceHash).toBeDefined();
    expect(result.evidence?.evidenceHash.length).toBe(64);
  });

  it('10. evidence belongs to correct task & 11. evidence belongs to correct worker', async () => {
    const result = await ExecutionService.executeTask(taskId, workerId, 100);
    expect(result.evidence?.taskId).toBe(taskId);
    expect(result.evidence?.workerAgentId).toBe(workerId);
  });

  it('12. altered output causes hash mismatch', async () => {
    const result = await ExecutionService.executeTask(taskId, workerId, 100);
    const originalCode = result.outputCode!;
    const tamperedCode = originalCode + '\n# Malicious injected code';

    const verification = ExecutionService.verifyEvidenceIntegrity(result.evidence!, tamperedCode, taskId, workerId);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('Output hash mismatch');
  });

  it('13. altered evidence payload causes hash mismatch', async () => {
    const result = await ExecutionService.executeTask(taskId, workerId, 100);
    const tamperedEvidence: Evidence = JSON.parse(JSON.stringify(result.evidence!));
    // Tamper with testCount inside evidencePayload
    tamperedEvidence.evidencePayload.testCount = 999;

    const verification = ExecutionService.verifyEvidenceIntegrity(tamperedEvidence, result.outputCode!, taskId, workerId);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('Evidence hash mismatch');
  });

  it('14. duplicate submission is rejected/idempotent & 18. repeated execution does not duplicate valid records', async () => {
    const run1 = await ExecutionService.executeTask(taskId, workerId, 100);
    expect(run1.status).toBe('SUCCESS');

    const run2 = await ExecutionService.executeTask(taskId, workerId, 100);
    expect(run2.status).toBe('ALREADY_SUBMITTED');
    expect(run2.evidence?.id).toBe(run1.evidence?.id); // Returns same evidence
  });

  it('15. execution failure does not create successful submission', async () => {
    const result = await ExecutionService.executeTask(taskId, workerId, 100, true); // force test failure
    expect(result.status).toBe('FAILED');

    const task = await db.getTask(taskId);
    expect(task?.status).toBe('FAILED');
    expect(task?.status).not.toBe('SUBMITTED');

    const evidence = await db.getEvidenceByTaskId(taskId);
    expect(evidence).toBeNull(); // No successful evidence package saved
  });

  it('16. deadline exceeded is handled safely without state/financial mutation', async () => {
    const task = (await db.getTask(taskId))!;
    const timeoutDuration = task.deadlineSeconds + 1000;

    const result = await ExecutionService.executeTask(taskId, workerId, timeoutDuration);
    expect(result.status).toBe('EXPIRED');

    const taskAfter = await db.getTask(taskId);
    expect(taskAfter?.status).toBe('EXPIRED');

    // Verify wallet balances were NOT changed in Phase D
    const buyerWallet = await db.getWalletByAgentId(buyerId);
    const workerWallet = await db.getWalletByAgentId(workerId);
    expect(buyerWallet?.lockedBalance).toBe(10000); // Balances preserved safely
    expect(workerWallet?.lockedBalance).toBe(1000);
  });

  it('17. malformed evidence or task/worker mismatch is rejected', async () => {
    const result = await ExecutionService.executeTask(taskId, workerId, 100);

    const taskMismatch = ExecutionService.verifyEvidenceIntegrity(result.evidence!, result.outputCode!, 'WRONG-TASK', workerId);
    expect(taskMismatch.valid).toBe(false);
    expect(taskMismatch.reason).toContain('Task ID mismatch');

    const workerMismatch = ExecutionService.verifyEvidenceIntegrity(result.evidence!, result.outputCode!, taskId, 'WRONG-WORKER');
    expect(workerMismatch.valid).toBe(false);
    expect(workerMismatch.reason).toContain('Worker Agent ID mismatch');
  });
});
