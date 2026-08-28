import { UnderwritingService, WalletService, EscrowService, CollateralService, BuyerBondService, SettlementService } from './financial';
import { db } from './repository';

describe('Underwriting Service & FinancialTerms Persistence', () => {
  beforeEach(() => {
    db.reset();
  });

  it('should calculate and persist financial terms on task', async () => {
    const taskId = 'TASK-DEMO-1';
    const terms = await UnderwritingService.underwriteTask(taskId, 95); // High reputation

    expect(terms.taskValue).toBe(10000);
    expect(terms.safeExposure).toBe(9000);
    expect(terms.collateralRequirement).toBe(1000);
    expect(terms.buyerBondRequirement).toBe(500);
    expect(terms.riskFactor).toBe(0.1);

    const task = await db.getTask(taskId);
    expect(task?.financialTerms).toEqual(terms);
  });
});

describe('Wallet Service', () => {
  beforeEach(() => {
    db.reset();
  });

  it('should verify sufficient funds', async () => {
    await expect(WalletService.checkFunds('AGENT-BUYER-1', 1000)).resolves.toBe(true);
  });

  it('should throw INSUFFICIENT_FUNDS on lack of funds', async () => {
    await expect(WalletService.checkFunds('AGENT-BUYER-1', 1000000)).rejects.toThrow('INSUFFICIENT_FUNDS');
  });
});

describe('Downstream Authoritative Terms & Overrides', () => {
  const taskId = 'TASK-DEMO-1';
  const buyerId = 'AGENT-BUYER-1';
  const workerId = 'AGENT-WORKER-1';

  beforeEach(async () => {
    db.reset();
    await UnderwritingService.underwriteTask(taskId, 95); // taskValue=10000, collateral=1000, bond=500
  });

  it('should fund escrow using authoritative underwritten terms', async () => {
    const escrow = await EscrowService.fundEscrow(taskId, buyerId, 'escrow-lock-auth');
    expect(escrow.amount).toBe(10000); // Uses underwritten taskValue
    expect(escrow.status).toBe('LOCKED');

    const wallet = await db.getWalletByAgentId(buyerId);
    expect(wallet?.lockedBalance).toBe(10000);
    expect(wallet?.availableBalance).toBe(90000); // 100000 - 10000
  });

  it('should reject caller attempt to override escrow amount', async () => {
    await expect(EscrowService.fundEscrow(taskId, buyerId, 'escrow-override-fail', 5000))
      .rejects.toThrow('AUTHORITATIVE_TERMS_MISMATCH');
  });

  it('should lock collateral using authoritative underwritten terms', async () => {
    const collateral = await CollateralService.lockCollateral(taskId, workerId, 'col-lock-auth');
    expect(collateral.amount).toBe(1000); // Uses underwritten collateralRequirement
    expect(collateral.status).toBe('LOCKED');

    const wallet = await db.getWalletByAgentId(workerId);
    expect(wallet?.lockedBalance).toBe(1000);
    expect(wallet?.availableBalance).toBe(19000); // 20000 - 1000
  });

  it('should reject caller attempt to override collateral requirement', async () => {
    await expect(CollateralService.lockCollateral(taskId, workerId, 'col-override-fail', 9999))
      .rejects.toThrow('AUTHORITATIVE_TERMS_MISMATCH');
  });

  it('should lock buyer bond using authoritative underwritten terms', async () => {
    const bond = await BuyerBondService.lockBond(taskId, buyerId, 'bond-lock-auth');
    expect(bond.amount).toBe(500); // Uses underwritten buyerBondRequirement
    expect(bond.status).toBe('LOCKED');
  });
});

describe('Settlement Service, Buyer Bond & Financial Invariants', () => {
  const buyerId = 'AGENT-BUYER-1';
  const workerId = 'AGENT-WORKER-1';

  beforeEach(() => {
    db.reset();
  });

  it('PASS settlement: full task-value payout (safeExposure is risk metric, not payout cap) and buyer bond returned', async () => {
    const testTaskId = 'TASK-DEMO-1';
    await UnderwritingService.underwriteTask(testTaskId, 95); // safeExposure=9000, collateral=1000, bond=500

    await BuyerBondService.lockBond(testTaskId, buyerId, 'bond-pass');
    await EscrowService.fundEscrow(testTaskId, buyerId, 'fund-pass');
    await CollateralService.lockCollateral(testTaskId, workerId, 'col-pass');

    // Baseline total money check
    const totalBefore = (await db.getWalletByAgentId(buyerId))!.availableBalance + 
                        (await db.getWalletByAgentId(buyerId))!.lockedBalance + 
                        (await db.getWalletByAgentId(workerId))!.availableBalance + 
                        (await db.getWalletByAgentId(workerId))!.lockedBalance;

    // Settle PASS (quality 95)
    const settlement = await SettlementService.executeSettlement(testTaskId, 'PASS', 95, 'set-pass');

    // Full task payout (10000) despite safeExposure being 9000
    expect(settlement.workerAmount).toBe(10000);
    expect(settlement.collateralReturned).toBe(1000);
    expect(settlement.buyerBondReturned).toBe(500);
    expect(settlement.buyerRefund).toBe(0);

    const buyerWallet = await db.getWalletByAgentId(buyerId);
    const workerWallet = await db.getWalletByAgentId(workerId);

    // Initial 100000 - 500(bond) - 10000(escrow) = 89500 Avail, 10500 Locked.
    // Settlement: escrow 10000 paid to worker, bond 500 returned to buyer.
    // Final buyer: 89500 + 500 = 90000 Avail, 0 Locked.
    expect(buyerWallet?.availableBalance).toBe(90000);
    expect(buyerWallet?.lockedBalance).toBe(0);

    // Initial 20000 - 1000(col) = 19000 Avail, 1000 Locked.
    // Settlement: reward +10000, col return +1000.
    // Final worker: 19000 + 11000 = 30000 Avail, 0 Locked.
    expect(workerWallet?.availableBalance).toBe(30000);
    expect(workerWallet?.lockedBalance).toBe(0);

    // Balance conservation invariant
    const totalAfter = buyerWallet!.availableBalance + buyerWallet!.lockedBalance + 
                       workerWallet!.availableBalance + workerWallet!.lockedBalance;
    expect(totalAfter).toBe(totalBefore);

    // Duplicate settlement check (Idempotent)
    const duplicate = await SettlementService.executeSettlement(testTaskId, 'PASS', 95, 'set-pass');
    expect(duplicate.status).toBe('ALREADY_SETTLED');
  });

  it('DEFECTIVE settlement: buyer bond slashed to compensate worker and escrow refunded 80%', async () => {
    const testTaskId = 'TASK-DEMO-1';
    await UnderwritingService.underwriteTask(testTaskId, 95);

    await BuyerBondService.lockBond(testTaskId, buyerId, 'bond-def');
    await EscrowService.fundEscrow(testTaskId, buyerId, 'fund-def');
    await CollateralService.lockCollateral(testTaskId, workerId, 'col-def');

    const totalBefore = (await db.getWalletByAgentId(buyerId))!.availableBalance + 
                        (await db.getWalletByAgentId(buyerId))!.lockedBalance + 
                        (await db.getWalletByAgentId(workerId))!.availableBalance + 
                        (await db.getWalletByAgentId(workerId))!.lockedBalance;

    const settlement = await SettlementService.executeSettlement(testTaskId, 'DEFECTIVE', 0, 'set-def');

    expect(settlement.workerAmount).toBe(2000); // 20% of 10000 escrow
    expect(settlement.buyerRefund).toBe(8000);   // 80% of 10000 escrow
    expect(settlement.collateralReturned).toBe(1000); // Worker collateral returned (not worker's fault)
    expect(settlement.buyerBondSlashed).toBe(500); // Buyer bond slashed

    const buyerWallet = await db.getWalletByAgentId(buyerId);
    const workerWallet = await db.getWalletByAgentId(workerId);

    // Buyer: Initial 100k - 10k escrow - 500 bond = 89.5k. Refund 8k. Final Avail = 97.5k, Locked = 0.
    expect(buyerWallet?.availableBalance).toBe(97500);
    expect(buyerWallet?.lockedBalance).toBe(0);

    // Worker: Initial 20k - 1k col = 19k. Comp 2k + col 1k + bond slash 500 = 22.5k. Final Avail = 22.5k, Locked = 0.
    expect(workerWallet?.availableBalance).toBe(22500);
    expect(workerWallet?.lockedBalance).toBe(0);

    const totalAfter = buyerWallet!.availableBalance + buyerWallet!.lockedBalance + 
                       workerWallet!.availableBalance + workerWallet!.lockedBalance;
    expect(totalAfter).toBe(totalBefore);
  });

  it('FAIL settlement: escrow refunded and worker collateral slashed', async () => {
    const testTaskId = 'TASK-DEMO-1';
    await UnderwritingService.underwriteTask(testTaskId, 95);

    await EscrowService.fundEscrow(testTaskId, buyerId, 'fund-fail');
    await CollateralService.lockCollateral(testTaskId, workerId, 'col-fail');

    const settlement = await SettlementService.executeSettlement(testTaskId, 'FAIL', 30, 'set-fail');

    expect(settlement.workerAmount).toBe(0);
    expect(settlement.buyerRefund).toBe(10000);
    expect(settlement.collateralReturned).toBe(0);

    const buyerWallet = await db.getWalletByAgentId(buyerId);
    const workerWallet = await db.getWalletByAgentId(workerId);

    expect(buyerWallet?.availableBalance).toBe(100000);
    expect(workerWallet?.availableBalance).toBe(19000);
  });

  it('should prevent escrow funding without prior underwriting', async () => {
    const ununderwrittenTaskId = 'TASK-DEMO-2'; // clear financialTerms
    const task = await db.getTask(ununderwrittenTaskId);
    if (task) delete task.financialTerms;

    await expect(EscrowService.fundEscrow(ununderwrittenTaskId, buyerId, 'no-uw-key'))
      .rejects.toThrow('MISSING_FINANCIAL_TERMS');
  });
});
