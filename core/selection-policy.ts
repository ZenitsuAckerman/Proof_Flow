import { SelectionPolicyWeights } from './types';

export const DEFAULT_SELECTION_WEIGHTS: SelectionPolicyWeights = {
  qualityWeight: 0.30,      // 30%
  priceWeight: 0.25,        // 25%
  reliabilityWeight: 0.20,  // 20%
  speedWeight: 0.15,        // 15%
  riskWeight: 0.10,         // 10%
};

/**
 * Normalization utilities for bidding metrics (0 to 1 scale)
 */
export class SelectionNormalization {
  /**
   * Price Normalization:
   * Lower price relative to task budget is better.
   * If budget is B and price is P, normalized price = Math.max(0, (B - P) / B)
   * or normalized score relative to max bid price.
   */
  static normalizePrice(price: number, budget: number): number {
    if (budget <= 0) return 0;
    if (price < 0 || price > budget) return 0;
    // Normalized score: 1 if free (0 price), 0 if full budget.
    return (budget - price) / budget;
  }

  /**
   * Speed Normalization:
   * Lower duration relative to deadline is better.
   */
  static normalizeSpeed(durationSeconds: number, deadlineSeconds: number): number {
    if (deadlineSeconds <= 0) return 0;
    if (durationSeconds < 0) return 0;
    if (durationSeconds >= deadlineSeconds) return 0;
    return (deadlineSeconds - durationSeconds) / deadlineSeconds;
  }

  /**
   * Reliability Normalization:
   * reputationScore (0 to 100) -> 0 to 1.
   */
  static normalizeReliability(reputationScore: number): number {
    return Math.min(1, Math.max(0, reputationScore / 100));
  }

  /**
   * Risk Normalization:
   * Lower riskScore (0 to 100) is better.
   * score = 1 - (riskScore / 100)
   */
  static normalizeRisk(riskScore: number): number {
    return Math.min(1, Math.max(0, 1 - riskScore / 100));
  }

  /**
   * Quality Normalization:
   * predictedSuccessProbability is already 0 to 1.
   */
  static normalizeQuality(predictedSuccess: number): number {
    return Math.min(1, Math.max(0, predictedSuccess));
  }
}
