'use server';

import { db } from '../core/repository';
import { OrchestratorService, DemoRunState } from '../core/orchestrator';
import { CanonicalAppState, WalletViewItem } from '../core/types';
import { FinancialReconciliation } from '../core/reconciliation';
import { ExecutionService } from '../core/execution';
import { VerificationService } from '../core/verification-service';
import { SettlementOrchestrator, VerifiedMachineSettlementResult } from '../core/settlement-orchestrator';
import { CapacityService } from '../core/capacity';

/**
 * Builds the single canonical AppState from the underlying domain repository.
 * This guarantees the frontend receives exactly what is in the database.
 */
export async function buildCanonicalAppState(taskId: string, demoState?: DemoRunState): Promise<CanonicalAppState> {
  const task = await db.getTask(taskId);
  const agents = await db.listAgents();
  const allTransactions = await db.listTransactions();
  const allTasks = await db.listTasks();
  
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

  // Filter transactions for the ledger view
  const transactions = allTransactions.filter(t => t.taskId === taskId || !t.taskId);

  return {
    task,
    allTasks,
    agents,
    wallets,
    transactions,
    escrow,
    collateral,
    buyerBond,
    verificationResult,
    clearingInstruction: settlement?.instruction || null,
    settlement,
    evidence,
    paymentInstruction: null,
    paymentReceipt: null,
    systemTotal,
    currentStage: demoState?.currentStage || 'DISCOVERY',
    currentStepIndex: demoState?.currentStepIndex || 0,
    steps: demoState?.steps || OrchestratorService.getBaseSteps(),
    systemStatus: demoState ? (demoState.currentStage === 'ARBITRATION' ? 'ARBITRATION' : 'ONLINE') : 'ONLINE',
    selectedWorkerId: task?.selectedWorkerId || task?.assignedWorkerId || null
  };
}

export async function getAppStateAction(taskId: string = 'TASK-DEMO-1'): Promise<CanonicalAppState> {
  return buildCanonicalAppState(taskId);
}

export async function initializeDemoAction(demoType: 'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN'): Promise<CanonicalAppState> {
  const demoState = await OrchestratorService.initializeDemo(demoType);
  const taskId = (demoType === 'BLIND_JURY' || demoType === 'UNCERTAIN') ? 'TASK-DEMO-2' : 'TASK-DEMO-1';
  return buildCanonicalAppState(taskId, demoState);
}

export async function executeDemoStepAction(demoType: 'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN', stepIndex: number): Promise<CanonicalAppState> {
  const demoState = await OrchestratorService.executeDemoStep(demoType, stepIndex);
  const taskId = (demoType === 'BLIND_JURY' || demoType === 'UNCERTAIN') ? 'TASK-DEMO-2' : 'TASK-DEMO-1';
  return buildCanonicalAppState(taskId, demoState);
}

export async function resetDemoAction(): Promise<CanonicalAppState> {
  await OrchestratorService.resetDemo();
  return buildCanonicalAppState('TASK-DEMO-1');
}

export async function submitDynamicTaskAction(prompt: string): Promise<CanonicalAppState> {
  const dynamicTask = await OrchestratorService.createDynamicTask(prompt);
  const demoState: DemoRunState = {
    currentStage: 'FUNDED',
    currentStepIndex: 4,
    steps: [
      { stepIndex: 1, stageName: 'DISCOVER', description: 'Search 75 registered economic agents', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 2, stageName: 'SELECT', description: 'Competitive bidding & Selection Engine evaluation', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 3, stageName: 'UNDERWRITE', description: 'Financial terms underwritten & exposure verified', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 4, stageName: 'FUND', description: 'Escrow & collateral locked', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 5, stageName: 'WORK', description: 'Task execution & evidence', status: 'PENDING', timestamp: '' },
      { stepIndex: 6, stageName: 'VERIFY', description: 'Deterministic verification', status: 'PENDING', timestamp: '' },
      { stepIndex: 7, stageName: 'CLEAR', description: 'Clearing decision', status: 'PENDING', timestamp: '' },
      { stepIndex: 8, stageName: 'SETTLE', description: 'Financial settlement', status: 'PENDING', timestamp: '' }
    ]
  };
  return buildCanonicalAppState(dynamicTask.id, demoState);
}

export async function executeDynamicWorkStepAction(
  taskId: string,
  userArtifactCode?: string,
  forceLiveMode: boolean = false
): Promise<CanonicalAppState> {
  const result = await ExecutionService.executeDynamicTask(taskId, userArtifactCode, forceLiveMode);
  const demoState: DemoRunState = {
    currentStage: result.status === 'SUCCESS' ? 'WORK' : 'FAILED',
    currentStepIndex: 5,
    steps: [
      { stepIndex: 1, stageName: 'DISCOVER', description: 'Search 75 registered economic agents', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 2, stageName: 'SELECT', description: 'Competitive bidding & Selection Engine evaluation', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 3, stageName: 'UNDERWRITE', description: 'Financial terms underwritten & exposure verified', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 4, stageName: 'FUND', description: 'Escrow & collateral locked', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 5, stageName: 'WORK', description: 'Task execution & evidence', status: result.status === 'SUCCESS' ? 'COMPLETED' : 'FAILED', timestamp: new Date().toISOString() },
      { stepIndex: 6, stageName: 'VERIFY', description: 'Deterministic verification', status: 'PENDING', timestamp: '' },
      { stepIndex: 7, stageName: 'CLEAR', description: 'Clearing decision', status: 'PENDING', timestamp: '' },
      { stepIndex: 8, stageName: 'SETTLE', description: 'Financial settlement', status: 'PENDING', timestamp: '' }
    ]
  };
  return buildCanonicalAppState(taskId, demoState);
}

export async function executeDynamicVerifyStepAction(
  taskId: string
): Promise<CanonicalAppState> {
  const vr = await VerificationService.verifyTask(taskId, { allowedVerificationBudgetOverride: 100 });
  const demoState: DemoRunState = {
    currentStage: vr.verdict === 'UNCERTAIN' ? 'UNCERTAIN' : 'VERIFY',
    currentStepIndex: 6,
    steps: [
      { stepIndex: 1, stageName: 'DISCOVER', description: 'Search 75 registered economic agents', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 2, stageName: 'SELECT', description: 'Competitive bidding & Selection Engine evaluation', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 3, stageName: 'UNDERWRITE', description: 'Financial terms underwritten & exposure verified', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 4, stageName: 'FUND', description: 'Escrow & collateral locked', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 5, stageName: 'WORK', description: 'Task execution & evidence', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 6, stageName: 'VERIFY', description: 'Deterministic verification', status: vr.verdict === 'UNCERTAIN' ? 'UNCERTAIN' : 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 7, stageName: 'CLEAR', description: 'Clearing decision', status: 'PENDING', timestamp: '' },
      { stepIndex: 8, stageName: 'SETTLE', description: 'Financial settlement', status: 'PENDING', timestamp: '' }
    ]
  };
  return buildCanonicalAppState(taskId, demoState);
}

export async function executeDynamicSettleStepAction(
  taskId: string,
  forceLiveMode: boolean = false
): Promise<CanonicalAppState> {
  const vr = await db.getVerificationResultByTaskId(taskId);
  let settleResult: VerifiedMachineSettlementResult | null = null;

  if (vr && vr.verdict !== 'UNCERTAIN') {
    settleResult = await SettlementOrchestrator.executeVerifiedMachineSettlement(taskId, forceLiveMode);
    const finalTask = await db.getTask(taskId);
    if (finalTask) {
      await CapacityService.updateCapacity(finalTask, vr.verdict);
    }
  }

  const finalStage = vr?.verdict === 'UNCERTAIN' ? 'UNCERTAIN' : (settleResult?.status === 'SUCCESS' ? 'SETTLE' : 'FAILED');

  const demoState: DemoRunState = {
    currentStage: finalStage,
    currentStepIndex: 8,
    steps: [
      { stepIndex: 1, stageName: 'DISCOVER', description: 'Search 75 registered economic agents', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 2, stageName: 'SELECT', description: 'Competitive bidding & Selection Engine evaluation', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 3, stageName: 'UNDERWRITE', description: 'Financial terms underwritten & exposure verified', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 4, stageName: 'FUND', description: 'Escrow & collateral locked', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 5, stageName: 'WORK', description: 'Task execution & evidence', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 6, stageName: 'VERIFY', description: 'Deterministic verification', status: vr?.verdict === 'UNCERTAIN' ? 'UNCERTAIN' : 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 7, stageName: 'CLEAR', description: 'Clearing decision', status: vr?.verdict === 'UNCERTAIN' ? 'UNCERTAIN' : 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 8, stageName: 'SETTLE', description: 'Financial settlement & x402 machine payment', status: vr?.verdict === 'UNCERTAIN' ? 'UNCERTAIN' : (settleResult?.status === 'SUCCESS' ? 'COMPLETED' : 'FAILED'), timestamp: new Date().toISOString() }
    ]
  };

  const appState = await buildCanonicalAppState(taskId, demoState);
  if (settleResult) {
    appState.paymentInstruction = settleResult.paymentInstruction || null;
    appState.paymentReceipt = settleResult.paymentReceipt || null;
  }
  return appState;
}

export async function executeDynamicTaskAction(
  taskId: string,
  userArtifactCode?: string,
  forceLiveMode: boolean = false
): Promise<CanonicalAppState> {
  await executeDynamicWorkStepAction(taskId, userArtifactCode, forceLiveMode);
  await executeDynamicVerifyStepAction(taskId);
  return executeDynamicSettleStepAction(taskId, forceLiveMode);
}

export async function executeMachineSettlementAction(
  taskId: string,
  isLiveMode: boolean = false
): Promise<CanonicalAppState> {
  const result = await SettlementOrchestrator.executeVerifiedMachineSettlement(taskId, isLiveMode);
  const demoState: DemoRunState = {
    currentStage: result.status === 'SUCCESS' ? 'SETTLE' : 'FAILED',
    currentStepIndex: 8,
    steps: [
      { stepIndex: 1, stageName: 'DISCOVER', description: 'Search 75 registered economic agents', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 2, stageName: 'SELECT', description: 'Competitive bidding & Selection Engine evaluation', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 3, stageName: 'UNDERWRITE', description: 'Financial terms underwritten & exposure verified', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 4, stageName: 'FUND', description: 'Escrow & collateral locked', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 5, stageName: 'WORK', description: 'Task execution & evidence', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 6, stageName: 'VERIFY', description: 'Deterministic verification', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 7, stageName: 'CLEAR', description: 'Clearing decision', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 8, stageName: 'SETTLE', description: 'Financial settlement & x402 machine payment', status: result.status === 'SUCCESS' ? 'COMPLETED' : 'FAILED', timestamp: new Date().toISOString() }
    ]
  };
  const appState = await buildCanonicalAppState(taskId, demoState);
  appState.paymentInstruction = result.paymentInstruction || null;
  appState.paymentReceipt = result.paymentReceipt || null;
  return appState;
}
