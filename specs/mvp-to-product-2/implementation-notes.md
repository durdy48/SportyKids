# Mobile Security & Moderation -- Implementation Notes

## Overview

This PRD implements 4 features focused on mobile security hardening and content moderation improvements.

## Feature 1: React Native Error Boundary

### Files Created
- `apps/mobile/src/components/ErrorBoundary.tsx` -- Class-based error boundary component
- `apps/mobile/src/components/__tests__/ErrorBoundary.test.tsx` -- 7 tests

### Files Modified
- `packages/shared/src/constants/errors.ts` -- Added `crash` to `KID_FRIENDLY_ERRORS`
- `packages/shared/src/i18n/es.json` -- Added `kid_errors.crash_title`, `crash_message`, `restart`
- `packages/shared/src/i18n/en.json` -- Same keys in English
- `apps/mobile/src/App.tsx` -- Wrapped entire app in `<ErrorBoundary>`
- `apps/mobile/vitest.setup.ts` -- Added `KID_FRIENDLY_ERRORS` and `getErrorType` to shared mock

### Design Decisions
- Used `typeof __DEV__ !== 'undefined'` guard for `__DEV__` since vitest doesn't define it
- Sentry reporting is via `import('@sentry/react-native')` (dynamic import, no hard dep)
- Stack trace only shown when dev mode detected
- ErrorBoundary wraps the entire app, outside SafeAreaProvider

## Feature 2: JWT Tokens in expo-secure-store

### Files Created
- `apps/mobile/src/lib/secure-storage.ts` -- SecureStore abstraction with fallback
- `apps/mobile/src/lib/__tests__/secure-storage.test.ts` -- 14 tests

### Files Modified
- `apps/mobile/package.json` -- Added `expo-secure-store` dependency
- `apps/mobile/src/lib/auth.ts` -- Replaced all AsyncStorage calls with secure-storage equivalents
- `apps/mobile/src/lib/__tests__/auth.test.ts` -- Updated to mock expo-secure-store
- `apps/mobile/src/App.tsx` -- Added `initSecureTokenStorage()` call on startup
- `apps/mobile/vitest.setup.ts` -- Added `expo-secure-store` mock

### Design Decisions
- SecureStore availability is checked via a probe read on first use (cached)
- `secureDeleteItem` removes from BOTH stores to ensure no stale tokens
- Migration runs once (flagged in AsyncStorage as `sportykids_tokens_migrated`)
- If migration fails for one key, continues with the next
- `_resetSecureStoreCache()` exported for test use only

## Feature 3: YouTube Embed Sandbox Parameters

### Files Created
- `packages/shared/src/utils/youtube.ts` -- `extractYouTubeVideoId`, `buildYouTubeEmbedUrl`, `getYouTubePlayerVars`
- `packages/shared/src/utils/__tests__/youtube.test.ts` -- 19 tests

### Files Modified
- `packages/shared/src/utils/index.ts` -- Re-exports YouTube utilities
- `apps/web/src/components/VideoPlayer.tsx` -- Uses `buildYouTubeEmbedUrl('web')`, adds `sandbox` attr to all iframes, `allowFullScreen={false}` for YouTube
- `apps/mobile/src/components/VideoPlayer.tsx` -- Uses `getYouTubePlayerVars` and `extractYouTubeVideoId` from shared
- `apps/mobile/vitest.setup.ts` -- Added YouTube utility mocks to shared mock

### Design Decisions
- `buildYouTubeEmbedUrl` accepts either a video ID or full URL (auto-extracts)
- Web gets `fs=0` to disable fullscreen; mobile does not (native fullscreen is desirable)
- Sandbox attribute: `allow-scripts allow-same-origin allow-presentation` (minimum needed for YouTube playback)
- The mobile VideoPlayer still uses the YouTube IFrame Player API for error detection, but now uses centralized `getYouTubePlayerVars()` for the `playerVars` object

## Feature 4: Fail-Closed Content Moderation in Production

### Files Created
- `apps/api/src/routes/admin.ts` -- `GET /api/admin/moderation/pending` endpoint
- `apps/api/src/services/__tests__/content-moderator.test.ts` -- 17 tests
- `apps/api/src/__tests__/admin-moderation.test.ts` -- 5 tests

### Files Modified
- `apps/api/src/services/content-moderator.ts` -- `ModerationResult` now includes `'pending'` status; `shouldFailOpen()` function; fail-closed in production
- `apps/api/src/services/aggregator.ts` -- Updated catch block to use `shouldFailOpen()`; handles 'pending' status in result counting
- `apps/api/src/middleware/auth.ts` -- `requireRole()` accepts `'admin'` in addition to `'child'` and `'parent'`
- `apps/api/src/index.ts` -- Registered admin routes at `/api/admin`
- `apps/api/src/jobs/sync-feeds.ts` -- Added `checkStalePendingContent()` that warns when news items are pending > 24h

### Design Decisions
- `shouldFailOpen()` checks: `MODERATION_FAIL_OPEN=true` OR `NODE_ENV !== 'production'`
- In production, AI failure returns `{ status: 'pending', reason: 'moderation-unavailable' }`
- In dev/test, AI failure returns `{ status: 'approved', reason: 'auto-approved: AI unavailable' }` (same as before)
- The aggregator's own catch block also uses `shouldFailOpen()` for consistency
- Stale pending check runs after every sync cron cycle (every 30 min)
- Admin endpoint requires both `requireAuth` and `requireRole('admin')`

## Test Summary

| Package | New Tests | Total Tests |
|---------|-----------|-------------|
| API | 22 | 464 |
| Web | 0 | 85 |
| Mobile | 21 | 103 |
| Shared (youtube) | 19 | 19 |
| **Total** | **62** | **671** |

All tests pass. Lint clean.

---

## Code Review Fixes (t-review #1)

### Critical fix: disablekb=0 → disablekb=1
- `packages/shared/src/utils/youtube.ts` -- Fixed `disablekb: '0'` to `'1'` in URL builder and `0` to `1` in playerVars
- `packages/shared/src/utils/__tests__/youtube.test.ts` -- Added test asserting `disablekb=1`

### Admin endpoint PRD compliance
- `apps/api/src/routes/admin.ts` -- Rewrote to match PRD response shape: flat `pending` array with `summary`, `pendingMinutes`, `oldestPendingMinutes`, limit 100, order ASC
- `apps/api/src/__tests__/admin-moderation.test.ts` -- Updated tests for new shape

### Stale pending threshold
- `apps/api/src/jobs/sync-feeds.ts` -- Changed from 24h to 30 minutes per PRD spec

### ErrorBoundary improvements
- `apps/mobile/src/components/ErrorBoundary.tsx` -- Replaced hardcoded colors with `COLORS` constants from shared
- `apps/mobile/src/components/__tests__/ErrorBoundary.test.tsx` -- Added 3 render-based tests (normal child, throwing child, restart)

### Web VideoPlayer consistency
- `apps/web/src/components/VideoPlayer.tsx` -- Set `allowFullScreen={false}` on all iframes

### Minor fixes
- `packages/shared/src/utils/youtube.ts` -- Added comment documenting videoId heuristic tradeoff
- `apps/mobile/src/lib/secure-storage.ts` -- Added comment about lazy probe being intentional
- `apps/api/src/services/content-moderator.ts` -- Added comment about intentional env reading per-call
- `apps/mobile/vitest.setup.ts` -- Simplified `extractYouTubeVideoId` mock

### Updated test counts

| Package | Total Tests |
|---------|-------------|
| API | 465 |
| Web | 85 |
| Mobile | 105 |
| **Total** | **655** |

---

## Validation Run 2 Fixes

### Admin endpoint Prisma field fix
- `apps/api/src/routes/admin.ts` -- Changed `content` to `summary` in Prisma select (field `content` doesn't exist on `NewsItem` model; the correct field is `summary`)
- `apps/api/src/__tests__/admin-moderation.test.ts` -- Updated mock data from `content` to `summary`

### Mobile API client: JWT Authorization header
- `apps/mobile/src/lib/api.ts` -- Added `authFetch()` wrapper that attaches JWT `Authorization: Bearer` header to all API requests and auto-refreshes on 401. Replaced all `fetch()` calls with `authFetch()`. Previously, the mobile app stored JWT tokens correctly but never sent them in API requests, causing 401 errors on all authenticated endpoints.
