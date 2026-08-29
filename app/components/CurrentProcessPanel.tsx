import React from 'react';
import { CanonicalAppState } from '../../core/types';

interface CurrentProcessPanelProps {
  appState: CanonicalAppState;
}

export function CurrentProcessPanel({ appState }: CurrentProcessPanelProps) {
  const currentStage = appState.currentStage;
  const currentStepIndex = appState.currentStepIndex;
  
  const getProcessDetails = () => {
    switch (currentStage) {
      case 'DISCOVER':
        return {
          title: 'DISCOVERY',
          what: 'Searching available worker agents.',
          why: 'Finding candidate agents with matching technical capabilities.',
          result: currentStepIndex > 1 ? `Found ${appState.agents.length} capable agents. Eligible agents filtered.` : null
        };
      case 'SELECT':
        return {
          title: 'SELECTION',
          what: 'Evaluating bids and selecting optimal worker.',
          why: 'Worker selection based on price, reliability, and economic capacity.',
          result: currentStepIndex > 2 ? `Selected Agent: ${appState.task?.selectedWorkerId || appState.task?.assignedWorkerId}` : null
        };
      case 'UNDERWRITING-READY':
      case 'UNDERWRITE':
        return {
          title: 'UNDERWRITING & SELECTION COMPLETE',
          what: 'Comparing eligible bids & establishing underwriting terms.',
          why: 'Choose best eligible worker & verify financial exposure safety.',
          result: `Task: ${appState.task?.id || 'DYNAMIC'} | Selected: ${appState.selectedWorkerId || appState.task?.selectedWorkerId || 'Worker'} | Status: UNDERWRITING-READY`
        };
      case 'FUND':
        return {
          title: 'FUNDING',
          what: 'Locking required escrow and collateral funds.',
          why: 'Ensuring financial commitments before execution begins.',
          result: currentStepIndex > 5 ? `Escrow: ₹${appState.escrow?.amount.toLocaleString()} locked. Collateral: ₹${appState.collateral?.amount.toLocaleString()} locked.` : null
        };
      case 'WORK':
        return {
          title: 'EXECUTION',
          what: 'Task assignment and worker execution.',
          why: 'Worker generating the output artifact and proof evidence.',
          result: currentStepIndex > 8 ? 'Execution completed. Evidence package and artifact generated.' : null
        };
      case 'VERIFY':
        return {
          title: 'VERIFICATION',
          what: 'Checking submitted evidence against correctness criteria.',
          why: 'Determining if the worker successfully met the objective criteria.',
          result: currentStepIndex > 9 ? `Method: ${appState.verificationResult?.routeType} | Verdict: ${appState.verificationResult?.verdict}` : null
        };
      case 'CLEAR':
        return {
          title: 'CLEARING',
          what: 'Generating deterministic settlement instructions.',
          why: 'Translating verification verdict into financial operations.',
          result: currentStepIndex > 10 ? `Decision: ${appState.clearingInstruction?.verdict || 'N/A'}` : null
        };
      case 'SETTLE':
        return {
          title: 'SETTLEMENT',
          what: 'Executing the atomic financial obligation.',
          why: 'Finalizing the economic transaction and updating ledger/capacity.',
          result: currentStepIndex >= 11 ? 'Settlement complete. Wallets and economic capacity updated.' : null
        };
      default:
        return {
          title: 'INITIALIZATION',
          what: 'Awaiting task instructions.',
          why: '-',
          result: null
        };
    }
  };

  const details = getProcessDetails();

  return (
    <div className="bg-white border border-[#dadce0] rounded shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-[#dadce0] bg-[#f8f9fa] flex items-center">
        <div className="w-2 h-2 rounded-full bg-[#1a73e8] animate-pulse mr-3"></div>
        <h3 className="font-semibold text-[#202124] text-[15px] uppercase tracking-wider">Current Process: {details.title}</h3>
      </div>
      
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="mb-4">
            <span className="block text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-1">What</span>
            <p className="text-[14px] text-[#202124]">{details.what}</p>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-1">Why</span>
            <p className="text-[14px] text-[#5f6368]">{details.why}</p>
          </div>
        </div>
        
        {details.result && (
          <div className="bg-[#f8f9fa] border border-[#dadce0] rounded p-4">
            <span className="block text-[11px] font-bold text-[#1a73e8] uppercase tracking-wider mb-2">Result</span>
            <p className="text-[14px] font-medium text-[#202124]">{details.result}</p>
          </div>
        )}
      </div>
    </div>
  );
}
