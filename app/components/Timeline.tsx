'use client';

import React from 'react';
import { DemoStepEvent } from '../../core/orchestrator';

interface TimelineProps {
  steps: DemoStepEvent[];
  currentStepIndex: number;
}

export const Timeline: React.FC<TimelineProps> = ({ steps, currentStepIndex }) => {
  // Map the 12 backend steps to 8 UI stages for clarity as requested
  const stages = [
    { name: 'DISCOVER', maxStep: 1 },
    { name: 'SELECT', maxStep: 2 },
    { name: 'UNDERWRITE', maxStep: 3 },
    { name: 'FUND', maxStep: 5 }, // Escrow & Collateral
    { name: 'WORK', maxStep: 7 }, // Assignment & Execution
    { name: 'VERIFY', maxStep: 9 }, // Proof & Verify
    { name: 'CLEAR', maxStep: 10 },
    { name: 'SETTLE', maxStep: 12 } // Settle & Capacity
  ];

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between">
        {stages.map((stage, idx) => {
          const isActive = currentStepIndex <= stage.maxStep && (idx === 0 || currentStepIndex > stages[idx - 1].maxStep);
          const isCompleted = currentStepIndex > stage.maxStep;
          const isFailed = steps.some(s => s.status === 'FAILED' && s.stepIndex <= stage.maxStep);
          const isUncertain = steps.some(s => s.status === 'UNCERTAIN' && s.stepIndex <= stage.maxStep);

          let colorClass = 'text-[#5f6368]';
          let bgClass = 'bg-[#f1f3f4]';
          
          if (isFailed) { colorClass = 'text-[#d93025]'; bgClass = 'bg-[#fce8e6]'; }
          else if (isUncertain) { colorClass = 'text-[#f9ab00]'; bgClass = 'bg-[#fef7e0]'; }
          else if (isCompleted) { colorClass = 'text-[#1e8e3e]'; bgClass = 'bg-[#e6f4ea]'; }
          else if (isActive) { colorClass = 'text-[#1a73e8] font-semibold'; bgClass = 'bg-[#e8f0fe] ring-2 ring-[#1a73e8]/20'; }

          return (
            <React.Fragment key={stage.name}>
              <div className="flex flex-col items-center gap-2 relative">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] ${bgClass} ${colorClass}`}>
                  {isFailed ? '!' : isUncertain ? '?' : isCompleted ? '✓' : isActive ? '⏳' : (idx + 1)}
                </div>
                <span className={`text-[11px] uppercase tracking-wider ${colorClass}`}>
                  {stage.name}
                </span>
              </div>
              {idx < stages.length - 1 && (
                <div className={`flex-1 h-[2px] mx-2 ${isCompleted ? 'bg-[#1e8e3e]' : 'bg-[#dadce0]'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
