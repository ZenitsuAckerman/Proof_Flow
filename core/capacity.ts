import { db } from './repository';
import { Task } from './types';

export class CapacityService {
  /**
   * Deterministic Economic-Capacity Update Engine
   * Updates capability-specific capacity history based on clearing/settlement outcome.
   */
  static async updateCapacity(task: Task, verdict: string): Promise<void> {
    const workerId = task.assignedWorkerId || task.selectedWorkerId;
    if (!workerId) return;

    const worker = await db.getAgent(workerId);
    if (!worker) return;

    const capability = task.taskType === 'code' ? 'python' : task.taskType;
    const currentCapacity = worker.economicCapacity[capability] || 10000;
    const taskValue = task.financialTerms?.taskValue || task.budget;

    if (verdict === 'PASS') {
      // High-quality success: increase capacity by 10% of task value
      const boost = Math.round(taskValue * 0.10);
      worker.economicCapacity[capability] = currentCapacity + boost;
    } else if (verdict === 'FAIL') {
      // Failed work: reduce capacity by 20% of task value
      const penalty = Math.round(taskValue * 0.20);
      worker.economicCapacity[capability] = Math.max(0, currentCapacity - penalty);
    } else if (verdict === 'UNCERTAIN') {
      // UNCERTAIN: zero punitive change before arbitration resolution
      return;
    }
  }
}
