import { db } from './repository';
import { DiscoveryService } from './discovery';
import { SelectionEngine } from './selection';
import { UnderwritingService, EscrowService, CollateralService, BuyerBondService, AssignmentService } from './financial';
import { ExecutionService } from './execution';
import { VerificationService } from './verification-service';
import { ClearingEngine } from './clearing';
import { SettlementService } from './settlement';
import { CapacityService } from './capacity';
import { VerificationResult, Task } from './types';
import { CommandInterpreter } from './interpreter';
import crypto from 'crypto';

export interface DemoStepEvent {
  stepIndex: number;
  stageName: string; 
  description: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'UNCERTAIN';
  timestamp: string;
}

export interface DemoRunState {
  currentStage: string;
  currentStepIndex: number;
  steps: DemoStepEvent[];
}

export class OrchestratorService {
  static getBaseSteps(): DemoStepEvent[] {
    return [
      { stepIndex: 1, stageName: 'DISCOVER', description: 'Technical capability discovery', status: 'PENDING', timestamp: '' },
      { stepIndex: 2, stageName: 'SELECT', description: 'Bidding & rank evaluation', status: 'PENDING', timestamp: '' },
      { stepIndex: 3, stageName: 'UNDERWRITE', description: 'Financial underwriting & risk assessment', status: 'PENDING', timestamp: '' },
      { stepIndex: 4, stageName: 'FUND', description: 'Escrow & collateral locking', status: 'PENDING', timestamp: '' },
      { stepIndex: 5, stageName: 'WORK', description: 'Task execution & evidence', status: 'PENDING', timestamp: '' },
      { stepIndex: 6, stageName: 'VERIFY', description: 'Deterministic verification', status: 'PENDING', timestamp: '' },
      { stepIndex: 7, stageName: 'CLEAR', description: 'Clearing decision', status: 'PENDING', timestamp: '' },
      { stepIndex: 8, stageName: 'SETTLE', description: 'Financial settlement', status: 'PENDING', timestamp: '' }
    ];
  }

  static async createDynamicTask(prompt: string): Promise<Task> {
    const intent = CommandInterpreter.parse(prompt);
    const dynamicId = `TASK-DYN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const buyerId = 'AGENT-BUYER-1';

    const task: Task = {
      id: dynamicId,
      buyerAgentId: buyerId,
      title: intent.title,
      description: intent.description,
      taskType: intent.taskType,
      specialization: intent.specialization,
      userPrompt: intent.rawPrompt,
      budget: intent.budget,
      qualityThreshold: intent.qualityThreshold,
      deadlineSeconds: intent.deadlineSeconds,
      status: 'CREATED',
      verificationPolicy: { preferred: 'deterministic' },
      createdAt: new Date().toISOString()
    };

    await db.createTask(task);
    
    // Underwrite dynamic task
    await UnderwritingService.underwriteTask(dynamicId, intent.qualityThreshold);
    
    // Run Discovery across full 75-agent registry
    await DiscoveryService.discoverWorkers(dynamicId, intent.capability);
    
    // Run Competitive Bidding & Selection
    await SelectionEngine.selectBestWorker(dynamicId);

    const updatedTask = (await db.getTask(dynamicId))!;
    const workerId = updatedTask.selectedWorkerId || 'AGENT-WORKER-1';

    // Lock Escrow, Buyer Bond, Worker Collateral and confirm Assignment
    await EscrowService.fundEscrow(dynamicId, buyerId, `escrow-${dynamicId}`);
    await BuyerBondService.lockBond(dynamicId, buyerId, `bond-${dynamicId}`);
    await CollateralService.lockCollateral(dynamicId, workerId, `col-${dynamicId}`);
    await AssignmentService.confirmAssignment(dynamicId);

    return (await db.getTask(dynamicId))!;
  }

  static async initializeDemo(demoType: 'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN'): Promise<DemoRunState> {
    db.reset();
    // Use demoType to prevent unused variable warning if we don't need it yet
    if (demoType) {
      // intentionally empty
    }
    return {
      currentStage: 'DISCOVERY',
      currentStepIndex: 0,
      steps: this.getBaseSteps()
    };
  }

  static async executeDemoStep(demoType: 'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN', stepIndex: number): Promise<DemoRunState> {
    const taskId = (demoType === 'BLIND_JURY' || demoType === 'UNCERTAIN') ? 'TASK-DEMO-2' : 'TASK-DEMO-1';
    const buyerId = 'AGENT-BUYER-1';
    
    // We fetch the current task to know workerId if needed
    const task = await db.getTask(taskId);
    const workerId = task?.selectedWorkerId || task?.assignedWorkerId || ((demoType === 'BLIND_JURY' || demoType === 'UNCERTAIN') ? 'AGENT-WORKER-2' : 'AGENT-WORKER-1');

    switch (stepIndex) {
      case 1:
        await DiscoveryService.discoverWorkers(taskId);
        break;
      case 2:
        await SelectionEngine.selectBestWorker(taskId);
        break;
      case 3:
        const risk = (demoType === 'BLIND_JURY' || demoType === 'UNCERTAIN') ? 90 : 95;
        await UnderwritingService.underwriteTask(taskId, risk);
        break;
      case 4:
        await EscrowService.fundEscrow(taskId, buyerId, `escrow-key-${demoType}`);
        await BuyerBondService.lockBond(taskId, buyerId, `bond-key-${demoType}`);
        break;
      case 5:
        await CollateralService.lockCollateral(taskId, workerId, `col-key-${demoType}`);
        break;
      case 6:
        await AssignmentService.confirmAssignment(taskId);
        break;
      case 7:
        if (demoType === 'FAILURE') {
          await ExecutionService.executeTask(taskId, workerId, 30); // 30% pass rate
          const evidence = await db.getEvidenceByTaskId(taskId);
          if (evidence) {
            evidence.outputHash = 'corrupted_bad_hash';
            evidence.evidencePayload = { ...evidence.evidencePayload, testResults: { total: 5, passed: 1, failed: 4, durationMs: 50 } };
            // Simulate db update if there was one, InMemory repo edits the object reference directly anyway.
          }
        } else {
          await ExecutionService.executeTask(taskId, workerId, 100);
        }
        break;
      case 8:
        // Evidence is created during ExecutionService, this step is just logical separation for the UI demo.
        break;
      case 9:
        if (demoType === 'UNCERTAIN') {
          // Manually mock the high disagreement
          const verificationResult: VerificationResult = {
            id: 'VERIF-UNCERT-1',
            taskId,
            routeType: 'BLIND_JURY',
            status: 'UNCERTAIN',
            score: 91,
            disagreementScore: 27.26,
            confidence: 'LOW',
            verificationCost: 500,
            evidenceUsed: ['EV-1'],
            verdict: 'UNCERTAIN',
            message: 'Evaluator disagreement too high (stdDev=27.26 > 15)',
            completedAt: new Date().toISOString()
          };
          await db.createVerificationResult(verificationResult);
        } else {
          await VerificationService.verifyTask(taskId);
        }
        break;
      case 10:
        const currentTask = (await db.getTask(taskId))!;
        const escrow = await db.getEscrow(taskId);
        const collateral = await db.getCollateralByTaskId(taskId);
        const buyerBond = await db.getBuyerBondByTaskId(taskId);
        const verificationResult = await db.getVerificationResultByTaskId(taskId);
        // ClearingEngine is synchronous
        if (verificationResult && escrow && buyerBond) {
          ClearingEngine.calculateInstruction(currentTask, verificationResult, escrow, collateral, buyerBond);
        }
        break;
      case 11:
        // Actually ClearingEngine modifies task state or we can just re-run it
        const t2 = await db.getTask(taskId);
        const e2 = await db.getEscrow(taskId);
        const c2 = await db.getCollateralByTaskId(taskId);
        const bb2 = await db.getBuyerBondByTaskId(taskId);
        const vr2 = await db.getVerificationResultByTaskId(taskId);
        if (t2 && e2 && bb2 && vr2) {
          const instruction = ClearingEngine.calculateInstruction(t2, vr2, e2, c2, bb2);
          if (demoType !== 'UNCERTAIN') {
             await SettlementService.executeInstruction(instruction, `settle-key-${demoType}`);
          }
        }
        break;
      case 12:
        const finalTask = await db.getTask(taskId);
        const finalVr = await db.getVerificationResultByTaskId(taskId);
        if (finalTask && finalVr && demoType !== 'UNCERTAIN') {
          await CapacityService.updateCapacity(finalTask, finalVr.verdict);
        }
        break;
    }

    // Map backend execution step to visual stage index (0-indexed)
    let visualIndex = 0;
    if (stepIndex === 1) visualIndex = 0; // DISCOVER
    else if (stepIndex === 2) visualIndex = 1; // SELECT
    else if (stepIndex === 3) visualIndex = 2; // UNDERWRITE
    else if (stepIndex === 4 || stepIndex === 5) visualIndex = 3; // FUND
    else if (stepIndex >= 6 && stepIndex <= 8) visualIndex = 4; // WORK
    else if (stepIndex === 9) visualIndex = 5; // VERIFY
    else if (stepIndex === 10) visualIndex = 6; // CLEAR
    else if (stepIndex === 11 || stepIndex === 12) visualIndex = 7; // SETTLE

    const steps = this.getBaseSteps();
    for (let i = 0; i < steps.length; i++) {
      if (i < visualIndex) {
        steps[i].status = 'COMPLETED';
        steps[i].timestamp = new Date().toISOString();
      } else if (i === visualIndex) {
        if (i === 5 && demoType === 'FAILURE') {
          steps[i].status = 'FAILED';
        } else if (i === 5 && demoType === 'UNCERTAIN') {
          steps[i].status = 'UNCERTAIN';
        } else if (i === 6 && demoType === 'FAILURE') {
          steps[i].status = 'FAILED';
        } else if (i === 6 && demoType === 'UNCERTAIN') {
          steps[i].status = 'UNCERTAIN';
        } else if (i === 7 && demoType === 'UNCERTAIN') {
          steps[i].status = 'UNCERTAIN';
        } else {
          // If we are still processing sub-steps (e.g. step 4 out of 5 for FUND), we keep it ACTIVE
          // But to be consistent with the simple UI model, we'll mark the CURRENT stage as COMPLETED 
          // only if it's the LAST sub-step for that stage. 
          // Actually, since UI loops through stepIndex, we can just mark it ACTIVE if we want, or COMPLETED.
          // Let's mark it COMPLETED if this is the final sub-step, otherwise ACTIVE.
          const isFinalSubStep = 
            (i === 3 && stepIndex === 5) ||
            (i === 4 && stepIndex === 8) ||
            (i === 7 && stepIndex === 12) ||
            (stepIndex === 1 || stepIndex === 2 || stepIndex === 3 || stepIndex === 9 || stepIndex === 10);
            
          steps[i].status = isFinalSubStep ? 'COMPLETED' : 'ACTIVE';
        }
        steps[i].timestamp = new Date().toISOString();
      }
    }

    return {
      currentStage: steps[visualIndex]?.stageName || 'SETTLE',
      currentStepIndex: stepIndex,
      steps
    };
  }

  static async resetDemo(): Promise<void> {
    db.reset();
  }
}
