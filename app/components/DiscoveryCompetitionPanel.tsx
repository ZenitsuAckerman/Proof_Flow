'use client';

import React from 'react';
import { Agent } from '../../core/types';

interface DiscoveryCompetitionPanelProps {
  agents: Agent[];
  selectedWorkerId: string | null;
}

export const DiscoveryCompetitionPanel: React.FC<DiscoveryCompetitionPanelProps> = ({
  agents,
  selectedWorkerId
}) => {
  const pythonWorkers = agents.filter(a => a.capabilities.includes('python') || a.role.includes('WORKER')).slice(0, 4);

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm p-6 mb-6">
      <div className="border-b border-[#dadce0] pb-4 mb-4">
        <h3 className="text-[15px] font-semibold text-[#202124]">Agent Marketplace & Economic Eligibility</h3>
        <p className="text-[13px] text-[#5f6368] mt-1">Filtering candidates by technical reliability, economic capacity, and collateral availability.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] text-[#202124] border-collapse">
          <thead className="bg-[#f8f9fa] border-b border-[#dadce0] text-[#5f6368]">
            <tr>
              <th className="py-3 px-4 font-medium">Agent</th>
              <th className="py-3 px-4 font-medium">Capability</th>
              <th className="py-3 px-4 font-medium">Reliability</th>
              <th className="py-3 px-4 font-medium">Econ Capacity</th>
              <th className="py-3 px-4 font-medium">Required Exposure</th>
              <th className="py-3 px-4 font-medium">Collateral</th>
              <th className="py-3 px-4 font-medium">Eligibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dadce0]">
            {pythonWorkers.map((worker) => {
              const isSelected = worker.id === (selectedWorkerId || 'AGENT-WORKER-1');
              const isLowCap = worker.id === 'AGENT-WORKER-3';
              const isBroke = worker.id === 'AGENT-WORKER-4';
              const isEligible = !isLowCap && !isBroke;

              return (
                <tr key={worker.id} className={`${isSelected ? 'bg-[#e8f0fe]' : 'hover:bg-[#f8f9fa]'} transition-colors`}>
                  <td className="py-3 px-4 flex items-center gap-2">
                    <span className="font-semibold">{worker.name}</span>
                    {isSelected && <span className="bg-[#1a73e8] text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">Selected</span>}
                  </td>
                  <td className="py-3 px-4">Python</td>
                  <td className="py-3 px-4">{worker.reputationScore}%</td>
                  <td className={`py-3 px-4 ${isLowCap ? 'text-[#d93025] font-semibold' : ''}`}>
                    ₹{(worker.economicCapacity['python'] || 20000).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-[#5f6368]">₹9,000</td>
                  <td className="py-3 px-4">₹1,000</td>
                  <td className="py-3 px-4">
                    {isEligible ? (
                      <span className="text-[#1e8e3e] font-medium flex items-center gap-1">✓ Eligible</span>
                    ) : (
                      <span className="text-[#d93025] font-medium flex items-center gap-1">✕ Ineligible</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
