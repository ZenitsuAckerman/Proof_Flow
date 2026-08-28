import { OrchestratorService } from './orchestrator';
import { FinancialReconciliation } from './reconciliation';
import { db } from './repository';
import { Transaction } from './types';

describe('Phase G: End-to-End Integration & Demo Orchestration Test Suite', () => {
  beforeEach(async () => {
    db.reset();
  });

  it('1. Start Autonomous Transaction reaches COMPLETED', async () => {
    const state = await OrchestratorService.runPrimaryDemoPass();
    expect(state.currentStage).toBe('CAPACITY');
    expect(state.task?.status).toBe('COMPLETED');
    expect(state.clearingInstruction?.verdict).toBe('PASS');
    expect(state.settlement?.status).toBe('SETTLED');
  });

  it('2. Failure Scenario reaches PENALIZED with collateral slashed to PROTOCOL-TREASURY', async () => {
    const state = await OrchestratorService.runFailureScenario();
    expect(state.task?.status).toBe('PENALIZED');
    expect(state.clearingInstruction?.verdict).toBe('FAIL');
    expect(state.clearingInstruction?.collateralSlashed).toBe(1000);

    const treasuryWallet = await db.getWalletByAgentId('PROTOCOL-TREASURY');
    expect(treasuryWallet?.availableBalance).toBe(1000);
  });

  it('3. Blind Jury demo produces expected consensus (PASS)', async () => {
    const state = await OrchestratorService.runBlindJuryDemo();
    expect(state.verificationResult?.routeType).toBe('BLIND_JURY');
    expect(state.verificationResult?.verdict).toBe('PASS');
    expect(state.settlement?.status).toBe('SETTLED');
  });

  it('4. Uncertain scenario does not settle automatically', async () => {
    const state = await OrchestratorService.runUncertainScenario();
    expect(state.verificationResult?.verdict).toBe('UNCERTAIN');
    expect(state.clearingInstruction?.verdict).toBe('UNCERTAIN');
    expect(state.settlement).toBeNull(); // ZERO automatic settlement
  });

  it('5. UI wallet values match repository state', async () => {
    await OrchestratorService.runPrimaryDemoPass();

    const buyerWallet = await db.getWalletByAgentId('AGENT-BUYER-1');
    const workerWallet = await db.getWalletByAgentId('AGENT-WORKER-1');

    expect(buyerWallet?.availableBalance).toBe(90000); // 100k - 10k task + 500 bond return
    expect(buyerWallet?.lockedBalance).toBe(0);

    expect(workerWallet?.availableBalance).toBe(30000); // 20k + 10k reward
    expect(workerWallet?.lockedBalance).toBe(0);
  });

  it('6. Settlement ledger matches actual financial movement', async () => {
    await OrchestratorService.runPrimaryDemoPass();
    const transactions = await db.listTransactions();

    const rewardTx = transactions.find((t: Transaction) => t.transactionType === 'WORKER_REWARD');
    const colReturnTx = transactions.find((t: Transaction) => t.transactionType === 'COLLATERAL_RETURN');
    const bondReturnTx = transactions.find((t: Transaction) => t.transactionType === 'REFUND');

    expect(rewardTx?.amount).toBe(10000);
    expect(colReturnTx?.amount).toBe(1000);
    expect(bondReturnTx?.amount).toBe(500);
  });

  it('7. Reset returns system to deterministic baseline state', async () => {
    await OrchestratorService.runPrimaryDemoPass();
    await OrchestratorService.resetDemo();

    const buyerWallet = await db.getWalletByAgentId('AGENT-BUYER-1');
    expect(buyerWallet?.availableBalance).toBe(100000);
    expect(buyerWallet?.lockedBalance).toBe(0);

    const totalMoney = await FinancialReconciliation.calculateSystemTotalMoney();
    expect(totalMoney).toBe(175500);
  });

  it('8. Duplicate run does not corrupt financial state', async () => {
    const state1 = await OrchestratorService.runPrimaryDemoPass();
    expect(state1.settlement?.status).toBe('SETTLED');

    const totalMoney1 = await FinancialReconciliation.calculateSystemTotalMoney();

    // Attempt second settlement on completed task
    if (state1.clearingInstruction) {
      const dup = await OrchestratorService.runPrimaryDemoPass();
      expect(dup.settlement?.status).toBe('SETTLED');
    }

    const totalMoney2 = await FinancialReconciliation.calculateSystemTotalMoney();
    expect(totalMoney2).toBe(totalMoney1);
  });
});
