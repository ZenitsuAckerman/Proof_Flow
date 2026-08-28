'use client';

import React, { useState, useEffect } from 'react';
import { getAppStateAction, runDemoAction } from './actions';
import { Header } from './components/Header';
import { Timeline } from './components/Timeline';
import { FinancialLayerPanel } from './components/FinancialLayerPanel';
import { WalletCards } from './components/WalletCards';
import { DiscoveryCompetitionPanel } from './components/DiscoveryCompetitionPanel';
import { ExecutionEvidencePanel } from './components/ExecutionEvidencePanel';
import { VerificationPanel } from './components/VerificationPanel';
import { ClearingSettlementPanel } from './components/ClearingSettlementPanel';
import { LedgerPanel } from './components/LedgerPanel';
import { CapacityPanel } from './components/CapacityPanel';
import { CanonicalAppState } from '../core/types';

export default function DashboardPage() {
  const [view, setView] = useState<'LANDING' | 'LOGIN' | 'DASHBOARD'>('LANDING');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDemo, setActiveDemo] = useState<'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN' | 'RESET' | 'NONE'>('NONE');
  
  // SINGLE SOURCE OF TRUTH FOR THE UI
  const [appState, setAppState] = useState<CanonicalAppState | null>(null);

  useEffect(() => {
    // Initial Hydration
    getAppStateAction('TASK-DEMO-1').then(setAppState).catch(console.error);
  }, []);

  const handleRunDemo = async (demoType: 'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN' | 'RESET') => {
    setIsProcessing(true);
    setActiveDemo(demoType);

    try {
      // 1. Await full server mutation and get fresh canonical state
      const newCanonicalState = await runDemoAction(demoType);
      
      // 2. Set React state exactly once
      setAppState(newCanonicalState);

    } catch (err) {
      console.error('Demo execution failed:', err);
      // Ensure we don't break the UI, ideally fetch latest DB state here too
      getAppStateAction().then(setAppState).catch(console.error);
    } finally {
      setIsProcessing(false);
      if (demoType === 'RESET') {
        setActiveDemo('NONE');
      }
    }
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

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#202124] font-sans selection:bg-[#1a73e8] selection:text-white flex flex-col">
      <Header
        systemStatus={appState.systemStatus}
        isProcessing={isProcessing}
        onRunDemo={handleRunDemo}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-20">
        <div className="mb-6 flex items-center justify-between border-b border-[#dadce0] pb-4">
          <h2 className="text-[22px] font-semibold tracking-tight">
            Transaction Overview: {appState.task?.id || 'NO_TASK'}
          </h2>
          <span className="text-[13px] text-[#5f6368] font-mono">Timestamp: {new Date().toISOString()}</span>
        </div>

        <Timeline steps={appState.steps} currentStepIndex={appState.currentStepIndex} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <FinancialLayerPanel task={appState.task} />
            <DiscoveryCompetitionPanel agents={appState.agents} selectedWorkerId={appState.selectedWorkerId} />
            <ExecutionEvidencePanel isFailureDemo={activeDemo === 'FAILURE'} />
            <VerificationPanel
              result={appState.verificationResult}
              isBlindJuryDemo={activeDemo === 'BLIND_JURY'}
            />
          </div>

          <div className="space-y-6">
            <WalletCards wallets={appState.wallets} />
            <ClearingSettlementPanel instruction={appState.clearingInstruction} />
            
            {/* Find initial and final capacities for the worker. 
                For the demo, we assume the selected worker is AGENT-WORKER-1 or AGENT-WORKER-2.
                Since UI doesn't track historical capacity cleanly, we'll hardcode the delta presentation for now,
                or extract it if we have it. A more robust implementation would diff it from the DB. */}
            <CapacityPanel 
              initialCapacity={20000} 
              finalCapacity={activeDemo === 'PRIMARY' ? 22000 : activeDemo === 'FAILURE' ? 16000 : 20000} 
            />
            
            <LedgerPanel transactions={appState.transactions} />
          </div>
        </div>

        {/* =================================================================
            DEBUG PANEL: FOR VALIDATION OF STATE SYNCHRONIZATION 
            ================================================================= */}
        <div className="mt-12 bg-white border border-[#dadce0] rounded p-4 font-mono text-[11px] text-[#5f6368] shadow-sm">
          <h4 className="font-bold text-[#202124] mb-2 uppercase border-b border-[#dadce0] pb-2">Debug Canonical State</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="block font-bold">Task:</span>
              {appState.task?.id} ({appState.task?.status})
            </div>
            <div>
              <span className="block font-bold">System Total:</span>
              ₹{appState.systemTotal.toLocaleString()}
            </div>
            <div>
              <span className="block font-bold">Escrow:</span>
              ₹{appState.escrow?.amount || 0} ({appState.escrow?.status || 'N/A'})
            </div>
            <div>
              <span className="block font-bold">Collateral:</span>
              ₹{appState.collateral?.amount || 0} ({appState.collateral?.status || 'N/A'})
            </div>
            <div>
              <span className="block font-bold">Buyer Bond:</span>
              ₹{appState.buyerBond?.amount || 0} ({appState.buyerBond?.status || 'N/A'})
            </div>
            <div>
              <span className="block font-bold">Verification:</span>
              {appState.verificationResult?.verdict || 'N/A'}
            </div>
            <div>
              <span className="block font-bold">Settlement:</span>
              {appState.settlement?.status || 'N/A'}
            </div>
            <div>
              <span className="block font-bold">Ledger Count:</span>
              {appState.transactions.length}
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-[#dadce0] grid grid-cols-1 md:grid-cols-3 gap-4">
            {appState.wallets.map(w => (
              <div key={w.id} className="border border-[#dadce0] p-2 rounded">
                <span className="font-bold">{w.agentId} ({w.agentRole}):</span><br/>
                Avail: ₹{w.availableBalance.toLocaleString()}<br/>
                Locked: ₹{w.lockedBalance.toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
