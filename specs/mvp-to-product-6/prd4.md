# Phase 6 — PRD 4: Native Video Pipeline (Eliminate YouTube Dependency)

| Field | Value |
|-------|-------|
| **Phase** | 6.2 — Native Video Pipeline |
| **Priority** | P1 (high — Google Play Families Policy compliance risk) |
| **Target** | Month 2-3 post-launch |
| **Dependencies** | Phase 5 complete (app published), Video Aggregator operational |
| **Estimated effort** | 2-3 weeks |
| **Author** | SportyKids team |
| **Date** | 2026-04-01 |

---

## 1. Overview / Problem Statement

SportyKids Reels currently depend entirely on YouTube embeds. The Video Aggregator (`video-aggregator.ts`) fetches YouTube Atom RSS feeds, extracts video IDs, and stores embed URLs (`https://www.youtube.com/embed/{videoId}`). The mobile `VideoPlayer` renders these via WebView with the YouTube IFrame Player API; the web `VideoPlayer` renders them via `<iframe>`.

This architecture has four critical problems:

1. **Ads and suggested content**: YouTube embeds can display pre-roll ads and "related videos" overlays. Despite `rel=0` and `modestbranding` parameters, Google controls what appears. For a kids app, this is a compliance risk under Google Play Families Policy and Apple Kids Category guidelines.

2. **No editorial control**: If YouTube removes a video or restricts embedding (error 153), the Reel breaks silently. The mobile player already has error-detection fallback logic for this, proving it happens in practice.

3. **No offline support**: YouTube embeds require an internet connection. Native MP4 files can be pre-cached for offline viewing.

4. **No real view metrics**: YouTube iframe events are unreliable for tracking actual watch time. Native video playback gives precise control over analytics (seconds watched, completion rate, replays).

This PRD specifies a server-side pipeline that downloads videos from YouTube, transcodes them to a standard MP4 format, stores them on Cloudflare R2 (S3-compatible), and serves them via CDN URLs. The frontend players are updated to prefer native URLs when available, with YouTube embed as fallback for unprocessed Reels.

---

## 2. Goals and Non-Goals

### Goals

1. **Video processing pipeline**: Automated service that downloads YouTube videos via `yt-dlp`, transcodes to MP4 720p via `ffmpeg`, and uploads to Cloudflare R2.
2. **Cron job**: `process-videos.ts` runs on a schedule, picking up Reels that have `videoType = 'youtube_embed'` and no `nativeVideoUrl`, and processes them.
3. **CDN delivery**: Videos served from R2 public bucket URL (Cloudflare CDN) with proper cache headers.
4. **Native playback — mobile**: `VideoPlayer.tsx` uses `expo-video` (already partially integrated) with the R2 URL when `nativeVideoUrl` is set.
5. **Native playback — web**: `VideoPlayer.tsx` uses `<video>` element (already implemented for MP4) with the R2 URL when `nativeVideoUrl` is set.
6. **Graceful fallback**: Reels without `nativeVideoUrl` continue to render via YouTube embed exactly as today.
7. **Admin visibility**: Processing status exposed via existing admin/moderation endpoints.
8. **Storage cost control**: 720p cap, 5-minute max duration, configurable batch size.

### Non-Goals

- Live streaming or HLS adaptive bitrate (MP4 progressive download is sufficient for short-form content)
- Video editing, cropping, or watermarking
- Downloading from platforms other than YouTube (Instagram, TikTok)
- Client-side offline caching of native videos (future phase)
- Video upload by users or admins
- Replacing the Video Aggregator (it continues to discover and catalog Reels from YouTube RSS)
- DRM or encryption of stored videos
- Thumbnail generation from video frames (YouTube thumbnails are already stored)

---

## 3. Architecture

### 3.1 High-Level Pipeline

```
                            Existing (unchanged)
                    ┌──────────────────────────────┐
                    │                              │
  YouTube RSS ──►  Video Aggregator  ──►  Reel record (videoType: youtube_embed)
                    │                              │
                    └──────────────────────────────┘
                                                   │
                            New pipeline           ▼
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    │  process-videos.ts (cron every 2 hours)  │
                    │         │                                │
                    │         ▼                                │
                    │  video-processor.ts                      │
                    │    1. Query: Reels WHERE nativeVideoUrl  │
                    │       IS NULL AND processingStatus       │
                    │       != 'processing'                    │
                    │    2. yt-dlp: download best ≤720p        │
                    │    3. ffmpeg: transcode to MP4 H.264     │
                    │       AAC, 720p, ≤5min                   │
                    │    4. Upload to Cloudflare R2             │
                    │    5. Update Reel: nativeVideoUrl,       │
                    │       videoType='mp4',                   │
                    │       processingStatus='completed'       │
                    │                                          │
                    └──────────────────────────────────────────┘
                                                   │
                                                   ▼
                    ┌──────────────────────────────────────────┐
                    │  Cloudflare R2 Bucket                    │
                    │  (S3-compatible, public read via CDN)    │
                    │                                          │
                    │  /videos/{reelId}.mp4                    │
                    │  /videos/{reelId}_thumb.jpg (future)     │
                    └──────────────────────────────────────────┘
                                                   │
                              CDN URL              ▼
                    ┌──────────────────────────────────────────┐
                    │  Frontend Players                        │
                    │                                          │
                    │  Mobile: expo-video (native MP4 player)  │
                    │  Web: <video> HTML5 element              │
                    │  Fallback: YouTube embed (unchanged)     │
                    └──────────────────────────────────────────┘
```

### 3.2 Component Inventory

| Component | Location | Status |
|-----------|----------|--------|
| `video-processor.ts` | `apps/api/src/services/` | **New** |
| `r2-storage.ts` | `apps/api/src/services/` | **New** |
| `process-videos.ts` | `apps/api/src/jobs/` | **New** |
| `video-aggregator.ts` | `apps/api/src/services/` | Unchanged (discovery) |
| Reel model | `apps/api/prisma/schema.prisma` | Modified (3 new fields) |
| `VideoPlayer.tsx` (mobile) | `apps/mobile/src/components/` | Modified (native URL preference) |
| `VideoPlayer.tsx` (web) | `apps/web/src/components/` | Modified (native URL preference) |
| Reel API response | `apps/api/src/routes/reels.ts` | Modified (include new fields) |
| Admin endpoints | `apps/api/src/routes/admin.ts` | Modified (processing stats) |

---

## 4. Data Model Changes

### 4.1 Prisma Schema — Reel Model

Add three new fields to the existing `Reel` model:

```prisma
model Reel {
  // ... all existing fields unchanged ...

  // --- Native Video Pipeline (Phase 6.2) ---
  nativeVideoUrl    String?   // CDN URL for the transcoded MP4 (e.g., https://{bucket}.r2.dev/videos/{id}.mp4)
  processingStatus  String    @default("pending")  // pending | processing | completed | failed
  processingError   String?   // Error message if processing failed (for debugging)

  @@index([sport, safetyStatus, publishedAt])        // existing
  @@index([processingStatus, createdAt])              // new: for job queries
}
```

**Migration safety**: All new fields are nullable or have defaults:
- `nativeVideoUrl`: nullable (existing Reels have no native URL)
- `processingStatus`: defaults to `"pending"` (existing Reels will be queued for processing)
- `processingError`: nullable

**Processing status lifecycle**:
```
pending → processing → completed
                    → failed (retryable: reset to pending after cooldown)
```

### 4.2 Shared Types

Add to `packages/shared/src/types/`:

```typescript
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';
```

Extend the existing `Reel` type interface (if defined in shared) to include:

```typescript
interface Reel {
  // ... existing fields ...
  nativeVideoUrl?: string | null;
  processingStatus: ProcessingStatus;
  processingError?: string | null;
}
```

---

## 5. New Service: `video-processor.ts`

### 5.1 File Location

`apps/api/src/services/video-processor.ts`

### 5.2 Responsibilities

1. Select unprocessed Reels from the database
2. Download the video from YouTube using `yt-dlp`
3. Transcode to MP4 720p using `ffmpeg`
4. Upload to Cloudflare R2
5. Update the Reel record with the CDN URL

### 5.3 Interface

```typescript
export interface ProcessingResult {
  reelId: string;
  success: boolean;
  nativeVideoUrl?: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  error?: string;
}

export interface BatchProcessingResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: ProcessingResult[];
}

/**
 * Process a single Reel: download from YouTube, transcode, upload to R2.
 * Returns the CDN URL on success, or an error message on failure.
 */
export async function processReel(reelId: string): Promise<ProcessingResult>;

/**
 * Process a batch of unprocessed Reels.
 * @param batchSize - Max number of Reels to process in this run (default: 10)
 */
export async function processReelBatch(batchSize?: number): Promise<BatchProcessingResult>;
```

### 5.4 Processing Logic — `processReel()`

```
1. Fetch Reel from DB by ID
2. Validate: must have videoType='youtube_embed' and rssGuid starting with 'yt:video:'
3. Set processingStatus = 'processing'
4. Extract YouTube video ID from rssGuid (strip 'yt:video:' prefix)
5. Download:
   - Command: yt-dlp -f "bestvideo[height<=720]+bestaudio/best[height<=720]"
              --merge-output-format mp4
              --max-filesize 200M
              --socket-timeout 30
              -o "{tempDir}/{reelId}.%(ext)s"
              "https://www.youtube.com/watch?v={videoId}"
   - Timeout: 120 seconds
   - If download fails: set processingStatus='failed', processingError=stderr, return
6. Probe duration:
   - Command: ffprobe -v quiet -show_entries format=duration -of csv=p=0 "{file}"
   - If duration > 300 seconds (5 min): delete file, set failed, return "Video exceeds 5 minute limit"
7. Transcode:
   - Command: ffmpeg -i "{input}"
              -c:v libx264 -preset fast -crf 23
              -vf "scale=-2:720"
              -c:a aac -b:a 128k
              -movflags +faststart
              -y "{tempDir}/{reelId}_720p.mp4"
   - Timeout: 300 seconds
   - The `-movflags +faststart` flag moves the moov atom to the beginning of the file
     for progressive download (instant playback start)
   - If transcode fails: set processingStatus='failed', processingError=stderr, return
8. Upload:
   - Call r2Storage.upload(key="videos/{reelId}.mp4", filePath="{tempDir}/{reelId}_720p.mp4")
   - If upload fails: set processingStatus='failed', processingError=message, return
9. Update Reel:
   - nativeVideoUrl = "https://{R2_PUBLIC_URL}/videos/{reelId}.mp4"
   - videoType = 'mp4'
   - processingStatus = 'completed'
   - processingError = null
   - durationSeconds = actual duration from ffprobe (overrides the default 60)
10. Cleanup: delete temp files
11. Return success result
```

### 5.5 Error Handling

| Error Type | Behavior |
|------------|----------|
| `yt-dlp` download failure (404, geo-restricted, private) | Set `processingStatus='failed'`, `processingError` with reason. Do NOT retry automatically (likely permanent). |
| `yt-dlp` download failure (timeout, network) | Set `processingStatus='failed'`. Job will retry on next run (resets to pending after 1 hour cooldown). |
| `ffmpeg` transcode failure | Set `processingStatus='failed'`, log full stderr. Likely a codec issue — manual review needed. |
| R2 upload failure | Set `processingStatus='failed'`. Transient — job will retry on next run. |
| Duration exceeds 5 minutes | Set `processingStatus='failed'`, `processingError='duration_exceeded'`. Permanent — do not retry. |
| File size exceeds 200MB after transcode | Set `processingStatus='failed'`, `processingError='size_exceeded'`. Permanent. |

**Retry logic**: The job query selects Reels where `processingStatus = 'pending'` OR (`processingStatus = 'failed'` AND `processingError` NOT IN permanent error list AND last attempt was > 1 hour ago). Permanent errors: `duration_exceeded`, `size_exceeded`, `video_unavailable`, `private_video`, `geo_restricted`.

### 5.6 Binary Dependencies

The processing service requires two external binaries on the server:

| Binary | Purpose | Installation |
|--------|---------|-------------|
| `yt-dlp` | YouTube video download | `pip install yt-dlp` or standalone binary |
| `ffmpeg` | Video transcoding | `apt-get install ffmpeg` (Dockerfile) |
| `ffprobe` | Duration/metadata extraction | Included with ffmpeg |

**Dockerfile additions** (to `apps/api/Dockerfile`):

```dockerfile
# In the base/build stage:
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3-minimal \
    && pip3 install --break-system-packages yt-dlp \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
```

**Local development**: Developers must have `yt-dlp` and `ffmpeg` installed locally. The service checks for their presence at startup and logs a warning if missing (processing will be skipped, not crash the server).

---

## 6. New Service: `r2-storage.ts`

### 6.1 File Location

`apps/api/src/services/r2-storage.ts`

### 6.2 Responsibilities

Abstraction over Cloudflare R2 (S3-compatible API) for uploading and managing video files.

### 6.3 Interface

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;   // e.g., "https://{bucket}.{accountId}.r2.dev" or custom domain
}

export interface UploadResult {
  key: string;
  url: string;
  sizeBytes: number;
}

export class R2Storage {
  private client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(config: R2Config);

  /** Upload a file to R2. Returns the public CDN URL. */
  async upload(key: string, filePath: string, contentType?: string): Promise<UploadResult>;

  /** Delete a file from R2. */
  async delete(key: string): Promise<void>;

  /** Check if a file exists in R2. */
  async exists(key: string): Promise<boolean>;

  /** Get the public URL for a key. */
  getPublicUrl(key: string): string;
}

/** Singleton factory — returns null if R2 env vars are not configured. */
export function createR2Storage(): R2Storage | null;
```

### 6.4 Configuration

The R2 client uses the standard AWS SDK v3 (`@aws-sdk/client-s3`), configured to point at the Cloudflare R2 endpoint:

```typescript
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
});
```

### 6.5 R2 Bucket Setup (Manual, One-Time)

1. Create bucket `sportykids-videos` in Cloudflare dashboard
2. Enable public access (R2 Settings > Public Access > Allow Access)
3. Note the public URL: `https://sportykids-videos.{account-id}.r2.dev`
4. Create API token with `Object Read & Write` permission for the bucket
5. Store credentials in environment variables

---

## 7. New Job: `process-videos.ts`

### 7.1 File Location

`apps/api/src/jobs/process-videos.ts`

### 7.2 Schedule

Runs every 2 hours via `node-cron`: `0 */2 * * *`

Also runs once at server startup (delayed by 60 seconds to let other startup tasks complete).

### 7.3 Logic

```typescript
import cron from 'node-cron';
import { processReelBatch } from '../services/video-processor';
import { logger } from '../services/logger';

const BATCH_SIZE = parseInt(process.env.VIDEO_PROCESSING_BATCH_SIZE || '10', 10);
const ENABLED = process.env.VIDEO_PROCESSING_ENABLED !== 'false';

export function scheduleVideoProcessing(): void {
  if (!ENABLED) {
    logger.info('Video processing is disabled (VIDEO_PROCESSING_ENABLED=false)');
    return;
  }

  // Check binary dependencies
  // (yt-dlp and ffmpeg must be in PATH)

  // Run on schedule
  cron.schedule('0 */2 * * *', async () => {
    logger.info('Starting scheduled video processing batch...');
    try {
      const result = await processReelBatch(BATCH_SIZE);
      logger.info({
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        skipped: result.skipped,
      }, 'Video processing batch complete');
    } catch (err) {
      logger.error({ err }, 'Video processing batch failed');
    }
  });

  // Initial run (delayed 60s)
  setTimeout(async () => {
    logger.info('Running initial video processing batch...');
    try {
      const result = await processReelBatch(BATCH_SIZE);
      logger.info({
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
      }, 'Initial video processing batch complete');
    } catch (err) {
      logger.error({ err }, 'Initial video processing batch failed');
    }
  }, 60_000);
}
```

### 7.4 Batch Query

```sql
SELECT id FROM "Reel"
WHERE "nativeVideoUrl" IS NULL
  AND "safetyStatus" = 'approved'
  AND (
    "processingStatus" = 'pending'
    OR (
      "processingStatus" = 'failed'
      AND "processingError" NOT IN ('duration_exceeded', 'size_exceeded', 'video_unavailable', 'private_video', 'geo_restricted')
      AND "updatedAt" < NOW() - INTERVAL '1 hour'
    )
  )
ORDER BY "publishedAt" DESC
LIMIT :batchSize
```

Newest Reels are processed first so that the most recent content gets native playback soonest.

### 7.5 Concurrency

Videos are processed **sequentially** within a batch (not in parallel) to avoid overwhelming the server with multiple `yt-dlp` + `ffmpeg` processes. A single transcode can use significant CPU and memory.

If parallel processing is needed later, a queue system (BullMQ + Redis) can be introduced, but sequential processing is sufficient for the expected volume (~20-50 new Reels per day).

---

## 8. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `R2_ACCOUNT_ID` | Yes (if pipeline enabled) | — | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes (if pipeline enabled) | — | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | Yes (if pipeline enabled) | — | R2 API token secret key |
| `R2_BUCKET_NAME` | No | `sportykids-videos` | R2 bucket name |
| `R2_PUBLIC_URL` | Yes (if pipeline enabled) | — | Public CDN URL for the bucket |
| `VIDEO_PROCESSING_ENABLED` | No | `true` | Set to `false` to disable the pipeline |
| `VIDEO_PROCESSING_BATCH_SIZE` | No | `10` | Max Reels to process per batch |
| `VIDEO_PROCESSING_TEMP_DIR` | No | `os.tmpdir()` | Temporary directory for downloads/transcodes |
| `VIDEO_MAX_DURATION_SECONDS` | No | `300` | Max video duration (reject longer videos) |
| `VIDEO_MAX_FILE_SIZE_MB` | No | `200` | Max download file size |

When `R2_ACCOUNT_ID` is not set, `createR2Storage()` returns `null` and the processing job skips uploads. This means the pipeline is opt-in: existing deployments without R2 credentials continue to work exactly as before.

---

## 9. Frontend Changes

### 9.1 Mobile — `VideoPlayer.tsx`

**File**: `apps/mobile/src/components/VideoPlayer.tsx`

**Change**: Add `nativeVideoUrl` prop. When present and non-null, use it as the video source instead of the YouTube embed.

```typescript
interface VideoPlayerProps {
  videoUrl: string;
  videoType?: string;
  thumbnailUrl?: string;
  aspectRatio?: string;
  locale?: Locale;
  nativeVideoUrl?: string | null;  // NEW: CDN URL for native MP4
}
```

**Updated logic** (pseudocode):

```
// Priority order for video source:
// 1. nativeVideoUrl (R2 CDN MP4) → expo-video native player
// 2. MP4 videoUrl → expo-video native player (existing)
// 3. YouTube embed → WebView with IFrame API (existing)
// 4. Other embeds → WebView iframe (existing)

if (nativeVideoUrl) {
  // Use expo-video with native URL — same as existing ExpoVideoPlayer component
  return <ExpoVideoPlayer videoUrl={nativeVideoUrl} height={videoHeight} />;
}

// ... existing logic unchanged ...
```

The `ExpoVideoPlayer` component already exists in the file and handles `expo-video` rendering. No changes needed to that sub-component.

**Reel screen integration**: The `Reels.tsx` screen passes the `nativeVideoUrl` field from the API response to `VideoPlayer`:

```typescript
<VideoPlayer
  videoUrl={reel.videoUrl}
  videoType={reel.videoType}
  thumbnailUrl={reel.thumbnailUrl}
  aspectRatio={reel.aspectRatio}
  nativeVideoUrl={reel.nativeVideoUrl}   // NEW
  locale={locale}
/>
```

### 9.2 Web — `VideoPlayer.tsx`

**File**: `apps/web/src/components/VideoPlayer.tsx`

**Change**: Add `nativeVideoUrl` prop. When present, render a `<video>` element instead of the YouTube iframe.

```typescript
interface VideoPlayerProps {
  videoUrl: string;
  videoType?: string;
  thumbnailUrl?: string;
  aspectRatio?: string;
  nativeVideoUrl?: string | null;  // NEW: CDN URL for native MP4
}
```

**Updated logic** (pseudocode):

```
// If native video URL is available, always use <video> element
if (nativeVideoUrl) {
  return (
    <div className="relative w-full" style={{ paddingTop }}>
      <video
        src={nativeVideoUrl}
        poster={thumbnailUrl}
        controls
        playsInline
        preload="metadata"
        aria-label="Video player"
        className="absolute inset-0 w-full h-full object-cover rounded-xl"
      />
    </div>
  );
}

// ... existing YouTube/iframe logic unchanged ...
```

The web `VideoPlayer` already has an MP4 rendering path (the `isMP4` branch at line 73-90). The new native URL check is added before any existing checks, as a higher-priority path.

### 9.3 API Response — Reels Endpoint

**File**: `apps/api/src/routes/reels.ts`

The Reel model already returns all fields via Prisma `findMany`. The new fields (`nativeVideoUrl`, `processingStatus`, `processingError`) will be included automatically in the JSON response. No route changes needed.

The `processingStatus` and `processingError` fields are informational for admin/debug purposes. Frontends only need `nativeVideoUrl` to decide which player to use.

### 9.4 ReelCard Integration

Both `apps/web/src/components/ReelCard.tsx` and `apps/mobile/src/screens/Reels.tsx` pass Reel data to `VideoPlayer`. They need to forward the new `nativeVideoUrl` field:

```typescript
// ReelCard.tsx (web)
<VideoPlayer
  videoUrl={reel.videoUrl}
  videoType={reel.videoType}
  thumbnailUrl={reel.thumbnailUrl}
  aspectRatio={reel.aspectRatio}
  nativeVideoUrl={reel.nativeVideoUrl}
/>
```

---

## 10. Admin Visibility

### 10.1 Processing Stats Endpoint

Add to `apps/api/src/routes/admin.ts`:

```
GET /api/admin/video-processing/stats
```

Response:

```json
{
  "total": 245,
  "pending": 12,
  "processing": 1,
  "completed": 220,
  "failed": 12,
  "failedPermanent": 5,
  "failedRetryable": 7,
  "storageEstimateGB": 8.2,
  "oldestPending": "2026-04-01T10:00:00Z"
}
```

### 10.2 Manual Processing Trigger

```
POST /api/admin/video-processing/trigger
```

Body (optional):
```json
{
  "batchSize": 5,
  "reelIds": ["clxyz123"]   // Process specific Reels (optional)
}
```

Requires `requireAuth` + `requireRole('admin')`.

### 10.3 Retry Failed Reel

```
POST /api/admin/video-processing/retry/:reelId
```

Resets `processingStatus` to `pending` and clears `processingError`, allowing the job to re-attempt processing.

---

## 11. Storage Cost Estimation

| Metric | Estimate |
|--------|----------|
| Average video duration | 60-90 seconds |
| Average file size (720p MP4, CRF 23) | 15-30 MB |
| New Reels per day | 20-50 |
| Daily storage growth | 300 MB - 1.5 GB |
| Monthly storage growth | 9 - 45 GB |
| R2 storage cost (Class A) | $0.015/GB/month |
| Monthly storage cost (at 50 GB) | ~$0.75 |
| R2 egress cost | Free (via Cloudflare CDN) |

R2 is chosen specifically because **egress is free** through Cloudflare CDN, which is the dominant cost for video delivery on AWS S3 or similar services.

### 11.1 Storage Cleanup Policy

Videos for Reels that are:
- `safetyStatus = 'rejected'` (moderation rejected after processing)
- Older than 90 days with zero views

Can be cleaned up by a future maintenance job. Not in scope for this PRD but the R2 storage service supports `delete()` for this purpose.

---

## 12. Files to Create / Modify

### New Files

| File | Description |
|------|-------------|
| `apps/api/src/services/video-processor.ts` | Download + transcode + upload pipeline |
| `apps/api/src/services/r2-storage.ts` | Cloudflare R2 storage abstraction |
| `apps/api/src/jobs/process-videos.ts` | Cron job scheduling |
| `apps/api/prisma/migrations/XXXXXX_add_native_video_fields/migration.sql` | Prisma migration |
| `apps/api/src/services/__tests__/video-processor.test.ts` | Unit tests |
| `apps/api/src/services/__tests__/r2-storage.test.ts` | Unit tests |
| `apps/api/src/jobs/__tests__/process-videos.test.ts` | Unit tests |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add 3 fields to Reel model + new index |
| `apps/api/src/index.ts` | Import and call `scheduleVideoProcessing()` |
| `apps/api/Dockerfile` | Install `ffmpeg` and `yt-dlp` |
| `apps/mobile/src/components/VideoPlayer.tsx` | Add `nativeVideoUrl` prop, prefer native URL |
| `apps/web/src/components/VideoPlayer.tsx` | Add `nativeVideoUrl` prop, prefer native URL |
| `apps/web/src/components/ReelCard.tsx` | Pass `nativeVideoUrl` to VideoPlayer |
| `apps/mobile/src/screens/Reels.tsx` | Pass `nativeVideoUrl` to VideoPlayer |
| `apps/api/src/routes/admin.ts` | Add processing stats/trigger/retry endpoints |
| `packages/shared/src/types/index.ts` | Add `ProcessingStatus` type |
| `CLAUDE.md` | Update Reel model docs, env vars, architecture |
| `docs/en/` and `docs/es/` | Update relevant documentation |

---

## 13. Acceptance Criteria

### 13.1 Pipeline Core

- [ ] `video-processor.ts` downloads a YouTube video given a Reel ID
- [ ] Downloaded video is transcoded to MP4 H.264/AAC at 720p max
- [ ] `-movflags +faststart` is applied for progressive download
- [ ] Transcoded file is uploaded to R2 with correct Content-Type (`video/mp4`)
- [ ] Reel record is updated with `nativeVideoUrl` pointing to the CDN URL
- [ ] `processingStatus` transitions correctly: `pending` -> `processing` -> `completed`
- [ ] Failed processing sets `processingStatus='failed'` with descriptive `processingError`
- [ ] Videos longer than 5 minutes are rejected with `duration_exceeded`
- [ ] Videos larger than 200MB are rejected with `size_exceeded`
- [ ] Temporary files are cleaned up after processing (both success and failure)

### 13.2 Cron Job

- [ ] `process-videos.ts` runs every 2 hours
- [ ] Initial run is triggered 60 seconds after server startup
- [ ] Batch size is configurable via `VIDEO_PROCESSING_BATCH_SIZE`
- [ ] Processing can be disabled via `VIDEO_PROCESSING_ENABLED=false`
- [ ] Failed Reels with retryable errors are re-attempted after 1 hour cooldown
- [ ] Failed Reels with permanent errors are not retried

### 13.3 R2 Storage

- [ ] `r2-storage.ts` uploads files to the configured R2 bucket
- [ ] `createR2Storage()` returns `null` when env vars are not set (graceful degradation)
- [ ] Upload returns the public CDN URL
- [ ] `delete()` removes files from R2
- [ ] `exists()` checks file presence without downloading

### 13.4 Mobile Player

- [ ] When `nativeVideoUrl` is set, `VideoPlayer` uses `expo-video` with that URL
- [ ] When `nativeVideoUrl` is null, `VideoPlayer` falls back to YouTube embed (no regression)
- [ ] Native video playback starts without YouTube branding or ads
- [ ] Video controls (play/pause/seek) work correctly with native player
- [ ] Accessibility labels are present on the native video player

### 13.5 Web Player

- [ ] When `nativeVideoUrl` is set, `VideoPlayer` renders `<video>` with that URL
- [ ] When `nativeVideoUrl` is null, `VideoPlayer` falls back to YouTube embed (no regression)
- [ ] Native video has `controls`, `playsInline`, `preload="metadata"` attributes
- [ ] Poster image (`thumbnailUrl`) is shown before playback
- [ ] `aria-label="Video player"` is present

### 13.6 Admin

- [ ] `GET /api/admin/video-processing/stats` returns correct counts by status
- [ ] `POST /api/admin/video-processing/trigger` starts an ad-hoc batch
- [ ] `POST /api/admin/video-processing/retry/:reelId` resets a failed Reel for reprocessing
- [ ] All admin endpoints require authentication and admin role

### 13.7 Graceful Degradation

- [ ] Server starts normally when `yt-dlp` or `ffmpeg` is not installed (logs warning, skips processing)
- [ ] Server starts normally when R2 env vars are not set (processing disabled)
- [ ] Existing Reels without `nativeVideoUrl` continue to play via YouTube embed
- [ ] The Video Aggregator continues to work independently of the processing pipeline

---

## 14. Testing Strategy

### 14.1 Unit Tests

**`video-processor.test.ts`** (~15 tests):

| Test | Description |
|------|-------------|
| `processReel — success flow` | Mock yt-dlp, ffmpeg, R2 upload. Verify Reel updated with nativeVideoUrl and processingStatus='completed'. |
| `processReel — download failure` | Mock yt-dlp exit code 1. Verify processingStatus='failed', processingError set. |
| `processReel — transcode failure` | Mock ffmpeg exit code 1. Verify processingStatus='failed', temp files cleaned. |
| `processReel — upload failure` | Mock R2 upload throwing. Verify processingStatus='failed', processingError set. |
| `processReel — duration exceeds limit` | Mock ffprobe returning 600s. Verify processingStatus='failed', processingError='duration_exceeded'. |
| `processReel — video not found` | Mock yt-dlp "video unavailable" error. Verify permanent failure. |
| `processReel — already processing` | Call processReel on a Reel with processingStatus='processing'. Verify it's skipped. |
| `processReelBatch — respects batch size` | Insert 20 pending Reels, call with batchSize=5. Verify only 5 processed. |
| `processReelBatch — skips permanent failures` | Insert failed Reels with permanent errors. Verify they're not selected. |
| `processReelBatch — retries after cooldown` | Insert failed Reel with retryable error older than 1 hour. Verify it's selected. |
| `processReelBatch — processes newest first` | Insert Reels with different publishedAt. Verify order. |
| `processReelBatch — empty queue` | No pending Reels. Verify returns processed=0 without errors. |
| `processReel — cleanup on success` | Verify temp files are deleted after successful processing. |
| `processReel — cleanup on failure` | Verify temp files are deleted after failed processing. |
| `processReel — R2 not configured` | createR2Storage returns null. Verify processing skipped gracefully. |

**`r2-storage.test.ts`** (~8 tests):

| Test | Description |
|------|-------------|
| `upload — success` | Mock S3Client PutObjectCommand. Verify returns correct URL. |
| `upload — failure` | Mock S3Client throwing. Verify error propagated. |
| `delete — success` | Mock S3Client DeleteObjectCommand. Verify no error. |
| `exists — file exists` | Mock HeadObjectCommand success. Returns true. |
| `exists — file not found` | Mock HeadObjectCommand 404. Returns false. |
| `getPublicUrl — formats correctly` | Verify URL construction with key. |
| `createR2Storage — returns null without env vars` | Unset env vars. Verify null return. |
| `createR2Storage — returns instance with env vars` | Set env vars. Verify R2Storage instance. |

**`process-videos.test.ts`** (~5 tests):

| Test | Description |
|------|-------------|
| `scheduleVideoProcessing — disabled` | Set VIDEO_PROCESSING_ENABLED=false. Verify no cron scheduled. |
| `scheduleVideoProcessing — enabled` | Verify cron.schedule called with correct pattern. |
| `scheduleVideoProcessing — initial run` | Verify setTimeout called with 60000ms delay. |
| `batch handler — calls processReelBatch` | Trigger the cron callback. Verify processReelBatch called. |
| `batch handler — logs errors` | Mock processReelBatch throwing. Verify logger.error called. |

### 14.2 Integration Tests

Test the full pipeline (download -> transcode -> upload -> DB update) using:
- A short public-domain test video on YouTube (or a local test fixture)
- A mock R2 server (using `@aws-sdk/client-s3` mock or localstack)
- Real `ffmpeg` and `ffprobe` (if available on CI, else skip)

### 14.3 Frontend Tests

**Mobile `VideoPlayer.test.tsx`** — add:
- Test: renders `ExpoVideoPlayer` when `nativeVideoUrl` is provided
- Test: renders WebView (YouTube embed) when `nativeVideoUrl` is null
- Test: passes `nativeVideoUrl` as source to `ExpoVideoPlayer`

**Web `VideoPlayer.test.tsx`** — add:
- Test: renders `<video>` element when `nativeVideoUrl` is provided
- Test: renders YouTube iframe when `nativeVideoUrl` is null
- Test: `<video>` has correct `src`, `poster`, `controls`, `aria-label` attributes

### 14.4 Manual Testing Checklist

- [ ] Process a real YouTube video end-to-end on local dev
- [ ] Verify the R2 URL is accessible and plays in browser
- [ ] Verify mobile app plays native video without YouTube branding
- [ ] Verify web app plays native video with `<video>` element
- [ ] Verify a Reel with no `nativeVideoUrl` still plays via YouTube embed
- [ ] Verify processing stats endpoint returns correct counts
- [ ] Verify retry endpoint resets a failed Reel
- [ ] Verify server starts without R2 credentials (pipeline disabled, no crash)
- [ ] Verify server starts without `yt-dlp`/`ffmpeg` (pipeline disabled, warning logged)

---

## 15. Rollout Strategy

### Phase A: Backend Pipeline (Week 1)

1. Add Prisma migration for new Reel fields
2. Implement `r2-storage.ts` and `video-processor.ts`
3. Implement `process-videos.ts` cron job
4. Deploy with `VIDEO_PROCESSING_ENABLED=false` (pipeline off)
5. Configure R2 bucket and credentials on Fly.io
6. Enable pipeline, process a small batch manually via admin endpoint
7. Verify R2 URLs are accessible and return valid MP4

### Phase B: Frontend Integration (Week 2)

1. Update `VideoPlayer.tsx` on both mobile and web
2. Update `ReelCard` / `Reels` screen to pass `nativeVideoUrl`
3. Deploy web — verify native playback on Reels with completed processing
4. Build mobile preview — verify `expo-video` plays native URLs
5. Monitor: check that YouTube-only Reels still work (fallback)

### Phase C: Full Rollout (Week 2-3)

1. Enable pipeline on full batch schedule (every 2 hours)
2. Process backlog of existing Reels
3. Monitor R2 storage growth and costs
4. Add admin processing stats to admin panel
5. Update store listings to mention "ad-free video experience"

### Rollback Plan

If issues arise:
1. Set `VIDEO_PROCESSING_ENABLED=false` on Fly.io — stops new processing
2. Frontend fallback is automatic: Reels without `nativeVideoUrl` use YouTube embed
3. To fully revert: set `nativeVideoUrl = NULL` on all Reels via SQL, redeploy frontend without the native URL prop

No data is lost. The YouTube embed URLs remain in the `videoUrl` field regardless of processing status.

---

## 16. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| yt-dlp command injection | Video IDs are validated against `[a-zA-Z0-9_-]{11}` regex before passing to shell. Use `execFile` (not `exec`) to avoid shell interpolation. |
| Malicious video content | Videos must pass existing content moderation (`safetyStatus = 'approved'`) before processing. Only approved Reels enter the pipeline. |
| R2 credentials exposure | Stored as environment variables on Fly.io (encrypted secrets). Never committed to code. |
| Disk space exhaustion | Temp files are cleaned up after each Reel. Max file size enforced at download time. `tmpDir` is configurable. |
| Unauthorized admin access | All admin endpoints require `requireAuth` + `requireRole('admin')`. |
| Copyright concerns | Videos are from the same YouTube channels already displayed via embed. The editorial selection and moderation pipeline ensures only sports news content from verified sources is processed. Legal review recommended before production rollout. |

---

## 17. Dependencies

### npm Packages (New)

| Package | Purpose | Version |
|---------|---------|---------|
| `@aws-sdk/client-s3` | R2/S3 upload/delete/head operations | ^3.x |

Note: `yt-dlp` and `ffmpeg` are system binaries, not npm packages. They are invoked via Node.js `child_process.execFile`.

### Infrastructure (New)

| Service | Purpose | Cost |
|---------|---------|------|
| Cloudflare R2 | Video file storage | ~$0.015/GB/month storage, free egress |
| `yt-dlp` binary | YouTube download | Free (open source) |
| `ffmpeg` binary | Video transcoding | Free (open source) |

### Existing (Unchanged)

| Service | Interaction |
|---------|-------------|
| Video Aggregator | Continues to discover and catalog Reels from YouTube RSS |
| Content Moderator | Reels must be `approved` before entering the processing pipeline |
| Prisma / PostgreSQL | Extended Reel model with 3 new fields |

---

## 18. Open Questions

| # | Question | Proposed Answer |
|---|----------|-----------------|
| 1 | Should we process all historical Reels or only new ones? | Process all approved Reels. Backlog will take ~1-2 days at 10 per batch, 12 batches/day. |
| 2 | What about YouTube videos that block downloads? | Mark as permanent failure (`video_unavailable`). They continue to use YouTube embed. |
| 3 | Should we generate our own thumbnails from video frames? | Not in this phase. YouTube thumbnails are already stored and are high quality. |
| 4 | Should we update `durationSeconds` from ffprobe? | Yes. The current default is 60s which is inaccurate. ffprobe gives exact duration. |
| 5 | Custom domain for R2 vs. default `r2.dev` URL? | Start with `r2.dev`, migrate to custom domain (e.g., `videos.sportykids.app`) later. |
| 6 | Legal review of downloading YouTube videos? | Required before production. YouTube ToS technically prohibits downloading, but we are replacing embeds with self-hosted versions of the same editorial content. Legal counsel should review. |
| 7 | Should `processingStatus` be exposed in the public Reels API? | No. Only `nativeVideoUrl` matters for frontends. Admin endpoints expose processing details. |
