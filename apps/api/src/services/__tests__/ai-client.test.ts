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

describe('ai-client', () => {
  describe('module exports', () => {
    it('getAIClient is a function', async () => {
      vi.stubEnv('AI_PROVIDER', 'ollama');
      const { getAIClient } = await import('../ai-client');
      expect(typeof getAIClient).toBe('function');
    });
  });

  describe('isProviderAvailable — Groq', () => {
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
  });

  describe('isProviderAvailable — other providers', () => {
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
    // Split into two deterministic tests to avoid relying on the 60-second
    // providerAvailable cache accidentally carrying a stale 'true' value.

    it('throws AIServiceError (provider not available) when GROQ_API_KEY is absent at load time', async () => {
      // Fresh module import with no key → isProviderAvailable() returns false
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', '');
      const mod = await import('../ai-client');
      const client = mod.getAIClient();

      await expect(
        client.sendMessage([{ role: 'user', content: 'test' }], 'generation'),
      ).rejects.toThrow(mod.AIServiceError);
    });

    it('throws AIServiceError (GROQ_API_KEY required) when dispatch runs with empty key', async () => {
      // Import with key set and explicitly call isProviderAvailable() to prime
      // the 60-second cache to true. Then clear the key — the cache remains
      // true, so sendMessage reaches dispatch, which reads the now-empty key
      // and throws the specific "GROQ_API_KEY is required" error.
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', 'gsk_key');
      const mod = await import('../ai-client');

      await mod.isProviderAvailable(); // primes cache to true

      vi.stubEnv('GROQ_API_KEY', ''); // clear after cache is set

      const client = mod.getAIClient();
      const error = await client
        .sendMessage([{ role: 'user', content: 'test' }], 'generation')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(mod.AIServiceError);
      // Must be the dispatch guard message, not the availability-false message
      expect((error as InstanceType<typeof mod.AIServiceError>).message).toMatch(
        /GROQ_API_KEY is required/,
      );
    });
  });

  describe('Groq — model name resolution', () => {
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

  // ---------------------------------------------------------------------------
  // parseRetryAfterMs
  // ---------------------------------------------------------------------------

  describe('parseRetryAfterMs', () => {
    it('parses "Please try again in 36.9s" correctly', async () => {
      const { parseRetryAfterMs } = await import('../ai-client');
      const err = new Error('RateLimitError: Please try again in 36.9s');
      const result = parseRetryAfterMs(err);
      // 36.9s * 1000 + 5000 buffer = 41900ms
      expect(result).toBe(41900);
    });

    it('parses "try again in 1s" (minimum)', async () => {
      const { parseRetryAfterMs } = await import('../ai-client');
      expect(parseRetryAfterMs(new Error('try again in 1s'))).toBe(6000);
    });

    it('returns null when no duration in message', async () => {
      const { parseRetryAfterMs } = await import('../ai-client');
      expect(parseRetryAfterMs(new Error('generic error'))).toBeNull();
    });

    it('returns null for non-Error values', async () => {
      const { parseRetryAfterMs } = await import('../ai-client');
      expect(parseRetryAfterMs('not an error')).toBeNull();
    });

    it('caps at 24h max', async () => {
      const { parseRetryAfterMs } = await import('../ai-client');
      // 90000s would exceed 24h
      const result = parseRetryAfterMs(new Error('try again in 90000s'));
      expect(result).toBe(24 * 60 * 60 * 1000);
    });
  });

  // ---------------------------------------------------------------------------
  // isRateLimitError
  // ---------------------------------------------------------------------------

  describe('isRateLimitError', () => {
    it('returns true for AIServiceError with statusCode 429', async () => {
      const { isRateLimitError, AIServiceError } = await import('../ai-client');
      const err = new AIServiceError('Rate limit', 'groq', { statusCode: 429 });
      expect(isRateLimitError(err)).toBe(true);
    });

    it('returns true for raw errors with .status === 429', async () => {
      const { isRateLimitError } = await import('../ai-client');
      expect(isRateLimitError({ status: 429 })).toBe(true);
    });

    it('returns true for errors mentioning "rate limit"', async () => {
      const { isRateLimitError } = await import('../ai-client');
      expect(isRateLimitError(new Error('rate limit exceeded'))).toBe(true);
    });

    it('returns true for errors mentioning "too many requests"', async () => {
      const { isRateLimitError } = await import('../ai-client');
      expect(isRateLimitError(new Error('Too Many Requests'))).toBe(true);
    });

    it('returns true for errors mentioning "tokens per day"', async () => {
      const { isRateLimitError } = await import('../ai-client');
      expect(isRateLimitError(new Error('tokens per day (TPD) limit reached'))).toBe(true);
    });

    it('returns false for unrelated errors', async () => {
      const { isRateLimitError } = await import('../ai-client');
      expect(isRateLimitError(new Error('network timeout'))).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isNonRetryableError
  // ---------------------------------------------------------------------------

  describe('isNonRetryableError', () => {
    it('returns true for .status === 401', async () => {
      const { isNonRetryableError } = await import('../ai-client');
      expect(isNonRetryableError({ status: 401 })).toBe(true);
    });

    it('returns true for .status === 403', async () => {
      const { isNonRetryableError } = await import('../ai-client');
      expect(isNonRetryableError({ status: 403 })).toBe(true);
    });

    it('returns false for .status === 500', async () => {
      const { isNonRetryableError } = await import('../ai-client');
      expect(isNonRetryableError({ status: 500 })).toBe(false);
    });

    it('returns false for plain errors', async () => {
      const { isNonRetryableError } = await import('../ai-client');
      expect(isNonRetryableError(new Error('network timeout'))).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getFallbackProviders
  // ---------------------------------------------------------------------------

  describe('getFallbackProviders', () => {
    it('returns empty array when AI_FALLBACK_PROVIDERS is not set', async () => {
      vi.stubEnv('AI_FALLBACK_PROVIDERS', '');
      const { getFallbackProviders } = await import('../ai-client');
      expect(getFallbackProviders()).toEqual([]);
    });

    it('parses comma-separated providers', async () => {
      vi.stubEnv('AI_FALLBACK_PROVIDERS', 'ollama,openrouter');
      const { getFallbackProviders } = await import('../ai-client');
      expect(getFallbackProviders()).toEqual(['ollama', 'openrouter']);
    });

    it('filters out unknown providers', async () => {
      vi.stubEnv('AI_FALLBACK_PROVIDERS', 'ollama,unknown,groq');
      const { getFallbackProviders } = await import('../ai-client');
      expect(getFallbackProviders()).toEqual(['ollama', 'groq']);
    });

    it('trims whitespace', async () => {
      vi.stubEnv('AI_FALLBACK_PROVIDERS', ' ollama , groq ');
      const { getFallbackProviders } = await import('../ai-client');
      expect(getFallbackProviders()).toEqual(['ollama', 'groq']);
    });
  });

  // ---------------------------------------------------------------------------
  // Provider fallback — circuit breaker trips on 429, next provider used
  // ---------------------------------------------------------------------------

  describe('provider fallback on rate limit', () => {
    it('falls back to ollama when primary groq is rate-limited', async () => {
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', 'gsk_test');
      vi.stubEnv('AI_FALLBACK_PROVIDERS', 'ollama');

      let callCount = 0;
      const openaiMock = {
        default: function OpenAI(cfg: { baseURL: string }) {
          const baseURL = cfg.baseURL;
          return {
            chat: {
              completions: {
                create() {
                  callCount++;
                  if (baseURL.includes('groq')) {
                    // Simulate Groq TPD rate limit
                    const err = Object.assign(new Error('Please try again in 5s'), { status: 429 });
                    return Promise.reject(err);
                  }
                  // Ollama succeeds
                  return Promise.resolve({
                    choices: [{ message: { content: 'from ollama' } }],
                    usage: { total_tokens: 3 },
                  });
                },
              },
            },
          };
        },
      };

      vi.doMock('openai', () => openaiMock);

      const { getAIClient } = await import('../ai-client');
      const result = await getAIClient().sendMessage([{ role: 'user', content: 'hi' }], 'generation');

      expect(result.content).toBe('from ollama');
      expect(result.provider).toBe('ollama');
      expect(callCount).toBe(2); // 1 groq attempt + 1 ollama attempt
    });

    it('moderation rate-limit does not block generation on the same provider', async () => {
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', 'gsk_test');
      vi.stubEnv('AI_FALLBACK_PROVIDERS', '');

      let callPurpose: string | undefined;
      const openaiMock = {
        default: function OpenAI() {
          return {
            chat: {
              completions: {
                create(params: { model: string; max_tokens: number }) {
                  // Simulate Groq rate-limiting moderation (max_tokens 200)
                  // but succeeding for generation (max_tokens 400)
                  if (params.max_tokens === 200) {
                    const err = Object.assign(new Error('rate limit'), { status: 429 });
                    return Promise.reject(err);
                  }
                  callPurpose = 'generation';
                  return Promise.resolve({
                    choices: [{ message: { content: 'summary ok' } }],
                    usage: { total_tokens: 10 },
                  });
                },
              },
            },
          };
        },
      };

      vi.doMock('openai', () => openaiMock);

      const { getAIClient, isProviderAvailable } = await import('../ai-client');
      await isProviderAvailable(); // prime provider cache

      const client = getAIClient();
      // Trip the moderation circuit
      await expect(
        client.sendMessage([{ role: 'user', content: 'article' }], 'moderation'),
      ).rejects.toThrow();

      // Generation should still work on the same provider
      const result = await client.sendMessage([{ role: 'user', content: 'explain' }], 'generation');
      expect(result.content).toBe('summary ok');
      expect(callPurpose).toBe('generation');
    });

    it('throws when all providers are rate-limited', async () => {
      vi.stubEnv('AI_PROVIDER', 'groq');
      vi.stubEnv('GROQ_API_KEY', 'gsk_test');
      vi.stubEnv('AI_FALLBACK_PROVIDERS', '');

      const openaiMock = {
        default: function OpenAI() {
          return {
            chat: {
              completions: {
                create() {
                  const err = Object.assign(new Error('rate limit'), { status: 429 });
                  return Promise.reject(err);
                },
              },
            },
          };
        },
      };

      vi.doMock('openai', () => openaiMock);

      // Prime provider cache to true so sendMessage reaches dispatch
      vi.stubEnv('GROQ_API_KEY', 'gsk_test');
      const mod = await import('../ai-client');
      await mod.isProviderAvailable();

      const client = mod.getAIClient();
      await expect(
        client.sendMessage([{ role: 'user', content: 'hi' }], 'generation'),
      ).rejects.toThrow();
    });
  });
});
