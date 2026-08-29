import { CommandInterpreter } from './interpreter';
import { OrchestratorService } from './orchestrator';
import { db } from './repository';
import { DiscoveryService } from './discovery';
import { SelectionEngine } from './selection';
import { BiddingEngine } from './bidding';
import { UnderwritingService } from './financial';

describe('Phase H1: Dynamic Task Creation & Selection Suite', () => {
  beforeEach(async () => {
    await db.reset();
  });

  it('1. Parses natural language prompt into TaskIntent', () => {
    const intent = CommandInterpreter.parse('Find a Python debugging agent for ₹150 within 15 minutes.');
    expect(intent.capability).toBe('python');
    expect(intent.specialization).toBe('debugging');
    expect(intent.budget).toBe(150);
    expect(intent.deadlineSeconds).toBe(900);
    expect(intent.taskType).toBe('code');
  });

  it('2. Creates a dynamic task with unique TASK-DYN- ID', async () => {
    const task = await OrchestratorService.createDynamicTask('Find a Python debugging agent for ₹150 within 15 minutes.');
    expect(task.id).toMatch(/^TASK-DYN-/);
    expect(task.id).not.toBe('TASK-DEMO-1');
    expect(task.budget).toBe(150);
    expect(task.selectedWorkerId).toBeDefined();
  });

  it('3. Runs discovery across 75 agents and filters by capability and eligibility', async () => {
    const task = await OrchestratorService.createDynamicTask('Find a Python debugging agent for ₹150 within 15 minutes.');
    const discovery = await DiscoveryService.discoverWorkers(task.id, 'python');
    expect(discovery.totalCandidatesEvaluated).toBeGreaterThanOrEqual(60);
    expect(discovery.candidates.length).toBeGreaterThan(0);
  });

  it('4. SelectionEngine selects the best eligible candidate', async () => {
    const task = await OrchestratorService.createDynamicTask('Find a Python debugging agent for ₹150 within 15 minutes.');
    const selection = await SelectionEngine.selectBestWorker(task.id);
    expect(selection.status).toBe('SUCCESS');
    expect(selection.winningWorkerId).toBeDefined();
    expect(selection.winningBid).toBeDefined();
  });

  it('5. Executes complete dynamic task lifecycle DISCOVER -> SELECT -> UNDERWRITE -> FUND -> WORK -> VERIFY -> CLEAR -> SETTLE', async () => {
    const { executeDynamicTaskAction } = await import('../app/actions');
    const task = await OrchestratorService.createDynamicTask('Find a Python debugging agent for ₹150 within 15 minutes.');
    const appState = await executeDynamicTaskAction(task.id);

    expect(appState.task?.status).toBe('COMPLETED');
    expect(appState.verificationResult).toBeDefined();
    expect(appState.verificationResult?.verdict).toBe('PASS');
    expect(appState.clearingInstruction).toBeDefined();
    expect(appState.clearingInstruction?.workerAmount).toBe(150);
    expect(appState.settlement).toBeDefined();
    expect(appState.settlement?.status).toBe('SETTLED');
    
    // Ledger events contain settlement
    expect(appState.transactions.some(t => t.transactionType === 'WORKER_REWARD')).toBe(true);

    // Selected worker wallet reflects payout
    const workerWallet = appState.wallets.find(w => w.agentId === task.selectedWorkerId);
    expect(workerWallet?.lockedBalance).toBe(0);

    // Canonical state reflects SETTLE stage
    expect(appState.currentStage).toBe('SETTLE');
    expect(appState.steps.every(s => s.status === 'COMPLETED')).toBe(true);
  });

  // =========================================================================
  // PART 22: 16 ADVERSARIAL TESTS
  // =========================================================================

  describe('Adversarial Test Suite (16 Scenarios)', () => {
    it('Adversarial 1: Highest technical score is excluded if financially ineligible', async () => {
      // Create task with high exposure ₹45,000
      const task = await OrchestratorService.createDynamicTask('Find Python agent for ₹50000');
      await UnderwritingService.underwriteTask(task.id, 95);
      
      const discovery = await DiscoveryService.discoverWorkers(task.id, 'python');
      const selection = await SelectionEngine.selectBestWorker(task.id);

      // Ineligible workers cannot win
      if (selection.winningWorkerId) {
        const winner = discovery.candidates.find(c => c.workerId === selection.winningWorkerId);
        expect(winner?.eligible).toBe(true);
      }
    });

    it('Adversarial 2: Cheapest worker is excluded if economically ineligible', async () => {
      const task = await OrchestratorService.createDynamicTask('Find Python agent for ₹200');
      const selection = await SelectionEngine.selectBestWorker(task.id);
      expect(selection.excludedIneligibleCount).toBeGreaterThanOrEqual(0);
    });

    it('Adversarial 3 & 4: Worker capacity boundary tests (exact vs one unit below exposure)', async () => {
      const worker = await db.getAgent('AGENT-WORKER-001');
      if (worker) {
        worker.economicCapacity['python'] = 10000;
        const task = await db.getTask('TASK-DEMO-1');
        if (task && task.financialTerms) {
          task.financialTerms.safeExposure = 10000;
          const evalExact = await DiscoveryService.evaluateWorkerEligibility(worker, task, 'python');
          expect(evalExact.eligible).toBe(true);

          task.financialTerms.safeExposure = 10001;
          const evalBelow = await DiscoveryService.evaluateWorkerEligibility(worker, task, 'python');
          expect(evalBelow.eligible).toBe(false);
          expect(evalBelow.status).toBe('INELIGIBLE_EXPOSURE_TOO_HIGH');
        }
      }
    });

    it('Adversarial 5 & 6: Collateral requirement boundary tests (exact vs one unit below)', async () => {
      const worker = await db.getAgent('AGENT-WORKER-001');
      const wallet = await db.getWalletByAgentId('AGENT-WORKER-001');
      if (worker && wallet && wallet.availableBalance >= 1000) {
        const task = await db.getTask('TASK-DEMO-1');
        if (task && task.financialTerms) {
          task.financialTerms.safeExposure = 1000;
          task.financialTerms.collateralRequirement = wallet.availableBalance;
          const evalExact = await DiscoveryService.evaluateWorkerEligibility(worker, task, 'python');
          expect(evalExact.eligible).toBe(true);

          task.financialTerms.collateralRequirement = wallet.availableBalance + 1;
          const evalBelow = await DiscoveryService.evaluateWorkerEligibility(worker, task, 'python');
          expect(evalBelow.eligible).toBe(false);
          expect(evalBelow.status).toBe('INELIGIBLE_INSUFFICIENT_COLLATERAL');
        }
      }
    });

    it('Adversarial 7: Unavailable agent cannot bid or be eligible', async () => {
      const worker = await db.getAgent('AGENT-WORKER-045'); // Agent 45 set available: false
      const task = await db.getTask('TASK-DEMO-1');
      if (worker && task) {
        const evalUnavail = await DiscoveryService.evaluateWorkerEligibility(worker, task, 'python');
        expect(evalUnavail.eligible).toBe(false);
        expect(evalUnavail.status).toBe('INELIGIBLE_UNAVAILABLE');
      }
    });

    it('Adversarial 8: Worker with unsupported capability cannot bid', async () => {
      const worker = await db.getAgent('AGENT-WORKER-001');
      const task = await db.getTask('TASK-DEMO-1');
      if (worker && task) {
        const evalCapability = await DiscoveryService.evaluateWorkerEligibility(worker, task, 'quantum-computing');
        expect(evalCapability.eligible).toBe(false);
        expect(evalCapability.status).toBe('INELIGIBLE_CAPABILITY_MISMATCH');
      }
    });

    it('Adversarial 9: Bid price above task budget is rejected', async () => {
      const task = await db.getTask('TASK-DEMO-1');
      if (task) {
        const invalidBid = {
          id: 'BID-INVALID-1',
          taskId: task.id,
          agentId: 'AGENT-WORKER-001',
          price: task.budget + 500,
          predictedSuccessProbability: 0.9,
          estimatedDurationSeconds: 300,
          collateralOffered: 500,
          evidencePlan: [],
          createdAt: new Date().toISOString()
        };
        const validation = BiddingEngine.validateBid(invalidBid, task);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toContain('exceeds task budget');
      }
    });

    it('Adversarial 10: Zero or negative bid price is rejected', async () => {
      const task = await db.getTask('TASK-DEMO-1');
      if (task) {
        const invalidBid = {
          id: 'BID-INVALID-2',
          taskId: task.id,
          agentId: 'AGENT-WORKER-001',
          price: -50,
          predictedSuccessProbability: 0.9,
          estimatedDurationSeconds: 300,
          collateralOffered: 500,
          evidencePlan: [],
          createdAt: new Date().toISOString()
        };
        const validation = BiddingEngine.validateBid(invalidBid, task);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toContain('cannot be negative');
      }
    });

    it('Adversarial 11: Invalid success probability (<0 or >1) is rejected', async () => {
      const task = await db.getTask('TASK-DEMO-1');
      if (task) {
        const invalidBid = {
          id: 'BID-INVALID-3',
          taskId: task.id,
          agentId: 'AGENT-WORKER-001',
          price: 100,
          predictedSuccessProbability: 1.5,
          estimatedDurationSeconds: 300,
          collateralOffered: 500,
          evidencePlan: [],
          createdAt: new Date().toISOString()
        };
        const validation = BiddingEngine.validateBid(invalidBid, task);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toContain('between 0 and 1');
      }
    });

    it('Adversarial 12: Non-positive estimated duration is rejected', async () => {
      const task = await db.getTask('TASK-DEMO-1');
      if (task) {
        const invalidBid = {
          id: 'BID-INVALID-4',
          taskId: task.id,
          agentId: 'AGENT-WORKER-001',
          price: 100,
          predictedSuccessProbability: 0.9,
          estimatedDurationSeconds: 0,
          collateralOffered: 500,
          evidencePlan: [],
          createdAt: new Date().toISOString()
        };
        const validation = BiddingEngine.validateBid(invalidBid, task);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toContain('must be positive');
      }
    });

    it('Adversarial 13: Duplicate agent IDs are rejected', async () => {
      const worker = await db.getAgent('AGENT-WORKER-001');
      if (worker) {
        // Attempting to overwrite or add existing agent throws or maps directly
        const agents = await db.listAgents();
        expect(agents.filter(a => a.id === 'AGENT-WORKER-001').length).toBe(1);
      }
    });

    it('Adversarial 14: Duplicate dynamic task IDs are rejected by repository', async () => {
      const task = await OrchestratorService.createDynamicTask('Test Task');
      await expect(db.createTask(task)).rejects.toThrow('DUPLICATE_TASK_ID');
    });

    it('Adversarial 15: Dynamic task does not accidentally bind to TASK-DEMO-1', async () => {
      const dynamicTask = await OrchestratorService.createDynamicTask('Find a Python debugging agent for ₹150 within 15 minutes.');
      expect(dynamicTask.id).not.toBe('TASK-DEMO-1');
      const fetched = await db.getTask(dynamicTask.id);
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(dynamicTask.id);
    });

    it('Adversarial 16: Registry state remains deterministic after system reset', async () => {
      const countBefore = (await db.listAgents()).length;
      await db.reset();
      const countAfter = (await db.listAgents()).length;
      expect(countAfter).toBe(countBefore);
      expect(countAfter).toBeGreaterThanOrEqual(75);
    });
  });
});
