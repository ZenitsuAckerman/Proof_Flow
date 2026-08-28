import { Agent, Task, Wallet } from './types';

// Seeded Agents
export const seedAgents: Agent[] = [
  {
    id: 'AGENT-BUYER-1',
    name: 'TechCorp Buyer',
    role: ['BUYER'],
    capabilities: [],
    reputationScore: 90,
    riskScore: 10,
    economicCapacity: {},
    walletId: 'WALLET-BUYER-1',
    createdAt: new Date().toISOString()
  },
  {
    id: 'AGENT-WORKER-1',
    name: 'PyCoder Pro',
    role: ['WORKER'],
    capabilities: ['python', 'backend'],
    reputationScore: 95,
    riskScore: 5,
    economicCapacity: { 'python': 25000 },
    walletId: 'WALLET-WORKER-1',
    createdAt: new Date().toISOString()
  },
  {
    id: 'AGENT-WORKER-2',
    name: 'ResearchBot',
    role: ['WORKER'],
    capabilities: ['research', 'data'],
    reputationScore: 85,
    riskScore: 15,
    economicCapacity: { 'research': 5000 },
    walletId: 'WALLET-WORKER-2',
    createdAt: new Date().toISOString()
  },
  {
    id: 'AGENT-WORKER-3',
    name: 'LowCap Python Expert',
    role: ['WORKER'],
    capabilities: ['python', 'backend'],
    reputationScore: 96, // Technical score 96 (higher than PyCoder Pro 95!)
    riskScore: 4,
    economicCapacity: { 'python': 5000 }, // Capacity ₹5,000 < Safe Exposure ₹9,000
    walletId: 'WALLET-WORKER-3',
    createdAt: new Date().toISOString()
  },
  {
    id: 'AGENT-WORKER-4',
    name: 'Broke Python Coder',
    role: ['WORKER'],
    capabilities: ['python', 'backend'],
    reputationScore: 92,
    riskScore: 8,
    economicCapacity: { 'python': 30000 },
    walletId: 'WALLET-WORKER-4',
    createdAt: new Date().toISOString()
  },
  // Evaluators
  { id: 'EVAL-1', name: 'Jury A', role: ['EVALUATOR'], capabilities: ['python', 'research'], reputationScore: 90, riskScore: 10, economicCapacity: {}, walletId: 'WALLET-EVAL-1', createdAt: new Date().toISOString() },
  { id: 'EVAL-2', name: 'Jury B', role: ['EVALUATOR'], capabilities: ['python', 'research'], reputationScore: 88, riskScore: 12, economicCapacity: {}, walletId: 'WALLET-EVAL-2', createdAt: new Date().toISOString() },
  { id: 'EVAL-3', name: 'Jury C', role: ['EVALUATOR'], capabilities: ['python', 'research'], reputationScore: 92, riskScore: 8, economicCapacity: {}, walletId: 'WALLET-EVAL-3', createdAt: new Date().toISOString() },
  { id: 'EVAL-4', name: 'Jury D', role: ['EVALUATOR'], capabilities: ['python', 'research'], reputationScore: 85, riskScore: 15, economicCapacity: {}, walletId: 'WALLET-EVAL-4', createdAt: new Date().toISOString() },
  { id: 'EVAL-5', name: 'Jury E', role: ['EVALUATOR'], capabilities: ['python', 'research'], reputationScore: 95, riskScore: 5, economicCapacity: {}, walletId: 'WALLET-EVAL-5', createdAt: new Date().toISOString() },
  // Protocol Treasury
  { id: 'PROTOCOL-TREASURY', name: 'ProofFlow Protocol Treasury', role: ['PROTOCOL'], capabilities: [], reputationScore: 100, riskScore: 0, economicCapacity: {}, walletId: 'WALLET-PROTOCOL-TREASURY', createdAt: new Date().toISOString() }
];

// Seeded Wallets
export const seedWallets: Wallet[] = [
  { id: 'WALLET-BUYER-1', agentId: 'AGENT-BUYER-1', availableBalance: 100000, lockedBalance: 0, updatedAt: new Date().toISOString() },
  { id: 'WALLET-WORKER-1', agentId: 'AGENT-WORKER-1', availableBalance: 20000, lockedBalance: 0, updatedAt: new Date().toISOString() },
  { id: 'WALLET-WORKER-2', agentId: 'AGENT-WORKER-2', availableBalance: 10000, lockedBalance: 0, updatedAt: new Date().toISOString() },
  { id: 'WALLET-WORKER-3', agentId: 'AGENT-WORKER-3', availableBalance: 20000, lockedBalance: 0, updatedAt: new Date().toISOString() },
  { id: 'WALLET-WORKER-4', agentId: 'AGENT-WORKER-4', availableBalance: 500, lockedBalance: 0, updatedAt: new Date().toISOString() }, // Balance ₹500 < Collateral ₹1,000
  { id: 'WALLET-EVAL-1', agentId: 'EVAL-1', availableBalance: 5000, lockedBalance: 0, updatedAt: new Date().toISOString() },
  { id: 'WALLET-EVAL-2', agentId: 'EVAL-2', availableBalance: 5000, lockedBalance: 0, updatedAt: new Date().toISOString() },
  { id: 'WALLET-EVAL-3', agentId: 'EVAL-3', availableBalance: 5000, lockedBalance: 0, updatedAt: new Date().toISOString() },
  { id: 'WALLET-EVAL-4', agentId: 'EVAL-4', availableBalance: 5000, lockedBalance: 0, updatedAt: new Date().toISOString() },
  { id: 'WALLET-EVAL-5', agentId: 'EVAL-5', availableBalance: 5000, lockedBalance: 0, updatedAt: new Date().toISOString() },
  { id: 'WALLET-PROTOCOL-TREASURY', agentId: 'PROTOCOL-TREASURY', availableBalance: 0, lockedBalance: 0, updatedAt: new Date().toISOString() },
];

// Seeded Tasks
export const seedTasks: Task[] = [
  {
    id: 'TASK-DEMO-1',
    buyerAgentId: 'AGENT-BUYER-1',
    title: 'Python Deterministic Bounty',
    description: 'Fix the identified calculation error in the Python payment script.',
    taskType: 'code',
    budget: 10000,
    qualityThreshold: 90,
    deadlineSeconds: 3600,
    status: 'CREATED',
    verificationPolicy: {
      preferred: 'deterministic',
      allowJuryFallback: false
    },
    financialTerms: {
      taskValue: 10000,
      safeExposure: 9000,
      collateralRequirement: 1000,
      buyerBondRequirement: 500,
      riskFactor: 0.1,
      verificationPolicy: {
        preferred: 'deterministic',
        allowJuryFallback: false
      }
    },
    createdAt: new Date().toISOString()
  },
  {
    id: 'TASK-DEMO-2',
    buyerAgentId: 'AGENT-BUYER-1',
    title: 'Market Research Summary',
    description: 'Summarize the provided market research documents and claim sources.',
    taskType: 'research',
    budget: 5000,
    qualityThreshold: 80,
    deadlineSeconds: 7200,
    status: 'CREATED',
    verificationPolicy: {
      preferred: 'blind_jury',
      allowJuryFallback: true
    },
    financialTerms: {
      taskValue: 5000,
      safeExposure: 4500,
      collateralRequirement: 500,
      buyerBondRequirement: 250,
      riskFactor: 0.1,
      verificationPolicy: {
        preferred: 'blind_jury',
        allowJuryFallback: true
      }
    },
    createdAt: new Date().toISOString()
  }
];
