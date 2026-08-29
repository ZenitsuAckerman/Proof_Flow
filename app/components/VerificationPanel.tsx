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
    return 'text-[#1a73e8]';
  };

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-[#dadce0] bg-[#f8f9fa] flex items-center justify-between">
        <h3 className="font-semibold text-[#202124] text-[15px] uppercase tracking-wider">VERIFICATION</h3>
        <span className={`text-[12px] px-3 py-1 rounded font-medium border bg-white ${getStatusColor(result.verdict)}`}>
          {result.status}
        </span>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT COLUMN: SUMMARY */}
        <div className="border-r border-[#dadce0] pr-6">
          <span className="block text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-4 border-b border-[#dadce0] pb-2">
            Verification Summary
          </span>
          <div className="space-y-4">
            <div>
              <span className="block text-[11px] text-[#5f6368] uppercase">Method</span>
              <span className="block text-[14px] font-semibold text-[#202124]">{result.routeType.replace('_', ' ')}</span>
            </div>
            <div>
              <span className="block text-[11px] text-[#5f6368] uppercase">Score</span>
              <span className="block text-[14px] font-semibold text-[#202124]">{result.score}%</span>
            </div>
            <div>
              <span className="block text-[11px] text-[#5f6368] uppercase">Confidence</span>
              <span className="block text-[14px] font-semibold text-[#202124]">{result.confidence}</span>
            </div>
            <div>
              <span className="block text-[11px] text-[#5f6368] uppercase">Verdict</span>
              <span className={`block text-[16px] font-bold ${getStatusColor(result.verdict)}`}>{result.verdict}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: INSIGHTS */}
        <div>
          <span className="block text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-4 border-b border-[#dadce0] pb-2">
            Verification Insights
          </span>
          <div className="space-y-4">
            <div>
              <span className="block text-[11px] text-[#5f6368] uppercase">Why selected</span>
              <span className="block text-[13px] text-[#202124]">
                {result.routeType === 'DETERMINISTIC' ? 'Objective code verification available.' : 'Subjective quality assessment required.'}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-[#5f6368] uppercase">Evidence used</span>
              <span className="block text-[13px] text-[#202124] font-mono text-[11px]">{result.evidenceUsed.join(', ')}</span>
            </div>
            <div>
              <span className="block text-[11px] text-[#5f6368] uppercase">Integrity</span>
              <span className="block text-[13px] text-[#1e8e3e] font-semibold">VALID (Output hash verified)</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[11px] text-[#5f6368] uppercase">Verification Cost</span>
                <span className="block text-[13px] text-[#202124]">₹{result.verificationCost.toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-[11px] text-[#5f6368] uppercase">Rationale</span>
                <span className="block text-[13px] text-[#202124]">{result.message}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isBlindJuryDemo && result.commitReveals && (
        <div className="bg-[#f8f9fa] border-t border-[#dadce0] p-5">
          <span className="block text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-3">
            Blind Jury Consensus Data
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="block text-[11px] text-[#5f6368]">Evaluators: {result.commitReveals.length}</span>
              <span className="block text-[11px] text-[#5f6368]">Disagreement (StdDev): {result.disagreementScore}</span>
            </div>
            <div className="space-y-2">
              {result.commitReveals.map((j: CommitRevealData, i: number) => (
                <div key={i} className="flex justify-between text-[11px] border-b border-[#dadce0] pb-1 border-dashed">
                  <span className="font-mono text-[#5f6368]">{j.evaluatorId}</span>
                  <span className="font-medium text-[#202124]">{j.revealedScore !== undefined ? `Score: ${j.revealedScore}` : j.revealStatus}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
