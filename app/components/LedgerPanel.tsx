'use client';

import React from 'react';
import { Transaction } from '../../core/types';

interface LedgerPanelProps {
  transactions: Transaction[];
}

export const LedgerPanel: React.FC<LedgerPanelProps> = ({ transactions }) => {
  return (
    <div className="w-full bg-white border border-[#dadce0] rounded shadow-sm p-6 mb-6">
      <div className="border-b border-[#dadce0] pb-4 mb-4">
        <h3 className="text-[15px] font-semibold text-[#202124]">Atomic Transaction Ledger</h3>
        <p className="text-[13px] text-[#5f6368] mt-1">Immutable record of all financial state transitions.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] text-[#202124] border-collapse">
          <thead className="bg-[#f8f9fa] border-b border-[#dadce0] text-[#5f6368]">
            <tr>
              <th className="py-2 px-3 font-medium">TxID</th>
              <th className="py-2 px-3 font-medium">Timestamp</th>
              <th className="py-2 px-3 font-medium">Type</th>
              <th className="py-2 px-3 font-medium">From</th>
              <th className="py-2 px-3 font-medium">To</th>
              <th className="py-2 px-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dadce0]">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-[#f8f9fa] transition-colors">
                <td className="py-2 px-3 font-mono text-[#5f6368] text-[11px]">{tx.id.substring(0, 8)}...</td>
                <td className="py-2 px-3 text-[#5f6368] text-[11px]">
                  {new Date(tx.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 })}
                </td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider
                    ${tx.transactionType === 'ESCROW_FUND' ? 'bg-[#e8f0fe] text-[#1a73e8]' : 
                      tx.transactionType === 'COLLATERAL_LOCK' ? 'bg-[#fef7e0] text-[#f9ab00]' : 
                      tx.transactionType === 'BOND_LOCK' ? 'bg-[#f3e8fd] text-[#9334e6]' : 
                      tx.transactionType === 'WORKER_REWARD' ? 'bg-[#e6f4ea] text-[#1e8e3e]' : 
                      tx.transactionType === 'REFUND' ? 'bg-[#f1f3f4] text-[#5f6368]' : 
                      'bg-[#fce8e6] text-[#d93025]'}`}>
                    {tx.transactionType}
                  </span>
                </td>
                <td className="py-2 px-3 font-mono text-[#5f6368] text-[11px]">{tx.fromWalletId || '-'}</td>
                <td className="py-2 px-3 font-mono text-[#5f6368] text-[11px]">{tx.toWalletId || '-'}</td>
                <td className="py-2 px-3 font-semibold text-right">₹{tx.amount.toLocaleString()}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#5f6368] italic">No transactions recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
