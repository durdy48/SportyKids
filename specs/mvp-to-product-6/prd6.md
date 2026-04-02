# Phase 6, PRD 6: Youth League Content

| Field | Value |
|-------|-------|
| **Phase** | 6.6 — Youth League Content |
| **Priority** | P1 (competitive differentiation) |
| **Target** | Month 3-4 post-launch (v1.4.0) |
| **Dependencies** | Phases 0-5 complete, app published, RSS aggregator operational |
| **Estimated effort** | 10-14 days |

---

## 1. Overview / Problem Statement

Mainstream sports media covers professional leagues exclusively. Youth and school competitions -- regional football base leagues, school basketball tournaments, youth athletics championships -- receive zero coverage. For kids aged 6-14 who actually **play** in these leagues, this is a glaring gap. A child competing in the Liga Autonomica de Futbol Base de Andalucia will never see their league mentioned on Marca or AS.

SportyKids can fill this gap by partnering with regional federations and scraping their websites for results, standings, and news. This creates content that is:

1. **Impossible to replicate** by general-purpose news apps
2. **Deeply personal** -- a child can follow their own league
3. **Inherently child-safe** -- youth league content requires no AI moderation concerns
4. **A B2B acquisition channel** -- clubs and academies become distribution partners

Most federation websites lack RSS feeds. They publish results as HTML pages with inconsistent structure. This requires a web scraping layer (Cheerio) that converts HTML into structured news items compatible with the existing aggregator pipeline.

---

## 2. Goals and Non-Goals

### Goals

1. **Scraper service**: A Cheerio-based web scraper (`youth-league-scraper.ts`) that extracts results, standings, and news from federation websites without RSS feeds.
2. **Scraper configuration**: A JSON-based config system (`scraperConfig` on `RssSource`) that defines CSS selectors, URL patterns, and field mappings per federation site, so new federations can be onboarded without code changes.
3. **New content category**: Extend `RssSource.category` to include `youth` alongside the existing `general` and `team_news` values.
4. **Cron job**: `sync-youth-leagues.ts` running every 2 hours to scrape configured federation sites.
5. **Feed integration**: Youth league content flows through the existing news pipeline (moderation, summarization, ranking) and appears in the standard news feed filterable by a new "Youth Leagues" chip.
6. **UI filter**: "Youth Leagues" filter chip in FiltersBar on both web and mobile.
7. **i18n**: All youth league labels localized in ES and EN.
8. **Pilot**: Liga Autonomica de Futbol Base de Andalucia as the first configured source.

### Non-Goals

- Building a full CMS for federations to publish content directly
- Real-time score updates for youth matches (see PRD for live scores)
- User-generated content (parents/coaches submitting results)
- Mobile push notifications specific to youth league results (use existing push infrastructure)
- Partnership legal agreements (handled outside engineering)
- Covering non-football youth sports in the pilot (basketball, athletics come later)
- Building a dedicated "Youth Leagues" screen (content integrates into existing feed)

---

## 3. Scope

### 3.1 Data Model Changes

#### Extend `RssSource` model

Add a `scraperConfig` JSON field to store per-source scraping configuration. The existing `category` field (currently `"general"` or `"team_news"`) gains a third value: `"youth"`.

```prisma
model RssSource {
  id            String    @id @default(cuid())
  name          String
  url           String    @unique
  sport         String
  active        Boolean   @default(true)
  lastSyncedAt  DateTime?
  country       String    @default("ES")
  language      String    @default("es")
  logoUrl       String?
  description   String    @default("")
  category      String    @default("general")  // "general" | "team_news" | "youth"
  isCustom      Boolean   @default(false)
  addedBy       String?
  scraperConfig Json?     // NEW: scraper settings for non-RSS sources
}
```

#### `scraperConfig` JSON Schema

When `scraperConfig` is non-null, the source is treated as a **scrape target** rather than an RSS feed. The sync job uses Cheerio instead of rss-parser.

```typescript
interface ScraperConfig {
  // Scraping strategy
  type: 'html_list' | 'html_table' | 'json_api';

  // Pagination
  listUrl: string;                    // URL pattern for the list page, supports {page} placeholder
  maxPages: number;                   // Max pages to crawl per sync (default: 3)

  // CSS selectors for list page
  selectors: {
    articleContainer: string;         // e.g., ".news-item", "tr.result-row"
    title: string;                    // e.g., "h3 a", ".match-title"
    link: string;                     // e.g., "h3 a[href]", ".match-link"
    summary?: string;                 // e.g., ".excerpt", ".match-score"
    image?: string;                   // e.g., "img.thumbnail[src]"
    date?: string;                    // e.g., ".date", "td.match-date"
    dateFormat?: string;              // e.g., "DD/MM/YYYY", "YYYY-MM-DD HH:mm"
  };

  // URL resolution
  baseUrl: string;                    // Base URL for resolving relative links

  // Optional detail page scraping
  detailPage?: {
    contentSelector: string;          // CSS selector for full article body
    imageSelector?: string;           // CSS selector for article image
  };

  // Rate limiting
  requestDelayMs?: number;            // Delay between requests (default: 2000)

  // Custom headers
  headers?: Record<string, string>;
}
```

#### Extend `NewsItem` (no schema change needed)

Youth league news items use the existing `NewsItem` model. They are distinguished by:
- `sport`: existing sport value (e.g., `"football"`)
- `source`: federation name (e.g., `"RFAF Futbol Base"`)
- The originating `RssSource` has `category: "youth"`

No new fields are needed on `NewsItem`. The `source` field and the `RssSource.category` provide sufficient filtering.

### 3.2 New Sport Values (Decision)

**Decision: Do NOT add new sport values like `youth_football`.** Instead, youth content uses existing sport values (`football`, `basketball`, etc.) and is distinguished by the `RssSource.category = "youth"` field. Rationale:

1. The `SPORTS` constant is used across the entire codebase (filters, colors, emojis, i18n labels). Adding `youth_football` would require changes in 30+ files.
2. A child who likes football wants to see **all** football content -- professional and youth -- in their feed.
3. The "Youth Leagues" filter chip is an **additive** filter, not a sport replacement.
4. Parental controls (`allowedSports`) work without modification.

### 3.3 Scraper Service

**New file**: `apps/api/src/services/youth-league-scraper.ts`

```typescript
// Public API
export interface ScrapeResult {
  title: string;
  link: string;
  summary: string;
  imageUrl: string;
  publishedAt: Date;
  guid: string;         // Generated from link hash
}

export async function scrapeSource(
  url: string,
  config: ScraperConfig,
): Promise<ScrapeResult[]>;
```

**Architecture**:

1. **Fetch HTML**: Use `fetch()` (Node 20 built-in) with configurable headers and User-Agent `SportyKids/1.0 (Youth league aggregator)`.
2. **Parse with Cheerio**: Load HTML into Cheerio, apply CSS selectors from `scraperConfig.selectors`.
3. **Extract items**: For each matched `articleContainer`, extract `title`, `link`, `summary`, `image`, and `date` using the configured selectors.
4. **Resolve URLs**: Convert relative links to absolute using `config.baseUrl`.
5. **Generate GUID**: Create a deterministic GUID from the article URL using a SHA-256 hash, prefixed with `scrape:` to avoid collisions with RSS GUIDs.
6. **Parse dates**: Use `config.selectors.dateFormat` to parse publication dates. Fall back to `new Date()` if parsing fails.
7. **Optional detail page**: If `config.detailPage` is set, fetch each article URL and extract full content and images.
8. **Rate limiting**: Wait `config.requestDelayMs` (default 2000ms) between HTTP requests to avoid hammering federation servers.
9. **Error handling**: Log and skip individual items that fail to parse. Never throw for a single bad item.

**Dependencies**:
- `cheerio` (new dependency, ~200KB, MIT license, zero native deps)
- No other new dependencies. Uses Node built-in `fetch` and `crypto`.

### 3.4 Cron Job

**New file**: `apps/api/src/jobs/sync-youth-leagues.ts`

Runs every 2 hours (less frequent than main RSS sync at 30min, since federation sites update less often).

```typescript
// Cron expression: '0 */2 * * *'
export async function syncYouthLeagues(): Promise<SyncAllResult>;
```

**Flow**:

1. Query `RssSource` where `category = 'youth'` AND `active = true`.
2. For each source:
   a. If `scraperConfig` is non-null: call `scrapeSource()` to get items.
   b. If `scraperConfig` is null: call existing `syncSource()` (the federation has a real RSS feed).
3. For scraped items: run through the same pipeline as RSS items:
   - Content moderation (`moderateContent`)
   - Team classification (`classifyNews`)
   - Upsert into `NewsItem` with `rssGuid = scrape:{hash}`
   - Fire-and-forget summary generation
4. Update `RssSource.lastSyncedAt`.
5. Log results via Pino structured logging.

**Integration with existing aggregator**: The scraper produces items in the same shape as RSS items. The `syncSource` function in `aggregator.ts` will be refactored to accept items from either RSS parser or the scraper, avoiding code duplication for the moderation/classification/upsert logic.

### 3.5 Aggregator Refactor

**Modified file**: `apps/api/src/services/aggregator.ts`

Extract the per-item processing logic from `syncSource()` into a shared function:

```typescript
export interface RawNewsItem {
  title: string;
  link: string;
  summary: string;
  imageUrl: string;
  publishedAt: Date;
  rssGuid: string;
}

// Extracted from syncSource, used by both RSS and scraper paths
export async function processNewsItem(
  item: RawNewsItem,
  sourceName: string,
  sport: string,
  result: SyncResult,
): Promise<void>;
```

This refactor:
- Keeps `syncSource()` working exactly as before for RSS sources
- Allows `sync-youth-leagues.ts` to call `processNewsItem()` for scraped items
- Eliminates duplication of moderation, classification, and upsert logic

### 3.6 API Integration

Youth league content enters the existing news feed automatically because it is stored as regular `NewsItem` records. No new API endpoints are needed.

**Filter support**: The existing `GET /api/news` endpoint needs a new optional query parameter:

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | `string?` | Filter by RssSource category: `"general"`, `"team_news"`, `"youth"`. If omitted, returns all categories. |

**Implementation**: Join `NewsItem` with `RssSource` via `NewsItem.source = RssSource.name` to filter by category. Since `NewsItem.source` stores the source name (not ID), this requires a subquery or a denormalized field.

**Decision: Add `category` field to `NewsItem`**:

```prisma
model NewsItem {
  // ... existing fields ...
  category    String    @default("general")  // denormalized from RssSource for query performance
}
```

This avoids a JOIN on every news query. The category is set at insert time from the `RssSource.category` value.

**Modified file**: `apps/api/src/routes/news.ts` -- add `category` query parameter to the `GET /api/news` endpoint.

### 3.7 Admin Endpoint for Scraper Management

**New endpoint**: `POST /api/news/sources/youth` (requireAuth + requireRole('admin'))

Creates a new youth league source with scraper configuration.

```typescript
// Request body
{
  name: string;
  url: string;
  sport: string;           // Must be a valid SPORTS value
  country: string;
  language: string;
  description?: string;
  scraperConfig: ScraperConfig;
}
```

**New endpoint**: `POST /api/news/sources/youth/:id/test` (requireAuth + requireRole('admin'))

Runs the scraper against the source and returns preview results without persisting them. Used to validate scraper configuration before activating.

```typescript
// Response
{
  success: boolean;
  itemsFound: number;
  preview: Array<{
    title: string;
    link: string;
    summary: string;
    imageUrl: string;
    publishedAt: string;
  }>;
  errors: string[];
}
```

### 3.8 UI Changes

#### FiltersBar -- "Youth Leagues" chip

**Modified files**:
- `apps/web/src/components/FiltersBar.tsx`
- `apps/mobile/src/components/FiltersBar.tsx`

Add a "Youth Leagues" toggle chip after the sport filter chips. When active, it sets `category=youth` on the news API request. When inactive, no category filter is applied (all content shown).

Behavior:
- The chip is a toggle (on/off), not part of the sport filter group
- When "Youth Leagues" is active, sport filters still work (intersection: youth + football)
- Visual: uses the existing chip/tag styling with a distinct icon (trophy/shield)
- Label: `t('filters.youth_leagues', locale)` -- "Youth Leagues" / "Ligas Juveniles"

#### No new screens

Youth league content appears in the existing HomeFeed alongside professional news. No dedicated screen is needed for the pilot. If usage data shows demand, a dedicated "My League" screen can be added later.

### 3.9 i18n

**Modified files**:
- `packages/shared/src/i18n/en.json`
- `packages/shared/src/i18n/es.json`

New keys:

```json
{
  "filters": {
    "youth_leagues": "Youth Leagues"
  },
  "youth": {
    "badge": "Youth",
    "source_badge": "Youth League",
    "no_content": "No youth league content yet. Stay tuned!",
    "category_label": "Youth Leagues"
  },
  "a11y": {
    "youth_leagues_filter": "Filter by youth leagues",
    "youth_badge": "Youth league content"
  }
}
```

Spanish:

```json
{
  "filters": {
    "youth_leagues": "Ligas Juveniles"
  },
  "youth": {
    "badge": "Juvenil",
    "source_badge": "Liga Juvenil",
    "no_content": "Aun no hay contenido de ligas juveniles. Pronto habra novedades!",
    "category_label": "Ligas Juveniles"
  },
  "a11y": {
    "youth_leagues_filter": "Filtrar por ligas juveniles",
    "youth_badge": "Contenido de liga juvenil"
  }
}
```

### 3.10 Content Moderation

Youth league content flows through the **same AI moderation pipeline** as regular news. No changes to `content-moderator.ts` are needed.

However, youth league content is expected to be inherently safer (results, standings, match reports). The moderation pass-through rate should be near 100%. If the AI moderator rejects youth content, it is likely a false positive and should be flagged for manual review.

### 3.11 Pilot Configuration: RFAF Futbol Base

The pilot source targets the Real Federacion Andaluza de Futbol (RFAF) youth football section.

**Seed data** (added to `prisma/seed.ts`):

```typescript
{
  name: 'RFAF Futbol Base',
  url: 'https://www.rfaf.es/noticias/futbol-base',
  sport: 'football',
  active: true,
  country: 'ES',
  language: 'es',
  category: 'youth',
  description: 'Real Federacion Andaluza de Futbol - Futbol Base news and results',
  scraperConfig: {
    type: 'html_list',
    listUrl: 'https://www.rfaf.es/noticias/futbol-base?page={page}',
    maxPages: 3,
    selectors: {
      articleContainer: '.news-item',
      title: '.news-item__title a',
      link: '.news-item__title a[href]',
      summary: '.news-item__excerpt',
      image: '.news-item__image img[src]',
      date: '.news-item__date',
      dateFormat: 'DD/MM/YYYY',
    },
    baseUrl: 'https://www.rfaf.es',
    detailPage: {
      contentSelector: '.news-detail__content',
      imageSelector: '.news-detail__image img[src]',
    },
    requestDelayMs: 3000,
  },
}
```

**Note**: The CSS selectors above are illustrative. The actual selectors must be determined by inspecting the live RFAF website at implementation time. The `POST /api/news/sources/youth/:id/test` endpoint exists precisely for this iterative configuration process.

---

## 4. Technical Architecture

```
                                  Federation Website (HTML)
                                           |
                                     [fetch + Cheerio]
                                           |
                              youth-league-scraper.ts
                                           |
                                    ScrapeResult[]
                                           |
                          sync-youth-leagues.ts (cron */2h)
                                           |
                            processNewsItem() [shared]
                                    /      |      \
                          moderateContent  classifyNews  upsert NewsItem
                                                           |
                                                  generateSummaries
                                                           |
                                              GET /api/news?category=youth
                                                    /            \
                                              Web FiltersBar   Mobile FiltersBar
                                              "Youth Leagues"  "Ligas Juveniles"
```

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Federation site is down | Log error, skip source, retry next cron cycle |
| HTML structure changed (selectors fail) | Log warning with 0 items found, admin notified via structured logs |
| Individual item parse failure | Skip item, continue with next, log details |
| Rate limit / 429 response | Back off, retry with exponential delay (max 30s) |
| Cheerio selector returns empty | Treat as "no content found", not an error |
| GUID collision (same article re-scraped) | Upsert handles gracefully (existing behavior) |

### Performance Considerations

- Youth league sources are fewer than RSS sources (5-10 vs 182). Sync completes in under 2 minutes.
- `requestDelayMs` (default 2000ms) prevents overloading federation servers.
- `maxPages` (default 3) caps the scraping depth per sync cycle.
- The `category` index on `NewsItem` enables fast filtered queries:

```prisma
@@index([category, sport, safetyStatus, publishedAt])
```

---

## 5. Migration Plan

### Database Migration

```sql
-- Add scraperConfig to RssSource
ALTER TABLE "RssSource" ADD COLUMN "scraperConfig" JSONB;

-- Add category to NewsItem (denormalized)
ALTER TABLE "NewsItem" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general';

-- Index for category-filtered queries
CREATE INDEX "NewsItem_category_sport_safetyStatus_publishedAt_idx"
  ON "NewsItem" ("category", "sport", "safetyStatus", "publishedAt");
```

### Backfill

Existing `NewsItem` records get `category = 'general'` by default (the migration default). No backfill script is needed since existing content is all from general/team_news RSS sources and the default covers both.

---

## 6. Acceptance Criteria

### Scraper Service

- [ ] `youth-league-scraper.ts` fetches HTML from a configured URL and extracts structured items using Cheerio + CSS selectors from `scraperConfig`.
- [ ] The scraper respects `requestDelayMs` between HTTP requests.
- [ ] The scraper handles pagination via the `{page}` placeholder in `listUrl`.
- [ ] The scraper generates deterministic GUIDs (`scrape:{sha256(url)}`) for deduplication.
- [ ] If `detailPage` is configured, the scraper fetches individual article pages for full content.
- [ ] The scraper logs errors per-item and never throws for a single parse failure.
- [ ] Relative URLs are resolved against `config.baseUrl`.

### Cron Job

- [ ] `sync-youth-leagues.ts` runs on a `0 */2 * * *` schedule.
- [ ] It queries only `RssSource` records where `category = 'youth'` and `active = true`.
- [ ] For sources with `scraperConfig`: uses the scraper. For sources without: uses existing RSS parser.
- [ ] Scraped items pass through content moderation and team classification.
- [ ] Approved items are inserted as `NewsItem` records with `category = 'youth'`.
- [ ] Summary generation fires for new items (same as RSS pipeline).
- [ ] `RssSource.lastSyncedAt` is updated after each source sync.
- [ ] Structured Pino logs include source name, items found, items created, moderation stats.

### Aggregator Refactor

- [ ] `processNewsItem()` is extracted from `syncSource()` with zero behavioral change.
- [ ] Existing RSS sync tests pass without modification.
- [ ] Both RSS and scraper paths use `processNewsItem()`.

### API

- [ ] `GET /api/news?category=youth` returns only youth league content.
- [ ] `GET /api/news` (no category param) returns all content including youth.
- [ ] `GET /api/news?category=youth&sport=football` correctly intersects both filters.
- [ ] `POST /api/news/sources/youth` creates a youth source with `scraperConfig` (admin only).
- [ ] `POST /api/news/sources/youth/:id/test` returns a preview of scraped items without persisting.
- [ ] The existing `GET /api/news/sources/catalog` includes youth sources with their `scraperConfig`.

### UI

- [ ] FiltersBar (web) shows a "Youth Leagues" chip that toggles `category=youth` filter.
- [ ] FiltersBar (mobile) shows a "Ligas Juveniles" / "Youth Leagues" chip (localized).
- [ ] The chip is visually distinct from sport chips (different color or icon).
- [ ] When the chip is active and no youth content exists, a localized empty state is shown.
- [ ] NewsCard displays a small "Youth" / "Juvenil" badge for youth league articles.
- [ ] Accessibility: the chip has `accessibilityLabel` / `aria-label` via `t('a11y.youth_leagues_filter', locale)`.

### i18n

- [ ] All new UI strings use `t()` with keys from `packages/shared/src/i18n/`.
- [ ] Both `en.json` and `es.json` contain the `filters.youth_leagues`, `youth.*`, and `a11y.*` keys.

### Pilot

- [ ] At least one RFAF youth football source is seeded with a working `scraperConfig`.
- [ ] Running `sync-youth-leagues.ts` manually produces at least 5 news items from the pilot source.
- [ ] The items appear in the feed when filtering by "Youth Leagues".

---

## 7. Testing Strategy

### Unit Tests

| Test file | Coverage |
|-----------|----------|
| `youth-league-scraper.test.ts` | Cheerio parsing with mock HTML fixtures, selector extraction, URL resolution, GUID generation, date parsing, error handling for malformed HTML |
| `sync-youth-leagues.test.ts` | Cron job orchestration, source filtering by category, scraper vs RSS path selection, result aggregation |
| `aggregator.test.ts` | Verify `processNewsItem()` extraction does not change existing behavior (regression) |
| `news.routes.test.ts` | `category` query parameter filtering, intersection with sport filter |

### Integration Tests

| Test | Description |
|------|-------------|
| Scraper + real HTML fixture | Full pipeline: load HTML fixture -> scrape -> validate structured output |
| Scraper config validation | Reject invalid configs (missing required selectors, invalid type) |
| End-to-end youth item flow | Scrape -> moderate -> insert -> query via API with category filter |

### E2E Tests (Playwright)

| Test | Flow |
|------|------|
| Youth filter chip | Load home, click "Youth Leagues" chip, verify API request includes `category=youth`, verify chip is visually active |
| Youth + sport intersection | Activate "Youth Leagues" + "Football", verify both filters applied |

### Manual Testing Checklist

- [ ] Run `POST /api/news/sources/youth/:id/test` against pilot source, verify preview results
- [ ] Activate pilot source, run `sync-youth-leagues.ts`, verify items in database
- [ ] Open web app, click "Youth Leagues" chip, verify youth content appears
- [ ] Open mobile app, verify "Ligas Juveniles" chip works
- [ ] Verify youth items have age-adapted summaries generated
- [ ] Verify youth items pass content moderation
- [ ] Check structured logs for scraper metrics
- [ ] Test with federation site down (timeout handling)
- [ ] Test with changed HTML structure (graceful degradation)

---

## 8. Rollout Plan

### Phase A: Infrastructure (Days 1-4)

1. Add `scraperConfig` field to `RssSource` (Prisma migration)
2. Add `category` field to `NewsItem` (Prisma migration)
3. Install `cheerio` dependency
4. Implement `youth-league-scraper.ts` with unit tests
5. Extract `processNewsItem()` from `aggregator.ts`

### Phase B: Integration (Days 5-8)

1. Implement `sync-youth-leagues.ts` cron job
2. Add `category` query parameter to `GET /api/news`
3. Implement admin endpoints (`POST /api/news/sources/youth`, test endpoint)
4. Configure pilot source (RFAF) with validated selectors
5. Integration tests

### Phase C: UI (Days 9-11)

1. Add i18n keys to `en.json` and `es.json`
2. Add "Youth Leagues" chip to web FiltersBar
3. Add "Ligas Juveniles" chip to mobile FiltersBar
4. Add "Youth" badge to NewsCard (web + mobile)
5. E2E tests for filter chip

### Phase D: Polish (Days 12-14)

1. Run pilot source sync, validate content quality
2. Tune scraper selectors based on real RFAF HTML
3. Update CLAUDE.md with new category, cron job, and endpoint documentation
4. Update docs/ (ES + EN) with youth league feature documentation
5. Manual QA pass

---

## 9. Future Considerations

- **More federations**: Once the scraper config system is proven, onboarding new federations is a configuration task, not a code change. Target: Federacion Madrilena, Catalana, Valenciana.
- **Youth basketball, athletics**: Same scraper infrastructure, different sources.
- **Coach/parent submission portal**: Allow club coaches to submit results via a simple form, bypassing scraping entirely.
- **"My League" dedicated screen**: If analytics show >20% of active users engage with youth content, build a standalone screen with standings, fixtures, and results tables.
- **B2B integration**: Youth league content is the hook for the "SportyKids Club" B2B plan. Clubs that see their league covered are natural partners.
- **Scraper monitoring dashboard**: Alert when a source returns 0 items for 3+ consecutive syncs (likely HTML structure change).

---

## 10. Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| `cheerio` | npm (new) | ~200KB, MIT, zero native deps. HTML parsing and CSS selector engine. |
| Federation website access | External | Must verify target sites allow scraping (check robots.txt, terms). |
| Existing services | Internal | `content-moderator.ts`, `classifier.ts`, `summarizer.ts`, `aggregator.ts` -- used as-is. |
| Prisma 6 | Internal | Two migrations: `scraperConfig` on RssSource, `category` on NewsItem. |

---

## 11. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Federation changes HTML structure | Scraper breaks silently | HIGH | Monitor 0-item syncs via structured logs. Test endpoint for quick validation. Config-only fix (update selectors). |
| Federation blocks scraping | No content from source | MEDIUM | Respectful rate limiting, clear User-Agent. Pursue formal data partnership agreement. |
| Low content volume from youth leagues | Feature feels empty | MEDIUM | Aggregate multiple federations. Supplement with Google News RSS for "futbol base" queries. |
| Cheerio cannot handle JavaScript-rendered pages | Scraper finds no content | LOW | Most federation sites are server-rendered. If SPA detected, fall back to Google News RSS for that federation. |
| Content moderation false positives on youth content | Legitimate content rejected | LOW | Monitor rejection rate for youth sources. If >5%, add youth-source allowlisting in moderator. |
