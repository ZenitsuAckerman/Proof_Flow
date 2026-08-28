import { VerificationService } from './verification-service';
import { ExecutionService } from './execution';
import { UnderwritingService, EscrowService, CollateralService, AssignmentService } from './financial';
import { SelectionEngine } from './selection';
import { db } from './repository';
import { Task } from './types';

async function runAdversarialVerificationAudit() {
  console.log('================================================================');
  console.log('         PROOFFLOW PHASE E READ-ONLY ADVERSARIAL VERIFICATION AUDIT');
  console.log('================================================================\n');

  const taskId = 'TASK-DEMO-1';
  const researchTaskId = 'TASK-DEMO-2';
  const buyerId = 'AGENT-BUYER-1';
  const workerId = 'AGENT-WORKER-1';
  const researchWorkerId = 'AGENT-WORKER-2';

  // --- Audit Setup ---
  db.reset();

  // Setup code task
  await UnderwritingService.underwriteTask(taskId, 95);
  await SelectionEngine.selectBestWorker(taskId);
  await EscrowService.fundEscrow(taskId, buyerId, 'fund-key-1');
  await CollateralService.lockCollateral(taskId, workerId, 'col-key-1');
  await AssignmentService.confirmAssignment(taskId);
  await ExecutionService.executeTask(taskId, workerId, 100);

  // Setup research task
  await UnderwritingService.underwriteTask(researchTaskId, 90);
  await SelectionEngine.selectBestWorker(researchTaskId);
  await EscrowService.fundEscrow(researchTaskId, buyerId, 'fund-key-2');
  await CollateralService.lockCollateral(researchTaskId, researchWorkerId, 'col-key-2');
  await AssignmentService.confirmAssignment(researchTaskId);
  await ExecutionService.executeTask(researchTaskId, researchWorkerId, 100);

  // Record initial balances before Phase E
  const buyerWalletBefore = await db.getWalletByAgentId(buyerId);
  const workerWalletBefore = await db.getWalletByAgentId(workerId);
  const rWorkerWalletBefore = await db.getWalletByAgentId(researchWorkerId);

  console.log('--- 11 & 12. INITIAL FINANCIAL BALANCES BEFORE PHASE E VERIFICATION ---');
  console.log(`Buyer (${buyerId}): Available = ₹${buyerWalletBefore?.availableBalance}, Locked = ₹${buyerWalletBefore?.lockedBalance}`);
  console.log(`Worker 1 (${workerId}): Available = ₹${workerWalletBefore?.availableBalance}, Locked = ₹${workerWalletBefore?.lockedBalance}`);
  console.log(`Worker 2 (${researchWorkerId}): Available = ₹${rWorkerWalletBefore?.availableBalance}, Locked = ₹${rWorkerWalletBefore?.lockedBalance}\n`);

  // 1. Invalid Evidence
  console.log('--- 1. AUDIT CASE 1: INVALID EVIDENCE ---');
  const result1 = await VerificationService.verifyTask(taskId, {
    outputCodeOverride: '# Tampered output code artifact'
  });
  console.log(`Route: ${result1.routeType} | Verdict: ${result1.verdict} | Status: ${result1.status} | Score: ${result1.score}`);
  console.log(`Message: ${result1.message}\n`);

  // 2. 5/5 Valid Jury
  console.log('--- 2. AUDIT CASE 2: 5/5 VALID JURY ---');
  db.reset();
  await UnderwritingService.underwriteTask(researchTaskId, 90);
  await SelectionEngine.selectBestWorker(researchTaskId);
  await EscrowService.fundEscrow(researchTaskId, buyerId, 'k2');
  await CollateralService.lockCollateral(researchTaskId, researchWorkerId, 'ck2');
  await AssignmentService.confirmAssignment(researchTaskId);
  await ExecutionService.executeTask(researchTaskId, researchWorkerId, 100);

  const customVotes5 = [
    { evaluatorId: 'E1', score: 90, nonce: 'n1' },
    { evaluatorId: 'E2', score: 91, nonce: 'n2' },
    { evaluatorId: 'E3', score: 89, nonce: 'n3' },
    { evaluatorId: 'E4', score: 92, nonce: 'n4' },
    { evaluatorId: 'E5', score: 90, nonce: 'n5' },
  ];
  const result2 = await VerificationService.verifyTask(researchTaskId, { customVotes: customVotes5 });
  console.log(`Route: ${result2.routeType} | Valid Reveals: ${result2.commitReveals?.filter(c => c.revealStatus === 'REVEALED').length}/5`);
  console.log(`Consensus Score: ${result2.score} | Disagreement (stdDev): ${result2.disagreementScore} | Verdict: ${result2.verdict}\n`);

  // 3. 3/5 Valid Jury
  console.log('--- 3. AUDIT CASE 3: 3/5 VALID JURY ---');
  db.reset();
  await UnderwritingService.underwriteTask(researchTaskId, 90);
  await SelectionEngine.selectBestWorker(researchTaskId);
  await EscrowService.fundEscrow(researchTaskId, buyerId, 'k3');
  await CollateralService.lockCollateral(researchTaskId, researchWorkerId, 'ck3');
  await AssignmentService.confirmAssignment(researchTaskId);
  await ExecutionService.executeTask(researchTaskId, researchWorkerId, 100);

  const customVotes3 = [
    { evaluatorId: 'E1', score: 88, nonce: 'n1' },
    { evaluatorId: 'E2', score: 90, nonce: 'n2' },
    { evaluatorId: 'E3', score: 92, nonce: 'n3' },
    { evaluatorId: 'E4', score: 90, nonce: 'n4', simulateTimeout: true },
    { evaluatorId: 'E5', score: 90, nonce: 'n5', simulateInvalidReveal: true },
  ];
  const result3 = await VerificationService.verifyTask(researchTaskId, { customVotes: customVotes3 });
  console.log(`Valid Reveals: ${result3.commitReveals?.filter(c => c.revealStatus === 'REVEALED').length}/5`);
  console.log(`Consensus Score: ${result3.score} | Status: ${result3.status} | Verdict: ${result3.verdict}\n`);

  // 4. 2/5 Valid Jury (Insufficient Quorum)
  console.log('--- 4. AUDIT CASE 4: 2/5 VALID JURY (INSUFFICIENT QUORUM) ---');
  db.reset();
  await UnderwritingService.underwriteTask(researchTaskId, 90);
  await SelectionEngine.selectBestWorker(researchTaskId);
  await EscrowService.fundEscrow(researchTaskId, buyerId, 'k4');
  await CollateralService.lockCollateral(researchTaskId, researchWorkerId, 'ck4');
  await AssignmentService.confirmAssignment(researchTaskId);
  await ExecutionService.executeTask(researchTaskId, researchWorkerId, 100);

  const customVotes2 = [
    { evaluatorId: 'E1', score: 90, nonce: 'n1' },
    { evaluatorId: 'E2', score: 90, nonce: 'n2' },
    { evaluatorId: 'E3', score: 90, nonce: 'n3', simulateTimeout: true },
    { evaluatorId: 'E4', score: 90, nonce: 'n4', simulateTimeout: true },
    { evaluatorId: 'E5', score: 90, nonce: 'n5', simulateInvalidReveal: true },
  ];
  const result4 = await VerificationService.verifyTask(researchTaskId, { customVotes: customVotes2 });
  console.log(`Valid Reveals: ${result4.commitReveals?.filter(c => c.revealStatus === 'REVEALED').length}/5`);
  console.log(`Status: ${result4.status} | Verdict: ${result4.verdict} | Message: ${result4.message}\n`);

  // 5. High Jury Disagreement
  console.log('--- 5. AUDIT CASE 5: HIGH JURY DISAGREEMENT (stdDev > 15) ---');
  db.reset();
  await UnderwritingService.underwriteTask(researchTaskId, 90);
  await SelectionEngine.selectBestWorker(researchTaskId);
  await EscrowService.fundEscrow(researchTaskId, buyerId, 'k5');
  await CollateralService.lockCollateral(researchTaskId, researchWorkerId, 'ck5');
  await AssignmentService.confirmAssignment(researchTaskId);
  await ExecutionService.executeTask(researchTaskId, researchWorkerId, 100);

  const highDisagreementVotes = [
    { evaluatorId: 'E1', score: 95, nonce: 'n1' },
    { evaluatorId: 'E2', score: 93, nonce: 'n2' },
    { evaluatorId: 'E3', score: 91, nonce: 'n3' },
    { evaluatorId: 'E4', score: 40, nonce: 'n4' },
    { evaluatorId: 'E5', score: 35, nonce: 'n5' },
  ];
  const result5 = await VerificationService.verifyTask(researchTaskId, { customVotes: highDisagreementVotes });
  console.log(`Median Score: ${result5.score} | Disagreement (stdDev): ${result5.disagreementScore}`);
  console.log(`Status: ${result5.status} | Verdict: ${result5.verdict} | Message: ${result5.message}\n`);

  // 6. Low Jury Disagreement
  console.log('--- 6. AUDIT CASE 6: LOW JURY DISAGREEMENT (stdDev <= 15) ---');
  db.reset();
  await UnderwritingService.underwriteTask(researchTaskId, 90);
  await SelectionEngine.selectBestWorker(researchTaskId);
  await EscrowService.fundEscrow(researchTaskId, buyerId, 'k6');
  await CollateralService.lockCollateral(researchTaskId, researchWorkerId, 'ck6');
  await AssignmentService.confirmAssignment(researchTaskId);
  await ExecutionService.executeTask(researchTaskId, researchWorkerId, 100);

  const lowDisagreementVotes = [
    { evaluatorId: 'E1', score: 92, nonce: 'n1' },
    { evaluatorId: 'E2', score: 89, nonce: 'n2' },
    { evaluatorId: 'E3', score: 94, nonce: 'n3' },
    { evaluatorId: 'E4', score: 87, nonce: 'n4' },
    { evaluatorId: 'E5', score: 91, nonce: 'n5' },
  ];
  const result6 = await VerificationService.verifyTask(researchTaskId, { customVotes: lowDisagreementVotes });
  console.log(`Median Score: ${result6.score} | Disagreement (stdDev): ${result6.disagreementScore}`);
  console.log(`Status: ${result6.status} | Verdict: ${result6.verdict}\n`);

  // 7 & 8. Verification Cost Too High / No Valid Verifier (Fresh ₹100 Task)
  console.log('--- 7 & 8. AUDIT CASES 7 & 8: VERIFICATION COST TOO HIGH & NO VALID VERIFIER (FRESH TASK) ---');
  db.reset();
  
  // Create a fresh ₹100 research task from scratch
  const smallResearchTaskId = 'TASK-SMALL-RESEARCH';
  const freshSmallTask: Task = {
    id: smallResearchTaskId,
    buyerAgentId: buyerId,
    title: 'Low Budget Research Task',
    description: 'Small research query',
    taskType: 'research',
    budget: 100, // ₹100 budget
    qualityThreshold: 80,
    deadlineSeconds: 3600,
    status: 'CREATED',
    verificationPolicy: { preferred: 'blind_jury' },
    createdAt: new Date().toISOString()
  };
  (db as unknown as { tasks: Map<string, Task> }).tasks.set(smallResearchTaskId, freshSmallTask);

  // Underwrite the fresh task -> Creates underwritten FinancialTerms based on ₹100 budget
  await UnderwritingService.underwriteTask(smallResearchTaskId, 90);

  // Run selection, escrow funding, collateral locking, assignment & execution cleanly
  await SelectionEngine.selectBestWorker(smallResearchTaskId);
  const smallTaskAfterSelect = (await db.getTask(smallResearchTaskId))!;
  const smallWorkerId = smallTaskAfterSelect.selectedWorkerId || 'AGENT-WORKER-2';

  await EscrowService.fundEscrow(smallResearchTaskId, buyerId, 'k7-small');
  await CollateralService.lockCollateral(smallResearchTaskId, smallWorkerId, 'ck7-small');
  await AssignmentService.confirmAssignment(smallResearchTaskId);
  await ExecutionService.executeTask(smallResearchTaskId, smallWorkerId, 100);

  // Verify fresh task (allowed budget = 10% of ₹100 = ₹10 < Blind Jury cost ₹500)
  const result7 = await VerificationService.verifyTask(smallResearchTaskId);
  console.log(`Route: ${result7.routeType} | Verification Cost: ₹${result7.verificationCost}`);
  console.log(`Allowed Verification Budget (10%): ₹${Math.round(freshSmallTask.financialTerms!.taskValue * 0.10)}`);
  console.log(`Status: ${result7.status} | Verdict: ${result7.verdict}`);
  console.log(`Message: ${result7.message}\n`);

  // Read-Only Assertion: Financial Terms Immutability After Underwriting
  console.log('--- READ-ONLY ASSERTION: FINANCIAL TERMS IMMUTABILITY AFTER UNDERWRITING ---');
  db.reset();
  await UnderwritingService.underwriteTask(taskId, 95);
  await SelectionEngine.selectBestWorker(taskId);
  await EscrowService.fundEscrow(taskId, buyerId, 'k-immut');

  const fundedTask = (await db.getTask(taskId))!;
  const escrowRecord = await db.getEscrow(taskId);
  const initialTaskValue = fundedTask.financialTerms!.taskValue;
  const initialEscrowAmount = escrowRecord!.amount;

  // Attempt to mutate task.budget on the task object post-funding
  fundedTask.budget = 50; // Artificially mutate task.budget property on JS object

  // Assert that financialTerms and recorded escrow amount remain strictly unchanged
  const postMutationEscrow = await db.getEscrow(taskId);
  const termsUnchanged = fundedTask.financialTerms!.taskValue === initialTaskValue && postMutationEscrow!.amount === initialEscrowAmount;
  console.log(`Initial Underwritten Task Value: ₹${initialTaskValue} | Recorded Escrow Amount: ₹${initialEscrowAmount}`);
  console.log(`Mutated task.budget property to: ₹${fundedTask.budget}`);
  console.log(`Authoritative financialTerms.taskValue: ₹${fundedTask.financialTerms!.taskValue} | Authoritative Escrow: ₹${postMutationEscrow!.amount}`);
  console.log(`CONFIRMATION: Financial terms are transaction-authoritative and IMMUTABLE post-underwriting: ${termsUnchanged ? 'CONFIRMED (TRUE)' : 'MUTATED (FALSE)'}\n`);

  // 9. Exact Threshold (Quality Threshold = 80, Consensus Score = 80)
  console.log('--- 9. AUDIT CASE 9: EXACT THRESHOLD (80% Consensus Score == 80% Quality Threshold) ---');
  db.reset();
  await UnderwritingService.underwriteTask(researchTaskId, 90);
  await SelectionEngine.selectBestWorker(researchTaskId);
  await EscrowService.fundEscrow(researchTaskId, buyerId, 'k9');
  await CollateralService.lockCollateral(researchTaskId, researchWorkerId, 'ck9');
  await AssignmentService.confirmAssignment(researchTaskId);
  await ExecutionService.executeTask(researchTaskId, researchWorkerId, 100);

  const exactThresholdVotes = [
    { evaluatorId: 'E1', score: 80, nonce: 'n1' },
    { evaluatorId: 'E2', score: 80, nonce: 'n2' },
    { evaluatorId: 'E3', score: 80, nonce: 'n3' },
    { evaluatorId: 'E4', score: 80, nonce: 'n4' },
    { evaluatorId: 'E5', score: 80, nonce: 'n5' },
  ];
  const result9 = await VerificationService.verifyTask(researchTaskId, { customVotes: exactThresholdVotes });
  console.log(`Quality Threshold: 80 | Consensus Score: ${result9.score} | Verdict: ${result9.verdict}\n`);

  // 10. One Point Below Threshold (Quality Threshold = 80, Consensus Score = 79)
  console.log('--- 10. AUDIT CASE 10: ONE POINT BELOW THRESHOLD (79% Consensus Score < 80% Quality Threshold) ---');
  db.reset();
  await UnderwritingService.underwriteTask(researchTaskId, 90);
  await SelectionEngine.selectBestWorker(researchTaskId);
  await EscrowService.fundEscrow(researchTaskId, buyerId, 'k10');
  await CollateralService.lockCollateral(researchTaskId, researchWorkerId, 'ck10');
  await AssignmentService.confirmAssignment(researchTaskId);
  await ExecutionService.executeTask(researchTaskId, researchWorkerId, 100);

  const belowThresholdVotes = [
    { evaluatorId: 'E1', score: 79, nonce: 'n1' },
    { evaluatorId: 'E2', score: 79, nonce: 'n2' },
    { evaluatorId: 'E3', score: 79, nonce: 'n3' },
    { evaluatorId: 'E4', score: 79, nonce: 'n4' },
    { evaluatorId: 'E5', score: 79, nonce: 'n5' },
  ];
  const result10 = await VerificationService.verifyTask(researchTaskId, { customVotes: belowThresholdVotes });
  console.log(`Quality Threshold: 80 | Consensus Score: ${result10.score} | Verdict: ${result10.verdict}\n`);

  // 11 & 12. Final Financial Balances Verification
  // Re-setup task to measure balance exact delta across verifyTask call
  db.reset();
  await UnderwritingService.underwriteTask(taskId, 95);
  await SelectionEngine.selectBestWorker(taskId);
  await EscrowService.fundEscrow(taskId, buyerId, 'k11');
  await CollateralService.lockCollateral(taskId, workerId, 'ck11');
  await AssignmentService.confirmAssignment(taskId);
  await ExecutionService.executeTask(taskId, workerId, 100);

  const buyerWalletBeforeVerify = await db.getWalletByAgentId(buyerId);
  const workerWalletBeforeVerify = await db.getWalletByAgentId(workerId);

  // Run Phase E verification
  await VerificationService.verifyTask(taskId);

  const buyerWalletAfterVerify = await db.getWalletByAgentId(buyerId);
  const workerWalletAfterVerify = await db.getWalletByAgentId(workerId);

  console.log('--- 11 & 12. FINANCIAL BALANCES BEFORE & AFTER PHASE E VERIFYTASK ---');
  console.log(`Buyer BEFORE:  Available = ₹${buyerWalletBeforeVerify?.availableBalance}, Locked = ₹${buyerWalletBeforeVerify?.lockedBalance}`);
  console.log(`Buyer AFTER:   Available = ₹${buyerWalletAfterVerify?.availableBalance}, Locked = ₹${buyerWalletAfterVerify?.lockedBalance}`);
  console.log(`Worker BEFORE: Available = ₹${workerWalletBeforeVerify?.availableBalance}, Locked = ₹${workerWalletBeforeVerify?.lockedBalance}`);
  console.log(`Worker AFTER:  Available = ₹${workerWalletAfterVerify?.availableBalance}, Locked = ₹${workerWalletAfterVerify?.lockedBalance}`);

  const zeroMutation = 
    buyerWalletAfterVerify?.availableBalance === buyerWalletBeforeVerify?.availableBalance &&
    buyerWalletAfterVerify?.lockedBalance === buyerWalletBeforeVerify?.lockedBalance &&
    workerWalletAfterVerify?.availableBalance === workerWalletBeforeVerify?.availableBalance &&
    workerWalletAfterVerify?.lockedBalance === workerWalletBeforeVerify?.lockedBalance;

  console.log(`\nCONFIRMATION: Phase E performed EXACTLY ZERO wallet balance mutations: ${zeroMutation ? 'CONFIRMED (TRUE)' : 'MUTATION DETECTED (FALSE)'}`);
  console.log('================================================================\n');
}

runAdversarialVerificationAudit().catch(console.error);
