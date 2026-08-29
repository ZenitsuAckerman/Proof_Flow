import { Task, Bid, Agent, WorkerEligibility } from './types';
import crypto from 'crypto';

export class BiddingEngine {
  /**
   * Deterministically generate a bid for a worker on a given task
   */
  static generateBid(worker: Agent, task: Task, eligibility: WorkerEligibility): Bid {
    // Determine realistic bid price based on basePrice, reputation and budget
    const base = worker.basePrice || Math.round(task.budget * 0.7);
    const discount = worker.reputationScore >= 90 ? 0.15 : 0.10;
    const priceFromBudget = Math.round(task.budget * (1 - discount));
    const price = Math.min(task.budget, Math.max(base, priceFromBudget));
    
    // Predicted success probability (derived from worker reputation + calibration)
    const cal = worker.calibrationScore !== undefined ? worker.calibrationScore : worker.reputationScore;
    const rawProb = (worker.reputationScore * 0.7 + cal * 0.3) / 100;
    const predictedSuccessProbability = Math.min(0.99, Math.max(0.50, parseFloat(rawProb.toFixed(2))));
    
    // Estimated duration (based on averageLatencyMs or deadline)
    const latencySec = worker.averageLatencyMs ? Math.round(worker.averageLatencyMs / 100) : 0;
    const estimatedDurationSeconds = Math.max(10, Math.min(task.deadlineSeconds, Math.round(task.deadlineSeconds * 0.75) + latencySec));

    const collateralOffered = eligibility.collateralRequired;

    return {
      id: `BID-${crypto.randomUUID().slice(0, 8)}`,
      taskId: task.id,
      agentId: worker.id,
      price,
      predictedSuccessProbability,
      estimatedDurationSeconds,
      collateralOffered,
      evidencePlan: task.taskType === 'code' 
        ? ['hidden-tests', 'sandbox-replay', 'artifact-hash']
        : ['sources-mapping', 'independent-evaluators', 'claim-verification'],
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Validate bid input parameters
   */
  static validateBid(bid: Bid, task: Task): { valid: boolean; reason?: string } {
    if (bid.price < 0) {
      return { valid: false, reason: 'Bid price cannot be negative' };
    }
    if (bid.price > task.budget) {
      return { valid: false, reason: `Bid price ₹${bid.price} exceeds task budget ₹${task.budget}` };
    }
    if (bid.predictedSuccessProbability < 0 || bid.predictedSuccessProbability > 1) {
      return { valid: false, reason: 'Predicted success probability must be between 0 and 1' };
    }
    if (bid.estimatedDurationSeconds <= 0) {
      return { valid: false, reason: 'Estimated duration must be positive' };
    }
    return { valid: true };
  }
}
