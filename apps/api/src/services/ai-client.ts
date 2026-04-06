/**
 * Multi-provider AI client with rate limiting, retries, and automatic provider
 * fallback. Supports Ollama (default), OpenRouter, Anthropic, and Groq.
 *
 * Fallback chain: set AI_FALLBACK_PROVIDERS=ollama,openrouter (comma-separated)
 * to automatically switch when the primary provider is rate-limited.
 */

import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIProvider = 'ollama' | 'openrouter' | 'anthropic' | 'groq' | 'gemini';
export type ModelPurpose = 'moderation' | 'generation';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  tokensUsed?: number;
}

export interface AIClientConfig {
  provider: AIProvider;
  maxRetries: number;
  retryDelayMs: number;
  rateLimitRpm: number;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class AIServiceError extends Error {
  public readonly provider: AIProvider;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(
    message: string,
    provider: AIProvider,
    options?: { statusCode?: number; retryable?: boolean; cause?: unknown },
  ) {
    super(message);
    this.name = 'AIServiceError';
    this.provider = provider;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? false;
    if (options?.cause) this.cause = options.cause;
  }
}

// ---------------------------------------------------------------------------
// Rate limiter (sliding window)
// ---------------------------------------------------------------------------

class SlidingWindowRateLimiter {
  private timestamps: number[] = [];
  private readonly windowMs = 60_000; // 1 minute

  constructor(private readonly maxRequests: number) {}

  async waitForSlot(): Promise<void> {
    while (true) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }

      const oldestInWindow = this.timestamps[0]!;
      const waitMs = oldestInWindow + this.windowMs - now + 10;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

// ---------------------------------------------------------------------------
// Circuit breaker — per-provider + per-purpose rate-limit trip with auto-reset
//
// Moderation and generation use independent circuits so that a rate-limit
// burst from the background moderation job never blocks user-facing generation
// (e.g. "Explain it Easy").
// ---------------------------------------------------------------------------

class ProviderCircuitBreaker {
  // Key format: "provider" (provider-wide) or "provider:purpose" (purpose-scoped)
  private readonly openUntil = new Map<string, number>();

  private key(provider: AIProvider, purpose?: ModelPurpose): string {
    return purpose ? `${provider}:${purpose}` : provider;
  }

  /** Returns true if the provider is currently circuit-broken for the given purpose. */
  isOpen(provider: AIProvider, purpose?: ModelPurpose): boolean {
    const k = this.key(provider, purpose);
    const until = this.openUntil.get(k);
    if (!until) return false;
    if (Date.now() >= until) {
      this.openUntil.delete(k);
      return false;
    }
    return true;
  }

  /** Mark a provider as unavailable for the given duration (ms), scoped to a purpose. */
  trip(provider: AIProvider, durationMs: number, purpose?: ModelPurpose): void {
    this.openUntil.set(this.key(provider, purpose), Date.now() + durationMs);
    logger.warn(
      { provider, purpose: purpose ?? 'all', retryAfterMs: durationMs },
      'AI provider rate-limited — circuit opened, switching to fallback',
    );
  }

  /** For testing: manually reset a provider's circuit (optionally scoped to purpose). */
  reset(provider: AIProvider, purpose?: ModelPurpose): void {
    this.openUntil.delete(this.key(provider, purpose));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse the retry-after duration from a Groq/OpenAI rate limit error message.
 * Groq includes "Please try again in X.XXs" — we extract X and convert to ms.
 * Returns null if the message doesn't contain a parseable duration.
 */
export function parseRetryAfterMs(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/try again in ([\d.]+)s/i);
  if (!match) return null;
  const seconds = parseFloat(match[1]!);
  if (isNaN(seconds) || seconds <= 0) return null;
  // Add 5 s buffer; cap at 24 h to avoid indefinite locks.
  return Math.min(Math.ceil(seconds * 1000) + 5_000, 24 * 60 * 60 * 1000);
}

/**
 * Returns true if the error is a 429 rate-limit / quota-exceeded response.
 * Works with raw OpenAI SDK errors (which have a `.status` field) and with
 * our AIServiceError wrapper.
 */
export function isRateLimitError(err: unknown): boolean {
  if (err instanceof AIServiceError && err.statusCode === 429) return true;
  // OpenAI SDK errors expose .status
  const status = (err as { status?: unknown })?.status;
  if (status === 429) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('tokens per day') || msg.includes('tokens per minute');
}

/** Returns true for errors that will never succeed on retry (bad API key, forbidden). */
export function isNonRetryableError(err: unknown): boolean {
  const status = (err as { status?: unknown })?.status;
  return status === 401 || status === 403;
}

function getConfig(): AIClientConfig {
  return {
    provider: (process.env.AI_PROVIDER as AIProvider) || 'groq',
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.AI_RETRY_DELAY_MS || '1000', 10),
    rateLimitRpm: parseInt(process.env.AI_RATE_LIMIT_RPM || '30', 10),
  };
}

/**
 * Returns the ordered fallback provider list from AI_FALLBACK_PROVIDERS.
 * Example: AI_FALLBACK_PROVIDERS=ollama,openrouter → ['ollama', 'openrouter']
 */
export function getFallbackProviders(): AIProvider[] {
  const raw = process.env.AI_FALLBACK_PROVIDERS || '';
  return raw
    .split(',')
    .map((p) => p.trim() as AIProvider)
    .filter((p): p is AIProvider =>
      ['ollama', 'openrouter', 'anthropic', 'groq', 'gemini'].includes(p),
    );
}

function getModelNameForProvider(purpose: ModelPurpose, provider: AIProvider): string {
  if (purpose === 'moderation') {
    if (provider === 'ollama') return process.env.OLLAMA_MODEL_MODERATION || 'llama3.2';
    if (provider === 'openrouter') return process.env.OPENROUTER_MODEL_MODERATION || 'openrouter/free';
    if (provider === 'anthropic') return process.env.AI_MODEL_MODERATION || 'claude-sonnet-4-20250514';
    if (provider === 'groq') return process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  }
  // generation
  if (provider === 'ollama') return process.env.OLLAMA_MODEL_GENERATION || 'llama3.2';
  if (provider === 'openrouter') return process.env.OPENROUTER_MODEL_GENERATION || 'openrouter/free';
  if (provider === 'anthropic') return process.env.AI_MODEL_GENERATION || 'claude-sonnet-4-20250514';
  if (provider === 'groq') return process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  return 'llama3.2';
}

function getModelName(purpose: ModelPurpose): string {
  return getModelNameForProvider(purpose, getConfig().provider);
}

// ---------------------------------------------------------------------------
// Provider health check (avoids slow retries when provider is down)
// ---------------------------------------------------------------------------

let providerAvailable: boolean | null = null;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60_000; // Re-check every 60 seconds

async function isProviderAvailable(): Promise<boolean> {
  const now = Date.now();
  if (providerAvailable !== null && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return providerAvailable;
  }

  const cfg = getConfig();
  try {
    if (cfg.provider === 'ollama') {
      const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1').replace('/v1', '');
      const res = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
      providerAvailable = res.ok;
    } else if (cfg.provider === 'openrouter') {
      providerAvailable = !!process.env.OPENROUTER_API_KEY;
    } else if (cfg.provider === 'anthropic') {
      providerAvailable = !!process.env.ANTHROPIC_API_KEY;
    } else if (cfg.provider === 'groq') {
      providerAvailable = !!process.env.GROQ_API_KEY;
    } else if (cfg.provider === 'gemini') {
      providerAvailable = !!process.env.GEMINI_API_KEY;
    } else {
      providerAvailable = false;
    }
  } catch {
    providerAvailable = false;
  }

  lastHealthCheck = now;
  if (!providerAvailable) {
    logger.info({ provider: cfg.provider, skipDurationSeconds: HEALTH_CHECK_INTERVAL / 1000 }, 'AI provider is not available, skipping AI calls');
  }
  return providerAvailable;
}

// ---------------------------------------------------------------------------
// Provider-specific send helpers
// ---------------------------------------------------------------------------

async function sendViaOpenAICompat(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  messages: AIMessage[],
  provider: AIProvider,
  maxTokens: number,
): Promise<AIResponse> {
  // Dynamic import to avoid top-level dependency issues
  const { default: OpenAI } = await import('openai');

  const client = new OpenAI({
    baseURL: baseUrl,
    apiKey: apiKey || 'ollama', // Ollama doesn't need a real key
    timeout: 20_000, // 20s hard cap — prevents hanging when provider is slow
    maxRetries: 0,   // Retries handled by AIClient.sendMessage, not the SDK
  });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.1,
    max_tokens: maxTokens,
  });

  const choice = response.choices?.[0];
  if (!choice?.message?.content) {
    throw new AIServiceError('Empty response from AI', provider);
  }

  return {
    content: choice.message.content,
    model,
    provider,
    tokensUsed: response.usage?.total_tokens ?? undefined,
  };
}

async function sendViaAnthropic(
  apiKey: string,
  model: string,
  messages: AIMessage[],
): Promise<AIResponse> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');

  const client = new Anthropic({ apiKey });

  // Separate system from user/assistant messages
  const systemMsg = messages.find((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system') as Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;

  const response = await client.messages.create({
    model,
    max_tokens: 512,
    system: systemMsg?.content,
    messages: nonSystem,
  });

  const text = response.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('');

  if (!text) {
    throw new AIServiceError('Empty response from Anthropic', 'anthropic');
  }

  return {
    content: text,
    model,
    provider: 'anthropic',
    tokensUsed: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
  };
}

// ---------------------------------------------------------------------------
// AIClient singleton
// ---------------------------------------------------------------------------

// Token budget per purpose — keeps responses fast and within Groq's TPM limits.
const MAX_TOKENS: Record<ModelPurpose, number> = {
  moderation: 200,  // JSON safety verdict: {"safe":true,"reason":"..."} ≈ 50 tokens
  generation: 400,  // Age-adapted summary (80-180 words) ≈ 250-350 tokens
};

class AIClient {
  // Separate rate limiters per purpose so background moderation jobs
  // never block user-facing generation calls (both share the provider's RPM cap
  // but compete independently — generation is always immediately available).
  private moderationLimiter: SlidingWindowRateLimiter;
  private generationLimiter: SlidingWindowRateLimiter;
  private circuitBreaker: ProviderCircuitBreaker;

  constructor() {
    const cfg = getConfig();
    this.moderationLimiter = new SlidingWindowRateLimiter(cfg.rateLimitRpm);
    this.generationLimiter = new SlidingWindowRateLimiter(cfg.rateLimitRpm);
    this.circuitBreaker = new ProviderCircuitBreaker();
  }

  /**
   * Send a message to the configured AI provider.
   * Includes rate limiting, retries with exponential backoff, and automatic
   * provider fallback when the primary is rate-limited (429).
   *
   * Provider chain: [AI_PROVIDER, ...AI_FALLBACK_PROVIDERS]
   * Circuit breaker: on 429, the provider is marked unavailable for the
   * retry-after duration parsed from the error message, then auto-resets.
   */
  async sendMessage(messages: AIMessage[], purpose: ModelPurpose = 'moderation'): Promise<AIResponse> {
    const cfg = getConfig();
    const rateLimiter = purpose === 'generation' ? this.generationLimiter : this.moderationLimiter;

    // Build the provider chain: primary first, then configured fallbacks.
    const fallbacks = getFallbackProviders();
    const providerChain: AIProvider[] = [cfg.provider, ...fallbacks.filter((p) => p !== cfg.provider)];

    // Fast fail if primary provider is known to be unconfigured and no fallbacks exist.
    const primaryAvailable = await isProviderAvailable();
    if (!primaryAvailable && fallbacks.length === 0) {
      throw new AIServiceError(
        `AI provider "${cfg.provider}" is not available`,
        cfg.provider,
        { retryable: false },
      );
    }

    let lastError: unknown;

    for (const provider of providerChain) {
      // Skip providers that are currently circuit-broken for this purpose.
      if (this.circuitBreaker.isOpen(provider, purpose)) {
        logger.debug({ provider, purpose }, 'AI provider circuit open, skipping');
        continue;
      }

      for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
        try {
          await rateLimiter.waitForSlot();
          const model = getModelNameForProvider(purpose, provider);
          return await this.dispatch(provider, model, messages, purpose);
        } catch (err) {
          lastError = err;

          if (isRateLimitError(err)) {
            // Trip the circuit breaker scoped to this purpose so that other
            // purposes (e.g. generation) can still use the provider.
            // Default 30 s (not 60 s) so the provider becomes available again
            // sooner when no Retry-After header is present.
            const retryAfterMs = parseRetryAfterMs(err) ?? 30_000;
            this.circuitBreaker.trip(provider, retryAfterMs, purpose);
            break; // Stop retrying this provider; outer loop tries next one.
          }

          if (isNonRetryableError(err)) {
            // Auth/forbidden errors won't resolve with retries — fail fast.
            logger.error(
              { provider, status: (err as { status?: unknown })?.status, err: err instanceof Error ? err.message : String(err) },
              'AI provider auth/forbidden error — check API key configuration',
            );
            break;
          }

          const isRetryable =
            err instanceof AIServiceError ? err.retryable : true;

          if (!isRetryable || attempt === cfg.maxRetries) break;

          const delay = cfg.retryDelayMs * Math.pow(2, attempt);
          logger.warn(
            { provider, attempt: attempt + 1, retryDelayMs: delay, err: err instanceof Error ? err.message : String(err) },
            'AI attempt failed, retrying',
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError instanceof AIServiceError
      ? lastError
      : new AIServiceError(
          `AI request failed after exhausting all providers`,
          cfg.provider,
          { cause: lastError, retryable: false },
        );
  }

  private async dispatch(
    provider: AIProvider,
    model: string,
    messages: AIMessage[],
    purpose: ModelPurpose,
  ): Promise<AIResponse> {
    const maxTokens = MAX_TOKENS[purpose];
    switch (provider) {
      case 'ollama': {
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
        return sendViaOpenAICompat(baseUrl, undefined, model, messages, 'ollama', maxTokens);
      }

      case 'openrouter': {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          throw new AIServiceError(
            'OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter',
            'openrouter',
            { retryable: false },
          );
        }
        const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
        return sendViaOpenAICompat(baseUrl, apiKey, model, messages, 'openrouter', maxTokens);
      }

      case 'anthropic': {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new AIServiceError(
            'ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic',
            'anthropic',
            { retryable: false },
          );
        }
        return sendViaAnthropic(apiKey, model, messages);
      }

      case 'groq': {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
          throw new AIServiceError(
            'GROQ_API_KEY is required when AI_PROVIDER=groq',
            'groq',
            { retryable: false },
          );
        }
        const baseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
        return sendViaOpenAICompat(baseUrl, apiKey, model, messages, 'groq', maxTokens);
      }

      case 'gemini': {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new AIServiceError(
            'GEMINI_API_KEY is required when AI_PROVIDER=gemini or used as fallback',
            'gemini',
            { retryable: false },
          );
        }
        // Gemini OpenAI-compatible endpoint: https://ai.google.dev/gemini-api/docs/openai
        const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
        return sendViaOpenAICompat(baseUrl, apiKey, model, messages, 'gemini', maxTokens);
      }

      default:
        throw new AIServiceError(`Unknown AI provider: ${provider}`, provider as AIProvider, {
          retryable: false,
        });
    }
  }
}

// Singleton
let instance: AIClient | null = null;

export function getAIClient(): AIClient {
  if (!instance) {
    instance = new AIClient();
  }
  return instance;
}

export { isProviderAvailable, getModelName };
export default AIClient;
