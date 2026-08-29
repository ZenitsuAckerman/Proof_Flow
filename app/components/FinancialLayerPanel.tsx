'use client';

import React from 'react';
import { Task } from '../../core/types';

interface FinancialLayerPanelProps {
  task: Task | null;
}

export const FinancialLayerPanel: React.FC<FinancialLayerPanelProps> = ({ task }) => {
  const terms = task?.financialTerms;
  const taskValue = terms?.taskValue || task?.budget || 10000;
  const safeExposure = terms?.safeExposure || 9000;
  const collateralReq = terms?.collateralRequirement || 1000;
  const buyerBondReq = terms?.buyerBondRequirement || 500;
  const riskFactor = terms?.riskFactor ? `${Math.round(terms.riskFactor * 100)}%` : '10%';
  const verifBudget = Math.round(taskValue * 0.10);

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-[#dadce0] bg-[#f8f9fa] flex items-center justify-between">
        <h3 className="font-semibold text-[#202124] text-[15px] uppercase tracking-wider">FINANCIAL UNDERWRITING</h3>
        <span className="text-[12px] bg-white text-[#5f6368] px-3 py-1 rounded border border-[#dadce0] font-mono font-medium">
          Dynamic Risk: {riskFactor}
        </span>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-1">Task Value</span>
            <span className="text-[18px] font-bold text-[#202124]">₹{taskValue.toLocaleString()}</span>
          </div>

          <div className="flex flex-col md:border-l border-[#dadce0] md:pl-4">
            <span className="text-[11px] font-bold text-[#1a73e8] uppercase tracking-wider mb-1">Exposure</span>
            <span className="text-[18px] font-bold text-[#1a73e8]">₹{safeExposure.toLocaleString()}</span>
          </div>

          <div className="flex flex-col border-t md:border-t-0 pt-4 md:pt-0 md:border-l border-[#dadce0] md:pl-4">
            <span className="text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-1">Worker Collateral</span>
            <span className="text-[18px] font-bold text-[#202124]">₹{collateralReq.toLocaleString()}</span>
          </div>

          <div className="flex flex-col border-t md:border-t-0 pt-4 md:pt-0 md:border-l border-[#dadce0] md:pl-4">
            <span className="text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-1">Buyer Bond</span>
            <span className="text-[18px] font-bold text-[#202124]">₹{buyerBondReq.toLocaleString()}</span>
          </div>

          <div className="flex flex-col border-t md:border-t-0 pt-4 md:pt-0 md:border-l border-[#dadce0] md:pl-4">
            <span className="text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-1">Verif Budget</span>
            <span className="text-[18px] font-bold text-[#202124]">₹{verifBudget.toLocaleString()}</span>
          </div>

          <div className="flex flex-col border-t md:border-t-0 pt-4 md:pt-0 md:border-l border-[#dadce0] md:pl-4">
            <span className="text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-1">Risk Factor</span>
            <span className="text-[18px] font-bold text-[#202124]">{riskFactor}</span>
          </div>
        </div>

        <div className="bg-[#f8f9fa] border border-[#dadce0] rounded p-4 text-[13px] text-[#5f6368]">
          <strong className="text-[#202124]">Note:</strong> Exposure represents the portion of the obligation not directly backed by worker collateral. It is not a payout cap.
        </div>
      </div>
    </div>
  );
};
