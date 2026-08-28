'use client';

import React from 'react';
import { VerificationResult, CommitRevealData } from '../../core/types';

interface VerificationPanelProps {
  result: VerificationResult | null;
  isBlindJuryDemo?: boolean;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({ result, isBlindJuryDemo }) => {
  if (!result) return null;

  const getStatusColor = (v: string) => {
    if (v === 'PASS') return 'text-[#1e8e3e]';
    if (v === 'FAIL') return 'text-[#d93025]';
    if (v === 'UNCERTAIN') return 'text-[#f9ab00]';
    if (v === 'PARTIAL') return 'text-[#1a73e8]';
    return 'text-[#5f6368]';
  };

  const getStatusBg = (v: string) => {
    if (v === 'PASS') return 'bg-[#e6f4ea] text-[#1e8e3e] border-[#ceead6]';
    if (v === 'FAIL') return 'bg-[#fce8e6] text-[#d93025] border-[#f8d0cb]';
    if (v === 'UNCERTAIN') return 'bg-[#fef7e0] text-[#f9ab00] border-[#fde293]';
    if (v === 'PARTIAL') return 'bg-[#e8f0fe] text-[#1a73e8] border-[#d2e3fc]';
    return 'bg-[#f1f3f4] text-[#5f6368] border-[#dadce0]';
  };

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm p-6 mb-6">
      <div className="border-b border-[#dadce0] pb-4 mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-[#202124]">Adaptive Verification Layer</h3>
          <p className="text-[13px] text-[#5f6368] mt-1">Autonomous evaluation of the submitted evidence package.</p>
        </div>
        <span className={`text-[12px] px-3 py-1 rounded font-medium border ${getStatusBg(result.verdict)}`}>
          {result.verdict}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Selected Method</span>
          <span className="text-[14px] font-semibold text-[#202124]">{result.routeType}</span>
        </div>
        <div className="flex flex-col border-l border-[#dadce0] pl-6">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Cost</span>
          <span className="text-[14px] font-semibold text-[#202124]">₹{result.verificationCost}</span>
        </div>
        <div className="flex flex-col border-l border-[#dadce0] pl-6">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Confidence</span>
          <span className="text-[14px] font-semibold text-[#202124]">{result.confidence}</span>
        </div>
        <div className="flex flex-col border-l border-[#dadce0] pl-6">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Status</span>
          <span className={`text-[14px] font-semibold ${getStatusColor(result.verdict)}`}>{result.status}</span>
        </div>
      </div>

      <div className="bg-[#f8f9fa] border border-[#dadce0] rounded p-4 mb-2">
        <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-2 block">System Rationale</span>
        <p className="text-[13px] text-[#202124]">{result.message || 'Verification complete.'}</p>
      </div>

      {isBlindJuryDemo && result.commitReveals && result.commitReveals.length > 0 && (
        <div className="mt-6 border-t border-[#dadce0] pt-4">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-3 block">Blind Jury Consensus</span>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] text-[#202124] border-collapse">
              <thead className="bg-[#f8f9fa] border-b border-[#dadce0] text-[#5f6368]">
                <tr>
                  <th className="py-2 px-3 font-medium">Evaluator</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Score</th>
                  <th className="py-2 px-3 font-medium">Commitment Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dadce0]">
                {result.commitReveals.map((j: CommitRevealData, i: number) => (
                  <tr key={i} className="hover:bg-[#f8f9fa] transition-colors">
                    <td className="py-2 px-3 font-mono text-[#5f6368]">{j.evaluatorId}</td>
                    <td className="py-2 px-3">
                      <span className={j.revealStatus === 'REVEALED' ? 'text-[#1e8e3e] font-semibold' : 'text-[#f9ab00] font-semibold'}>
                        {j.revealStatus}
                      </span>
                    </td>
                    <td className="py-2 px-3">{j.revealedScore !== undefined ? j.revealedScore : '-'}</td>
                    <td className="py-2 px-3 text-[#5f6368] font-mono text-[11px] truncate max-w-[150px]">{j.commitmentHash.substring(0, 16)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
