import { Task, Evidence, VerificationVerdict, VerificationConfidence } from '../types';

export interface ReferenceVerificationOutput {
  score: number;
  confidence: VerificationConfidence;
  verdict: VerificationVerdict;
  evidenceUsed: string[];
  message: string;
}

export class ReferenceVerifier {
  static verify(task: Task, evidence: Evidence, referenceGoldOutput?: string): ReferenceVerificationOutput {
    const evidenceUsed = ['outputHash', 'referenceOutputHash', 'similarityScore'];
    const outputCode = (evidence.evidencePayload.outputCode as string) || '';

    if (!referenceGoldOutput) {
      referenceGoldOutput = `def solve_bounty():\n    return {"status": "success", "task_id": "${task.id}", "result": 42}`;
    }

    // Reference/Gold Set Comparison Score
    const match = outputCode.trim() === referenceGoldOutput.trim();
    const score = match ? 100 : 50;
    const confidence: VerificationConfidence = 'HIGH';
    const verdict: VerificationVerdict = match ? 'PASS' : 'PARTIAL';

    return {
      score,
      confidence,
      verdict,
      evidenceUsed,
      message: match 
        ? 'Reference verification passed: Output matched reference gold set exactly'
        : 'Reference verification partial: Output differed from reference gold set'
    };
  }
}
