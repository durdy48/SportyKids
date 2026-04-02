import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Logger is always mocked (hoisted — safe because it has no singletons)
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Reset module singletons (providerAvailable cache, AIClient instance) before
// each test so each test gets a clean module state.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an openai mock that captures the constructor cfg and create params. */
function makeOpenAIMock() {
  const captured = { model: undefined as string | undefined, baseURL: undefined as string | undefined };
  const mock = {
    default: function OpenAI(cfg: { baseURL: string }) {
      captured.baseURL = cfg.baseURL;
      return {
        chat: {
          completions: {
            create(params: { model: string }) {
              captured.model = params.model;
              return Promise.resolve({
                choices: [{ message: { content: 'ok' } }],
                usage: { total_tokens: 2 },
              });
            },
          },
        },
      };
    },
  };
  return { mock, captured };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ai-client — Groq provider', () => {
  describe('AIProvider type includes groq', () => {
    it('module can be imported and getAIClient is a function', async () => {
      vi.stubEnv('AI_PROVIDER', 'ollama');
      const { getAIClient } = await import('../ai-client');
      expect(typeof getAIClient).toBe('function');
    });
  });

  describe('isProviderAvailable', () => {
    it('returns true when AI_PROVIDER=groq and GROQ_API_KEY is set', async () => {
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', 'gsk_test_key');
      const { isProviderAvailable } = await import('../ai-client');
      expect(await isProviderAvailable()).toBe(true);
    });

    it('returns false when AI_PROVIDER=groq and GROQ_API_KEY is absent', async () => {
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', '');
      const { isProviderAvailable } = await import('../ai-client');
      expect(await isProviderAvailable()).toBe(false);
    });

    it('returns true when AI_PROVIDER=openrouter and OPENROUTER_API_KEY is set', async () => {
      vi.stubEnv('AI_PROVIDER', 'openrouter');
      vi.stubEnv('OPENROUTER_API_KEY', 'sk_test');
      const { isProviderAvailable } = await import('../ai-client');
      expect(await isProviderAvailable()).toBe(true);
    });

    it('returns true when AI_PROVIDER=anthropic and ANTHROPIC_API_KEY is set', async () => {
      vi.stubEnv('AI_PROVIDER', 'anthropic');
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk_ant_test');
      const { isProviderAvailable } = await import('../ai-client');
      expect(await isProviderAvailable()).toBe(true);
    });
  });

  describe('dispatch — groq throws AIServiceError without API key', () => {
    it('throws AIServiceError when GROQ_API_KEY is empty', async () => {
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', 'gsk_key');

      const mod = await import('../ai-client');

      // Clear key after module load so dispatch guard fires
      vi.stubEnv('GROQ_API_KEY', '');

      const client = mod.getAIClient();
      await expect(
        client.sendMessage([{ role: 'user', content: 'test' }], 'generation'),
      ).rejects.toThrow(mod.AIServiceError);
    });
  });

  describe('model name resolution', () => {
    it('defaults to llama-3.1-8b-instant for groq when GROQ_MODEL is not set', async () => {
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', 'gsk_test');

      const { mock, captured } = makeOpenAIMock();
      vi.doMock('openai', () => mock);

      const { getAIClient } = await import('../ai-client');
      await getAIClient().sendMessage([{ role: 'user', content: 'hello' }], 'generation');

      expect(captured.model).toBe('llama-3.1-8b-instant');
    });

    it('uses GROQ_MODEL override when set', async () => {
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', 'gsk_test');
      vi.stubEnv('GROQ_MODEL', 'llama-3.3-70b-versatile');

      const { mock, captured } = makeOpenAIMock();
      vi.doMock('openai', () => mock);

      const { getAIClient } = await import('../ai-client');
      await getAIClient().sendMessage([{ role: 'user', content: 'hello' }], 'generation');

      expect(captured.model).toBe('llama-3.3-70b-versatile');
    });
  });

  describe('Groq base URL', () => {
    it('sends requests to https://api.groq.com/openai/v1 by default', async () => {
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', 'gsk_test');

      const { mock, captured } = makeOpenAIMock();
      vi.doMock('openai', () => mock);

      const { getAIClient } = await import('../ai-client');
      await getAIClient().sendMessage([{ role: 'user', content: 'hi' }], 'generation');

      expect(captured.baseURL).toBe('https://api.groq.com/openai/v1');
    });

    it('uses GROQ_BASE_URL override when set', async () => {
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', 'gsk_test');
      vi.stubEnv('GROQ_BASE_URL', 'https://custom.example.com/v1');

      const { mock, captured } = makeOpenAIMock();
      vi.doMock('openai', () => mock);

      const { getAIClient } = await import('../ai-client');
      await getAIClient().sendMessage([{ role: 'user', content: 'hi' }], 'generation');

      expect(captured.baseURL).toBe('https://custom.example.com/v1');
    });
  });
});
