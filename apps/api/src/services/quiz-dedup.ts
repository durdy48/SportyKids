import { prisma } from '../config/database';

const TOPIC_DEDUP_WINDOW_DAYS = 30;

/**
 * Returns true if a quiz question with the given topic was already persisted
 * within the last TOPIC_DEDUP_WINDOW_DAYS days. Used by both the daily quiz
 * job and the weekly timeless quiz job to avoid covering the same topic twice.
 */
export async function isTopicDuplicate(topic: string): Promise<boolean> {
  const topicCutoff = new Date(Date.now() - TOPIC_DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const existing = await prisma.quizQuestion.findFirst({
    where: {
      topic,
      generatedAt: { gte: topicCutoff },
    },
    select: { id: true },
  });
  return existing !== null;
}
