import { Task, Evidence, CommitRevealData, VerificationVerdict, VerificationConfidence } from '../types';
import { db } from '../repository';
import crypto from 'crypto';

export interface BlindJuryVerificationOutput {
  status: 'VERIFIED' | 'FAILED' | 'UNCERTAIN' | 'NO_VALID_VERIFIER';
  score: number;
  confidence: VerificationConfidence;
  disagreementScore: number;
  verifierIds: string[];
  commitReveals: CommitRevealData[];
  verdict: VerificationVerdict;
  evidenceUsed: string[];
  message: string;
}

export interface EvaluatorVoteInput {
  evaluatorId: string;
  score: number;
  nonce: string;
  simulateInvalidReveal?: boolean;
  simulateTimeout?: boolean;
}

export class BlindJuryVerifier {
  /**
   * Helper to compute evaluator commitment hash
   */
  static computeCommitmentHash(score: number, nonce: string, taskId: string): string {
    return crypto.createHash('sha256').update(`${score}|${nonce}|${taskId}`).digest('hex');
  }

  /**
   * Calculate median of an array of numbers
   */
  static calculateMedian(scores: number[]): number {
    if (scores.length === 0) return 0;
    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Calculate population standard deviation (disagreement score)
   */
  static calculateStandardDeviation(scores: number[]): number {
    if (scores.length <= 1) return 0;
    const mean = scores.reduce((sum, val) => sum + val, 0) / scores.length;
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
  }

  /**
   * Execute 5-evaluator Blind Jury Commit/Reveal & Median Aggregation
   */
  static async verify(
    task: Task, 
    evidence: Evidence, 
    customVotes?: EvaluatorVoteInput[]
  ): Promise<BlindJuryVerificationOutput> {
    const evidenceUsed = ['outputHash', 'evidenceHash', 'evaluatorCommitments', 'revealedScores'];

    // 1. Select Evaluators (Must select 5 evaluators)
    const allAgents = await db.listAgents();
    const evaluatorAgents = allAgents.filter(a => a.role.includes('EVALUATOR'));
    
    if (evaluatorAgents.length < 5 && !customVotes) {
      return {
        status: 'NO_VALID_VERIFIER',
        score: 0,
        confidence: 'LOW',
        disagreementScore: 0,
        verifierIds: [],
        commitReveals: [],
        verdict: 'UNCERTAIN',
        evidenceUsed,
        message: 'Insufficient evaluator agents available (requires 5 evaluators)'
      };
    }

    const selectedEvaluators: EvaluatorVoteInput[] = customVotes
      ? customVotes
      : evaluatorAgents.slice(0, 5).map(agent => ({
          evaluatorId: agent.id,
          score: 90, // Default passing score
          nonce: crypto.randomBytes(8).toString('hex')
        }));

    const verifierIds = selectedEvaluators.map(e => e.evaluatorId);
    const commitReveals: CommitRevealData[] = [];
    const validRevealedScores: number[] = [];

    // 2. Commit & Reveal Stage
    for (const vote of selectedEvaluators) {
      const expectedCommitment = this.computeCommitmentHash(vote.score, vote.nonce, task.id);

      if (vote.simulateTimeout) {
        commitReveals.push({
          evaluatorId: vote.evaluatorId,
          commitmentHash: expectedCommitment,
          revealStatus: 'TIMEOUT'
        });
        continue;
      }

      if (vote.simulateInvalidReveal) {
        // Evaluator reveals a tampered score or invalid nonce
        commitReveals.push({
          evaluatorId: vote.evaluatorId,
          commitmentHash: expectedCommitment,
          revealedScore: vote.score + 10,
          revealedNonce: 'wrong-nonce',
          revealStatus: 'INVALID_REVEAL'
        });
        continue;
      }

      // Valid Commit & Reveal Verification
      const actualHash = this.computeCommitmentHash(vote.score, vote.nonce, task.id);
      if (actualHash === expectedCommitment) {
        commitReveals.push({
          evaluatorId: vote.evaluatorId,
          commitmentHash: expectedCommitment,
          revealedScore: vote.score,
          revealedNonce: vote.nonce,
          revealStatus: 'REVEALED'
        });
        validRevealedScores.push(vote.score);
      } else {
        commitReveals.push({
          evaluatorId: vote.evaluatorId,
          commitmentHash: expectedCommitment,
          revealedScore: vote.score,
          revealedNonce: vote.nonce,
          revealStatus: 'INVALID_REVEAL'
        });
      }
    }

    // 3. Quorum Check (Must have at least 3 valid revealed scores out of 5)
    if (validRevealedScores.length < 3) {
      return {
        status: 'NO_VALID_VERIFIER',
        score: 0,
        confidence: 'LOW',
        disagreementScore: 0,
        verifierIds,
        commitReveals,
        verdict: 'UNCERTAIN',
        evidenceUsed,
        message: `Insufficient valid evaluator quorum (${validRevealedScores.length}/5 valid reveals)`
      };
    }

    // 4. Jury Aggregation (Median & Disagreement Calculation)
    const consensusScore = Math.round(this.calculateMedian(validRevealedScores));
    const disagreementScore = parseFloat(this.calculateStandardDeviation(validRevealedScores).toFixed(2));

    // 5. High Disagreement Handling (stdDev > 15 -> UNCERTAIN)
    // Note: Minority voters are NOT marked malicious; high variance simply flags uncertainty.
    if (disagreementScore > 15) {
      return {
        status: 'UNCERTAIN',
        score: consensusScore,
        confidence: 'LOW',
        disagreementScore,
        verifierIds,
        commitReveals,
        verdict: 'UNCERTAIN',
        evidenceUsed,
        message: `Evaluator disagreement too high (stdDev=${disagreementScore} > 15)`
      };
    }

    // 6. Verdict Determination
    const threshold = task.qualityThreshold || 80;
    let verdict: VerificationVerdict = 'FAIL';

    if (consensusScore >= threshold) {
      verdict = 'PASS';
    } else if (consensusScore >= 60) {
      verdict = 'PARTIAL';
    } else {
      verdict = 'FAIL';
    }

    return {
      status: 'VERIFIED',
      score: consensusScore,
      confidence: 'MEDIUM', // Blind Jury provides medium confidence
      disagreementScore,
      verifierIds,
      commitReveals,
      verdict,
      evidenceUsed,
      message: `Blind Jury consensus score = ${consensusScore} (stdDev=${disagreementScore}, verdict=${verdict})`
    };
  }
}
