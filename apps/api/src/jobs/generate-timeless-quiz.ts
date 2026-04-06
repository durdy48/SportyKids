import cron from 'node-cron';
import { prisma } from '../config/database';
import { isProviderAvailable } from '../services/ai-client';
import { generateTimelessQuestion } from '../services/quiz-generator';
import { isTopicDuplicate } from '../services/quiz-dedup';
import { logger } from '../services/logger';
import { SPORTS } from '@sportykids/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelessQuizResult {
  generated: number;
  skipped: number;
  errors: number;
}

const AGE_RANGES = ['6-8', '9-11', '12-14'] as const;
const QUESTIONS_PER_SLOT = 2;
const MAX_TOPIC_RETRIES = 3;

// ---------------------------------------------------------------------------
// Main weekly timeless quiz generation
// ---------------------------------------------------------------------------

export async function generateTimelessQuiz(): Promise<TimelessQuizResult> {
  const result: TimelessQuizResult = { generated: 0, skipped: 0, errors: 0 };

  const available = await isProviderAvailable();
  if (!available) {
    logger.info('AI provider not available. Skipping timeless quiz generation.');
    return result;
  }

  logger.info('Starting weekly timeless quiz generation...');

  let consecutiveProviderFailures = 0;

  for (const sport of SPORTS) {
    for (const ageRange of AGE_RANGES) {
      let generatedForSlot = 0;

      for (let q = 0; q < QUESTIONS_PER_SLOT; q++) {
        let persisted = false;

        for (let attempt = 0; attempt < MAX_TOPIC_RETRIES; attempt++) {
          try {
            const question = await generateTimelessQuestion(sport, ageRange, 'es'); // TODO: multi-locale — out of scope per prd3.md §3

            if (!question) {
              logger.warn({ sport, ageRange, attempt }, 'Timeless question generation returned null');
              result.skipped++;
              consecutiveProviderFailures++;
              break; // AI unavailable or failed — move to next question slot
            }

            consecutiveProviderFailures = 0; // reset on any successful AI call

            const normalizedTopic = question.topic; // already normalised in generateTimelessQuestion
            const duplicate = await isTopicDuplicate(normalizedTopic);

            if (duplicate) {
              logger.info(
                { sport, ageRange, topic: normalizedTopic, attempt },
                'Topic collision on retry, trying again',
              );
              // Brief delay before retry
              await new Promise((resolve) => setTimeout(resolve, 500));
              continue;
            }

            // Persist the question
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
            generatedForSlot++;
            persisted = true;

            logger.info({ sport, ageRange, topic: normalizedTopic }, 'Generated timeless question');
            break; // Success — move to next question in this slot
          } catch (err) {
            result.errors++;
            consecutiveProviderFailures++;
            logger.error(
              { err: err instanceof Error ? err : new Error(String(err)), sport, ageRange, attempt },
              'Error generating timeless question',
            );
            break; // On error, move to next slot
          }
        }

        if (!persisted && generatedForSlot === 0) {
          // All retries exhausted for this question slot
          logger.warn(
            { sport, ageRange, slot: q },
            'Max retries exceeded for timeless question slot, moving to next',
          );
        }

        // Abort early if the AI provider is consistently down — avoids burning retries
        // across all remaining sport/ageRange combinations.
        if (consecutiveProviderFailures >= 5 && result.generated === 0) {
          logger.warn(
            { errors: result.errors, skipped: result.skipped },
            'Aborting timeless quiz generation: 5 consecutive failures with 0 generated, provider likely unavailable',
          );
          return result;
        }

        // Brief delay between questions to avoid overwhelming AI provider
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  logger.info(
    { generated: result.generated, skipped: result.skipped, errors: result.errors },
    'Weekly timeless quiz generation finished',
  );

  return result;
}

// ---------------------------------------------------------------------------
// Cron job: every Monday at 05:00 UTC
// ---------------------------------------------------------------------------

export async function runGenerateTimelessQuiz(triggeredBy: 'cron' | 'manual' = 'cron', triggeredId?: string, existingRunId?: string): Promise<void> {
  const run = existingRunId
    ? { id: existingRunId }
    : await prisma.jobRun.create({
        data: { jobName: 'generate-timeless-quiz', status: 'running', triggeredBy, triggeredId },
      });
  try {
    const result = await generateTimelessQuiz();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        output: { generated: result.generated, skipped: result.skipped, errors: result.errors },
      },
    });
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: 'error', finishedAt: new Date(), output: { error: String(e) } },
    });
    throw e;
  }
}

let activeJob: ReturnType<typeof cron.schedule> | null = null;

export function startTimelessQuizJob(): void {
  if (activeJob) {
    logger.info('Timeless quiz job is already active.');
    return;
  }

  activeJob = cron.schedule('0 5 * * 1', async () => {
    logger.info('Running weekly timeless quiz generation...');
    await runGenerateTimelessQuiz('cron');
  });

  logger.info('Timeless quiz job scheduled: every Monday at 05:00 UTC.');
}
