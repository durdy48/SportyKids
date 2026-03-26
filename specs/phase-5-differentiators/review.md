# Code Review: Phase 5 Differentiators (M1-M6)

## Summary

Phase 5 adds six major features: AI content moderation & summaries (M1), gamification with stickers/streaks/achievements (M2), personalized feed ranking (M3), team stats hub (M4), vertical reels + configurable RSS sources (M5), and parental controls enforcement (M6). The implementation is well-structured overall, with good use of shared types, i18n, and graceful degradation when AI is unavailable. However, there are several critical issues around security (unprotected admin endpoints, missing auth on parental routes), data integrity (duplicate retry logic, unvalidated JSON parsing), and a few API contract mismatches between frontend and backend.

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| AI content moderation (fail-open) | M1 | Done | Moderator approves by default if AI is down |
| Age-adapted summaries (3 ranges x 2 locales) | M1 | Done | On-demand generation + background precomputation |
| Stickers (common/rare/epic/legendary) | M2 | Done | Full CRUD, random award, unique constraint |
| Streak tracking (daily login) | M2 | Done | UTC-day based, milestone bonuses |
| Achievements system | M2 | Done | Threshold-based evaluation, 9 achievement types |
| Personalized feed ranking | M3 | Done | Score-based: +5 team, +3 sport |
| Team stats hub (position, results, next match) | M4 | Done | TeamStats model + API endpoint |
| Configurable RSS sources (catalog + custom) | M5 | Done | Catalog browser, add/delete custom sources |
| Vertical reels player | M5 | Done | IntersectionObserver-based, autoplay active reel |
| Parental guard middleware | M6 | Done | Format, sport, and time-limit enforcement |
| Daily quiz generation (AI) | M2 | Done | Cron job + manual trigger, round-robin by sport |
| Notification preferences (UI only) | M5 | Done | Persisted in DB, marked as "coming soon" |
| Collection page (stickers + achievements) | M2 | Done | Tabs, sport filter, progress bar |
| Feed mode toggle (headlines/cards/explain) | M3 | Done | Persisted in localStorage |
| bcrypt migration for PIN | M6 | Done | Transparent SHA-256 -> bcrypt migration |

## TODO: Critical Issues (must fix)

- [x] **apps/api/src/routes/quiz.ts:190** — `POST /api/quiz/generate` has no authentication or authorization. Anyone can trigger expensive AI quiz generation. Add parental PIN verification or admin-only auth.

- [x] **apps/api/src/routes/news.ts:165** — `POST /api/news/fuentes/custom` has no authentication. Anyone can add RSS sources to the system. This is an SSRF vector: a malicious user could point the RSS parser at internal network URLs. Add user authentication and validate that the URL is a public domain.

- [x] **apps/api/src/routes/news.ts:229** — `DELETE /api/news/fuentes/custom/:id` has no authentication. Anyone can delete custom sources.

- [x] **apps/api/src/middleware/parental-guard.ts:5** — `profile` is typed as `any`. The cache stores the full Prisma model including the hashed PIN. If this cache leaks (e.g., through error serialization), the PIN hash is exposed. Type it properly and select only the fields needed (`allowedFormats`, `allowedSports`, `maxDailyTimeMinutes`).

- [x] **apps/api/src/middleware/parental-guard.ts:36** — `JSON.parse(profile.allowedFormats || '[]')` will throw on malformed JSON and crash the request (no try/catch). Same issue on line 49 with `allowedSports`. Wrap both in try/catch.

- [x] **apps/api/src/routes/parents.ts:370-378** — `formatProfile()` calls `JSON.parse()` on `profile.allowedSports`, `profile.allowedFeeds`, and `profile.allowedFormats` without try/catch. If any field contains malformed JSON, the entire route handler will throw a 500 error.

- [x] **apps/api/src/services/gamification.ts:265** — `JSON.parse(user.favoriteSports)` has no try/catch. If the field contains malformed JSON, `evaluateAchievements` will throw, potentially breaking the streak check-in flow.

- [x] **apps/web/src/lib/api.ts:244** — `getStreakInfo` calls `/api/gamification/streak/${userId}` but the backend route is `/api/gamification/streaks/${userId}` (plural). This will always return a 404.

- [x] **apps/api/src/services/team-stats.ts:17** — `JSON.parse(stats.recentResults)` and `JSON.parse(stats.nextMatch)` have no try/catch. Malformed JSON in the database will crash the endpoint.

## TODO: Warnings (should fix)

- [x] **apps/api/src/services/summarizer.ts:95-127** — Double retry logic: `generateSummary` does a manual retry (lines 102-126) on top of `AIClient.sendMessage` which already has 3 retries with exponential backoff. This means a single summary request could attempt up to 8 AI calls (4 in first try + 4 in retry). Remove the manual retry in the summarizer and rely on the AIClient's built-in retry.

- [x] **apps/api/src/routes/news.ts:98-113** — When `userPrefs` exist, the ranker fetches ALL matching news items into memory (`findMany` with no pagination), then sorts and slices. For large datasets this is an O(n log n) memory and CPU bottleneck. The comment acknowledges this but it should have a `take` limit (e.g., 500) as a safety valve.

- [x] **apps/api/src/middleware/parental-guard.ts:64-67** — Time-limit check fetches ALL activity logs for today. For active users this could be hundreds of rows. Use a `_sum` aggregation on `durationSeconds` instead of fetching all rows and summing client-side.

- [x] **apps/api/src/services/gamification.ts:191-203** — `awardSticker` fetches ALL stickers from the database, then filters in memory. With a large sticker catalog, this is wasteful. Use a `NOT IN` query or `WHERE id NOT IN (SELECT stickerId FROM UserSticker WHERE userId = ?)`.

- [x] **apps/api/src/services/gamification.ts:237-322** — `evaluateAchievements` runs 4 separate DB queries (user, activityLog.groupBy, userSticker.count, achievement.findMany + userAchievement.findMany) every time it is called. Since it runs on every activity log and every quiz answer, this is a potential N+1 hotspot. Consider caching or batching.

- [x] **apps/api/src/jobs/generate-daily-quiz.ts:197** — `startDailyQuizJob` is called from `sync-feeds.ts:22` which runs on every server start. If the server restarts frequently (common in dev), the cron expression `0 6 * * *` means quizzes are only generated once per day. The guard `if (activeJob)` prevents duplicate scheduling, which is correct. However, on first deploy, you may want an initial run-on-startup similar to `runManualSync`.

- [x] **apps/api/src/routes/parents.ts:14** — In-memory session store (`parentSessions`) will leak memory over time since expired sessions are never cleaned up. Add a periodic cleanup or use a WeakRef-based approach.

- [x] **apps/api/src/routes/parents.ts:176** — `if (maxDailyTimeMinutes)` is falsy when value is `0`, which means setting the time limit to "no limit" (0) will not persist. Use `maxDailyTimeMinutes !== undefined` instead.

- [x] **apps/web/src/components/NotificationSettings.tsx:94** — `checked={preferences.sports.length > 0 || true}` always evaluates to `true`. The checkbox is also `disabled` and has an empty `onChange`. This sports toggle is non-functional; either implement it or remove it.

- [x] **apps/web/src/components/StickerCard.tsx:50-59** — Direct DOM manipulation (`document.createElement`) inside an `onError` handler in React. This bypasses React's VDOM and can cause stale DOM or memory leaks. Use a state variable like `[imgError, setImgError]` to conditionally render the fallback.

- [x] **apps/web/src/components/ReelPlayer.tsx:63-65** — The `embedUrl` appends query params directly to `reel.videoUrl`. If the video URL already contains query params, this will produce a malformed URL (double `?`). Use `URL` constructor or check for existing params.

- [x] **apps/api/src/middleware/parental-guard.ts:28** — `req.baseUrl` may not contain the expected path segments depending on how Express mounts the router. For example, if `parentalGuard` is applied as middleware on a specific router (e.g., news router mounted at `/api/news`), `req.baseUrl` would be `/api/news`. But if it's applied globally, `req.baseUrl` could be empty. Verify this works as expected with the current mount structure.

- [x] **apps/web/src/app/collection/page.tsx:160-161** — Hardcoded emoji and text `"Stickers ({collected}/{totalStickers})"` instead of using i18n. Same pattern appears partially on line 170 (mixed i18n and hardcoded emoji).

- [x] **apps/api/src/services/content-moderator.ts:95** — The regex `\{[^}]+\}` will fail to extract JSON when the response contains nested objects (e.g., `{"status": "rejected", "reason": "contains {violence}"}`). Use a more robust extraction like `\{[\s\S]*\}` (which `quiz-generator.ts:86` already uses).

## TODO: Suggestions (nice to have)

- [x] **apps/api/src/services/ai-client.ts:59-80** — `SlidingWindowRateLimiter.timestamps` array grows unboundedly within each minute window. For very high RPM, consider using a fixed-size circular buffer or a token bucket algorithm.

- [x] **apps/api/src/services/ai-client.ts:162** — Dynamic `import('openai')` is called on every request. The result is not cached, so Node's module loader caches it at the engine level, but the `await import()` overhead adds unnecessary latency. Consider importing at module scope or caching the import result.

- [x] **apps/api/src/services/feed-ranker.ts:17** — `RankableItem` uses `[key: string]: unknown` index signature, which weakens type safety. Since the ranker is generic (`T extends RankableItem`), this is not strictly necessary and prevents type narrowing on the returned items.

- [x] **apps/web/src/lib/use-activity-tracker.ts:26-41** — The cleanup function in `useEffect` fires a `sendBeacon` request. In development with React Strict Mode, the effect runs twice (mount/unmount/mount), causing a spurious 0-2 second activity log on every page load. Consider guarding with a minimum duration > 2s (already done, but strict mode may cause false positive short durations).

- [x] **apps/api/src/routes/gamification.ts** — All GET routes for user-specific data (stickers, achievements, streaks) lack any auth. Any user can read another user's gamification data by guessing their ID. Low priority for MVP, but worth noting.

- [x] **apps/web/src/components/ReelCard.tsx:13-31** and **apps/web/src/components/ReelPlayer.tsx:14-35** — Duplicated `LIKES_KEY`, `getLikedReels()`, and `toggleLike()` logic. Extract into a shared hook or utility in `@/lib/reel-likes.ts`.

- [x] **apps/api/src/routes/quiz.ts:66** — `combined.sort(() => Math.random() - 0.5)` is not a uniform shuffle. Use Fisher-Yates for proper randomization. Same issue on line 75.

- [x] **apps/web/src/components/ParentalPanel.tsx:192** — `DAY_LABELS` is hardcoded in Spanish (`['L', 'M', 'X', 'J', 'V', 'S', 'D']`). Should use i18n or derive from `locale`.

- [x] **packages/shared/src/types/index.ts:183-191** — `CheckInResponse` type has `streak.currentStreak` / `streak.longestStreak` nested under a `streak` object, but the backend `checkAndUpdateStreak` in `gamification.ts:171` returns `currentStreak` / `longestStreak` at the top level. Type mismatch between shared type and actual API response.

- [x] **apps/api/src/index.ts** — The daily quiz cron job is started but never referenced in the main index. If the app needs graceful shutdown, the cron jobs should be tracked and stopped.

- [x] **apps/api/prisma/schema.prisma:93** — `QuizQuestion.ageRange` and `expiresAt` are optional, which means seed questions (pre-existing) don't have them. This is correct for backward compatibility but could benefit from a comment explaining the distinction between seed and generated questions.

- [x] **apps/web/src/app/team/page.tsx:35** — `fetchReels({ sport: undefined, limit: 20 })` fetches reels without a team filter, then filters client-side. The Reel model has a `team` field — pass it as a filter parameter to avoid fetching unrelated data.

## Technical Debt Assessment

This feature adds significant new functionality while maintaining backward compatibility. The most pressing technical debt items are:

1. **Authentication gap**: Multiple new endpoints (quiz generation, custom RSS sources, gamification) are completely unprotected. While the MVP has no real auth, these endpoints can be abused (SSRF via custom RSS, expensive AI calls via quiz generation).

2. **JSON parsing fragility**: At least 6 locations parse JSON from SQLite text fields without try/catch. A single corrupt row can crash entire features.

3. **API contract mismatch**: The streak endpoint URL differs between frontend (`/streak/`) and backend (`/streaks/`). The `CheckInResponse` shared type structure does not match the backend response. These will cause runtime failures.

4. **Memory concerns**: The feed ranker loads all matching news into memory for ranking, the parental guard fetches all daily logs for time checks, and the session store never cleans up expired sessions.

5. **Duplicated code**: Reel like/unlike logic is duplicated across two components. The retry logic in the summarizer duplicates what the AI client already provides.

The codebase follows project conventions well: code identifiers are in English, UI text uses i18n keys consistently, route naming follows the Spanish/English pattern documented in CLAUDE.md, and the shared package is used effectively for types and utilities.

## Files Reviewed

### New backend services
- `apps/api/src/services/ai-client.ts` — Multi-provider AI client with rate limiting. Well-structured.
- `apps/api/src/services/content-moderator.ts` — Content moderation with fail-open. JSON regex too narrow.
- `apps/api/src/services/summarizer.ts` — Age-adapted summaries. Redundant retry logic.
- `apps/api/src/services/quiz-generator.ts` — AI quiz generation with Zod validation. Clean.
- `apps/api/src/services/gamification.ts` — Streaks, stickers, achievements. Multiple unguarded JSON.parse calls.
- `apps/api/src/services/feed-ranker.ts` — Score-based ranking. Simple and correct.
- `apps/api/src/services/team-stats.ts` — Team stats retrieval. No error handling on JSON.parse.

### New backend routes/middleware/jobs
- `apps/api/src/middleware/parental-guard.ts` — Format/sport/time enforcement. Uses `any`, no JSON parse safety.
- `apps/api/src/routes/gamification.ts` — Stickers, achievements, streaks, check-in CRUD. No auth.
- `apps/api/src/routes/teams.ts` — Minimal team stats route. Clean.
- `apps/api/src/jobs/generate-daily-quiz.ts` — Daily quiz cron with round-robin. Well-designed.

### Modified backend files
- `apps/api/prisma/schema.prisma` — New models (NewsSummary, Sticker, Achievement, TeamStats, etc.). Clean schema.
- `apps/api/prisma/seed.ts` — Not fully read (too large), but referenced.
- `apps/api/src/index.ts` — Added gamification and teams routers. Clean.
- `apps/api/src/routes/news.ts` — Added moderation filter, ranker, summary endpoint, source catalog/custom. Unprotected custom source endpoints.
- `apps/api/src/routes/quiz.ts` — Added age filtering, daily quiz support, answer streak tracking. Unprotected generate endpoint.
- `apps/api/src/routes/parents.ts` — bcrypt migration, session tokens, activity detail, cache invalidation. Memory leak in session store. `maxDailyTimeMinutes=0` bug.
- `apps/api/src/routes/reels.ts` — Added parental guard. Minimal changes.
- `apps/api/src/routes/users.ts` — Added notification preferences endpoints. Clean.
- `apps/api/src/services/aggregator.ts` — Added moderation + summary generation on sync. Good fire-and-forget pattern.
- `apps/api/src/jobs/sync-feeds.ts` — Added daily quiz job start. Clean.

### New frontend components
- `apps/web/src/components/AgeAdaptedSummary.tsx` — Lazy-loaded summary with skeleton. Clean.
- `apps/web/src/components/StickerCard.tsx` — Sticker display with rarity styling. DOM manipulation in onError.
- `apps/web/src/components/StreakCounter.tsx` — Streak display. Clean.
- `apps/web/src/components/AchievementBadge.tsx` — Achievement display with locked state. Clean.
- `apps/web/src/components/RewardToast.tsx` — Auto-dismiss toast. Clean.
- `apps/web/src/components/FeedModeToggle.tsx` — Three-way toggle. Clean.
- `apps/web/src/components/HeadlineRow.tsx` — Compact news row. Clean.
- `apps/web/src/components/TeamStatsCard.tsx` — Team stats with results, scorer, next match. Clean.
- `apps/web/src/components/TeamReelsStrip.tsx` — Horizontal reel strip. Clean.
- `apps/web/src/components/ReelPlayer.tsx` — Full-screen reel player. Duplicated like logic.
- `apps/web/src/components/VerticalFeed.tsx` — IntersectionObserver-based vertical scroll. Clean.
- `apps/web/src/components/NotificationSettings.tsx` — Notification prefs. Broken sports checkbox.
- `apps/web/src/components/LimitReached.tsx` — Limit/block screen. Clean.
- `apps/web/src/lib/use-activity-tracker.ts` — sendBeacon activity tracker. Clean.
- `apps/web/src/app/collection/page.tsx` — Sticker/achievement collection page. Some hardcoded text.

### Modified frontend files
- `apps/web/src/components/OnboardingWizard.tsx` — Added step 5 (parental), source catalog step 4. Large component.
- `apps/web/src/components/NewsCard.tsx` — Added explain button + AgeAdaptedSummary. Clean.
- `apps/web/src/components/QuizGame.tsx` — Added daily quiz badge, related news link. Clean.
- `apps/web/src/components/ParentalPanel.tsx` — Full rewrite with tabs (profile/content/restrictions/activity/PIN). Hardcoded day labels.
- `apps/web/src/components/NavBar.tsx` — Added collection link, format-based visibility. Clean.
- `apps/web/src/components/ReelCard.tsx` — Enhanced with like/share, thumbnail extraction. Duplicated like logic.
- `apps/web/src/app/HomeFeedClient.tsx` — Added feed mode toggle, activity tracker. Clean.
- `apps/web/src/app/reels/page.tsx` — Grid-based reels page with sport filter. Clean.
- `apps/web/src/app/team/page.tsx` — Added team stats, reels strip. Fetches all reels then filters client-side.
- `apps/web/src/app/quiz/page.tsx` — Added age-based question filtering, daily quiz indicator. Clean.
- `apps/web/src/lib/api.ts` — Added 15+ new API functions. Streak endpoint URL mismatch.
- `apps/web/src/lib/user-context.tsx` — Added daily check-in, locale persistence. Clean.

### Shared package
- `packages/shared/src/types/index.ts` — 15+ new types. CheckInResponse structure mismatch with backend.
- `packages/shared/src/constants/index.ts` — Added STICKER_RARITIES, RARITY_COLORS. Clean.
- `packages/shared/src/i18n/index.ts` — Unchanged. Works well.
- `packages/shared/src/i18n/es.json` — All new keys present. Complete.
- `packages/shared/src/i18n/en.json` — All new keys present. Complete.
