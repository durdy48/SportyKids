import Parser from 'rss-parser';
import { prisma } from '../config/database';
import { classifyNews } from './classifier';
import { moderateContent, shouldFailOpen } from './content-moderator';
import { logger } from './logger';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'SportyKids/1.0 (Sports news aggregator)',
  },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  sourceName: string;
  itemsProcessed: number;
  itemsCreated: number;
  itemsSkipped: number;
  moderationApproved: number;
  moderationRejected: number;
  moderationErrors: number;
}

export interface SyncAllResult {
  totalProcessed: number;
  totalCreated: number;
  totalApproved: number;
  totalRejected: number;
  totalErrors: number;
  sources: SyncResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Cleans HTML and truncates text
function cleanSummary(text: string | undefined, maxChars: number = 200): string {
  if (!text) return '';
  // Remove HTML tags
  const clean = text.replace(/<[^>]*>/g, '').trim();
  if (clean.length <= maxChars) return clean;
  return clean.substring(0, maxChars).replace(/\s+\S*$/, '') + '...';
}

// Extracts image URL from RSS content
function extractImage(item: Parser.Item): string {
  // Try enclosure first
  if (item.enclosure?.url) return item.enclosure.url;

  // Look in media:content or media:thumbnail
  const media = (item as Record<string, unknown>)['media:content'] as
    | { $?: { url?: string } }
    | undefined;
  if (media?.$?.url) return media.$.url;

  const thumbnail = (item as Record<string, unknown>)['media:thumbnail'] as
    | { $?: { url?: string } }
    | undefined;
  if (thumbnail?.$?.url) return thumbnail.$.url;

  // Look for <img> in the content
  const content = item.content || item['content:encoded'] || '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/);
  if (imgMatch?.[1]) return imgMatch[1];

  return '';
}

// ---------------------------------------------------------------------------
// Sync a single source
// ---------------------------------------------------------------------------

export async function syncSource(
  sourceId: string,
  sourceName: string,
  sourceUrl: string,
  sport: string,
): Promise<SyncResult> {
  const result: SyncResult = {
    sourceName,
    itemsProcessed: 0,
    itemsCreated: 0,
    itemsSkipped: 0,
    moderationApproved: 0,
    moderationRejected: 0,
    moderationErrors: 0,
  };

  try {
    const feed = await parser.parseURL(sourceUrl);

    for (const item of feed.items) {
      if (!item.title || !item.link) continue;

      const rssGuid = item.guid || item.link;
      result.itemsProcessed++;

      // Check if item already exists and is not pending — skip re-moderation
      const existing = await prisma.newsItem.findUnique({ where: { rssGuid } });
      if (existing && existing.safetyStatus !== 'pending') {
        result.itemsSkipped++;
        continue;
      }

      const summary = cleanSummary(item.contentSnippet || item.content);
      const imageUrl = extractImage(item);
      const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();
      const classification = classifyNews(item.title, summary);

      // Run content moderation
      let safetyStatus = 'pending';
      let safetyReason: string | null = null;
      let moderatedAt: Date | null = null;

      try {
        const modResult = await moderateContent(item.title, summary);
        safetyStatus = modResult.status;
        safetyReason = modResult.reason ?? null;
        moderatedAt = modResult.status !== 'pending' ? new Date() : null;

        if (modResult.status === 'approved') {
          result.moderationApproved++;
        } else if (modResult.status === 'rejected') {
          result.moderationRejected++;
        } else {
          result.moderationErrors++;
        }
      } catch {
        result.moderationErrors++;
        if (shouldFailOpen()) {
          safetyStatus = 'approved';
          safetyReason = 'auto-approved: moderation error';
          moderatedAt = new Date();
          result.moderationApproved++;
        } else {
          safetyStatus = 'pending';
          safetyReason = 'moderation-unavailable';
        }
      }

      try {
        await prisma.newsItem.upsert({
          where: { rssGuid },
          update: {
            safetyStatus,
            safetyReason,
            moderatedAt,
          },
          create: {
            title: item.title,
            summary,
            imageUrl,
            source: sourceName,
            sourceUrl: item.link,
            sport,
            team: classification.team,
            minAge: classification.minAge,
            maxAge: classification.maxAge,
            publishedAt,
            rssGuid,
            safetyStatus,
            safetyReason,
            moderatedAt,
          },
        });

        result.itemsCreated++;
      } catch (err) {
        // Duplicate or other error — continue with the next news item
        if (!(err instanceof Error && err.message.includes('Unique constraint'))) {
          logger.error({ err, title: item.title }, 'Error inserting news item');
        }
      }
    }

    // Update last sync time for the source
    await prisma.rssSource.update({
      where: { id: sourceId },
      data: { lastSyncedAt: new Date() },
    });

    logger.info({ source: sourceName, created: result.itemsCreated, approved: result.moderationApproved, rejected: result.moderationRejected }, 'Source sync complete');
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err, source: sourceName }, 'Error syncing source');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sync all active sources
// ---------------------------------------------------------------------------

export async function syncAllSources(): Promise<SyncAllResult> {
  logger.info('Starting feed synchronization...');
  const sources = await prisma.rssSource.findMany({ where: { active: true } });

  const allResult: SyncAllResult = {
    totalProcessed: 0,
    totalCreated: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalErrors: 0,
    sources: [],
  };

  if (sources.length === 0) {
    logger.info('No active RSS sources found.');
    return allResult;
  }

  for (const source of sources) {
    const result = await syncSource(source.id, source.name, source.url, source.sport);
    allResult.totalProcessed += result.itemsProcessed;
    allResult.totalCreated += result.itemsCreated;
    allResult.totalApproved += result.moderationApproved;
    allResult.totalRejected += result.moderationRejected;
    allResult.totalErrors += result.moderationErrors;
    allResult.sources.push(result);
  }

  logger.info({ created: allResult.totalCreated, sources: sources.length, approved: allResult.totalApproved, rejected: allResult.totalRejected, errors: allResult.totalErrors }, 'Feed synchronization complete');

  return allResult;
}
