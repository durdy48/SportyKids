import cron from 'node-cron';
import { prisma } from '../config/database';
import { isProviderAvailable } from '../services/ai-client';
import { generateQuizFromNews, generateTimelessQuestion } from '../services/quiz-generator';
import { isTopicDuplicate } from '../services/quiz-dedup';
import { logger } from '../services/logger';
import { SPORTS } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DailyQuizResult {
  generated: number;
  errors: number;
}

const AGE_RANGES = ['6-8', '9-11', '12-14'] as const;

const MINIMUM_QUESTIONS_PER_SPORT_AGE = 5;

// ---------------------------------------------------------------------------
// Round-robin sport selection
// ---------------------------------------------------------------------------

interface NewsCandidate {
  id: string;
  title: string;
  summary: string;
  sport: string;
  team: string | null;
}

function selectRoundRobin(articles: NewsCandidate[], maxCount: number): NewsCandidate[] {
  // Group by sport
  const bySport: Map<string, NewsCandidate[]> = new Map();
  for (const article of articles) {
    const list = bySport.get(article.sport) || [];
    list.push(article);
    bySport.set(article.sport, list);
  }

  const sports = Array.from(bySport.keys());
  if (sports.length === 0) return [];

  const selected: NewsCandidate[] = [];
  const indices: Map<string, number> = new Map();
  sports.forEach((s) => indices.set(s, 0));

  let sportIdx = 0;
  while (selected.length < maxCount) {
    const sport = sports[sportIdx % sports.length]!;
    const sportArticles = bySport.get(sport)!;
    const articleIdx = indices.get(sport)!;

    if (articleIdx < sportArticles.length) {
      selected.push(sportArticles[articleIdx]!);
      indices.set(sport, articleIdx + 1);
    }

    sportIdx++;

    // If we've gone through all sports and none had more articles, stop
    if (sportIdx >= sports.length * (Math.max(...Array.from(indices.values())) + 1)) {
      break;
    }
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Main generation logic
// ---------------------------------------------------------------------------

export async function generateDailyQuiz(): Promise<DailyQuizResult> {
  const result: DailyQuizResult = { generated: 0, errors: 0 };

  // Check provider availability first
  const available = await isProviderAvailable();
  if (!available) {
    logger.info('AI provider not available. Skipping quiz generation.');
    return result;
  }

  // Get recent approved news from the last 30 days (widened from 48h)
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const recentNews = await prisma.newsItem.findMany({
    where: {
      safetyStatus: 'approved',
      publishedAt: { gte: cutoff },
    },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      title: true,
      summary: true,
      sport: true,
      team: true,
    },
  });

  // Filter out articles that already have quiz questions
  const existingQuizNewsIds = await prisma.quizQuestion.findMany({
    where: {
      relatedNewsId: { in: recentNews.map((n) => n.id) },
    },
    select: { relatedNewsId: true, ageRange: true },
  });

  // Build a set of "newsId:ageRange" combos that already exist
  const existingCombos = new Set(
    existingQuizNewsIds.map((q) => `${q.relatedNewsId}:${q.ageRange}`),
  );

  // For initial filtering, find articles that have at least one missing age range
  const articlesWithMissingQuizzes = recentNews.filter((n) =>
    AGE_RANGES.some((age) => !existingCombos.has(`${n.id}:${age}`)),
  );

  // Select up to 40 articles, round-robin by sport (40 × 3 age ranges = 120 questions max)
  const selected = selectRoundRobin(articlesWithMissingQuizzes, 40);

  logger.info(
    { totalArticles: recentNews.length, needGeneration: articlesWithMissingQuizzes.length, selected: selected.length },
    'Quiz generation candidates identified',
  );

  // Generate quizzes for each article x ageRange
  for (const article of selected) {
    for (const ageRange of AGE_RANGES) {
      // Skip if this combo already exists
      if (existingCombos.has(`${article.id}:${ageRange}`)) {
        continue;
      }

      try {
        const quiz = await generateQuizFromNews(
          {
            title: article.title,
            summary: article.summary,
            sport: article.sport,
            team: article.team,
          },
          ageRange,
          'es', // default locale
        );

        if (quiz) {
          // Topic dedup check: skip if this topic was already covered in the last 30 days
          const normalizedTopic = quiz.topic ? quiz.topic.toLowerCase().trim().slice(0, 80) : undefined;
          if (normalizedTopic) {
            const duplicate = await isTopicDuplicate(normalizedTopic);
            if (duplicate) {
              logger.info({ topic: normalizedTopic }, 'Skipping question: topic already covered in last 30 days');
              continue;
            }
          }

          const now = new Date();
          const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

          await prisma.quizQuestion.create({
            data: {
              question: quiz.question,
              options: quiz.options,
              correctAnswer: quiz.correctAnswer,
              sport: article.sport,
              points: quiz.points,
              relatedNewsId: article.id,
              generatedAt: now,
              ageRange,
              expiresAt,
              isTimeless: false,
              topic: normalizedTopic ?? null,
            },
          });

          result.generated++;
          logger.info(
            { title: article.title, ageRange, topic: normalizedTopic },
            'Generated quiz question',
          );
        } else {
          result.errors++;
        }
      } catch (err) {
        result.errors++;
        logger.error(
          { err: err instanceof Error ? err : new Error(String(err)), articleId: article.id, ageRange },
          'Error generating quiz for article',
        );
      }

      // 1-second delay between LLM calls
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // ---------------------------------------------------------------------------
  // Per-sport gap fill pass: ensure every sport x ageRange has >= 3 questions
  // ---------------------------------------------------------------------------
  await runGapFillPass(result);

  logger.info(
    { generated: result.generated, errors: result.errors },
    'Daily quiz generation finished',
  );

  // Send push notification to users with dailyQuiz preference
  if (result.generated > 0) {
    try {
      const { sendPushToUsers } = await import('../services/push-sender');
      const { t } = await import('@sportykids/shared');
      const users = await prisma.user.findMany({
        where: { pushEnabled: true },
        select: { id: true, locale: true },
      });
      if (users.length > 0) {
        // Group users by locale for per-locale push messages
        const byLocale = new Map<string, string[]>();
        for (const u of users) {
          const loc = u.locale || 'es';
          if (!byLocale.has(loc)) byLocale.set(loc, []);
          byLocale.get(loc)!.push(u.id);
        }

        for (const [locale, userIds] of byLocale) {
          const safeLocale = (locale === 'en' ? 'en' : 'es') as Locale;
          await sendPushToUsers(
            userIds,
            {
              title: t('push.quiz_ready_title', safeLocale),
              body: t('push.quiz_ready_body', safeLocale),
              data: { screen: 'Quiz' },
            },
            'dailyQuiz',
          );
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error sending push notifications for daily quiz');
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Gap fill: generate timeless questions for underfilled sport/ageRange slots
// ---------------------------------------------------------------------------

export async function runGapFillPass(result: DailyQuizResult): Promise<void> {
  const now = new Date();

  for (const sport of SPORTS) {
    for (const ageRange of AGE_RANGES) {
      const count = await prisma.quizQuestion.count({
        where: {
          sport,
          ageRange,
          OR: [
            { expiresAt: { gt: now } },
            { isTimeless: true },
          ],
        },
      });

      if (count < MINIMUM_QUESTIONS_PER_SPORT_AGE) {
        logger.info({ sport, ageRange, count }, 'Gap fill: generating timeless question');
        try {
          const question = await generateTimelessQuestion(sport, ageRange, 'es');
          if (question) {
            const normalizedTopic = question.topic; // already normalised in generateTimelessQuestion
            const duplicate = await isTopicDuplicate(normalizedTopic);
            if (!duplicate) {
              await prisma.quizQuestion.create({
                data: {
                  question: question.question,
                  options: question.options,
                  correctAnswer: question.correctAnswer,
                  sport,
                  points: question.points ?? 10,
                  generatedAt: new Date(),
                  ageRange,
                  expiresAt: null,
                  isTimeless: true,
                  topic: normalizedTopic,
                },
              });
              result.generated++;
            } else {
              logger.info({ topic: normalizedTopic, sport, ageRange }, 'Gap fill: topic duplicate, skipping');
            }
          } else {
            logger.warn({ sport, ageRange }, 'Gap fill: generateTimelessQuestion returned null');
          }
        } catch (err) {
          result.errors++;
          logger.error({ err, sport, ageRange }, 'Gap fill: error generating timeless question');
        }

        // Brief delay to avoid overwhelming AI provider
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cron job: daily at 6:00 AM
// ---------------------------------------------------------------------------

let activeJob: ReturnType<typeof cron.schedule> | null = null;

export function startDailyQuizJob(): void {
  if (activeJob) {
    logger.info('Daily quiz job is already active.');
    return;
  }

  activeJob = cron.schedule('0 6 * * *', async () => {
    logger.info('Running daily quiz generation...');
    await generateDailyQuiz();
  });

  logger.info('Daily quiz job scheduled: daily at 06:00.');
}
