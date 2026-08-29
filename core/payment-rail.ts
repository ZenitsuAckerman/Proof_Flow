import { PaymentReceipt } from './types';

export interface PaymentParams {
  payerPrivateKey?: string;
  payerAgentId?: string;
  payeeAgentId?: string;
  payerAddress?: string;
  payeeAddress: string;
  amount: number; // Asset amount (e.g. 0.001 USDC)
  asset: string;  // e.g. 'USDC'
  network: string; // e.g. 'base-sepolia' (Chain ID 84532)
  taskId?: string;
}

export interface PaymentRailResult {
  status: 'SUCCESS' | 'FAILED';
  success?: boolean;
  receipt?: PaymentReceipt;
  reason?: string;
  message?: string;
}

export interface PaymentRail {
  railKey: string;
  pay?(params: PaymentParams): Promise<PaymentRailResult>;
  executePayment(params: PaymentParams): Promise<PaymentRailResult>;
  verifyReceipt(receipt: PaymentReceipt): Promise<{ valid: boolean; reason?: string }>;
  verify?(receipt: PaymentReceipt): Promise<{ valid: boolean; reason?: string }>;
}
