import Parser from 'rss-parser';
import { prisma } from '../config/database';
import { classifyNews } from './classifier';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'SportyKids/1.0 (Sports news aggregator)',
  },
});

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

export async function syncSource(sourceId: string, sourceName: string, sourceUrl: string, sport: string): Promise<number> {
  let newsAdded = 0;

  try {
    const feed = await parser.parseURL(sourceUrl);

    for (const item of feed.items) {
      if (!item.title || !item.link) continue;

      const rssGuid = item.guid || item.link;
      const summary = cleanSummary(item.contentSnippet || item.content);
      const imageUrl = extractImage(item);
      const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();

      const classification = classifyNews(item.title, summary);

      try {
        await prisma.newsItem.upsert({
          where: { rssGuid },
          update: {},
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
          },
        });
        newsAdded++;
      } catch (err) {
        // Duplicate or other error — continue with the next news item
        if (!(err instanceof Error && err.message.includes('Unique constraint'))) {
          console.error(`  Error inserting news item "${item.title}":`, err);
        }
      }
    }

    // Update last sync time for the source
    await prisma.rssSource.update({
      where: { id: sourceId },
      data: { lastSyncedAt: new Date() },
    });

    console.log(`  OK ${sourceName}: ${newsAdded} news items processed`);
  } catch (err) {
    console.error(`  Error syncing ${sourceName}:`, err instanceof Error ? err.message : err);
  }

  return newsAdded;
}

export async function syncAllSources(): Promise<number> {
  console.log('Starting feed synchronization...');
  const sources = await prisma.rssSource.findMany({ where: { active: true } });

  if (sources.length === 0) {
    console.log('No active RSS sources found.');
    return 0;
  }

  let totalNews = 0;
  for (const source of sources) {
    const count = await syncSource(source.id, source.name, source.url, source.sport);
    totalNews += count;
  }

  console.log(`Synchronization complete: ${totalNews} news items processed from ${sources.length} sources.`);
  return totalNews;
}
