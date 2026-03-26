/**
 * Backfill script: processes all NewsItem records with safetyStatus='pending'
 * and runs content moderation on them.
 *
 * Usage: npx tsx prisma/backfill-safety.ts
 */

import { PrismaClient } from '@prisma/client';
import { moderateContentBatch, ModerationBatchItem } from '../src/services/content-moderator';

const prisma = new PrismaClient();

const BATCH_SIZE = 50;

async function main() {
  console.log('Starting safety backfill...');

  const totalPending = await prisma.newsItem.count({
    where: { safetyStatus: 'pending' },
  });

  if (totalPending === 0) {
    console.log('No pending items to process.');
    return;
  }

  console.log(`Found ${totalPending} pending items.`);

  let processed = 0;
  let totalApproved = 0;
  let totalRejected = 0;
  let totalErrors = 0;

  while (processed < totalPending) {
    const pendingItems = await prisma.newsItem.findMany({
      where: { safetyStatus: 'pending' },
      take: BATCH_SIZE,
      select: { id: true, title: true, summary: true },
    });

    if (pendingItems.length === 0) break;

    const batchItems: ModerationBatchItem[] = pendingItems.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
    }));

    const results = await moderateContentBatch(batchItems);

    // Update each item with its moderation result
    for (const [id, result] of results) {
      try {
        await prisma.newsItem.update({
          where: { id },
          data: {
            safetyStatus: result.status,
            safetyReason: result.reason ?? null,
            moderatedAt: new Date(),
          },
        });

        if (result.status === 'approved') totalApproved++;
        else totalRejected++;
      } catch (err) {
        totalErrors++;
        console.error(`Error updating item ${id}:`, err);
      }
    }

    processed += pendingItems.length;
    console.log(`Progress: ${processed}/${totalPending}`);
  }

  console.log('\nBackfill complete:');
  console.log(`  Total processed: ${processed}`);
  console.log(`  Approved: ${totalApproved}`);
  console.log(`  Rejected: ${totalRejected}`);
  console.log(`  Errors: ${totalErrors}`);
}

main()
  .catch((e) => {
    console.error('Backfill error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
