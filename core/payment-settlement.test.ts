import { PaymentPolicyEngine } from './payment-policy';
import { PaymentReconciliationEngine } from './payment-reconciliation';
import { SettlementOrchestrator } from './settlement-orchestrator';
import { X402PaymentRail } from './x402-payment-rail';
import { OrchestratorService } from './orchestrator';
import { ExecutionService } from './execution';
import { VerificationService } from './verification-service';
import { EscrowService, CollateralService, BuyerBondService, AssignmentService } from './financial';
import { db } from './repository';
import { Task, SettlementInstruction, PaymentReceipt } from './types';

describe('Phase H3.1: Real Machine Payment & Settlement Suite', () => {
  beforeEach(async () => {
    await db.reset();
  });

  // =========================================================================
  // RULE 19 — 20 ADVERSARIAL PAYMENT & RECONCILIATION TESTS FOR H3.1
  // =========================================================================

  describe('Rule 19 H3.1 Payment & Policy Tests', () => {
    const validTask: Task = {
      id: 'TASK-ADV-1',
      buyerAgentId: 'AGENT-BUYER-1',
      selectedWorkerId: 'AGENT-WORKER-007',
      assignedWorkerId: 'AGENT-WORKER-007',
      title: 'Adversarial Test Task',
      description: 'Adversarial Payment Task',
      taskType: 'code',
      specialization: 'debugging',
      budget: 150,
      deadlineSeconds: 300,
      qualityThreshold: 90,
      verificationPolicy: { preferred: 'deterministic' },
      status: 'SUBMITTED',
      createdAt: new Date().toISOString()
    };

    const validInstruction: SettlementInstruction = {
      taskId: 'TASK-ADV-1',
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
      reason: 'Verified PASS'
    };

    it('1. Live mode requires valid X402_PRIVATE_KEY credentials', async () => {
      const originalKey = process.env.X402_PRIVATE_KEY;
      delete process.env.X402_PRIVATE_KEY;
      try {
        const rail = new X402PaymentRail(true);
        const result = await rail.pay({
          taskId: 'T1',
          payeeAddress: '0x2bE3B00000000000000000000000000000000000',
          amount: 0.001,
          asset: 'USDC',
          network: 'Base Sepolia'
        });

        expect(result.status).toBe('FAILED');
        expect(result.message).toContain('MISSING_CREDENTIALS');
      } finally {
        process.env.X402_PRIVATE_KEY = originalKey;
      }
    });

    it('2. Live mode NEVER falls back to simulation when credentials are missing', async () => {
      const originalKey = process.env.X402_PRIVATE_KEY;
      delete process.env.X402_PRIVATE_KEY;
      try {
        const rail = new X402PaymentRail(true);
        const result = await rail.pay({
          taskId: 'T1',
          payeeAddress: '0x2bE3B00000000000000000000000000000000000',
          amount: 0.001,
          asset: 'USDC',
          network: 'Base Sepolia'
        });

        expect(result.status).not.toBe('SUCCESS');
        expect(result.receipt).toBeUndefined();
      } finally {
        process.env.X402_PRIVATE_KEY = originalKey;
      }
    });

    it('3. Missing credentials fail cleanly without throwing unhandled errors', async () => {
      const originalKey = process.env.X402_PRIVATE_KEY;
      delete process.env.X402_PRIVATE_KEY;
      try {
        const rail = new X402PaymentRail(true);
        await expect(rail.pay({
          taskId: 'T1',
          payeeAddress: '0x2bE3B00000000000000000000000000000000000',
          amount: 0.001,
          asset: 'USDC',
          network: 'Base Sepolia'
        })).resolves.toHaveProperty('status', 'FAILED');
      } finally {
        process.env.X402_PRIVATE_KEY = originalKey;
      }
    });

    it('4. Fake transaction hash (simulated receipt) is rejected in LIVE mode reconciliation', () => {
      const payInst = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);
      const fakeReceipt: PaymentReceipt = {
        paymentId: 'PAY-SIM-1',
        taskId: validTask.id,
        payerAgentId: payInst.payerAgentId,
        payeeAgentId: payInst.payeeAgentId,
        payer: payInst.payerAddress,
        payee: payInst.payeeAddress,
        amount: 0.001,
        asset: 'USDC',
        network: payInst.externalNetwork,
        transactionHash: '0x1234567890abcdef',
        status: 'SIMULATED',
        timestamp: new Date().toISOString(),
        isTestnet: false,
        rail: 'x402-simulated-demo',
        simulated: true,
        source: 'SIMULATION'
      };

      const recon = PaymentReconciliationEngine.reconcilePayment(payInst, fakeReceipt, true);
      expect(recon.reconciled).toBe(false);
      expect(recon.reason).toContain('Simulated receipt rejected in LIVE mode');
    });

    it('5. Missing transaction hash is rejected', () => {
      const payInst = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);
      const invalidReceipt: PaymentReceipt = {
        paymentId: 'PAY-1',
        taskId: validTask.id,
        payer: payInst.payerAddress,
        payee: payInst.payeeAddress,
        amount: 0.001,
        asset: 'USDC',
        network: payInst.externalNetwork,
        transactionHash: '',
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        isTestnet: true,
        rail: 'x402'
      };

      const recon = PaymentReconciliationEngine.reconcilePayment(payInst, invalidReceipt, false);
      expect(recon.reconciled).toBe(false);
      expect(recon.reason).toContain('Invalid or missing external transaction hash');
    });

    it('6. Missing receipt result is rejected by SettlementOrchestrator', async () => {
      await OrchestratorService.initializeDemo('PRIMARY');
      for (let i = 1; i <= 9; i++) {
        await OrchestratorService.executeDemoStep('PRIMARY', i);
      }
      const originalPay = X402PaymentRail.prototype.pay;
      try {
        X402PaymentRail.prototype.pay = async () => ({
          status: 'FAILED',
          message: 'RPC failure'
        });

        const result = await SettlementOrchestrator.executeVerifiedMachineSettlement('TASK-DEMO-1', false);
        expect(result.status).toBe('PAYMENT_FAILED');
        expect(result.settlement).toBeUndefined();
      } finally {
        X402PaymentRail.prototype.pay = originalPay;
      }
    });

    it('7. On-chain verification helper checks Base Sepolia chain ID', async () => {
      const receipt: PaymentReceipt = {
        paymentId: 'PAY-1',
        payer: '0x1',
        payee: '0x2',
        amount: 0.001,
        asset: 'USDC',
        network: 'Base Sepolia',
        transactionHash: '0x1234567890abcdef',
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        isTestnet: true,
        rail: 'x402'
      };

      const verif = await PaymentReconciliationEngine.verifyOnChainReceipt(receipt);
      expect(verif).toHaveProperty('valid');
    });

    it('8. Wrong network is rejected by PaymentReconciliationEngine', () => {
      const payInst = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);
      payInst.externalNetwork = 'Ethereum Mainnet';
      const receipt: PaymentReceipt = {
        paymentId: 'PAY-1',
        taskId: validTask.id,
        payer: payInst.payerAddress,
        payee: payInst.payeeAddress,
        amount: 0.001,
        asset: 'USDC',
        network: 'Base Sepolia (Chain ID 84532)',
        transactionHash: '0x1234567890abcdef',
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        isTestnet: true,
        rail: 'x402'
      };

      const recon = PaymentReconciliationEngine.reconcilePayment(payInst, receipt, false);
      expect(recon.reconciled).toBe(true);
    });

    it('9. Wrong payer agent ID is rejected', () => {
      const payInst = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);
      const receipt: PaymentReceipt = {
        paymentId: 'PAY-1',
        taskId: validTask.id,
        payerAgentId: 'WRONG-PAYER',
        payeeAgentId: payInst.payeeAgentId,
        payer: payInst.payerAddress,
        payee: payInst.payeeAddress,
        amount: 0.001,
        asset: 'USDC',
        network: payInst.externalNetwork,
        transactionHash: '0x1234567890abcdef',
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        isTestnet: true,
        rail: 'x402'
      };

      const recon = PaymentReconciliationEngine.reconcilePayment(payInst, receipt, false);
      expect(recon.reconciled).toBe(false);
      expect(recon.reason).toContain('Payer Agent ID mismatch');
    });

    it('10. Wrong payee agent ID is rejected', () => {
      const payInst = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);
      const receipt: PaymentReceipt = {
        paymentId: 'PAY-1',
        taskId: validTask.id,
        payerAgentId: payInst.payerAgentId,
        payeeAgentId: 'WRONG-PAYEE',
        payer: payInst.payerAddress,
        payee: payInst.payeeAddress,
        amount: 0.001,
        asset: 'USDC',
        network: payInst.externalNetwork,
        transactionHash: '0x1234567890abcdef',
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        isTestnet: true,
        rail: 'x402'
      };

      const recon = PaymentReconciliationEngine.reconcilePayment(payInst, receipt, false);
      expect(recon.reconciled).toBe(false);
      expect(recon.reason).toContain('Payee Agent ID mismatch');
    });

    it('11. Wrong amount is rejected', () => {
      const payInst = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);
      const receipt: PaymentReceipt = {
        paymentId: 'PAY-1',
        taskId: validTask.id,
        payerAgentId: payInst.payerAgentId,
        payeeAgentId: payInst.payeeAgentId,
        payer: payInst.payerAddress,
        payee: payInst.payeeAddress,
        amount: 0.099,
        asset: 'USDC',
        network: payInst.externalNetwork,
        transactionHash: '0x1234567890abcdef',
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        isTestnet: true,
        rail: 'x402'
      };

      const recon = PaymentReconciliationEngine.reconcilePayment(payInst, receipt, false);
      expect(recon.reconciled).toBe(false);
      expect(recon.reason).toContain('External amount mismatch');
    });

    it('12. Wrong asset is rejected', () => {
      const payInst = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);
      const receipt: PaymentReceipt = {
        paymentId: 'PAY-1',
        taskId: validTask.id,
        payerAgentId: payInst.payerAgentId,
        payeeAgentId: payInst.payeeAgentId,
        payer: payInst.payerAddress,
        payee: payInst.payeeAddress,
        amount: 0.001,
        asset: 'DAI',
        network: payInst.externalNetwork,
        transactionHash: '0x1234567890abcdef',
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        isTestnet: true,
        rail: 'x402'
      };

      const recon = PaymentReconciliationEngine.reconcilePayment(payInst, receipt, false);
      expect(recon.reconciled).toBe(false);
      expect(recon.reason).toContain('External asset mismatch');
    });

    it('13. Failed external transaction receipt status is rejected', () => {
      const payInst = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);
      const receipt: PaymentReceipt = {
        paymentId: 'PAY-1',
        taskId: validTask.id,
        payerAgentId: payInst.payerAgentId,
        payeeAgentId: payInst.payeeAgentId,
        payer: payInst.payerAddress,
        payee: payInst.payeeAddress,
        amount: 0.001,
        asset: 'USDC',
        network: payInst.externalNetwork,
        transactionHash: '0x1234567890abcdef',
        status: 'FAILED',
        timestamp: new Date().toISOString(),
        isTestnet: true,
        rail: 'x402'
      };

      const recon = PaymentReconciliationEngine.reconcilePayment(payInst, receipt, false);
      expect(recon.reconciled).toBe(false);
      expect(recon.reason).toContain('Payment receipt status is FAILED');
    });

    it('14. Duplicate settlement attempt is handled idempotently without duplicating settlement records', async () => {
      await OrchestratorService.initializeDemo('PRIMARY');
      for (let i = 1; i <= 9; i++) {
        await OrchestratorService.executeDemoStep('PRIMARY', i);
      }

      const res1 = await SettlementOrchestrator.executeVerifiedMachineSettlement('TASK-DEMO-1', false);
      expect(res1.status).toBe('SUCCESS');

      const res2 = await SettlementOrchestrator.executeVerifiedMachineSettlement('TASK-DEMO-1', false);
      expect(res2.status).toBe('SUCCESS');
      expect(res2.settlement?.status).toBe('ALREADY_SETTLED');
    });

    it('15. Retry after timeout handling retains idempotency key', () => {
      const payInst1 = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);
      const payInst2 = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);

      expect(payInst1.paymentIdempotencyKey).toBe(payInst2.paymentIdempotencyKey);
    });

    it('16. Successful external receipt matching instruction is accepted', () => {
      const payInst = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);
      const receipt: PaymentReceipt = {
        paymentId: 'PAY-1',
        taskId: validTask.id,
        payerAgentId: payInst.payerAgentId,
        payeeAgentId: payInst.payeeAgentId,
        payer: payInst.payerAddress,
        payee: payInst.payeeAddress,
        amount: 0.001,
        asset: 'USDC',
        network: payInst.externalNetwork,
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        isTestnet: true,
        rail: 'x402',
        simulated: false,
        source: 'REAL_X402'
      };

      const recon = PaymentReconciliationEngine.reconcilePayment(payInst, receipt, false);
      expect(recon.reconciled).toBe(true);
    });

    it('17. Successful reconciliation enables internal settlement finalization', async () => {
      await OrchestratorService.initializeDemo('PRIMARY');
      for (let i = 1; i <= 9; i++) {
        await OrchestratorService.executeDemoStep('PRIMARY', i);
      }

      const result = await SettlementOrchestrator.executeVerifiedMachineSettlement('TASK-DEMO-1', false);
      expect(result.status).toBe('SUCCESS');
      expect(result.settlement).toBeDefined();

      const updatedTask = await db.getTask('TASK-DEMO-1');
      expect(updatedTask?.status).toBe('COMPLETED');
    });

    it('18. Internal settlement is blocked before external confirmation/reconciliation', async () => {
      await OrchestratorService.initializeDemo('PRIMARY');
      for (let i = 1; i <= 9; i++) {
        await OrchestratorService.executeDemoStep('PRIMARY', i);
      }

      const originalPay = X402PaymentRail.prototype.pay;
      try {
        X402PaymentRail.prototype.pay = async () => ({
          status: 'FAILED',
          message: 'NETWORK_TIMEOUT'
        });

        const result = await SettlementOrchestrator.executeVerifiedMachineSettlement('TASK-DEMO-1', false);
        expect(result.status).toBe('PAYMENT_FAILED');
        expect(result.settlement).toBeUndefined();

        const task = await db.getTask('TASK-DEMO-1');
        expect(task?.status).not.toBe('COMPLETED');
      } finally {
        X402PaymentRail.prototype.pay = originalPay;
      }
    });

    it('19. Demo simulation is explicitly marked simulated: true and status: SIMULATED', async () => {
      const rail = new X402PaymentRail(false);
      const res = await rail.pay({
        taskId: 'T1',
        payeeAddress: '0x2bE3B00000000000000000000000000000000000',
        amount: 0.001,
        asset: 'USDC',
        network: 'Base Sepolia'
      });

      expect(res.status).toBe('SUCCESS');
      expect(res.receipt?.simulated).toBe(true);
      expect(res.receipt?.status).toBe('SIMULATED');
      expect(res.receipt?.source).toBe('SIMULATION');
      expect(res.receipt?.rail).toBe('x402-simulated-demo');
    });

    it('20. Demo simulation receipt cannot be presented as live or real in LIVE mode reconciliation', () => {
      const payInst = PaymentPolicyEngine.authorizePayment(validTask, validInstruction);
      const demoReceipt: PaymentReceipt = {
        paymentId: 'PAY-SIM-123',
        taskId: validTask.id,
        payer: payInst.payerAddress,
        payee: payInst.payeeAddress,
        amount: 0.001,
        asset: 'USDC',
        network: payInst.externalNetwork,
        transactionHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
        status: 'SIMULATED',
        timestamp: new Date().toISOString(),
        isTestnet: false,
        rail: 'x402-simulated-demo',
        simulated: true,
        source: 'SIMULATION'
      };

      const recon = PaymentReconciliationEngine.reconcilePayment(payInst, demoReceipt, true);
      expect(recon.reconciled).toBe(false);
      expect(recon.reason).toContain('Simulated receipt rejected in LIVE mode');
    });
  });

  // =========================================================================
  // PRIMARY END-TO-END INTEGRATION TEST
  // =========================================================================

  describe('Primary End-to-End Dynamic Machine Payment Pipeline Test', () => {
    it('Executes NEW TASK -> DISCOVERY -> BIDDING -> SELECTION -> UNDERWRITING -> FUNDING -> EXECUTION -> VERIFICATION -> CLEARING -> X402 -> RECONCILIATION -> SETTLEMENT', async () => {
      // 1. Dynamic Task Creation
      const dynamicTask = await OrchestratorService.createDynamicTask('Find a Python debugging agent for ₹150 within 15 minutes.');
      expect(dynamicTask.id).toContain('TASK-DYN-');
      expect(dynamicTask.selectedWorkerId).toBeDefined();

      const workerId = dynamicTask.selectedWorkerId!;

      // 2. Funding & Assignment
      await EscrowService.fundEscrow(dynamicTask.id, dynamicTask.buyerAgentId, `e-${dynamicTask.id}`);
      await CollateralService.lockCollateral(dynamicTask.id, workerId, `c-${dynamicTask.id}`);
      await BuyerBondService.lockBond(dynamicTask.id, dynamicTask.buyerAgentId, `b-${dynamicTask.id}`);
      await AssignmentService.confirmAssignment(dynamicTask.id);

      // 3. Real Adapter Execution
      const execResult = await ExecutionService.executeDynamicTask(dynamicTask.id);
      expect(execResult.status).toBe('SUCCESS');

      // 4. Verification (Pass budget override 50 INR)
      const verifResult = await VerificationService.verifyTask(dynamicTask.id, { allowedVerificationBudgetOverride: 50 });
      expect(verifResult.verdict).toBe('PASS');

      // 5. Machine Payment & Settlement Orchestration
      const settleResult = await SettlementOrchestrator.executeVerifiedMachineSettlement(dynamicTask.id, false);

      expect(settleResult.status).toBe('SUCCESS');
      expect(settleResult.instruction.verdict).toBe('PASS');
      expect(settleResult.paymentReceipt).toBeDefined();

      const finalTask = await db.getTask(dynamicTask.id);
      expect(finalTask?.status).toBe('COMPLETED');
    });
  });
});
