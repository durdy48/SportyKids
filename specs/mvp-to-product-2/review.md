# Code Review: Mobile Security & Moderation

## Summary

Pass with notes. All four features are implemented and functional with good test coverage (62 new tests). There are two issues that contradict the PRD specification: `disablekb` is set to `0` (disabled=off) instead of `1` (disabled=on), and the admin endpoint response shape differs from the PRD spec. Several minor items should be addressed before merging.

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| AC-1.1 | ErrorBoundary catches render errors, displays ErrorState with crash type | OK | Uses `KID_FRIENDLY_ERRORS.crash` and `t()` for i18n |
| AC-1.2 | Restart button clears error state | OK | `handleRestart` resets state to `{ hasError: false, error: null }` |
| AC-1.3 | Dev mode shows error message and stack trace | OK | Uses `__DEV__` check with fallback to `NODE_ENV` |
| AC-1.4 | Production mode hides stack trace | OK | Stack container only rendered when `isDev && this.state.error` |
| AC-1.5 | Sentry reporting via dynamic import | OK | `import('@sentry/react-native')` in `reportToSentry`, silent catch if unavailable |
| AC-1.6 | ErrorBoundary wraps entire app outside SafeAreaProvider | OK | In `App.tsx`, `<ErrorBoundary>` is the outermost component |
| AC-1.7 | i18n keys exist in es.json and en.json | OK | `kid_errors.crash_title`, `crash_message`, `restart` added to both |
| AC-1.8 | `crash` entry in KID_FRIENDLY_ERRORS | OK | Added to `packages/shared/src/constants/errors.ts` |
| AC-2.1 | expo-secure-store installed | OK | `"expo-secure-store": "^55.0.9"` in mobile package.json |
| AC-2.2 | secure-storage.ts exports required functions | Issue | Function names differ from PRD: `secureGetItem` instead of `getSecureItem`, `secureSetItem` instead of `setSecureItem`, `secureDeleteItem` instead of `deleteSecureItem`. Functionally equivalent. |
| AC-2.3 | auth.ts uses secure-storage for tokens | OK | All AsyncStorage calls replaced with secure-storage functions |
| AC-2.4 | Tokens migrated on first launch | OK | `migrateTokensToSecureStore` reads from AsyncStorage, writes to SecureStore, deletes old entries |
| AC-2.5 | Migration flag prevents repeated migration | OK | `sportykids_tokens_migrated` flag in AsyncStorage |
| AC-2.6 | Fallback to AsyncStorage if SecureStore unavailable | OK | Probe-based detection with fallback in all operations |
| AC-2.7 | Non-token data stays in AsyncStorage | OK | Only token keys are passed to `migrateTokensToSecureStore` |
| AC-2.8 | Migration called during app initialization | OK | `initSecureTokenStorage()` called in `useEffect` in `App.tsx` |
| AC-3.1 | youtube.ts exports buildYouTubeEmbedUrl and extractYouTubeVideoId | OK | Also exports `getYouTubePlayerVars` |
| AC-3.2 | Mobile URL contains rel=0, modestbranding=1, iv_load_policy=3, disablekb=1, playsinline=1, NOT fs=0 | Issue | **`disablekb` is set to `0` instead of `1`**. PRD requires `disablekb=1` to disable keyboard controls. |
| AC-3.3 | Web URL contains all mobile params PLUS fs=0 | Issue | Same `disablekb=0` issue. `fs=0` is correctly web-only. |
| AC-3.4 | autoplay=1 when autoplay: true | OK | Overrides mechanism works correctly |
| AC-3.5 | extractYouTubeVideoId handles all URL formats | OK | Handles watch, embed, youtu.be, shorts, and invalid URLs |
| AC-3.6 | Mobile VideoPlayer uses centralized utility | OK | Uses `getYouTubePlayerVars` and `extractYouTubeVideoId` from shared |
| AC-3.7 | Web VideoPlayer uses buildYouTubeEmbedUrl | OK | Both YouTube iframe src attributes use the shared utility |
| AC-3.8 | YouTube iframes have sandbox attribute | OK | `sandbox="allow-scripts allow-same-origin allow-presentation"` on all iframes |
| AC-3.9 | Shared utility re-exported from utils/index.ts | OK | Named exports plus type export for `YouTubePlatform` |
| AC-4.1 | ModerationResult includes 'pending' | OK | Type updated to `'approved' | 'rejected' | 'pending'` |
| AC-4.2 | Production + AI throws = pending | OK | Returns `{ status: 'pending', reason: 'moderation-unavailable' }` |
| AC-4.3 | Dev + AI throws = approved | OK | Returns `{ status: 'approved', reason: 'auto-approved: AI unavailable' }` |
| AC-4.4 | MODERATION_FAIL_OPEN=true = approved | OK | `shouldFailOpen()` checks this first |
| AC-4.5 | Batch follows same logic | OK | Uses `failOpenOrPending()` helper |
| AC-4.6 | parseModerationResponse follows same logic | OK | Uses `failOpenOrPending()` for unparseable/unknown |
| AC-4.7 | sync-feeds logs warning for stale pending | Issue | Threshold is 24h instead of PRD-specified 30 minutes. Functional but different from spec. |
| AC-4.8 | Admin endpoint exists with correct auth and shape | Issue | Response shape differs from PRD. PRD specifies flat `{ pending: [...], total, oldestPendingMinutes }`. Implementation returns `{ news: { count, items }, reels: { count, items }, totalPending }`. Missing: `summary` (truncated content), `pendingMinutes` per item, `oldestPendingMinutes`. Also no limit of 100 per request. Order is `desc` instead of PRD's `asc`. |
| AC-4.9 | requireRole accepts 'admin' | OK | Type updated to `'child' | 'parent' | 'admin'` |
| AC-4.10 | No Prisma migration needed | OK | String role field used as-is |
| AC-4.11 | Admin routes registered in index.ts | OK | `app.use('/api/admin', adminRouter)` |

## TODO: Critical Issues (must fix)

- [x] **packages/shared/src/utils/youtube.ts:17** -- `disablekb` is set to `'0'` (keyboard controls ENABLED) instead of `'1'` (keyboard controls DISABLED). The PRD explicitly requires `disablekb=1` to "disable keyboard shortcuts (prevents kids from navigating)". This is a child safety issue. Same value `0` is repeated at line 94 in `getYouTubePlayerVars`. Fix: change `disablekb: '0'` to `disablekb: '1'` on line 17, and `disablekb: 0` to `disablekb: 1` on line 94.

## TODO: Warnings (should fix)

- [x] **apps/api/src/routes/admin.ts:20-56** -- Response shape deviates from PRD specification. PRD specifies: flat `pending` array with `summary` (first 200 chars of content), `pendingMinutes` per item, `oldestPendingMinutes`, limit 100, order `createdAt ASC`. Implementation returns a different structure with `news`/`reels` split (which is arguably better), but is missing `summary`, `pendingMinutes`, `oldestPendingMinutes`, and the 100-item limit. The PRD is the contract for any future admin UI. Fix: add `content` to the select (truncated to 200 chars), compute `pendingMinutes` for each item, add `oldestPendingMinutes` to response, add `take: 100` to queries, change `orderBy` to `asc`.

- [x] **apps/api/src/jobs/sync-feeds.ts:83** -- Stale pending threshold is 24 hours, but PRD AC-4.7 specifies 30 minutes. The implementation notes acknowledge this as "24h" but the PRD says "30 minutes". Fix: change `STALE_PENDING_THRESHOLD_HOURS` to `0.5` or use minutes-based naming: `const STALE_PENDING_THRESHOLD_MINUTES = 30`.

- [x] **apps/mobile/src/components/ErrorBoundary.tsx:94** -- Hardcoded background color `'#F8FAFC'` instead of using `COLORS.background` from shared constants. Similarly lines 104 (`'#1E293B'`) and 109 (`'#6B7280'`) use hardcoded colors. This means the ErrorBoundary won't respect dark mode. Fix: use `COLORS` constants, or accept a `theme` prop. Note the PRD doesn't mandate dark mode support for the crash screen, but it's inconsistent with the rest of the app.

- [x] **apps/web/src/components/VideoPlayer.tsx:115** -- The non-YouTube iframe fallback (line 111-118) has `allowFullScreen` set to `true` (no `={false}`), while the YouTube iframe correctly has `allowFullScreen={false}`. The sandbox attribute is applied but `allowFullScreen` should also be `false` for consistency. Fix: change `allowFullScreen` to `allowFullScreen={false}` on line 115 for the generic iframe, or leave it as-is if non-YouTube iframes intentionally allow fullscreen.

- [x] **apps/mobile/src/components/__tests__/ErrorBoundary.test.tsx** -- Tests only verify static properties (class exists, `getDerivedStateFromError` exists, etc.) but do not test actual rendering or the restart flow. No test renders a `<ErrorBoundary>` with a throwing child component to verify it catches the error and shows the crash UI. The PRD testing section explicitly requires: "Test that a throwing child component renders ErrorState", "Test that the Restart button clears the error and re-mounts children". Fix: add render-based tests using `@testing-library/react-native` that wrap a throwing component in `<ErrorBoundary>` and verify the crash UI appears and the restart button works.

## TODO: Suggestions (nice to have)

- [x] **apps/api/src/routes/users.ts** -- Removed `requireAuth` import. The implementation notes mention this is a pre-existing unused import. Confirm that no route in this file actually needs `requireAuth` before removing. If it was previously used, this could be a regression.

- [x] **packages/shared/src/utils/youtube.ts:61** -- The video ID detection heuristic (`videoIdOrUrl.length === 11 && /^[a-zA-Z0-9_-]+$/.test(...)`) could produce false positives for 11-character strings that aren't video IDs. Consider documenting this as a known limitation or adding a comment explaining the tradeoff.

- [x] **apps/mobile/src/lib/secure-storage.ts:33** -- The SecureStore probe reads a key `__secure_store_probe__` on first use, which adds a small latency cost to the first secure storage operation. Consider running the probe during `migrateTokensToSecureStore` instead of lazily, since migration already runs at startup.

- [x] **apps/api/src/services/content-moderator.ts** -- The `shouldFailOpen` function reads `process.env` on every call rather than caching the result at module load time. This is fine for correctness (env vars could theoretically change) but could be noted as intentional.

- [x] **apps/mobile/vitest.setup.ts** -- The `extractYouTubeVideoId` mock re-implements the actual regex logic. If the real regex changes, the mock won't update. Consider importing the real function or using `vi.fn()` with passthrough.

## Technical Debt Assessment

The implementation is solid and well-structured. Test coverage is comprehensive for the API moderation logic (17 tests) and secure storage (14 tests), though the ErrorBoundary tests are surface-level and should include render-based assertions. The `disablekb=0` issue is a clear bug against the spec that affects child safety. The admin endpoint response shape deviation from the PRD is not blocking but will require alignment if an admin UI is built. The stale pending threshold difference (24h vs 30min) is a risk assessment decision that should be explicitly documented if intentional.

No dead code, unused imports, code duplication, injection risks, secrets in code, or N+1 queries were found. Type safety is good throughout with no use of `any`. The `secure-storage.ts` module is well-designed with proper fallback chains.

## Files Reviewed

- `apps/api/src/routes/admin.ts` -- Admin moderation endpoint. Response shape differs from PRD.
- `apps/api/src/__tests__/admin-moderation.test.ts` -- 5 tests. Good coverage of auth/role/query behavior.
- `apps/api/src/services/__tests__/content-moderator.test.ts` -- 17 tests. Thorough coverage of fail-open/fail-closed/override logic.
- `apps/mobile/src/components/ErrorBoundary.tsx` -- Class-based error boundary. Hardcoded colors.
- `apps/mobile/src/components/__tests__/ErrorBoundary.test.tsx` -- 7 tests. Surface-level, no render tests.
- `apps/mobile/src/lib/secure-storage.ts` -- SecureStore abstraction. Well-designed fallback chain.
- `apps/mobile/src/lib/__tests__/secure-storage.test.ts` -- 14 tests. Good coverage including migration edge cases.
- `packages/shared/src/utils/youtube.ts` -- YouTube utility. **disablekb=0 bug**.
- `packages/shared/src/utils/__tests__/youtube.test.ts` -- 19 tests. Good coverage but tests don't catch disablekb issue (no test asserts disablekb=1).
- `apps/api/src/index.ts` -- Admin route registration. Clean.
- `apps/api/src/jobs/sync-feeds.ts` -- Stale pending check. Threshold 24h vs PRD 30min.
- `apps/api/src/middleware/auth.ts` -- Added 'admin' to role type. Minimal, correct change.
- `apps/api/src/routes/users.ts` -- Removed unused `requireAuth` import.
- `apps/api/src/services/aggregator.ts` -- Updated to use shouldFailOpen(). Handles 'pending' status correctly.
- `apps/api/src/services/content-moderator.ts` -- Core fail-closed logic. Well-structured with `shouldFailOpen()` and `failOpenOrPending()` helpers.
- `apps/mobile/src/App.tsx` -- ErrorBoundary wrapping + token migration init. Correct placement.
- `apps/mobile/src/components/VideoPlayer.tsx` -- Uses centralized YouTube params. Clean integration.
- `apps/mobile/src/lib/auth.ts` -- All token ops use secure-storage. Clean migration.
- `apps/mobile/src/lib/__tests__/auth.test.ts` -- Updated to mock SecureStore instead of AsyncStorage.
- `apps/mobile/vitest.setup.ts` -- Added expo-secure-store and shared mocks.
- `apps/web/src/components/VideoPlayer.tsx` -- Uses buildYouTubeEmbedUrl + sandbox attribute. One inconsistency with allowFullScreen on non-YouTube iframe.
- `apps/web/src/__tests__/legal-pages.test.tsx` -- Test selector fixes (regex, getAllByText). Unrelated to this PRD but valid fixes.
- `packages/shared/src/constants/errors.ts` -- Added `crash` entry. Correct.
- `packages/shared/src/i18n/en.json` -- Added crash i18n keys. Correct.
- `packages/shared/src/i18n/es.json` -- Added crash i18n keys. Correct.
- `packages/shared/src/utils/index.ts` -- Re-exports YouTube utilities. Correct.
- `apps/mobile/package.json` -- Added expo-secure-store dependency.

## Verification

```
API:    44 test files, 464 tests passed
Web:    16 test files, 85 tests passed
Mobile: 14 test files, 103 tests passed
Total:  652 tests — all passing

Lint:   Clean (0 errors, 0 warnings)
```
