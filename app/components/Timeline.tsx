'use client';

import React from 'react';
import { DemoStepEvent } from '../../core/orchestrator';

interface TimelineProps {
  steps: DemoStepEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ steps }) => {
  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const isCompleted = step.status === 'COMPLETED';
          const isFailed = step.status === 'FAILED';
          const isUncertain = step.status === 'UNCERTAIN';
          const isActive = step.status === 'ACTIVE';
          const isPending = step.status === 'PENDING';

          let colorClass = 'text-[#5f6368]';
          let bgClass = 'bg-[#f1f3f4]';
          let icon = String(idx + 1);
          
          if (isFailed) { colorClass = 'text-[#d93025]'; bgClass = 'bg-[#fce8e6]'; icon = '!'; }
          else if (isUncertain) { colorClass = 'text-[#f9ab00]'; bgClass = 'bg-[#fef7e0]'; icon = '?'; }
          else if (isCompleted) { colorClass = 'text-[#1e8e3e]'; bgClass = 'bg-[#e6f4ea]'; icon = '✓'; }
          else if (isActive) { colorClass = 'text-[#1a73e8] font-semibold'; bgClass = 'bg-[#e8f0fe] ring-2 ring-[#1a73e8]/20'; icon = '●'; }
          else if (isPending) { icon = '○'; }

          return (
            <React.Fragment key={step.stageName}>
              <div className="flex flex-col items-center gap-2 relative">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] ${bgClass} ${colorClass}`}>
                  {icon}
                </div>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${colorClass}`}>
                  {step.stageName}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-[2px] mx-2 ${isCompleted ? 'bg-[#1e8e3e]' : 'bg-[#dadce0]'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
