import { PaymentInstruction, PaymentReceipt } from './types';
import { PaymentRail, PaymentRailResult, PaymentParams } from './payment-rail';
import { runH0X402FeasibilitySpike } from './h0-x402-spike';
import crypto from 'crypto';

export class X402PaymentRail implements PaymentRail {
  railKey: string = 'x402-evm-base-sepolia';
  private isLiveMode: boolean;

  constructor(isLiveMode: boolean = false) {
    this.isLiveMode = isLiveMode;
  }

  async executePayment(params: PaymentParams): Promise<PaymentRailResult> {
    // RULE 2: LIVE MODE MUST NEVER SIMULATE
    if (this.isLiveMode) {
      const envKey = process.env.X402_PRIVATE_KEY;
      const payerKey = params.payerPrivateKey || envKey;

      if (!payerKey || typeof payerKey !== 'string' || !payerKey.startsWith('0x') || payerKey.length < 10) {
        return {
          status: 'FAILED',
          message: 'MISSING_CREDENTIALS: X402_PRIVATE_KEY environment variable is missing or invalid for LIVE mode. Live execution cannot simulate.'
        };
      }

      // Execute Real x402 Machine Payment via H0 Spike Engine
      const spikeResult = await runH0X402FeasibilitySpike(params);
      if (spikeResult.status === 'SUCCESS' && spikeResult.receipt) {
        spikeResult.receipt.simulated = false;
        spikeResult.receipt.source = 'REAL_X402';
      }
      return spikeResult;
    }

    // RULE 3: SIMULATION MUST BE EXPLICIT (DEMO Mode Only)
    const simulatedTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const receipt: PaymentReceipt = {
      paymentId: `PAY-SIM-${crypto.randomUUID().slice(0, 8)}`,
      taskId: params.taskId,
      payerAgentId: params.payerAgentId,
      payeeAgentId: params.payeeAgentId,
      payer: params.payerAddress || '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A',
      payee: params.payeeAddress || '0x2bE3B00000000000000000000000000000000000',
      amount: params.amount,
      asset: params.asset || 'USDC',
      network: params.network || 'Base Sepolia (Chain ID 84532)',
      transactionHash: simulatedTxHash,
      explorerUrl: `https://sepolia.basescan.org/tx/${simulatedTxHash}`,
      status: 'SIMULATED',
      timestamp,
      isTestnet: false,
      rail: 'x402-simulated-demo',
      simulated: true,
      source: 'SIMULATION'
    };

    return {
      status: 'SUCCESS',
      success: true,
      receipt,
      message: 'SIMULATED payment constructed for DEMO MODE.'
    };
  }

  async pay(params: PaymentParams): Promise<PaymentRailResult> {
    return this.executePayment(params);
  }

  async executeInstruction(instruction: PaymentInstruction): Promise<PaymentRailResult> {
    return this.pay({
      taskId: instruction.taskId,
      payerAgentId: instruction.payerAgentId,
      payeeAgentId: instruction.payeeAgentId,
      payerAddress: instruction.payerAddress,
      payeeAddress: instruction.payeeAddress,
      amount: instruction.externalAmount,
      asset: instruction.externalAsset,
      network: instruction.externalNetwork
    });
  }

  async verifyReceipt(receipt: PaymentReceipt): Promise<{ valid: boolean; reason?: string }> {
    if (!receipt.transactionHash || !receipt.transactionHash.startsWith('0x')) {
      return { valid: false, reason: 'Invalid or missing transaction hash.' };
    }
    if (this.isLiveMode && receipt.simulated) {
      return { valid: false, reason: 'SIMULATED_RECEIPT_REJECTED: Simulated receipts are rejected in LIVE mode.' };
    }
    if (receipt.status !== 'CONFIRMED' && receipt.status !== 'SIMULATED') {
      return { valid: false, reason: `Receipt status is ${receipt.status}, expected CONFIRMED or SIMULATED.` };
    }
    return { valid: true };
  }

  async verify(receipt: PaymentReceipt): Promise<{ valid: boolean; reason?: string }> {
    return this.verifyReceipt(receipt);
  }
}
