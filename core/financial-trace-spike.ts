import { db } from './repository';
import { UnderwritingService, EscrowService, CollateralService, BuyerBondService } from './financial';
import { ExecutionService } from './execution';
import { VerificationService } from './verification-service';
import { SettlementOrchestrator } from './settlement-orchestrator';
import { FinancialReconciliation } from './reconciliation';
import { Task } from './types';

export async function runFinancialTraceSpike(): Promise<void> {
  console.log('==================================================');
  console.log('PROOFFLOW — EXACT ₹10,000 FINANCIAL TRACE AUDIT');
  console.log('==================================================');

  await db.reset();

  const buyerId = 'AGENT-BUYER-1';
  const workerId = 'AGENT-WORKER-1';
  const taskId = 'TASK-TRACE-10K';

  // Set explicit initial balances for Part 3 audit specification
  const buyerWallet = await db.getWalletByAgentId(buyerId);
  const workerWallet = await db.getWalletByAgentId(workerId);
  if (buyerWallet) buyerWallet.availableBalance = 50000;
  if (workerWallet) workerWallet.availableBalance = 20000;

  const mockTask: Task = {
    id: taskId,
    buyerAgentId: buyerId,
    selectedWorkerId: workerId,
    assignedWorkerId: workerId,
    title: '₹10,000 Trace Task',
    description: 'Financial Trace Verification Task',
    taskType: 'code',
    specialization: 'debugging',
    userPrompt: 'Trace ₹10,000 task prompt',
    budget: 10000,
    deadlineSeconds: 300,
    qualityThreshold: 90,
    verificationPolicy: { preferred: 'deterministic' },
    status: 'ASSIGNED',
    createdAt: new Date().toISOString()
  };

  await db.createTask(mockTask);

  const initialTotal = await FinancialReconciliation.calculateSystemTotalMoney();

  const printStage = async (stageName: string) => {
    const bW = await db.getWalletByAgentId(buyerId);
    const wW = await db.getWalletByAgentId(workerId);
    const pW = await db.getWalletByAgentId('PROTOCOL-TREASURY');
    const esc = await db.getEscrow(taskId);
    const col = await db.getCollateralByTaskId(taskId);
    const bnd = await db.getBuyerBondByTaskId(taskId);

    const bAvail = bW?.availableBalance || 0;
    const bLock = bW?.lockedBalance || 0;
    const wAvail = wW?.availableBalance || 0;
    const wLock = wW?.lockedBalance || 0;

    const escAmount = (esc && esc.status === 'LOCKED') ? esc.amount : 0;
    const colAmount = (col && col.status === 'LOCKED') ? col.amount : 0;
    const bndAmount = (bnd && bnd.status === 'LOCKED') ? bnd.amount : 0;

    const protoTotal = (pW?.availableBalance || 0) + (pW?.lockedBalance || 0);

    const allWallets = await db.listWallets();
    const evaluatorTotal = allWallets
      .filter(w => w.agentId.startsWith('AGENT-EVALUATOR-'))
      .reduce((sum, w) => sum + w.availableBalance + w.lockedBalance, 0);

    const currentTotal = await FinancialReconciliation.calculateSystemTotalMoney();

    console.log(`\n--- Stage: ${stageName} ---`);
    console.log(`Buyer Available:     ₹${bAvail.toLocaleString()}`);
    console.log(`Buyer Locked:        ₹${bLock.toLocaleString()}`);
    console.log(`Worker Available:    ₹${wAvail.toLocaleString()}`);
    console.log(`Worker Locked:       ₹${wLock.toLocaleString()}`);
    console.log(`Escrow Locked:       ₹${escAmount.toLocaleString()}`);
    console.log(`Collateral Locked:   ₹${colAmount.toLocaleString()}`);
    console.log(`Buyer Bond Locked:   ₹${bndAmount.toLocaleString()}`);
    console.log(`Evaluator Balances:  ₹${evaluatorTotal.toLocaleString()}`);
    console.log(`Protocol Treasury:   ₹${protoTotal.toLocaleString()}`);
    console.log(`System Total:        ₹${currentTotal.toLocaleString()}`);
  };

  // 1. Initial State
  await printStage('1. INITIAL');

  // Underwrite Task
  await UnderwritingService.underwriteTask(taskId, 95);

  // 2. Escrow Lock (₹10,000)
  await EscrowService.fundEscrow(taskId, buyerId, `e-${taskId}`);
  await printStage('2. ESCROW LOCK (₹10,000)');

  // 3. Buyer Bond Lock (₹500)
  await BuyerBondService.lockBond(taskId, buyerId, `b-${taskId}`);
  await printStage('3. BUYER BOND LOCK (₹500)');

  // 4. Worker Collateral Lock (₹1,000)
  await CollateralService.lockCollateral(taskId, workerId, `c-${taskId}`);
  await printStage('4. WORKER COLLATERAL LOCK (₹1,000)');

  // 5. Execution
  await ExecutionService.executeTask(taskId, workerId, 100);
  await printStage('5. EXECUTION');

  // 6. Verification PASS
  await VerificationService.verifyTask(taskId, { allowedVerificationBudgetOverride: 1000 });
  await printStage('6. VERIFICATION PASS');

  // 7 & 8 & 9 & 10. Clearing, Settlement, Collateral Return, Buyer Bond Return
  const settleResult = await SettlementOrchestrator.executeVerifiedMachineSettlement(taskId, false);
  if (settleResult.status !== 'SUCCESS') {
    throw new Error(`Settlement failed: ${settleResult.message}`);
  }

  await printStage('7-10. CLEARING & SETTLEMENT & RETURNS');

  // 11. Final State
  await printStage('11. FINAL');

  const finalTotal = await FinancialReconciliation.calculateSystemTotalMoney();
  const delta = finalTotal - initialTotal;

  console.log('\n==================================================');
  console.log(`INITIAL TOTAL: ₹${initialTotal.toLocaleString()}`);
  console.log(`FINAL TOTAL:   ₹${finalTotal.toLocaleString()}`);
  console.log(`DELTA:         ₹${delta.toLocaleString()}`);
  console.log('==================================================');

  if (delta !== 0) {
    throw new Error(`CONSERVATION_VIOLATION: Money conservation delta is non-zero (₹${delta})`);
  }
}

if (require.main === module) {
  runFinancialTraceSpike().catch(err => {
    console.error('Fatal Financial Trace Error:', err);
    process.exit(1);
  });
}
