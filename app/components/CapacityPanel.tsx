'use client';

import React from 'react';

interface CapacityPanelProps {
  initialCapacity: number;
  finalCapacity: number | null;
}

export const CapacityPanel: React.FC<CapacityPanelProps> = ({ initialCapacity, finalCapacity }) => {
  if (finalCapacity === null) return null;
  
  const change = finalCapacity - initialCapacity;
  const isPositive = change > 0;
  const isZero = change === 0;

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-[#202124]">Economic Capacity Update</h3>
          <p className="text-[13px] text-[#5f6368] mt-1">Post-settlement capability limits adjustment for the Worker Agent.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-[#f8f9fa] border border-[#dadce0] rounded px-4 py-2">
          <div className="flex flex-col text-right">
            <span className="text-[11px] font-medium text-[#5f6368] uppercase">Before</span>
            <span className="text-[14px] font-semibold text-[#202124]">₹{initialCapacity.toLocaleString()}</span>
          </div>
          <span className="text-[#dadce0] mx-2">→</span>
          <div className="flex flex-col text-left">
            <span className="text-[11px] font-medium text-[#5f6368] uppercase">After</span>
            <span className="text-[14px] font-semibold text-[#202124]">₹{finalCapacity.toLocaleString()}</span>
          </div>
          <div className={`ml-4 px-2 py-1 rounded text-[12px] font-bold ${isPositive ? 'bg-[#e6f4ea] text-[#1e8e3e]' : isZero ? 'bg-[#f1f3f4] text-[#5f6368]' : 'bg-[#fce8e6] text-[#d93025]'}`}>
            {isPositive ? '+' : ''}{change > 0 ? `₹${change.toLocaleString()}` : isZero ? '0' : `-₹${Math.abs(change).toLocaleString()}`}
          </div>
        </div>
      </div>
    </div>
  );
};
