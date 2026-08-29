import { TextEncoder, TextDecoder } from 'util';
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).TextDecoder = TextDecoder;
}

import { runH0X402FeasibilitySpike, formatH0Report, MAX_H0_PAYMENT_USDC } from './h0-x402-spike';

describe('Phase H0: x402 Real Payment Feasibility Spike Safety & Validation Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('1. Rejects payment when X402_PRIVATE_KEY environment variable is missing', async () => {
    delete process.env.X402_PRIVATE_KEY;
    const result = await runH0X402FeasibilitySpike();
    expect(result.status).toBe('FAILED');
    expect(result.reason).toContain('MISSING_CREDENTIALS');
  });

  it('2. Rejects payment when X402_PAYEE_ADDRESS is invalid', async () => {
    process.env.X402_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
    process.env.X402_PAYEE_ADDRESS = 'invalid-address-string';
    
    const result = await runH0X402FeasibilitySpike();
    expect(result.status).toBe('FAILED');
    expect(result.reason).toContain('INVALID_PAYEE');
  });

  it('3. Enforces safety limit MAX_H0_PAYMENT_USDC (rejects oversized amounts)', async () => {
    process.env.X402_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
    process.env.X402_PAYEE_ADDRESS = '0x1111111111111111111111111111111111111111';

    const result = await runH0X402FeasibilitySpike({ amount: MAX_H0_PAYMENT_USDC + 10.0 });
    expect(result.status).toBe('FAILED');
    expect(result.reason).toContain('SAFETY_LIMIT_EXCEEDED');
  });

  it('4. Rejects zero or negative payment amounts', async () => {
    process.env.X402_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
    process.env.X402_PAYEE_ADDRESS = '0x1111111111111111111111111111111111111111';

    const result = await runH0X402FeasibilitySpike({ amount: 0 });
    expect(result.status).toBe('FAILED');
    expect(result.reason).toContain('SAFETY_LIMIT_EXCEEDED');
  });

  it('5. Formats failure report cleanly for CLI presentation', () => {
    const report = formatH0Report({
      status: 'FAILED',
      reason: 'MISSING_CREDENTIALS: X402_PRIVATE_KEY environment variable is missing or invalid'
    });
    expect(report).toContain('PROOFFLOW H0 — X402 FEASIBILITY RESULT');
    expect(report).toContain('Status: FAILED');
    expect(report).toContain('MISSING_CREDENTIALS');
  });

  it('6. Formats success report cleanly when receipt is provided', () => {
    const report = formatH0Report({
      status: 'SUCCESS',
      receipt: {
        paymentId: 'PAY-X402-TEST',
        payer: '0xPayerAddress',
        payee: '0xPayeeAddress',
        amount: 0.001,
        asset: 'USDC',
        network: 'Base Sepolia (Chain ID 84532)',
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        explorerUrl: 'https://sepolia.basescan.org/tx/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        isTestnet: true,
        rail: 'x402-evm-base-sepolia'
      }
    });
    expect(report).toContain('Status: SUCCESS');
    expect(report).toContain('Transaction Hash:');
    expect(report).toContain('Receipt Verified:\nYES');
    expect(report).toContain('External Settlement:\nCONFIRMED');
  });
});
