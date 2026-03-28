# PRD: Enhanced Feed Algorithm

## 1. Overview

Enrich the existing feed ranking engine (`apps/api/src/services/feed-ranker.ts`) with frequency-weighted behavioral scoring, smooth temporal decay, configurable weight factors, diversity injection to prevent filter bubbles, and cache invalidation on new activity. This is a backend-only change with no UI modifications.

## 2. Problem Statement

The current feed ranker uses coarse step-function tiers for sport engagement (0/1/2/3/4 based on interaction count thresholds) and recency (0/1/2/3 based on hour buckets). This produces clustering where many items land in the same score tier, reducing effective personalization. Specifically:

- **Sport engagement is absolute, not relative.** A user who reads 25 football articles and 20 basketball articles gets identical maximum boost (4) for both sports, even though their preference clearly leans football.
- **Source affinity is untracked.** The `sourceEngagement` map in `getBehavioralSignals` is initialized but never populated -- it is always empty.
- **Recency is a step function.** An article published 2.9 hours ago scores 3 while one at 3.1 hours drops to 2 -- a cliff that misrepresents gradual freshness decay.
- **No diversity mechanism.** Users who read only football get a feed that reinforces the same content, missing the educational goal of exposing kids to multiple sports.
- **Cache is time-based only.** Behavioral signals are cached for 5 minutes regardless of new activity, so a child's immediate interactions are invisible to the ranker until the cache expires.

## 3. Goals

| ID | Goal | Metric |
|----|------|--------|
| G1 | Frequency-weighted sport scoring reflects proportional engagement | Sport with 60% of reads gets ~3x boost of sport with 20% of reads |
| G2 | Source affinity is tracked and influences ranking | Items from top-3 read sources receive measurable boost |
| G3 | Smooth recency curve eliminates score cliffs | Score is continuous function, no step discontinuities |
| G4 | Diversity injection prevents filter bubbles | Every Nth item comes from an under-represented sport |
| G5 | Cache invalidation on new activity keeps signals fresh | New activity log entry evicts stale behavioral cache |
| G6 | Backward compatibility -- existing feed order is not drastically disrupted | Existing test suite passes; top-ranked items stay top-ranked for equivalent signals |

## 4. Target Users

| User | Impact |
|------|--------|
| Kids (6-14) | More relevant feed ordering; exposure to sports they don't usually read (serendipity) |
| Parents | No direct impact -- parental controls and moderation are untouched |
| System (API) | Improved cache efficiency; more expressive ranking without additional DB queries |

## 5. Core Features

### 5.1 Frequency-Weighted Sport Scoring

Replace the current tier-based `sportBoost` with a proportional scoring function.

**Current behavior:**
```typescript
// Absolute thresholds: count >= 20 -> 4, >= 10 -> 3, >= 5 -> 2, >= 1 -> 1, else 0
export function sportBoost(sportEngagement: Map<string, number>, sport: string): number
```

**New behavior:**
```typescript
export function sportFrequencyBoost(
  sportEngagement: Map<string, number>,
  sport: string,
  maxScore: number = 5,
): number
```

Calculation:
1. Compute `totalInteractions` = sum of all values in `sportEngagement` map.
2. If `totalInteractions === 0`, return `0`.
3. Compute `frequency = sportEngagement.get(sport) / totalInteractions`.
4. Return `frequency * maxScore`.

Example: If a user has 30 football reads, 15 basketball reads, 5 tennis reads (total 50):
- Football: `(30/50) * 5 = 3.0`
- Basketball: `(15/50) * 5 = 1.5`
- Tennis: `(5/50) * 5 = 0.5`

Edge case: if a user has only interacted with one sport, that sport gets the full `maxScore`. This is acceptable -- the diversity injection (5.4) counterbalances the effect.

### 5.2 Source Affinity Tracking

Fix the currently empty `sourceEngagement` map in `getBehavioralSignals`.

**Data source:** Join `ActivityLog` entries (where `type = 'news_viewed'` and `contentId` is not null) with `NewsItem` to extract the source name for each viewed article.

**Implementation in `getBehavioralSignals`:**
```typescript
// After fetching activity logs, query news items for source names
const viewedContentIds = logs
  .filter(l => l.type === 'news_viewed' && l.contentId)
  .map(l => l.contentId!);

if (viewedContentIds.length > 0) {
  const viewedItems = await prisma.newsItem.findMany({
    where: { id: { in: viewedContentIds } },
    select: { id: true, source: true },
  });

  const sourceById = new Map(viewedItems.map(n => [n.id, n.source]));

  for (const contentId of viewedContentIds) {
    const source = sourceById.get(contentId);
    if (source) {
      const key = source.toLowerCase();
      sourceEngagement.set(key, (sourceEngagement.get(key) ?? 0) + 1);
    }
  }
}
```

The existing `sourceBoost` function (0-2 scale based on thresholds) remains unchanged -- it already handles the scoring correctly once the map is populated.

### 5.3 Exponential Recency Decay

Replace the step-function `recencyBoost` with a smooth exponential decay curve.

**Current behavior:**
```typescript
// < 3hrs = 3, < 12hrs = 2, < 24hrs = 1, else 0
export function recencyBoost(publishedAt: Date | string): number
```

**New behavior:**
```typescript
export function recencyDecay(publishedAt: Date | string, maxScore: number = 3, halfLifeHours: number = 12): number
```

Formula: `score = maxScore * Math.exp(-ageHours / halfLifeHours)`

| Age | Score (halfLife=12) |
|-----|---------------------|
| 0h | 3.00 |
| 1h | 2.76 |
| 3h | 2.33 |
| 6h | 1.82 |
| 12h | 1.10 |
| 24h | 0.41 |
| 48h | 0.05 |

This eliminates cliff edges while preserving the same general ranking behavior: very recent items score near 3, day-old items score near 0.

**Backward compatibility:** The old `recencyBoost` function is kept as a deprecated export for any external consumers but is no longer called internally.

### 5.4 Diversity Injection

After scoring and sorting, inject items from under-represented sports to prevent filter bubbles.

**Algorithm:**
1. After `rankFeed` produces the sorted array, identify the user's "dominant sports" (sports making up > 40% of their engagement).
2. Scan through the sorted results. Every `DIVERSITY_INTERVAL`th position (default: 5), check if the item at that position is from a dominant sport.
3. If yes, swap it with the next item in the list that belongs to a non-dominant sport.
4. If no non-dominant sport items remain, skip the injection.

**Constraints:**
- Diversity injection only applies when `BehavioralSignals` are provided (i.e., for logged-in users with history).
- The first 4 items are never touched -- the user's top-ranked content stays top-ranked.
- Items swapped for diversity keep their original score metadata (this is a positional reorder, not a re-score).
- `DIVERSITY_INTERVAL` is a configurable constant (not an env var).

**Example:** A user whose feed is 90% football:
- Positions 0-4: untouched (likely football).
- Position 5: if football, swap with next basketball/tennis/etc. item.
- Position 10: same logic.
- Result: roughly 1 in 5 items is a discovery item.

### 5.5 Weighted Score Combination

Replace the current linear addition of all signals with a weighted combination using configurable constants.

**New scoring formula:**
```typescript
const RANKING_WEIGHTS = {
  TEAM: 1.0,
  SPORT: 1.0,
  SOURCE: 1.0,
  RECENCY: 1.0,
  LOCALE: 1.0,
} as const;

finalScore =
  (teamBoost * RANKING_WEIGHTS.TEAM) +
  (sportFrequencyBoost * RANKING_WEIGHTS.SPORT) +
  (sourceBoost * RANKING_WEIGHTS.SOURCE) +
  (recencyDecay * RANKING_WEIGHTS.RECENCY) +
  (localeBoost * RANKING_WEIGHTS.LOCALE) +
  alreadyReadPenalty;  // penalty is not weighted -- always -8
```

Initial weights are all `1.0` (identical to current behavior). The weights exist as a named constant object at module scope so they can be tuned without code changes to the scoring logic.

**Note:** `alreadyReadPenalty` is intentionally unweighted. A read article should always be penalized regardless of weight configuration.

### 5.6 Cache Invalidation on New Activity

Add a function to invalidate the behavioral cache when a new activity is logged.

**Implementation:**
```typescript
export function invalidateBehavioralCache(userId: string): void {
  apiCache.invalidate(`behavioral:${userId}`);
}
```

**Call site:** Invoke `invalidateBehavioralCache(userId)` in the activity registration endpoint (`POST /api/parents/actividad/registrar`) and in any code path that creates an `ActivityLog` entry (news view tracking in `apps/api/src/routes/news.ts`).

The 5-minute TTL remains as the fallback expiry. The invalidation provides immediate freshness when the user actively interacts.

### 5.7 Data Model Changes

**None.** This feature operates entirely on existing data models (`ActivityLog`, `NewsItem`, `User`). No new tables, columns, or migrations are required.

### 5.8 BehavioralSignals Interface Update

The `BehavioralSignals` interface gains one optional field:

```typescript
export interface BehavioralSignals {
  sportEngagement: Map<string, number>;
  sourceEngagement: Map<string, number>;
  readContentIds: Set<string>;
  locale?: string;
  /** Total interactions across all sports (precomputed for frequency calculation) */
  totalInteractions?: number;
}
```

`totalInteractions` is precomputed in `getBehavioralSignals` to avoid recomputing it per item during scoring.

## 6. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC1 | `sportFrequencyBoost` returns proportional score: a sport with 60% of reads gets 3.0 (with maxScore=5) |
| AC2 | `sportFrequencyBoost` returns 0 when user has no interactions |
| AC3 | `sourceEngagement` map is correctly populated from `ActivityLog` + `NewsItem` join |
| AC4 | `recencyDecay` returns 3.0 for age=0h and approaches 0 for age >= 48h |
| AC5 | `recencyDecay` produces no discontinuities (monotonically decreasing) |
| AC6 | Diversity injection places a non-dominant sport item at every 5th position |
| AC7 | Diversity injection does not modify the first 4 items |
| AC8 | Diversity injection is a no-op when behavioral signals are absent |
| AC9 | `RANKING_WEIGHTS` object is exported and all weights default to 1.0 |
| AC10 | Calling `invalidateBehavioralCache(userId)` removes the cached entry |
| AC11 | All existing tests in `feed-ranker.test.ts` continue to pass |
| AC12 | New tests cover all 5 new/modified functions |

## 7. Technical Requirements

| Requirement | Detail |
|-------------|--------|
| File modified | `apps/api/src/services/feed-ranker.ts` |
| Test file modified | `apps/api/src/services/feed-ranker.test.ts` |
| Cache file | `apps/api/src/services/cache.ts` (no changes needed -- `invalidate` method already exists) |
| Routes touched | Activity registration paths where `ActivityLog` is created (add `invalidateBehavioralCache` call) |
| Runtime | Node >= 20, no new dependencies |
| Performance | `sportFrequencyBoost` is O(n) where n = number of sports in map (max 8). `recencyDecay` is O(1). Diversity injection is O(n) single pass over sorted results. No performance regression. |
| Backward compat | Old `sportBoost`, `sourceBoost`, `recencyBoost` functions remain exported (deprecated) for any external consumers |

## 8. Implementation Decisions

| Decision | Rationale |
|----------|-----------|
| Enrich existing `feed-ranker.ts`, do not replace | Minimal blast radius. All existing consumers continue to work. |
| Weights as module-level constant, not env vars | These are tuning parameters adjusted by developers, not deployment config. Env vars would add unnecessary indirection. |
| Diversity injection as post-sort pass, not scoring factor | A scoring-based approach would require negative boosts that are hard to tune. Post-sort positional swap is predictable and debuggable. |
| Keep old functions as deprecated exports | Prevents breaking any code that imports them directly (including external tests or scripts). |
| `halfLifeHours = 12` as default | Matches the current system's inflection point (12h = score 2 in old system, ~1.1 in new). Preserves similar ordering for day-old content. |
| `DIVERSITY_INTERVAL = 5` | One discovery item per 5 is a 20% serendipity rate -- enough to expose new sports without overwhelming the feed. |
| Source affinity via join query | Adds one DB query to `getBehavioralSignals`, but it runs at most once per 5 minutes (cached). The join uses indexed `id` lookups. |
| `totalInteractions` precomputed | Avoids summing the map on every item during scoring (up to 50+ items per feed page). |

## 9. Testing Decisions

All tests reside in `apps/api/src/services/feed-ranker.test.ts`.

### 9.1 New Test Cases

| Test Suite | Test Case | What It Verifies |
|------------|-----------|------------------|
| `sportFrequencyBoost` | Returns 0 for empty engagement map | Zero-interaction edge case |
| `sportFrequencyBoost` | Returns maxScore for single-sport user | 100% frequency = full boost |
| `sportFrequencyBoost` | Returns proportional scores for multi-sport user | 60/40 split produces 3.0/2.0 with maxScore=5 |
| `sportFrequencyBoost` | Returns 0 for a sport not in the map | Sport the user never interacted with |
| `recencyDecay` | Returns maxScore (3.0) for age = 0 | Freshest possible article |
| `recencyDecay` | Returns ~1.1 for age = 12h (halfLife) | Matches expected exponential value |
| `recencyDecay` | Returns near-zero for age = 48h | Old articles are effectively zero |
| `recencyDecay` | Is monotonically decreasing | Score at t+1 < score at t for any t |
| `diversity injection` | Swaps dominant sport at 5th position | Position 4 (0-indexed) becomes non-dominant |
| `diversity injection` | Does not modify first 4 items | Top items are untouched |
| `diversity injection` | No-op without behavioral signals | Feed order unchanged when signals absent |
| `diversity injection` | No-op when no non-dominant items available | Gracefully handles homogeneous feed |
| `RANKING_WEIGHTS` | All weights default to 1.0 | Exported constant has expected shape |
| `invalidateBehavioralCache` | Removes cached entry for user | Cache miss after invalidation |
| `backward compat` | Existing `rankFeed` tests pass with new scoring | No regression in feed ordering |

### 9.2 Test Strategy

- Unit tests for each pure function (`sportFrequencyBoost`, `recencyDecay`).
- Integration-level tests for `rankFeed` with the new scoring model.
- Mock `prisma` and `apiCache` as in the existing test file.
- Diversity injection tested via `rankFeed` output position assertions.

## 10. Out of Scope

| Item | Reason |
|------|--------|
| UI changes | Backend-only feature. Feed consumers receive the same response shape. |
| A/B testing framework | Future consideration. For now, weights are static constants. |
| Machine learning model | Over-engineering for current scale. Weighted heuristics are sufficient and interpretable. |
| Per-user weight customization | Weights are global tuning parameters, not user preferences. |
| Real-time signal streaming | Cache invalidation is sufficient for the current single-process architecture. |
| Redis migration | InMemoryCache invalidation works for single-process. Redis would be needed for multi-instance but that is separate work. |
| Reels/Quiz feed ranking | This PRD applies to news feed only. Reels and quiz have their own ranking logic. |

## 11. Future Considerations

- **A/B testing:** Once PostHog analytics is active, run experiments comparing weight configurations to optimize engagement.
- **Collaborative filtering:** Use aggregate user behavior ("kids who like football also like athletics") to improve diversity suggestions.
- **Time-of-day signals:** Kids may prefer different sports at different times (e.g., football after school, F1 on weekends). Temporal patterns could feed into scoring.
- **Engagement quality:** Weight by `durationSeconds` in `ActivityLog`, not just view count. A 30-second read is more signal than a 2-second bounce.
- **Per-age-range tuning:** Younger kids (6-8) may benefit from higher diversity injection; older kids (12-14) may prefer deeper personalization.
- **Weight auto-tuning:** Use click-through rates as a feedback signal to automatically adjust `RANKING_WEIGHTS` over time.
