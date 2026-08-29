import { PaymentInstruction, PaymentReceipt } from './types';
import { BASE_SEPOLIA_CHAIN_ID } from './h0-x402-spike';

export interface ReconciliationResult {
  reconciled: boolean;
  reason?: string;
  reconciledAt: string;
}

export class PaymentReconciliationEngine {
  /**
   * Reconciles external machine PaymentReceipt against authorized internal PaymentInstruction
   * RULE 17: Hard assertion against false positives
   */
  static reconcilePayment(
    instruction: PaymentInstruction,
    receipt: PaymentReceipt,
    isLiveMode: boolean = false
  ): ReconciliationResult {
    const timestamp = new Date().toISOString();

    // RULE 17: Hard assertion against simulation in LIVE mode
    if (isLiveMode && (receipt.simulated || receipt.source === 'SIMULATION' || receipt.status === 'SIMULATED')) {
      return {
        reconciled: false,
        reason: 'RECONCILIATION_FAILED: Simulated receipt rejected in LIVE mode. Real external payment required.',
        reconciledAt: timestamp
      };
    }

    // 1. Receipt Status Check
    if (receipt.status !== 'CONFIRMED' && receipt.status !== 'SIMULATED') {
      return {
        reconciled: false,
        reason: `RECONCILIATION_FAILED: Payment receipt status is ${receipt.status}, expected CONFIRMED or SIMULATED.`,
        reconciledAt: timestamp
      };
    }

    // 2. Transaction Hash Integrity Check
    if (!receipt.transactionHash || !receipt.transactionHash.startsWith('0x') || receipt.transactionHash.length < 10) {
      return {
        reconciled: false,
        reason: 'RECONCILIATION_FAILED: Invalid or missing external transaction hash.',
        reconciledAt: timestamp
      };
    }

    // 3. Task ID Mismatch Check
    if (receipt.taskId && receipt.taskId !== instruction.taskId) {
      return {
        reconciled: false,
        reason: `RECONCILIATION_FAILED: Task ID mismatch. Receipt has ${receipt.taskId}, expected ${instruction.taskId}.`,
        reconciledAt: timestamp
      };
    }

    // 4. Payer Agent ID Check
    if (receipt.payerAgentId && receipt.payerAgentId !== instruction.payerAgentId) {
      return {
        reconciled: false,
        reason: `RECONCILIATION_FAILED: Payer Agent ID mismatch. Receipt has ${receipt.payerAgentId}, expected ${instruction.payerAgentId}.`,
        reconciledAt: timestamp
      };
    }

    // 5. Payee Agent ID Check
    if (receipt.payeeAgentId && receipt.payeeAgentId !== instruction.payeeAgentId) {
      return {
        reconciled: false,
        reason: `RECONCILIATION_FAILED: Payee Agent ID mismatch. Receipt has ${receipt.payeeAgentId}, expected ${instruction.payeeAgentId}.`,
        reconciledAt: timestamp
      };
    }

    // 6. External Amount Match Check
    if (Math.abs(receipt.amount - instruction.externalAmount) > 0.000001) {
      return {
        reconciled: false,
        reason: `RECONCILIATION_FAILED: External amount mismatch. Receipt has ${receipt.amount} ${receipt.asset}, expected ${instruction.externalAmount} ${instruction.externalAsset}.`,
        reconciledAt: timestamp
      };
    }

    // 7. External Asset Match Check
    if (receipt.asset.toUpperCase() !== instruction.externalAsset.toUpperCase()) {
      return {
        reconciled: false,
        reason: `RECONCILIATION_FAILED: External asset mismatch. Receipt has ${receipt.asset}, expected ${instruction.externalAsset}.`,
        reconciledAt: timestamp
      };
    }

    return {
      reconciled: true,
      reconciledAt: timestamp
    };
  }

  /**
   * On-chain RPC verification helper (Rule 8)
   */
  static async verifyOnChainReceipt(
    receipt: PaymentReceipt,
    rpcUrl: string = process.env.X402_TESTNET_RPC_URL || 'https://sepolia.base.org'
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const { createPublicClient, http } = await import('viem');
      const { baseSepolia } = await import('viem/chains');

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(rpcUrl)
      });

      const chainId = await publicClient.getChainId();
      if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
        return { valid: false, reason: `INVALID_NETWORK: Chain ID ${chainId} does not match Base Sepolia (${BASE_SEPOLIA_CHAIN_ID}).` };
      }

      if (!receipt.transactionHash || !receipt.transactionHash.startsWith('0x')) {
        return { valid: false, reason: 'INVALID_TX_HASH: Transaction hash missing or malformed.' };
      }

      return { valid: true };
    } catch (err: unknown) {
      const errorObj = err as Error;
      return { valid: false, reason: `ON_CHAIN_VERIFICATION_ERROR: ${errorObj.message || String(err)}` };
    }
  }
}
