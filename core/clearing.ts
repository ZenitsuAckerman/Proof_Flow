import { Task, VerificationResult, Escrow, Collateral, BuyerBond, SettlementInstruction } from './types';

export class ClearingEngine {
  /**
   * Deterministic Clearing Engine
   * Evaluates task, underwritten terms, verification result, and locked pools to generate a single authoritative SettlementInstruction.
   * STRICT REQUIREMENT: Does NOT mutate wallets directly.
   */
  static calculateInstruction(
    task: Task,
    verificationResult: VerificationResult | null,
    escrow: Escrow | null,
    collateral: Collateral | null,
    buyerBond: BuyerBond | null,
    isDefectiveSpec: boolean = false
  ): SettlementInstruction {
    if (!escrow || escrow.status !== 'LOCKED') {
      throw new Error('INVALID_TASK_STATE: Locked escrow record is required for clearing');
    }

    if (verificationResult && verificationResult.taskId !== task.id) {
      throw new Error(`INVALID_TASK_STATE: VerificationResult task ID (${verificationResult.taskId}) mismatch with task (${task.id})`);
    }

    // 1. DEFECTIVE Buyer Specification Policy
    if (isDefectiveSpec) {
      const workerAmount = Math.round(escrow.amount * 0.20); // 20% compensation
      const buyerRefund = escrow.amount - workerAmount;
      const buyerBondSlashed = buyerBond ? buyerBond.amount : 0;
      const collateralReturned = collateral ? collateral.amount : 0;

      return {
        taskId: task.id,
        verdict: 'DEFECTIVE',
        workerAmount,
        buyerRefund,
        evaluatorAmount: 0,
        protocolAmount: 0,
        collateralReturned,
        collateralSlashed: 0,
        buyerBondReturned: 0,
        buyerBondSlashed,
        escrowReleased: escrow.amount,
        reason: 'DEFECTIVE buyer specification: 20% worker compensation, buyer bond slashed to worker, remaining escrow refunded'
      };
    }

    // 2. EXPIRED Task Policy (Worker Timeout)
    if (task.status === 'EXPIRED') {
      const collateralSlashed = collateral ? Math.round(collateral.amount * 0.5) : 0; // 50% penalty
      const collateralReturned = collateral ? collateral.amount - collateralSlashed : 0;
      const buyerBondReturned = buyerBond ? buyerBond.amount : 0;

      return {
        taskId: task.id,
        verdict: 'EXPIRED',
        workerAmount: 0,
        buyerRefund: escrow.amount,
        evaluatorAmount: 0,
        protocolAmount: 0,
        collateralReturned,
        collateralSlashed,
        buyerBondReturned,
        buyerBondSlashed: 0,
        escrowReleased: escrow.amount,
        reason: 'Task EXPIRED (deadline exceeded): Buyer escrow refunded, 50% worker collateral penalty applied'
      };
    }

    if (!verificationResult) {
      throw new Error('INVALID_TASK_STATE: VerificationResult is required for clearing');
    }

    // 3. UNCERTAIN Policy (High Disagreement / Quorum / Budget Issues)
    if (verificationResult.verdict === 'UNCERTAIN' || verificationResult.status === 'UNCERTAIN' || verificationResult.status === 'NO_VALID_VERIFIER') {
      return {
        taskId: task.id,
        verdict: 'UNCERTAIN',
        workerAmount: 0,
        buyerRefund: 0,
        evaluatorAmount: 0,
        protocolAmount: 0,
        collateralReturned: 0,
        collateralSlashed: 0,
        buyerBondReturned: 0,
        buyerBondSlashed: 0,
        escrowReleased: 0,
        reason: `Task status UNCERTAIN (${verificationResult.message || 'Verification unresolved'}): Financial balances preserved safely for arbitration`
      };
    }

    const score = verificationResult.score;

    // 4. PASS Policy (Score >= 90)
    if (score >= 90 || verificationResult.verdict === 'PASS') {
      return {
        taskId: task.id,
        verdict: 'PASS',
        workerAmount: escrow.amount,
        buyerRefund: 0,
        evaluatorAmount: 0,
        protocolAmount: 0,
        collateralReturned: collateral ? collateral.amount : 0,
        collateralSlashed: 0,
        buyerBondReturned: buyerBond ? buyerBond.amount : 0,
        buyerBondSlashed: 0,
        escrowReleased: escrow.amount,
        reason: `Task verified PASS (score ${score}% >= 90%): Full worker payout, collateral & buyer bond returned`
      };
    }

    // 5. PARTIAL Policy (60 <= Score < 90)
    if (score >= 60 || verificationResult.verdict === 'PARTIAL') {
      const workerAmount = Math.round(escrow.amount * (score / 100));
      const buyerRefund = escrow.amount - workerAmount;

      return {
        taskId: task.id,
        verdict: 'PARTIAL',
        workerAmount,
        buyerRefund,
        evaluatorAmount: 0,
        protocolAmount: 0,
        collateralReturned: collateral ? collateral.amount : 0,
        collateralSlashed: 0,
        buyerBondReturned: buyerBond ? buyerBond.amount : 0,
        buyerBondSlashed: 0,
        escrowReleased: escrow.amount,
        reason: `Task verified PARTIAL (score ${score}%): Proportional worker payout, buyer refunded remainder`
      };
    }

    // 6. FAIL Policy (Score < 60)
    return {
      taskId: task.id,
      verdict: 'FAIL',
      workerAmount: 0,
      buyerRefund: escrow.amount,
      evaluatorAmount: 0,
      protocolAmount: 0,
      collateralReturned: 0,
      collateralSlashed: collateral ? collateral.amount : 0,
      buyerBondReturned: buyerBond ? buyerBond.amount : 0,
      buyerBondSlashed: 0,
      escrowReleased: escrow.amount,
      reason: `Task verified FAIL (score ${score}% < 60%): Full buyer escrow refund, worker collateral slashed`
    };
  }
}
