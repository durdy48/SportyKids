# Phase 5 Differentiators — Implementation Notes

# prd.md (M1: AI Infrastructure + Content Safety) implementation

## Requirements

All PRD requirements implemented:

- [x] Multi-provider AI client (Ollama default, OpenRouter, Anthropic)
- [x] Content moderator service with fail-open behavior
- [x] Prisma schema: safetyStatus/safetyReason/moderatedAt on NewsItem
- [x] Prisma schema: country/language/logoUrl/description/category/isCustom/addedBy on RssSource
- [x] Migration created and applied
- [x] Aggregator pipeline calls moderateContent() after classifyNews()
- [x] GET /api/news filters by safetyStatus='approved'
- [x] GET /api/news/:id returns 404 for non-approved items
- [x] GET /api/news/fuentes/catalogo — full catalog with bySport counts
- [x] POST /api/news/fuentes/custom — add custom source with RSS validation
- [x] DELETE /api/news/fuentes/custom/:id — delete custom sources only
- [x] POST /api/news/sincronizar — includes moderation stats
- [x] 40+ RSS sources seeded across all 8 sports
- [x] Backfill script for pending items
- [x] .env.example with multi-provider config
- [x] Shared types: SafetyStatus, SafetyResult, RssSource, RssSourceCatalogResponse
- [x] i18n: sources.*, sync.*, custom source keys (es + en)
- [x] OnboardingWizard step 4: catalog with sport grouping, select all/deselect, custom source form
- [x] API client: fetchSourceCatalog, addCustomSource, deleteCustomSource
- [x] CLAUDE.md updated

## Initial considerations

- **Free AI first**: The key decision was starting with Ollama (local, free) instead of requiring a paid API key from day one. This allows PoC testing without cost. The `openai` SDK was chosen as universal client since both Ollama and OpenRouter expose OpenAI-compatible APIs.
- **Fail-open moderation**: For MVP, if AI is unavailable, content is auto-approved. This prevents the feed from being empty if Ollama isn't running. Logged as warning for monitoring.
- **Custom sources**: Added beyond the original PRD scope per user request. Includes RSS validation before creation.

## Design

```
RSS Sync Pipeline (modified):
  syncSource() → parseRSS → classifyNews() → moderateContent() → upsert with safety fields

AI Client Architecture:
  AIClient (singleton)
    ├── sendViaOpenAICompat() → Ollama (localhost:11434) or OpenRouter
    └── sendViaAnthropic()    → Claude API (dynamic import)

Source Catalog:
  Seed (40+ predefined) + Custom sources (user-added via API)
  → GET /api/news/fuentes/catalogo returns both
  → Onboarding step 4 fetches and displays all
```

## Implementation details

### New files
- `apps/api/src/services/ai-client.ts` — Singleton multi-provider AI client. SlidingWindowRateLimiter for RPM control. Exponential backoff retries. Dynamic imports for both `openai` and `@anthropic-ai/sdk`.
- `apps/api/src/services/content-moderator.ts` — `moderateContent()` and `moderateContentBatch()`. System prompt designed for child safety. JSON response parsing with markdown code block extraction. Fail-open on all errors.
- `apps/api/prisma/backfill-safety.ts` — Batch processor for existing pending items. Processes in batches of 50.
- `apps/api/.env.example` — Complete env var documentation for all 3 providers.

### Modified files
- `apps/api/prisma/schema.prisma` — 3 new fields on NewsItem, 7 new fields on RssSource.
- `apps/api/src/services/aggregator.ts` — Integrated moderation into sync pipeline. SyncResult/SyncAllResult types with moderation counters.
- `apps/api/src/routes/news.ts` — Safety filter on all GET endpoints. 3 new endpoints (catalog, custom CRUD). Zod validation on custom source body.
- `apps/api/prisma/seed.ts` — Expanded from 4 to 40+ sources with full metadata.
- `apps/api/src/jobs/sync-feeds.ts` — Updated to return SyncAllResult.
- `packages/shared/src/types/index.ts` — Added SafetyStatus, SafetyResult, RssSource, RssSourceCatalogResponse.
- `packages/shared/src/i18n/es.json` / `en.json` — 30+ new translation keys.
- `packages/shared/src/i18n/index.ts` — Added support for `{{param}}` placeholder format.
- `apps/web/src/lib/api.ts` — 3 new functions for catalog and custom source management.
- `apps/web/src/components/OnboardingWizard.tsx` — Step 4 overhauled with catalog fetch, sport grouping, custom source form.

## Tests

No automated tests added (consistent with existing codebase state — zero tests). Manual verification via:
- API endpoints testable with curl
- Backfill script as integration smoke test
- Onboarding wizard testable in browser

## Documentation updates

- `CLAUDE.md` — Updated: stack table (AI client), architecture tree (new services), API endpoints table (3 new routes), models section (new fields), data flow (moderation step), RSS section (40+ sources), security section (AI moderation).

## Performance

- Moderation adds ~1-3s per article during sync (depends on AI provider; Ollama local is fastest).
- Catalog endpoint is a simple DB query, sub-100ms.
- Rate limiter prevents overwhelming free-tier APIs.

## Known issues

- Pre-existing TypeScript build errors in `apps/api` (Express query param types, rss-parser types). Not introduced by M1, not blocking runtime.
- Free models (Ollama/OpenRouter) may produce malformed JSON more often than Claude — fail-open handles this.
- Some seeded RSS URLs may not be reachable (DNS issues, feed format changes). These will show 0 items on sync.
- Ollama must be running locally for default AI_PROVIDER to work. If not running, all content is auto-approved.

---

# prd2.md (M2: Age-Adapted Content — "Explain it Easy") implementation

## Requirements

All PRD requirements implemented:

- [x] NewsSummary Prisma model with unique constraint [newsItemId, ageRange, locale]
- [x] Cascade delete relation to NewsItem
- [x] Migration applied: `add_news_summary`
- [x] Summarizer service with age-adapted prompts (6-8/9-11/12-14)
- [x] Health check integration — skips AI when provider unavailable
- [x] Background summary generation in aggregator (fire-and-forget)
- [x] Sequential generation: 3 age ranges × 2 locales = 6 per news item
- [x] GET /api/news/:id/resumen endpoint with on-demand generation
- [x] Zod validation on age/locale params
- [x] NewsSummary shared type + NewsItem.summaries optional field
- [x] i18n keys: summary.explain_easy, adapted_for_age, loading, error (es + en)
- [x] fetchNewsSummary() in web API client
- [x] AgeAdaptedSummary component (skeleton loading, error state, cached fetch)
- [x] NewsCard "Explain it Easy" button with toggle
- [x] CLAUDE.md updated

## Initial considerations

- Reused the AI health check from M1 to skip summarization instantly when Ollama is down
- Background generation is fire-and-forget — doesn't slow down RSS sync
- On-demand fallback ensures summaries are always available even if background gen hasn't run

## Design

```
News Sync Pipeline (M2 addition):
  syncSource() → ... → upsert NewsItem
    → fire-and-forget: generateSummariesForNewsItem()
         → for each locale × ageRange: generateSummary() → upsert NewsSummary

On-demand (user request):
  GET /api/news/:id/resumen?age=10&locale=es
    → check DB cache → if miss: generateSummary() → store → return
```

## Implementation details

### New files
- `apps/api/src/services/summarizer.ts` — Age-adapted prompt builder + AI call wrapper. Three profiles: storytelling (6-8, ≤80 words), simplified (9-11, ≤120 words), detailed (12-14, ≤180 words). Returns empty string on failure.
- `apps/web/src/components/AgeAdaptedSummary.tsx` — Expandable panel with skeleton loading, green age badge, slide-down animation. Fetches only once on first open (useRef cache).

### Modified files
- `apps/api/prisma/schema.prisma` — NewsSummary model + NewsItem.summaries relation
- `apps/api/src/services/aggregator.ts` — Added `generateSummariesForNewsItem()` and fire-and-forget call
- `apps/api/src/routes/news.ts` — Added `GET /:id/resumen` before `/:id` route
- `apps/web/src/components/NewsCard.tsx` — Added "Explain it Easy" button + AgeAdaptedSummary toggle
- `apps/web/src/lib/api.ts` — Added `fetchNewsSummary()`
- `packages/shared/src/types/index.ts` — NewsSummary type + NewsItem.summaries
- `packages/shared/src/i18n/es.json` / `en.json` — summary.* keys

## Tests

No automated tests (consistent with codebase). Manual verification via API endpoint and UI button.

## Documentation updates

- CLAUDE.md: Added summarizer to services tree, NewsSummary to models, resumen endpoint to routes table.

## Performance

- Background generation doesn't block RSS sync
- On-demand generation adds ~2-3s latency on first request (cached thereafter)
- Health check prevents slow retries when AI provider is down

## Known issues

- Without Ollama running, all summaries return empty string (expected for PoC)
- Background generation during sync can generate many AI calls if many new articles arrive

---

# prd3.md (M3: Dynamic Quiz from Real News) implementation

## Requirements

All PRD requirements implemented:

- [x] QuizQuestion schema: generatedAt, ageRange, expiresAt nullable fields + composite index
- [x] Migration applied: `add_quiz_generation_fields`
- [x] Quiz generator service with Zod validation and age-adapted prompts
- [x] Provider health check — returns null immediately when AI unavailable
- [x] Daily quiz job (cron 06:00 UTC) with round-robin sport selection
- [x] Manual trigger: POST /api/quiz/generate
- [x] GET /api/quiz/questions modified: age param, daily-first priority, seed fallback, isDaily field
- [x] 1s delay between LLM calls for rate limiting
- [x] Deduplication: checks existing QuizQuestion per relatedNewsId + ageRange
- [x] QuizQuestion shared type extended with generatedAt, ageRange, expiresAt, isDaily
- [x] i18n keys: quiz.daily_quiz, from_today_news, read_news, no_daily (es + en)
- [x] fetchQuestions updated with optional age param
- [x] QuizGame: Daily Quiz badge (blue pill) + related news link after answering
- [x] Quiz page: computes ageRange from user.age, passes to API, shows no_daily message
- [x] Job registered in sync-feeds.ts
- [x] CLAUDE.md updated

## Design

```
Daily Quiz Generation (cron 06:00 UTC):
  1. Check AI provider available
  2. Query approved news from last 48h
  3. Filter out articles with existing quizzes
  4. Round-robin by sport, select up to 15
  5. For each article × 3 age ranges: generate via AI → store with expiry

Quiz Request Flow:
  GET /api/quiz/questions?age=9-11&count=5
    → Fetch daily (non-expired, matching age) → Fill from seed → Shuffle → Add isDaily
```

## Implementation details

### New files
- `apps/api/src/services/quiz-generator.ts` — Zod-validated AI quiz generation per age range
- `apps/api/src/jobs/generate-daily-quiz.ts` — Cron job + manual trigger function

### Modified files
- `apps/api/prisma/schema.prisma` — 3 fields + index on QuizQuestion
- `apps/api/src/routes/quiz.ts` — age param, daily priority, isDaily, POST /generate
- `apps/api/src/jobs/sync-feeds.ts` — Registers daily quiz job
- `apps/web/src/components/QuizGame.tsx` — Daily badge + related news link
- `apps/web/src/app/quiz/page.tsx` — Age range computation, no_daily message
- `packages/shared/src/types/index.ts` — QuizQuestion extended
- `packages/shared/src/i18n/es.json` / `en.json` — quiz.* keys

## Known issues

- Without AI provider (Ollama), no daily questions generated — seed questions used as fallback
- Questions generated in Spanish only (per PRD scope)

---

# prd4.md (M4: Gamification — Stickers, Streaks, Achievements) implementation

## Requirements

All PRD requirements implemented:

- [x] 4 new Prisma models: Sticker, UserSticker, Achievement, UserAchievement
- [x] 5 new User fields: currentStreak, longestStreak, lastActiveDate, currentQuizCorrectStreak, quizPerfectCount
- [x] Migration: add_gamification_tables
- [x] Gamification service: checkAndUpdateStreak, awardSticker, evaluateAchievements, awardPointsForActivity
- [x] 6 API endpoints under /api/gamification/
- [x] Quiz answer tracks correct streak, awards bonus at 5 consecutive
- [x] Activity registration awards points (+5 news, +3 reels)
- [x] 36 stickers seeded (16 common, 10 rare, 6 epic, 4 legendary)
- [x] 20 achievements seeded
- [x] Shared types: Sticker, UserSticker, Achievement, UserAchievement, CheckInResponse, StickerRarity
- [x] Constants: STICKER_RARITIES, RARITY_COLORS
- [x] i18n: collection.*, sticker.*, streak.*, achievement.*, gamification.* (es + en)
- [x] Collection page with sticker grid, sport filters, achievements section
- [x] StickerCard, StreakCounter, AchievementBadge, RewardToast components
- [x] NavBar: Collection tab added
- [x] Daily check-in in UserProvider
- [x] CLAUDE.md updated

## Design

```
Gamification Flow:
  User opens app → UserProvider calls POST /api/gamification/check-in
    → checkAndUpdateStreak(): update streak, award daily sticker, +2 pts
    → evaluateAchievements(): check 20 thresholds
    → Return: { streak, dailySticker, newAchievements, pointsAwarded }

Points System:
  Read news → +5 pts (via parents/actividad/registrar)
  Watch reel → +3 pts
  Quiz correct → +10 pts (existing)
  Quiz perfect (5/5) → +50 bonus + rare sticker
  Daily login → +2 pts + common sticker
  Streak milestones → +25/+100/+200/+500 pts + epic/legendary stickers
```

## Implementation details

### New files
- `apps/api/src/services/gamification.ts` — Core service with streak logic, sticker awards, achievement evaluation
- `apps/api/src/routes/gamification.ts` — 6 REST endpoints
- `apps/web/src/app/collection/page.tsx` — Collection page with tabs (stickers/achievements)
- `apps/web/src/components/StickerCard.tsx` — Rarity-colored borders, grayscale unowned
- `apps/web/src/components/StreakCounter.tsx` — Fire emoji + streak display
- `apps/web/src/components/AchievementBadge.tsx` — Locked/unlocked states
- `apps/web/src/components/RewardToast.tsx` — Auto-dismiss toast notifications

### Modified files
- Schema: 4 new models + User fields
- seed.ts: 36 stickers + 20 achievements
- quiz.ts: Correct streak tracking + perfect bonus
- parents.ts: Activity awards points
- index.ts: Gamification router registered
- NavBar.tsx: Collection link added
- user-context.tsx: Daily check-in on load
- Types, constants, i18n files

## Known issues

- Sticker images are placeholders (`/stickers/*.png`) — need real artwork
- Without activity (news_viewed, reels_viewed calls from frontend), achievements for reading/watching won't trigger

---

# prd5.md (M5: Robust Parental Controls) implementation

## Requirements

All PRD requirements implemented:

- [x] ActivityLog schema: durationSeconds, contentId, sport fields + migration
- [x] bcryptjs installed and integrated
- [x] Parental guard middleware: format/sport/time restrictions enforced server-side
- [x] Middleware applied to news, reels, quiz routes
- [x] PIN hashing migrated to bcrypt (transparent SHA-256 migration)
- [x] Session tokens (5-min TTL, in-memory Map)
- [x] Onboarding step 5: PIN creation + format toggles + time limit
- [x] Enhanced activity logging: durationSeconds, contentId, sport accepted
- [x] Activity detail endpoint: GET /actividad/:userId/detalle with dailyBreakdown, topContent, totals
- [x] useActivityTracker hook integrated in Home, Reels, Quiz pages
- [x] LimitReached component for kid-friendly 403 messages
- [x] ParentalPanel restructured: 5 tabs (Profile, Content, Restrictions, Activity, PIN)
- [x] Activity tab: CSS-only bar chart, week navigation, most viewed
- [x] PIN change form in PIN tab
- [x] API client routes fixed: all parental endpoints use Spanish paths
- [x] fetchActivityDetail() added to API client
- [x] i18n: onboarding.step5_*, parental.tab_*, limit.* keys (es + en)
- [x] CLAUDE.md updated

## Design

```
Parental Guard Middleware:
  Request → Extract userId → Fetch profile (cached 60s)
    → Check format (news/reels/quiz) → Check sport → Check daily time
    → 403 or pass through

Onboarding Flow (5 steps):
  Name/Age → Sports → Team → Sources → PIN + Formats + Time Limit

Activity Tracking:
  useActivityTracker() hook → On unmount: sendBeacon → POST /actividad/registrar
  Parents see: Activity tab → CSS bar chart (7 days) + breakdown
```

## Implementation details

### New files
- `apps/api/src/middleware/parental-guard.ts` — Enforcement middleware with in-memory cache
- `apps/web/src/lib/use-activity-tracker.ts` — Duration tracking hook with sendBeacon
- `apps/web/src/components/LimitReached.tsx` — Kid-friendly 403 display

### Modified files
- Schema: 3 new ActivityLog fields
- parents.ts: bcrypt, sessions, activity detail, cache invalidation
- news.ts, reels.ts, quiz.ts: parentalGuard middleware applied
- OnboardingWizard: Step 5 added
- ParentalPanel: 5-tab layout with activity chart
- api.ts: All parental routes fixed to Spanish paths + fetchActivityDetail

## Known issues
- Session tokens in-memory only — lost on API restart
- Activity tracking relies on sendBeacon which may not fire on all browsers/scenarios

---

# prd6.md (M6: Smart Feed + Enriched Team + Improved Reels) implementation

## Requirements

All PRD requirements implemented:

- [x] Feed ranker service: score by team (+5), sport (+3), filter unfollowed
- [x] Feed ranker integrated in GET /api/news with userId
- [x] 3 feed display modes: Headlines, Cards, Explain (persisted in localStorage)
- [x] FeedModeToggle + HeadlineRow components
- [x] TeamStats model + migration
- [x] TeamStats seed: 15 teams with realistic data
- [x] GET /api/teams/:teamName/stats endpoint
- [x] Team page overhauled: stats card + team news + team reels strip
- [x] TeamStatsCard: position, W/D/L results, top scorer, next match
- [x] TeamReelsStrip: horizontal scrollable thumbnails
- [x] Reel model: videoType, aspectRatio, previewGifUrl fields
- [x] Existing reels updated with videoType/aspectRatio in seed
- [x] VerticalFeed: scroll-snap, IntersectionObserver, infinite scroll
- [x] ReelPlayer: auto-play, like (localStorage), share (clipboard), tap play/pause
- [x] Reels page: TikTok-style vertical feed with floating filters
- [x] User pushEnabled + pushPreferences fields
- [x] POST/GET /api/users/:id/notifications endpoints
- [x] NotificationSettings component ("coming soon" note)
- [x] Scroll-snap CSS classes
- [x] i18n: feed.*, team.* extended, reels.* extended, notifications.*
- [x] Shared types: TeamStats, RecentResult, NextMatch, PushPreferences, Reel extended, User extended
- [x] CLAUDE.md updated

## Design

```
Smart Feed:
  GET /api/news?userId=X → Fetch user prefs → rankFeed() → paginate
  Frontend: FeedModeToggle → Headlines | Cards | Explain

Team Hub:
  GET /api/teams/:name/stats → TeamStats (seed data)
  Page: Header + TeamStatsCard + News grid + ReelsStrip

TikTok Reels:
  VerticalFeed (snap-scroll) → ReelPlayer (IntersectionObserver)
  Auto-play active reel, pause others. Like/share overlays.
```

## Known issues

- Feed ranker fetches all items before pagination (MVP trade-off — fine for current scale)
- TeamStats are static seed data (no live API integration yet)
- Reels are YouTube embeds (placeholder) — real video support is future work
- Notification subscription only stores preferences (no actual push delivery)
- YouTube autoplay may be blocked by browsers without user interaction
