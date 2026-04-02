/**
 * Multi-provider AI client with rate limiting and retries.
 * Supports Ollama (default), OpenRouter, Anthropic, and Groq.
 */

import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIProvider = 'ollama' | 'openrouter' | 'anthropic' | 'groq';
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
// Helpers
// ---------------------------------------------------------------------------

function getConfig(): AIClientConfig {
  return {
    provider: (process.env.AI_PROVIDER as AIProvider) || 'ollama',
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.AI_RETRY_DELAY_MS || '1000', 10),
    rateLimitRpm: parseInt(process.env.AI_RATE_LIMIT_RPM || '30', 10),
  };
}

function getModelName(purpose: ModelPurpose): string {
  const cfg = getConfig();

  if (purpose === 'moderation') {
    if (cfg.provider === 'ollama') return process.env.OLLAMA_MODEL_MODERATION || 'llama3.2';
    if (cfg.provider === 'openrouter') return process.env.OPENROUTER_MODEL_MODERATION || 'meta-llama/llama-3.1-8b-instruct:free';
    if (cfg.provider === 'anthropic') return process.env.AI_MODEL_MODERATION || 'claude-sonnet-4-20250514';
    if (cfg.provider === 'groq') return process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  }

  // generation
  if (cfg.provider === 'ollama') return process.env.OLLAMA_MODEL_GENERATION || 'llama3.2';
  if (cfg.provider === 'openrouter') return process.env.OPENROUTER_MODEL_GENERATION || 'meta-llama/llama-3.1-8b-instruct:free';
  if (cfg.provider === 'anthropic') return process.env.AI_MODEL_GENERATION || 'claude-sonnet-4-20250514';
  if (cfg.provider === 'groq') return process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

  return 'llama3.2';
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
): Promise<AIResponse> {
  // Dynamic import to avoid top-level dependency issues
  const { default: OpenAI } = await import('openai');

  const client = new OpenAI({
    baseURL: baseUrl,
    apiKey: apiKey || 'ollama', // Ollama doesn't need a real key
  });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.1,
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

class AIClient {
  private rateLimiter: SlidingWindowRateLimiter;

  constructor() {
    const cfg = getConfig();
    this.rateLimiter = new SlidingWindowRateLimiter(cfg.rateLimitRpm);
  }

  /**
   * Send a message to the configured AI provider.
   * Includes rate limiting and retries with exponential backoff.
   */
  async sendMessage(messages: AIMessage[], purpose: ModelPurpose = 'moderation'): Promise<AIResponse> {
    const cfg = getConfig();
    const model = getModelName(purpose);

    // Fast fail if provider is known to be unavailable
    const available = await isProviderAvailable();
    if (!available) {
      throw new AIServiceError(
        `AI provider "${cfg.provider}" is not available`,
        cfg.provider,
        { retryable: false },
      );
    }

    let lastError: unknown;

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      try {
        await this.rateLimiter.waitForSlot();
        return await this.dispatch(cfg.provider, model, messages);
      } catch (err) {
        lastError = err;

        const isRetryable =
          err instanceof AIServiceError ? err.retryable : true;

        if (!isRetryable || attempt === cfg.maxRetries) break;

        const delay = cfg.retryDelayMs * Math.pow(2, attempt);
        logger.warn({ provider: cfg.provider, attempt: attempt + 1, retryDelayMs: delay }, 'AI attempt failed, retrying');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError instanceof AIServiceError
      ? lastError
      : new AIServiceError(
          `AI request failed after ${cfg.maxRetries + 1} attempts`,
          cfg.provider,
          { cause: lastError, retryable: false },
        );
  }

  private async dispatch(
    provider: AIProvider,
    model: string,
    messages: AIMessage[],
  ): Promise<AIResponse> {
    switch (provider) {
      case 'ollama': {
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
        return sendViaOpenAICompat(baseUrl, undefined, model, messages, 'ollama');
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
        return sendViaOpenAICompat(baseUrl, apiKey, model, messages, 'openrouter');
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
        return sendViaOpenAICompat(baseUrl, apiKey, model, messages, 'groq');
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

export { isProviderAvailable };
export default AIClient;
