'use client';

import React from 'react';
import { SettlementInstruction } from '../../core/types';

interface ClearingSettlementPanelProps {
  instruction: SettlementInstruction | null;
}

export const ClearingSettlementPanel: React.FC<ClearingSettlementPanelProps> = ({ instruction }) => {
  if (!instruction) return null;

  const isRefund = instruction.buyerRefund > 0;
  const isSlashed = instruction.collateralSlashed > 0;

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm p-6 mb-6">
      <div className="border-b border-[#dadce0] pb-4 mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-[#202124]">Clearing & Settlement Instructions</h3>
          <p className="text-[13px] text-[#5f6368] mt-1">Deterministic financial routing based on verification output.</p>
        </div>
        <span className="text-[12px] bg-[#f8f9fa] text-[#5f6368] px-3 py-1 rounded font-medium border border-[#dadce0]">
          {instruction.verdict}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Worker Payout</span>
          <span className="text-[16px] font-semibold text-[#1e8e3e]">₹{instruction.workerAmount.toLocaleString()}</span>
        </div>
        
        <div className="flex flex-col border-l border-[#dadce0] pl-6">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Buyer Refund</span>
          <span className={`text-[16px] font-semibold ${isRefund ? 'text-[#1a73e8]' : 'text-[#202124]'}`}>
            ₹{instruction.buyerRefund.toLocaleString()}
          </span>
        </div>
        
        <div className="flex flex-col border-l border-[#dadce0] pl-6">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Collateral Slashed</span>
          <span className={`text-[16px] font-semibold ${isSlashed ? 'text-[#d93025]' : 'text-[#202124]'}`}>
            ₹{instruction.collateralSlashed.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col border-l border-[#dadce0] pl-6">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Evaluator Payouts</span>
          <span className="text-[16px] font-semibold text-[#202124]">
            ₹{instruction.evaluatorAmount.toLocaleString()}
          </span>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-[#dadce0]">
        <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1 block">Reasoning</span>
        <span className="text-[13px] text-[#202124]">{instruction.reason}</span>
      </div>
    </div>
  );
};
