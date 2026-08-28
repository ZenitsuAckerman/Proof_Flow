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
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between border-b border-[#dadce0] pb-4 mb-6">
        <div>
          <h3 className="text-[15px] font-semibold text-[#202124]">Financial Underwriting</h3>
          <p className="text-[13px] text-[#5f6368] mt-1">Capital is released only after the obligation satisfies its verification conditions.</p>
        </div>
        <span className="text-[12px] bg-[#f8f9fa] text-[#5f6368] px-3 py-1 rounded border border-[#dadce0] font-mono">
          Policy: Dynamic Risk ({riskFactor})
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Task Value</span>
          <span className="text-[20px] font-semibold text-[#202124]">₹{taskValue.toLocaleString()}</span>
        </div>

        <div className="flex flex-col border-l border-[#dadce0] pl-6">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Exposure</span>
          <span className="text-[20px] font-semibold text-[#1a73e8]">₹{safeExposure.toLocaleString()}</span>
        </div>

        <div className="flex flex-col border-l border-[#dadce0] pl-6">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Worker Collateral</span>
          <span className="text-[20px] font-semibold text-[#202124]">₹{collateralReq.toLocaleString()}</span>
        </div>

        <div className="flex flex-col border-l border-[#dadce0] pl-6">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Buyer Bond</span>
          <span className="text-[20px] font-semibold text-[#202124]">₹{buyerBondReq.toLocaleString()}</span>
        </div>

        <div className="flex flex-col border-l border-[#dadce0] pl-6">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Verif Budget</span>
          <span className="text-[20px] font-semibold text-[#202124]">₹{verifBudget.toLocaleString()}</span>
        </div>

        <div className="flex flex-col border-l border-[#dadce0] pl-6">
          <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-1">Risk</span>
          <span className="text-[20px] font-semibold text-[#202124]">{riskFactor}</span>
        </div>
      </div>
    </div>
  );
};
