import { z } from 'zod';
import { getAIClient, isProviderAvailable } from './ai-client';
import { logger } from './logger';
import { getSportLabel, getAgeRangeLabel } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgeRange = '6-8' | '9-11' | '12-14';
type Sport = string;

// Legacy schema — news-based questions (no topic field)
const GeneratedQuizSchema = z.object({
  question: z.string().min(10).max(300),
  options: z.array(z.string().min(1).max(150)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  points: z.number().int().min(10).max(15),
  topic: z.string().min(3).max(80).optional(),
});

export type GeneratedQuizOutput = z.infer<typeof GeneratedQuizSchema>;

// Extended schema for timeless questions
const TimelessQuestionSchema = z.object({
  question: z.string().min(10).max(300),
  options: z.array(z.string().min(1).max(200)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  topic: z.string().min(3),  // truncated to 80 chars after validation
  explanation: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GeneratedQuestion — shared output type
// ---------------------------------------------------------------------------

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  sport: Sport;
  ageRange: AgeRange;
  topic: string;
  isTimeless: boolean;
  relatedNewsId?: string;
  explanation?: string;
  points?: number;
}

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
// System prompt builders
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
- Also provide a "topic" field: a short descriptive tag (max 80 chars, lowercase) describing the subject, e.g. "real madrid champions league", "lebron james career stats".

You MUST respond with ONLY valid JSON in this exact format, no extra text:
{
  "question": "The question text here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0,
  "points": 10,
  "topic": "short descriptive topic tag"
}

Where correctAnswer is the 0-based index (0, 1, 2, or 3) of the correct option.`;
}

function buildTimelessSystemPrompt(sport: Sport, ageRange: AgeRange, locale: string): string {
  const lang = locale === 'es' ? 'Spanish' : 'English';
  const safeLocale = (locale === 'en' ? 'en' : 'es') as Locale;
  const ageRangeLabel = getAgeRangeLabel(ageRange as '6-8' | '9-11' | '12-14', safeLocale);
  const sportLabel = getSportLabel(sport as Parameters<typeof getSportLabel>[0], safeLocale);

  return `You are creating sports trivia for children aged ${ageRangeLabel}.
Generate ONE multiple-choice question about ${sportLabel}.
The question must be about general sports knowledge, NOT recent news.
Topics to draw from: rules of the sport, competition formats, historical records,
famous athletes (past or present), iconic moments, statistics that are stable over time.
The question must be fun, educational, and appropriate for children.
Write all text in ${lang}.

Output JSON with this exact shape:
{
  "question": "string",
  "options": ["string", "string", "string", "string"],
  "correctAnswer": 0|1|2|3,
  "topic": "string (max 80 chars, describes the subject, e.g. 'FIFA World Cup history')",
  "explanation": "string (1 sentence, kid-friendly)"
}

Rules:
- correctAnswer is the 0-based index of the correct option in the options array.
- The question must have exactly one correct answer.
- The three wrong options must be plausible but clearly incorrect.
- topic must be descriptive enough to avoid regenerating the same question again.
- Do NOT reference events from the last 6 months.
- Use simple language appropriate for ${ageRangeLabel}.`;
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
// News-based generation function (updated to return topic)
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
        // Normalise topic: lowercase + trim + truncate
        if (result.data.topic) {
          result.data.topic = result.data.topic.toLowerCase().trim().slice(0, 80);
        }
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

// ---------------------------------------------------------------------------
// Timeless question generation function
// ---------------------------------------------------------------------------

export async function generateTimelessQuestion(
  sport: Sport,
  ageRange: AgeRange,
  locale: string = 'es',
): Promise<GeneratedQuestion | null> {
  // Internal availability check — callers of this function do not need to
  // call isProviderAvailable() separately before invoking this function.
  // (Unlike generateQuizFromNews which relies on the caller to check.)
  const available = await isProviderAvailable();
  if (!available) {
    return null;
  }

  const client = getAIClient();
  const systemPrompt = buildTimelessSystemPrompt(sport, ageRange, locale);
  const safeLocale = (locale === 'en' ? 'en' : 'es') as Locale;
  const ageRangeLabel = getAgeRangeLabel(ageRange as '6-8' | '9-11' | '12-14', safeLocale);
  const sportLabel = getSportLabel(sport as Parameters<typeof getSportLabel>[0], safeLocale);

  const userPrompt = `Generate a timeless trivia question about ${sportLabel} for children aged ${ageRangeLabel}.`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.sendMessage(messages, 'generation');
      const raw = extractJSON(response.content);
      const parsed = JSON.parse(raw);
      const result = TimelessQuestionSchema.safeParse(parsed);

      if (result.success) {
        const normalizedTopic = result.data.topic.toLowerCase().trim().slice(0, 80);
        return {
          question: result.data.question,
          options: result.data.options,
          correctAnswer: result.data.correctAnswer,
          sport,
          ageRange,
          topic: normalizedTopic,
          isTimeless: true,
          explanation: result.data.explanation,
          points: 10,
        };
      }

      logger.warn(
        { attempt: attempt + 1, issues: result.error.issues, sport, ageRange },
        'Timeless question validation failed',
      );

      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err) {
      logger.warn(
        { attempt: attempt + 1, err: err instanceof Error ? err.message : err, sport, ageRange },
        'Error generating timeless question',
      );

      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  logger.warn({ sport, ageRange }, 'Failed to generate timeless question after 2 attempts, returning null');
  return null;
}
