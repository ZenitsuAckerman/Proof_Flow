import { db } from './repository';
import { Evidence } from './types';
import crypto from 'crypto';

export interface ExecutionResult {
  status: 'SUCCESS' | 'ALREADY_SUBMITTED' | 'EXPIRED' | 'FAILED';
  evidence?: Evidence;
  outputCode?: string;
  message?: string;
}

export class ExecutionService {
  /**
   * Deterministic SHA-256 Hash Helper
   */
  static hashString(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Compute evidence hash from payload, output hash, task ID, and worker ID
   */
  static computeEvidenceHash(evidencePayload: Record<string, unknown>, outputHash: string, taskId: string, workerAgentId: string): string {
    const serialized = JSON.stringify(evidencePayload) + '|' + outputHash + '|' + taskId + '|' + workerAgentId;
    return this.hashString(serialized);
  }

  /**
   * Execute deterministic Python coding task and submit proof-carrying evidence package
   */
  static async executeTask(
    taskId: string, 
    workerAgentId: string, 
    simulatedDurationSeconds: number = 100,
    forceTestFailure: boolean = false
  ): Promise<ExecutionResult> {
    const task = await db.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    // Idempotency check: If task is already SUBMITTED or evidence exists
    const existingEvidence = await db.getEvidenceByTaskId(taskId);
    if (task.status === 'SUBMITTED' || existingEvidence) {
      if (existingEvidence) {
        return {
          status: 'ALREADY_SUBMITTED',
          evidence: existingEvidence,
          outputCode: existingEvidence.evidencePayload.outputCode as string,
          message: 'Task has already been executed and submitted'
        };
      }
    }

    // Task state validation: MUST be in ASSIGNED state
    if (task.status !== 'ASSIGNED') {
      throw new Error(`INVALID_TASK_STATE: Cannot execute task in ${task.status} state. Task must be in ASSIGNED state.`);
    }

    // Assigned worker validation
    if (!task.assignedWorkerId) {
      throw new Error('UNAUTHORIZED_WORKER: Task has no assigned worker');
    }
    if (task.assignedWorkerId !== workerAgentId) {
      throw new Error(`UNAUTHORIZED_WORKER: Worker ${workerAgentId} is not assigned to task ${taskId} (assigned to ${task.assignedWorkerId})`);
    }

    // Transition state: ASSIGNED -> EXECUTING
    await db.updateTaskStatus(taskId, 'EXECUTING');

    // Deadline check
    if (simulatedDurationSeconds > task.deadlineSeconds) {
      // Deadline exceeded: transition task to EXPIRED safely without modifying balances
      await db.updateTaskStatus(taskId, 'EXPIRED');
      return {
        status: 'EXPIRED',
        message: `Execution deadline exceeded (${simulatedDurationSeconds}s > ${task.deadlineSeconds}s)`
      };
    }

    // Execute Deterministic Demo Task (Python Code Task)
    const outputCode = forceTestFailure
      ? `# Defective Implementation\ndef solve_bounty():\n    raise ValueError("Bug in code")`
      : `# Verified Implementation for ${task.title}\ndef solve_bounty():\n    """Deterministic ProofFlow Bounty Solution"""\n    return {"status": "success", "task_id": "${task.id}", "result": 42}`;

    const outputHash = this.hashString(outputCode);

    const testResults = forceTestFailure
      ? [
          { testName: 'test_syntax', status: 'PASS', durationMs: 10 },
          { testName: 'test_correctness', status: 'FAIL', durationMs: 40, error: 'ValueError: Bug in code' },
          { testName: 'test_performance', status: 'FAIL', durationMs: 0 },
        ]
      : [
          { testName: 'test_syntax', status: 'PASS', durationMs: 12 },
          { testName: 'test_correctness', status: 'PASS', durationMs: 45 },
          { testName: 'test_performance', status: 'PASS', durationMs: 30 },
          { testName: 'test_edge_cases', status: 'PASS', durationMs: 18 },
          { testName: 'test_deterministic_seed', status: 'PASS', durationMs: 5 },
        ];

    const passedCount = testResults.filter(t => t.status === 'PASS').length;
    const failedCount = testResults.filter(t => t.status === 'FAIL').length;
    const totalTests = testResults.length;
    const evidenceStrength = totalTests > 0 ? passedCount / totalTests : 0;

    if (forceTestFailure || failedCount > 0) {
      // Execution failure: do not transition to SUBMITTED
      // Keep state as EXECUTING or FAILED so no failed execution creates a successful submission
      await db.updateTaskStatus(taskId, 'FAILED');
      return {
        status: 'FAILED',
        message: `Execution failed ${failedCount}/${totalTests} tests`
      };
    }

    const evidencePayload: Record<string, unknown> = {
      testCount: totalTests,
      passedCount,
      failedCount,
      testResults,
      outputCode,
      executionTrace: `STDOUT: Running pytest on ${task.title}... ${passedCount} passed in ${(simulatedDurationSeconds / 1000).toFixed(2)}s`,
      submittedTimestamp: new Date().toISOString()
    };

    const evidenceHash = this.computeEvidenceHash(evidencePayload, outputHash, taskId, workerAgentId);

    const evidence: Evidence = {
      id: `EVID-${crypto.randomUUID().slice(0, 8)}`,
      taskId,
      workerAgentId,
      outputHash,
      evidenceHash,
      evidenceType: 'code_test_suite',
      evidencePayload,
      evidenceStrength,
      submittedAt: new Date().toISOString(),
    };

    // Save Evidence
    await db.createEvidence(evidence);

    // Transition state: EXECUTING -> SUBMITTED
    await db.updateTaskStatus(taskId, 'SUBMITTED');

    return {
      status: 'SUCCESS',
      evidence,
      outputCode
    };
  }

  /**
   * Verify Evidence Package Integrity against provided output code and task parameters
   */
  static verifyEvidenceIntegrity(
    evidence: Evidence, 
    providedOutputCode: string,
    expectedTaskId?: string,
    expectedWorkerAgentId?: string
  ): { valid: boolean; reason?: string } {
    // 1. Task ID Mismatch Check
    if (expectedTaskId && evidence.taskId !== expectedTaskId) {
      return { valid: false, reason: `Task ID mismatch: evidence belongs to ${evidence.taskId}, expected ${expectedTaskId}` };
    }

    // 2. Worker Agent ID Mismatch Check
    if (expectedWorkerAgentId && evidence.workerAgentId !== expectedWorkerAgentId) {
      return { valid: false, reason: `Worker Agent ID mismatch: evidence submitted by ${evidence.workerAgentId}, expected ${expectedWorkerAgentId}` };
    }

    // 3. Output Code Hash Re-computation & Verification
    const computedOutputHash = this.hashString(providedOutputCode);
    if (computedOutputHash !== evidence.outputHash) {
      return { valid: false, reason: `Output hash mismatch! Content has been altered. Computed: ${computedOutputHash}, Recorded: ${evidence.outputHash}` };
    }

    // 4. Evidence Package Hash Re-computation & Verification
    const computedEvidenceHash = this.computeEvidenceHash(
      evidence.evidencePayload, 
      evidence.outputHash, 
      evidence.taskId, 
      evidence.workerAgentId
    );

    if (computedEvidenceHash !== evidence.evidenceHash) {
      return { valid: false, reason: `Evidence hash mismatch! Evidence payload has been tampered with. Computed: ${computedEvidenceHash}, Recorded: ${evidence.evidenceHash}` };
    }

    return { valid: true };
  }
}
