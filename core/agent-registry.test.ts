import { generate75AgentRegistry, static75Registry } from './agent-registry';

describe('Phase H1: Agent Registry & Virtual Economy Profile Tests', () => {
  it('1. Generates exactly 75 agent profiles', () => {
    const registry = generate75AgentRegistry();
    expect(registry.agents.length).toBe(75);
    expect(registry.wallets.length).toBe(75);
  });

  it('2. Has unique Agent IDs across the full registry', () => {
    const registry = generate75AgentRegistry();
    const ids = registry.agents.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(75);
  });

  it('3. Matches specified role distribution (60 workers, 10 evaluators, 4 buyers, 1 protocol)', () => {
    const registry = generate75AgentRegistry();
    const workers = registry.agents.filter(a => a.role.includes('WORKER'));
    const evaluators = registry.agents.filter(a => a.role.includes('EVALUATOR'));
    const buyers = registry.agents.filter(a => a.role.includes('BUYER'));
    const protocol = registry.agents.filter(a => a.role.includes('PROTOCOL'));

    expect(workers.length).toBe(60);
    expect(evaluators.length).toBe(10);
    expect(buyers.length).toBe(4);
    expect(protocol.length).toBe(1);
  });

  it('4. Provides valid economic profiles, providers, and execution adapters', () => {
    const workers = static75Registry.agents.filter(a => a.role.includes('WORKER'));
    workers.forEach(w => {
      expect(w.provider).toBeDefined();
      expect(w.executionAdapter).toBeDefined();
      expect(w.capabilities.length).toBeGreaterThan(0);
      expect(w.reputationScore).toBeGreaterThanOrEqual(0);
      expect(w.reputationScore).toBeLessThanOrEqual(100);
      expect(w.walletId).toBeDefined();
      expect(typeof w.economicCapacity).toBe('object');
    });
  });

  it('5. Is 100% deterministic (reset returns identical registry)', () => {
    const reg1 = generate75AgentRegistry();
    const reg2 = generate75AgentRegistry();
    expect(reg1.agents).toEqual(reg2.agents);
    expect(reg1.wallets).toEqual(reg2.wallets);
  });
});
