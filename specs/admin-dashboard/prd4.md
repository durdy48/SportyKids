# Admin Dashboard — Source Management (S4)
## Product Requirements Document

> **Prerequisite**: Implement `prd.md` (Shared Infrastructure) before this PRD. This page uses `AdminTable`, `AdminBadge`, and `authFetch`.

---

## Overview

The Sources section provides full admin control over all RSS news sources and video sources in the system. Admins can activate or deactivate any source, trigger a manual sync for a single source, add new custom sources, and delete custom sources. This gives the editorial team direct control over the content pipeline without needing database access.

---

## Problem Statement

The content pipeline currently has 182 predefined RSS sources and 20+ video sources managed exclusively through the Prisma seed file. Activating or deactivating a source requires a code change and deployment. There is no visibility into per-source health (last sync time, article count, error state). User-facing custom sources added via `POST /api/news/sources/custom` are also invisible to admins unless they query the database.

---

## Goals

1. Give admins a live view of all sources (predefined + custom) with health indicators.
2. Allow activating/deactivating any source without code changes.
3. Enable single-source manual sync to test a source independently.
4. Allow adding new custom sources with URL validation.
5. Allow deleting custom sources that are no longer needed.

---

## Target Users

Internal — SportyKids team members with `role: 'admin'`.

---

## Core Features

### 1. Backend Endpoints — RSS Sources

All in `apps/api/src/routes/admin.ts`. All require `requireAuth + requireRole('admin')`.

**`GET /api/admin/sources/rss?sport=&country=&active=&page=&limit=`**:

Returns paginated list of `RssSource` records with additional computed stats:

```typescript
{
  sources: Array<{
    id: string;
    name: string;
    url: string;
    sport: string;
    country: string;
    language: string;
    active: boolean;
    isCustom: boolean;
    lastSyncedAt: string | null;
    newsCount: number;      // COUNT of NewsItem where rssSourceId = this source's id
    description: string | null;
    category: string | null;
    logoUrl: string | null;
    isStale: boolean;       // lastSyncedAt < now - 2h (for RSS)
  }>;
  total: number;
  page: number;
  totalPages: number;
}
```

Implementation note: `newsCount` requires a join/count. Use Prisma `include: { _count: { select: { newsItems: true } } }` if the `NewsItem` model has a `rssSourceId` relation, or use a `$queryRaw` if not directly related. Check `apps/api/prisma/schema.prisma` for the actual relation field name before implementing.

Query params:
- `sport`: filter by sport value (e.g., `football`)
- `country`: filter by country code (e.g., `ES`)
- `active`: `true` | `false` | omit for all
- `page`: default 1
- `limit`: default 25, max 100

**`PATCH /api/admin/sources/rss/:id`**:

Partial update of an `RssSource`. Accepted fields: `active`, `name`, `sport`, `country`. Returns updated source.

Validation: `active` must be boolean. `sport` must be one of the valid sport values from `packages/shared/src/constants/`. Do not allow changing `url` for predefined sources.

**`DELETE /api/admin/sources/rss/:id`**:

- If `isCustom: false`: return 403 with message `"Predefined sources cannot be deleted"`.
- If `isCustom: true`: delete the `RssSource` record. Associated `NewsItem` records keep their `rssSourceId` but the source is gone (soft-orphan — acceptable, they remain approved content).

**`POST /api/admin/sources/rss/:id/sync`**:

Triggers the RSS aggregator for a single source:
```typescript
// Import and call aggregator service for one source
import { syncSingleSource } from '../services/aggregator';
// Returns: { processed: number, errors: number }
```

The `aggregator.ts` service should expose a `syncSingleSource(sourceId: string)` function (extract from existing batch logic if not already there). This endpoint runs synchronously (awaits completion) since single-source sync is fast (< 5s).

**`POST /api/admin/sources/rss`**:

Add a new custom RSS source:
```typescript
// Body: { name: string, url: string, sport: string, country: string }
// Validation with Zod:
const addRssSchema = z.object({
  name: z.string().min(2).max(100),
  url: z.string().url(),
  sport: z.enum(['football', 'basketball', 'tennis', 'swimming', 'athletics', 'cycling', 'formula1', 'padel']),
  country: z.string().length(2).toUpperCase(),
});
```

Before saving, validate the feed is reachable:
```typescript
// Use rss-parser to attempt to fetch and parse the URL
import Parser from 'rss-parser';
const parser = new Parser();
try {
  await parser.parseURL(body.url);
} catch {
  return res.status(422).json({ error: 'Feed URL is not a valid or reachable RSS feed' });
}
```

If valid: create `RssSource` with `isCustom: true`, `addedBy: req.userId`, `active: true`. Return created source.

### 2. Backend Endpoints — Video Sources

Same pattern as RSS, applied to `VideoSource` model.

**`GET /api/admin/sources/video?sport=&active=&page=&limit=`**:

```typescript
{
  sources: Array<{
    id: string;
    name: string;
    feedUrl: string;
    platform: 'youtube_channel' | 'youtube_playlist';
    sport: string;
    active: boolean;
    isCustom: boolean;
    lastSyncedAt: string | null;
    reelCount: number;    // COUNT of Reel where videoSourceId = this source's id
    isStale: boolean;     // lastSyncedAt < now - 8h (for Video)
  }>;
  total: number;
  page: number;
  totalPages: number;
}
```

**`PATCH /api/admin/sources/video/:id`**:
Accepted fields: `active`, `name`, `sport`.

**`DELETE /api/admin/sources/video/:id`**:
Same rule — only `isCustom: true` sources can be deleted.

**`POST /api/admin/sources/video/:id/sync`**:
Triggers `videoAggregator.syncSingleSource(sourceId)` for a single video source.

**`POST /api/admin/sources/video`**:
```typescript
// Body: { name: string, feedUrl: string, sport: string, platform: 'youtube_channel' | 'youtube_playlist' }
// No reachability check needed (YouTube Atom feeds are not public-parseable without auth)
// Create VideoSource with isCustom: true, addedBy: req.userId, active: true
```

### 3. Existing User-Facing Endpoints

The following endpoints already exist and remain unchanged — they are for user self-service (mobile/web), not admin:
- `POST /api/news/sources/custom`
- `DELETE /api/news/sources/custom/:id`
- `GET /api/reels/sources/catalog`
- `POST /api/reels/sources/custom`
- `DELETE /api/reels/sources/custom/:id`

Admin endpoints operate on ALL sources (not just custom). User endpoints remain scoped to the authenticated user's custom sources.

### 4. Frontend — Sources Page

**File**: `apps/web/src/app/(admin)/admin/sources/page.tsx`

Client component with two tabs: "RSS Sources" and "Video Sources".

**RSS Sources tab**:
- Filters row: Sport dropdown, Country dropdown, Active toggle (All / Active / Inactive)
- `AdminTable` with columns:
  - Name (with logo if `logoUrl` set)
  - Sport (badge using sport colors)
  - Country
  - Type (`PREDEFINED` gray badge | `CUSTOM` blue badge)
  - Active toggle (inline `<input type="checkbox">` that calls `PATCH` on change)
  - Last Sync (relative time, red if `isStale`)
  - News Count
  - Actions: [Sync] button, [Delete] button (only for custom sources)
- Add Source collapsible form below the table (initially collapsed, "+" button to expand)
- Sync button: shows spinner while request is in flight, updates `lastSyncedAt` on success
- Delete button: confirmation dialog before DELETE request

**Video Sources tab**:
- Same layout as RSS tab but for `VideoSource` data
- Columns: Name, Platform (badge), Sport, Type, Active, Last Sync, Reel Count, Actions

---

## UI Mockups (ASCII Art)

### Sources Page — RSS Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚙ SportyKids Admin                                                          │
├────────────────┬────────────────────────────────────────────────────────────┤
│  Overview      │  Source Management                                         │
│  Moderation    │                                                            │
│  Analytics     │  [RSS Sources (182)]  [Video Sources (24)]                 │
│  Sources   ◀   │                                                            │
│  Jobs          │  Filters: [All sports ▼]  [All countries ▼]  [All ▼]      │
│  Users & Orgs  │                                                            │
│                ├────────────────────────────────────────────────────────────┤
│                │ Name           │ Sport    │ Cty │ Type   │ Actv │ Sync  │ # │
│                │────────────────┼──────────┼─────┼────────┼──────┼───────┼───│
│                │ Marca          │ Football │ ES  │[PREDEF]│ [✓] │28m[↻]│ 42│
│                │ BBC Sport      │ Football │ GB  │[PREDEF]│ [✓] │31m[↻]│ 31│
│                │ My Custom Feed │ Tennis   │ ES  │[CUSTOM]│ [✓] │ 4h[↻]│  8│
│                │ El Desmarque   │ Football │ ES  │[PREDEF]│ [✓] │29m[↻]│ 19│
│                │────────────────┼──────────┼─────┼────────┼──────┼───────┼───│
│                │  < Prev   Page 1 of 8   Next >                             │
│                │                                                            │
│                │  [+ Add RSS Source ▼]                                      │
│                │  ┌──────────────────────────────────────────────────────┐  │
│                │  │ Name: [                    ]  Sport: [Football ▼]   │  │
│                │  │ URL:  [                                            ]│  │
│                │  │ Country: [ES]              [Validate & Add Source]  │  │
│                │  └──────────────────────────────────────────────────────┘  │
└────────────────┴────────────────────────────────────────────────────────────┘
```

### Stale Source Indicator

```
│ Marca     │ Football │ ES │[PREDEF]│ [✓] │ ⚠ 8h 23m [↻] │ 42 │
```

When `isStale: true`, the "Last Sync" cell renders in red with ⚠ prefix.

### Delete Confirmation Dialog

```
┌─────────────────────────────────────┐
│  Delete Source                      │
│─────────────────────────────────────│
│  Delete "My Custom Feed"?           │
│                                     │
│  This will remove the source. Any   │
│  articles already ingested will     │
│  remain in the database.            │
│                                     │
│         [Cancel]  [Delete Source]   │
└─────────────────────────────────────┘
```

### Video Sources Tab

```
│  [RSS Sources (182)]  [Video Sources (24)]                                  │
│                                                                             │
│ Name              │ Platform    │ Sport    │ Type   │ Actv │ Sync  │ Reels  │
│───────────────────┼─────────────┼──────────┼────────┼──────┼───────┼────────│
│ Real Madrid YT    │[YT CHANNEL] │ Football │[PREDEF]│ [✓] │ 6h[↻]│   12  │
│ LaLiga Highlights │[YT PLAYLIST]│ Football │[PREDEF]│ [✓] │ 7h[↻]│   28  │
│ My Tennis Chan    │[YT CHANNEL] │ Tennis   │[CUSTOM]│ [✓] │ 9h[↻]│    3  │
```

---

## Acceptance Criteria

- [ ] `GET /api/admin/sources/rss` returns paginated results with `newsCount` per source.
- [ ] `GET /api/admin/sources/rss?sport=football` filters results to football sources only.
- [ ] `GET /api/admin/sources/rss?active=true` returns only active sources.
- [ ] `GET /api/admin/sources/rss` includes `isStale: true` for sources not synced in > 2h.
- [ ] `PATCH /api/admin/sources/rss/:id` with `{ active: false }` deactivates the source.
- [ ] `DELETE /api/admin/sources/rss/:id` for a predefined source returns 403.
- [ ] `DELETE /api/admin/sources/rss/:id` for a custom source removes the record.
- [ ] `POST /api/admin/sources/rss/:id/sync` returns `{ processed, errors }` after sync.
- [ ] `POST /api/admin/sources/rss` with an invalid URL returns 422.
- [ ] `POST /api/admin/sources/rss` with a valid RSS URL creates the source with `isCustom: true`.
- [ ] `POST /api/admin/sources/rss` with a non-RSS URL (e.g., a regular webpage) returns 422.
- [ ] `GET /api/admin/sources/video` returns paginated results with `reelCount` per source.
- [ ] `DELETE /api/admin/sources/video/:id` for a predefined source returns 403.
- [ ] Sources page renders RSS tab with all columns visible.
- [ ] Active toggle updates `active` field on change (no save button needed — inline toggle).
- [ ] Sync button shows spinner and updates Last Sync cell on success.
- [ ] Stale sources show red "Last Sync" cell.
- [ ] Add Source form validates URL before showing submit button.
- [ ] Delete action opens confirmation dialog.
- [ ] Video Sources tab renders with correct columns.
- [ ] All admin endpoints return 401 without auth, 403 without admin role.

---

## Technical Requirements

### New Files

| File | Description |
|------|-------------|
| `apps/web/src/app/(admin)/admin/sources/page.tsx` | Sources management page |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/routes/admin.ts` | Add all source management endpoints |
| `apps/api/src/services/aggregator.ts` | Export `syncSingleSource(sourceId)` function |
| `apps/api/src/services/video-aggregator.ts` | Export `syncSingleSource(sourceId)` function |

### Extracting `syncSingleSource` from Aggregator

The existing `aggregator.ts` has a batch sync function. Extract a single-source variant:

```typescript
// apps/api/src/services/aggregator.ts
export async function syncSingleSource(sourceId: string): Promise<{ processed: number; errors: number }> {
  const source = await prisma.rssSource.findUnique({ where: { id: sourceId } });
  if (!source || !source.active) throw new Error('Source not found or inactive');
  return syncSource(source); // existing internal function
}
```

### Inline Active Toggle Pattern (Frontend)

```typescript
// In AdminTable render function for the 'active' column:
render: (row) => (
  <input
    type="checkbox"
    checked={row.active}
    onChange={async (e) => {
      await authFetch(`/api/admin/sources/rss/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: e.target.checked }),
      });
      // Optimistic update or re-fetch
      setSources(prev => prev.map(s => s.id === row.id ? { ...s, active: e.target.checked } : s));
    }}
    className="w-4 h-4 accent-blue-500 cursor-pointer"
  />
)
```

### Feed Validation (Backend)

The RSS validation at `POST /api/admin/sources/rss` has a 5-second timeout to prevent hanging on slow/dead URLs:

```typescript
import Parser from 'rss-parser';
const parser = new Parser({ timeout: 5000 });
try {
  await parser.parseURL(body.url);
} catch {
  return res.status(422).json({ error: 'Feed URL is not a valid or reachable RSS feed' });
}
```

---

## Implementation Decisions

**Why keep the existing user-facing custom source endpoints?**
The user-facing `POST /api/news/sources/custom` creates sources scoped to the current user (`addedBy: req.userId`) and is consumed by the mobile RssCatalog screen. Replacing it with the admin endpoint would break the self-service flow. The admin endpoints add management capabilities on top without replacing user workflows.

**Why allow admins to deactivate predefined sources but not delete them?**
Deleting a predefined source would require removing it from `seed.ts` as well to prevent it from being re-created on the next seed run. Deactivating (setting `active: false`) is a stable operation that survives re-seeding (the seed should use `upsert` with `update: {}` to avoid overwriting the active flag). This is the safer operation for an admin tool.

**Why does video source addition skip reachability validation?**
YouTube Atom feeds require either a Google API key or a specific authentication header to fetch programmatically. A simple HTTP GET is rate-limited by YouTube. Since the platform already uses YouTube RSS feed URLs in a known format, an admin adding a video source can be trusted to provide a valid YouTube channel/playlist URL. Format validation (must contain `youtube.com`) is sufficient.

**Why run RSS sync synchronously but job triggers asynchronously?**
Single-source RSS sync for one source takes < 5 seconds (one HTTP call + DB writes). This is short enough to handle within an HTTP request. Full job triggers (all 182 sources) can take 30+ seconds and must be async (see prd3.md). The distinction prevents accidental long-running sync from the Sources page.

---

## Testing Decisions

**Unit tests** in `apps/api/src/routes/admin.test.ts`:
- `GET /api/admin/sources/rss` returns correct `newsCount` for seeded sources.
- `GET /api/admin/sources/rss?sport=football` excludes non-football sources.
- `PATCH /api/admin/sources/rss/:id` toggles `active` correctly.
- `DELETE /api/admin/sources/rss/:id` returns 403 for predefined sources.
- `DELETE /api/admin/sources/rss/:id` deletes custom sources.
- `POST /api/admin/sources/rss` with unreachable URL returns 422. (Mock `rss-parser` to throw.)
- `POST /api/admin/sources/rss` with valid URL creates source with `isCustom: true`. (Mock `rss-parser` to succeed.)
- All endpoints return 401 without auth, 403 without admin role.

---

## Out of Scope

- Editing the RSS feed URL of an existing source (changing URLs could create duplicate content; safer to delete and re-add).
- Bulk activate/deactivate multiple sources at once.
- Source health scoring (e.g., tracking % of sync attempts that produce 0 articles).
- Source category management (adding/renaming categories).
- Importing sources from an OPML file.

---

## Future Considerations

- Add per-source error history (how many times has this source failed to sync in the last 7 days).
- Add "test feed" button that fetches the latest 5 articles from a source for preview before activating.
- Source health score badge (green/yellow/red based on recent sync success rate).
- OPML import for bulk source addition.
