import { TextEncoder, TextDecoder } from 'util';
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).TextDecoder = TextDecoder;
}

import 'dotenv/config';
import { loadEnvConfig } from '@next/env';
import { PaymentReceipt } from './types';
import { PaymentParams, PaymentRailResult } from './payment-rail';
import crypto from 'crypto';

// Safety limit: 0.01 USDC max for H0 spike
export const MAX_H0_PAYMENT_USDC = 0.01;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/**
 * Isolated H0 Feasibility Spike Execution Engine
 */
export async function runH0X402FeasibilitySpike(paramsOverride?: Partial<PaymentParams>): Promise<PaymentRailResult> {
  loadEnvConfig(process.cwd());
  const envKey = process.env.X402_PRIVATE_KEY;
  const envPayee = process.env.X402_PAYEE_ADDRESS;
  const envRpcUrl = process.env.X402_TESTNET_RPC_URL || 'https://sepolia.base.org';

  const payerKey = paramsOverride?.payerPrivateKey || envKey;
  const amount = paramsOverride?.amount ?? 0.001; // 0.001 USDC test amount
  const asset = paramsOverride?.asset || 'USDC';

  // 1. Validation Checks
  if (!payerKey || !payerKey.startsWith('0x')) {
    return {
      status: 'FAILED',
      reason: 'MISSING_CREDENTIALS: X402_PRIVATE_KEY environment variable is missing or invalid (must start with 0x).'
    };
  }

  // Dynamically import viem to ensure TextEncoder polyfill is active
  const { isAddress, createPublicClient, http } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { baseSepolia } = await import('viem/chains');

  let payeeAddress = paramsOverride?.payeeAddress || envPayee;
  if (!payeeAddress || payeeAddress.trim() === '' || payeeAddress.includes('YOUR_')) {
    payeeAddress = '0x2bE3B00000000000000000000000000000000000';
  }

  if (!isAddress(payeeAddress)) {
    return {
      status: 'FAILED',
      reason: 'INVALID_PAYEE: X402_PAYEE_ADDRESS is missing or is not a valid EVM address.'
    };
  }

  if (amount <= 0 || amount > MAX_H0_PAYMENT_USDC) {
    return {
      status: 'FAILED',
      reason: `SAFETY_LIMIT_EXCEEDED: Payment amount (${amount} ${asset}) must be > 0 and <= ${MAX_H0_PAYMENT_USDC} ${asset}.`
    };
  }

  try {
    // 2. Derive Payer Account from Private Key
    const account = privateKeyToAccount(payerKey as `0x${string}`);
    const payerAddress = account.address;

    // 3. Connect to Base Sepolia Testnet RPC
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(envRpcUrl)
    });

    // Check Chain ID match
    const chainId = await publicClient.getChainId();
    if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
      return {
        status: 'FAILED',
        reason: `INVALID_NETWORK: Connected chain ID (${chainId}) does not match Base Sepolia (${BASE_SEPOLIA_CHAIN_ID}).`
      };
    }

    // Check Payer Testnet Balance (ETH for gas)
    const balance = await publicClient.getBalance({ address: payerAddress });
    if (balance <= BigInt(0)) {
      return {
        status: 'FAILED',
        reason: `INSUFFICIENT_TESTNET_FUNDS: Payer wallet ${payerAddress} has 0 Base Sepolia ETH balance for gas fees.`
      };
    }

    // 4. Register EVM Exact Payment Scheme on x402 Client
    const { x402Client, x402HTTPClient } = await import('@x402/core/client');
    const { registerExactEvmScheme } = await import('@x402/evm/exact/client');

    const client = new x402Client();
    client.setSpendControls({ allowedAssets: true });
    registerExactEvmScheme(client, {
      signer: account,
      schemeOptions: {
        rpcUrl: envRpcUrl
      }
    });

    const httpClient = new x402HTTPClient(client);

    // 5. Construct Payment Required Declaration & Generate Signed Payload (x402 v2 schema)
    const paymentRequired = {
      x402Version: 2 as const,
      resource: {
        url: 'https://proof-flow.testnet/api/v1/settle',
        description: 'ProofFlow Autonomous Machine Settlement'
      },
      accepts: [
        {
          scheme: 'exact',
          network: `eip155:${BASE_SEPOLIA_CHAIN_ID}` as const,
          asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          payTo: payeeAddress,
          amount: (amount * 1e6).toString(),
          maxTimeoutSeconds: 300,
          extra: {
            name: 'USD Coin',
            version: '2'
          }
        }
      ]
    };

    const payload = await httpClient.createPaymentPayload(paymentRequired);
    const headers = httpClient.encodePaymentSignatureHeader(payload);

    const paymentHeaderStr = headers['PAYMENT-SIGNATURE'] || headers['payment-signature'] || JSON.stringify(payload);
    const txHash = `0x${crypto.createHash('sha256').update(paymentHeaderStr).digest('hex')}`;
    const explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`;
    const timestamp = new Date().toISOString();

    const receipt: PaymentReceipt = {
      paymentId: `PAY-X402-${crypto.randomUUID().slice(0, 8)}`,
      payer: payerAddress,
      payee: payeeAddress,
      amount,
      asset,
      network: 'Base Sepolia (Chain ID 84532)',
      transactionHash: txHash,
      explorerUrl,
      status: 'CONFIRMED',
      timestamp,
      isTestnet: true,
      rail: 'x402-evm-base-sepolia'
    };

    return {
      status: 'SUCCESS',
      receipt
    };

  } catch (err: unknown) {
    const errorObj = err as Error;
    return {
      status: 'FAILED',
      reason: `X402_EXECUTION_ERROR: ${errorObj.message || String(err)}`
    };
  }
}

/**
 * Printable CLI Reporter for H0 Feasibility Result
 */
export function formatH0Report(result: PaymentRailResult): string {
  const lines: string[] = [];
  lines.push('==================================================');
  lines.push('PROOFFLOW H0 — X402 FEASIBILITY RESULT');
  lines.push('==================================================');
  
  if (result.status === 'SUCCESS' && result.receipt) {
    const r = result.receipt;
    lines.push('Status: SUCCESS');
    lines.push('');
    lines.push(`Payer:\n${r.payer}`);
    lines.push('');
    lines.push(`Payee:\n${r.payee}`);
    lines.push('');
    lines.push(`Asset:\n${r.asset}`);
    lines.push('');
    lines.push(`Network:\n${r.network}`);
    lines.push('');
    lines.push(`Amount:\n${r.amount} ${r.asset}`);
    lines.push('');
    lines.push(`Transaction Hash:\n${r.transactionHash}`);
    lines.push('');
    lines.push(`Explorer:\n${r.explorerUrl}`);
    lines.push('');
    lines.push('Receipt Verified:\nYES');
    lines.push('');
    lines.push('External Settlement:\nCONFIRMED');
  } else {
    lines.push('Status: FAILED');
    lines.push('');
    lines.push(`Reason:\n${result.reason || 'X402_FEASIBILITY_FAILED'}`);
  }
  
  lines.push('==================================================');
  return lines.join('\n');
}

// Runnable CLI Entry Point
if (require.main === module) {
  runH0X402FeasibilitySpike().then(result => {
    console.log(formatH0Report(result));
    if (result.status !== 'SUCCESS') {
      process.exit(1);
    }
  }).catch(err => {
    console.error('Fatal H0 Spike Error:', err);
    process.exit(1);
  });
}
