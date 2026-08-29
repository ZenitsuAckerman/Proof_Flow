import { db } from './repository';
import { ClearingEngine } from './clearing';
import { SettlementService } from './settlement';
import { PaymentPolicyEngine } from './payment-policy';
import { PaymentReconciliationEngine } from './payment-reconciliation';
import { X402PaymentRail } from './x402-payment-rail';
import { SettlementInstruction, Settlement, PaymentInstruction, PaymentReceipt } from './types';

export interface VerifiedMachineSettlementResult {
  status: 'SUCCESS' | 'PAYMENT_FAILED' | 'PAYMENT_RECONCILIATION_FAILED' | 'SETTLEMENT_FAILED';
  instruction: SettlementInstruction;
  settlement?: Settlement;
  paymentInstruction?: PaymentInstruction;
  paymentReceipt?: PaymentReceipt;
  message?: string;
}

export class SettlementOrchestrator {
  /**
   * Orchestrates the complete Verified Machine Settlement Lifecycle:
   * Verification -> Clearing -> Payment Authorization -> x402 Payment -> External Receipt -> Reconciliation -> Internal Settlement Finalization
   */
  static async executeVerifiedMachineSettlement(
    taskId: string,
    isLiveMode: boolean = false
  ): Promise<VerifiedMachineSettlementResult> {
    const task = await db.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    // 0. Idempotency Check: Retrieve existing settlement if task was already settled
    const existingSettlement = await db.getSettlementByTaskId(taskId);
    if (existingSettlement && (existingSettlement.status === 'SETTLED' || existingSettlement.status === 'ALREADY_SETTLED')) {
      const fallbackInstruction: SettlementInstruction = existingSettlement.instruction || {
        taskId,
        verdict: 'PASS',
        workerAmount: existingSettlement.workerAmount,
        buyerRefund: existingSettlement.buyerRefund,
        evaluatorAmount: existingSettlement.evaluatorAmount,
        protocolAmount: existingSettlement.protocolAmount,
        collateralReturned: existingSettlement.collateralReturned,
        collateralSlashed: existingSettlement.collateralSlashed || 0,
        buyerBondReturned: existingSettlement.buyerBondReturned || 0,
        buyerBondSlashed: existingSettlement.buyerBondSlashed || 0,
        escrowReleased: existingSettlement.workerAmount + existingSettlement.buyerRefund,
        reason: 'Existing settlement retrieved idempotently'
      };

      return {
        status: 'SUCCESS',
        instruction: fallbackInstruction,
        settlement: {
          ...existingSettlement,
          status: 'ALREADY_SETTLED'
        },
        message: 'Task has already been settled idempotently.'
      };
    }

    const verificationResult = await db.getVerificationResultByTaskId(taskId);
    const escrow = await db.getEscrow(taskId);
    const collateral = await db.getCollateralByTaskId(taskId);
    const buyerBond = await db.getBuyerBondByTaskId(taskId);

    // 1. Calculate Authoritative Clearing SettlementInstruction
    const instruction = ClearingEngine.calculateInstruction(
      task,
      verificationResult,
      escrow,
      collateral,
      buyerBond
    );

    // 2. Handle PASS / PARTIAL verdicts requiring external machine worker payout
    if (instruction.verdict === 'PASS' || instruction.verdict === 'PARTIAL') {
      // Step A: Authorize Payment
      const paymentInstruction = PaymentPolicyEngine.authorizePayment(task, instruction);
      paymentInstruction.status = 'PAYMENT_AUTHORIZED';

      // Step B: Submit Payment to x402 Payment Rail
      const rail = new X402PaymentRail(isLiveMode);
      paymentInstruction.status = 'PAYMENT_SUBMITTED';

      const paymentResult = await rail.pay({
        taskId: task.id,
        payerAgentId: paymentInstruction.payerAgentId,
        payeeAgentId: paymentInstruction.payeeAgentId,
        payerAddress: paymentInstruction.payerAddress,
        payeeAddress: paymentInstruction.payeeAddress,
        amount: paymentInstruction.externalAmount,
        asset: paymentInstruction.externalAsset,
        network: paymentInstruction.externalNetwork
      });

      if (paymentResult.status !== 'SUCCESS' || !paymentResult.receipt) {
        paymentInstruction.status = 'PAYMENT_FAILED';
        return {
          status: 'PAYMENT_FAILED',
          instruction,
          paymentInstruction,
          message: paymentResult.reason || paymentResult.message || 'External machine payment failed on x402 rail.'
        };
      }

      const receipt = paymentResult.receipt;

      // Step C: Reconcile External Payment Receipt against Authorized Instruction
      const reconResult = PaymentReconciliationEngine.reconcilePayment(paymentInstruction, receipt, isLiveMode);
      if (!reconResult.reconciled) {
        paymentInstruction.status = 'PAYMENT_RECONCILIATION_FAILED';
        return {
          status: 'PAYMENT_RECONCILIATION_FAILED',
          instruction,
          paymentInstruction,
          paymentReceipt: receipt,
          message: reconResult.reason || 'Payment reconciliation failed.'
        };
      }

      // Step D: Payment & Reconciliation Confirmed -> Finalize Internal Ledger Settlement
      paymentInstruction.status = isLiveMode ? 'PAYMENT_CONFIRMED' : 'PAYMENT_AUTHORIZED';

      const idempotencyKey = `settle-${task.id}`;
      const settlement = await SettlementService.executeInstruction(instruction, idempotencyKey);

      return {
        status: 'SUCCESS',
        instruction,
        settlement,
        paymentInstruction,
        paymentReceipt: receipt,
        message: isLiveMode 
          ? 'Real external x402 machine payment confirmed & internal ledger settlement finalized.'
          : 'Simulated machine payment completed in DEMO mode & internal ledger settlement finalized.'
      };
    }

    // 3. Handle FAIL / DEFECTIVE / EXPIRED verdicts (Buyer refund / Collateral slash without worker payment)
    const idempotencyKey = `settle-${task.id}`;
    const settlement = await SettlementService.executeInstruction(instruction, idempotencyKey);

    return {
      status: 'SUCCESS',
      instruction,
      settlement,
      message: `Internal settlement executed for ${instruction.verdict} verdict.`
    };
  }
}
