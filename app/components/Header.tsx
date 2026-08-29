'use client';

import React, { useState } from 'react';

interface HeaderProps {
  isProcessing: boolean;
  onRunDemo: (demoType: 'PRIMARY' | 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN' | 'RESET') => void;
}

export const Header: React.FC<HeaderProps> = ({
  isProcessing,
  onRunDemo
}) => {
  const [showMenu, setShowMenu] = useState(false);
  


  return (
    <header className="w-full bg-white border-b border-[#dadce0] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        
        {/* Left: Branding & Nav */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#1a73e8] rounded-sm flex items-center justify-center">
              <span className="text-white text-xs font-bold">PF</span>
            </div>
            <h1 className="text-[17px] font-semibold text-[#202124] tracking-tight">ProofFlow</h1>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-4">

          <button
            onClick={() => onRunDemo('PRIMARY')}
            disabled={isProcessing}
            className="px-4 py-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-[13px] font-medium rounded shadow-sm transition-colors disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Start Transaction'}
          </button>

          {/* Secondary Controls Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-[#5f6368] hover:bg-[#f1f3f4] rounded transition-colors"
              title="Demo Controls"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
            
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-[#dadce0] rounded shadow-lg py-1 z-50 text-[13px]">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-[#5f6368] uppercase tracking-wider border-b border-[#dadce0]">Judge View Options</div>
                <button onClick={() => { onRunDemo('FAILURE'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-[#f8f9fa] text-[#202124]">Failure Scenario</button>
                <button onClick={() => { onRunDemo('BLIND_JURY'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-[#f8f9fa] text-[#202124]">Blind Jury Demo</button>
                <button onClick={() => { onRunDemo('UNCERTAIN'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-[#f8f9fa] text-[#202124]">Uncertain Scenario</button>
                <div className="border-t border-[#dadce0] my-1" />
                <button onClick={() => { onRunDemo('RESET'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-[#f8f9fa] text-[#d93025]">Reset System State</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
