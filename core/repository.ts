import { Agent, Task, Wallet, Escrow, Collateral, Transaction, BuyerBond, Settlement, FinancialTerms, Evidence, VerificationResult } from './types';
import { seedAgents, seedTasks, seedWallets } from './mock-data';
import crypto from 'crypto';

/**
 * ProofFlow Data Repository Interface
 * Abstracts the underlying data store (in-memory mock vs Supabase)
 */
export interface ProofFlowRepository {
  // Agents
  getAgent(id: string): Promise<Agent | null>;
  listAgents(): Promise<Agent[]>;
  
  // Wallets
  getWallet(id: string): Promise<Wallet | null>;
  getWalletByAgentId(agentId: string): Promise<Wallet | null>;
  updateWalletBalances(id: string, availableDelta: number, lockedDelta: number): Promise<Wallet>;

  // Tasks
  getTask(id: string): Promise<Task | null>;
  listTasks(): Promise<Task[]>;
  updateTaskStatus(id: string, status: Task['status']): Promise<Task>;
  updateTaskFinancialTerms(taskId: string, terms: FinancialTerms): Promise<Task>;
  
  // Financial & Execution States
  createEscrow(escrow: Escrow): Promise<Escrow>;
  getEscrow(taskId: string): Promise<Escrow | null>;
  
  createCollateral(collateral: Collateral): Promise<Collateral>;
  getCollateralByTaskId(taskId: string): Promise<Collateral | null>;

  getBuyerBondByTaskId(taskId: string): Promise<BuyerBond | null>;
  
  createTransaction(tx: Transaction): Promise<Transaction>;

  // Evidence & Execution
  createEvidence(evidence: Evidence): Promise<Evidence>;
  getEvidenceByTaskId(taskId: string): Promise<Evidence | null>;

  // Verification
  createVerificationResult(result: VerificationResult): Promise<VerificationResult>;
  getVerificationResultByTaskId(taskId: string): Promise<VerificationResult | null>;

  executeAtomicFunding(taskId: string, buyerAgentId: string, amount: number, idempotencyKey: string): Promise<Escrow>;
  executeAtomicRefund(taskId: string, idempotencyKey: string): Promise<void>;
  executeAtomicCollateralLock(taskId: string, workerAgentId: string, amount: number, idempotencyKey: string): Promise<Collateral>;
  executeAtomicBuyerBondLock(taskId: string, buyerAgentId: string, amount: number, idempotencyKey: string): Promise<BuyerBond>;
  getSettlementByTaskId(taskId: string): Promise<Settlement | null>;
  executeAtomicSettlement(settlement: Settlement, idempotencyKey: string): Promise<Settlement>;
  reset(): void;
}

/**
 * In-Memory Mock Repository for Hackathon Phase A / Fallback
 */
export class InMemoryRepository implements ProofFlowRepository {
  private agents = new Map<string, Agent>();
  private wallets = new Map<string, Wallet>();
  private tasks = new Map<string, Task>();
  private escrows = new Map<string, Escrow>();
  private collaterals = new Map<string, Collateral>();
  private buyerBonds = new Map<string, BuyerBond>();
  private transactions = new Map<string, Transaction>();
  private settlements = new Map<string, Settlement>();
  private evidences = new Map<string, Evidence>();
  private verificationResults = new Map<string, VerificationResult>();

  constructor() {
    this.seed();
  }

  reset(): void {
    this.agents.clear();
    this.wallets.clear();
    this.tasks.clear();
    this.escrows.clear();
    this.collaterals.clear();
    this.buyerBonds.clear();
    this.transactions.clear();
    this.settlements.clear();
    this.evidences.clear();
    this.verificationResults.clear();
    this.seed();
  }

  private seed() {
    seedAgents.forEach(a => this.agents.set(a.id, { ...a }));
    seedWallets.forEach(w => this.wallets.set(w.id, { ...w }));
    seedTasks.forEach(t => this.tasks.set(t.id, { ...t }));
  }

  async getAgent(id: string): Promise<Agent | null> {
    return this.agents.get(id) || null;
  }

  async listAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async getWallet(id: string): Promise<Wallet | null> {
    return this.wallets.get(id) || null;
  }

  async getWalletByAgentId(agentId: string): Promise<Wallet | null> {
    const w = Array.from(this.wallets.values()).find(w => w.agentId === agentId);
    return w || null;
  }

  async updateWalletBalances(id: string, availableDelta: number, lockedDelta: number): Promise<Wallet> {
    const wallet = this.wallets.get(id);
    if (!wallet) throw new Error(`Wallet ${id} not found`);
    
    // Check against negative balance
    if (wallet.availableBalance + availableDelta < 0) {
      throw new Error(`INSUFFICIENT_FUNDS: Wallet ${id} cannot have negative available balance`);
    }
    
    wallet.availableBalance += availableDelta;
    wallet.lockedBalance += lockedDelta;
    wallet.updatedAt = new Date().toISOString();
    return wallet;
  }

  async getTask(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async listTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async updateTaskStatus(id: string, status: Task['status']): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task ${id} not found`);
    task.status = status;
    return task;
  }

  async updateTaskFinancialTerms(taskId: string, terms: FinancialTerms): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.financialTerms = terms;
    return task;
  }

  async getBuyerBondByTaskId(taskId: string): Promise<BuyerBond | null> {
    return Array.from(this.buyerBonds.values()).find(b => b.taskId === taskId) || null;
  }

  async createEscrow(escrow: Escrow): Promise<Escrow> {
    this.escrows.set(escrow.taskId, escrow); // Simplified constraint for 1-1
    return escrow;
  }

  async getEscrow(taskId: string): Promise<Escrow | null> {
    return this.escrows.get(taskId) || null;
  }

  async createCollateral(collateral: Collateral): Promise<Collateral> {
    this.collaterals.set(collateral.id, collateral);
    return collateral;
  }

  async getCollateralByTaskId(taskId: string): Promise<Collateral | null> {
    const col = Array.from(this.collaterals.values()).find(c => c.taskId === taskId);
    return col || null;
  }

  async createTransaction(tx: Transaction): Promise<Transaction> {
    this.transactions.set(tx.id, tx);
    return tx;
  }

  async createEvidence(evidence: Evidence): Promise<Evidence> {
    this.evidences.set(evidence.taskId, evidence);
    return evidence;
  }

  async getEvidenceByTaskId(taskId: string): Promise<Evidence | null> {
    return this.evidences.get(taskId) || null;
  }

  async createVerificationResult(result: VerificationResult): Promise<VerificationResult> {
    this.verificationResults.set(result.taskId, result);
    return result;
  }

  async getVerificationResultByTaskId(taskId: string): Promise<VerificationResult | null> {
    return this.verificationResults.get(taskId) || null;
  }

  // --- Atomic Financial Operations ---
  // In a real system, these would use DB transactions.
  
  async executeAtomicFunding(taskId: string, buyerAgentId: string, amount: number, idempotencyKey: string): Promise<Escrow> {
    // Idempotency check
    const existingTx = Array.from(this.transactions.values()).find(t => t.idempotencyKey === idempotencyKey);
    if (existingTx) {
      const existingEscrow = this.escrows.get(taskId);
      if (existingEscrow) return existingEscrow;
    }

    const wallet = await this.getWalletByAgentId(buyerAgentId);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.availableBalance < amount) throw new Error('INSUFFICIENT_FUNDS');

    // Mutate state synchronously to simulate atomicity
    wallet.availableBalance -= amount;
    wallet.lockedBalance += amount;

    const escrow: Escrow = {
      id: crypto.randomUUID(),
      taskId,
      amount,
      status: 'LOCKED',
      createdAt: new Date().toISOString()
    };
    this.escrows.set(taskId, escrow);

    const tx: Transaction = {
      id: crypto.randomUUID(),
      taskId,
      fromWalletId: wallet.id,
      amount,
      transactionType: 'ESCROW_FUND',
      idempotencyKey,
      createdAt: new Date().toISOString()
    };
    this.transactions.set(tx.id, tx);

    return escrow;
  }

  async executeAtomicRefund(taskId: string, idempotencyKey: string): Promise<void> {
    const existingTx = Array.from(this.transactions.values()).find(t => t.idempotencyKey === idempotencyKey);
    if (existingTx) return;

    const escrow = this.escrows.get(taskId);
    if (!escrow || escrow.status !== 'LOCKED') throw new Error('Escrow not locked or missing');

    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    const wallet = await this.getWalletByAgentId(task.buyerAgentId);
    if (!wallet) throw new Error('Wallet not found');

    // Refund
    escrow.status = 'REFUNDED';
    escrow.releasedAt = new Date().toISOString();
    
    wallet.lockedBalance -= escrow.amount;
    wallet.availableBalance += escrow.amount;

    const tx: Transaction = {
      id: crypto.randomUUID(),
      taskId,
      toWalletId: wallet.id,
      amount: escrow.amount,
      transactionType: 'REFUND',
      idempotencyKey,
      createdAt: new Date().toISOString()
    };
    this.transactions.set(tx.id, tx);
  }

  async executeAtomicCollateralLock(taskId: string, workerAgentId: string, amount: number, idempotencyKey: string): Promise<Collateral> {
    const existingTx = Array.from(this.transactions.values()).find(t => t.idempotencyKey === idempotencyKey);
    if (existingTx) {
      const existingCol = Array.from(this.collaterals.values()).find(c => c.taskId === taskId && c.agentId === workerAgentId);
      if (existingCol) return existingCol;
    }

    const wallet = await this.getWalletByAgentId(workerAgentId);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.availableBalance < amount) throw new Error('INSUFFICIENT_FUNDS');

    wallet.availableBalance -= amount;
    wallet.lockedBalance += amount;

    const col: Collateral = {
      id: crypto.randomUUID(),
      taskId,
      agentId: workerAgentId,
      amount,
      status: 'LOCKED'
    };
    this.collaterals.set(col.id, col);

    const tx: Transaction = {
      id: crypto.randomUUID(),
      taskId,
      fromWalletId: wallet.id,
      amount,
      transactionType: 'COLLATERAL_LOCK',
      idempotencyKey,
      createdAt: new Date().toISOString()
    };
    this.transactions.set(tx.id, tx);
    return col;
  }

  async executeAtomicBuyerBondLock(taskId: string, buyerAgentId: string, amount: number, idempotencyKey: string): Promise<BuyerBond> {
    const existingTx = Array.from(this.transactions.values()).find(t => t.idempotencyKey === idempotencyKey);
    if (existingTx) {
      const existingBond = Array.from(this.buyerBonds.values()).find(b => b.taskId === taskId && b.status === 'LOCKED');
      if (existingBond) return existingBond;
    }

    const wallet = await this.getWalletByAgentId(buyerAgentId);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.availableBalance < amount) throw new Error('INSUFFICIENT_FUNDS');

    wallet.availableBalance -= amount;
    wallet.lockedBalance += amount;

    const bond: BuyerBond = {
      id: crypto.randomUUID(),
      taskId,
      amount,
      status: 'LOCKED'
    };
    this.buyerBonds.set(bond.id, bond);

    const tx: Transaction = {
      id: crypto.randomUUID(),
      taskId,
      fromWalletId: wallet.id,
      amount,
      transactionType: 'BOND_LOCK',
      idempotencyKey,
      createdAt: new Date().toISOString()
    };
    this.transactions.set(tx.id, tx);
    return bond;
  }

  async getSettlementByTaskId(taskId: string): Promise<Settlement | null> {
    return Array.from(this.settlements.values()).find(s => s.taskId === taskId) || null;
  }

  async listTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }

  async executeAtomicSettlement(settlement: Settlement, idempotencyKey: string): Promise<Settlement> {
    const existingTx = Array.from(this.transactions.values()).find(t => t.idempotencyKey === idempotencyKey);
    if (existingTx) {
      const existing = await this.getSettlementByTaskId(settlement.taskId);
      if (existing) return { ...existing, status: 'ALREADY_SETTLED' };
    }

    const task = this.tasks.get(settlement.taskId);
    const escrow = this.escrows.get(settlement.taskId);
    const collateral = Array.from(this.collaterals.values()).find(c => c.taskId === settlement.taskId);

    if (!task || !escrow || escrow.status !== 'LOCKED') throw new Error('Invalid state for settlement');

    const buyerWallet = await this.getWalletByAgentId(task.buyerAgentId);
    const workerWallet = collateral ? await this.getWalletByAgentId(collateral.agentId) : null;

    if (!buyerWallet) throw new Error('Buyer wallet not found');

    // 1. Resolve Escrow
    escrow.status = 'RELEASED';
    buyerWallet.lockedBalance -= escrow.amount; // Unlock buyer's escrow funds
    
    if (settlement.workerAmount > 0 && workerWallet) {
      workerWallet.availableBalance += settlement.workerAmount;
      this.transactions.set(crypto.randomUUID(), {
        id: crypto.randomUUID(), taskId: task.id, toWalletId: workerWallet.id,
        amount: settlement.workerAmount, transactionType: 'WORKER_REWARD',
        idempotencyKey: idempotencyKey + '-reward', createdAt: new Date().toISOString()
      });
    }

    if (settlement.buyerRefund > 0) {
      buyerWallet.availableBalance += settlement.buyerRefund;
      this.transactions.set(crypto.randomUUID(), {
        id: crypto.randomUUID(), taskId: task.id, toWalletId: buyerWallet.id,
        amount: settlement.buyerRefund, transactionType: 'REFUND',
        idempotencyKey: idempotencyKey + '-refund', createdAt: new Date().toISOString()
      });
    }

    // 2. Resolve Collateral
    if (collateral && workerWallet) {
      if (collateral.status !== 'LOCKED') throw new Error('Collateral not locked');
      
      workerWallet.lockedBalance -= collateral.amount;
      const returnedAmount = settlement.collateralReturned || 0;
      const slashedAmount = settlement.collateralSlashed !== undefined ? settlement.collateralSlashed : (returnedAmount > 0 ? 0 : collateral.amount);

      if (returnedAmount > 0) {
        workerWallet.availableBalance += returnedAmount;
        this.transactions.set(crypto.randomUUID(), {
          id: crypto.randomUUID(), taskId: task.id, toWalletId: workerWallet.id,
          amount: returnedAmount, transactionType: 'COLLATERAL_RETURN',
          idempotencyKey: idempotencyKey + '-col-return', createdAt: new Date().toISOString()
        });
      }

      if (slashedAmount > 0) {
        collateral.status = 'SLASHED';
        collateral.penaltyAmount = slashedAmount;
        const protocolWallet = Array.from(this.wallets.values()).find(w => w.agentId === 'PROTOCOL-TREASURY');
        if (protocolWallet) {
          protocolWallet.availableBalance += slashedAmount;
        }
        this.transactions.set(crypto.randomUUID(), {
          id: crypto.randomUUID(), taskId: task.id, fromWalletId: workerWallet.id,
          toWalletId: protocolWallet ? protocolWallet.id : undefined,
          amount: slashedAmount, transactionType: 'PENALTY_SLASH',
          idempotencyKey: idempotencyKey + '-col-slash', createdAt: new Date().toISOString()
        });
      } else {
        collateral.status = 'RETURNED';
      }
    }

    // 3. Resolve Buyer Bond
    const buyerBond = Array.from(this.buyerBonds.values()).find(b => b.taskId === settlement.taskId && b.status === 'LOCKED');
    if (buyerBond && buyerWallet) {
      buyerWallet.lockedBalance -= buyerBond.amount;
      if (settlement.buyerBondSlashed && settlement.buyerBondSlashed > 0) {
        buyerBond.status = 'SLASHED';
        if (workerWallet) {
          workerWallet.availableBalance += settlement.buyerBondSlashed;
          this.transactions.set(crypto.randomUUID(), {
            id: crypto.randomUUID(), taskId: task.id, toWalletId: workerWallet.id,
            amount: settlement.buyerBondSlashed, transactionType: 'WORKER_REWARD',
            idempotencyKey: idempotencyKey + '-bond-slash', createdAt: new Date().toISOString()
          });
        }
      } else {
        buyerBond.status = 'RETURNED';
        buyerWallet.availableBalance += buyerBond.amount;
        settlement.buyerBondReturned = buyerBond.amount;
        this.transactions.set(crypto.randomUUID(), {
          id: crypto.randomUUID(), taskId: task.id, toWalletId: buyerWallet.id,
          amount: buyerBond.amount, transactionType: 'REFUND',
          idempotencyKey: idempotencyKey + '-bond-return', createdAt: new Date().toISOString()
        });
      }
    }

    // 4. Mark Settlement Complete
    settlement.status = 'SETTLED';
    settlement.settledAt = new Date().toISOString();
    this.settlements.set(settlement.id, settlement);

    return settlement;
  }
}

// Global instance for simple usage across server actions
export const db = new InMemoryRepository();
