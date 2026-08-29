import 'dotenv/config';
import { loadEnvConfig } from '@next/env';
import { GeminiExecutorAdapter, AgentTaskInput } from './execution-adapter';
import { ExecutionService } from './execution';
import crypto from 'crypto';

export async function runH2LiveSpike(): Promise<void> {
  loadEnvConfig(process.cwd());
  const apiKey = process.env.GEMINI_API_KEY;

  console.log('==================================================');
  console.log('PROOFFLOW H2 — LIVE MODEL EXECUTION');
  console.log('==================================================');

  if (!apiKey) {
    console.log('Status: FAILED');
    console.log('');
    console.log('Reason:');
    console.log('MISSING_API_KEY: GEMINI_API_KEY environment variable is not configured.');
    console.log('');
    console.log('Instructions:');
    console.log('Set GEMINI_API_KEY in your environment or .env file before running npm run h2:live.');
    console.log('==================================================');
    process.exit(1);
  }

  const buggyCode = `def calculate_total(items):\n    total = 0\n    for item in items:\n        total -= item\n    return total`;
  const inputHash = crypto.createHash('sha256').update(buggyCode).digest('hex');

  const taskInput: AgentTaskInput = {
    taskId: 'TASK-H2-LIVE-SPIKE',
    workerAgentId: 'AGENT-WORKER-007',
    userPrompt: 'Fix this Python bug where subtraction is used instead of addition for total calculation.',
    capability: 'python',
    specialization: 'debugging',
    artifactCode: buggyCode,
    language: 'python',
    requirements: ['correctness'],
    deadlineSeconds: 300
  };

  const adapter = new GeminiExecutorAdapter(apiKey, 'gemini-3.6-flash');
  const output = await adapter.execute(taskInput);

  if (output.status === 'SUCCESS' && output.outputCode) {
    const outputHash = crypto.createHash('sha256').update(output.outputCode).digest('hex');
    const evidencePayload = {
      outputCode: output.outputCode,
      explanation: output.explanation,
      provider: output.provider,
      adapter: output.adapter,
      executionTimeMs: output.executionTimeMs,
      model: output.model,
      inputArtifactHash: inputHash,
      outputArtifactHash: outputHash,
      submittedTimestamp: new Date().toISOString()
    };

    const evidenceHash = ExecutionService.computeEvidenceHash(
      evidencePayload,
      outputHash,
      'TASK-H2-LIVE-SPIKE',
      'AGENT-WORKER-007'
    );

    console.log('Status: SUCCESS');
    console.log('');
    console.log('Provider:');
    console.log(output.provider);
    console.log('');
    console.log('Model:');
    console.log(output.model);
    console.log('');
    console.log('Adapter:');
    console.log(output.adapter);
    console.log('');
    console.log('Input SHA-256:');
    console.log(inputHash);
    console.log('');
    console.log('Output:');
    console.log(output.outputCode);
    console.log('');
    console.log('Explanation:');
    console.log(output.explanation);
    console.log('');
    console.log('Execution time:');
    console.log(`${output.executionTimeMs} ms`);
    console.log('');
    console.log('Output SHA-256:');
    console.log(outputHash);
    console.log('');
    console.log('Evidence SHA-256:');
    console.log(evidenceHash);
  } else {
    console.log('Status: FAILED');
    console.log('');
    console.log('Reason:');
    console.log(output.errorMessage || output.explanation || 'Model execution failed');
    console.log('==================================================');
    process.exit(1);
  }

  console.log('==================================================');
}

if (require.main === module) {
  runH2LiveSpike().catch(err => {
    console.error('Fatal H2 Spike Error:', err);
    process.exit(1);
  });
}
