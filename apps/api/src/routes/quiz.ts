import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { generateDailyQuiz } from '../jobs/generate-daily-quiz';
import { awardSticker, evaluateAchievements } from '../services/gamification';
import { checkMissionProgress } from '../services/mission-generator';
import { parentalGuard } from '../middleware/parental-guard';
import { subscriptionGuard } from '../middleware/subscription-guard';
import { verifyParentalSession } from '../services/parental-session';
import { trackEvent } from '../services/monitoring';
import { ValidationError, NotFoundError, AuthenticationError } from '../errors';
import { logger } from '../services/logger';

const router = Router();

/** Fisher-Yates shuffle — unbiased in-place shuffle */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Sport balance helper — cap questions per sport
// ---------------------------------------------------------------------------

function applySportBalance<T extends { sport: string }>(
  items: T[],
  maxPerSport: number,
  targetCount: number,
): T[] {
  const counts: Map<string, number> = new Map();
  const selected: T[] = [];

  for (const item of items) {
    if (selected.length >= targetCount) break;
    const current = counts.get(item.sport) ?? 0;
    if (current < maxPerSport) {
      selected.push(item);
      counts.set(item.sport, current + 1);
    }
  }

  return selected;
}

// ---------------------------------------------------------------------------
// GET /api/quiz/questions — Get random questions (with optional age filtering)
// ---------------------------------------------------------------------------

const questionsSchema = z.object({
  count: z.coerce.number().int().min(1).max(20).default(5),
  sport: z.string().optional(),
  age: z.enum(['6-8', '9-11', '12-14']).optional(),
  userId: z.string().optional(),
});

router.get('/questions', parentalGuard, subscriptionGuard('quiz'), async (req: Request, res: Response) => {
  const parsed = questionsSchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid parameters', parsed.error.flatten());
  }

  const { count, sport, age, userId } = parsed.data;
  const now = new Date();

  if (age) {
    // -------------------------------------------------------------------------
    // Step 1: Resolve answered question IDs for per-user deduplication
    // -------------------------------------------------------------------------
    let answeredIds: string[] = [];
    if (userId) {
      const cutoff60Days = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const historyRows = await prisma.userQuizHistory.findMany({
        where: {
          userId,
          answeredAt: { gt: cutoff60Days },
        },
        select: { questionId: true },
        take: 1000, // safety cap
      });
      answeredIds = historyRows.map((h) => h.questionId);
    }

    // -------------------------------------------------------------------------
    // Step 2: Build base filters
    // -------------------------------------------------------------------------
    const baseExclude = answeredIds.length > 0 ? { id: { notIn: answeredIds } } : {};
    const sportFilter = sport ? { sport } : {};
    const ageFilter = { ageRange: age };

    // -------------------------------------------------------------------------
    // Step 3: Fetch pool A — recent/daily (non-expired, not seed, not timeless)
    // -------------------------------------------------------------------------
    const poolARaw = await prisma.quizQuestion.findMany({
      where: {
        ...baseExclude,
        ...sportFilter,
        ...ageFilter,
        isTimeless: false,
        generatedAt: { not: null },
        // NOTE: `expiresAt: null` is included here as a safety net for any future
        // non-timeless questions that might not have an explicit expiry. In practice,
        // all daily questions (isTimeless=false, generatedAt IS NOT NULL) should have
        // expiresAt set to 48h from creation. Timeless questions (isTimeless=true)
        // are already excluded by the `isTimeless: false` filter above.
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
    });
    const poolA = poolARaw.map((q) => ({ ...q, isDaily: true }));

    // -------------------------------------------------------------------------
    // Step 4: Fetch pool B — timeless questions
    // -------------------------------------------------------------------------
    const poolBRaw = await prisma.quizQuestion.findMany({
      where: {
        ...baseExclude,
        ...sportFilter,
        ...ageFilter,
        isTimeless: true,
      },
    });
    const poolB = poolBRaw.map((q) => ({ ...q, isDaily: false }));

    // -------------------------------------------------------------------------
    // Step 5: Fetch pool C — seed questions (fallback). Apply answeredIds
    // exclusion so users don't see the same seed questions on every quiz.
    // If the user has answered ALL seeds, fall back to the full seed pool
    // (better to repeat old seeds than to return zero questions).
    //
    // Seeds with ageRange=null are treated as "suitable for all ages" so they
    // are always included in pool C regardless of the requested age filter.
    // -------------------------------------------------------------------------
    const poolCWhere: Record<string, unknown> = {
      generatedAt: null,
      OR: [{ ageRange: age }, { ageRange: null }],
    };
    if (sport) poolCWhere.sport = sport;

    const seedDeduped = answeredIds.length > 0;
    const poolCQuery = seedDeduped
      ? { ...poolCWhere, id: { notIn: answeredIds } }
      : poolCWhere;

    let poolCRaw = await prisma.quizQuestion.findMany({ where: poolCQuery });
    // If all seeds were filtered out by dedup, fall back to the full seed pool
    // (better to show old seeds than to return zero questions)
    if (seedDeduped && poolCRaw.length === 0) {
      poolCRaw = await prisma.quizQuestion.findMany({ where: poolCWhere });
    }
    const poolC = poolCRaw.map((q) => ({ ...q, isDaily: false }));

    // -------------------------------------------------------------------------
    // Step 6: Determine target counts (70/30 split)
    // -------------------------------------------------------------------------
    const targetTimeless = Math.ceil(count * 0.3);
    const targetRecent = count - targetTimeless;

    // -------------------------------------------------------------------------
    // Step 7: Shuffle each pool and take proportional slices (70/30 intent),
    //         then apply ONE combined sport-balance cap across both pools.
    //         Applying the cap per-pool would allow pool A to contribute
    //         maxPerSport football questions AND pool B to contribute another
    //         maxPerSport, violating the PRD "across the combined set" guarantee.
    // -------------------------------------------------------------------------
    const maxPerSport = Math.floor(count / 4) + 1;

    const shuffledA = fisherYatesShuffle(poolA);
    const shuffledB = fisherYatesShuffle(poolB);

    // Take proportional slices (preserving 70/30 intent) without per-pool caps
    const fromA = shuffledA.slice(0, targetRecent);
    const fromB = shuffledB.slice(0, targetTimeless);

    // Merge and apply a single combined sport-balance cap
    const preCombined = fisherYatesShuffle([...fromA, ...fromB]);
    const balanced = sport
      ? preCombined // No sport balance needed when filtering by a single sport
      : applySportBalance(preCombined, maxPerSport, count);

    // -------------------------------------------------------------------------
    // Step 8: Combine and fill gaps with seed questions
    // -------------------------------------------------------------------------
    const combined: Array<Record<string, unknown>> = [...balanced];

    if (combined.length < count) {
      const gap = count - combined.length;
      const shuffledC = fisherYatesShuffle(poolC);
      const fillItems = shuffledC.slice(0, gap);
      combined.push(...fillItems);
    }

    // -------------------------------------------------------------------------
    // Step 9: Final shuffle and return
    // -------------------------------------------------------------------------
    const finalShuffled = fisherYatesShuffle(combined).slice(0, count);
    res.json({ questions: finalShuffled });
  } else {
    // Original behavior: return all matching questions without age filtering
    const where: Record<string, unknown> = {};
    if (sport) where.sport = sport;

    const all = await prisma.quizQuestion.findMany({ where });
    const shuffled = fisherYatesShuffle(all).slice(0, count);

    const questions = shuffled.map((q) => ({
      ...q,
      options: q.options,
      isDaily: q.generatedAt !== null,
    }));

    res.json({ questions });
  }
});

// ---------------------------------------------------------------------------
// POST /api/quiz/answer — Submit answer and add points
// ---------------------------------------------------------------------------

const answerSchema = z.object({
  userId: z.string(),
  questionId: z.string(),
  answer: z.number().int().min(0).max(3),
});

router.post('/answer', parentalGuard, subscriptionGuard('quiz'), async (req: Request, res: Response) => {
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const { userId, questionId, answer } = parsed.data;

  const question = await prisma.quizQuestion.findUnique({ where: { id: questionId } });
  if (!question) {
    throw new NotFoundError('Question not found');
  }

  const correct = answer === question.correctAnswer;
  let earnedPoints = 0;
  let bonusPoints = 0;
  let bonusSticker: { id: string; name: string; rarity: string } | null = null;

  if (correct) {
    earnedPoints = question.points;

    // Increment quiz correct streak
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const newStreak = user.currentQuizCorrectStreak + 1;

    if (newStreak >= 5) {
      // Perfect streak of 5: award bonus points + rare sticker, reset streak
      bonusPoints = 50;
      const sticker = await awardSticker(userId, 'quiz_perfect', 'rare');
      if (sticker) {
        bonusSticker = { id: sticker.id, name: sticker.name, rarity: sticker.rarity };
      }
      await prisma.user.update({
        where: { id: userId },
        data: {
          totalPoints: { increment: earnedPoints + bonusPoints },
          currentQuizCorrectStreak: 0,
          quizPerfectCount: { increment: 1 },
        },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: {
          totalPoints: { increment: earnedPoints },
          currentQuizCorrectStreak: newStreak,
        },
      });
    }

    // Evaluate achievements after point changes
    await evaluateAchievements(userId);

    // Check daily mission progress for correct answer
    await checkMissionProgress(userId, 'quiz_correct');

    // If perfect streak reached, also track quiz_perfect for missions
    if (newStreak >= 5) {
      await checkMissionProgress(userId, 'quiz_perfect');
    }
  } else {
    // Wrong answer — reset quiz correct streak
    await prisma.user.update({
      where: { id: userId },
      data: { currentQuizCorrectStreak: 0 },
    });
  }

  // -------------------------------------------------------------------------
  // Persist UserQuizHistory — non-blocking, upsert for idempotency
  // -------------------------------------------------------------------------
  prisma.userQuizHistory
    .upsert({
      where: {
        userId_questionId: { userId, questionId },
      },
      create: { userId, questionId },
      update: { answeredAt: new Date() },
    })
    .catch((err: unknown) => {
      // Non-blocking: log and swallow error so the answer response is unaffected
      logger.error({ err, userId, questionId }, 'Failed to upsert UserQuizHistory');
    });

  trackEvent('quiz_played', {
    userId,
    questionId,
    correct: String(correct),
    sport: question.sport,
  });

  res.json({
    correct,
    correctAnswer: question.correctAnswer,
    pointsEarned: earnedPoints + bonusPoints,
    ...(bonusPoints > 0 && { bonusPoints }),
    ...(bonusSticker && { bonusSticker }),
  });
});

// ---------------------------------------------------------------------------
// GET /api/quiz/score/:userId — Total score
// ---------------------------------------------------------------------------

router.get('/score/:userId', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params['userId'] as string },
    select: { totalPoints: true, name: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json(user);
});

// ---------------------------------------------------------------------------
// POST /api/quiz/generate — Trigger daily quiz generation manually
// ---------------------------------------------------------------------------

const generateSchema = z.object({
  userId: z.string().min(1),
});

router.post('/generate', async (req: Request, res: Response) => {
  // Require parental session verification
  const sessionToken = req.headers['x-parental-session'] as string | undefined;
  const sessionUserId = await verifyParentalSession(sessionToken);
  if (!sessionUserId) {
    throw new AuthenticationError('Parental session required');
  }

  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('userId is required', parsed.error.flatten());
  }

  // Verify the user exists
  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const result = await generateDailyQuiz();
  res.json(result);
});

export default router;
