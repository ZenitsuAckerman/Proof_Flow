'use client';

import React from 'react';

interface CapacityPanelProps {
  initialCapacity: number;
  finalCapacity: number | null;
}

export const CapacityPanel: React.FC<CapacityPanelProps> = ({ initialCapacity, finalCapacity }) => {
  if (finalCapacity === null || initialCapacity === finalCapacity) return null;
  
  const change = finalCapacity - initialCapacity;
  const isPositive = change > 0;
  const isZero = change === 0;

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-[#dadce0] bg-[#f8f9fa]">
        <h3 className="font-semibold text-[#202124] text-[15px] uppercase tracking-wider">PYTHON ECONOMIC CAPACITY</h3>
      </div>
      
      <div className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="text-[13px] text-[#5f6368] max-w-md">
          {isPositive 
            ? "Verified performance increased the worker's future economic capacity for this capability." 
            : "Failed obligation decreased the worker's future economic capacity for this capability."}
        </p>
        
        <div className="flex items-center gap-4 bg-[#f8f9fa] border border-[#dadce0] rounded px-6 py-3 min-w-[280px] justify-center">
          <div className="flex flex-col text-right">
            <span className="text-[11px] font-bold text-[#5f6368] uppercase">Before</span>
            <span className="text-[16px] font-bold text-[#202124]">₹{initialCapacity.toLocaleString()}</span>
          </div>
          <span className="text-[#dadce0] mx-2 text-xl">→</span>
          <div className="flex flex-col text-left">
            <span className="text-[11px] font-bold text-[#5f6368] uppercase">After</span>
            <span className="text-[16px] font-bold text-[#202124]">₹{finalCapacity.toLocaleString()}</span>
          </div>
          <div className={`ml-4 px-2 py-1 rounded text-[14px] font-bold ${isPositive ? 'bg-[#e6f4ea] text-[#1e8e3e]' : isZero ? 'bg-[#f1f3f4] text-[#5f6368]' : 'bg-[#fce8e6] text-[#d93025]'}`}>
            {isPositive ? '+' : ''}{change > 0 ? `₹${change.toLocaleString()}` : isZero ? '0' : `-₹${Math.abs(change).toLocaleString()}`}
          </div>
        </div>
      </div>
    </div>
  );
};
