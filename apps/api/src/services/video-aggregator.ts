import Parser from 'rss-parser';
import { prisma } from '../config/database';
import { classifyNews } from './classifier';
import { moderateContent } from './content-moderator';
import { logger } from './logger';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'SportyKids/1.0 (Video aggregator)',
  },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoSyncResult {
  sourceName: string;
  itemsProcessed: number;
  itemsCreated: number;
  itemsSkipped: number;
  moderationApproved: number;
  moderationRejected: number;
  moderationErrors: number;
}

export interface VideoSyncAllResult {
  totalProcessed: number;
  totalCreated: number;
  totalApproved: number;
  totalRejected: number;
  totalErrors: number;
  sources: VideoSyncResult[];
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function buildFeedUrl(platform: string, channelId?: string, playlistId?: string): string {
  if (platform === 'youtube_channel' && channelId) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  }
  if (platform === 'youtube_playlist' && playlistId) {
    return `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  }
  return '';
}

export function extractYouTubeVideoId(atomId: string): string | null {
  const ytPrefix = 'yt:video:';
  if (atomId.startsWith(ytPrefix)) return atomId.slice(ytPrefix.length);
  const match = atomId.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function buildEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function buildThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

// ---------------------------------------------------------------------------
// Sync a single video source
// ---------------------------------------------------------------------------

export async function syncVideoSource(
  sourceId: string,
  sourceName: string,
  feedUrl: string,
  sport: string,
): Promise<VideoSyncResult> {
  const result: VideoSyncResult = {
    sourceName,
    itemsProcessed: 0,
    itemsCreated: 0,
    itemsSkipped: 0,
    moderationApproved: 0,
    moderationRejected: 0,
    moderationErrors: 0,
  };

  try {
    const feed = await parser.parseURL(feedUrl);

    // Pre-fetch all existing rssGuids to avoid N+1 queries
    const candidateGuids: string[] = [];
    for (const item of feed.items) {
      const atomId = item.id || item.link || '';
      const videoId = extractYouTubeVideoId(atomId);
      if (videoId) candidateGuids.push(`yt:video:${videoId}`);
    }
    const existingReels = await prisma.reel.findMany({
      where: { rssGuid: { in: candidateGuids } },
      select: { rssGuid: true, safetyStatus: true },
    });
    const existingByGuid = new Map(
      existingReels.map((r: { rssGuid: string | null; safetyStatus: string }) => [r.rssGuid, r.safetyStatus]),
    );

    for (const item of feed.items) {
      if (!item.title) continue;

      // Extract YouTube video ID from Atom id or link
      const atomId = item.id || item.link || '';
      const videoId = extractYouTubeVideoId(atomId);
      if (!videoId) continue;

      const rssGuid = `yt:video:${videoId}`;
      result.itemsProcessed++;

      // Dedup check (using pre-fetched data)
      const existingStatus = existingByGuid.get(rssGuid);
      if (existingStatus && existingStatus !== 'pending') {
        result.itemsSkipped++;
        continue;
      }

      const classification = classifyNews(item.title, item.contentSnippet || item.content || '');
      const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();

      // Content moderation
      let safetyStatus = 'pending';
      let safetyReason: string | null = null;
      let moderatedAt: Date | null = null;

      try {
        const modResult = await moderateContent(item.title, '');
        safetyStatus = modResult.status;
        safetyReason = modResult.reason ?? null;
        moderatedAt = new Date();

        if (modResult.status === 'approved') {
          result.moderationApproved++;
        } else {
          result.moderationRejected++;
        }
      } catch {
        result.moderationErrors++;
        // Fail open
        safetyStatus = 'approved';
        safetyReason = 'auto-approved: moderation error';
        moderatedAt = new Date();
        result.moderationApproved++;
      }

      try {
        await prisma.reel.upsert({
          where: { rssGuid },
          update: {
            safetyStatus,
            safetyReason,
            moderatedAt,
          },
          create: {
            title: item.title,
            videoUrl: buildEmbedUrl(videoId),
            thumbnailUrl: buildThumbnailUrl(videoId),
            source: sourceName,
            sport,
            team: classification.team,
            minAge: classification.minAge,
            maxAge: classification.maxAge,
            durationSeconds: 60, // Default; YouTube Atom feeds don't include duration. Could be enriched via YouTube Data API v3 if an API key is available.
            videoType: 'youtube_embed',
            aspectRatio: '16:9',
            rssGuid,
            videoSourceId: sourceId,
            safetyStatus,
            safetyReason,
            moderatedAt,
            publishedAt,
          },
        });
        result.itemsCreated++;
      } catch (err) {
        if (!(err instanceof Error && err.message.includes('Unique constraint'))) {
          logger.error({ err, title: item.title }, 'Error inserting reel');
        }
      }
    }

    // Update last sync time
    await prisma.videoSource.update({
      where: { id: sourceId },
      data: { lastSyncedAt: new Date() },
    });

    logger.info({ source: sourceName, created: result.itemsCreated, approved: result.moderationApproved, rejected: result.moderationRejected }, 'Video source sync complete');
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err, source: sourceName }, 'Error syncing video source');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sync all active video sources
// ---------------------------------------------------------------------------

export async function syncAllVideoSources(): Promise<VideoSyncAllResult> {
  logger.info('Starting video source synchronization...');
  const sources = await prisma.videoSource.findMany({ where: { active: true } });

  const allResult: VideoSyncAllResult = {
    totalProcessed: 0,
    totalCreated: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalErrors: 0,
    sources: [],
  };

  if (sources.length === 0) {
    logger.info('No active video sources found.');
    return allResult;
  }

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    // Only sync YouTube-based platforms
    if (!source.platform.startsWith('youtube_')) {
      continue;
    }

    const result = await syncVideoSource(source.id, source.name, source.feedUrl, source.sport);
    allResult.totalProcessed += result.itemsProcessed;
    allResult.totalCreated += result.itemsCreated;
    allResult.totalApproved += result.moderationApproved;
    allResult.totalRejected += result.moderationRejected;
    allResult.totalErrors += result.moderationErrors;
    allResult.sources.push(result);

    // Small delay between sources to be polite
    if (i < sources.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  logger.info({ created: allResult.totalCreated, sources: allResult.sources.length, approved: allResult.totalApproved, rejected: allResult.totalRejected, errors: allResult.totalErrors }, 'Video sync complete');

  return allResult;
}

// ---------------------------------------------------------------------------
// Sync a single video source by ID (for admin-triggered syncs)
// ---------------------------------------------------------------------------

export async function syncSingleVideoSource(sourceId: string): Promise<{ processed: number; errors: number }> {
  const source = await prisma.videoSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error('Source not found');
  if (!source.active) throw new Error('Source not found or inactive');
  const result = await syncVideoSource(sourceId, source.name, source.feedUrl, source.sport);
  return { processed: result.itemsCreated, errors: result.moderationErrors ?? 0 };
}
