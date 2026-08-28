import { db } from './repository';

export interface WalletAccountReport {
  accountId: string;
  agentId: string;
  accountType: 'BUYER' | 'WORKER' | 'EVALUATOR' | 'PROTOCOL_TREASURY';
  available: number;
  locked: number;
  total: number;
  includedInTotal: boolean;
}

export class FinancialReconciliation {
  /**
   * System-Wide Financial Money Conservation Reconciliation Helper
   * Lists EVERY wallet/account in DB and calculates system total money.
   */
  static async getSystemLevelReport(): Promise<{ accounts: WalletAccountReport[]; systemTotal: number }> {
    const agents = await db.listAgents();
    const accounts: WalletAccountReport[] = [];
    let systemTotal = 0;

    for (const agent of agents) {
      const wallet = await db.getWalletByAgentId(agent.id);
      if (wallet) {
        let accountType: WalletAccountReport['accountType'] = 'WORKER';
        if (agent.id === 'PROTOCOL-TREASURY') accountType = 'PROTOCOL_TREASURY';
        else if (agent.role.includes('BUYER')) accountType = 'BUYER';
        else if (agent.role.includes('EVALUATOR')) accountType = 'EVALUATOR';

        const total = wallet.availableBalance + wallet.lockedBalance;
        systemTotal += total;

        accounts.push({
          accountId: wallet.id,
          agentId: agent.id,
          accountType,
          available: wallet.availableBalance,
          locked: wallet.lockedBalance,
          total,
          includedInTotal: true
        });
      }
    }

    return { accounts, systemTotal };
  }

  static async calculateSystemTotalMoney(): Promise<number> {
    const report = await this.getSystemLevelReport();
    return report.systemTotal;
  }

  /**
   * Transaction-Level Reconciliation Helper
   * Calculates sum of balances for transaction participants only (Buyer, Worker, Protocol Treasury).
   */
  static async getTransactionLevelReport(buyerId: string, workerId: string): Promise<{ buyerTotal: number; workerTotal: number; protocolTotal: number; transactionTotal: number }> {
    const buyerWallet = await db.getWalletByAgentId(buyerId);
    const workerWallet = await db.getWalletByAgentId(workerId);
    const protocolWallet = await db.getWalletByAgentId('PROTOCOL-TREASURY');

    const buyerTotal = (buyerWallet?.availableBalance || 0) + (buyerWallet?.lockedBalance || 0);
    const workerTotal = (workerWallet?.availableBalance || 0) + (workerWallet?.lockedBalance || 0);
    const protocolTotal = (protocolWallet?.availableBalance || 0) + (protocolWallet?.lockedBalance || 0);
    const transactionTotal = buyerTotal + workerTotal + protocolTotal;

    return { buyerTotal, workerTotal, protocolTotal, transactionTotal };
  }

  /**
   * Assert money conservation before and after financial operations
   */
  static async assertMoneyConservation(initialTotal: number, scenarioName: string): Promise<boolean> {
    const currentTotal = await this.calculateSystemTotalMoney();
    const conserved = currentTotal === initialTotal;
    if (!conserved) {
      throw new Error(`CONSERVATION_VIOLATION: Money conservation failed in ${scenarioName}! Initial = ₹${initialTotal}, Current = ₹${currentTotal}`);
    }
    return conserved;
  }
}
