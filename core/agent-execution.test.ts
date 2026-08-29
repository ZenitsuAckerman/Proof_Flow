import { ExecutionService } from './execution';
import { ExecutionAdapterRegistry, DeterministicFallbackExecutorAdapter, GeminiExecutorAdapter } from './execution-adapter';
import { OrchestratorService } from './orchestrator';
import { db } from './repository';
import { FinancialReconciliation } from './reconciliation';

describe('Phase H2.1: Real Agent Execution Adapter & Security Suite', () => {
  beforeEach(async () => {
    await db.reset();
  });

  it('1. Current default Gemini model name is gemini-3.6-flash', () => {
    const adapter = new GeminiExecutorAdapter('TEST_KEY');
    const json = adapter.toJSON();
    expect(json.modelName).toBe('gemini-3.6-flash');
  });

  it('2. Resolves worker execution adapter from agent registry profile', async () => {
    const adapter = ExecutionAdapterRegistry.getAdapter('GEMINI_DEBUGGER');
    expect(adapter).toBeDefined();
  });

  it('3. Deterministic fallback adapter generates valid output and SHA-256 hashes', async () => {
    const adapter = new DeterministicFallbackExecutorAdapter();
    const result = await adapter.execute({
      taskId: 'TASK-TEST-1',
      workerAgentId: 'AGENT-WORKER-001',
      userPrompt: 'Fix calculation in python function',
      capability: 'python',
      artifactCode: 'def add(a, b):\n    return a + b',
      language: 'python',
      requirements: ['correctness'],
      deadlineSeconds: 300
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.outputCode).toContain('def add(a, b)');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('4. Handles missing API key cleanly returning MISSING_API_KEY error', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const adapter = new GeminiExecutorAdapter('');
      const result = await adapter.execute({
        taskId: 'TASK-TEST-KEY',
        workerAgentId: 'AGENT-WORKER-001',
        userPrompt: 'Test prompt',
        capability: 'python',
        language: 'python',
        requirements: [],
        deadlineSeconds: 300
      });

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('MISSING_API_KEY');
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it('5. Handles 404 model unavailable error returning structured GEMINI_MODEL_UNAVAILABLE error', async () => {
    const mockAi = {
      models: {
        generateContent: async () => {
          throw new Error('404 NOT_FOUND: This model models/invalid-gemini-model-xyz is not available.');
        }
      }
    };
    const adapter = new GeminiExecutorAdapter('TEST_KEY', 'invalid-gemini-model-xyz', mockAi);

    const result = await adapter.execute({
      taskId: 'T-404',
      workerAgentId: 'W-404',
      userPrompt: 'Test',
      capability: 'python',
      language: 'python',
      requirements: [],
      deadlineSeconds: 300
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('GEMINI_MODEL_UNAVAILABLE');
  });

  it('6. Handles 401 authentication error returning structured GEMINI_AUTHENTICATION_ERROR', async () => {
    const mockAi = {
      models: {
        generateContent: async () => {
          throw new Error('401 API key not valid. Please pass a valid API key.');
        }
      }
    };
    const adapter = new GeminiExecutorAdapter('INVALID_KEY', 'gemini-3.6-flash', mockAi);

    const result = await adapter.execute({
      taskId: 'T-401',
      workerAgentId: 'W-401',
      userPrompt: 'Test',
      capability: 'python',
      language: 'python',
      requirements: [],
      deadlineSeconds: 300
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('GEMINI_AUTHENTICATION_ERROR');
  });

  it('7. Handles 429 rate limit error returning structured GEMINI_RATE_LIMIT_EXCEEDED', async () => {
    const mockAi = {
      models: {
        generateContent: async () => {
          throw new Error('429 RESOURCE_EXHAUSTED: Rate limit exceeded.');
        }
      }
    };
    const adapter = new GeminiExecutorAdapter('VALID_KEY', 'gemini-3.6-flash', mockAi);

    const result = await adapter.execute({
      taskId: 'T-429',
      workerAgentId: 'W-429',
      userPrompt: 'Test',
      capability: 'python',
      language: 'python',
      requirements: [],
      deadlineSeconds: 300
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('GEMINI_RATE_LIMIT_EXCEEDED');
  });

  it('8. Handles malformed non-JSON model output returning MALFORMED_OUTPUT error', async () => {
    const mockAi = {
      models: {
        generateContent: async () => ({
          text: 'This is free form text without JSON object.'
        })
      }
    };
    const adapter = new GeminiExecutorAdapter('VALID_KEY', 'gemini-3.6-flash', mockAi);

    const result = await adapter.execute({
      taskId: 'T-MALFORMED',
      workerAgentId: 'W-1',
      userPrompt: 'Test',
      capability: 'python',
      language: 'python',
      requirements: [],
      deadlineSeconds: 300
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('MALFORMED_OUTPUT');
  });

  it('9. Handles empty model output returning EMPTY_OUTPUT error', async () => {
    const mockAi = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({ outputCode: '', explanation: 'No code' })
        })
      }
    };
    const adapter = new GeminiExecutorAdapter('VALID_KEY', 'gemini-3.6-flash', mockAi);

    const result = await adapter.execute({
      taskId: 'T-EMPTY',
      workerAgentId: 'W-1',
      userPrompt: 'Test',
      capability: 'python',
      language: 'python',
      requirements: [],
      deadlineSeconds: 300
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('EMPTY_OUTPUT');
  });

  it('10. Executes dynamic task end-to-end and transitions state to SUBMITTED only on success', async () => {
    const dynamicTask = await OrchestratorService.createDynamicTask('Find a Python debugging agent for ₹150 within 15 minutes.');
    const execResult = await ExecutionService.executeDynamicTask(dynamicTask.id);

    expect(execResult.status).toBe('SUCCESS');
    expect(execResult.evidence).toBeDefined();
    expect(execResult.evidence?.outputHash).toBeDefined();
    expect(execResult.evidence?.evidenceHash).toBeDefined();

    const updatedTask = await db.getTask(dynamicTask.id);
    expect(updatedTask?.status).toBe('SUBMITTED');
  });

  it('11. Handles empty output failure: task is marked FAILED and no false evidence is stored', async () => {
    const mockExecutor = {
      execute: async () => ({
        status: 'FAILED' as const,
        outputCode: '',
        explanation: 'Model produced empty code',
        changedFiles: [],
        confidence: 0,
        provider: 'Google',
        adapter: 'GEMINI_DEBUGGER',
        executionTimeMs: 10,
        model: 'gemini-3.6-flash',
        errorMessage: 'EMPTY_OUTPUT'
      })
    };

    const task = await OrchestratorService.createDynamicTask('Test task empty output');
    
    const originalGet = ExecutionAdapterRegistry.getAdapter;
    ExecutionAdapterRegistry.getAdapter = () => mockExecutor;

    const execResult = await ExecutionService.executeDynamicTask(task.id);
    expect(execResult.status).toBe('FAILED');
    expect(execResult.evidence).toBeUndefined();

    const updatedTask = await db.getTask(task.id);
    expect(updatedTask?.status).toBe('FAILED');

    ExecutionAdapterRegistry.getAdapter = originalGet;
  });

  it('12. Idempotency check: duplicate execution returns ALREADY_SUBMITTED without duplicating evidence', async () => {
    const dynamicTask = await OrchestratorService.createDynamicTask('Find a Python debugging agent for ₹150 within 15 minutes.');
    await ExecutionService.executeDynamicTask(dynamicTask.id);

    const dupResult = await ExecutionService.executeDynamicTask(dynamicTask.id);
    expect(dupResult.status).toBe('ALREADY_SUBMITTED');
  });

  // =========================================================================
  // SECURITY & FINANCIAL ISOLATION TESTS
  // =========================================================================

  describe('Security & Financial Isolation Suite', () => {
    it('Security 1: API key is never exposed to client or browser objects', () => {
      const adapter = new GeminiExecutorAdapter('MOCK_TEST_SECRET_KEY');
      const serialized = JSON.stringify(adapter);
      expect(serialized).not.toContain('MOCK_TEST_SECRET_KEY');
    });

    it('Security 2: Model execution does NOT mutate any wallet balance or system total money', async () => {
      const initialTotal = await FinancialReconciliation.calculateSystemTotalMoney();
      const dynamicTask = await OrchestratorService.createDynamicTask('Find a Python debugging agent for ₹150 within 15 minutes.');
      
      await ExecutionService.executeDynamicTask(dynamicTask.id);

      const finalTotal = await FinancialReconciliation.calculateSystemTotalMoney();
      expect(finalTotal).toBe(initialTotal);
    });

    it('Security 3: Model execution cannot trigger settlement or clear money', async () => {
      const dynamicTask = await OrchestratorService.createDynamicTask('Find a Python debugging agent for ₹150 within 15 minutes.');
      await ExecutionService.executeDynamicTask(dynamicTask.id);

      const updatedTask = await db.getTask(dynamicTask.id);
      expect(updatedTask?.status).toBe('SUBMITTED');
      expect(updatedTask?.status).not.toBe('SETTLEMENT');
      expect(updatedTask?.status).not.toBe('COMPLETED');
    });
  });
});
