import 'dotenv/config';
import { loadEnvConfig } from '@next/env';
import { X402PaymentRail } from './x402-payment-rail';
import { PaymentPolicyEngine } from './payment-policy';
import { PaymentReconciliationEngine } from './payment-reconciliation';
import { Task, SettlementInstruction } from './types';

export async function runH3LiveSpike(): Promise<void> {
  loadEnvConfig(process.cwd());
  console.log('==================================================');
  console.log('PROOFFLOW H3 — REAL X402 PAYMENT');
  console.log('==================================================');

  const envKey = process.env.X402_PRIVATE_KEY;
  if (!envKey || !envKey.startsWith('0x')) {
    console.log('Status: FAILED');
    console.log('');
    console.log('Reason:');
    console.log('MISSING_CREDENTIALS: X402_PRIVATE_KEY environment variable is missing or invalid (must start with 0x).');
    console.log('');
    console.log('Instructions:');
    console.log('Set X402_PRIVATE_KEY in your environment or .env file before running npm run h3:live.');
    console.log('==================================================');
    process.exit(1);
  }

  const mockTask: Task = {
    id: 'TASK-H3-LIVE-SPIKE',
    buyerAgentId: 'AGENT-BUYER-1',
    selectedWorkerId: 'AGENT-WORKER-007',
    assignedWorkerId: 'AGENT-WORKER-007',
    title: 'Machine Settlement Test Task',
    description: 'H3 Machine Settlement Verification Task',
    taskType: 'code',
    specialization: 'debugging',
    userPrompt: 'Machine settlement test prompt',
    budget: 150,
    deadlineSeconds: 300,
    qualityThreshold: 90,
    verificationPolicy: { preferred: 'deterministic' },
    status: 'SUBMITTED',
    createdAt: new Date().toISOString()
  };

  const instruction: SettlementInstruction = {
    taskId: mockTask.id,
    verdict: 'PASS',
    workerAmount: 150,
    buyerRefund: 0,
    evaluatorAmount: 0,
    protocolAmount: 0,
    collateralReturned: 100,
    collateralSlashed: 0,
    buyerBondReturned: 50,
    buyerBondSlashed: 0,
    escrowReleased: 150,
    reason: 'Verified PASS: Authorize worker machine payout on x402 rail'
  };

  const paymentInstruction = PaymentPolicyEngine.authorizePayment(mockTask, instruction, 0.001);

  // Instantiates real LIVE X402PaymentRail
  const rail = new X402PaymentRail(true);
  const paymentResult = await rail.executeInstruction(paymentInstruction);

  if (paymentResult.status !== 'SUCCESS' || !paymentResult.receipt) {
    console.log('Status: FAILED');
    console.log('');
    console.log(`Reason:\n${paymentResult.reason || paymentResult.message || 'Payment execution failed'}`);
    console.log('==================================================');
    process.exit(1);
  }

  const receipt = paymentResult.receipt;

  if (receipt.simulated || receipt.status === 'SIMULATED') {
    console.log('Status: FAILED');
    console.log('');
    console.log('Reason: SIMULATED_RECEIPT_REJECTED: Real live payment test generated a simulated receipt.');
    console.log('==================================================');
    process.exit(1);
  }

  const recon = PaymentReconciliationEngine.reconcilePayment(paymentInstruction, receipt, true);
  if (!recon.reconciled) {
    console.log('Status: FAILED');
    console.log('');
    console.log(`Reason:\n${recon.reason || 'Reconciliation failed'}`);
    console.log('==================================================');
    process.exit(1);
  }

  console.log('Mode:');
  console.log('LIVE TESTNET');
  console.log('');
  console.log('Rail:');
  console.log(receipt.rail || 'x402');
  console.log('');
  console.log('Network:');
  console.log(receipt.network || 'Base Sepolia');
  console.log('');
  console.log('Asset:');
  console.log(receipt.asset);
  console.log('');
  console.log('Payer:');
  console.log(receipt.payer);
  console.log('');
  console.log('Payee:');
  console.log(receipt.payee);
  console.log('');
  console.log('External Amount:');
  console.log(`${receipt.amount} ${receipt.asset}`);
  console.log('');
  console.log('Transaction Hash:');
  console.log(receipt.transactionHash);
  console.log('');
  console.log('Receipt:');
  console.log('VERIFIED');
  console.log('');
  console.log('On-chain Confirmation:');
  console.log('CONFIRMED');
  console.log('');
  console.log('Explorer:');
  console.log(receipt.explorerUrl);
  console.log('');
  console.log('Internal Reconciliation:');
  console.log('YES');
  console.log('==================================================');
}

if (require.main === module) {
  runH3LiveSpike().catch(err => {
    console.error('Fatal H3 Spike Error:', err);
    process.exit(1);
  });
}
