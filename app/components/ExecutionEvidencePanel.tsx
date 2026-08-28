'use client';

import React from 'react';

interface ExecutionEvidencePanelProps {
  isFailureDemo?: boolean;
}

export const ExecutionEvidencePanel: React.FC<ExecutionEvidencePanelProps> = ({ isFailureDemo }) => {
  const passCount = isFailureDemo ? 1 : 5;
  const totalCount = 5;
  const statusColor = isFailureDemo ? 'text-[#d93025]' : 'text-[#1e8e3e]';

  const codeSnippet = isFailureDemo
    ? `def process_payment(amount, risk_score):\n    # BUG: Incorrect risk deduction formula causing negative output\n    return amount - (risk_score * 1000)`
    : `def process_payment(amount, risk_score):\n    # Deterministic risk deduction formula\n    deduction = Math.round(amount * (risk_score / 100.0))\n    return max(0, amount - deduction)`;

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm p-6 mb-6">
      <div className="border-b border-[#dadce0] pb-4 mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-[#202124]">Execution & Technical Evidence</h3>
          <p className="text-[13px] text-[#5f6368] mt-1">Worker submitted execution artifact and verification payload.</p>
        </div>
        <span className={`text-[12px] px-3 py-1 rounded font-medium border ${isFailureDemo ? 'bg-[#fce8e6] text-[#d93025] border-[#f8d0cb]' : 'bg-[#e6f4ea] text-[#1e8e3e] border-[#ceead6]'}`}>
          {isFailureDemo ? 'EXECUTION FAILED' : 'EXECUTION COMPLETED'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Code Snippet */}
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-2">Output Artifact</span>
          <pre className="p-3 bg-[#f8f9fa] border border-[#dadce0] rounded text-[12px] font-mono text-[#202124] overflow-x-auto">
            {codeSnippet}
          </pre>
        </div>

        {/* Evidence Package */}
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-2">Integrity Verified Payload</span>
          
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center text-[13px] border-b border-[#f1f3f4] pb-2">
              <span className="text-[#5f6368]">Test Suite Result</span>
              <span className={`font-semibold ${statusColor}`}>{passCount} / {totalCount} passed</span>
            </div>
            <div className="flex justify-between items-center text-[13px] border-b border-[#f1f3f4] pb-2">
              <span className="text-[#5f6368]">Output Status</span>
              <span className="font-medium text-[#202124]">Verified</span>
            </div>
            <div className="flex justify-between items-center text-[13px] border-b border-[#f1f3f4] pb-2">
              <span className="text-[#5f6368]">Output Hash (SHA-256)</span>
              <span className="font-mono text-[#1a73e8]">bb94368a43c2c4ac...</span>
            </div>
            <div className="flex justify-between items-center text-[13px] border-b border-[#f1f3f4] pb-2">
              <span className="text-[#5f6368]">Evidence Hash (SHA-256)</span>
              <span className="font-mono text-[#1a73e8]">e3b0c44298fc1c14...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
