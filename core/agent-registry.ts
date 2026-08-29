import { Agent, Wallet } from './types';

export interface AgentRegistryData {
  agents: Agent[];
  wallets: Wallet[];
}

/**
 * Deterministic PRNG helper based on string seed
 */
function deterministicHash(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDeterministicNumber(seed: string, min: number, max: number): number {
  const hash = deterministicHash(seed);
  return min + (hash % (max - min + 1));
}

/**
 * Generate 75 Virtual Economic Agent Profiles & Wallets Deterministically
 */
export function generate75AgentRegistry(): AgentRegistryData {
  const agents: Agent[] = [];
  const wallets: Wallet[] = [];

  const providers = ['Google', 'Groq', 'Anthropic', 'OpenAI', 'LocalExecution', 'Cohere'];
  const adapters = ['GEMINI_DEBUGGER', 'GROQ_FAST_DEBUGGER', 'OPENROUTER_LLM', 'PYTHON_RESTRICTED_SANDBOX', 'SIMULATED_DETERMINISTIC'];

  const capabilityPool = [
    ['python', 'backend', 'code'],
    ['python', 'debugging', 'code'],
    ['python', 'optimization', 'code'],
    ['python', 'security', 'code'],
    ['research', 'data', 'analysis'],
    ['code', 'testing', 'qa'],
    ['python', 'algorithms', 'math']
  ];

  const specializationPool = [
    ['debugging', 'refactoring'],
    ['optimization', 'performance'],
    ['security', 'audit'],
    ['testing', 'coverage'],
    ['data-analysis', 'summary'],
    ['backend', 'api']
  ];

  // 1. Generate 60 Worker Agents
  for (let i = 1; i <= 60; i++) {
    const id = `AGENT-WORKER-${String(i).padStart(3, '0')}`;
    const seed = `worker-seed-${i}`;
    const nameSeed = getDeterministicNumber(seed + '-name', 100, 999);
    const name = `Worker-${i} (Agent-${nameSeed})`;

    const reputationScore = getDeterministicNumber(seed + '-rep', 65, 98);
    const riskScore = Math.max(2, 100 - reputationScore);
    const calibrationScore = getDeterministicNumber(seed + '-cal', 70, 99);
    const averageLatencyMs = getDeterministicNumber(seed + '-lat', 800, 4500);
    const basePrice = getDeterministicNumber(seed + '-price', 40, 120);

    const capsIndex = getDeterministicNumber(seed + '-caps', 0, capabilityPool.length - 1);
    const specsIndex = getDeterministicNumber(seed + '-specs', 0, specializationPool.length - 1);
    const providerIndex = getDeterministicNumber(seed + '-prov', 0, providers.length - 1);
    const adapterIndex = getDeterministicNumber(seed + '-adap', 0, adapters.length - 1);

    // Economic Capacity (Capacity in INR)
    // Most workers have capacity between ₹8,000 and ₹45,000; a few low-cap workers (₹3,000-₹6,000) for testing rejection
    const pythonCapacity = (i === 13 || i === 27) ? 4000 : getDeterministicNumber(seed + '-cap', 12000, 50000);
    const researchCapacity = getDeterministicNumber(seed + '-rcap', 5000, 25000);

    // Wallet Balances (INR)
    // Broke worker test case: worker 14 has ₹200 available (below collateral requirement)
    const availableBalance = (i === 14 || i === 28) ? 200 : getDeterministicNumber(seed + '-bal', 5000, 35000);
    const walletId = `WALLET-WORKER-${String(i).padStart(3, '0')}`;

    const agent: Agent = {
      id,
      name,
      role: ['WORKER'],
      provider: providers[providerIndex],
      executionAdapter: adapters[adapterIndex],
      capabilities: capabilityPool[capsIndex],
      specializations: specializationPool[specsIndex],
      available: i !== 45, // Agent 45 is set to unavailable for testing
      reputationScore,
      riskScore,
      calibrationScore,
      averageLatencyMs,
      basePrice,
      economicCapacity: {
        python: pythonCapacity,
        code: pythonCapacity,
        research: researchCapacity
      },
      walletId,
      createdAt: '2026-01-01T00:00:00.000Z'
    };

    const wallet: Wallet = {
      id: walletId,
      agentId: id,
      availableBalance,
      lockedBalance: 0,
      updatedAt: '2026-01-01T00:00:00.000Z'
    };

    agents.push(agent);
    wallets.push(wallet);
  }

  // 2. Generate 10 Evaluator Agents
  for (let i = 1; i <= 10; i++) {
    const id = `EVAL-${i}`;
    const walletId = `WALLET-EVAL-${i}`;
    agents.push({
      id,
      name: `Evaluator Jury ${String.fromCharCode(64 + i)}`,
      role: ['EVALUATOR'],
      provider: 'ProofFlowProtocol',
      executionAdapter: 'SIMULATED_DETERMINISTIC',
      capabilities: ['python', 'research', 'code'],
      reputationScore: 90 + (i % 8),
      riskScore: 5,
      calibrationScore: 95,
      averageLatencyMs: 500,
      basePrice: 50,
      economicCapacity: { python: 100000 },
      walletId,
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    wallets.push({
      id: walletId,
      agentId: id,
      availableBalance: 10000,
      lockedBalance: 0,
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
  }

  // 3. Generate 4 Buyer Agents
  for (let i = 1; i <= 4; i++) {
    const id = `AGENT-BUYER-${i}`;
    const walletId = `WALLET-BUYER-${i}`;
    agents.push({
      id,
      name: `Corporate Buyer ${i}`,
      role: ['BUYER'],
      provider: 'EnterpriseBuyer',
      capabilities: [],
      reputationScore: 92,
      riskScore: 8,
      economicCapacity: {},
      walletId,
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    wallets.push({
      id: walletId,
      agentId: id,
      availableBalance: 200000,
      lockedBalance: 0,
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
  }

  // 4. Generate 1 Protocol Treasury
  const treasuryId = 'PROTOCOL-TREASURY';
  const treasuryWalletId = 'WALLET-PROTOCOL-TREASURY';
  agents.push({
    id: treasuryId,
    name: 'ProofFlow Protocol Treasury',
    role: ['PROTOCOL'],
    provider: 'Protocol',
    capabilities: [],
    reputationScore: 100,
    riskScore: 0,
    economicCapacity: {},
    walletId: treasuryWalletId,
    createdAt: '2026-01-01T00:00:00.000Z'
  });
  wallets.push({
    id: treasuryWalletId,
    agentId: treasuryId,
    availableBalance: 0,
    lockedBalance: 0,
    updatedAt: '2026-01-01T00:00:00.000Z'
  });

  return { agents, wallets };
}

export const static75Registry = generate75AgentRegistry();
