# PRD: SportyKids Video Aggregator

**Feature**: Dynamic Reels via YouTube RSS + Manual Curation (Instagram/TikTok)
**Priority**: HIGH
**Estimated effort**: 2-3 days
**Date**: 2026-03-27

---

## 1. Overview

Replace the static 10-reel seed data with a dynamic video aggregation system. YouTube channels and playlists are discovered automatically via YouTube RSS feeds (free, no API key). Instagram and TikTok content is added manually by parents or admins. All videos pass through the existing content moderation pipeline before being shown to children.

This feature mirrors the existing news RSS aggregator (`apps/api/src/services/aggregator.ts`) for architecture, patterns, and code conventions.

---

## 2. Problem Statement

- Reels are 10 hardcoded YouTube embeds from `prisma/seed.ts`.
- Children see the same videos every time they open the Reels tab.
- For the beta test with 5-10 families, the app needs fresh video content daily across all 8 sports.
- There is no way for parents to add or manage video sources.

---

## 3. Goals

1. **Fresh content**: Automatically aggregate 50-100+ videos from 20+ YouTube channels covering all 8 sports.
2. **Child safety**: All aggregated videos pass through the existing AI content moderator before appearing in feeds.
3. **Source management**: Parents can add custom YouTube channels/playlists and manually curate Instagram/TikTok URLs.
4. **Zero API keys**: YouTube discovery uses free RSS feeds (Atom format). Instagram/TikTok use oEmbed for rendering.
5. **Backward compatibility**: Existing 10 seed reels continue to work unchanged (new fields are nullable or have safe defaults).
6. **Test coverage**: Unit and route tests for new services and endpoints.

---

## 4. Target Users

| User | Need |
|------|------|
| **Child (6-14)** | Fresh, age-appropriate sports videos daily |
| **Parent** | Add trusted video sources, review moderation status |
| **System** | Automated video ingestion with dedup and moderation |

---

## 5. Core Features

### 5.1 VideoSource Model (Prisma)

New model in `apps/api/prisma/schema.prisma`:

```prisma
model VideoSource {
  id           String    @id @default(cuid())
  name         String
  platform     String    // youtube_channel | youtube_playlist | instagram_account | tiktok_account | manual
  feedUrl      String    @unique
  channelId    String?
  playlistId   String?
  sport        String
  active       Boolean   @default(true)
  isCustom     Boolean   @default(false)
  addedBy      String?
  lastSyncedAt DateTime?
  createdAt    DateTime  @default(now())
}
```

**Field details**:
- `platform`: Enum-like string. YouTube sources have automatic RSS sync. Instagram/TikTok/manual sources are curated-only (no automatic feed parsing).
- `feedUrl`: For YouTube channels: `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID`. For YouTube playlists: `https://www.youtube.com/feeds/videos.xml?playlist_id=PLAYLIST_ID`. For Instagram/TikTok/manual: the account URL (used as unique key, not parsed).
- `channelId` / `playlistId`: Stored separately for convenience (building embed URLs, thumbnails).
- `sport`: One of `football`, `basketball`, `tennis`, `swimming`, `athletics`, `cycling`, `formula1`, `padel`.

### 5.2 Reel Model Extensions

Add fields to the existing `Reel` model in `apps/api/prisma/schema.prisma`:

```prisma
model Reel {
  id              String    @id @default(cuid())
  title           String
  videoUrl        String
  thumbnailUrl    String    @default("")
  source          String
  sport           String
  team            String?
  minAge          Int       @default(6)
  maxAge          Int       @default(14)
  durationSeconds Int       @default(60)
  videoType       String?
  aspectRatio     String?
  previewGifUrl   String?
  createdAt       DateTime  @default(now())
  // --- New fields ---
  rssGuid         String?   @unique    // YouTube video ID for dedup (yt:video:XXX)
  videoSourceId   String?              // Logical FK to VideoSource (not enforced — SQLite limitation)
  safetyStatus    String    @default("approved")  // pending | approved | rejected
  safetyReason    String?
  moderatedAt     DateTime?
  publishedAt     DateTime?
}
```

**Migration safety**: All new fields are either nullable or have defaults that preserve existing seed reels:
- `rssGuid`: nullable (seed reels have no RSS guid)
- `videoSourceId`: nullable (seed reels have no source)
- `safetyStatus`: defaults to `"approved"` (seed reels are pre-approved)
- `safetyReason`: nullable
- `moderatedAt`: nullable
- `publishedAt`: nullable (falls back to `createdAt` in queries)

### 5.3 VideoAggregator Service

New file: `apps/api/src/services/video-aggregator.ts`

Mirrors the pattern of `apps/api/src/services/aggregator.ts` (296 lines).

**Types**:

```typescript
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
```

**Helpers**:

```typescript
// Build YouTube RSS feed URL from channel or playlist ID
function buildFeedUrl(platform: string, channelId?: string, playlistId?: string): string;

// Extract YouTube video ID from Atom entry ID (e.g., "yt:video:dQw4w9WgXcQ" -> "dQw4w9WgXcQ")
function extractYouTubeVideoId(atomId: string): string | null;

// Build YouTube embed URL from video ID
function buildEmbedUrl(videoId: string): string;
// Returns: https://www.youtube.com/embed/{videoId}

// Build YouTube thumbnail URL from video ID
function buildThumbnailUrl(videoId: string): string;
// Returns: https://img.youtube.com/vi/{videoId}/mqdefault.jpg
```

**Core functions**:

```typescript
// Sync a single video source (YouTube RSS only)
export async function syncVideoSource(
  sourceId: string,
  sourceName: string,
  feedUrl: string,
  sport: string,
): Promise<VideoSyncResult>;

// Sync all active YouTube video sources
export async function syncAllVideoSources(): Promise<VideoSyncAllResult>;
```

**Sync behavior** (per source):

1. Parse feed URL with `rss-parser` (10s timeout, same `User-Agent` as news aggregator).
2. For each feed item:
   a. Extract `rssGuid` from the Atom entry ID (`yt:video:VIDEO_ID`).
   b. Check if a Reel with this `rssGuid` already exists. If it exists and `safetyStatus !== 'pending'`, skip.
   c. Extract video ID, build embed URL (`https://www.youtube.com/embed/{VIDEO_ID}`), build thumbnail URL.
   d. Clean title (strip HTML tags). Use Atom `published` date for `publishedAt`.
   e. Run `moderateContent(title, description)` from `apps/api/src/services/content-moderator.ts`. Fail-open: auto-approve if AI unavailable.
   f. Run `classifyNews(title, description)` from `apps/api/src/services/classifier.ts` for team detection.
   g. Upsert to `Reel` table:
      - `videoUrl`: embed URL
      - `thumbnailUrl`: YouTube thumbnail
      - `source`: source name
      - `sport`: from VideoSource
      - `team`: from classifier
      - `videoType`: `'youtube_embed'`
      - `aspectRatio`: `'16:9'`
      - `rssGuid`: Atom entry ID
      - `videoSourceId`: source ID
      - `safetyStatus`: from moderator
      - `publishedAt`: from feed
3. Update `VideoSource.lastSyncedAt`.
4. **1-second delay** between sources to avoid YouTube throttling (`await new Promise(r => setTimeout(r, 1000))`).
5. Return sync metrics.

**Important**: Only sources with `platform` starting with `youtube_` are synced automatically. Instagram/TikTok/manual sources are skipped by `syncAllVideoSources()`.

### 5.4 Cron Job: sync-videos.ts

New file: `apps/api/src/jobs/sync-videos.ts`

Mirrors `apps/api/src/jobs/sync-feeds.ts`:

```typescript
import cron from 'node-cron';
import { syncAllVideoSources, VideoSyncAllResult } from '../services/video-aggregator';

let activeJob: cron.ScheduledTask | null = null;

// Sync every 6 hours: 0 */6 * * *
export function startVideoSyncJob(): void;

// Manual sync (on startup or from admin route)
export async function runManualVideoSync(): Promise<VideoSyncAllResult>;
```

**Registration** in `apps/api/src/index.ts`:

```typescript
import { startVideoSyncJob, runManualVideoSync } from './jobs/sync-videos';

// In listen callback, after existing jobs:
runManualVideoSync().catch(console.error);
startVideoSyncJob();
```

### 5.5 Seed VideoSources

Add to `apps/api/prisma/seed.ts`, 20+ entries covering all 8 sports:

| Sport | Source Name | Platform | Channel ID |
|-------|-----------|----------|------------|
| football | La Liga | youtube_channel | `UCzuJ---hMjpJb7GP-AArJMQ` |
| football | FC Barcelona | youtube_channel | `UC14UlmYlSNiQCBe9Eookf_A` |
| football | Real Madrid | youtube_channel | `UCWV3obpZVGgJ3j9FVhEjhHw` |
| football | UEFA Champions League | youtube_channel | `UCLUYFUARAiMR3cSznOLkUbw` |
| football | Premier League | youtube_channel | `UCG5qGWdu8nIRZqJ_GgDwQ-w` |
| basketball | NBA | youtube_channel | `UCWJ2lWNubArHWmf3FIHbfcQ` |
| basketball | EuroLeague | youtube_channel | `UCGr1AxeDdMVBdRBGfOfgbqw` |
| tennis | ATP Tour | youtube_channel | `UCbcxFkd6B9xUU54InHv4Tig` |
| tennis | WTA | youtube_channel | `UC2rmGMM76R6MIrFpIl0AjkQ` |
| tennis | Roland Garros | youtube_channel | `UCnKJeK_r90jDdIuzHXC0Org` |
| formula1 | Formula 1 | youtube_channel | `UCB_qr75-ydFVKSz9nCqgGwQ` |
| formula1 | Autosport | youtube_channel | `UCMlVEBkrivFMfTy8ADzpKww` |
| swimming | World Aquatics | youtube_channel | `UCMiF1YaklNOEI1r0jFMnDsQ` |
| swimming | SwimSwam | youtube_channel | `UCBNe4e0GrMWIKP0IDml3WaQ` |
| cycling | GCN en Espanol | youtube_channel | `UCrgJJvMx3GM2gw3CyxJq-jQ` |
| cycling | Tour de France | youtube_channel | `UCkOGh1Hp40baclNM33VRmvQ` |
| padel | Premier Padel | youtube_channel | `UC_qJn26gU8ADgZFHHMb1U5Q` |
| padel | World Padel Tour | youtube_channel | `UCv8GgG5weBfVNJNrATR7Xsw` |
| athletics | World Athletics | youtube_channel | `UC8Cn6FcGVUQB6SmcDhD0B4Q` |
| athletics | Olympics | youtube_channel | `UCTl3QQTvqHFjurroKxexy2Q` |

**Seed dedup**: Use `findFirst({ where: { feedUrl } })` before creating, same pattern as existing reel seed.

### 5.6 API Endpoints

All new endpoints are added to `apps/api/src/routes/reels.ts`.

#### GET /api/reels/fuentes/listado

List active video sources.

**Response**: `VideoSource[]` ordered by `name` ascending.

```typescript
router.get('/fuentes/listado', withCache('video-sources:', CACHE_TTL.SOURCES), async (_req, res) => {
  const sources = await prisma.videoSource.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  res.json(sources);
});
```

#### GET /api/reels/fuentes/catalogo

Full catalog with metadata and counts by sport.

**Response**:
```json
{
  "sources": [...],
  "total": 20,
  "bySport": { "football": 5, "basketball": 2, ... }
}
```

```typescript
router.get('/fuentes/catalogo', async (_req, res) => {
  const sources = await prisma.videoSource.findMany({ orderBy: { name: 'asc' } });
  const bySport: Record<string, number> = {};
  for (const source of sources) {
    bySport[source.sport] = (bySport[source.sport] || 0) + 1;
  }
  res.json({ sources, total: sources.length, bySport });
});
```

#### POST /api/reels/fuentes/custom

Add a custom video source. Supports YouTube channels/playlists (auto-synced) and Instagram/TikTok URLs (manual curation).

**Request body**:
```json
{
  "name": "My Favorite Channel",
  "url": "https://www.youtube.com/@ChannelName",
  "platform": "youtube_channel",
  "sport": "football",
  "userId": "user_abc123",
  "channelId": "UCxxxxxx"
}
```

**Validation schema**:
```typescript
const bodySchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  platform: z.enum(['youtube_channel', 'youtube_playlist', 'instagram_account', 'tiktok_account', 'manual']),
  sport: z.string().min(1),
  userId: z.string().min(1),
  channelId: z.string().optional(),
  playlistId: z.string().optional(),
});
```

**Behavior**:
1. Validate body with Zod.
2. Verify user exists.
3. SSRF prevention: call `isPublicUrl(url)` from `apps/api/src/utils/url-validator.ts`.
4. Check for duplicate `feedUrl` in `VideoSource` table.
5. For YouTube sources: build the RSS feed URL from `channelId` or `playlistId`. Validate the feed URL is parseable with `rss-parser`.
6. For Instagram/TikTok/manual: store the URL as `feedUrl` (no feed validation).
7. Create `VideoSource` with `isCustom: true`.
8. For YouTube sources: trigger immediate sync via `syncVideoSource()`.
9. Return the created source and sync result.

**Response** (201):
```json
{
  "source": { ... },
  "syncResult": { "sourceName": "...", "itemsCreated": 12, ... }
}
```

#### DELETE /api/reels/fuentes/custom/:id

Delete a custom video source (requires auth, only custom sources).

**Behavior**: Same pattern as `DELETE /api/news/fuentes/custom/:id`:
1. Require `userId` from JWT auth (fallback to query/body).
2. Verify user exists.
3. Find source by ID; 404 if not found.
4. Reject if `isCustom !== true` (403).
5. Reject if `addedBy !== userId` and user is not a parent (403).
6. Delete the source. (Associated reels remain in the database.)

**Response** (200):
```json
{ "message": "Video source deleted", "id": "..." }
```

#### POST /api/reels/sincronizar

Manual video sync trigger.

**Response**:
```json
{
  "message": "Video sync complete",
  "totalCreated": 47,
  "totalApproved": 45,
  "totalRejected": 2,
  "totalErrors": 0,
  "sources": [...]
}
```

### 5.7 Update GET /api/reels

Modify the existing endpoint in `apps/api/src/routes/reels.ts`:

**Changes**:
1. Add `safetyStatus: 'approved'` to the `where` clause (only show approved reels).
2. Change `orderBy` from `{ createdAt: 'desc' }` to `{ publishedAt: 'desc' }` with fallback.
3. Since `publishedAt` is nullable (seed reels), use a raw ordering or coalesce logic. Simplest approach: order by `publishedAt` desc nulls last, then `createdAt` desc.

**Updated query**:
```typescript
const where: Record<string, unknown> = {
  safetyStatus: 'approved',
};
if (sport) where.sport = sport;
if (age) {
  where.minAge = { lte: age };
  where.maxAge = { gte: age };
}

const [reels, total] = await Promise.all([
  prisma.reel.findMany({
    where,
    orderBy: [
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    skip: (page - 1) * limit,
    take: limit,
  }),
  prisma.reel.count({ where }),
]);
```

### 5.8 ReelCard Multi-Platform Rendering

#### Web: `apps/web/src/components/ReelCard.tsx`

The existing ReelCard assumes all reels are YouTube embeds. Add support for `videoType` variants:

```
videoType === 'youtube_embed'    -> YouTube iframe (existing behavior, no change)
videoType === 'instagram_embed'  -> Instagram oEmbed iframe
videoType === 'tiktok_embed'     -> TikTok oEmbed iframe
videoType === 'mp4'              -> Native <video> tag (existing in VideoPlayer.tsx)
videoType === null/undefined     -> Default to YouTube iframe (backward compat for seed reels)
```

**Instagram embed**: Use the Instagram oEmbed endpoint to get an embed HTML snippet, then render in an iframe with `srcdoc`.

```
GET https://api.instagram.com/oembed?url={REEL_URL}&maxwidth=400
```

**TikTok embed**: Use the TikTok oEmbed endpoint:

```
GET https://www.tiktok.com/oembed?url={VIDEO_URL}
```

**Implementation approach**: Add a helper function `getEmbedRenderer(videoType, videoUrl)` that returns the appropriate JSX element. This keeps the ReelCard clean and each renderer isolated.

#### Mobile: `apps/mobile/src/components/VideoPlayer.tsx`

The existing mobile VideoPlayer uses WebView for YouTube and `expo-video` for MP4. Add:
- Instagram/TikTok embeds: Render via WebView with the oEmbed HTML.

### 5.9 i18n Keys

Add to `packages/shared/src/i18n/es.json` and `packages/shared/src/i18n/en.json`:

```json
{
  "reels.sources_title": "Video Sources" / "Fuentes de video",
  "reels.sources_subtitle": "Manage where videos come from" / "Gestiona de donde vienen los videos",
  "reels.add_source": "Add source" / "Anadir fuente",
  "reels.sync_videos": "Sync videos" / "Sincronizar videos",
  "reels.syncing": "Syncing..." / "Sincronizando...",
  "reels.sync_complete": "Sync complete: {created} new videos" / "Sincronizacion completa: {created} videos nuevos",
  "reels.source_added": "Source added successfully" / "Fuente anadida correctamente",
  "reels.source_deleted": "Source deleted" / "Fuente eliminada",
  "reels.confirm_delete_source": "Delete this video source?" / "Eliminar esta fuente de video?",
  "reels.no_sources": "No video sources configured" / "No hay fuentes de video configuradas",
  "reels.platform_youtube_channel": "YouTube Channel" / "Canal de YouTube",
  "reels.platform_youtube_playlist": "YouTube Playlist" / "Playlist de YouTube",
  "reels.platform_instagram": "Instagram" / "Instagram",
  "reels.platform_tiktok": "TikTok" / "TikTok",
  "reels.platform_manual": "Manual" / "Manual",
  "reels.custom_source": "Custom" / "Personalizada",
  "reels.last_synced": "Last synced: {date}" / "Ultima sincronizacion: {date}",
  "reels.videos_count": "{count} videos" / "{count} videos"
}
```

---

## 6. UI Mockups (ASCII Art)

### 6.1 Video Source Catalog (Web — Parents Panel or dedicated page)

```
+------------------------------------------------------------------+
|  Video Sources                                    [+ Add Source]  |
|  Manage where videos come from                    [Sync Videos]   |
+------------------------------------------------------------------+
|                                                                   |
|  By sport:  Football (5)  Basketball (2)  Tennis (3)  F1 (2) ...  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  | [YT]  La Liga                              football         |  |
|  |       youtube_channel  |  15 videos  |  Synced 2h ago       |  |
|  +------------------------------------------------------------+  |
|  | [YT]  FC Barcelona                         football         |  |
|  |       youtube_channel  |  12 videos  |  Synced 2h ago       |  |
|  +------------------------------------------------------------+  |
|  | [YT]  NBA                                  basketball       |  |
|  |       youtube_channel  |  15 videos  |  Synced 2h ago       |  |
|  +------------------------------------------------------------+  |
|  | [IG]  @padel_highlights        CUSTOM      padel            |  |
|  |       instagram_account  |  3 videos  |  Manual       [X]  |  |
|  +------------------------------------------------------------+  |
|  | [TT]  @f1clips                 CUSTOM      formula1         |  |
|  |       tiktok_account  |  1 video  |  Manual           [X]  |  |
|  +------------------------------------------------------------+  |
|                                                                   |
+------------------------------------------------------------------+
```

### 6.2 Add Source Modal

```
+----------------------------------------------+
|  Add Video Source                        [X]  |
+----------------------------------------------+
|                                               |
|  Platform:                                    |
|  ( ) YouTube Channel                          |
|  ( ) YouTube Playlist                         |
|  ( ) Instagram (manual)                       |
|  ( ) TikTok (manual)                          |
|                                               |
|  Name:     [________________________]         |
|  URL:      [________________________]         |
|  Sport:    [Football          v    ]          |
|                                               |
|  Channel ID (YouTube only):                   |
|            [________________________]         |
|                                               |
|            [Cancel]      [Add Source]          |
+----------------------------------------------+
```

### 6.3 Reels Grid (updated — no visual change, but content is dynamic)

```
+------------------------------------------------------------------+
|  Reels                                                            |
|  Short sports videos for you                                      |
|                                                                   |
|  [All] [Football] [Basketball] [Tennis] [F1] [Swimming] ...      |
|                                                                   |
|  +------------------+  +------------------+  +------------------+ |
|  | [thumbnail]      |  | [thumbnail]      |  | [thumbnail]      | |
|  |     [>]          |  |     [>]          |  |     [>]          | |
|  | 2:34     Football|  | 1:45  Basketball |  | 3:12     Tennis  | |
|  |------------------|  |------------------|  |------------------| |
|  | Messi incredible |  | NBA Top 10 Plays |  | Nadal vs Alcaraz| |
|  | goal vs ...      |  | of the Week      |  | highlights       | |
|  | La Liga  R.Madrid|  | NBA              |  | ATP Tour         | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                   |
|                    [Load more]                                    |
+------------------------------------------------------------------+
```

### 6.4 Multi-Platform ReelCard Rendering

```
YouTube embed:                    Instagram embed:
+------------------+              +------------------+
| [YT iframe]      |              | [IG oEmbed]      |
|                   |              |                   |
|  ▶ Play           |              |  [Instagram post] |
|                   |              |                   |
|  2:34    Football |              |  0:30    Padel   |
|------------------|              |------------------|
| Title...         |              | Title...         |
| Source   Team    |              | @account         |
+------------------+              +------------------+

TikTok embed:                     MP4 native:
+------------------+              +------------------+
| [TT oEmbed]      |              | [<video> tag]    |
|                   |              |                   |
|  [TikTok video]  |              |  ▶ Play          |
|                   |              |                   |
|  0:15    F1      |              |  1:20    Cycling  |
|------------------|              |------------------|
| Title...         |              | Title...         |
| @account         |              | Source   Team    |
+------------------+              +------------------+
```

---

## 7. Acceptance Criteria

### Functional

- [ ] `VideoSource` model created with Prisma migration.
- [ ] `Reel` model extended with `rssGuid`, `videoSourceId`, `safetyStatus`, `safetyReason`, `moderatedAt`, `publishedAt` fields.
- [ ] Existing 10 seed reels unaffected by migration (all new fields nullable or with safe defaults).
- [ ] 20+ VideoSources seeded covering all 8 sports.
- [ ] `video-aggregator.ts` syncs YouTube RSS feeds, deduplicates by `rssGuid`, moderates content, classifies teams.
- [ ] `sync-videos.ts` cron runs every 6 hours and on API startup.
- [ ] `GET /api/reels` only returns reels with `safetyStatus: 'approved'`.
- [ ] `GET /api/reels` orders by `publishedAt` desc (then `createdAt` desc).
- [ ] `GET /api/reels/fuentes/listado` returns active video sources.
- [ ] `GET /api/reels/fuentes/catalogo` returns all sources with `bySport` counts.
- [ ] `POST /api/reels/fuentes/custom` creates a custom video source and triggers immediate sync for YouTube sources.
- [ ] `DELETE /api/reels/fuentes/custom/:id` deletes only custom sources owned by the user.
- [ ] `POST /api/reels/sincronizar` triggers manual sync and returns metrics.
- [ ] ReelCard (web) renders `youtube_embed`, `instagram_embed`, `tiktok_embed`, and `mp4` video types.
- [ ] VideoPlayer (mobile) renders `instagram_embed` and `tiktok_embed` via WebView.
- [ ] i18n keys added for both `es.json` and `en.json`.

### Non-Functional

- [ ] Video sync does not block API startup (fire-and-forget with `.catch(console.error)`).
- [ ] 1-second delay between sources during sync to avoid YouTube throttling.
- [ ] SSRF prevention on custom source URLs via `isPublicUrl()`.
- [ ] Content moderation fails open (auto-approves if AI is unavailable).

### Tests

- [ ] Unit tests for `video-aggregator.ts`: `buildFeedUrl`, `extractYouTubeVideoId`, `buildEmbedUrl`, `buildThumbnailUrl`.
- [ ] Unit tests for `video-aggregator.ts`: `syncVideoSource` with mocked `rss-parser` and `prisma`.
- [ ] Unit tests for `video-aggregator.ts`: `syncAllVideoSources` skips non-YouTube sources.
- [ ] Route tests for `GET /api/reels/fuentes/listado`.
- [ ] Route tests for `GET /api/reels/fuentes/catalogo`.
- [ ] Route tests for `POST /api/reels/fuentes/custom` (valid YouTube, invalid URL, duplicate, Instagram/TikTok).
- [ ] Route tests for `DELETE /api/reels/fuentes/custom/:id` (own source, not custom, not found).
- [ ] Route tests for `POST /api/reels/sincronizar`.
- [ ] Route tests for `GET /api/reels` confirming `safetyStatus` filter.
- [ ] Manual testing notes for ReelCard multi-platform rendering (web + mobile).

---

## 8. Technical Requirements

### Files to Create

| File | Description |
|------|-------------|
| `apps/api/src/services/video-aggregator.ts` | Video aggregation service (mirror of `aggregator.ts`) |
| `apps/api/src/jobs/sync-videos.ts` | Cron job for periodic video sync |
| `apps/api/src/services/video-aggregator.test.ts` | Unit tests for video aggregator |
| `apps/api/src/routes/reels.test.ts` | Route tests for new reels endpoints |
| `apps/api/prisma/migrations/YYYYMMDD_add_video_sources/migration.sql` | Prisma migration (auto-generated) |

### Files to Modify

| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Add `VideoSource` model, extend `Reel` model |
| `apps/api/prisma/seed.ts` | Add 20+ VideoSource seed entries |
| `apps/api/src/routes/reels.ts` | Add source management endpoints, update GET /api/reels query |
| `apps/api/src/index.ts` | Import and start `sync-videos` job |
| `apps/web/src/components/ReelCard.tsx` | Multi-platform rendering (Instagram/TikTok oEmbed) |
| `apps/mobile/src/components/VideoPlayer.tsx` | Instagram/TikTok WebView rendering |
| `packages/shared/src/i18n/es.json` | New translation keys |
| `packages/shared/src/i18n/en.json` | New translation keys |
| `packages/shared/src/types/index.ts` | Add `VideoSource` type, extend `Reel` type |
| `docs/es/*.md` | Update documentation (API reference, architecture) |
| `docs/en/*.md` | Update documentation (API reference, architecture) |

### Dependencies

No new npm packages required. Existing packages used:
- `rss-parser` (already in `apps/api`) — parses YouTube Atom feeds
- `node-cron` (already in `apps/api`) — schedules sync job
- `zod` (already in `apps/api`) — validates request bodies
- `prisma` (already in `apps/api`) — database operations

### Environment Variables

No new environment variables required. YouTube RSS feeds are free and require no API key.

---

## 9. Implementation Decisions

| Decision | Rationale |
|----------|-----------|
| **YouTube RSS (not Data API v3)** | Free, no API key, no quota limits. RSS returns ~15 most recent videos per channel, which is sufficient for a kids app. |
| **Instagram/TikTok manual only** | No free RSS feeds available. Official APIs require app review and tokens. oEmbed for rendering is free and requires no auth. |
| **Logical FK (not enforced)** | `videoSourceId` on Reel is a string, not a Prisma relation. This avoids cascade delete complexity (deleting a source should NOT delete its reels) and keeps the migration simple for SQLite. |
| **`safetyStatus` default `"approved"`** | Preserves existing seed reels. New aggregated reels will explicitly set the status from the moderator. |
| **1s delay between sources** | YouTube may throttle rapid sequential requests. A 1-second delay per source (20 sources = 20s total) is acceptable for a 6-hour sync cycle. |
| **6-hour sync interval** | YouTube channels typically upload 1-3 videos per day. Every 6 hours catches new content within a reasonable window without unnecessary load. |
| **Mirror aggregator.ts pattern** | Reduces cognitive load for developers. Same types, same function signatures, same error handling, same logging format. |
| **oEmbed for Instagram/TikTok** | The oEmbed standard provides embeddable HTML without API keys. Works in iframes on web and WebView on mobile. |
| **`publishedAt` ordering with `createdAt` fallback** | Seed reels have no `publishedAt`. Prisma's multi-field orderBy handles this: nulls sort last with `desc`, then `createdAt` provides secondary ordering. |

---

## 10. Testing Decisions

| Decision | Rationale |
|----------|-----------|
| **Unit tests for helpers** | `buildFeedUrl`, `extractYouTubeVideoId`, `buildEmbedUrl`, `buildThumbnailUrl` are pure functions — easy to test, high value. |
| **Mocked sync tests** | Mock `rss-parser` to return fixture data and mock `prisma` to avoid DB dependency. Test the logic flow: dedup, moderation, classification, upsert. |
| **Route tests with Vitest** | Follow existing test pattern in `apps/api/src/`. Test HTTP status codes, response shapes, validation errors. |
| **No component tests for oEmbed** | Instagram/TikTok oEmbed rendering depends on third-party scripts. Manual testing is more reliable. Document test steps. |
| **Test file colocation** | Place `video-aggregator.test.ts` next to `video-aggregator.ts` in `apps/api/src/services/`. Place `reels.test.ts` in `apps/api/src/routes/`. Follows existing convention. |

### Manual Testing Checklist (ReelCard Multi-Platform)

1. **YouTube embed**: Click play on a YouTube reel in the grid. Verify iframe loads, autoplay works, controls visible.
2. **Instagram embed**: Add an Instagram reel URL manually. Verify oEmbed renders the post within the card.
3. **TikTok embed**: Add a TikTok video URL manually. Verify oEmbed renders the video within the card.
4. **MP4 native**: If any MP4 reel exists, verify the `<video>` tag renders with controls.
5. **Mobile WebView**: Test Instagram/TikTok embeds on iOS and Android via Expo Go.
6. **Fallback**: Verify seed reels (no `videoType`) still render as YouTube embeds.

---

## 11. Out of Scope

- **YouTube Data API v3**: Not needed. RSS provides sufficient metadata (title, published date, video ID, thumbnail).
- **Automatic Instagram/TikTok discovery**: No free API for feed scraping. Manual curation only.
- **Video transcoding or hosting**: All videos are embedded from their original platforms.
- **View count tracking for reels**: Activity tracking already exists via `ActivityLog` with type `reels_viewed`. Per-reel view counts are a separate feature.
- **Reel comments or reactions**: Beyond likes (already implemented client-side).
- **Video duration extraction**: YouTube RSS does not include duration. The `durationSeconds` field keeps its default of 60. Accurate duration requires the YouTube Data API.
- **Admin panel for source management**: Source management is via API endpoints, consumed by the parents panel. A dedicated admin UI is a separate feature.
- **Push notifications for new reels**: The existing push system notifies for team news. Extending to reels is a separate feature.

---

## 12. Future Considerations

1. **YouTube Data API v3 upgrade**: If the app needs video duration, view counts, or channel metadata, upgrade to the Data API (requires API key, 10,000 quota units/day free).
2. **Playlist support**: YouTube playlists are already modeled (`youtube_playlist` platform). The aggregator can sync playlists using `playlist_id` in the RSS URL.
3. **Content freshness scoring**: Weight reels by recency in the feed ranker, similar to how news articles are ranked.
4. **Reel-specific moderation rules**: Sports video titles may trigger false positives (e.g., "knockout goal" flagged as violence). A sport-aware moderation prompt could reduce false rejections.
5. **Thumbnail prefetch**: Pre-download YouTube thumbnails to avoid external requests at render time. Store in local storage or CDN.
6. **Redis queue for sync**: Replace the sequential 1s-delay loop with a proper job queue (Bull/BullMQ) for parallel, rate-limited processing.
7. **Parental source approval**: Require parent PIN verification before custom sources become active.
8. **Source health monitoring**: Track consecutive sync failures per source. Auto-disable after N failures. Alert in parents panel.
