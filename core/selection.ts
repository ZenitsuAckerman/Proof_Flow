import { db } from './repository';
import { Task, Bid, EvaluatedBid, SelectionResult, SelectionPolicyWeights, WorkerEligibility } from './types';
import { DEFAULT_SELECTION_WEIGHTS, SelectionNormalization } from './selection-policy';
import { DiscoveryService } from './discovery';
import { BiddingEngine } from './bidding';

export class SelectionEngine {
  /**
   * Run full discovery, bidding, evaluation, and worker selection pipeline for a task
   */
  static async selectBestWorker(
    taskId: string, 
    customWeights?: SelectionPolicyWeights,
    customBids?: { workerId: string; customBid?: Partial<Bid> }[]
  ): Promise<SelectionResult> {
    const task = await db.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (!task.financialTerms) {
      throw new Error('MISSING_FINANCIAL_TERMS: Task must be underwritten before worker selection');
    }

    const weights = customWeights || DEFAULT_SELECTION_WEIGHTS;

    // 1. Run Discovery & Economic Eligibility Filtering
    const discoveryResult = await DiscoveryService.discoverWorkers(taskId);

    if (discoveryResult.totalCandidatesEvaluated === 0) {
      return {
        taskId: task.id,
        status: 'NO_ELIGIBLE_WORKER',
        evaluatedBids: [],
        excludedIneligibleCount: 0,
        message: 'No candidate workers found in network'
      };
    }

    // 2. Generate / Collect Bids for all candidates
    const allAgents = await db.listAgents();
    const evaluatedBids: EvaluatedBid[] = [];

    for (const candidateEligibility of discoveryResult.candidates) {
      const worker = allAgents.find(a => a.id === candidateEligibility.workerId);
      if (!worker) continue;

      // Check if custom bid overrides are provided
      const customOverride = customBids?.find(cb => cb.workerId === worker.id);
      let bid: Bid;

      if (customOverride && customOverride.customBid) {
        bid = {
          ...BiddingEngine.generateBid(worker, task, candidateEligibility),
          ...customOverride.customBid,
        };
      } else {
        bid = BiddingEngine.generateBid(worker, task, candidateEligibility);
      }

      // Validate Bid
      const bidValidation = BiddingEngine.validateBid(bid, task);
      if (!bidValidation.valid) {
        // Mark as ineligible due to invalid bid
        const invalidEligibility: WorkerEligibility = {
          ...candidateEligibility,
          eligible: false,
          status: 'INELIGIBLE_INVALID_DATA',
          rejectionReason: bidValidation.reason
        };
        evaluatedBids.push(this.evaluateBid(bid, invalidEligibility, task, worker.reputationScore, worker.riskScore, weights));
        continue;
      }

      evaluatedBids.push(this.evaluateBid(bid, candidateEligibility, task, worker.reputationScore, worker.riskScore, weights));
    }

    // 3. Separate Eligible vs Ineligible Bids
    const eligibleBids = evaluatedBids.filter(eb => eb.eligibility.eligible);
    const ineligibleBids = evaluatedBids.filter(eb => !eb.eligibility.eligible);

    if (eligibleBids.length === 0) {
      return {
        taskId: task.id,
        status: 'NO_ELIGIBLE_WORKER',
        evaluatedBids,
        excludedIneligibleCount: ineligibleBids.length,
        message: 'No economically and technically eligible workers available for task'
      };
    }

    // 4. Rank Eligible Candidates with Deterministic Tie-Breaking
    eligibleBids.sort((a, b) => {
      // Primary: Final Score (descending)
      if (Math.abs(b.finalScore - a.finalScore) > 0.0001) {
        return b.finalScore - a.finalScore;
      }
      // Tie-Breaker 1: Technical Reputation Score (descending)
      if (b.eligibility.technicalScore !== a.eligibility.technicalScore) {
        return b.eligibility.technicalScore - a.eligibility.technicalScore;
      }
      // Tie-Breaker 2: Alphabetical workerId (ascending)
      return a.bid.agentId.localeCompare(b.bid.agentId);
    });

    // Assign Ranks
    eligibleBids.forEach((eb, index) => {
      eb.rank = index + 1;
    });
    ineligibleBids.forEach(ib => {
      ib.rank = undefined; // Ineligible workers are unranked
    });

    const winningEvaluatedBid = eligibleBids[0];
    const winningBid = winningEvaluatedBid.bid;

    // 5. Update Task in DB with selected worker and transition state to UNDERWRITING (ready for underwriting & funding)
    task.selectedWorkerId = winningBid.agentId;
    task.selectedBidId = winningBid.id;

    if (task.status === 'CREATED') {
      await db.updateTaskStatus(task.id, 'DISCOVERING');
      await db.updateTaskStatus(task.id, 'BIDDING');
      await db.updateTaskStatus(task.id, 'UNDERWRITING');
    } else if (task.status === 'DISCOVERING') {
      await db.updateTaskStatus(task.id, 'BIDDING');
      await db.updateTaskStatus(task.id, 'UNDERWRITING');
    } else if (task.status === 'BIDDING') {
      await db.updateTaskStatus(task.id, 'UNDERWRITING');
    }

    const allEvaluated = [...eligibleBids, ...ineligibleBids];

    return {
      taskId: task.id,
      status: 'SUCCESS',
      winningBid,
      winningWorkerId: winningBid.agentId,
      winningWorkerName: winningEvaluatedBid.eligibility.workerName,
      evaluatedBids: allEvaluated,
      excludedIneligibleCount: ineligibleBids.length,
      message: `Worker ${winningEvaluatedBid.eligibility.workerName} (${winningBid.agentId}) selected with score ${(winningEvaluatedBid.finalScore * 100).toFixed(1)}%`
    };
  }

  /**
   * Evaluate single bid against selection policy weights
   */
  public static evaluateBid(
    bid: Bid, 
    eligibility: WorkerEligibility, 
    task: Task, 
    reputationScore: number, 
    riskScore: number, 
    weights: SelectionPolicyWeights
  ): EvaluatedBid {
    const normalizedQuality = SelectionNormalization.normalizeQuality(bid.predictedSuccessProbability);
    const normalizedPrice = SelectionNormalization.normalizePrice(bid.price, task.budget);
    const normalizedReliability = SelectionNormalization.normalizeReliability(reputationScore);
    const normalizedSpeed = SelectionNormalization.normalizeSpeed(bid.estimatedDurationSeconds, task.deadlineSeconds);
    const normalizedRisk = SelectionNormalization.normalizeRisk(riskScore);

    const finalScore = (
      weights.qualityWeight * normalizedQuality +
      weights.priceWeight * normalizedPrice +
      weights.reliabilityWeight * normalizedReliability +
      weights.speedWeight * normalizedSpeed +
      weights.riskWeight * normalizedRisk
    );

    return {
      bid,
      eligibility,
      normalizedQuality,
      normalizedPrice,
      normalizedReliability,
      normalizedSpeed,
      normalizedRisk,
      finalScore: eligibility.eligible ? finalScore : -1, // Ineligible workers receive -1 score
    };
  }
}
