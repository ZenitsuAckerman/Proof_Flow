import { getAppStateAction, initializeDemoAction, executeDemoStepAction, resetDemoAction } from '../app/actions';
import { db } from './repository';
import { CanonicalAppState } from './types';

async function runFullDemo(demoType: 'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN'): Promise<CanonicalAppState> {
  await initializeDemoAction(demoType);
  let state: CanonicalAppState | null = null;
  for (let i = 1; i <= 12; i++) {
    state = await executeDemoStepAction(demoType, i);
  }
  return state!;
}

describe('UI State Synchronization & Canonical State Builder', () => {
  beforeEach(() => {
    db.reset();
  });

  it('Initial canonical state matches repository state', async () => {
    const state = await getAppStateAction('TASK-DEMO-1');
    expect(state.task).toBeDefined();
    expect(state.task?.id).toBe('TASK-DEMO-1');
    expect(state.task?.status).toBe('CREATED');
    expect(state.escrow).toBeNull();
    expect(state.collateral).toBeNull();
    expect(state.buyerBond).toBeNull();
    expect(state.verificationResult).toBeNull();
    expect(state.settlement).toBeNull();
    expect(state.transactions.length).toBe(0);

    const buyerWallet = state.wallets.find(w => w.agentRole === 'BUYER');
    expect(buyerWallet?.availableBalance).toBe(100000);
    expect(buyerWallet?.lockedBalance).toBe(0);
  });

  it('PRIMARY: Canonical state shows full settlement and exact balances', async () => {
    const state = await runFullDemo('PRIMARY');
    
    expect(state.task?.status).toBe('COMPLETED');
    expect(state.verificationResult?.verdict).toBe('PASS');
    expect(state.settlement?.status).toBe('SETTLED');

    const buyerWallet = state.wallets.find(w => w.agentId === 'AGENT-BUYER-1');
    const workerWallet = state.wallets.find(w => w.agentId === 'AGENT-WORKER-1');

    // Expected final balances
    expect(buyerWallet?.availableBalance).toBe(90000); // 100k - 10k task value
    expect(buyerWallet?.lockedBalance).toBe(0);
    
    expect(workerWallet?.availableBalance).toBe(30000); // 20k + 10k task value
    expect(workerWallet?.lockedBalance).toBe(0);

    // Escrow, collateral, bond should be released/returned
    expect(state.escrow?.status).toBe('RELEASED');
    expect(state.collateral?.status).toBe('RETURNED');
    expect(state.buyerBond?.status).toBe('RETURNED');
  });

  it('RESET: Canonical state returns exactly to seeded baseline', async () => {
    await runFullDemo('PRIMARY');
    const state = await resetDemoAction();

    expect(state.task?.status).toBe('CREATED');
    expect(state.escrow).toBeNull();
    expect(state.settlement).toBeNull();
    expect(state.transactions.length).toBe(0);

    const buyerWallet = state.wallets.find(w => w.agentRole === 'BUYER');
    expect(buyerWallet?.availableBalance).toBe(100000);
  });

  it('FAILURE: Canonical state matches failed repo state', async () => {
    const state = await runFullDemo('FAILURE');
    
    expect(state.task?.status).toBe('PENALIZED');
    expect(state.verificationResult?.verdict).toBe('FAIL');
    expect(state.settlement?.status).toBe('SETTLED');
    expect(state.collateral?.status).toBe('SLASHED');

    const buyerWallet = state.wallets.find(w => w.agentId === 'AGENT-BUYER-1');
    const workerWallet = state.wallets.find(w => w.agentId === 'AGENT-WORKER-1');
    const protocolWallet = state.wallets.find(w => w.agentId === 'PROTOCOL-TREASURY');

    expect(buyerWallet?.availableBalance).toBe(100000); // Fully refunded
    expect(buyerWallet?.lockedBalance).toBe(0);
    
    expect(workerWallet?.availableBalance).toBe(20000 - 1000); // Lost 1k collateral
    expect(workerWallet?.lockedBalance).toBe(0);

    expect(protocolWallet?.availableBalance).toBe(1000); // Treasury gained 1k
  });

  it('BLIND_JURY: Shows research task, 5 evaluators, proper settlement', async () => {
    const state = await runFullDemo('BLIND_JURY');
    
    expect(state.task?.id).toBe('TASK-DEMO-2');
    expect(state.task?.taskType).toBe('research');
    expect(state.verificationResult?.routeType).toBe('BLIND_JURY');
    expect(state.verificationResult?.commitReveals?.length).toBe(5);
    expect(state.verificationResult?.verdict).toBe('PASS');
    expect(state.settlement?.status).toBe('SETTLED');
  });

  it('UNCERTAIN: Verification is UNCERTAIN, settlement NOT executed, wallets locked', async () => {
    const state = await runFullDemo('UNCERTAIN');
    
    expect(state.verificationResult?.verdict).toBe('UNCERTAIN');
    expect(state.settlement).toBeNull();
    
    // Wallets remain locked
    const buyerWallet = state.wallets.find(w => w.agentId === 'AGENT-BUYER-1');
    const workerWallet = state.wallets.find(w => w.agentId === 'AGENT-WORKER-2'); // Task 2 uses worker 2

    expect(buyerWallet?.lockedBalance).toBeGreaterThan(0);
    expect(workerWallet?.lockedBalance).toBeGreaterThan(0);
    
    expect(state.escrow?.status).toBe('LOCKED');
    expect(state.collateral?.status).toBe('LOCKED');
    expect(state.buyerBond?.status).toBe('LOCKED');
  });

  it('Scenario isolation: Prevents state leaks between runs', async () => {
    const s1 = await runFullDemo('PRIMARY');
    expect(s1.task?.id).toBe('TASK-DEMO-1');
    expect(s1.settlement?.status).toBe('SETTLED');

    await resetDemoAction();

    const s2 = await runFullDemo('BLIND_JURY');
    expect(s2.task?.id).toBe('TASK-DEMO-2');
    expect(s2.transactions.every(t => t.taskId === 'TASK-DEMO-2')).toBe(true);

    await resetDemoAction();

    const s3 = await runFullDemo('FAILURE');
    expect(s3.verificationResult?.verdict).toBe('FAIL');
    
    // Ensure no old transactions from previous scenarios exist
    const failureTxns = s3.transactions.filter(t => t.transactionType === 'WORKER_REWARD');
    expect(failureTxns.length).toBe(0); // Failures shouldn't have rewards
  });
  
  it('Progressive Execution: Validates step-by-step state changes', async () => {
    let state = await initializeDemoAction('PRIMARY');
    expect(state.currentStepIndex).toBe(0);
    
    // Step 4: Escrow funding
    state = await executeDemoStepAction('PRIMARY', 4);
    expect(state.currentStepIndex).toBe(4);
    expect(state.escrow).not.toBeNull();
    expect(state.escrow?.amount).toBe(10000);
    
    // Step 5: Collateral funding
    state = await executeDemoStepAction('PRIMARY', 5);
    expect(state.collateral).not.toBeNull();
    expect(state.collateral?.amount).toBe(1000);
  });
});
