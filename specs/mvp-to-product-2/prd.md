# Mobile Security & Moderation — Product Requirements Document

**Phase**: MVP-to-Product 2
**Status**: Draft
**Date**: 2026-03-31

---

## Overview

Four independent security hardening improvements for the SportyKids mobile app and API. Each can be implemented and shipped independently. Together they close critical gaps: crash resilience, token security, child-safe video embeds, and production content safety.

---

## Problem Statement

1. **No crash boundary** — An unhandled JS exception anywhere in the React Native component tree kills the entire app. Kids see a white screen with no recovery path.
2. **Tokens stored in plaintext** — JWT access and refresh tokens live in AsyncStorage, which is unencrypted on-device. A compromised or rooted device exposes auth credentials.
3. **Unrestricted YouTube embeds** — YouTube iframes load with minimal parameters. Kids can navigate to related videos, see annotations, and enter fullscreen on web without parental awareness.
4. **Fail-open moderation** — When the AI provider is unreachable, all content is auto-approved. In production this means potentially unsafe articles reach children.

---

## Goals

| # | Goal | Metric |
|---|------|--------|
| 1 | Zero white-screen crashes for end users | ErrorBoundary catches 100% of render errors |
| 2 | JWT tokens encrypted at rest on mobile | Tokens in Keychain (iOS) / Keystore (Android) via expo-secure-store |
| 3 | YouTube embeds restricted to current video only | No related videos, no annotations, no keyboard nav, fullscreen control per platform |
| 4 | Unsafe content never auto-approved in production | AI failure -> content stays `pending` until retry or manual review |

---

## Target Users

- **Kids 6-14**: Primary app users. Must be protected from crashes, unsafe content, and unrestricted video navigation.
- **Parents**: Benefit from knowing the app is secure (token encryption) and that moderation is strict in production.
- **Admin (future)**: Can review pending moderation queue via new endpoint.

---

## Feature 1: React Native Error Boundary

### Description

A class-based React Error Boundary wraps the entire app component tree. When an unhandled render error occurs, instead of a white screen the child sees a kid-friendly error screen built with the existing `ErrorState` component. In development mode, the stack trace is also shown for debugging.

### Behavior

- Catches errors in the React component tree (render, lifecycle, constructors).
- Does NOT catch: event handlers, async code, or errors outside React. Those are handled by existing error handling.
- On catch:
  - Logs the error to Sentry if `@sentry/react-native` is available (dynamic import, no hard dependency).
  - Renders `ErrorState` with the new `crash` error type.
  - Shows a "Restart" button that calls `resetError()` to clear the boundary and re-mount the tree.
  - In `__DEV__` mode, additionally renders the error message and component stack in a scrollable monospace view below the ErrorState.

### UI Mockup — Production Mode

```
+------------------------------------------+
|                                          |
|                                          |
|                  (emoji)                 |
|                   🏟️                     |
|                                          |
|          Oh no! The game crashed!        |
|                                          |
|   Something unexpected happened.         |
|   Let's get back in the game!            |
|                                          |
|          +-------------------+           |
|          |     Restart       |           |
|          +-------------------+           |
|                                          |
|                                          |
+------------------------------------------+
```

### UI Mockup — Development Mode

```
+------------------------------------------+
|                                          |
|                  🏟️                      |
|          Oh no! The game crashed!        |
|   Something unexpected happened.         |
|   Let's get back in the game!            |
|          +-------------------+           |
|          |     Restart       |           |
|          +-------------------+           |
|                                          |
|  ┌─ Error Details ─────────────────────┐ |
|  │ TypeError: Cannot read property     │ |
|  │ 'map' of undefined                  │ |
|  │                                     │ |
|  │ Component Stack:                    │ |
|  │   in NewsList (at HomeFeed.tsx:42)  │ |
|  │   in HomeFeed (at AppNavigator)     │ |
|  │   in AppNavigator (at App.tsx:32)   │ |
|  └─────────────────────────────────────┘ |
+------------------------------------------+
```

### i18n Keys

Add to `kid_errors` namespace in both `es.json` and `en.json`:

**`en.json`:**
```json
"crash_title": "Oh no! The game crashed!",
"crash_message": "Something unexpected happened. Let's get back in the game!",
"restart": "Restart"
```

**`es.json`:**
```json
"crash_title": "Oh no, el partido se detuvo!",
"crash_message": "Algo inesperado ocurrio. Volvamos al juego!",
"restart": "Reiniciar"
```

### KID_FRIENDLY_ERRORS Entry

Add to `packages/shared/src/constants/errors.ts`:

```typescript
crash: {
  titleKey: 'kid_errors.crash_title',
  messageKey: 'kid_errors.crash_message',
  emoji: '\u{1F3DF}\uFE0F', // stadium
},
```

### Acceptance Criteria

- [ ] AC-1.1: When a component throws during render, the ErrorBoundary catches it and displays the `ErrorState` component with error type `crash`.
- [ ] AC-1.2: The "Restart" button clears the error state and re-mounts the component tree.
- [ ] AC-1.3: In `__DEV__` mode, the error message and component stack trace are displayed in a scrollable view below the ErrorState.
- [ ] AC-1.4: In production mode, no stack trace or error details are visible.
- [ ] AC-1.5: If `@sentry/react-native` is importable, the error is reported via `Sentry.captureException()`. If not available, it logs to `console.error` and continues.
- [ ] AC-1.6: The ErrorBoundary wraps the entire app at the top level of `App.tsx`, outside `SafeAreaProvider`.
- [ ] AC-1.7: The i18n keys `kid_errors.crash_title`, `kid_errors.crash_message`, and `kid_errors.restart` exist in both `es.json` and `en.json`.
- [ ] AC-1.8: The `crash` entry exists in `KID_FRIENDLY_ERRORS` in shared constants.

---

## Feature 2: JWT Tokens in expo-secure-store

### Description

Replace AsyncStorage with `expo-secure-store` for JWT token storage on mobile. SecureStore uses iOS Keychain and Android Keystore for hardware-backed encryption. Includes automatic one-time migration of existing tokens from AsyncStorage to SecureStore.

### API Surface — `secure-storage.ts`

The module must expose an AsyncStorage-compatible API so the migration in `auth.ts` is minimal:

```typescript
// apps/mobile/src/lib/secure-storage.ts

/**
 * Secure token storage using expo-secure-store.
 * Provides an AsyncStorage-compatible API for drop-in replacement.
 * Falls back to AsyncStorage if SecureStore is unavailable (e.g., Expo Go on some platforms).
 */

export async function getSecureItem(key: string): Promise<string | null>;
export async function setSecureItem(key: string, value: string): Promise<void>;
export async function deleteSecureItem(key: string): Promise<void>;

/**
 * One-time migration: moves tokens from AsyncStorage to SecureStore.
 * After successful migration, removes the old AsyncStorage entries.
 * Safe to call multiple times — no-ops if migration already done.
 */
export async function migrateTokensToSecureStore(): Promise<void>;
```

### Migration Flow

1. On app launch (in `App.tsx` or `auth.ts` initialization), call `migrateTokensToSecureStore()`.
2. For each key (`sportykids_access_token`, `sportykids_refresh_token`):
   - Read from AsyncStorage.
   - If a value exists, write it to SecureStore.
   - Delete from AsyncStorage.
3. Set a flag in AsyncStorage (`sportykids_tokens_migrated = 'true'`) to skip on subsequent launches.
4. If SecureStore write fails (e.g., device doesn't support it), keep tokens in AsyncStorage and log a warning. Do not crash.

### What Stays in AsyncStorage

Only JWT tokens move. These stay in AsyncStorage as before:
- `sportykids-user-id`
- `sportykids-locale`
- `sportykids-theme`
- `sportykids-favorites`
- Any other non-sensitive preferences

### Changes to `auth.ts`

Replace all `AsyncStorage.getItem`/`setItem`/`removeItem` calls for `ACCESS_TOKEN_KEY` and `REFRESH_TOKEN_KEY` with `getSecureItem`/`setSecureItem`/`deleteSecureItem` from `secure-storage.ts`. No other changes needed — the function signatures match.

### Acceptance Criteria

- [ ] AC-2.1: `expo-secure-store` is installed as a dependency in `apps/mobile/package.json`.
- [ ] AC-2.2: `secure-storage.ts` exports `getSecureItem`, `setSecureItem`, `deleteSecureItem`, and `migrateTokensToSecureStore`.
- [ ] AC-2.3: `auth.ts` uses `getSecureItem`/`setSecureItem`/`deleteSecureItem` for both `ACCESS_TOKEN_KEY` and `REFRESH_TOKEN_KEY` instead of AsyncStorage.
- [ ] AC-2.4: On first launch after upgrade, tokens are migrated from AsyncStorage to SecureStore and old entries are removed.
- [ ] AC-2.5: A migration flag (`sportykids_tokens_migrated`) in AsyncStorage prevents repeated migration attempts.
- [ ] AC-2.6: If SecureStore is unavailable (throws on `setItemAsync`), the module falls back to AsyncStorage for that key and logs a warning via `console.warn`. The app does not crash.
- [ ] AC-2.7: Non-token data (`sportykids-user-id`, `sportykids-locale`, `sportykids-theme`, `sportykids-favorites`) remains in AsyncStorage — untouched.
- [ ] AC-2.8: `migrateTokensToSecureStore()` is called during app initialization (before any auth operation).

---

## Feature 3: YouTube Embed Sandbox Parameters

### Description

Centralize YouTube embed URL construction in a shared utility. Add child-safety parameters that restrict navigation away from the intended video. The function is platform-aware: web gets additional restrictions.

### Shared Utility Signature

```typescript
// packages/shared/src/utils/youtube.ts

export type EmbedPlatform = 'web' | 'mobile';

export interface YouTubeEmbedOptions {
  videoId: string;
  platform: EmbedPlatform;
  autoplay?: boolean;  // default: false
}

/**
 * Builds a child-safe YouTube embed URL with restricted parameters.
 *
 * Common params (both platforms):
 *   rel=0            — no related videos at end
 *   modestbranding=1 — minimal YouTube branding
 *   iv_load_policy=3 — hide video annotations
 *   disablekb=1      — disable keyboard controls (prevents navigation)
 *   playsinline=1    — inline playback on mobile
 *
 * Web-only params:
 *   fs=0             — disable fullscreen button
 *
 * @returns Full embed URL string, e.g. "https://www.youtube.com/embed/VIDEO_ID?rel=0&..."
 */
export function buildYouTubeEmbedUrl(options: YouTubeEmbedOptions): string;

/**
 * Extracts a YouTube video ID from various URL formats.
 * Supports: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
 * Returns null if no valid ID found.
 */
export function extractYouTubeVideoId(url: string): string | null;
```

### Parameter Details

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `rel` | `0` | Prevents related videos from other channels at end of video |
| `modestbranding` | `1` | Reduces YouTube logo prominence |
| `iv_load_policy` | `3` | Hides video annotations/cards that link elsewhere |
| `disablekb` | `1` | Disables keyboard shortcuts (prevents kids from navigating) |
| `playsinline` | `1` | Prevents auto-fullscreen on iOS |
| `fs` | `0` | **Web only** — hides fullscreen button. Omitted on mobile because mobile fullscreen is handled by the native player. |
| `autoplay` | `0` or `1` | Passed through from options |

### Web iframe Sandbox Attribute

In addition to URL parameters, the web `VideoPlayer` must add a `sandbox` attribute to YouTube iframes:

```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-presentation"
  ...
/>
```

This prevents:
- Navigation away from the embed (`allow-top-navigation` is NOT included)
- Form submissions
- Popups

### Changes per File

**Mobile `VideoPlayer.tsx`**: In `getYouTubeEmbed()`, replace the hardcoded `playerVars` object with a call to `buildYouTubeEmbedUrl({ videoId, platform: 'mobile', autoplay: true })`. Since the mobile player uses the IFrame Player API (not a raw iframe URL), extract the query params from the built URL and pass them as `playerVars`. Alternatively, create a helper `getYouTubePlayerVars(platform)` that returns the params object directly — either approach is acceptable as long as the params are centralized.

**Web `VideoPlayer.tsx`**: Replace the inline `embedUrl` construction with `buildYouTubeEmbedUrl({ videoId, platform: 'web', autoplay: isPlaying })`. Add `sandbox="allow-scripts allow-same-origin allow-presentation"` to both YouTube iframe instances (the playing state iframe and the fallback iframe at the bottom of the file).

### Re-export

Add `export * from './youtube';` to `packages/shared/src/utils/index.ts` so it's available as `import { buildYouTubeEmbedUrl } from '@sportykids/shared'`.

### Acceptance Criteria

- [ ] AC-3.1: `packages/shared/src/utils/youtube.ts` exports `buildYouTubeEmbedUrl` and `extractYouTubeVideoId`.
- [ ] AC-3.2: `buildYouTubeEmbedUrl({ videoId: 'abc', platform: 'mobile' })` returns a URL containing `rel=0`, `modestbranding=1`, `iv_load_policy=3`, `disablekb=1`, `playsinline=1`, and does NOT contain `fs=0`.
- [ ] AC-3.3: `buildYouTubeEmbedUrl({ videoId: 'abc', platform: 'web' })` returns a URL containing all mobile params PLUS `fs=0`.
- [ ] AC-3.4: `buildYouTubeEmbedUrl({ videoId: 'abc', platform: 'web', autoplay: true })` includes `autoplay=1`.
- [ ] AC-3.5: `extractYouTubeVideoId` correctly extracts IDs from `youtu.be/ID`, `youtube.com/watch?v=ID`, and `youtube.com/embed/ID` formats. Returns `null` for invalid URLs.
- [ ] AC-3.6: The mobile `VideoPlayer.tsx` uses the centralized utility for YouTube embed parameters instead of hardcoded values.
- [ ] AC-3.7: The web `VideoPlayer.tsx` uses `buildYouTubeEmbedUrl` for all YouTube iframe `src` attributes.
- [ ] AC-3.8: All YouTube iframes in web `VideoPlayer.tsx` have the `sandbox="allow-scripts allow-same-origin allow-presentation"` attribute.
- [ ] AC-3.9: The shared utility is re-exported from `packages/shared/src/utils/index.ts`.

---

## Feature 4: Fail-Closed Content Moderation in Production

### Description

Change the content moderator's error handling so that in production, AI failures cause content to remain in `pending` status instead of being auto-approved. Add monitoring for stale pending content and an admin endpoint to view the pending queue.

### Behavior Matrix

| Environment | AI succeeds | AI fails |
|-------------|------------|----------|
| `NODE_ENV !== 'production'` | Use AI result | Approve (fail-open, current behavior) |
| `NODE_ENV === 'production'` | Use AI result | Return `pending` (fail-closed) |
| `MODERATION_FAIL_OPEN=true` | Use AI result | Approve (explicit override) |

### ModerationResult Type Change

The `ModerationResult.status` type changes from `'approved' | 'rejected'` to `'approved' | 'rejected' | 'pending'`:

```typescript
export interface ModerationResult {
  status: 'approved' | 'rejected' | 'pending';
  reason?: string;
}
```

The aggregator already writes `safetyStatus` to the database. Content with `status: 'pending'` will have `safetyStatus: 'pending'` in the NewsItem record. The existing news endpoint already filters by `safetyStatus: 'approved'`, so pending content is automatically excluded from the feed.

### Pending Content Monitoring

In the `sync-feeds` cron job, after syncing, count articles that have been `pending` for more than 30 minutes. If any exist, log a warning:

```
logger.warn({ count: N, oldestMinutesAgo: M }, 'Stale pending articles detected — AI moderation may be down');
```

This is a log-level alert only. No push notification or external alerting in this phase.

### Admin Endpoint

**`GET /api/admin/moderation/pending`**

Requires: `requireAuth` + `requireRole('admin')`.

The `requireRole` function in `apps/api/src/middleware/auth.ts` currently only accepts `'child' | 'parent'`. It must be updated to accept `'admin'` as well. The `role` field on the User model is already a String (not an enum), so no Prisma migration is needed. An admin user is created by manually setting `role = 'admin'` in the database.

Response shape:

```json
{
  "pending": [
    {
      "id": "clxx...",
      "title": "Article title",
      "summary": "First 200 chars of content...",
      "source": "RSS source name",
      "createdAt": "2026-03-31T10:00:00.000Z",
      "pendingMinutes": 45
    }
  ],
  "total": 12,
  "oldestPendingMinutes": 120
}
```

Query: all NewsItem records where `safetyStatus = 'pending'`, ordered by `createdAt ASC`. Limit 100 per request. The `summary` field is truncated to 200 characters. `pendingMinutes` is computed as `(now - createdAt) / 60000`.

### Route Registration

Create a new route file `apps/api/src/routes/admin.ts`. Register it in `apps/api/src/index.ts` under the `/api/admin` prefix.

### Environment Variable

| Variable | Default | Description |
|----------|---------|-------------|
| `MODERATION_FAIL_OPEN` | `undefined` | If `'true'`, forces fail-open even in production. For emergencies only. |

When `MODERATION_FAIL_OPEN=true`, the moderator behaves as it does today (approve on error) regardless of `NODE_ENV`.

### Acceptance Criteria

- [ ] AC-4.1: `ModerationResult.status` type includes `'pending'` as a valid value.
- [ ] AC-4.2: In production (`NODE_ENV=production`), when the AI client throws, `moderateContent()` returns `{ status: 'pending', reason: 'pending: AI unavailable' }`.
- [ ] AC-4.3: In development (`NODE_ENV !== 'production'`), when the AI client throws, `moderateContent()` returns `{ status: 'approved', reason: 'auto-approved: AI unavailable' }` (current behavior preserved).
- [ ] AC-4.4: When `MODERATION_FAIL_OPEN=true` is set, AI failures always return `approved` regardless of `NODE_ENV`.
- [ ] AC-4.5: The `moderateContentBatch()` function follows the same fail-open/fail-closed logic as `moderateContent()`.
- [ ] AC-4.6: The `parseModerationResponse()` function also follows the same logic for unparseable responses and unknown statuses.
- [ ] AC-4.7: The `sync-feeds` job logs a warning when there are NewsItem records with `safetyStatus = 'pending'` older than 30 minutes.
- [ ] AC-4.8: `GET /api/admin/moderation/pending` exists, is protected by `requireAuth` + `requireRole('admin')`, and returns the response shape documented above.
- [ ] AC-4.9: `requireRole()` in `apps/api/src/middleware/auth.ts` accepts `'admin'` in addition to `'child'` and `'parent'`.
- [ ] AC-4.10: No Prisma schema migration is required. The admin role uses the existing String `role` field.
- [ ] AC-4.11: The admin route file is registered in `apps/api/src/index.ts`.

---

## Technical Requirements

### Files to Create

| File | Purpose |
|------|---------|
| `apps/mobile/src/components/ErrorBoundary.tsx` | React class component Error Boundary |
| `apps/mobile/src/lib/secure-storage.ts` | SecureStore wrapper with migration logic |
| `packages/shared/src/utils/youtube.ts` | Centralized YouTube embed URL builder |
| `apps/api/src/routes/admin.ts` | Admin endpoints (moderation pending queue) |

### Files to Modify

| File | Changes |
|------|---------|
| `apps/mobile/src/App.tsx` | Wrap tree in `<ErrorBoundary>`, call `migrateTokensToSecureStore()` in useEffect |
| `apps/mobile/src/lib/auth.ts` | Replace AsyncStorage calls for tokens with secure-storage functions |
| `apps/mobile/src/components/VideoPlayer.tsx` | Use `buildYouTubeEmbedUrl` / centralized params in `getYouTubeEmbed()` |
| `apps/web/src/components/VideoPlayer.tsx` | Use `buildYouTubeEmbedUrl`, add `sandbox` attribute to YouTube iframes |
| `packages/shared/src/utils/index.ts` | Add `export * from './youtube'` |
| `packages/shared/src/constants/errors.ts` | Add `crash` entry to `KID_FRIENDLY_ERRORS` |
| `packages/shared/src/i18n/es.json` | Add `kid_errors.crash_title`, `kid_errors.crash_message`, `kid_errors.restart` |
| `packages/shared/src/i18n/en.json` | Add `kid_errors.crash_title`, `kid_errors.crash_message`, `kid_errors.restart` |
| `apps/api/src/services/content-moderator.ts` | Add `pending` to status type, implement fail-closed logic, respect `MODERATION_FAIL_OPEN` env var |
| `apps/api/src/middleware/auth.ts` | Expand `requireRole()` to accept `'admin'` |
| `apps/api/src/index.ts` | Register admin routes under `/api/admin` |
| `apps/api/src/jobs/sync-feeds.ts` | Add pending content age check after sync completes |

### Dependencies to Install

| Package | Workspace | Version |
|---------|-----------|---------|
| `expo-secure-store` | `apps/mobile` | Latest compatible with Expo SDK 54 |

No other new dependencies required.

---

## Implementation Decisions

### Why reuse ErrorState instead of a custom crash screen?

The `ErrorState` component already handles kid-friendly error display with i18n support, emoji, retry buttons, and theme-aware styling. Building a separate crash UI would duplicate effort and risk visual inconsistency. By adding a `crash` error type to the existing `KID_FRIENDLY_ERRORS` map, the ErrorBoundary gets full i18n and theming for free.

### Why a class component for ErrorBoundary?

React's `componentDidCatch` / `getDerivedStateFromError` lifecycle methods are only available in class components. There is no hooks-based equivalent. This is the standard React pattern.

### Why migrate tokens automatically instead of forcing re-login?

Kids (especially younger ones) may not remember login credentials. Parents set up accounts and walk away. Forcing a re-login after an app update would frustrate families and potentially lose anonymous users entirely. Silent migration preserves the session seamlessly.

### Why keep non-token data in AsyncStorage?

User preferences (locale, theme, favorites) are not security-sensitive. SecureStore has a ~2KB value limit on some platforms and is slower than AsyncStorage. Using it only for tokens keeps the security benefit without performance or size penalties.

### Why `fs=0` only on web?

On mobile, the native WebView container already controls the viewport. The fullscreen button in the YouTube embed on mobile activates the native fullscreen, which the parent app controls. On web, fullscreen escapes the parent page context, making it harder for parents to monitor. Disabling it on web keeps the video within the page layout.

### Why not `fs=0` on mobile but still `disablekb=1` everywhere?

Keyboard controls (`disablekb`) prevent kids from using keyboard shortcuts to skip to related content or navigate the player in unintended ways. This is relevant on both web (physical keyboards) and mobile (Bluetooth keyboards), so it applies everywhere.

### Why `sandbox` attribute on web iframes?

The `sandbox` attribute provides defense-in-depth beyond URL parameters. Even if YouTube changes their URL parameter behavior, the sandbox prevents the embed from navigating the parent page, opening popups, or submitting forms. The `allow-scripts allow-same-origin allow-presentation` permissions are the minimum needed for YouTube playback.

### Why fail-closed in production but fail-open in development?

In development, AI may not be running (especially with the default Ollama provider). Blocking all content would make local development impossible. In production, child safety is paramount — it's better to delay content than to show potentially unsafe articles. The `MODERATION_FAIL_OPEN` env var is the escape hatch for emergencies.

### Why `pending` instead of `rejected` on AI failure?

Rejected content implies a safety determination was made. Pending accurately represents "not yet moderated" — the content may be perfectly safe, we just can't confirm it yet. This distinction matters for the admin queue: pending items need review, rejected items have already been reviewed and found inappropriate.

### Why a log-level warning for stale pending content instead of push notifications?

This is the minimum viable monitoring. Push notifications for admins would require an admin user model, notification preferences, and delivery infrastructure. A structured log warning integrates with any existing log aggregation (Sentry, CloudWatch, etc.) without new infrastructure. More sophisticated alerting can be added in a future phase.

### Why no Prisma migration for the admin role?

The `role` field is already a String type, not an enum. Setting it to `'admin'` is a data operation, not a schema change. This keeps the change minimal and reversible — downgrading an admin is just a database update.

---

## Testing Decisions

### Feature 1: ErrorBoundary

- **Unit test**: Create `apps/mobile/src/components/__tests__/ErrorBoundary.test.tsx`.
  - Test that a throwing child component renders ErrorState with `crash` error type.
  - Test that the "Restart" button clears the error and re-mounts children.
  - Test that in `__DEV__` mode, the error message is displayed.
  - Test that Sentry reporting is attempted (mock the dynamic import).
  - Follow existing mobile test patterns (see `apps/mobile/src/components/__tests__/`).

### Feature 2: SecureStore

- **Unit test**: Create `apps/mobile/src/lib/__tests__/secure-storage.test.ts`.
  - Mock both `expo-secure-store` and `@react-native-async-storage/async-storage`.
  - Test `getSecureItem` / `setSecureItem` / `deleteSecureItem` delegate to SecureStore.
  - Test `migrateTokensToSecureStore` reads from AsyncStorage, writes to SecureStore, deletes from AsyncStorage, sets migration flag.
  - Test migration no-ops if flag already set.
  - Test fallback to AsyncStorage if SecureStore throws.
- **Unit test**: Update `apps/mobile/src/lib/__tests__/auth.test.ts` (if it exists) to verify tokens use secure-storage functions.

### Feature 3: YouTube Embed

- **Unit test**: Create `packages/shared/src/utils/__tests__/youtube.test.ts`.
  - Test `buildYouTubeEmbedUrl` with `platform: 'mobile'` includes expected params, excludes `fs=0`.
  - Test `buildYouTubeEmbedUrl` with `platform: 'web'` includes `fs=0`.
  - Test autoplay param.
  - Test `extractYouTubeVideoId` with all three URL formats plus invalid input.
- **Manual verification**: Confirm web iframes have `sandbox` attribute in browser DevTools.

### Feature 4: Fail-Closed Moderation

- **Unit test**: Update or create tests in `apps/api/src/services/__tests__/content-moderator.test.ts`.
  - Test that in production mode, AI error returns `{ status: 'pending' }`.
  - Test that in dev mode, AI error returns `{ status: 'approved' }`.
  - Test `MODERATION_FAIL_OPEN=true` overrides production to return `approved`.
  - Test batch moderation follows the same logic.
  - Test `parseModerationResponse` with unparseable input respects the mode.
- **Unit test**: Create `apps/api/src/routes/__tests__/admin.test.ts`.
  - Test 401 without auth.
  - Test 403 with non-admin role.
  - Test 200 with admin role returns pending items.
- **Integration test**: Verify sync-feeds logs warning for stale pending content (check logger.warn call).

### Test Patterns

- Use Vitest (the project's test runner).
- Mock external dependencies (AI client, SecureStore, Sentry) — do not make real API calls.
- Follow existing test file location conventions: `__tests__/` directory adjacent to source files.
- Run `npm run test:all` to ensure no regressions.

---

## Out of Scope

- **Admin dashboard UI** — The admin endpoint is API-only. No web or mobile UI for reviewing pending content.
- **Push notification alerting for stale content** — Only log-level warnings in this phase.
- **Retry queue for failed moderation** — Pending content is logged and viewable via API. Automatic retry is a future feature.
- **Encryption of non-token data** — Only JWT tokens move to SecureStore.
- **Web ErrorBoundary** — Next.js has its own `error.tsx` convention. This PRD covers mobile only.
- **Instagram/TikTok embed sandboxing** — Only YouTube embeds are sandboxed in this phase.
- **Admin user creation flow** — Admin users are created by manual DB update.
- **Rate limiting on admin endpoint** — Uses the default rate limit tier.

---

## Future Considerations

- **Admin dashboard** — Web UI for reviewing and acting on pending content (approve/reject from queue).
- **Moderation retry queue** — Background job that retries pending items every N minutes when AI comes back online.
- **Content expiry** — Auto-reject content that stays pending for more than X hours.
- **Biometric authentication** — Use expo-local-authentication alongside SecureStore for sensitive operations.
- **Web ErrorBoundary** — Add `error.tsx` files to Next.js App Router segments for consistent crash handling.
- **Video content moderation** — Extend fail-closed logic to the video aggregator (`sync-videos.ts`).
- **Admin role in Prisma enum** — If more role-based features are added, migrate `role` from String to a Prisma enum.
