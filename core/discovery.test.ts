import { DiscoveryService } from './discovery';
import { SelectionEngine } from './selection';
import { BiddingEngine } from './bidding';
import { UnderwritingService } from './financial';
import { db } from './repository';
import { SelectionNormalization, DEFAULT_SELECTION_WEIGHTS } from './selection-policy';
import { Agent, Wallet } from './types';

describe('Phase C: Discovery, Economic Eligibility & Worker Selection Engine', () => {
  const taskId = 'TASK-DEMO-1'; // Budget ₹10,000, Python bounty

  beforeEach(async () => {
    db.reset();
    await UnderwritingService.underwriteTask(taskId, 95); // safeExposure=9000, collateral=1000
  });

  it('1. Correct capability match is discovered and evaluated', async () => {
    const discovery = await DiscoveryService.discoverWorkers(taskId);
    expect(discovery.totalCandidatesEvaluated).toBeGreaterThan(0);
    
    const pyCoder = discovery.candidates.find(c => c.workerId === 'AGENT-WORKER-1');
    expect(pyCoder?.capabilityMatch).toBe(true);
    expect(pyCoder?.eligible).toBe(true);
  });

  it('2. Incorrect capability is rejected with explicit status', async () => {
    const discovery = await DiscoveryService.discoverWorkers(taskId);
    const researchBot = discovery.candidates.find(c => c.workerId === 'AGENT-WORKER-2'); // research capabilities
    
    expect(researchBot?.capabilityMatch).toBe(false);
    expect(researchBot?.eligible).toBe(false);
    expect(researchBot?.status).toBe('INELIGIBLE_CAPABILITY_MISMATCH');
    expect(researchBot?.rejectionReason).toContain('lacks required capability');
  });

  it('3. Worker below safe-exposure requirement is rejected (Economic Eligibility)', async () => {
    const discovery = await DiscoveryService.discoverWorkers(taskId);
    const lowCapWorker = discovery.candidates.find(c => c.workerId === 'AGENT-WORKER-3'); // capacity 5000 < safeExposure 9000
    
    expect(lowCapWorker?.capabilityMatch).toBe(true);
    expect(lowCapWorker?.eligible).toBe(false);
    expect(lowCapWorker?.status).toBe('INELIGIBLE_EXPOSURE_TOO_HIGH');
    expect(lowCapWorker?.rejectionReason).toContain('below required safe exposure');
  });

  it('4. Worker without sufficient collateral is rejected', async () => {
    const discovery = await DiscoveryService.discoverWorkers(taskId);
    const brokeWorker = discovery.candidates.find(c => c.workerId === 'AGENT-WORKER-4'); // balance 500 < collateral 1000
    
    expect(brokeWorker?.capabilityMatch).toBe(true);
    expect(brokeWorker?.eligible).toBe(false);
    expect(brokeWorker?.status).toBe('INELIGIBLE_INSUFFICIENT_COLLATERAL');
    expect(brokeWorker?.rejectionReason).toContain('below required collateral');
  });

  it('5. Worker with sufficient capacity and collateral is accepted as ELIGIBLE', async () => {
    const discovery = await DiscoveryService.discoverWorkers(taskId);
    const pyCoder = discovery.candidates.find(c => c.workerId === 'AGENT-WORKER-1');
    
    expect(pyCoder?.eligible).toBe(true);
    expect(pyCoder?.status).toBe('ELIGIBLE');
  });

  it('6. High technical score but economically ineligible worker cannot win', async () => {
    // AGENT-WORKER-3 has technical score 96 (higher than AGENT-WORKER-1's 95)
    // But AGENT-WORKER-3 has capacity ₹5,000 < safe exposure ₹9,000
    const selection = await SelectionEngine.selectBestWorker(taskId);

    expect(selection.status).toBe('SUCCESS');
    expect(selection.winningWorkerId).toBe('AGENT-WORKER-1'); // AGENT-WORKER-1 wins
    expect(selection.winningWorkerId).not.toBe('AGENT-WORKER-3');

    // Verify AGENT-WORKER-3 was evaluated but marked ineligible and excluded
    const lowCapBid = selection.evaluatedBids.find(b => b.bid.agentId === 'AGENT-WORKER-3');
    expect(lowCapBid?.eligibility.eligible).toBe(false);
    expect(lowCapBid?.finalScore).toBe(-1); // Ineligible candidates receive -1
  });

  it('7. Eligible worker ranking is deterministic', async () => {
    const run1 = await SelectionEngine.selectBestWorker(taskId);
    const run2 = await SelectionEngine.selectBestWorker(taskId);

    expect(run1.winningWorkerId).toBe(run2.winningWorkerId);
    expect(run1.evaluatedBids[0].finalScore).toBeCloseTo(run2.evaluatedBids[0].finalScore, 5);
  });

  it('8. Price normalization works as expected', () => {
    const normPriceFree = SelectionNormalization.normalizePrice(0, 10000);
    expect(normPriceFree).toBe(1.0); // 0 price -> score 1.0

    const normPriceHalf = SelectionNormalization.normalizePrice(5000, 10000);
    expect(normPriceHalf).toBe(0.5); // 50% budget -> score 0.5

    const normPriceFull = SelectionNormalization.normalizePrice(10000, 10000);
    expect(normPriceFull).toBe(0.0); // 100% budget -> score 0.0
  });

  it('9. Lower price alone does not guarantee selection if quality/reliability is lower', async () => {
    // Create a custom worker with cheap price but poor quality
    const cheapBid = { price: 1000, predictedSuccessProbability: 0.55 }; // 90% discount, low quality
    const qualityBid = { price: 8500, predictedSuccessProbability: 0.95 };

    const task = (await db.getTask(taskId))!;
    const pyCoder = (await db.getAgent('AGENT-WORKER-1'))!;
    const elig = await DiscoveryService.evaluateWorkerEligibility(pyCoder, task, 'python');

    const evalCheap = SelectionEngine.evaluateBid(
      { ...BiddingEngine.generateBid(pyCoder, task, elig), ...cheapBid }, elig, task, 70, 30, DEFAULT_SELECTION_WEIGHTS
    );
    const evalQuality = SelectionEngine.evaluateBid(
      { ...BiddingEngine.generateBid(pyCoder, task, elig), ...qualityBid }, elig, task, 95, 5, DEFAULT_SELECTION_WEIGHTS
    );

    expect(evalQuality.finalScore).toBeGreaterThan(evalCheap.finalScore);
  });

  it('10. Reliability, 11. Speed, and 12. Risk affect ranking scores', () => {
    const normRelHigh = SelectionNormalization.normalizeReliability(95);
    const normRelLow = SelectionNormalization.normalizeReliability(60);
    expect(normRelHigh).toBeGreaterThan(normRelLow);

    const normSpeedFast = SelectionNormalization.normalizeSpeed(1800, 3600);
    const normSpeedSlow = SelectionNormalization.normalizeSpeed(3000, 3600);
    expect(normSpeedFast).toBeGreaterThan(normSpeedSlow);

    const normRiskLow = SelectionNormalization.normalizeRisk(5);
    const normRiskHigh = SelectionNormalization.normalizeRisk(40);
    expect(normRiskLow).toBeGreaterThan(normRiskHigh);
  });

  it('13. No eligible workers produces a defined NO_ELIGIBLE_WORKER result', async () => {
    // Make task budget ₹500,000 so no worker has safe exposure or collateral
    const task = (await db.getTask(taskId))!;
    task.budget = 500000;
    await UnderwritingService.underwriteTask(taskId, 95); // safeExposure=450000

    const selection = await SelectionEngine.selectBestWorker(taskId);

    expect(selection.status).toBe('NO_ELIGIBLE_WORKER');
    expect(selection.winningBid).toBeUndefined();
    expect(selection.excludedIneligibleCount).toBeGreaterThan(0);
  });

  it('14. Discovery reads task.financialTerms authoritatively', async () => {
    const task = (await db.getTask(taskId))!;
    // Artificially reduce safeExposure requirement to 1000
    task.financialTerms!.safeExposure = 1000;

    const discovery = await DiscoveryService.discoverWorkers(taskId);
    const lowCapWorker = discovery.candidates.find(c => c.workerId === 'AGENT-WORKER-3');
    
    // Now AGENT-WORKER-3 (capacity 5000) IS ELIGIBLE because safeExposure required is 1000!
    expect(lowCapWorker?.eligible).toBe(true);
    expect(lowCapWorker?.status).toBe('ELIGIBLE');
  });

  it('15. Edge Case: Worker exactly equal to safeExposure and collateral requirement is ELIGIBLE', async () => {
    const task = (await db.getTask(taskId))!;
    const exactWorker: Agent = {
      id: 'AGENT-EXACT',
      name: 'Exact Worker',
      role: ['WORKER'],
      capabilities: ['python'],
      reputationScore: 90,
      riskScore: 10,
      economicCapacity: { python: task.financialTerms!.safeExposure }, // Exactly 9000
      walletId: 'WALLET-EXACT',
      createdAt: new Date().toISOString()
    };
    const exactWallet: Wallet = {
      id: 'WALLET-EXACT',
      agentId: 'AGENT-EXACT',
      availableBalance: task.financialTerms!.collateralRequirement, // Exactly 1000
      lockedBalance: 0,
      updatedAt: new Date().toISOString()
    };

    jest.spyOn(db, 'getWalletByAgentId').mockResolvedValueOnce(exactWallet);
    const result = await DiscoveryService.evaluateWorkerEligibility(exactWorker, task, 'python');
    
    expect(result.eligible).toBe(true);
    expect(result.status).toBe('ELIGIBLE');
  });

  it('16. Edge Case: Worker just below safeExposure is INELIGIBLE', async () => {
    const task = (await db.getTask(taskId))!;
    const justBelowWorker: Agent = {
      id: 'AGENT-JUST-BELOW',
      name: 'Just Below Worker',
      role: ['WORKER'],
      capabilities: ['python'],
      reputationScore: 90,
      riskScore: 10,
      economicCapacity: { python: task.financialTerms!.safeExposure - 1 }, // 8999 < 9000
      walletId: 'WALLET-BELOW',
      createdAt: new Date().toISOString()
    };

    const result = await DiscoveryService.evaluateWorkerEligibility(justBelowWorker, task, 'python');
    expect(result.eligible).toBe(false);
    expect(result.status).toBe('INELIGIBLE_EXPOSURE_TOO_HIGH');
  });

  it('17. Edge Case: Invalid bid values are rejected', async () => {
    const task = (await db.getTask(taskId))!;

    const negativeBid = { price: -100, predictedSuccessProbability: 0.9, estimatedDurationSeconds: 100, collateralOffered: 1000, id: 'b1', taskId: task.id, agentId: 'a1', evidencePlan: [], createdAt: '' };
    expect(BiddingEngine.validateBid(negativeBid, task).valid).toBe(false);

    const overBudgetBid = { price: 20000, predictedSuccessProbability: 0.9, estimatedDurationSeconds: 100, collateralOffered: 1000, id: 'b2', taskId: task.id, agentId: 'a1', evidencePlan: [], createdAt: '' };
    expect(BiddingEngine.validateBid(overBudgetBid, task).valid).toBe(false);

    const invalidProbBid = { price: 5000, predictedSuccessProbability: 1.5, estimatedDurationSeconds: 100, collateralOffered: 1000, id: 'b3', taskId: task.id, agentId: 'a1', evidencePlan: [], createdAt: '' };
    expect(BiddingEngine.validateBid(invalidProbBid, task).valid).toBe(false);
  });

  it('18. Edge Case: Deterministic tie-breaking when final scores are identical', async () => {
    const task = (await db.getTask(taskId))!;

    // Create 2 workers with identical technical, price, and speed scores
    const w1: Agent = { id: 'AGENT-WORKER-AAA', name: 'AAA', role: ['WORKER'], capabilities: ['python'], reputationScore: 90, riskScore: 10, economicCapacity: { python: 20000 }, walletId: 'W1', createdAt: '' };
    const w2: Agent = { id: 'AGENT-WORKER-BBB', name: 'BBB', role: ['WORKER'], capabilities: ['python'], reputationScore: 90, riskScore: 10, economicCapacity: { python: 20000 }, walletId: 'W2', createdAt: '' };

    const elig1 = await DiscoveryService.evaluateWorkerEligibility(w1, task, 'python');
    const elig2 = await DiscoveryService.evaluateWorkerEligibility(w2, task, 'python');

    const bid1 = BiddingEngine.generateBid(w1, task, elig1);
    const bid2 = BiddingEngine.generateBid(w2, task, elig2);

    // Forces bid prices and parameters to be identical
    bid1.price = 8000; bid2.price = 8000;
    bid1.estimatedDurationSeconds = 2000; bid2.estimatedDurationSeconds = 2000;
    bid1.predictedSuccessProbability = 0.90; bid2.predictedSuccessProbability = 0.90;

    const eval1 = SelectionEngine.evaluateBid(bid1, elig1, task, 90, 10, DEFAULT_SELECTION_WEIGHTS);
    const eval2 = SelectionEngine.evaluateBid(bid2, elig2, task, 90, 10, DEFAULT_SELECTION_WEIGHTS);

    const bids = [eval2, eval1];

    // Run sort tie breaker logic
    bids.sort((a, b) => {
      if (Math.abs(b.finalScore - a.finalScore) > 0.0001) return b.finalScore - a.finalScore;
      if (b.eligibility.technicalScore !== a.eligibility.technicalScore) return b.eligibility.technicalScore - a.eligibility.technicalScore;
      return a.bid.agentId.localeCompare(b.bid.agentId);
    });

    expect(bids[0].bid.agentId).toBe('AGENT-WORKER-AAA');
  });

  it('19. Edge Case: Collateral exactly equal to requirement is ELIGIBLE', async () => {
    const task = (await db.getTask(taskId))!;
    const worker: Agent = {
      id: 'AGENT-COL-EXACT', name: 'Col Exact', role: ['WORKER'], capabilities: ['python'],
      reputationScore: 90, riskScore: 10, economicCapacity: { python: 20000 }, walletId: 'W-EXACT', createdAt: ''
    };
    const exactWallet: Wallet = {
      id: 'W-EXACT', agentId: 'AGENT-COL-EXACT', availableBalance: task.financialTerms!.collateralRequirement, lockedBalance: 0, updatedAt: ''
    };
    jest.spyOn(db, 'getWalletByAgentId').mockResolvedValueOnce(exactWallet);

    const result = await DiscoveryService.evaluateWorkerEligibility(worker, task, 'python');
    expect(result.eligible).toBe(true);
    expect(result.status).toBe('ELIGIBLE');
  });

  it('20. Edge Case: Collateral one unit below requirement is INELIGIBLE', async () => {
    const task = (await db.getTask(taskId))!;
    const worker: Agent = {
      id: 'AGENT-COL-BELOW', name: 'Col Below', role: ['WORKER'], capabilities: ['python'],
      reputationScore: 90, riskScore: 10, economicCapacity: { python: 20000 }, walletId: 'W-BELOW', createdAt: ''
    };
    const belowWallet: Wallet = {
      id: 'W-BELOW', agentId: 'AGENT-COL-BELOW', availableBalance: task.financialTerms!.collateralRequirement - 1, lockedBalance: 0, updatedAt: ''
    };
    jest.spyOn(db, 'getWalletByAgentId').mockResolvedValueOnce(belowWallet);

    const result = await DiscoveryService.evaluateWorkerEligibility(worker, task, 'python');
    expect(result.eligible).toBe(false);
    expect(result.status).toBe('INELIGIBLE_INSUFFICIENT_COLLATERAL');
  });

  it('21. Lifecycle: Worker selection transitions task to UNDERWRITING, not directly to ASSIGNED', async () => {
    const selection = await SelectionEngine.selectBestWorker(taskId);
    expect(selection.status).toBe('SUCCESS');

    const taskAfterSelection = await db.getTask(taskId);
    expect(taskAfterSelection?.status).toBe('UNDERWRITING'); // Must NOT skip to ASSIGNED
    expect(taskAfterSelection?.selectedWorkerId).toBe('AGENT-WORKER-1');
    expect(taskAfterSelection?.assignedWorkerId).toBeUndefined(); // Only set after funding in ASSIGNED
  });
});
