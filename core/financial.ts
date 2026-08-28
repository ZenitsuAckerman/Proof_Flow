import { db } from './repository';
import { Task, Settlement, FinancialTerms } from './types';
import crypto from 'crypto';

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 1. Underwriting Service
 */
export class UnderwritingService {
  static async underwriteTask(taskId: string, workerReputation: number): Promise<FinancialTerms> {
    const task = await db.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const riskFactor = workerReputation >= 90 ? 0.1 : 0.3;
    const safeExposure = task.budget * (1 - riskFactor);
    const collateralRequirement = Math.max(task.budget * riskFactor, task.budget * 0.1);
    const buyerBondRequirement = task.budget * 0.05;

    const terms: FinancialTerms = {
      taskValue: task.budget,
      safeExposure,
      collateralRequirement,
      buyerBondRequirement,
      riskFactor,
      verificationPolicy: task.verificationPolicy,
    };

    await db.updateTaskFinancialTerms(taskId, terms);
    return terms;
  }

  static calculateTerms(task: Task, workerReputation: number): FinancialTerms {
    const riskFactor = workerReputation >= 90 ? 0.1 : 0.3;
    const safeExposure = task.budget * (1 - riskFactor);
    const collateralRequirement = Math.max(task.budget * riskFactor, task.budget * 0.1);
    const buyerBondRequirement = task.budget * 0.05;

    return {
      taskValue: task.budget,
      safeExposure,
      collateralRequirement,
      buyerBondRequirement,
      riskFactor,
      verificationPolicy: task.verificationPolicy,
    };
  }
}

/**
 * 2. Wallet Service
 */
export class WalletService {
  static async getBalance(agentId: string) {
    return db.getWalletByAgentId(agentId);
  }

  static async checkFunds(agentId: string, amount: number) {
    const wallet = await db.getWalletByAgentId(agentId);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.availableBalance < amount) throw new Error('INSUFFICIENT_FUNDS');
    return true;
  }
}

/**
 * 3. Escrow Service
 */
export class EscrowService {
  static async fundEscrow(taskId: string, buyerAgentId: string, idempotencyKey: string, overrideAmount?: number) {
    const task = await db.getTask(taskId);
    if (!task) throw new Error('Task not found');
    
    if (!task.financialTerms) {
      throw new Error('MISSING_FINANCIAL_TERMS: Underwriting must be completed before escrow funding');
    }

    const authoritativeAmount = task.financialTerms.taskValue;
    if (overrideAmount !== undefined && overrideAmount !== authoritativeAmount) {
      throw new Error(`AUTHORITATIVE_TERMS_MISMATCH: Caller amount ${overrideAmount} does not match underwritten task terms ${authoritativeAmount}`);
    }

    return db.executeAtomicFunding(taskId, buyerAgentId, authoritativeAmount, idempotencyKey);
  }

  static async refundEscrow(taskId: string, idempotencyKey: string) {
    return db.executeAtomicRefund(taskId, idempotencyKey);
  }
}

/**
 * 4. Collateral Service
 */
export class CollateralService {
  static async lockCollateral(taskId: string, workerAgentId: string, idempotencyKey: string, overrideAmount?: number) {
    const task = await db.getTask(taskId);
    if (!task) throw new Error('Task not found');

    if (!task.financialTerms) {
      throw new Error('MISSING_FINANCIAL_TERMS: Underwriting must be completed before collateral lock');
    }

    const authoritativeAmount = task.financialTerms.collateralRequirement;
    if (overrideAmount !== undefined && overrideAmount !== authoritativeAmount) {
      throw new Error(`AUTHORITATIVE_TERMS_MISMATCH: Caller amount ${overrideAmount} does not match underwritten collateral terms ${authoritativeAmount}`);
    }

    return db.executeAtomicCollateralLock(taskId, workerAgentId, authoritativeAmount, idempotencyKey);
  }
}

/**
 * 5. Buyer Bond Service
 */
export class BuyerBondService {
  static async lockBond(taskId: string, buyerAgentId: string, idempotencyKey: string, overrideAmount?: number) {
    const task = await db.getTask(taskId);
    if (!task) throw new Error('Task not found');

    if (!task.financialTerms) {
      throw new Error('MISSING_FINANCIAL_TERMS: Underwriting must be completed before buyer bond lock');
    }

    const authoritativeAmount = task.financialTerms.buyerBondRequirement;
    if (overrideAmount !== undefined && overrideAmount !== authoritativeAmount) {
      throw new Error(`AUTHORITATIVE_TERMS_MISMATCH: Caller amount ${overrideAmount} does not match underwritten buyer bond terms ${authoritativeAmount}`);
    }

    return db.executeAtomicBuyerBondLock(taskId, buyerAgentId, authoritativeAmount, idempotencyKey);
  }
}

/**
 * 6. Settlement Service
 */
export class SettlementService {
  static async executeSettlement(
    taskId: string, 
    verdict: 'PASS' | 'PARTIAL' | 'FAIL' | 'UNCERTAIN' | 'DISPUTE' | 'EXPIRED' | 'DEFECTIVE', 
    qualityScore: number = 0,
    idempotencyKey: string
  ) {
    const task = await db.getTask(taskId);
    if (!task) throw new Error('Task not found');
    
    // Idempotency check
    const existingSettlement = await db.getSettlementByTaskId(taskId);
    if (existingSettlement) {
      if (existingSettlement.status === 'SETTLED' || existingSettlement.status === 'ALREADY_SETTLED') {
        return { ...existingSettlement, status: 'ALREADY_SETTLED' }; // idempotent safe return
      }
    }

    const escrow = await db.getEscrow(taskId);
    const collateral = await db.getCollateralByTaskId(taskId);
    const buyerBond = await db.getBuyerBondByTaskId(taskId);
    
    if (!escrow || escrow.status !== 'LOCKED') {
      throw new Error('INVALID_TASK_STATE: Escrow not locked or missing');
    }

    let workerAmount = 0;
    let buyerRefund = 0;
    let collateralReturned = 0;
    let buyerBondReturned = 0;
    let buyerBondSlashed = 0;
    
    // Settlement Policy Rules
    switch(verdict) {
      case 'PASS':
        if (qualityScore >= 90) {
          workerAmount = escrow.amount;
          collateralReturned = collateral ? collateral.amount : 0;
        } else if (qualityScore >= 60) {
          workerAmount = escrow.amount * (qualityScore / 100);
          buyerRefund = escrow.amount - workerAmount;
          collateralReturned = collateral ? collateral.amount : 0;
        }
        buyerBondReturned = buyerBond ? buyerBond.amount : 0;
        break;
      case 'PARTIAL':
        workerAmount = escrow.amount * (qualityScore / 100);
        buyerRefund = escrow.amount - workerAmount;
        collateralReturned = collateral ? collateral.amount : 0;
        buyerBondReturned = buyerBond ? buyerBond.amount : 0;
        break;
      case 'FAIL':
        buyerRefund = escrow.amount;
        collateralReturned = 0;
        buyerBondReturned = buyerBond ? buyerBond.amount : 0;
        break;
      case 'EXPIRED':
        buyerRefund = escrow.amount;
        collateralReturned = 0;
        buyerBondReturned = buyerBond ? buyerBond.amount : 0;
        break;
      case 'DEFECTIVE':
        // Buyer specification was defective
        workerAmount = escrow.amount * 0.2; // Compensate worker 20% of task escrow
        buyerRefund = escrow.amount * 0.8;
        collateralReturned = collateral ? collateral.amount : 0;
        // Buyer bond is slashed to compensate worker for defective specification
        buyerBondSlashed = buyerBond ? buyerBond.amount : 0;
        break;
      default:
        throw new Error(`Unhandled settlement verdict: ${verdict}`);
    }

    const settlement: Settlement = {
      id: generateId(),
      taskId,
      workerAmount,
      evaluatorAmount: 0,
      protocolAmount: 0,
      buyerRefund,
      collateralReturned,
      buyerBondReturned,
      buyerBondSlashed,
      status: 'PENDING',
    };

    const finalSettlement = await db.executeAtomicSettlement(settlement, idempotencyKey);
    return finalSettlement;
  }
}

/**
 * 7. Assignment Service
 * Moves task from FUNDED to ASSIGNED after escrow and collateral are locked.
 */
export class AssignmentService {
  static async confirmAssignment(taskId: string): Promise<Task> {
    const task = await db.getTask(taskId);
    if (!task) throw new Error('Task not found');
    
    const escrow = await db.getEscrow(taskId);
    if (!escrow || escrow.status !== 'LOCKED') {
      throw new Error('INVALID_TASK_STATE: Escrow and collateral funding must be complete before assignment');
    }
    if (!task.selectedWorkerId) {
      throw new Error('INVALID_TASK_STATE: No worker selected for task assignment');
    }

    if (task.status === 'UNDERWRITING') {
      await db.updateTaskStatus(taskId, 'FUNDED');
      await db.updateTaskStatus(taskId, 'ASSIGNED');
    } else if (task.status === 'FUNDED') {
      await db.updateTaskStatus(taskId, 'ASSIGNED');
    }

    task.assignedWorkerId = task.selectedWorkerId;
    return task;
  }
}
