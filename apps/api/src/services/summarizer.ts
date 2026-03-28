import { getAIClient, isProviderAvailable } from './ai-client';
import type { AIMessage } from './ai-client';
import type { Locale } from '@sportykids/shared';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgeRange = '6-8' | '9-11' | '12-14';

// ---------------------------------------------------------------------------
// Prompt configuration per age range
// ---------------------------------------------------------------------------

interface AgeRangeConfig {
  maxWords: number;
  style: string;
  termHandling: string;
}

const AGE_RANGE_CONFIGS: Record<AgeRange, AgeRangeConfig> = {
  '6-8': {
    maxWords: 80,
    style: 'Use storytelling tone with simple, short sentences. Be cheerful and engaging.',
    termHandling: 'Explain ALL sports terms using playful analogies that a 6-year-old would understand.',
  },
  '9-11': {
    maxWords: 120,
    style: 'Write a clear, summarized news article. Use an enthusiastic but informative tone.',
    termHandling: 'Explain uncommon or technical sports terms in parentheses right after using them.',
  },
  '12-14': {
    maxWords: 180,
    style: 'Write a detailed news summary with relevant stats and context. Use a mature, journalistic tone.',
    termHandling: 'Only explain highly advanced or obscure technical terms. Assume the reader understands basic sports terminology.',
  },
};

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(ageRange: AgeRange, sport: string, locale: Locale): string {
  const config = AGE_RANGE_CONFIGS[ageRange];
  const language = locale === 'es' ? 'Spanish' : 'English';

  return [
    `You are a sports news writer for children aged ${ageRange}.`,
    `Write in ${language}.`,
    `Sport context: ${sport}.`,
    `${config.style}`,
    `${config.termHandling}`,
    `Maximum length: ${config.maxWords} words. Be concise.`,
    `IMPORTANT: Never include violent, sexual, or inappropriate content. Keep everything family-friendly.`,
    `Output ONLY the summary text, nothing else. No titles, no labels, no markdown.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generate an age-adapted summary of a news article using AI.
 * Returns empty string if AI is unavailable or on error (never throws).
 */
export async function generateSummary(
  title: string,
  content: string,
  ageRange: AgeRange,
  sport: string,
  locale: Locale,
): Promise<string> {
  try {
    // Fast-fail if provider is down
    const available = await isProviderAvailable();
    if (!available) {
      return '';
    }

    const systemPrompt = buildSystemPrompt(ageRange, sport, locale);

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Rewrite this sports news for a ${ageRange} year-old child:\n\nTitle: ${title}\n\nContent: ${content}`,
      },
    ];

    const client = getAIClient();
    // AIClient already retries internally (3 attempts), no manual retry needed
    const response = await client.sendMessage(messages, 'generation');

    return response.content.trim();
  } catch (err) {
    logger.warn({ ageRange, locale, err: err instanceof Error ? err.message : err }, 'Failed to generate summary');
    return '';
  }
}

export type { AgeRange };
