'use server';

import { db } from '../core/repository';
import { OrchestratorService, DemoRunState } from '../core/orchestrator';
import { CanonicalAppState, WalletViewItem } from '../core/types';
import { FinancialReconciliation } from '../core/reconciliation';

/**
 * Builds the single canonical AppState from the underlying domain repository.
 * This guarantees the frontend receives exactly what is in the database.
 */
export async function buildCanonicalAppState(taskId: string, demoState?: DemoRunState): Promise<CanonicalAppState> {
  const task = await db.getTask(taskId);
  const agents = await db.listAgents();
  const allTransactions = await db.listTransactions();
  
  const escrow = await db.getEscrow(taskId);
  const collateral = await db.getCollateralByTaskId(taskId);
  const buyerBond = await db.getBuyerBondByTaskId(taskId);
  const verificationResult = await db.getVerificationResultByTaskId(taskId);
  const settlement = await db.getSettlementByTaskId(taskId);
  const evidence = await db.getEvidenceByTaskId(taskId);

  const systemTotal = await FinancialReconciliation.calculateSystemTotalMoney();

  const wallets: WalletViewItem[] = [];
  for (const agent of agents) {
    const w = await db.getWalletByAgentId(agent.id);
    if (w) wallets.push({ ...w, agentName: agent.name, agentRole: agent.role[0] });
  }

  return {
    task,
    agents,
    wallets,
    transactions: allTransactions,
    escrow,
    collateral,
    buyerBond,
    verificationResult,
    clearingInstruction: demoState?.clearingInstruction || settlement?.instruction || null,
    settlement,
    evidence,
    systemTotal,
    // Orchestration metadata (only if provided, otherwise empty defaults)
    currentStage: demoState?.currentStage || 'DISCOVERY',
    currentStepIndex: demoState?.currentStepIndex || 1,
    steps: demoState?.steps || [],
    systemStatus: demoState ? (demoState.currentStage === 'ARBITRATION' ? 'ARBITRATION' : 'ONLINE') : 'ONLINE',
    selectedWorkerId: task?.selectedWorkerId || task?.assignedWorkerId || demoState?.selectedWorkerId || null
  };
}

export async function getAppStateAction(taskId: string = 'TASK-DEMO-1'): Promise<CanonicalAppState> {
  return buildCanonicalAppState(taskId);
}

export async function runDemoAction(demoType: 'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN' | 'RESET'): Promise<CanonicalAppState> {
  let demoState: DemoRunState | null = null;
  let taskId = 'TASK-DEMO-1';

  if (demoType === 'PRIMARY') {
    demoState = await OrchestratorService.runPrimaryDemoPass();
  } else if (demoType === 'FAILURE') {
    demoState = await OrchestratorService.runFailureScenario();
  } else if (demoType === 'BLIND_JURY') {
    taskId = 'TASK-DEMO-2';
    demoState = await OrchestratorService.runBlindJuryDemo();
  } else if (demoType === 'UNCERTAIN') {
    taskId = 'TASK-DEMO-2';
    demoState = await OrchestratorService.runUncertainScenario();
  } else if (demoType === 'RESET') {
    await OrchestratorService.resetDemo();
    // After reset, default back to TASK-DEMO-1
    return buildCanonicalAppState('TASK-DEMO-1');
  }

  // If a demo state exists, we use its taskId instead of the default if possible
  if (demoState && demoState.task) {
    taskId = demoState.task.id;
  }

  return buildCanonicalAppState(taskId, demoState || undefined);
}
