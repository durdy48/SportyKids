# Validation Report — Run 4 (post /t-review #1)

**Date**: 2026-04-02
**Branch**: mvp-to-product-6/post-launch-growth

## Summary

| Result | Count |
|--------|-------|
| PASS   | 27    |
| FAIL   | 0     |
| SKIP   | 0     |

## Re-run of original checks (1-14)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | LiveMatch model in schema | PASS | `model LiveMatch` at line 359 with all columns (externalEventId, homeTeam, awayTeam, homeScore, awayScore, progress, status, league, matchDate, sport, homeGoalDetails, awayGoalDetails, homeRedCards, awayRedCards, lastPolledAt, notifiedEvents) |
| 2 | GET /api/teams/:teamName/live endpoint | PASS | `routes/live.ts` line 14: `'/:teamName/live'` with GET handler |
| 3 | Insert + query test (response shape) | PASS | `routes/__tests__/live.test.ts` has `response shape matches LiveMatchData interface` test at line 130 |
| 4 | PUT live-scores preferences | PASS | `users.ts` line 234: `router.put('/:id/notifications/live-scores', requireAuth, ...)` |
| 5 | Cannot update other user | PASS | `users.ts` line 237: `if (req.auth?.userId !== userId)` owner check |
| 6 | Cron job registered | PASS | `index.ts` line 33: import + line 112: `startLiveScoresJob()` |
| 7-8 | Web NotificationSettings live toggles | PASS | Live score section with master toggle + per-event checkboxes (goals, matchStart, halfTime, matchEnd, redCards) |
| 9 | Web team page live banner | PASS | `team/page.tsx` imports and uses `getLiveMatch`, renders banner for live/half_time status |
| 10 | Mobile FavoriteTeam live banner | PASS | `FavoriteTeam.tsx` imports `getLiveMatch`, renders live banner with score and progress |
| 11 | i18n keys | PASS | Both `es.json` and `en.json` contain `push.live_*` (6 keys), `live_scores.*`, `live_notifications.*` |
| 12 | Event detection tests | PASS | 24/24 tests passed (`live-scores.test.ts`) |
| 13 | Schedule check tests | PASS | 7/7 tests passed (`schedule-check.test.ts`) |
| 14 | Push sender tests | PASS | 5/5 tests passed (`push-sender-live.test.ts`) |

## Appendix A checks (15-27)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 15 | TODO-1: Batch findMany + Map | PASS | `push-sender.ts` line 145-149: `prisma.parentalProfile.findMany({ where: { userId: { in: ... } } })` + `new Map(profiles.map(...))` |
| 16 | TODO-2: Web api.ts uses getAccessToken | PASS | `updateLiveScorePreferences` at line 586 imports `getAccessToken` and sets `Authorization: Bearer` header |
| 17 | TODO-3: Users grouped by locale | PASS | `push-sender.ts` lines 172-184: `localeGroups = new Map<string, string[]>()` groups eligible users by locale; lines 188-206 iterate per locale building localized payloads |
| 18 | WARN-1: No reverse match in isTrackedTeam | PASS | Line 71: `lower.includes(tracked)` — checks API name contains tracked name, NOT `tracked.includes(lower)` |
| 19 | WARN-2: halfTime in types + EVENT_TO_PREFERENCE | PASS | Types: `halfTime: boolean` in `LiveScorePreferences`; `live-scores.ts` line 236: `half_time: 'halfTime'` in EVENT_TO_PREFERENCE |
| 20 | WARN-3: teamName length > 100 check | PASS | `routes/live.ts` line 19: `if (teamName.length > 100)` |
| 21 | WARN-4: Zod schema with .strict() | PASS | `users.ts` line 232: `}).strict()` on `liveScorePreferencesSchema` |
| 22 | WARN-5: No hardcoded #FEF2F2/#FECACA in mobile | PASS | Grep found no matches for `#FEF2F2` or `#FECACA` in `FavoriteTeam.tsx` |
| 23 | WARN-6: vi.useFakeTimers in push-sender-live test | PASS | Line 117-118: `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-04-01T15:00:00Z'))` |
| 24 | SUG-1: processLivescoreEntry function | PASS | `jobs/live-scores.ts` line 90: `async function processLivescoreEntry(entry)` extracted, called at line 259 |
| 25 | SUG-2: parseDetailCount with aliases | PASS | `services/live-scores.ts` line 34: `parseDetailCount` + line 40: `parseGoalCount` alias + line 43: `parseRedCardCount` alias |
| 26 | SUG-3: U+2032 (prime) not U+2019 | PASS | Web: `{'\u2032'}` in team/page.tsx line 174; Mobile: `{'\u2032'}` in FavoriteTeam.tsx line 119. No U+2019 found. |
| 27 | Regression: full test suites + lint | PASS | API: 511/511, Web: 113/113, Mobile: 152/152, Lint: 0 warnings |

## Comparison with Run 3

Run 3 was the pre-review validation. All 14 original checks that passed in Run 3 continue to pass in Run 4. The 13 new Appendix A checks (15-27) introduced by the review all pass, confirming the review fixes were implemented correctly.

| Metric | Run 3 | Run 4 |
|--------|-------|-------|
| Original checks (1-14) | 14 PASS | 14 PASS |
| Appendix A checks (15-27) | N/A | 13 PASS |
| Total | 14/14 | 27/27 |

## Test Counts

| Suite | Tests | Files | Status |
|-------|-------|-------|--------|
| API | 511 | 46 | All passed |
| Web | 113 | 16 | All passed |
| Mobile | 152 | 18 | All passed |
| **Total** | **776** | **80** | **All passed** |
| Lint | — | — | 0 warnings |
