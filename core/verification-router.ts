import { Task, Evidence, VerificationRouteType } from './types';

export interface RouteSelectionResult {
  selectedRoute: VerificationRouteType;
  estimatedCost: number;
  allowedVerificationBudget: number;
  viable: boolean;
  reason?: string;
}

export const VERIFICATION_ROUTE_COSTS: Record<VerificationRouteType, number> = {
  DETERMINISTIC: 50,
  REFERENCE: 150,
  BLIND_JURY: 500,
};

export class VerificationRouter {
  /**
   * Transparent Deterministic Route Selection Policy Engine
   * Decision Order:
   * 1. Can task be objectively verified? -> DETERMINISTIC (₹50)
   * 2. Is reliable reference/gold data available? -> REFERENCE (₹150)
   * 3. Is task suitable for semantic evaluation? -> BLIND_JURY (₹500)
   * 4. Otherwise -> UNCERTAIN / NO_VALID_VERIFIER
   */
  static selectRoute(
    task: Task, 
    evidence: Evidence, 
    allowedVerificationBudgetOverride?: number
  ): RouteSelectionResult {
    let selectedRoute: VerificationRouteType;

    const preferred = task.verificationPolicy?.preferred?.toLowerCase();

    // 1. Check preferred policy or task type
    if (preferred === 'blind_jury' || (task.taskType === 'research' && preferred !== 'deterministic')) {
      selectedRoute = 'BLIND_JURY';
    } else if (preferred === 'reference') {
      selectedRoute = 'REFERENCE';
    } else if (preferred === 'deterministic' || task.taskType === 'code' || evidence.evidenceType === 'code_test_suite') {
      selectedRoute = 'DETERMINISTIC';
    } else {
      selectedRoute = 'BLIND_JURY';
    }

    const estimatedCost = VERIFICATION_ROUTE_COSTS[selectedRoute];

    // Verification Economics Check
    // Allowed verification budget = 10% of task value (or budget override)
    const taskValue = task.financialTerms?.taskValue || task.budget;
    const defaultAllowedBudget = Math.max(1, Math.round(taskValue * 0.10));
    const allowedVerificationBudget = allowedVerificationBudgetOverride ?? defaultAllowedBudget;

    if (estimatedCost > allowedVerificationBudget) {
      return {
        selectedRoute,
        estimatedCost,
        allowedVerificationBudget,
        viable: false,
        reason: `REPRICE_REQUIRED: Verification cost (₹${estimatedCost}) exceeds allowed budget (₹${allowedVerificationBudget}) for task budget ₹${taskValue}`
      };
    }

    return {
      selectedRoute,
      estimatedCost,
      allowedVerificationBudget,
      viable: true
    };
  }
}
