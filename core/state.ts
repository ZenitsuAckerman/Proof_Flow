import { TaskStatus } from './types';

// Define valid state transitions for tasks
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  CREATED: ['DISCOVERING'],
  DISCOVERING: ['BIDDING', 'EXPIRED'],
  BIDDING: ['UNDERWRITING', 'EXPIRED'],
  UNDERWRITING: ['FUNDED', 'EXPIRED'],
  FUNDED: ['ASSIGNED', 'EXPIRED'],
  ASSIGNED: ['EXECUTING', 'EXPIRED'],
  EXECUTING: ['SUBMITTED', 'EXPIRED'],
  SUBMITTED: ['VERIFYING'],
  VERIFYING: ['CLEARING', 'UNCERTAIN', 'FAILED'], // 'FAILED' mapping to PENALIZED/REFUNDED in later steps
  CLEARING: ['SETTLEMENT'],
  SETTLEMENT: ['COMPLETED'],
  COMPLETED: [],
  
  // Failure / exception states
  EXPIRED: ['REFUNDED'],
  REFUNDED: [],
  UNCERTAIN: ['ARBITRATION'],
  ARBITRATION: ['SETTLEMENT', 'REFUNDED'],
  FAILED: ['PENALIZED', 'REFUNDED'],
  PENALIZED: [],
};

export class TaskStateMachine {
  /**
   * Check if a transition from currentStatus to nextStatus is valid
   */
  static isValidTransition(currentStatus: TaskStatus, nextStatus: TaskStatus): boolean {
    const validNextStates = VALID_TRANSITIONS[currentStatus];
    return validNextStates ? validNextStates.includes(nextStatus) : false;
  }

  /**
   * Transition to next state if valid, else throw an error
   */
  static transition(currentStatus: TaskStatus, nextStatus: TaskStatus): TaskStatus {
    if (!this.isValidTransition(currentStatus, nextStatus)) {
      throw new Error(`INVALID_TASK_STATE: Cannot transition from ${currentStatus} to ${nextStatus}`);
    }
    return nextStatus;
  }
}
