export type AgentRole = 'BUYER' | 'WORKER' | 'EVALUATOR' | 'PROTOCOL';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole[];
  capabilities: string[];
  supportedTaskTypes?: string[];
  available?: boolean;
  reputationScore: number;
  riskScore: number;
  economicCapacity: Record<string, number>;
  walletId: string;
  createdAt: string;
}

export interface Wallet {
  id: string;
  agentId: string;
  availableBalance: number;
  lockedBalance: number;
  updatedAt: string;
}

export type TaskStatus = 
  | 'CREATED' 
  | 'DISCOVERING' 
  | 'BIDDING' 
  | 'UNDERWRITING' 
  | 'FUNDED' 
  | 'ASSIGNED' 
  | 'EXECUTING' 
  | 'SUBMITTED' 
  | 'VERIFYING' 
  | 'CLEARING' 
  | 'SETTLEMENT' 
  | 'COMPLETED' 
  | 'EXPIRED' 
  | 'REFUNDED' 
  | 'UNCERTAIN' 
  | 'ARBITRATION' 
  | 'FAILED'
  | 'PENALIZED';

export interface VerificationPolicy {
  preferred: 'deterministic' | 'reference' | 'blind_jury' | string;
  allowJuryFallback?: boolean;
  fallbackPolicy?: string;
}

export interface FinancialTerms {
  taskValue: number;
  safeExposure: number;
  collateralRequirement: number;
  buyerBondRequirement: number;
  riskFactor: number;
  verificationPolicy: VerificationPolicy;
}

export interface Task {
  id: string;
  buyerAgentId: string;
  title: string;
  description: string;
  taskType: string;
  budget: number;
  qualityThreshold: number;
  deadlineSeconds: number;
  status: TaskStatus;
  verificationPolicy: VerificationPolicy;
  financialTerms?: FinancialTerms;
  selectedWorkerId?: string;
  assignedWorkerId?: string;
  selectedBidId?: string;
  createdAt: string;
}

export interface Bid {
  id: string;
  taskId: string;
  agentId: string;
  price: number;
  predictedSuccessProbability: number;
  estimatedDurationSeconds: number;
  collateralOffered: number;
  evidencePlan: string[];
  selectionScore?: number;
  createdAt: string;
}

export interface Escrow {
  id: string;
  taskId: string;
  amount: number;
  status: 'LOCKED' | 'RELEASED' | 'REFUNDED';
  createdAt: string;
  releasedAt?: string;
}

export interface Collateral {
  id: string;
  taskId: string;
  agentId: string;
  amount: number;
  status: 'LOCKED' | 'RETURNED' | 'SLASHED';
  penaltyAmount?: number;
}

export interface BuyerBond {
  id: string;
  taskId: string;
  amount: number;
  status: 'LOCKED' | 'RETURNED' | 'SLASHED';
}

export interface Evidence {
  id: string;
  taskId: string;
  workerAgentId: string;
  outputHash: string;
  evidenceHash: string;
  evidenceType: string;
  evidencePayload: Record<string, unknown>;
  evidenceStrength: number;
  submittedAt: string;
}

export interface Evaluation {
  id: string;
  taskId: string;
  evaluatorAgentId: string;
  score?: number;
  confidence?: number;
  commitmentHash: string;
  revealStatus: 'COMMITTED' | 'REVEALED' | 'TIMEOUT';
  revealedAt?: string;
}

export type VerificationRouteType = 'DETERMINISTIC' | 'REFERENCE' | 'BLIND_JURY';
export type VerificationOverallStatus = 'VERIFIED' | 'FAILED' | 'UNCERTAIN' | 'EXPIRED' | 'NO_VALID_VERIFIER';
export type VerificationVerdict = 'PASS' | 'PARTIAL' | 'FAIL' | 'UNCERTAIN';
export type VerificationConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CommitRevealData {
  evaluatorId: string;
  commitmentHash: string;
  revealedScore?: number;
  revealedNonce?: string;
  revealStatus: 'COMMITTED' | 'REVEALED' | 'INVALID_REVEAL' | 'TIMEOUT';
}

export interface VerificationResult {
  id: string;
  taskId: string;
  routeType: VerificationRouteType;
  status: VerificationOverallStatus;
  score: number;
  confidence: VerificationConfidence;
  verificationCost: number;
  evidenceUsed: string[];
  disagreementScore?: number;
  verifierIds?: string[];
  commitReveals?: CommitRevealData[];
  verdict: VerificationVerdict;
  completedAt: string;
  message?: string;
}

export interface SettlementInstruction {
  taskId: string;
  verdict: 'PASS' | 'PARTIAL' | 'FAIL' | 'UNCERTAIN' | 'EXPIRED' | 'DEFECTIVE';
  workerAmount: number;
  buyerRefund: number;
  evaluatorAmount: number;
  protocolAmount: number;
  collateralReturned: number;
  collateralSlashed: number;
  buyerBondReturned: number;
  buyerBondSlashed: number;
  escrowReleased: number;
  reason: string;
}

export interface Settlement {
  id: string;
  taskId: string;
  workerAmount: number;
  evaluatorAmount: number;
  protocolAmount: number;
  buyerRefund: number;
  collateralReturned: number;
  collateralSlashed?: number;
  buyerBondReturned?: number;
  buyerBondSlashed?: number;
  instruction?: SettlementInstruction;
  status: 'PENDING' | 'SETTLED' | 'ALREADY_SETTLED' | 'FAILED';
  settledAt?: string;
}

export interface Transaction {
  id: string;
  taskId: string;
  fromWalletId?: string;
  toWalletId?: string;
  amount: number;
  transactionType: 'ESCROW_FUND' | 'COLLATERAL_LOCK' | 'BOND_LOCK' | 'WORKER_REWARD' | 'EVALUATOR_REWARD' | 'PROTOCOL_FEE' | 'REFUND' | 'COLLATERAL_RETURN' | 'PENALTY_SLASH';
  idempotencyKey: string;
  createdAt: string;
}

export interface ReputationEvent {
  id: string;
  agentId: string;
  capability: string;
  taskId: string;
  oldCapacity: number;
  newCapacity: number;
  reason: string;
  createdAt: string;
}

export type EligibilityStatus = 
  | 'ELIGIBLE' 
  | 'INELIGIBLE_CAPABILITY_MISMATCH' 
  | 'INELIGIBLE_EXPOSURE_TOO_HIGH' 
  | 'INELIGIBLE_INSUFFICIENT_COLLATERAL' 
  | 'INELIGIBLE_UNAVAILABLE' 
  | 'INELIGIBLE_INVALID_DATA';

export interface WorkerEligibility {
  workerId: string;
  workerName: string;
  technicalScore: number;
  capabilityMatch: boolean;
  economicCapacity: number;
  safeExposureRequired: number;
  collateralAvailable: number;
  collateralRequired: number;
  riskScore: number;
  eligible: boolean;
  status: EligibilityStatus;
  rejectionReason?: string;
}

export interface SelectionPolicyWeights {
  qualityWeight: number;
  priceWeight: number;
  reliabilityWeight: number;
  speedWeight: number;
  riskWeight: number;
}

export interface EvaluatedBid {
  bid: Bid;
  eligibility: WorkerEligibility;
  normalizedQuality: number;
  normalizedPrice: number;
  normalizedReliability: number;
  normalizedSpeed: number;
  normalizedRisk: number;
  finalScore: number;
  rank?: number;
}

export interface DiscoveryResult {
  taskId: string;
  requiredCapability: string;
  taskValue: number;
  safeExposureRequired: number;
  collateralRequired: number;
  totalCandidatesEvaluated: number;
  eligibleCandidatesCount: number;
  candidates: WorkerEligibility[];
}

export interface SelectionResult {
  taskId: string;
  status: 'SUCCESS' | 'NO_ELIGIBLE_WORKER';
  winningBid?: Bid;
  winningWorkerId?: string;
  winningWorkerName?: string;
  evaluatedBids: EvaluatedBid[];
  excludedIneligibleCount: number;
  message: string;
}

export interface WalletViewItem extends Wallet {
  agentName: string;
  agentRole: AgentRole;
}

export interface CanonicalAppState {
  task: Task | null;
  agents: Agent[];
  wallets: WalletViewItem[];
  transactions: Transaction[];
  escrow: Escrow | null;
  collateral: Collateral | null;
  buyerBond: BuyerBond | null;
  verificationResult: VerificationResult | null;
  clearingInstruction: SettlementInstruction | null;
  settlement: Settlement | null;
  evidence: Evidence | null;
  systemTotal: number;
  currentStage: string;
  currentStepIndex: number;
  steps: { stepIndex: number; stageName: string; description: string; status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'UNCERTAIN'; timestamp: string; }[];
  systemStatus: string;
  selectedWorkerId: string | null;
}
