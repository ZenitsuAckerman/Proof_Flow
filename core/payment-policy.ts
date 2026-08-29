import { Task, SettlementInstruction, PaymentInstruction } from './types';
import { MAX_H0_PAYMENT_USDC } from './h0-x402-spike';
import crypto from 'crypto';

export class PaymentPolicyEngine {
  /**
   * Authorize external machine payment from authoritative clearing SettlementInstruction
   */
  static authorizePayment(
    task: Task,
    settlementInstruction: SettlementInstruction,
    overrideExternalAmount?: number
  ): PaymentInstruction {
    // 1. Task verification / clearing verdict check
    if (settlementInstruction.verdict !== 'PASS' && settlementInstruction.verdict !== 'PARTIAL') {
      throw new Error(`PAYMENT_UNAUTHORIZED: Clearing verdict is ${settlementInstruction.verdict}. Machine payment only authorized for PASS or PARTIAL.`);
    }

    // 2. Task already completed check
    if (task.status === 'COMPLETED') {
      throw new Error(`PAYMENT_UNAUTHORIZED: Task ${task.id} has already been completed and settled.`);
    }

    // 3. Task expired check
    if (task.status === 'EXPIRED') {
      throw new Error(`PAYMENT_UNAUTHORIZED: Task ${task.id} is EXPIRED.`);
    }

    // 4. Instruction mismatch check
    if (settlementInstruction.taskId !== task.id) {
      throw new Error(`PAYMENT_UNAUTHORIZED: Settlement instruction task ID (${settlementInstruction.taskId}) mismatch with task (${task.id}).`);
    }

    // 5. Worker payout check
    if (settlementInstruction.workerAmount <= 0) {
      throw new Error(`PAYMENT_UNAUTHORIZED: Settlement worker payout is 0.`);
    }

    // 6. Selected worker check
    const workerId = task.selectedWorkerId || task.assignedWorkerId;
    if (!workerId) {
      throw new Error(`PAYMENT_UNAUTHORIZED: Task ${task.id} has no selected or assigned worker.`);
    }

    // 7. Calculate external USDC amount safely (Reference rate: ₹150 INR = 0.001 USDC for testnet)
    const externalAmount = overrideExternalAmount ?? 0.001;
    if (externalAmount <= 0) {
      throw new Error(`PAYMENT_UNAUTHORIZED: External payment amount must be positive.`);
    }
    if (externalAmount > MAX_H0_PAYMENT_USDC) {
      throw new Error(`PAYMENT_UNAUTHORIZED: External amount (${externalAmount} USDC) exceeds safety limit (${MAX_H0_PAYMENT_USDC} USDC).`);
    }

    const rawPayer = process.env.X402_PAYER_ADDRESS;
    const rawPayee = process.env.X402_PAYEE_ADDRESS;

    const isValidPayer = Boolean(rawPayer && rawPayer.startsWith('0x') && rawPayer.length === 42 && !rawPayer.includes('YOUR_'));
    const isValidPayee = Boolean(rawPayee && rawPayee.startsWith('0x') && rawPayee.length === 42 && !rawPayee.includes('YOUR_'));

    const payerAddress = isValidPayer ? rawPayer! : '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A';
    const payeeAddress = isValidPayee ? rawPayee! : '0x2bE3B00000000000000000000000000000000000';

    const idempotencyKey = `pay-intent-${task.id}-${crypto.createHash('sha256').update(JSON.stringify(settlementInstruction)).digest('hex').slice(0, 12)}`;

    return {
      taskId: task.id,
      settlementInstructionId: `SETTLE-INST-${task.id}`,
      payerAgentId: task.buyerAgentId || 'AGENT-BUYER-1',
      payeeAgentId: workerId,
      internalAmount: settlementInstruction.workerAmount,
      internalDenomination: 'INR',
      externalAmount,
      externalAsset: 'USDC',
      externalNetwork: 'Base Sepolia (Chain ID 84532)',
      paymentRail: 'x402-evm-base-sepolia',
      paymentIdempotencyKey: idempotencyKey,
      payerAddress,
      payeeAddress,
      status: 'PAYMENT_AUTHORIZED',
      createdAt: new Date().toISOString()
    };
  }
}
