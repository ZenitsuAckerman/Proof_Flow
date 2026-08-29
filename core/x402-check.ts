import 'dotenv/config';
import { loadEnvConfig } from '@next/env';
import fs from 'fs';
import path from 'path';

export async function runX402Check(): Promise<void> {
  loadEnvConfig(process.cwd());

  console.log('==================================================');
  console.log('PROOFFLOW X402 CONFIGURATION & BALANCE CHECK');
  console.log('==================================================');

  const { isAddress, createPublicClient, http, formatEther, formatUnits } = await import('viem');
  const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts');
  const { baseSepolia } = await import('viem/chains');

  const envPath = path.join(process.cwd(), '.env');
  let currentKey = process.env.X402_PRIVATE_KEY;
  let currentPayee = process.env.X402_PAYEE_ADDRESS;

  // Check if current key is valid or placeholder
  const isKeyValid = Boolean(currentKey && currentKey.startsWith('0x') && currentKey.length === 66 && !currentKey.includes('YOUR_'));
  const isPayeeValid = Boolean(currentPayee && isAddress(currentPayee) && !currentPayee.includes('YOUR_'));

  if (!isKeyValid || !isPayeeValid) {
    const generatedPayerKey = isKeyValid ? currentKey! : generatePrivateKey();

    let generatedPayeeAddress = isPayeeValid ? currentPayee! : '';
    if (!isPayeeValid) {
      const generatedPayeeKey = generatePrivateKey();
      const generatedPayeeAccount = privateKeyToAccount(generatedPayeeKey as `0x${string}`);
      generatedPayeeAddress = generatedPayeeAccount.address;
    }

    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    
    if (envContent.includes('X402_PRIVATE_KEY=')) {
      envContent = envContent.replace(/X402_PRIVATE_KEY=.*/g, `X402_PRIVATE_KEY=${generatedPayerKey}`);
    } else {
      envContent += `\nX402_PRIVATE_KEY=${generatedPayerKey}\n`;
    }

    if (envContent.includes('X402_PAYEE_ADDRESS=')) {
      envContent = envContent.replace(/X402_PAYEE_ADDRESS=.*/g, `X402_PAYEE_ADDRESS=${generatedPayeeAddress}`);
    } else {
      envContent += `\nX402_PAYEE_ADDRESS=${generatedPayeeAddress}\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    
    process.env.X402_PRIVATE_KEY = generatedPayerKey;
    process.env.X402_PAYEE_ADDRESS = generatedPayeeAddress;
    currentKey = generatedPayerKey;
    currentPayee = generatedPayeeAddress;
  }

  const payerAccount = privateKeyToAccount(currentKey as `0x${string}`);
  const payerAddress = payerAccount.address;
  const payeeAddress = currentPayee || '0x2bE3B00000000000000000000000000000000000';

  console.log('X402_PRIVATE_KEY:');
  console.log('SET');
  console.log('');
  console.log('Payer:');
  console.log(payerAddress);
  console.log('');
  console.log('Payee:');
  console.log(payeeAddress);
  console.log('');
  console.log('Network:');
  console.log('Base Sepolia');
  console.log('');
  console.log('Chain ID:');
  console.log('84532');
  console.log('');

  const rpcUrl = process.env.X402_TESTNET_RPC_URL || 'https://sepolia.base.org';
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl)
  });

  let ethBalance = BigInt(0);
  try {
    ethBalance = await publicClient.getBalance({ address: payerAddress });
  } catch (err: unknown) {
    const errorObj = err as Error;
    console.log(`RPC Connection Warning: Could not fetch balance from ${rpcUrl} (${errorObj.message || String(err)})`);
  }

  const formattedEth = formatEther(ethBalance);
  console.log('Base Sepolia ETH:');
  console.log(`${formattedEth} ETH`);

  let usdcBalanceStr = '0.000000';
  try {
    const usdcContractAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
    const usdcBalance = await publicClient.readContract({
      address: usdcContractAddress,
      abi: [{
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
      }],
      functionName: 'balanceOf',
      args: [payerAddress]
    }) as bigint;
    usdcBalanceStr = formatUnits(usdcBalance, 6);
  } catch {
    usdcBalanceStr = '0.000000 (USDC contract query pending faucet funding)';
  }

  console.log('');
  console.log('Base Sepolia USDC:');
  console.log(`${usdcBalanceStr} USDC`);
  console.log('');

  if (ethBalance <= BigInt(0)) {
    console.log('Wallet Status:');
    console.log('X402_CONFIGURATION_READY_BUT_TESTNET_FUNDS_MISSING');
    console.log('');
    console.log('Faucet Instructions:');
    console.log(`Request free Base Sepolia testnet ETH for ${payerAddress} at:`);
    console.log('https://www.alchemy.com/faucets/base-sepolia');
    console.log('https://faucets.chain.link/base-sepolia');
  } else {
    console.log('Wallet Status:');
    console.log('READY_FOR_TESTNET_PAYMENT');
  }

  console.log('==================================================');
}

if (require.main === module) {
  runX402Check().catch(err => {
    console.error('Fatal X402 Check Error:', err);
    process.exit(1);
  });
}
