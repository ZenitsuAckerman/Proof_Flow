import { db } from './repository';
import { Task, Agent, WorkerEligibility, DiscoveryResult } from './types';

export class DiscoveryService {
  /**
   * Autonomous Capability & Economic Discovery
   * Reads task.financialTerms from DB authoritatively.
   */
  static async discoverWorkers(taskId: string, requiredCapabilityOverride?: string): Promise<DiscoveryResult> {
    const task = await db.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (!task.financialTerms) {
      throw new Error('MISSING_FINANCIAL_TERMS: Task must be underwritten before discovery');
    }

    const terms = task.financialTerms;
    // Required capability: default to task.taskType if not specified
    const requiredCapability = requiredCapabilityOverride || task.taskType;

    const allAgents = await db.listAgents();
    const workerAgents = allAgents.filter(a => a.role.includes('WORKER'));

    const candidateEvaluations: WorkerEligibility[] = [];

    for (const worker of workerAgents) {
      const eligibility = await this.evaluateWorkerEligibility(worker, task, requiredCapability);
      candidateEvaluations.push(eligibility);
    }

    const eligibleCandidates = candidateEvaluations.filter(c => c.eligible);

    return {
      taskId: task.id,
      requiredCapability,
      taskValue: terms.taskValue,
      safeExposureRequired: terms.safeExposure,
      collateralRequired: terms.collateralRequirement,
      totalCandidatesEvaluated: workerAgents.length,
      eligibleCandidatesCount: eligibleCandidates.length,
      candidates: candidateEvaluations,
    };
  }

  /**
   * Evaluate single worker against technical and economic criteria
   */
  static async evaluateWorkerEligibility(
    worker: Agent, 
    task: Task, 
    requiredCapability: string
  ): Promise<WorkerEligibility> {
    const terms = task.financialTerms!;

    // 1. Availability check
    if (worker.available === false) {
      return {
        workerId: worker.id,
        workerName: worker.name,
        technicalScore: worker.reputationScore,
        capabilityMatch: false,
        economicCapacity: worker.economicCapacity[requiredCapability] || 0,
        safeExposureRequired: terms.safeExposure,
        collateralAvailable: 0,
        collateralRequired: terms.collateralRequirement,
        riskScore: worker.riskScore,
        eligible: false,
        status: 'INELIGIBLE_UNAVAILABLE',
        rejectionReason: 'Worker is currently unavailable'
      };
    }

    // 2. Capability check
    const hasCapability = worker.capabilities.includes(requiredCapability) ||
      (requiredCapability === 'code' && (worker.capabilities.includes('python') || worker.capabilities.includes('code')));
    const supportsTaskType = !worker.supportedTaskTypes || worker.supportedTaskTypes.includes(task.taskType);

    if (!hasCapability || !supportsTaskType) {
      return {
        workerId: worker.id,
        workerName: worker.name,
        technicalScore: worker.reputationScore,
        capabilityMatch: false,
        economicCapacity: worker.economicCapacity[requiredCapability] || 0,
        safeExposureRequired: terms.safeExposure,
        collateralAvailable: 0,
        collateralRequired: terms.collateralRequirement,
        riskScore: worker.riskScore,
        eligible: false,
        status: 'INELIGIBLE_CAPABILITY_MISMATCH',
        rejectionReason: `Worker lacks required capability or task type support: ${requiredCapability}`
      };
    }

    // 3. Economic Capacity check (Capacity >= Safe Exposure)
    const capacityKey = worker.economicCapacity[requiredCapability] !== undefined
      ? requiredCapability
      : (requiredCapability === 'code' && worker.economicCapacity['python'] !== undefined ? 'python' : requiredCapability);
    const workerCapacity = worker.economicCapacity[capacityKey] || 0;
    if (workerCapacity < terms.safeExposure) {
      return {
        workerId: worker.id,
        workerName: worker.name,
        technicalScore: worker.reputationScore,
        capabilityMatch: true,
        economicCapacity: workerCapacity,
        safeExposureRequired: terms.safeExposure,
        collateralAvailable: 0,
        collateralRequired: terms.collateralRequirement,
        riskScore: worker.riskScore,
        eligible: false,
        status: 'INELIGIBLE_EXPOSURE_TOO_HIGH',
        rejectionReason: `Economic capacity ₹${workerCapacity.toLocaleString()} is below required safe exposure ₹${terms.safeExposure.toLocaleString()}`
      };
    }

    // 4. Wallet Collateral Availability check
    const wallet = await db.getWalletByAgentId(worker.id);
    const collateralAvailable = wallet ? wallet.availableBalance : 0;

    if (collateralAvailable < terms.collateralRequirement) {
      return {
        workerId: worker.id,
        workerName: worker.name,
        technicalScore: worker.reputationScore,
        capabilityMatch: true,
        economicCapacity: workerCapacity,
        safeExposureRequired: terms.safeExposure,
        collateralAvailable,
        collateralRequired: terms.collateralRequirement,
        riskScore: worker.riskScore,
        eligible: false,
        status: 'INELIGIBLE_INSUFFICIENT_COLLATERAL',
        rejectionReason: `Available wallet balance ₹${collateralAvailable.toLocaleString()} is below required collateral ₹${terms.collateralRequirement.toLocaleString()}`
      };
    }

    // 5. Eligible!
    return {
      workerId: worker.id,
      workerName: worker.name,
      technicalScore: worker.reputationScore,
      capabilityMatch: true,
      economicCapacity: workerCapacity,
      safeExposureRequired: terms.safeExposure,
      collateralAvailable,
      collateralRequired: terms.collateralRequirement,
      riskScore: worker.riskScore,
      eligible: true,
      status: 'ELIGIBLE'
    };
  }
}
