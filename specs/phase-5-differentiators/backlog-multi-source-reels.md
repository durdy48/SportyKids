# Backlog: Multi-source video reels (YouTube, Instagram, TikTok, configurable)

## Problem

Currently all reels are YouTube embeds stored in the seed. The user wants:
1. Videos from multiple platforms (YouTube, Instagram Reels, TikTok)
2. Configurable video sources (like RSS sources but for video)
3. More diverse content, not just manually curated

## Proposed solutions

### 1. YouTube Data API (recommended for PoC)
- Use YouTube Data API v3 to search for sports highlight videos
- Search by sport + keywords (e.g., "La Liga highlights", "NBA top plays")
- Filter by: duration (<5min), upload date (<7 days), safe for kids (restricted mode)
- Requires API key (free tier: 10,000 units/day, ~100 searches)
- New service: `apps/api/src/services/video-aggregator.ts`
- Cron job to fetch new videos daily

### 2. Instagram oEmbed (public posts only)
- Instagram oEmbed API renders public posts/reels
- No API key needed for public content
- `https://api.instagram.com/oembed?url=https://www.instagram.com/reel/...`
- Limited: only works with specific post URLs, can't search/discover
- Best for curated lists of known good accounts

### 3. TikTok Embed (public videos)
- TikTok oEmbed: `https://www.tiktok.com/oembed?url=...`
- Similar to Instagram: works with specific URLs
- No search/discovery API for free tier

### 4. Configurable Video Sources model
Add to Prisma:
```prisma
model VideoSource {
  id        String @id @default(cuid())
  name      String
  platform  String  // 'youtube_channel' | 'youtube_search' | 'instagram_account' | 'manual'
  config    String  // JSON: { channelId?, searchQuery?, accountUrl?, ... }
  sport     String
  active    Boolean @default(true)
  isCustom  Boolean @default(false)
  addedBy   String?
}
```
- Parents/admins can add video sources (YouTube channels, search queries)
- Aggregator fetches new videos from configured sources periodically
- Content moderation applies to video titles/descriptions

### 5. Multi-platform ReelCard
Update `ReelCard.tsx` to detect platform from `videoType`:
- `youtube_embed` → YouTube iframe
- `instagram_embed` → Instagram oEmbed
- `tiktok_embed` → TikTok oEmbed
- `mp4` → native `<video>` tag

## Recommendation

Start with **YouTube Data API** (option 1) — free, searchable, filter-friendly, works with existing iframe infrastructure. Then add configurable sources (option 4) for user customization. Instagram/TikTok as manual curation only (options 2-3).

## Priority

High — directly impacts the most engaging feature for kids (short videos).
