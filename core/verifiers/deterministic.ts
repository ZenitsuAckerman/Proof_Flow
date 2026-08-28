import { Task, Evidence, VerificationVerdict, VerificationConfidence } from '../types';
import { ExecutionService } from '../execution';

export interface DeterministicVerificationOutput {
  score: number;
  testPassRate: number;
  confidence: VerificationConfidence;
  verdict: VerificationVerdict;
  evidenceUsed: string[];
  message: string;
}

export class DeterministicVerifier {
  static verify(task: Task, evidence: Evidence, providedOutputCode?: string): DeterministicVerificationOutput {
    const evidenceUsed = ['outputHash', 'evidenceHash', 'testResults', 'executionTrace'];
    const outputCode = providedOutputCode || (evidence.evidencePayload.outputCode as string) || '';

    // 1. Verify Cryptographic Hashes & Task/Worker Binding
    const integrity = ExecutionService.verifyEvidenceIntegrity(evidence, outputCode, task.id, task.assignedWorkerId);
    if (!integrity.valid) {
      return {
        score: 0,
        testPassRate: 0,
        confidence: 'HIGH',
        verdict: 'FAIL',
        evidenceUsed,
        message: `Integrity check failed: ${integrity.reason}`
      };
    }

    // 2. Extract Test Execution Results
    const payload = evidence.evidencePayload;
    const testCount = (payload.testCount as number) || 0;
    const passedCount = (payload.passedCount as number) || 0;
    const failedCount = (payload.failedCount as number) || 0;

    if (testCount <= 0) {
      return {
        score: 0,
        testPassRate: 0,
        confidence: 'HIGH',
        verdict: 'FAIL',
        evidenceUsed,
        message: 'Missing required test results in evidence package'
      };
    }

    const testPassRate = passedCount / testCount;
    const score = Math.round(testPassRate * 100);

    // Bounded Verification Confidence for Objective Deterministic Execution
    const confidence: VerificationConfidence = 'HIGH';

    // Verdict Determination
    let verdict: VerificationVerdict = 'FAIL';
    if (score >= 90 && failedCount === 0) {
      verdict = 'PASS';
    } else if (score >= 60) {
      verdict = 'PARTIAL';
    } else {
      verdict = 'FAIL';
    }

    return {
      score,
      testPassRate,
      confidence,
      verdict,
      evidenceUsed,
      message: `Deterministic verification completed: ${passedCount}/${testCount} tests passed (${score}%)`
    };
  }
}
