# PRD: Google News RSS Ingestion for Missing Spanish Outlets

## 1. Overview

Several Spanish sports media outlets (Estadio Deportivo, Mucho Deporte, El Desmarque, El Correo de Andalucia) lack native RSS feeds, creating blind spots in SportyKids' Spanish-language content coverage. This feature leverages Google News RSS search as a zero-dependency workaround, adding these outlets through the existing RSS infrastructure with no code changes to the aggregator pipeline.

## 2. Problem Statement

SportyKids aggregates 74+ RSS sources across 8 sports, but coverage gaps exist for regional Spanish outlets that do not publish RSS feeds. These outlets cover local football clubs (Real Betis, Sevilla FC, Malaga CF) and general sports that are relevant to kids in southern Spain -- a key demographic for the beta test. Currently, there is no way to ingest their content without building a custom scraper.

Google News indexes these sites and exposes their articles via a standard RSS feed format (`https://news.google.com/rss/search?q=site:example.com+query&hl=es&gl=ES`). This feed is parseable by the existing `rss-parser` library with zero modifications to the aggregation pipeline.

## 3. Goals

- **G1**: Add 12-16 Google News RSS sources covering the 4 missing Spanish outlets across multiple sports.
- **G2**: Zero code changes to the aggregation pipeline -- seed additions only.
- **G3**: Google News sources are clearly identifiable via naming convention and category.
- **G4**: Deduplication works correctly (Google News GUIDs differ from direct RSS GUIDs).
- **G5**: Existing content moderation pipeline handles Google News articles automatically.

## 4. Target Users

| User | Impact |
|------|--------|
| Kids (6-14) in Spain | More Spanish-language sports content, especially from regional outlets |
| Parents | No impact -- moderation pipeline applies identically |
| System (aggregator) | New sources processed in the same cron cycle with existing code |

## 5. Core Features

### 5.1 Google News RSS Sources in Seed

Add new entries to the `initialSources` array in `apps/api/prisma/seed.ts` using Google News RSS URLs for each missing outlet.

#### 5.1.1 Source Naming Convention

Format: `"Google News: {Outlet} - {Sport}"`

Examples:
- `"Google News: Estadio Deportivo - Football"`
- `"Google News: El Desmarque - Football"`
- `"Google News: Mucho Deporte - General"`

This distinguishes Google News proxy sources from direct RSS feeds in the catalog UI and admin views.

#### 5.1.2 Category

All Google News sources use `category: "google_news"` to enable filtering and monitoring separate from direct RSS sources.

#### 5.1.3 Target Sources and URLs

**Estadio Deportivo** (estadiodeportivo.com) -- Seville-focused sports daily:

| Sport | Google News RSS URL |
|-------|-------------------|
| football | `https://news.google.com/rss/search?q=site:estadiodeportivo.com+futbol&hl=es&gl=ES` |
| basketball | `https://news.google.com/rss/search?q=site:estadiodeportivo.com+baloncesto&hl=es&gl=ES` |
| general | `https://news.google.com/rss/search?q=site:estadiodeportivo.com+deportes&hl=es&gl=ES` |

**Mucho Deporte** (muchodeporte.com) -- Andalusian sports portal:

| Sport | Google News RSS URL |
|-------|-------------------|
| football | `https://news.google.com/rss/search?q=site:muchodeporte.com+futbol&hl=es&gl=ES` |
| general | `https://news.google.com/rss/search?q=site:muchodeporte.com+deportes&hl=es&gl=ES` |

**El Desmarque** (eldesmarque.com) -- Multi-city Spanish sports outlet:

| Sport | Google News RSS URL |
|-------|-------------------|
| football | `https://news.google.com/rss/search?q=site:eldesmarque.com+futbol&hl=es&gl=ES` |
| basketball | `https://news.google.com/rss/search?q=site:eldesmarque.com+baloncesto&hl=es&gl=ES` |
| general | `https://news.google.com/rss/search?q=site:eldesmarque.com+deportes&hl=es&gl=ES` |

**El Correo de Andalucia** (elcorreoweb.es) -- Andalusian regional newspaper:

| Sport | Google News RSS URL |
|-------|-------------------|
| football | `https://news.google.com/rss/search?q=site:elcorreoweb.es+futbol&hl=es&gl=ES` |
| general | `https://news.google.com/rss/search?q=site:elcorreoweb.es+deportes&hl=es&gl=ES` |

**Total: 10 new sources** (can expand to 16 by adding tennis, padel, cycling queries per outlet).

#### 5.1.4 Seed Entry Format

Each source follows the existing `RssSourceSeed` interface:

```typescript
{
  name: 'Google News: Estadio Deportivo - Football',
  url: 'https://news.google.com/rss/search?q=site:estadiodeportivo.com+futbol&hl=es&gl=ES',
  sport: 'football',
  country: 'ES',
  language: 'es',
  description: 'Estadio Deportivo football coverage via Google News RSS',
  category: 'google_news',
}
```

### 5.2 Deduplication Handling

The existing aggregator deduplicates by `rssGuid`, which is derived from `item.guid || item.link` in `aggregator.ts` (line ~160).

**Google News behavior**:
- `item.guid` is a Google News internal ID (e.g., `https://news.google.com/rss/articles/CBMi...`)
- `item.link` redirects to the original article URL via a Google redirect

Since Google News GUIDs are unique per Google's indexing (not per-outlet), and the original outlet has no direct RSS, there is **no cross-source duplicate risk**. Two Google News queries for the same outlet but different sports may return the same article -- but the `rssGuid` (Google's internal ID) will be identical, so the existing `upsert` by `rssGuid` handles this correctly.

**Edge case**: If a direct RSS source is later added for one of these outlets, the same article could appear twice (different GUIDs: one from Google, one from the outlet's RSS). This is acceptable for Phase 1 and can be addressed in Phase 2 with URL-based dedup.

### 5.3 Content Moderation

No changes needed. The existing pipeline in `aggregator.ts` calls `moderateContent()` on every ingested article regardless of source. Google News articles pass through the same moderation flow.

### 5.4 Aggregator Compatibility

Google News RSS returns standard RSS 2.0 XML. The existing `rss-parser` configuration handles it without modifications:
- `item.title` -- article title (present)
- `item.link` -- redirect URL to original article (present)
- `item.guid` -- Google News internal ID (present)
- `item.pubDate` -- publication date (present)
- `item.content` / `item.contentSnippet` -- short excerpt (present, may be truncated)
- Images -- may not be present in Google News RSS enclosures; `extractImage()` falls back gracefully to empty string

## 6. UI Mockups (ASCII)

No UI changes required. Google News sources appear in the existing RSS catalog UI with their `"Google News: ..."` naming:

```
+--------------------------------------------------+
|  RSS Source Catalog                               |
+--------------------------------------------------+
|  [x] Marca - Football              general    ES |
|  [x] AS - Football                 general    ES |
|  [x] Google News: Estadio D. - FB  google_news ES|
|  [x] Google News: El Desmarque - FB google_news ES|
|  ...                                              |
+--------------------------------------------------+
|  Filter: [All] [general] [google_news] [league]  |
+--------------------------------------------------+
```

Parents and admins can toggle Google News sources on/off individually like any other RSS source.

## 7. Acceptance Criteria

### AC1: Seed Sources
- [ ] 10+ Google News RSS sources are added to `prisma/seed.ts`
- [ ] All sources use naming convention `"Google News: {Outlet} - {Sport}"`
- [ ] All sources use `category: "google_news"`
- [ ] All sources have `country: "ES"` and `language: "es"`
- [ ] Running `npx tsx prisma/seed.ts` upserts sources without errors

### AC2: Aggregation Works
- [ ] `sync-feeds` cron processes Google News sources alongside direct RSS sources
- [ ] Articles from Google News sources appear in `GET /api/news` responses
- [ ] `rssGuid` is populated with Google News internal ID
- [ ] No duplicate articles within the same outlet (dedup by `rssGuid` works)

### AC3: Content Moderation
- [ ] Google News articles pass through `moderateContent()` like all other articles
- [ ] Only `approved` articles are visible to children

### AC4: Catalog Display
- [ ] `GET /api/news/fuentes/catalogo` includes Google News sources
- [ ] Sources are identifiable by `category: "google_news"`
- [ ] Sources can be toggled active/inactive independently

### AC5: No Regressions
- [ ] Existing direct RSS sources continue to work unchanged
- [ ] No changes to `aggregator.ts` or any service file
- [ ] All existing tests pass

## 8. Technical Requirements

### 8.1 Files Modified

| File | Change |
|------|--------|
| `apps/api/prisma/seed.ts` | Add 10+ Google News RSS entries to `initialSources` array |

### 8.2 Files NOT Modified

| File | Reason |
|------|--------|
| `apps/api/src/services/aggregator.ts` | Google News RSS is standard RSS -- no parser changes needed |
| `apps/api/src/jobs/sync-feeds.ts` | Processes all active `RssSource` rows -- no changes needed |
| `apps/api/src/services/content-moderator.ts` | Already moderates all ingested content |
| `apps/api/src/services/classifier.ts` | Team detection works on article titles regardless of source |
| `apps/api/prisma/schema.prisma` | No schema changes -- `RssSource` model already supports all needed fields |

### 8.3 Google News RSS Limitations

| Limitation | Mitigation |
|-----------|-----------|
| Delayed indexing (minutes to hours) | Acceptable for a kids news app; not real-time critical |
| Google can change RSS format | Monitor via sync error logs; fallback to Phase 2 scraper |
| Rate limiting (unclear thresholds) | 30-min cron interval is conservative; 10 sources is low volume |
| Truncated content snippets | Existing `cleanSummary()` handles short text; AI summaries enrich content |
| Missing images | `extractImage()` returns empty string gracefully; NewsCard shows placeholder |
| Google redirect URLs in `item.link` | Links still work for users; original URL extractable if needed |

### 8.4 No New Dependencies

This feature requires zero new npm packages. The existing `rss-parser` handles Google News RSS natively.

## 9. Implementation Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Seed-only change | Google News RSS is standard RSS; aggregator handles it without code changes |
| Naming | `"Google News: {Outlet} - {Sport}"` | Clear provenance; distinguishable in catalog and logs |
| Category | `"google_news"` | Enables filtering, monitoring, and toggling as a group |
| Sports per outlet | 2-3 per outlet (football + general + optional) | Balances coverage with avoiding excessive Google News queries |
| Dedup strategy | Rely on existing `rssGuid`-based dedup | Google News GUIDs are unique; cross-source URL dedup deferred to Phase 2 |
| Images | Accept empty string fallback | Better than adding image-extraction logic for Google News redirect URLs |

## 10. Testing Decisions

### 10.1 New Tests

**File**: `apps/api/src/__tests__/google-news-rss.test.ts`

| Test | Description |
|------|-------------|
| `Google News RSS URLs are valid format` | Validate all Google News URLs in seed match expected pattern |
| `Google News sources use correct naming convention` | All entries starting with "Google News:" follow the `{Outlet} - {Sport}` format |
| `Google News sources use google_news category` | All Google News entries have `category: "google_news"` |
| `Google News sources have required fields` | All entries have `country`, `language`, `sport`, `description` |
| `No duplicate URLs in seed` | No two entries in `initialSources` share the same `url` |
| `rss-parser can parse Google News RSS format` | Integration test: fetch one Google News URL and verify `rss-parser` returns valid items with `guid`, `title`, `link`, `pubDate` |

### 10.2 Existing Tests

All existing tests must continue to pass. No test modifications needed since no source code changes outside of `seed.ts`.

### 10.3 Manual Validation

1. Run `npx tsx prisma/seed.ts` -- verify no errors
2. Run `POST /api/news/sincronizar` -- verify Google News sources appear in sync results
3. Check `GET /api/news?sport=football` -- verify articles from Google News sources appear
4. Check `GET /api/news/fuentes/catalogo` -- verify Google News sources listed with `google_news` category

## 11. Out of Scope

### 11.1 Phase 2: Cheerio Scraper (Future)

For outlets where Google News RSS proves unreliable, a direct HTML scraper is the long-term solution:

- **New service**: `apps/api/src/services/scraper.ts`
- **Per-source CSS selectors**: configurable title, summary, image, link selectors
- **New field on RssSource**: `ingestMethod: 'rss' | 'scraper' | 'api'` (default `'rss'`)
- **Integration**: `sync-feeds.ts` dispatches to `aggregator.ts` or `scraper.ts` based on `ingestMethod`
- **Dependency**: `cheerio` package (~200KB, no native deps)
- **Estimated effort**: 1-2 days

### 11.2 Phase 3: News API Aggregators (Future)

Paid APIs (NewsAPI.org, GNews.io, Mediastack) as fallback for comprehensive coverage:

- **New service**: `apps/api/src/services/news-api-client.ts`
- **Multi-provider abstraction**: similar to `ai-client.ts` pattern
- **`ingestMethod: 'api'`** on RssSource model

### 11.3 Not in Scope

- URL-based cross-source deduplication (Google News GUID vs future direct RSS GUID)
- Custom Google News query builder UI for parents
- Google News source auto-discovery
- Non-Spanish Google News sources (can be added later with `hl=en&gl=GB`)

## 12. Future Considerations

- **Monitoring**: Track Google News source sync success rates separately. If a source consistently returns 0 articles, alert or auto-disable.
- **Query tuning**: Google News search queries (`+futbol`, `+deportes`) may need refinement if results are too broad or too narrow. Consider sport-specific keywords per outlet.
- **Rate limits**: If Google starts rate-limiting, implement per-source backoff in the aggregator (would require a small code change to `aggregator.ts`).
- **URL normalization**: For Phase 2 dedup, extract the original article URL from Google News redirect links (`news.google.com/rss/articles/...` -> `estadiodeportivo.com/...`) to enable cross-source dedup.
- **Expansion**: The same Google News RSS pattern works for any outlet worldwide. Easy to add Portuguese, French, or Italian sports media with `hl=` and `gl=` parameters.
