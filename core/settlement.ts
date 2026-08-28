import { db } from './repository';
import { SettlementInstruction, Settlement } from './types';
import { CapacityService } from './capacity';
import crypto from 'crypto';

export class SettlementService {
  /**
   * Authoritative Atomic Settlement Execution Engine
   * Executes a SettlementInstruction idempotently and atomically with strict financial invariants.
   */
  static async executeInstruction(
    instruction: SettlementInstruction, 
    idempotencyKey: string
  ): Promise<Settlement> {
    const taskId = instruction.taskId;
    const task = await db.getTask(taskId);
    if (!task) throw new Error(`INVALID_INSTRUCTION: Task ${taskId} not found`);

    // 1. Idempotency & Conflicting Settlement Check (Must run before state check)
    const existingSettlement = await db.getSettlementByTaskId(taskId);
    if (existingSettlement && (existingSettlement.status === 'SETTLED' || existingSettlement.status === 'ALREADY_SETTLED')) {
      const matchesInstruction = 
        existingSettlement.workerAmount === instruction.workerAmount &&
        existingSettlement.buyerRefund === instruction.buyerRefund &&
        existingSettlement.collateralReturned === instruction.collateralReturned;

      if (!matchesInstruction) {
        throw new Error(`CONFLICTING_SETTLEMENT: Task ${taskId} has already been settled with a different instruction`);
      }

      return {
        ...existingSettlement,
        status: 'ALREADY_SETTLED'
      };
    }

    // 2. Task State Eligibility Validation
    const validSettlementStates = ['CLEARING', 'VERIFYING', 'EXPIRED', 'UNCERTAIN', 'DEFECTIVE', 'FAILED'];
    if (!validSettlementStates.includes(task.status)) {
      throw new Error(`INVALID_TASK_STATE: Cannot settle task in ${task.status} state`);
    }

    // 2. UNCERTAIN Rejection without Arbitration
    if (instruction.verdict === 'UNCERTAIN' || task.status === 'UNCERTAIN') {
      throw new Error('INVALID_TASK_STATE: Settlement cannot execute on UNCERTAIN state without explicit arbitration resolution');
    }

    // 3. Instruction Mismatch Validation
    if (instruction.taskId !== task.id) {
      throw new Error(`INVALID_INSTRUCTION: Settlement instruction task ID (${instruction.taskId}) mismatch with task (${task.id})`);
    }

    // 4. Non-Negative Bounds Check
    if (
      instruction.workerAmount < 0 || instruction.buyerRefund < 0 ||
      instruction.evaluatorAmount < 0 || instruction.protocolAmount < 0 ||
      instruction.collateralReturned < 0 || instruction.collateralSlashed < 0 ||
      instruction.buyerBondReturned < 0 || instruction.buyerBondSlashed < 0
    ) {
      throw new Error('INVALID_INSTRUCTION: Settlement amounts cannot be negative');
    }

    // 5. Financial Conservation Checks against DB Records
    const escrow = await db.getEscrow(taskId);
    const collateral = await db.getCollateralByTaskId(taskId);
    const buyerBond = await db.getBuyerBondByTaskId(taskId);

    if (!escrow || escrow.status !== 'LOCKED') {
      throw new Error('INVALID_TASK_STATE: Locked escrow record required for settlement');
    }

    // Escrow Conservation Check
    const escrowAllocated = instruction.workerAmount + instruction.buyerRefund + instruction.evaluatorAmount + instruction.protocolAmount;
    if (escrowAllocated !== escrow.amount || instruction.escrowReleased !== escrow.amount) {
      throw new Error(`INVALID_INSTRUCTION: Escrow allocation (₹${escrowAllocated}) does not equal locked escrow amount (₹${escrow.amount})`);
    }

    // Collateral Conservation Check
    const collateralTotal = collateral ? collateral.amount : 0;
    const collateralAllocated = instruction.collateralReturned + instruction.collateralSlashed;
    if (collateralAllocated !== collateralTotal) {
      throw new Error(`INVALID_INSTRUCTION: Collateral allocation (₹${collateralAllocated}) does not equal locked collateral (₹${collateralTotal})`);
    }

    // Buyer Bond Conservation Check
    const bondTotal = buyerBond ? buyerBond.amount : 0;
    const bondAllocated = instruction.buyerBondReturned + instruction.buyerBondSlashed;
    if (bondAllocated !== bondTotal) {
      throw new Error(`INVALID_INSTRUCTION: Buyer bond allocation (₹${bondAllocated}) does not equal locked buyer bond (₹${bondTotal})`);
    }

    // 7. Construct Settlement Record
    const settlementRecord: Settlement = {
      id: `SETTLE-${crypto.randomUUID().slice(0, 8)}`,
      taskId,
      workerAmount: instruction.workerAmount,
      evaluatorAmount: instruction.evaluatorAmount,
      protocolAmount: instruction.protocolAmount,
      buyerRefund: instruction.buyerRefund,
      collateralReturned: instruction.collateralReturned,
      collateralSlashed: instruction.collateralSlashed,
      buyerBondReturned: instruction.buyerBondReturned,
      buyerBondSlashed: instruction.buyerBondSlashed,
      instruction,
      status: 'PENDING'
    };

    // 8. Execute Logically Atomic Settlement
    const finalSettlement = await db.executeAtomicSettlement(settlementRecord, idempotencyKey);

    // 9. Update Task Terminal Lifecycle State
    if (instruction.verdict === 'PASS' || instruction.verdict === 'PARTIAL') {
      await db.updateTaskStatus(taskId, 'COMPLETED');
    } else if (instruction.verdict === 'FAIL') {
      await db.updateTaskStatus(taskId, 'PENALIZED');
    } else if (instruction.verdict === 'EXPIRED' || instruction.verdict === 'DEFECTIVE') {
      await db.updateTaskStatus(taskId, 'REFUNDED');
    }

    // 10. Update Economic Capacity
    await CapacityService.updateCapacity(task, instruction.verdict);

    return finalSettlement;
  }
}
