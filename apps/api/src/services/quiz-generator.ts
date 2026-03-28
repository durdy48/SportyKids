import { z } from 'zod';
import { getAIClient, isProviderAvailable } from './ai-client';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgeRange = '6-8' | '9-11' | '12-14';

const GeneratedQuizSchema = z.object({
  question: z.string().min(10).max(300),
  options: z.array(z.string().min(1).max(150)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  points: z.number().int().min(10).max(15),
});

export type GeneratedQuizOutput = z.infer<typeof GeneratedQuizSchema>;

// ---------------------------------------------------------------------------
// Age-range prompt configuration
// ---------------------------------------------------------------------------

interface AgeRangeConfig {
  description: string;
  questionStyle: string;
  pointsRange: string;
}

const AGE_RANGE_CONFIGS: Record<AgeRange, AgeRangeConfig> = {
  '6-8': {
    description: 'children aged 6 to 8 years old',
    questionStyle:
      'Simple "who" or "what" questions. Use short, easy words. The question should be straightforward and fun.',
    pointsRange: 'Always set points to 10.',
  },
  '9-11': {
    description: 'children aged 9 to 11 years old',
    questionStyle:
      'Questions about events, outcomes, or results. Moderate difficulty. Can reference specific matches or competitions.',
    pointsRange: 'Set points between 10 and 12.',
  },
  '12-14': {
    description: 'teenagers aged 12 to 14 years old',
    questionStyle:
      'Questions about stats, strategy, records, or analysis. Higher difficulty. Can include numbers and comparisons.',
    pointsRange: 'Set points between 10 and 15.',
  },
};

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(ageRange: AgeRange, locale: string): string {
  const cfg = AGE_RANGE_CONFIGS[ageRange];
  const lang = locale === 'es' ? 'Spanish' : 'English';

  return `You are a sports quiz generator for ${cfg.description}.
Your task is to create a multiple-choice question based on a sports news article.

Rules:
- Write the question and all options in ${lang}.
- ${cfg.questionStyle}
- Create exactly 4 answer options. Only one is correct.
- ${cfg.pointsRange}
- Keep content appropriate for children — no violence, controversy, or adult themes.
- The question must be directly answerable from the news content provided.

You MUST respond with ONLY valid JSON in this exact format, no extra text:
{
  "question": "The question text here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0,
  "points": 10
}

Where correctAnswer is the 0-based index (0, 1, 2, or 3) of the correct option.`;
}

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------

function extractJSON(text: string): string {
  // Try to find JSON object in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

export async function generateQuizFromNews(
  newsItem: { title: string; summary: string; sport: string; team?: string | null },
  ageRange: AgeRange,
  locale: string = 'es',
): Promise<GeneratedQuizOutput | null> {
  // Fast bail if provider is down
  const available = await isProviderAvailable();
  if (!available) {
    return null;
  }

  const client = getAIClient();
  const systemPrompt = buildSystemPrompt(ageRange, locale);

  const userPrompt = [
    `Sport: ${newsItem.sport}`,
    newsItem.team ? `Team: ${newsItem.team}` : null,
    `Title: ${newsItem.title}`,
    `Summary: ${newsItem.summary}`,
    '',
    'Generate a quiz question based on this news article.',
  ]
    .filter(Boolean)
    .join('\n');

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  // Attempt up to 2 times (initial + 1 retry)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.sendMessage(messages, 'generation');
      const raw = extractJSON(response.content);
      const parsed = JSON.parse(raw);
      const result = GeneratedQuizSchema.safeParse(parsed);

      if (result.success) {
        return result.data;
      }

      logger.warn({ attempt: attempt + 1, issues: result.error.issues }, 'Quiz generation validation failed');

      if (attempt === 0) {
        // Wait 1 second before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err) {
      logger.warn({ attempt: attempt + 1, err: err instanceof Error ? err.message : err }, 'Error generating quiz');

      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  // Both attempts failed
  logger.warn('Failed to generate quiz after 2 attempts, returning null');
  return null;
}
