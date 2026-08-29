'use client';

import React, { useState, useEffect } from 'react';
import { getAppStateAction, initializeDemoAction, executeDemoStepAction, resetDemoAction, submitDynamicTaskAction, executeDynamicWorkStepAction, executeDynamicVerifyStepAction, executeDynamicSettleStepAction } from './actions';
import { Header } from './components/Header';
import { Timeline } from './components/Timeline';
import { FinancialLayerPanel } from './components/FinancialLayerPanel';
import { WalletCards } from './components/WalletCards';
import { DiscoveryCompetitionPanel } from './components/DiscoveryCompetitionPanel';
import { ExecutionEvidencePanel } from './components/ExecutionEvidencePanel';
import { VerificationPanel } from './components/VerificationPanel';
import { ClearingSettlementPanel } from './components/ClearingSettlementPanel';
import { CapacityPanel } from './components/CapacityPanel';
import { CommandPanel, ChatMessage } from './components/CommandPanel';
import { CurrentProcessPanel } from './components/CurrentProcessPanel';
import { CanonicalAppState } from '../core/types';

type ViewType = 'LANDING' | 'LOGIN' | 'DASHBOARD';
type TabType = 'OVERVIEW' | 'TRANSACTIONS' | 'AGENTS' | 'LEDGER';
type DemoType = 'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN' | 'RESET' | 'NONE';

export default function DashboardPage() {
  const [view, setView] = useState<ViewType>('LANDING');
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDemo, setActiveDemo] = useState<DemoType>('NONE');
  
  // SINGLE SOURCE OF TRUTH FOR THE UI
  const [appState, setAppState] = useState<CanonicalAppState | null>(null);

  // CHAT STATE
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    // Initial Hydration
    getAppStateAction('TASK-DEMO-1').then(setAppState).catch(console.error);
  }, []);

  const addChat = (sender: 'USER' | 'PROOFFLOW', text: string) => {
    setChatMessages(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), sender, text }]);
  };

  const handleCommand = async (prompt: string) => {
    addChat('USER', prompt);
    if (isProcessing) return;
    setIsProcessing(true);
    setActiveTab('OVERVIEW');

    try {
      // 1. DISCOVER, SELECT, UNDERWRITE, FUND
      addChat('PROOFFLOW', `Task understood: "${prompt}". Searching 75 registered economic agents...`);
      await new Promise(r => setTimeout(r, 1000));

      const state = await submitDynamicTaskAction(prompt);
      setAppState(state);

      const task = state.task;
      if (!task?.id) throw new Error('Dynamic task creation failed');

      const capability = task.taskType || 'python';
      const selectedWorker = state.agents.find(a => a.id === state.selectedWorkerId);
      const winnerName = selectedWorker?.name || state.selectedWorkerId || 'Selected Worker';
      const winnerProvider = selectedWorker?.provider || 'Google';
      const adapterName = selectedWorker?.executionAdapter || 'GEMINI_DEBUGGER';

      addChat('PROOFFLOW', `Dynamic Task Created: ${task.id}
Capability: ${capability.toUpperCase()}
Quality Threshold: ${task.qualityThreshold}%
Budget: ₹${task.budget.toLocaleString()}

Selection Engine Evaluated Candidates:
Winner Selected: ${winnerName} (${winnerProvider})
Escrow & Collateral locked. Ready for work execution.`);

      setTimeout(() => {
        document.getElementById('panel-discover')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      await new Promise(r => setTimeout(r, 1400));

      // 2. WORK (Model Execution)
      addChat('PROOFFLOW', `Routing task artifact to ${winnerName} via ${adapterName}...`);
      
      const workState = await executeDynamicWorkStepAction(task.id);
      setAppState(workState);

      const evidence = workState.evidence;
      const payload = evidence?.evidencePayload || {};
      const executionTimeMs = (payload.executionTimeMs as number) || 45;

      addChat('PROOFFLOW', `WORK completed by ${winnerName} via ${adapterName} in ${executionTimeMs}ms.
Output SHA-256: ${evidence?.outputHash.substring(0, 16)}...
Evidence SHA-256: ${evidence?.evidenceHash.substring(0, 16)}...`);

      setTimeout(() => {
        document.getElementById('panel-work')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      await new Promise(r => setTimeout(r, 1400));

      // 3. VERIFY (Verification Router)
      addChat('PROOFFLOW', 'Running deterministic verification suite against submitted evidence package...');

      const verifyState = await executeDynamicVerifyStepAction(task.id);
      setAppState(verifyState);

      const vr = verifyState.verificationResult;
      addChat('PROOFFLOW', `VERIFY completed. Route: ${vr?.routeType || 'DETERMINISTIC'}. Verdict: ${vr?.verdict || 'PASS'} (Score: ${vr?.score || 100}%).`);

      setTimeout(() => {
        document.getElementById('panel-verify')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      await new Promise(r => setTimeout(r, 1400));

      // 4. CLEAR & SETTLE (Clearing, Machine Settlement & Capacity Update)
      addChat('PROOFFLOW', 'Calculating authoritative clearing decision & executing machine payment settlement...');

      const finalState = await executeDynamicSettleStepAction(task.id);
      setAppState(finalState);

      const inst = finalState.clearingInstruction;
      const receipt = finalState.paymentReceipt;

      addChat('PROOFFLOW', `CLEAR decision: ${inst?.verdict || 'PASS'}. Worker payout: ₹${inst?.workerAmount?.toLocaleString()}.
SETTLE status: COMPLETED. Payment rail: ${receipt?.rail || 'x402-simulated-demo'} (${receipt?.status || 'CONFIRMED'}).
Worker economic capacity updated based on verified performance.`);

      setTimeout(() => {
        document.getElementById('panel-settle')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error('Dynamic task creation failed:', err);
      addChat('PROOFFLOW', `Task creation failed: ${errorObj.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSecondaryCommand = (demoType: 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN') => {
    addChat('USER', `Execute ${demoType.replace('_', ' ')} Scenario`);
    handleRunDemo(demoType);
  };

  const handleRunDemo = async (demoType: DemoType) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setActiveDemo(demoType);
    setActiveTab('OVERVIEW');

    try {
      if (demoType === 'RESET') {
        const resetState = await resetDemoAction();
        setAppState(resetState);
        setActiveDemo('NONE');
        setChatMessages([]);
        return;
      }

      // 1. Initialize Scenario
      const validDemoType = demoType as 'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN';
      let state = await initializeDemoAction(validDemoType);
      setAppState(state);
      await new Promise(r => setTimeout(r, 1000));

      // 2. Step-by-step Domain Execution
      for (let i = 1; i <= 12; i++) {
        // PRE-STEP PROGRESS INDICATORS
        if (i === 1) addChat('PROOFFLOW', 'Initiating technical capability discovery on agent network...');
        if (i === 2) addChat('PROOFFLOW', 'Evaluating 4 active bids. Comparing reliability, capability, and available economic capacity...');
        if (i === 3) addChat('PROOFFLOW', 'Running dynamic risk assessment for selected worker...');
        if (i === 4) addChat('PROOFFLOW', 'Initiating atomic lock for buyer escrow funds...');
        if (i === 5) addChat('PROOFFLOW', 'Verifying worker collateral lock...');
        if (i === 8) addChat('PROOFFLOW', 'Awaiting worker execution and cryptographic proof generation...');
        if (i === 9) addChat('PROOFFLOW', 'Running deterministic verification suite against submitted evidence...');
        if (i === 10) addChat('PROOFFLOW', 'Calculating final clearing decision...');
        if (i === 11 && demoType !== 'UNCERTAIN') addChat('PROOFFLOW', 'Executing atomic financial settlement...');

        if ([1, 2, 3, 4, 5, 8, 9, 10, 11].includes(i)) {
          // Add a delay to show "thinking/working" progress before completing the step
          await new Promise(r => setTimeout(r, 1500));
        }

        state = await executeDemoStepAction(validDemoType, i);
        setAppState(state);

        // Scroll to the relevant panel on the left side
        setTimeout(() => {
          if (i === 1 || i === 2) document.getElementById('panel-discover')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (i === 3 || i === 4) document.getElementById('panel-underwrite')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (i === 8) document.getElementById('panel-work')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (i === 9) document.getElementById('panel-verify')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (i === 10) document.getElementById('panel-clear')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (i === 11 || i === 12) document.getElementById('panel-settle')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        
        // POST-STEP EVENTS
        if (i === 1) addChat('PROOFFLOW', 'Discovered 4 workers. Filtering by Python capability.');
        if (i === 2) addChat('PROOFFLOW', 'PyCoder Pro selected: Optimal combination of reliability (95%) and sufficient economic capacity (₹20,000 > ₹9,000 exposure). Other models rejected due to insufficient capacity or lower reliability.');
        if (i === 3) addChat('PROOFFLOW', 'Underwriting complete. Risk factor 10% applied. Safe exposure limit set to ₹9,000.');
        if (i === 4) addChat('PROOFFLOW', 'Funding initiated. ₹10,000 escrow securely locked.');
        if (i === 5) addChat('PROOFFLOW', 'Worker collateral of ₹1,000 locked.');
        if (i === 8) addChat('PROOFFLOW', 'Worker successfully submitted execution artifact and evidence package.');
        if (i === 9) {
          if (demoType === 'UNCERTAIN') {
            addChat('PROOFFLOW', 'Verification completed. Confidence: LOW (High evaluator disagreement). Verdict: UNCERTAIN.');
          } else if (demoType === 'FAILURE') {
            addChat('PROOFFLOW', 'Verification completed. Confidence: HIGH. Verdict: FAIL.');
          } else {
            addChat('PROOFFLOW', 'Verification completed. Confidence: HIGH. Verdict: PASS.');
          }
        }
        if (i === 10) {
          if (demoType === 'FAILURE') addChat('PROOFFLOW', 'Clearing decision: FAIL. Worker obligation not met.');
          else if (demoType === 'UNCERTAIN') addChat('PROOFFLOW', 'Clearing decision: UNCERTAIN. Automatic settlement suspended for manual review.');
          else addChat('PROOFFLOW', 'Clearing decision: PASS. Worker obligation satisfied.');
        }
        if (i === 11 && demoType !== 'UNCERTAIN') {
          if (demoType === 'FAILURE') addChat('PROOFFLOW', 'Settlement executed. Buyer fully refunded. Worker collateral slashed to Protocol Treasury.');
          else addChat('PROOFFLOW', 'Settlement executed. ₹10,000 transferred to worker wallet.');
        }
        if (i === 12 && demoType !== 'UNCERTAIN' && demoType !== 'FAILURE') {
          addChat('PROOFFLOW', 'Worker economic capacity automatically increased due to verified performance.');
        }

        // Presentation delay to allow users to see the domain state update and read the chat
        await new Promise(r => setTimeout(r, 2000));
      }

    } catch (err) {
      console.error('Demo execution failed:', err);
      addChat('PROOFFLOW', 'A system error occurred during execution.');
      getAppStateAction(appState?.task?.id || 'TASK-DEMO-1').then(setAppState).catch(console.error);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadTask = async (taskId: string) => {
    const state = await getAppStateAction(taskId);
    setAppState(state);
    setActiveTab('OVERVIEW');
  };

  if (view === 'LANDING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fa] selection:bg-[#1a73e8] selection:text-white px-4">
        <div className="w-12 h-12 bg-[#1a73e8] rounded-md flex items-center justify-center mb-6 shadow-sm">
          <span className="text-white text-xl font-bold">PF</span>
        </div>
        <h1 className="text-[32px] md:text-[40px] font-semibold text-[#202124] tracking-tight mb-4 text-center max-w-2xl leading-tight">
          Proof-Carrying Capital Infrastructure for Agent-to-Agent Commerce
        </h1>
        <p className="text-[17px] text-[#5f6368] mb-10 text-center max-w-xl leading-relaxed">
          The deterministic clearing and settlement layer for autonomous economic transactions. Trustless underwriting, execution, and verification.
        </p>
        <button
          onClick={() => setView('LOGIN')}
          className="px-8 py-3 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-[15px] font-medium rounded shadow-sm transition-colors"
        >
          Enter ProofFlow
        </button>
      </div>
    );
  }

  if (view === 'LOGIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4">
        <div className="w-full max-w-[400px] bg-white border border-[#dadce0] rounded-lg shadow-sm p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-8 h-8 bg-[#1a73e8] rounded-sm flex items-center justify-center mb-4">
              <span className="text-white text-sm font-bold">PF</span>
            </div>
            <h2 className="text-[20px] font-semibold text-[#202124]">Sign in</h2>
            <p className="text-[14px] text-[#5f6368] mt-1">to continue to ProofFlow Dashboard</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Organization ID</label>
              <input type="text" defaultValue="pf_corp_90210" disabled className="w-full px-3 py-2 border border-[#dadce0] rounded text-[14px] text-[#202124] bg-[#f8f9fa]" />
            </div>
            <button
              onClick={() => setView('DASHBOARD')}
              className="w-full mt-4 px-4 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-[14px] font-medium rounded shadow-sm transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!appState) {
    return <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">Loading ProofFlow Infrastructure...</div>;
  }

  const renderOverview = () => (
    <>
      <div className="mb-6 flex items-center justify-between border-b border-[#dadce0] pb-4">
        <h2 className="text-[22px] font-semibold tracking-tight">
          Transaction Overview: {appState.task?.id || 'NO_TASK'}
        </h2>
      </div>

      <Timeline steps={appState.steps} />
      
      <CurrentProcessPanel appState={appState} />

      <div className="space-y-6">
        <div id="panel-discover"><DiscoveryCompetitionPanel agents={appState.agents} selectedWorkerId={appState.selectedWorkerId} /></div>
        <div id="panel-underwrite"><FinancialLayerPanel task={appState.task} /></div>
        <div id="panel-work"><ExecutionEvidencePanel evidence={appState.evidence} task={appState.task} isFailureDemo={activeDemo === 'FAILURE'} /></div>
        <div id="panel-verify"><VerificationPanel
          result={appState.verificationResult}
          isBlindJuryDemo={activeDemo === 'BLIND_JURY' || appState.task?.id === 'TASK-DEMO-2'}
        /></div>
        <div id="panel-clear"><ClearingSettlementPanel instruction={appState.clearingInstruction} paymentInstruction={appState.paymentInstruction} paymentReceipt={appState.paymentReceipt} /></div>
        <div id="panel-settle"><CapacityPanel 
          initialCapacity={20000} 
          finalCapacity={appState.task?.status === 'COMPLETED' ? 22000 : appState.task?.status === 'PENALIZED' ? 16000 : 20000} 
        /></div>
      </div>
    </>
  );

  const renderTransactions = () => (
    <div className="bg-white border border-[#dadce0] rounded shadow-sm overflow-hidden mt-6">
      <table className="w-full text-left border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[#dadce0] bg-[#f8f9fa]">
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Task ID</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Type</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Value</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Status</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Action</th>
          </tr>
        </thead>
        <tbody>
          {appState.allTasks.map(t => (
            <tr key={t.id} className="border-b border-[#dadce0] last:border-0 hover:bg-[#f8f9fa]">
              <td className="px-4 py-3 font-mono text-[#1a73e8]">{t.id}</td>
              <td className="px-4 py-3 uppercase">{t.taskType}</td>
              <td className="px-4 py-3">₹{t.budget.toLocaleString()}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 text-[11px] font-bold rounded ${
                  t.status === 'COMPLETED' ? 'bg-[#e6f4ea] text-[#137333]' : 
                  t.status === 'PENALIZED' || t.status === 'FAILED' ? 'bg-[#fce8e6] text-[#c5221f]' : 
                  'bg-[#e8f0fe] text-[#1a73e8]'
                }`}>
                  {t.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <button 
                  onClick={() => loadTask(t.id)}
                  className="text-[#1a73e8] hover:underline font-medium"
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderAgents = () => (
    <div className="bg-white border border-[#dadce0] rounded shadow-sm overflow-hidden mt-6">
      <table className="w-full text-left border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[#dadce0] bg-[#f8f9fa]">
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Agent ID</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Role</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Capabilities</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Reliability</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368] text-right">Available Balance</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368] text-right">Locked Balance</th>
          </tr>
        </thead>
        <tbody>
          {appState.agents.map(a => {
            const wallet = appState.wallets.find(w => w.agentId === a.id);
            return (
              <tr key={a.id} className="border-b border-[#dadce0] last:border-0 hover:bg-[#f8f9fa]">
                <td className="px-4 py-3 font-mono text-[#1a73e8]">{a.id}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-[#f1f3f4] text-[#3c4043] rounded text-[11px] font-bold uppercase tracking-wider">
                    {a.role[0]}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#5f6368]">{a.capabilities.join(', ') || 'N/A'}</td>
                <td className="px-4 py-3">
                  <div className="w-full bg-[#f1f3f4] h-1.5 rounded-full overflow-hidden flex max-w-[80px]">
                    <div className="bg-[#1a73e8] h-full" style={{ width: `${a.reputationScore}%` }}></div>
                  </div>
                  <span className="text-[11px] text-[#5f6368] mt-1">{a.reputationScore}/100</span>
                </td>
                <td className="px-4 py-3 text-right font-medium">₹{wallet?.availableBalance.toLocaleString() || '0'}</td>
                <td className="px-4 py-3 text-right font-medium text-[#5f6368]">₹{wallet?.lockedBalance.toLocaleString() || '0'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderLedger = () => (
    <div className="bg-white border border-[#dadce0] rounded shadow-sm overflow-hidden mt-6">
      <table className="w-full text-left border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[#dadce0] bg-[#f8f9fa]">
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Tx ID</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Task ID</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Type</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Source</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Destination</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368] text-right">Amount</th>
            <th className="px-4 py-3 font-semibold text-[#5f6368]">Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {appState.transactions.map(t => (
            <tr key={t.id} className="border-b border-[#dadce0] last:border-0 hover:bg-[#f8f9fa]">
              <td className="px-4 py-3 font-mono text-[11px] text-[#5f6368]" title={t.id}>{t.id.substring(0,8)}...</td>
              <td className="px-4 py-3 font-mono text-[#1a73e8]">{t.taskId}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 bg-[#f8f9fa] border border-[#dadce0] text-[#3c4043] rounded text-[10px] font-bold uppercase">
                  {t.transactionType.replace('_', ' ')}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-[11px] text-[#5f6368]" title={t.fromWalletId || 'N/A'}>{t.fromWalletId ? t.fromWalletId.substring(0,10)+'...' : '-'}</td>
              <td className="px-4 py-3 font-mono text-[11px] text-[#5f6368]" title={t.toWalletId || 'N/A'}>{t.toWalletId ? t.toWalletId.substring(0,10)+'...' : '-'}</td>
              <td className="px-4 py-3 text-right font-medium text-[#137333]">₹{t.amount.toLocaleString()}</td>
              <td className="px-4 py-3 text-[#5f6368] text-[11px]">{new Date(t.createdAt).toLocaleTimeString()}</td>
            </tr>
          ))}
          {appState.transactions.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-[#5f6368]">No transactions in ledger.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#202124] font-sans selection:bg-[#1a73e8] selection:text-white flex flex-col">
      <Header
        isProcessing={isProcessing}
        onRunDemo={handleRunDemo}
      />



      <main className="flex-1 w-full mx-auto p-4 md:p-6 pb-20" style={{ maxWidth: '1440px' }}>
        <div className="flex flex-col lg:flex-row gap-6 h-full">
          {/* LEFT / MAIN AREA (70-75%) */}
          <div className="w-full lg:w-[72%]">
            {activeTab === 'OVERVIEW' && renderOverview()}
            {activeTab === 'TRANSACTIONS' && renderTransactions()}
            {activeTab === 'AGENTS' && renderAgents()}
            {activeTab === 'LEDGER' && renderLedger()}
            
            {/* DEBUG PANEL */}
            <div className="mt-12 bg-white border border-[#dadce0] rounded p-4 font-mono text-[11px] text-[#5f6368] shadow-sm">
              <div className="flex justify-between items-center mb-2 border-b border-[#dadce0] pb-2">
                <h4 className="font-bold text-[#202124] uppercase">Debug Canonical State</h4>
                <span>Rendered at: {new Date().toISOString()} | Stage: {appState.currentStage} ({appState.currentStepIndex}/12)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><span className="block font-bold">Task:</span>{appState.task?.id} ({appState.task?.status})</div>
                <div><span className="block font-bold">System Total:</span>₹{appState.systemTotal.toLocaleString()}</div>
                <div><span className="block font-bold">Escrow:</span>₹{appState.escrow?.amount || 0} ({appState.escrow?.status || 'N/A'})</div>
                <div><span className="block font-bold">Collateral:</span>₹{appState.collateral?.amount || 0} ({appState.collateral?.status || 'N/A'})</div>
                <div><span className="block font-bold">Buyer Bond:</span>₹{appState.buyerBond?.amount || 0} ({appState.buyerBond?.status || 'N/A'})</div>
                <div><span className="block font-bold">Verification:</span>{appState.verificationResult?.verdict || 'N/A'}</div>
                <div><span className="block font-bold">Settlement:</span>{appState.settlement?.status || 'N/A'}</div>
                <div><span className="block font-bold">Ledger Count:</span>{appState.transactions.length}</div>
              </div>
            </div>
          </div>
          
          {/* RIGHT / COMMAND PANEL (25-30%) */}
          <div className="w-full lg:w-[28%] lg:h-[calc(100vh-140px)] lg:sticky lg:top-20">
            <CommandPanel 
              chatMessages={chatMessages}
              onCommand={handleCommand}
              onSecondaryCommand={handleSecondaryCommand}
              isProcessing={isProcessing}
            />
            {activeTab === 'OVERVIEW' && (
              <div className="mt-6">
                <WalletCards wallets={appState.wallets} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
