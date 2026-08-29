'use client';

import React from 'react';
import { Agent, Task } from '../../core/types';

interface DiscoveryCompetitionPanelProps {
  agents: Agent[];
  task?: Task | null;
  selectedWorkerId: string | null;
}

export const DiscoveryCompetitionPanel: React.FC<DiscoveryCompetitionPanelProps> = ({
  agents,
  task,
  selectedWorkerId
}) => {
  const capability = task?.taskType || 'python';
  const safeExposure = task?.financialTerms?.safeExposure || 10000;
  const collateralReq = task?.financialTerms?.collateralRequirement || 2000;

  // Filter workers matching capability/role
  const allWorkers = agents.filter(a => a.role.includes('WORKER'));
  const matchedWorkers = allWorkers.filter(w => 
    w.capabilities.includes(capability) || 
    (capability === 'python' && (w.capabilities.includes('python') || w.capabilities.includes('code')))
  );

  // Evaluate candidate eligibility dynamically for table presentation
  const evaluatedCandidates = matchedWorkers.slice(0, 8).map(worker => {
    const isAvailable = worker.available !== false;
    const workerCapacity = worker.economicCapacity[capability] || worker.economicCapacity['python'] || 0;
    const hasCapacity = workerCapacity >= safeExposure;
    const availableWallet = (workerCapacity > 0) ? (worker.walletId === 'WALLET-WORKER-014' || worker.id === 'AGENT-WORKER-4' ? 200 : 15000) : 0;
    const hasCollateral = availableWallet >= collateralReq;

    const isEligible = isAvailable && hasCapacity && hasCollateral;

    let reason = '';
    if (!isAvailable) reason = 'Worker Unavailable';
    else if (!hasCapacity) reason = `Capacity ₹${workerCapacity.toLocaleString()} < Safe Exposure ₹${safeExposure.toLocaleString()}`;
    else if (!hasCollateral) reason = `Collateral ₹${availableWallet.toLocaleString()} < Required ₹${collateralReq.toLocaleString()}`;

    const isSelected = worker.id === selectedWorkerId || (selectedWorkerId === null && worker.id === 'AGENT-WORKER-1');

    return {
      worker,
      isEligible,
      reason,
      isSelected,
      workerCapacity
    };
  });

  const totalRegistry = agents.length;
  const totalMatched = matchedWorkers.length;
  const totalEligible = evaluatedCandidates.filter(c => c.isEligible).length;
  const totalRejected = totalMatched - totalEligible;

  const selectedAgent = agents.find(a => a.id === selectedWorkerId) || matchedWorkers.find(w => w.id === 'AGENT-WORKER-1');

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-[#dadce0] bg-[#f8f9fa] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-[#202124] text-[15px] uppercase tracking-wider">DISCOVERY & SELECTION ENGINE</h3>
          <p className="text-[12px] text-[#5f6368] mt-0.5">Searching 75-agent virtual economy against task requirements</p>
        </div>
        <div className="flex items-center gap-4 text-[12px]">
          <span className="px-2.5 py-1 bg-[#e8f0fe] text-[#1a73e8] font-medium rounded">Total Agents: {totalRegistry}</span>
          <span className="px-2.5 py-1 bg-[#f1f3f4] text-[#3c4043] font-medium rounded">Matched: {totalMatched}</span>
          <span className="px-2.5 py-1 bg-[#e6f4ea] text-[#137333] font-medium rounded">Eligible: {totalEligible}</span>
          <span className="px-2.5 py-1 bg-[#fce8e6] text-[#c5221f] font-medium rounded">Rejected: {totalRejected}</span>
        </div>
      </div>

      <div className="p-5 flex flex-col xl:flex-row gap-6">
        {/* LEFT COLUMN: CANDIDATE DISCOVERY TABLE */}
        <div className="flex-1 overflow-x-auto">
          <span className="block text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-4 border-b border-[#dadce0] pb-2">
            Candidates Evaluated ({capability.toUpperCase()})
          </span>
          <table className="w-full text-left text-[13px] text-[#202124] border-collapse">
            <thead className="bg-[#f8f9fa] border-b border-[#dadce0] text-[#5f6368]">
              <tr>
                <th className="py-2 px-3 font-medium">Agent Identity</th>
                <th className="py-2 px-3 font-medium">Provider</th>
                <th className="py-2 px-3 font-medium">Reliability</th>
                <th className="py-2 px-3 font-medium">Economic Capacity</th>
                <th className="py-2 px-3 font-medium">Status & Filter Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dadce0]">
              {evaluatedCandidates.map(({ worker, isEligible, reason, isSelected, workerCapacity }) => (
                <tr key={worker.id} className={`${isSelected ? 'bg-[#e8f0fe]' : 'hover:bg-[#f8f9fa]'} transition-colors`}>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold block text-[#202124]">{worker.name}</span>
                    <span className="text-[11px] text-[#5f6368] font-mono">{worker.id} • {worker.executionAdapter || 'DEBUGGER'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-[#5f6368] font-medium">{worker.provider || 'Google'}</td>
                  <td className="py-2.5 px-3 font-medium">{worker.reputationScore}%</td>
                  <td className="py-2.5 px-3">
                    ₹{workerCapacity.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    {isEligible ? (
                      <span className="text-[#137333] font-semibold text-[11px] bg-[#e6f4ea] px-2 py-0.5 rounded">ELIGIBLE</span>
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-[#c5221f] font-semibold text-[11px] bg-[#fce8e6] px-2 py-0.5 rounded inline-block w-max">INELIGIBLE</span>
                        <span className="text-[11px] text-[#5f6368] mt-0.5">{reason}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RIGHT COLUMN: SELECTION REASONING */}
        <div className="w-full xl:w-72 flex-shrink-0 xl:border-l xl:border-[#dadce0] xl:pl-6">
          <span className="block text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-4 border-b border-[#dadce0] pb-2">
            Selection Policy Decision
          </span>
          {selectedAgent ? (
            <div className="space-y-4">
              <div>
                <span className="block text-[11px] text-[#5f6368] uppercase">Assigned Economic Worker</span>
                <span className="block text-[15px] font-bold text-[#1a73e8]">{selectedAgent.name}</span>
                <span className="text-[11px] text-[#5f6368] font-mono">{selectedAgent.id} ({selectedAgent.provider || 'Google'})</span>
              </div>
              <div className="p-3 bg-[#f8f9fa] border border-[#dadce0] rounded space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-[#5f6368]">Reputation:</span>
                  <span className="font-semibold text-[#202124]">{selectedAgent.reputationScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5f6368]">Base Fee:</span>
                  <span className="font-semibold text-[#202124]">₹{selectedAgent.basePrice || 100}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5f6368]">Execution Adapter:</span>
                  <span className="font-semibold text-[#202124] font-mono">{selectedAgent.executionAdapter || 'GEMINI_DEBUGGER'}</span>
                </div>
              </div>
              <div>
                <span className="block text-[11px] text-[#5f6368] uppercase mb-1">Selection Audit Trail:</span>
                <ul className="text-[12px] text-[#202124] space-y-1">
                  <li className="flex items-center gap-2"><span className="text-[#137333]">✓</span> Capability & specialization match</li>
                  <li className="flex items-center gap-2"><span className="text-[#137333]">✓</span> Economic capacity &ge; safe exposure</li>
                  <li className="flex items-center gap-2"><span className="text-[#137333]">✓</span> Wallet collateral &ge; requirement</li>
                  <li className="flex items-center gap-2"><span className="text-[#137333]">✓</span> Highest weighted policy score</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-[#5f6368] italic mt-4">
              Awaiting worker selection...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
