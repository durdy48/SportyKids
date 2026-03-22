import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';

const router = Router();

// GET /api/quiz/questions — Get random questions
const questionsSchema = z.object({
  count: z.coerce.number().int().min(1).max(20).default(5),
  sport: z.string().optional(),
});

router.get('/questions', async (req: Request, res: Response) => {
  const parsed = questionsSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  const { count, sport } = parsed.data;
  const where: Record<string, unknown> = {};
  if (sport) where.sport = sport;

  // Get all questions matching the filter and select randomly
  const all = await prisma.quizQuestion.findMany({ where });
  const shuffled = all.sort(() => Math.random() - 0.5).slice(0, count);

  // Format options from JSON string to array
  const questions = shuffled.map((q) => ({
    ...q,
    options: JSON.parse(q.options),
  }));

  res.json({ questions });
});

// POST /api/quiz/answer — Submit answer and add points
const answerSchema = z.object({
  userId: z.string(),
  questionId: z.string(),
  answer: z.number().int().min(0).max(3),
});

router.post('/answer', async (req: Request, res: Response) => {
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  const { userId, questionId, answer } = parsed.data;

  const question = await prisma.quizQuestion.findUnique({ where: { id: questionId } });
  if (!question) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  const correct = answer === question.correctAnswer;
  let earnedPoints = 0;

  if (correct) {
    earnedPoints = question.points;
    await prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { increment: earnedPoints } },
    });
  }

  res.json({
    correct,
    correctAnswer: question.correctAnswer,
    earnedPoints,
  });
});

// GET /api/quiz/score/:userId — Total score
router.get('/score/:userId', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { totalPoints: true, name: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

export default router;
