import { db } from './repository';
import { VerificationResult } from './types';
import { VerificationRouter } from './verification-router';
import { DeterministicVerifier } from './verifiers/deterministic';
import { ReferenceVerifier } from './verifiers/reference';
import { BlindJuryVerifier, EvaluatorVoteInput } from './verifiers/blind-jury';
import crypto from 'crypto';

export interface VerificationOptions {
  allowedVerificationBudgetOverride?: number;
  outputCodeOverride?: string;
  referenceOutputOverride?: string;
  customVotes?: EvaluatorVoteInput[];
}

export class VerificationService {
  /**
   * Main Autonomous Verification Service
   * Autonomously selects verifier route, executes verification, and records VerificationResult.
   * STRICT REQUIREMENT: ZERO FINANCIAL MUTATIONS.
   */
  static async verifyTask(taskId: string, options?: VerificationOptions): Promise<VerificationResult> {
    const task = await db.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    // Task state validation: MUST be in SUBMITTED state
    if (task.status !== 'SUBMITTED') {
      throw new Error(`INVALID_TASK_STATE: Cannot verify task in ${task.status} state. Task must be in SUBMITTED state.`);
    }

    // Transition state: SUBMITTED -> VERIFYING
    await db.updateTaskStatus(taskId, 'VERIFYING');

    // Retrieve submitted evidence package
    const evidence = await db.getEvidenceByTaskId(taskId);
    if (!evidence) {
      await db.updateTaskStatus(taskId, 'FAILED');
      const failedResult: VerificationResult = {
        id: `VERIF-${crypto.randomUUID().slice(0, 8)}`,
        taskId,
        routeType: 'DETERMINISTIC',
        status: 'FAILED',
        score: 0,
        confidence: 'HIGH',
        verificationCost: 0,
        evidenceUsed: [],
        verdict: 'FAIL',
        completedAt: new Date().toISOString(),
        message: 'Missing required evidence package'
      };
      await db.createVerificationResult(failedResult);
      return failedResult;
    }

    // 1. Autonomous Verification Route Selection
    const routeChoice = VerificationRouter.selectRoute(task, evidence, options?.allowedVerificationBudgetOverride);

    if (!routeChoice.viable) {
      // Economic or route impossibility: transition to UNCERTAIN
      await db.updateTaskStatus(taskId, 'UNCERTAIN');
      const uncertainResult: VerificationResult = {
        id: `VERIF-${crypto.randomUUID().slice(0, 8)}`,
        taskId,
        routeType: routeChoice.selectedRoute,
        status: 'NO_VALID_VERIFIER',
        score: 0,
        confidence: 'LOW',
        verificationCost: routeChoice.estimatedCost,
        evidenceUsed: ['outputHash', 'evidenceHash'],
        verdict: 'UNCERTAIN',
        completedAt: new Date().toISOString(),
        message: routeChoice.reason
      };
      await db.createVerificationResult(uncertainResult);
      return uncertainResult;
    }

    // 2. Execute Verification Route
    let outputStatus: VerificationResult['status'] = 'VERIFIED';
    let score = 0;
    let confidence: VerificationResult['confidence'] = 'HIGH';
    let verdict: VerificationResult['verdict'] = 'FAIL';
    let evidenceUsed: string[] = [];
    let disagreementScore: number | undefined;
    let verifierIds: string[] | undefined;
    let commitReveals: VerificationResult['commitReveals'];
    let message = '';

    switch (routeChoice.selectedRoute) {
      case 'DETERMINISTIC': {
        const detResult = DeterministicVerifier.verify(task, evidence, options?.outputCodeOverride);
        score = detResult.score;
        confidence = detResult.confidence;
        verdict = detResult.verdict;
        evidenceUsed = detResult.evidenceUsed;
        message = detResult.message;
        outputStatus = verdict === 'FAIL' ? 'FAILED' : 'VERIFIED';
        break;
      }

      case 'REFERENCE': {
        const refResult = ReferenceVerifier.verify(task, evidence, options?.referenceOutputOverride);
        score = refResult.score;
        confidence = refResult.confidence;
        verdict = refResult.verdict;
        evidenceUsed = refResult.evidenceUsed;
        message = refResult.message;
        outputStatus = verdict === 'FAIL' ? 'FAILED' : 'VERIFIED';
        break;
      }

      case 'BLIND_JURY': {
        const juryResult = await BlindJuryVerifier.verify(task, evidence, options?.customVotes);
        outputStatus = juryResult.status;
        score = juryResult.score;
        confidence = juryResult.confidence;
        disagreementScore = juryResult.disagreementScore;
        verifierIds = juryResult.verifierIds;
        commitReveals = juryResult.commitReveals;
        verdict = juryResult.verdict;
        evidenceUsed = juryResult.evidenceUsed;
        message = juryResult.message;
        break;
      }
    }

    // 3. Construct Verification Result
    const verificationResult: VerificationResult = {
      id: `VERIF-${crypto.randomUUID().slice(0, 8)}`,
      taskId,
      routeType: routeChoice.selectedRoute,
      status: outputStatus,
      score,
      confidence,
      verificationCost: routeChoice.estimatedCost,
      evidenceUsed,
      disagreementScore,
      verifierIds,
      commitReveals,
      verdict,
      completedAt: new Date().toISOString(),
      message
    };

    // 4. Update Task Lifecycle State Post-Verification
    if (verdict === 'PASS' || verdict === 'PARTIAL') {
      await db.updateTaskStatus(taskId, 'CLEARING'); // Task ready for clearing/settlement in Phase F
    } else if (verdict === 'UNCERTAIN') {
      await db.updateTaskStatus(taskId, 'UNCERTAIN');
    } else {
      await db.updateTaskStatus(taskId, 'FAILED');
    }

    // 5. Persist Verification Result (ZERO financial balance mutations)
    await db.createVerificationResult(verificationResult);

    return verificationResult;
  }
}
