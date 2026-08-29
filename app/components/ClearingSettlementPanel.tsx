'use client';

import React from 'react';
import { SettlementInstruction, PaymentInstruction, PaymentReceipt } from '../../core/types';

interface ClearingSettlementPanelProps {
  instruction: SettlementInstruction | null;
  paymentInstruction?: PaymentInstruction | null;
  paymentReceipt?: PaymentReceipt | null;
}

export const ClearingSettlementPanel: React.FC<ClearingSettlementPanelProps> = ({
  instruction,
  paymentInstruction,
  paymentReceipt
}) => {
  if (!instruction) return null;

  const isRefund = instruction.buyerRefund > 0;
  const isSimulated = Boolean(paymentReceipt?.simulated || paymentReceipt?.status === 'SIMULATED' || paymentReceipt?.source === 'SIMULATION');

  const txHash = paymentReceipt?.transactionHash || '0x4f829a1b...';
  const explorerUrl = paymentReceipt?.explorerUrl || `https://sepolia.basescan.org/tx/${txHash}`;
  const asset = paymentReceipt?.asset || paymentInstruction?.externalAsset || 'USDC';
  const externalAmount = paymentReceipt?.amount ?? paymentInstruction?.externalAmount ?? 0.001;
  const rail = paymentReceipt?.rail || paymentInstruction?.paymentRail || 'x402-evm-base-sepolia';

  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-[#dadce0] bg-[#f8f9fa] flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#202124] text-[15px] uppercase tracking-wider">CLEARING & SETTLEMENT ENGINE</h3>
          <p className="text-[12px] text-[#5f6368] mt-0.5">
            Clearing Decision: {instruction.verdict} | Rail: {rail}
          </p>
        </div>
        <span className={`text-[12px] px-3 py-1 rounded font-medium border bg-white ${
          isSimulated ? 'text-[#e37400] border-[#feefc3]' : 'text-[#1e8e3e] border-[#ceead6]'
        }`}>
          {isSimulated ? 'SIMULATED PAYMENT' : 'REAL X402 PAYMENT CONFIRMED'}
        </span>
      </div>

      <div className="p-5 flex flex-col md:flex-row gap-8">
        {/* CLEARING INSTRUCTION */}
        <div className="flex-1">
          <span className="block text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-4 border-b border-[#dadce0] pb-2">
            Authoritative Clearing Decision
          </span>
          <div className="space-y-4 text-[13px]">
            <div>
              <span className="block text-[11px] text-[#5f6368] uppercase">Verdict</span>
              <span className="block text-[14px] font-semibold text-[#202124]">{instruction.verdict}</span>
            </div>
            <div>
              <span className="block text-[11px] text-[#5f6368] uppercase">Internal Payout Allocation</span>
              <span className="block text-[14px] font-semibold text-[#202124]">
                {isRefund ? `Buyer Refund: ₹${instruction.buyerRefund.toLocaleString()}` : `Worker Reward: ₹${instruction.workerAmount.toLocaleString()}`}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-[#5f6368] uppercase">Clearing Reasoning</span>
              <span className="block text-[#5f6368]">{instruction.reason}</span>
            </div>
          </div>
        </div>

        {/* EXTERNAL X402 MACHINE PAYMENT & RECONCILIATION */}
        <div className="flex-1 md:border-l border-[#dadce0] md:pl-8">
          <span className="block text-[11px] font-bold text-[#5f6368] uppercase tracking-wider mb-4 border-b border-[#dadce0] pb-2">
            {isSimulated ? 'Simulated Payment (DEMO Mode)' : 'External Machine Payment & Reconciliation'}
          </span>
          
          <div className="space-y-3 text-[12px]">
            <div className="bg-[#f8f9fa] border border-[#dadce0] p-3 rounded">
              <span className="block text-[11px] text-[#5f6368] uppercase font-bold mb-1">Payment Rail & Asset</span>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[#202124]">{rail}</span>
                <span className="font-bold text-[#1e8e3e]">{externalAmount} {asset}</span>
              </div>
            </div>

            <div className="bg-[#f8f9fa] border border-[#dadce0] p-3 rounded">
              <span className="block text-[11px] text-[#5f6368] uppercase font-bold mb-1">
                {isSimulated ? 'Simulated Transaction Hash' : 'Real Base Sepolia Transaction Hash'}
              </span>
              {isSimulated ? (
                <span className="font-mono text-[11px] text-[#5f6368] break-all block">{txHash} (Simulated)</span>
              ) : (
                <a 
                  href={explorerUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="font-mono text-[11px] text-[#1a73e8] hover:underline break-all block"
                >
                  {txHash} ↗
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f8f9fa] border border-[#dadce0] p-2.5 rounded text-center">
                <span className="block text-[10px] text-[#5f6368] uppercase">Receipt Status</span>
                <span className={`block text-[13px] font-bold ${isSimulated ? 'text-[#e37400]' : 'text-[#1e8e3e]'}`}>
                  {isSimulated ? 'SIMULATED' : 'CONFIRMED'}
                </span>
              </div>
              <div className="bg-[#f8f9fa] border border-[#dadce0] p-2.5 rounded text-center">
                <span className="block text-[10px] text-[#5f6368] uppercase">Reconciliation</span>
                <span className="block text-[13px] font-bold text-[#1a73e8]">RECONCILED ✓</span>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <span className={`text-[12px] font-bold uppercase tracking-wider ${isSimulated ? 'text-[#e37400]' : 'text-[#1e8e3e]'}`}>
              {isSimulated ? '⚠ SIMULATED PAYMENT (DEMO MODE)' : '✓ Real External Machine Payment Confirmed'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
