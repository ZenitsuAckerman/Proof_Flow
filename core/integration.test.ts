import { OrchestratorService, DemoRunState } from './orchestrator';
import { FinancialReconciliation } from './reconciliation';
import { db } from './repository';
import { Transaction } from './types';

async function runDemo(demoType: 'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN'): Promise<DemoRunState> {
  await OrchestratorService.initializeDemo(demoType);
  let state: DemoRunState | null = null;
  for (let i = 1; i <= 12; i++) {
    state = await OrchestratorService.executeDemoStep(demoType, i);
  }
  return state!;
}

describe('Phase G: End-to-End Integration & Demo Orchestration Test Suite', () => {
  beforeEach(async () => {
    db.reset();
  });

  it('1. Start Autonomous Transaction reaches COMPLETED', async () => {
    const state = await runDemo('PRIMARY');
    const task = await db.getTask('TASK-DEMO-1');
    const settlement = await db.getSettlementByTaskId('TASK-DEMO-1');
    
    expect(state.currentStage).toBe('SETTLE');
    expect(task?.status).toBe('COMPLETED');
    expect(settlement?.status).toBe('SETTLED');
  });

  it('2. Failure Scenario reaches PENALIZED with collateral slashed to PROTOCOL-TREASURY', async () => {
    await runDemo('FAILURE');
    const task = await db.getTask('TASK-DEMO-1');
    
    expect(task?.status).toBe('PENALIZED');

    const treasuryWallet = await db.getWalletByAgentId('PROTOCOL-TREASURY');
    expect(treasuryWallet?.availableBalance).toBe(1000);
  });

  it('3. Blind Jury demo produces expected consensus (PASS)', async () => {
    await runDemo('BLIND_JURY');
    const vr = await db.getVerificationResultByTaskId('TASK-DEMO-2');
    const settlement = await db.getSettlementByTaskId('TASK-DEMO-2');
    
    expect(vr?.routeType).toBe('BLIND_JURY');
    expect(vr?.verdict).toBe('PASS');
    expect(settlement?.status).toBe('SETTLED');
  });

  it('4. Uncertain scenario does not settle automatically', async () => {
    await runDemo('UNCERTAIN');
    const vr = await db.getVerificationResultByTaskId('TASK-DEMO-2');
    const settlement = await db.getSettlementByTaskId('TASK-DEMO-2');
    
    expect(vr?.verdict).toBe('UNCERTAIN');
    expect(settlement).toBeNull(); // ZERO automatic settlement
  });

  it('5. UI wallet values match repository state', async () => {
    await runDemo('PRIMARY');

    const buyerWallet = await db.getWalletByAgentId('AGENT-BUYER-1');
    const workerWallet = await db.getWalletByAgentId('AGENT-WORKER-1');

    expect(buyerWallet?.availableBalance).toBe(90000); // 100k - 10k task + 500 bond return
    expect(buyerWallet?.lockedBalance).toBe(0);

    expect(workerWallet?.availableBalance).toBe(30000); // 20k + 10k reward
    expect(workerWallet?.lockedBalance).toBe(0);
  });

  it('6. Settlement ledger matches actual financial movement', async () => {
    await runDemo('PRIMARY');
    const transactions = await db.listTransactions();

    const rewardTx = transactions.find((t: Transaction) => t.transactionType === 'WORKER_REWARD');
    const colReturnTx = transactions.find((t: Transaction) => t.transactionType === 'COLLATERAL_RETURN');
    const bondReturnTx = transactions.find((t: Transaction) => t.transactionType === 'REFUND');

    expect(rewardTx?.amount).toBe(10000);
    expect(colReturnTx?.amount).toBe(1000);
    expect(bondReturnTx?.amount).toBe(500);
  });

  it('7. Reset returns system to deterministic baseline state', async () => {
    await runDemo('PRIMARY');
    await OrchestratorService.resetDemo();

    const buyerWallet = await db.getWalletByAgentId('AGENT-BUYER-1');
    expect(buyerWallet?.availableBalance).toBe(100000);
    expect(buyerWallet?.lockedBalance).toBe(0);

    const totalMoney = await FinancialReconciliation.calculateSystemTotalMoney();
    expect(totalMoney).toBe(175500);
  });

  it('8. Duplicate run does not corrupt financial state', async () => {
    await runDemo('PRIMARY');
    const settlement1 = await db.getSettlementByTaskId('TASK-DEMO-1');
    expect(settlement1?.status).toBe('SETTLED');

    const totalMoney1 = await FinancialReconciliation.calculateSystemTotalMoney();

    // Re-run
    await runDemo('PRIMARY');
    
    const totalMoney2 = await FinancialReconciliation.calculateSystemTotalMoney();
    expect(totalMoney2).toBe(totalMoney1);
  });
});
