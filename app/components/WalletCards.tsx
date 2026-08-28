'use client';

import React from 'react';

export interface WalletViewItem {
  id: string;
  agentId: string;
  agentName?: string;
  agentRole?: string;
  availableBalance: number;
  lockedBalance: number;
}

interface WalletCardsProps {
  wallets: WalletViewItem[];
}

export const WalletCards: React.FC<WalletCardsProps> = ({ wallets }) => {
  const buyerWallet = wallets.find(w => w.agentId === 'AGENT-BUYER-1') || {
    id: 'W-BUYER', agentId: 'AGENT-BUYER-1', agentName: 'Autonomous Buyer Agent', agentRole: 'BUYER', availableBalance: 50000, lockedBalance: 0
  };

  const workerWallet = wallets.find(w => w.agentId === 'AGENT-WORKER-1' || w.agentId === 'AGENT-WORKER-2') || {
    id: 'W-WORKER', agentId: 'AGENT-WORKER-1', agentName: 'PyCoder Pro', agentRole: 'WORKER', availableBalance: 20000, lockedBalance: 0
  };

  const protocolWallet = wallets.find(w => w.agentId === 'PROTOCOL-TREASURY') || {
    id: 'W-PROTOCOL', agentId: 'PROTOCOL-TREASURY', agentName: 'ProofFlow Protocol Treasury', agentRole: 'PROTOCOL', availableBalance: 0, lockedBalance: 0
  };

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm p-6 mb-6">
      <div className="border-b border-[#dadce0] pb-4 mb-6">
        <h3 className="text-[15px] font-semibold text-[#202124]">Participant Wallets</h3>
        <p className="text-[13px] text-[#5f6368] mt-1">Live account balances reflecting state changes during transaction execution.</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Buyer Row */}
        <div className="flex items-center justify-between p-4 bg-[#f8f9fa] border border-[#dadce0] rounded">
          <div className="flex flex-col w-1/4">
            <span className="text-[13px] font-semibold text-[#202124]">Buyer</span>
            <span className="text-[11px] text-[#5f6368]">{buyerWallet.agentId}</span>
          </div>
          <div className="flex flex-1 items-center justify-around text-[13px]">
            <div className="flex flex-col">
              <span className="text-[#5f6368]">Total</span>
              <span className="font-semibold text-[#202124]">₹{(buyerWallet.availableBalance + buyerWallet.lockedBalance).toLocaleString()}</span>
            </div>
            <span className="text-[#dadce0]">→</span>
            <div className="flex flex-col text-center">
              <span className="text-[#5f6368]">Locked (Escrow+Bond)</span>
              <span className="font-semibold text-[#f9ab00]">₹{buyerWallet.lockedBalance.toLocaleString()}</span>
            </div>
            <span className="text-[#dadce0]">→</span>
            <div className="flex flex-col text-right">
              <span className="text-[#5f6368]">Available</span>
              <span className="font-semibold text-[#1a73e8]">₹{buyerWallet.availableBalance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Worker Row */}
        <div className="flex items-center justify-between p-4 bg-[#f8f9fa] border border-[#dadce0] rounded">
          <div className="flex flex-col w-1/4">
            <span className="text-[13px] font-semibold text-[#202124]">Worker</span>
            <span className="text-[11px] text-[#5f6368]">{workerWallet.agentId}</span>
          </div>
          <div className="flex flex-1 items-center justify-around text-[13px]">
            <div className="flex flex-col">
              <span className="text-[#5f6368]">Total</span>
              <span className="font-semibold text-[#202124]">₹{(workerWallet.availableBalance + workerWallet.lockedBalance).toLocaleString()}</span>
            </div>
            <span className="text-[#dadce0]">→</span>
            <div className="flex flex-col text-center">
              <span className="text-[#5f6368]">Locked (Collateral)</span>
              <span className="font-semibold text-[#f9ab00]">₹{workerWallet.lockedBalance.toLocaleString()}</span>
            </div>
            <span className="text-[#dadce0]">→</span>
            <div className="flex flex-col text-right">
              <span className="text-[#5f6368]">Available</span>
              <span className="font-semibold text-[#1e8e3e]">₹{workerWallet.availableBalance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Protocol Row */}
        {(protocolWallet.availableBalance > 0 || protocolWallet.lockedBalance > 0) && (
          <div className="flex items-center justify-between p-4 bg-[#f8f9fa] border border-[#dadce0] rounded">
            <div className="flex flex-col w-1/4">
              <span className="text-[13px] font-semibold text-[#202124]">Protocol Treasury</span>
              <span className="text-[11px] text-[#5f6368]">{protocolWallet.agentId}</span>
            </div>
            <div className="flex flex-1 items-center justify-end text-[13px]">
              <div className="flex flex-col text-right">
                <span className="text-[#5f6368]">Collected Fees</span>
                <span className="font-semibold text-[#d93025]">₹{protocolWallet.availableBalance.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
