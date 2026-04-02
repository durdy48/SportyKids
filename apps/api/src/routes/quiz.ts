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

const router = Router();

/** Fisher-Yates shuffle — unbiased in-place shuffle */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// GET /api/quiz/questions — Get random questions (with optional age filtering)
// ---------------------------------------------------------------------------

const questionsSchema = z.object({
  count: z.coerce.number().int().min(1).max(20).default(5),
  sport: z.string().optional(),
  age: z.enum(['6-8', '9-11', '12-14']).optional(),
});

router.get('/questions', parentalGuard, subscriptionGuard('quiz'), async (req: Request, res: Response) => {
  const parsed = questionsSchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid parameters', parsed.error.flatten());
  }

  const { count, sport, age } = parsed.data;
  const now = new Date();

  let dailyQuestions: Array<Record<string, unknown>> = [];
  let seedQuestions: Array<Record<string, unknown>> = [];

  if (age) {
    // 1. Fetch daily (generated) questions: not expired, matching age and optional sport
    const dailyWhere: Record<string, unknown> = {
      generatedAt: { not: null },
      expiresAt: { gt: now },
      ageRange: age,
    };
    if (sport) dailyWhere.sport = sport;

    const dailyRaw = await prisma.quizQuestion.findMany({ where: dailyWhere });
    dailyQuestions = dailyRaw.map((q) => ({
      ...q,
      options: q.options,
      isDaily: true,
    }));

    // 2. If fewer than count, fill from seed questions (generatedAt IS NULL)
    if (dailyQuestions.length < count) {
      const seedWhere: Record<string, unknown> = {
        generatedAt: null,
      };
      if (sport) seedWhere.sport = sport;

      const seedRaw = await prisma.quizQuestion.findMany({ where: seedWhere });
      seedQuestions = seedRaw.map((q) => ({
        ...q,
        options: q.options,
        isDaily: false,
      }));
    }

    // 3. Combine, shuffle, and slice
    const combined = [...dailyQuestions, ...seedQuestions];
    const shuffled = fisherYatesShuffle(combined).slice(0, count);

    res.json({ questions: shuffled });
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
    where: { id: req.params.userId },
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
