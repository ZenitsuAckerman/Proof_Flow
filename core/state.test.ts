import { TaskStateMachine } from './state';
import { db } from './repository';

describe('TaskStateMachine', () => {
  it('should allow valid transitions', () => {
    expect(TaskStateMachine.isValidTransition('CREATED', 'DISCOVERING')).toBe(true);
    expect(TaskStateMachine.transition('CREATED', 'DISCOVERING')).toBe('DISCOVERING');
  });

  it('should reject invalid transitions', () => {
    expect(TaskStateMachine.isValidTransition('CREATED', 'COMPLETED')).toBe(false);
    expect(() => TaskStateMachine.transition('CREATED', 'COMPLETED')).toThrow('INVALID_TASK_STATE');
  });

  it('should transition into EXPIRED from active states', () => {
    expect(TaskStateMachine.isValidTransition('FUNDED', 'EXPIRED')).toBe(true);
    expect(TaskStateMachine.transition('FUNDED', 'EXPIRED')).toBe('EXPIRED');
  });
});

describe('InMemoryRepository', () => {
  it('should seed data correctly', async () => {
    const agents = await db.listAgents();
    expect(agents.length).toBeGreaterThan(0);
    
    const tasks = await db.listTasks();
    expect(tasks.length).toBe(2);
  });

  it('should prevent negative wallet balances', async () => {
    const wallet = await db.getWallet('WALLET-BUYER-1');
    expect(wallet).toBeDefined();
    
    await expect(db.updateWalletBalances('WALLET-BUYER-1', -500000, 0))
      .rejects
      .toThrow('INSUFFICIENT_FUNDS');
  });
});
