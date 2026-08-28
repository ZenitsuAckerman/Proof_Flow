import { Task, Bid, Agent, WorkerEligibility } from './types';
import crypto from 'crypto';

export class BiddingEngine {
  /**
   * Deterministically generate a bid for a worker on a given task
   */
  static generateBid(worker: Agent, task: Task, eligibility: WorkerEligibility): Bid {
    // Determine realistic bid parameters based on worker capabilities and reputation
    const discount = worker.reputationScore >= 90 ? 0.15 : 0.10; // 10-15% below budget
    const price = Math.round(task.budget * (1 - discount));
    
    // Predicted success probability (derived from worker reputation score)
    const predictedSuccessProbability = Math.min(0.99, Math.max(0.50, worker.reputationScore / 100));
    
    // Estimated duration (75% of deadline)
    const estimatedDurationSeconds = Math.round(task.deadlineSeconds * 0.75);

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
