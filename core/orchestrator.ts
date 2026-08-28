import { db } from './repository';
import { DiscoveryService } from './discovery';
import { SelectionEngine } from './selection';
import { UnderwritingService, EscrowService, CollateralService, BuyerBondService, AssignmentService } from './financial';
import { ExecutionService } from './execution';
import { VerificationService } from './verification-service';
import { ClearingEngine } from './clearing';
import { SettlementService } from './settlement';
import { CapacityService } from './capacity';
import { Task, VerificationResult, SettlementInstruction, Settlement } from './types';

export interface DemoStepEvent {
  stepIndex: number;
  stageName: string; // DISCOVERY, COMPETITION, FINANCIAL, ESCROW, COLLATERAL, ASSIGNMENT, EXECUTION, PROOF, VERIFICATION, CLEARING, SETTLEMENT, CAPACITY
  description: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'UNCERTAIN';
  timestamp: string;
}

export interface DemoRunState {
  currentStage: string;
  currentStepIndex: number;
  task: Task | null;
  selectedWorkerId: string | null;
  verificationResult: VerificationResult | null;
  clearingInstruction: SettlementInstruction | null;
  settlement: Settlement | null;
  logs: string[];
  steps: DemoStepEvent[];
}

export class OrchestratorService {
  /**
   * Run Primary Code Bounty Demo (Successful PASS Flow)
   */
  static async runPrimaryDemoPass(): Promise<DemoRunState> {
    db.reset();
    const taskId = 'TASK-DEMO-1';
    const buyerId = 'AGENT-BUYER-1';

    const logs: string[] = [];
    const steps: DemoStepEvent[] = [
      { stepIndex: 1, stageName: 'DISCOVERY', description: 'Technical capability discovery', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 2, stageName: 'COMPETITION', description: 'Bidding & rank evaluation', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 3, stageName: 'FINANCIAL', description: 'Financial underwriting & risk assessment', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 4, stageName: 'ESCROW', description: 'Buyer escrow & bond funding', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 5, stageName: 'COLLATERAL', description: 'Worker collateral locking', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 6, stageName: 'ASSIGNMENT', description: 'Worker assignment confirmed', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 7, stageName: 'EXECUTION', description: 'Deterministic execution & code generation', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 8, stageName: 'PROOF', description: 'Proof-carrying evidence package assembled', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 9, stageName: 'VERIFICATION', description: 'Deterministic verification suite run (100% pass)', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 10, stageName: 'CLEARING', description: 'Clearing decision generated (PASS)', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 11, stageName: 'SETTLEMENT', description: 'Atomic financial settlement executed', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 12, stageName: 'CAPACITY', description: 'Worker economic capacity increased (+10%)', status: 'COMPLETED', timestamp: new Date().toISOString() }
    ];

    // 1. Discovery
    logs.push('Executing Discovery: Scanning technical & economic capabilities...');
    await DiscoveryService.discoverWorkers(taskId);

    // 2. Financial Underwriting
    logs.push('Executing Underwriting: Assessing exposure, collateral, and buyer bond...');
    await UnderwritingService.underwriteTask(taskId, 95);

    // 3. Selection
    logs.push('Executing Competition: Scoring candidate bids...');
    const selectionResult = await SelectionEngine.selectBestWorker(taskId);
    const workerId = selectionResult.winningWorkerId || 'AGENT-WORKER-1';
    logs.push(`Worker Selected: ${workerId}`);

    // 4. Funding
    logs.push('Executing Funding: Buyer escrow (₹10,000) & Buyer bond (₹500)...');
    await EscrowService.fundEscrow(taskId, buyerId, 'demo-escrow-key');
    await BuyerBondService.lockBond(taskId, buyerId, 'demo-bond-key');

    // 5. Collateral
    logs.push('Executing Collateral: Worker collateral (₹1,000)...');
    await CollateralService.lockCollateral(taskId, workerId, 'demo-col-key');

    // 6. Assignment
    logs.push('Executing Assignment: Confirming assignment state...');
    await AssignmentService.confirmAssignment(taskId);

    // 7. Execution
    logs.push('Executing Worker Task: Running Python code execution suite (100% tests passing)...');
    await ExecutionService.executeTask(taskId, workerId, 100);

    // 8. Verification
    logs.push('Executing Verification: Running VerificationRouter deterministic verification...');
    const verificationResult = await VerificationService.verifyTask(taskId);

    // 9. Clearing
    logs.push('Executing Clearing Engine: Generating authoritative SettlementInstruction...');
    const task = (await db.getTask(taskId))!;
    const escrow = await db.getEscrow(taskId);
    const collateral = await db.getCollateralByTaskId(taskId);
    const buyerBond = await db.getBuyerBondByTaskId(taskId);
    const clearingInstruction = ClearingEngine.calculateInstruction(task, verificationResult, escrow, collateral, buyerBond);

    // 10. Settlement
    logs.push('Executing Settlement Engine: Atomic wallet transfer & ledger recording...');
    const settlement = await SettlementService.executeInstruction(clearingInstruction, 'demo-settle-key');

    // 11. Capacity Update
    logs.push('Updating Economic Capacity: Worker Python capacity increased post-success.');
    await CapacityService.updateCapacity(task, clearingInstruction.verdict);

    return {
      currentStage: 'CAPACITY',
      currentStepIndex: 12,
      task: (await db.getTask(taskId)) || null,
      selectedWorkerId: workerId,
      verificationResult,
      clearingInstruction,
      settlement,
      logs,
      steps
    };
  }

  /**
   * Run Failure Scenario (Worker Submits Failing Code -> FAIL -> Slashes Collateral)
   */
  static async runFailureScenario(): Promise<DemoRunState> {
    db.reset();
    const taskId = 'TASK-DEMO-1';
    const buyerId = 'AGENT-BUYER-1';
    const logs: string[] = [];

    await DiscoveryService.discoverWorkers(taskId);
    await UnderwritingService.underwriteTask(taskId, 95);
    const selectionResult = await SelectionEngine.selectBestWorker(taskId);
    const workerId = selectionResult.winningWorkerId || 'AGENT-WORKER-1';

    await EscrowService.fundEscrow(taskId, buyerId, 'fail-escrow-key');
    await BuyerBondService.lockBond(taskId, buyerId, 'fail-bond-key');
    await CollateralService.lockCollateral(taskId, workerId, 'fail-col-key');
    await AssignmentService.confirmAssignment(taskId);

    logs.push('Worker submitted bad/failing code artifact (30% test pass rate)...');
    await ExecutionService.executeTask(taskId, workerId, 30);
    const evidence = await db.getEvidenceByTaskId(taskId);
    if (evidence) {
      evidence.outputHash = 'corrupted_bad_hash';
      evidence.evidencePayload = { ...evidence.evidencePayload, testResults: { total: 5, passed: 1, failed: 4, durationMs: 50 } };
    }

    const verificationResult = await VerificationService.verifyTask(taskId);
    logs.push(`Verification Verdict: ${verificationResult.verdict} (Score: ${verificationResult.score}%)`);

    const task = (await db.getTask(taskId))!;
    const escrow = await db.getEscrow(taskId);
    const collateral = await db.getCollateralByTaskId(taskId);
    const buyerBond = await db.getBuyerBondByTaskId(taskId);
    const clearingInstruction = ClearingEngine.calculateInstruction(task, verificationResult, escrow, collateral, buyerBond);

    logs.push('Clearing Engine: FAIL outcome -> ₹0 worker payout, ₹10k buyer refund, ₹1k collateral slashed to PROTOCOL-TREASURY.');
    const settlement = await SettlementService.executeInstruction(clearingInstruction, 'fail-settle-key');

    const steps: DemoStepEvent[] = [
      { stepIndex: 1, stageName: 'DISCOVERY', description: 'Technical capability discovery', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 2, stageName: 'COMPETITION', description: 'Bidding & rank evaluation', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 3, stageName: 'FINANCIAL', description: 'Financial underwriting & risk assessment', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 4, stageName: 'ESCROW', description: 'Buyer escrow & bond funding', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 5, stageName: 'COLLATERAL', description: 'Worker collateral locking', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 6, stageName: 'ASSIGNMENT', description: 'Worker assignment confirmed', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 7, stageName: 'EXECUTION', description: 'Worker submitted failing code', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 8, stageName: 'PROOF', description: 'Evidence package submitted', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 9, stageName: 'VERIFICATION', description: 'Deterministic verification suite FAIL (30%)', status: 'FAILED', timestamp: new Date().toISOString() },
      { stepIndex: 10, stageName: 'CLEARING', description: 'Clearing decision FAIL', status: 'FAILED', timestamp: new Date().toISOString() },
      { stepIndex: 11, stageName: 'SETTLEMENT', description: 'Escrow refunded to buyer, collateral slashed to PROTOCOL-TREASURY', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 12, stageName: 'CAPACITY', description: 'Worker economic capacity reduced (-20%)', status: 'COMPLETED', timestamp: new Date().toISOString() }
    ];

    return {
      currentStage: 'CAPACITY',
      currentStepIndex: 12,
      task: (await db.getTask(taskId)) || null,
      selectedWorkerId: workerId,
      verificationResult,
      clearingInstruction,
      settlement,
      logs,
      steps
    };
  }

  /**
   * Run Blind Jury Research Demo (5 Evaluators Commit-Reveal Consensus -> PASS)
   */
  static async runBlindJuryDemo(): Promise<DemoRunState> {
    db.reset();
    const taskId = 'TASK-DEMO-2'; // Research Task
    const buyerId = 'AGENT-BUYER-1';
    const logs: string[] = [];

    await DiscoveryService.discoverWorkers(taskId);
    await UnderwritingService.underwriteTask(taskId, 90);
    const selectionResult = await SelectionEngine.selectBestWorker(taskId);
    const workerId = selectionResult.winningWorkerId || 'AGENT-WORKER-2';

    await EscrowService.fundEscrow(taskId, buyerId, 'jury-escrow-key');
    await BuyerBondService.lockBond(taskId, buyerId, 'jury-bond-key');
    await CollateralService.lockCollateral(taskId, workerId, 'jury-col-key');
    await AssignmentService.confirmAssignment(taskId);

    logs.push('Worker submitted market research report...');
    await ExecutionService.executeTask(taskId, workerId, 100);

    logs.push('VerificationRouter selected BLIND_JURY (5 evaluators)...');
    const verificationResult = await VerificationService.verifyTask(taskId);
    logs.push(`Blind Jury Consensus: Median = ${verificationResult.score}%, stdDev = ${verificationResult.disagreementScore} -> PASS`);

    const task = (await db.getTask(taskId))!;
    const escrow = await db.getEscrow(taskId);
    const collateral = await db.getCollateralByTaskId(taskId);
    const buyerBond = await db.getBuyerBondByTaskId(taskId);
    const clearingInstruction = ClearingEngine.calculateInstruction(task, verificationResult, escrow, collateral, buyerBond);

    const settlement = await SettlementService.executeInstruction(clearingInstruction, 'jury-settle-key');

    const steps: DemoStepEvent[] = [
      { stepIndex: 1, stageName: 'DISCOVERY', description: 'Technical capability discovery', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 2, stageName: 'COMPETITION', description: 'Bidding & rank evaluation', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 3, stageName: 'FINANCIAL', description: 'Financial underwriting', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 4, stageName: 'ESCROW', description: 'Escrow & buyer bond locked', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 5, stageName: 'COLLATERAL', description: 'Worker collateral locked', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 6, stageName: 'ASSIGNMENT', description: 'Assignment confirmed', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 7, stageName: 'EXECUTION', description: 'Research task executed', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 8, stageName: 'PROOF', description: 'Evidence package submitted', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 9, stageName: 'VERIFICATION', description: 'Blind Jury 5/5 reveals (Median 90%, stdDev 1.02) PASS', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 10, stageName: 'CLEARING', description: 'Clearing decision PASS', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 11, stageName: 'SETTLEMENT', description: 'Atomic financial settlement executed', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 12, stageName: 'CAPACITY', description: 'Worker research capacity updated', status: 'COMPLETED', timestamp: new Date().toISOString() }
    ];

    return {
      currentStage: 'CAPACITY',
      currentStepIndex: 12,
      task: (await db.getTask(taskId)) || null,
      selectedWorkerId: workerId,
      verificationResult,
      clearingInstruction,
      settlement,
      logs,
      steps
    };
  }

  /**
   * Run Uncertain Scenario (High Jury Disagreement -> UNCERTAIN -> Balances Preserved)
   */
  static async runUncertainScenario(): Promise<DemoRunState> {
    db.reset();
    const taskId = 'TASK-DEMO-2';
    const buyerId = 'AGENT-BUYER-1';
    const logs: string[] = [];

    await DiscoveryService.discoverWorkers(taskId);
    await UnderwritingService.underwriteTask(taskId, 90);
    const selectionResult = await SelectionEngine.selectBestWorker(taskId);
    const workerId = selectionResult.winningWorkerId || 'AGENT-WORKER-2';

    await EscrowService.fundEscrow(taskId, buyerId, 'uncert-escrow-key');
    await BuyerBondService.lockBond(taskId, buyerId, 'uncert-bond-key');
    await CollateralService.lockCollateral(taskId, workerId, 'uncert-col-key');
    await AssignmentService.confirmAssignment(taskId);

    await ExecutionService.executeTask(taskId, workerId, 100);

    // Mock high disagreement jury reveal result (e.g. 95, 93, 91, 40, 35 -> stdDev = 27.26 > 15)
    logs.push('Blind Jury reveals high evaluator disagreement (scores: [95, 93, 91, 40, 35], stdDev = 27.26 > 15)...');
    
    const verificationResult: VerificationResult = {
      id: 'VERIF-UNCERT-1',
      taskId,
      routeType: 'BLIND_JURY',
      status: 'UNCERTAIN',
      score: 91,
      disagreementScore: 27.26,
      confidence: 'LOW',
      verificationCost: 500,
      evidenceUsed: ['EV-1'],
      verdict: 'UNCERTAIN',
      message: 'Evaluator disagreement too high (stdDev=27.26 > 15)',
      completedAt: new Date().toISOString()
    };
    
    await db.createVerificationResult(verificationResult);

    const task = (await db.getTask(taskId))!;
    const escrow = await db.getEscrow(taskId);
    const collateral = await db.getCollateralByTaskId(taskId);
    const buyerBond = await db.getBuyerBondByTaskId(taskId);
    const clearingInstruction = ClearingEngine.calculateInstruction(task, verificationResult, escrow, collateral, buyerBond);

    logs.push('Clearing Engine: UNCERTAIN verdict -> All financial balances preserved safely without auto-punishment.');

    const steps: DemoStepEvent[] = [
      { stepIndex: 1, stageName: 'DISCOVERY', description: 'Technical capability discovery', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 2, stageName: 'COMPETITION', description: 'Bidding & rank evaluation', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 3, stageName: 'FINANCIAL', description: 'Financial underwriting', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 4, stageName: 'ESCROW', description: 'Escrow & buyer bond locked', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 5, stageName: 'COLLATERAL', description: 'Worker collateral locked', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 6, stageName: 'ASSIGNMENT', description: 'Assignment confirmed', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 7, stageName: 'EXECUTION', description: 'Task executed', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 8, stageName: 'PROOF', description: 'Evidence package submitted', status: 'COMPLETED', timestamp: new Date().toISOString() },
      { stepIndex: 9, stageName: 'VERIFICATION', description: 'Blind Jury disagreement high (stdDev 27.26 > 15) UNCERTAIN', status: 'UNCERTAIN', timestamp: new Date().toISOString() },
      { stepIndex: 10, stageName: 'CLEARING', description: 'Clearing decision UNCERTAIN', status: 'UNCERTAIN', timestamp: new Date().toISOString() },
      { stepIndex: 11, stageName: 'SETTLEMENT', description: 'Settlement locked for arbitration (ZERO financial mutation)', status: 'UNCERTAIN', timestamp: new Date().toISOString() },
      { stepIndex: 12, stageName: 'CAPACITY', description: 'No capacity change before arbitration', status: 'UNCERTAIN', timestamp: new Date().toISOString() }
    ];

    return {
      currentStage: 'ARBITRATION',
      currentStepIndex: 11,
      task: (await db.getTask(taskId)) || null,
      selectedWorkerId: workerId,
      verificationResult,
      clearingInstruction,
      settlement: null,
      logs,
      steps
    };
  }

  /**
   * Reset System Demo to Baseline State
   */
  static async resetDemo(): Promise<void> {
    db.reset();
  }
}
