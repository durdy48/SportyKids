# PRD4: Production Readiness — OAuth Social Login & UX Polish

**Version**: 1.0
**Date**: 2026-03-28
**Status**: Draft
**Author**: Product Owner

---

## Overview

This PRD covers two production-readiness features for SportyKids: (1) OAuth social login via Passport.js for Google and Apple, and (2) nine minor UX polish items that have partial or complete backend implementations but need frontend wiring, integration, or verification. Together, these bring the app from MVP to a state suitable for broader beta testing and eventual App Store submission.

---

## Problem Statement

**OAuth**: Currently, SportyKids supports email/password and anonymous auth. Parents (the decision makers for install) expect frictionless signup. Google and Apple sign-in are industry standard for family apps. Apple Sign In is **mandatory on iOS** when any third-party login is offered. Without social login, conversion from app store page to active user will be significantly lower.

**UX Polish**: Nine sub-features were partially implemented during MVP phases 1-4 but lack the final UI wiring, integration, or verification needed for production readiness. These range from haptic feedback to schedule lock UI to kid-friendly error mapping. Each individually is small, but collectively they represent the gap between "works in demo" and "works for real families."

---

## Goals

1. **Reduce signup friction**: Parent can create an account with 2 taps (Google) or Face ID (Apple) instead of typing email + password.
2. **Meet App Store requirements**: Apple Sign In must exist if Google Sign In exists.
3. **Account linking**: Parents who sign up via social login can still link anonymous child profiles.
4. **Polish UX gaps**: All nine B-* backlog items reach production quality with no remaining "TODO" behavior.
5. **Maintain security posture**: All OAuth tokens verified server-side. No client-trusted tokens.

---

## Target Users

| Persona | Relevance |
|---------|-----------|
| **Parent (installer)** | Primary beneficiary of OAuth. Reduced friction means higher completion of onboarding. |
| **Child (6-14)** | Indirect beneficiary. Better error messages, haptics, pull-to-refresh, reading history, related articles improve daily UX. |

---

## Core Features

### Feature 7: OAuth / Social Login via Passport.js

#### 7.1 Google OAuth 2.0

**API Routes** (replace existing 501 stubs in `apps/api/src/routes/auth.ts`):

| Route | Purpose |
|-------|---------|
| `GET /api/auth/google` | Redirect to Google consent screen (web flow) |
| `GET /api/auth/google/callback` | Exchange authorization code for tokens, upsert user, issue JWT pair, redirect to frontend |
| `POST /api/auth/google/token` | **New** -- Mobile flow: receive Google ID token from Expo AuthSession, verify server-side, upsert user, return JWT pair |

**Web flow**:
1. User clicks "Sign in with Google" on login/register page.
2. Browser redirects to `GET /api/auth/google` which calls `passport.authenticate('google', { scope: ['profile', 'email'] })`.
3. Google shows consent screen.
4. Google redirects to `GET /api/auth/google/callback`.
5. Server exchanges code for tokens via `passport-google-oauth20` strategy.
6. Server calls `findOrCreateSocialUser('google', profile.id, profile.emails[0].value, profile.displayName)`.
7. Server issues JWT access + refresh tokens (same as email auth).
8. Server redirects to `GOOGLE_SUCCESS_REDIRECT_URL` (e.g., `http://localhost:3000/auth/callback?token=<accessToken>&refresh=<refreshToken>`) via query params.
9. Web frontend `apps/web/src/app/auth/callback/page.tsx` reads tokens from URL, stores them, redirects to home.

**Mobile flow**:
1. User taps "Sign in with Google" on Login/Register screen.
2. App uses `expo-auth-session` with Google provider to obtain an ID token client-side.
3. App sends ID token to `POST /api/auth/google/token`.
4. Server verifies ID token with Google's `tokeninfo` endpoint or `google-auth-library`.
5. Server calls `findOrCreateSocialUser(...)`, issues JWT pair, returns `AuthResponse`.
6. Mobile stores tokens in AsyncStorage via existing `storeTokens()`.

**Passport.js integration** (`apps/api/src/services/passport.ts` -- new file):

```typescript
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: process.env.GOOGLE_CALLBACK_URL!,
}, async (accessToken, refreshToken, profile, done) => {
  // findOrCreateSocialUser logic
  done(null, user);
}));
```

**Env vars**:
- `GOOGLE_CLIENT_ID` -- Google Cloud Console OAuth 2.0 client ID
- `GOOGLE_CLIENT_SECRET` -- Google Cloud Console OAuth 2.0 client secret
- `GOOGLE_CALLBACK_URL` -- Full callback URL (e.g., `http://localhost:3001/api/auth/google/callback`)
- `GOOGLE_SUCCESS_REDIRECT_URL` -- Frontend URL to redirect after success (e.g., `http://localhost:3000/auth/callback`)

#### 7.2 Apple Sign In

**API Routes** (replace existing 501 stubs):

| Route | Purpose |
|-------|---------|
| `GET /api/auth/apple` | Redirect to Apple authorization (web flow) |
| `POST /api/auth/apple/callback` | Apple uses POST for callback. Verify identity token, upsert user, issue JWT pair |
| `POST /api/auth/apple/token` | **New** -- Mobile flow: receive Apple identity token from `expo-apple-authentication`, verify server-side, return JWT pair |

**Web flow**:
1. User clicks "Sign in with Apple".
2. Server redirects to Apple authorization endpoint via `passport-apple`.
3. Apple shows consent. Apple POSTs to `/api/auth/apple/callback` (Apple always uses POST).
4. Server verifies identity token, extracts email + name (Apple only sends name on FIRST login).
5. Server calls `findOrCreateSocialUser('apple', sub, email, name)`.
6. Server redirects to frontend callback page with tokens.

**Mobile flow (iOS native)**:
1. User taps "Sign in with Apple".
2. App uses `expo-apple-authentication` for native Apple Sign In dialog.
3. App receives `identityToken` and `user` from Apple.
4. App sends to `POST /api/auth/apple/token`.
5. Server verifies identity token with Apple's public keys (JWKS at `https://appleid.apple.com/auth/keys`).
6. Server upserts user, issues JWT pair.

**Env vars**:
- `APPLE_CLIENT_ID` -- Apple Services ID (e.g., `com.sportykids.web`)
- `APPLE_TEAM_ID` -- Apple Developer Team ID
- `APPLE_KEY_ID` -- Key ID for the private key
- `APPLE_PRIVATE_KEY` -- `.p8` private key contents (escaped newlines in env)

**Important Apple quirks**:
- Apple only sends the user's name on the **first** authorization. Store it immediately.
- Apple's callback is always POST, not GET.
- The `sub` claim in the identity token is the stable user identifier.
- Apple requires a Services ID for web, which is different from the App ID.

#### 7.3 Data Model Changes

Add to `User` model in `apps/api/prisma/schema.prisma`:

```prisma
model User {
  // ... existing fields ...
  socialId  String?   // Provider's external user ID (Google sub, Apple sub)
  // authProvider already supports 'google' | 'apple'
}
```

Add a **non-unique** index on `socialId` for lookup:
```prisma
@@index([authProvider, socialId])
```

**Note**: `socialId` is NOT unique globally because two different providers could theoretically produce the same ID string. The combination of `(authProvider, socialId)` is the unique lookup key. Use a composite query: `prisma.user.findFirst({ where: { authProvider, socialId } })`.

**Migration**: `npx prisma migrate dev --name add_social_id`

#### 7.4 Shared Service: `findOrCreateSocialUser`

New function in `apps/api/src/services/auth-service.ts`:

```typescript
export async function findOrCreateSocialUser(
  provider: 'google' | 'apple',
  socialId: string,
  email: string | null,
  name: string,
  role: 'child' | 'parent' = 'parent',
): Promise<{ user: User; isNewUser: boolean }> {
  // 1. Check if user exists by socialId + provider
  let user = await prisma.user.findFirst({
    where: { authProvider: provider, socialId },
  });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { user, isNewUser: false };
  }

  // 2. Check if user exists by email (account linking)
  if (email) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Link social provider to existing account
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { socialId, authProvider: provider, lastLoginAt: new Date() },
      });
      return { user: updated, isNewUser: false };
    }
  }

  // 3. Create new user
  const newUser = await prisma.user.create({
    data: {
      name: name || 'User',
      age: 35, // Default for parent; child profiles are anonymous
      email,
      socialId,
      authProvider: provider,
      role,
      lastLoginAt: new Date(),
    },
  });
  return { user: newUser, isNewUser: true };
}
```

#### 7.5 Security Requirements

- **Server-side token verification**: Never trust ID tokens from mobile clients without verification.
  - Google: Use `google-auth-library` (`OAuth2Client.verifyIdToken`) or fetch `https://oauth2.googleapis.com/tokeninfo?id_token=TOKEN`.
  - Apple: Fetch JWKS from `https://appleid.apple.com/auth/keys`, verify JWT signature, check `iss`, `aud`, `exp` claims.
- **State parameter** (CSRF): For web redirect flows, generate a random `state` parameter, store in HTTP-only session cookie, validate on callback.
- **Nonce** (Apple): Generate a nonce, hash it (SHA256), send hashed nonce to Apple, verify the `nonce` claim in the returned identity token.
- **HTTPS only in production**: OAuth redirect URIs must use HTTPS. Google and Apple enforce this.
- **No password set for social users**: `passwordHash` remains `null` for social-only accounts.
- **Account upgrade**: An anonymous user can upgrade to a social account by calling a new `POST /api/auth/upgrade-social` endpoint (or reuse the existing `/upgrade` endpoint with a social token instead of password).

#### 7.6 Shared Types Update

In `packages/shared/src/types/index.ts`, add:

```typescript
export interface SocialAuthRequest {
  idToken: string;
  provider: 'google' | 'apple';
  name?: string; // Apple only sends name on first auth
}
```

Update `User` interface:
```typescript
export interface User {
  // ... existing fields ...
  socialId?: string;
}
```

#### 7.7 i18n Keys

Add to `packages/shared/src/i18n/es.json` under `"auth"`:
```json
"google_signin": "Iniciar sesion con Google",
"apple_signin": "Iniciar sesion con Apple",
"social_error": "No se pudo iniciar sesion. Intenta de nuevo.",
"account_linked": "Cuenta vinculada correctamente",
"social_email_conflict": "Ya existe una cuenta con ese email. Inicia sesion con tu metodo anterior."
```

Add to `packages/shared/src/i18n/en.json` under `"auth"`:
```json
"google_signin": "Sign in with Google",
"apple_signin": "Sign in with Apple",
"social_error": "Could not sign in. Please try again.",
"account_linked": "Account linked successfully",
"social_email_conflict": "An account with that email already exists. Sign in with your previous method."
```

---

### Feature 13: Minor Pending Product Owner Items

#### 13.1 B-UX7: Kid-Friendly Error Messages

**Current state**:
- `KID_FRIENDLY_ERRORS` defined in `packages/shared/src/constants/errors.ts` with types: `network`, `not_found`, `server`, `timeout`, `empty`, `offline`, `schedule_locked`, `generic`.
- `getErrorType(statusOrMessage)` maps HTTP codes/strings to error types.
- `ErrorState` component exists in both `apps/web/src/components/ErrorState.tsx` and `apps/mobile/src/components/ErrorState.tsx`.
- i18n keys exist under `kid_errors.*` in both `es.json` and `en.json`.
- `error-handler.ts` middleware at `apps/api/src/middleware/error-handler.ts` returns generic 500 errors.

**What needs to happen**:

1. **Enhance API error handler** (`apps/api/src/middleware/error-handler.ts`):
   - Return a machine-readable `code` field in every error response (e.g., `"network"`, `"not_found"`, `"server"`, `"timeout"`, `"rate_limited"`, `"schedule_locked"`, `"format_blocked"`, `"limit_reached"`).
   - Current middleware returns `{ error: string, code: 500 }`. Change `code` from numeric to a string error type that maps directly to `KID_FRIENDLY_ERRORS` keys.
   - Add new error types to `KID_FRIENDLY_ERRORS` for `rate_limited`, `format_blocked`, `limit_reached`, `unauthorized`.

2. **Add missing i18n keys** for new error types in both `es.json` and `en.json`:
   ```json
   "kid_errors": {
     "rate_limited_title": "Slow down, champion!",
     "rate_limited_message": "You're going too fast! Take a breather and try again in a moment.",
     "format_blocked_title": "Section locked!",
     "format_blocked_message": "This section isn't available right now. Ask your parents!",
     "limit_reached_title": "Time's up!",
     "limit_reached_message": "You've reached your time limit for today. Come back tomorrow for more sports!",
     "unauthorized_title": "Who are you?",
     "unauthorized_message": "You need to log in first. Ask your parents for help!"
   }
   ```
   (And corresponding Spanish translations.)

3. **Wire ErrorState in all data-fetching pages** (web + mobile):
   - Ensure every screen that fetches data (HomeFeed, Reels, Quiz, Collection, Team) passes the API error code to `ErrorState` via `getErrorType()`.
   - The `ErrorState` component already works -- this is about ensuring consistent error prop passing.

4. **Add `getErrorType` mapping for new codes**: Update `packages/shared/src/constants/errors.ts`:
   ```typescript
   if (statusOrMessage === 401) return 'unauthorized';
   if (statusOrMessage === 429) return 'rate_limited';
   ```
   And add string checks:
   ```typescript
   if (msg.includes('rate') || msg.includes('too many')) return 'rate_limited';
   if (msg.includes('limit_reached')) return 'limit_reached';
   if (msg.includes('format_blocked')) return 'format_blocked';
   if (msg.includes('schedule_locked')) return 'schedule_locked';
   ```

**Files to modify**:
- `apps/api/src/middleware/error-handler.ts`
- `packages/shared/src/constants/errors.ts`
- `packages/shared/src/i18n/es.json`
- `packages/shared/src/i18n/en.json`
- Verify integration in web/mobile screens

---

#### 13.2 B-UX8: Haptic Feedback on Mobile

**Current state**:
- `expo-haptics` installed in `apps/mobile/`.
- `haptics.ts` utility at `apps/mobile/src/lib/haptics.ts` exports `haptic(style)` with styles: `light`, `medium`, `heavy`, `success`, `warning`, `error`, `selection`.
- No screens currently call `haptic()`.

**What needs to happen**:

Add `haptic()` calls to these interaction points:

| Screen / Component | Event | Haptic Style | File |
|-------------------|-------|-------------|------|
| Quiz screen | Correct answer selected | `success` | `apps/mobile/src/screens/Quiz.tsx` |
| Quiz screen | Incorrect answer selected | `error` | `apps/mobile/src/screens/Quiz.tsx` |
| Collection screen | Sticker tapped (view detail) | `light` | `apps/mobile/src/screens/Collection.tsx` |
| Gamification check-in | Sticker awarded | `success` | wherever check-in response is handled |
| Gamification check-in | Achievement unlocked | `medium` | wherever check-in response is handled |
| Reels screen | Like button tapped | `light` | `apps/mobile/src/screens/Reels.tsx` |
| Mission screen | Reward claimed | `success` | wherever mission claim is handled |
| NavBar | Tab switch | `selection` | `apps/mobile/src/navigation/` |

**Implementation pattern**:
```typescript
import { haptic } from '../lib/haptics';

// On correct quiz answer:
haptic('success');

// On tab press:
haptic('selection');
```

**Files to modify**: All screens listed above in `apps/mobile/src/`.

---

#### 13.3 B-MP3: Pull-to-Refresh with Branding

**Current state**:
- `BrandedRefreshControl` component exists at `apps/mobile/src/components/BrandedRefreshControl.tsx`. Uses SportyKids blue/green/yellow colors.
- **Not integrated** in any scrollable screen.

**What needs to happen**:

Integrate `BrandedRefreshControl` in these screens:

| Screen | File | ScrollView type |
|--------|------|----------------|
| HomeFeed | `apps/mobile/src/screens/HomeFeed.tsx` | `FlatList` or `ScrollView` |
| Reels | `apps/mobile/src/screens/Reels.tsx` | `FlatList` |
| Collection | `apps/mobile/src/screens/Collection.tsx` | `ScrollView` or `FlatList` |
| Quiz | `apps/mobile/src/screens/Quiz.tsx` | `ScrollView` |

**Implementation pattern** for FlatList:
```tsx
import { BrandedRefreshControl } from '../components/BrandedRefreshControl';

const [refreshing, setRefreshing] = useState(false);
const handleRefresh = async () => {
  setRefreshing(true);
  await fetchData();
  setRefreshing(false);
};

<FlatList
  refreshControl={
    <BrandedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
  }
  // ...
/>
```

**i18n note**: The `BrandedRefreshControl` currently hardcodes the `title` prop as `'Refreshing...'`. Change to `t('buttons.loading', locale)` using the locale from context. This requires passing `locale` as a prop or consuming `useUser()` inside the component.

**Files to modify**:
- `apps/mobile/src/components/BrandedRefreshControl.tsx` (i18n fix)
- `apps/mobile/src/screens/HomeFeed.tsx`
- `apps/mobile/src/screens/Reels.tsx`
- `apps/mobile/src/screens/Collection.tsx`
- `apps/mobile/src/screens/Quiz.tsx`

---

#### 13.4 B-PT4: Schedule Lock UI (Bedtime Hours)

**Current state**:
- Backend COMPLETE: `ParentalProfile` has `allowedHoursStart` (default 0), `allowedHoursEnd` (default 24), `timezone` (default `'Europe/Madrid'`).
- `parental-guard.ts` middleware enforces schedule lock with timezone support.
- i18n keys exist: `schedule.title`, `schedule.start_time`, `schedule.end_time`, `schedule.timezone`, `schedule.all_day`.
- **No UI** exists in the parental panel to set these values.

**What needs to happen**:

Add a "Schedule Lock" section to the Restrictions tab of the parental panel.

**Web UI** (`apps/web/src/app/parents/page.tsx`, within the Restrictions tab):

```
+-------------------------------------------+
|  Schedule Lock                             |
|  ---------------------------------------- |
|  [x] Enable schedule                       |
|                                            |
|  Start time:  [ 07 ] : [ 00 ]             |
|  End time:    [ 21 ] : [ 00 ]             |
|                                            |
|  Timezone:    [ Europe/Madrid       v ]    |
|                                            |
|  Your child can use SportyKids from        |
|  7:00 to 21:00 (Europe/Madrid).            |
|                                            |
|  [ Save ]                                  |
+-------------------------------------------+
```

**Behavior**:
- When the toggle is OFF (default): `allowedHoursStart = 0`, `allowedHoursEnd = 24` (no restriction).
- When the toggle is ON: show hour pickers (0-23 for start, 1-24 for end).
- Hours are integers (0-24). No minute granularity.
- Timezone selector: a dropdown with common IANA timezones. Pre-populate a short list: `Europe/Madrid`, `Europe/London`, `Europe/Paris`, `Europe/Berlin`, `Europe/Rome`, `America/New_York`, `America/Chicago`, `America/Denver`, `America/Los_Angeles`, `UTC`.
- On save: `PUT /api/parents/profile/:userId` with `allowedHoursStart`, `allowedHoursEnd`, `timezone`.
- Parental panel is behind PIN verification so this is already protected.

**Mobile UI** (`apps/mobile/src/screens/ParentalControl.tsx`, within Restrictions tab):
- Same functionality. Use `Picker` or `ScrollPicker` for hours and timezone.

**i18n**: Add keys for:
- `schedule.enable`: "Enable schedule" / "Activar horario"
- `schedule.description`: "Your child can use SportyKids from {start}:00 to {end}:00 ({timezone})." / "Tu hijo puede usar SportyKids de {start}:00 a {end}:00 ({timezone})."

**Files to modify**:
- `apps/web/src/app/parents/page.tsx` (Restrictions tab)
- `apps/mobile/src/screens/ParentalControl.tsx` (Restrictions section)
- `packages/shared/src/i18n/es.json`
- `packages/shared/src/i18n/en.json`

---

#### 13.5 B-PT6: Parental Onboarding Tour

**Current state**:
- `ParentalTour` component exists at `apps/web/src/components/ParentalTour.tsx` (3-step overlay tour) and `apps/mobile/src/components/ParentalTour.tsx`.
- Web version checks `localStorage('sportykids_parental_tour_done')` to show/hide.
- i18n keys exist: `tour.step1_title` through `tour.step3_message`, `tour.next`, `tour.done`, `tour.skip`.

**What needs to happen**:

1. **Verify web trigger**: The `ParentalTour` must render **after the first successful PIN creation** during onboarding step 5 or when first entering the parental panel after PIN setup. Currently it renders based on localStorage flag. Verify:
   - Is `<ParentalTour />` rendered inside the parental panel page (`apps/web/src/app/parents/page.tsx`)?
   - If not, add it.
   - Does the localStorage flag get cleared/set at the right time?

2. **Verify mobile trigger**: Same check for `apps/mobile/src/screens/ParentalControl.tsx`.
   - Mobile uses `AsyncStorage` instead of `localStorage`.
   - Ensure the component is rendered and the flag is checked via AsyncStorage.

3. **Fix if broken**: If the tour doesn't show at the right time, fix the trigger logic. The tour should appear once (and only once) after the parent first creates their PIN.

**Files to verify/modify**:
- `apps/web/src/app/parents/page.tsx`
- `apps/web/src/components/ParentalTour.tsx`
- `apps/mobile/src/screens/ParentalControl.tsx`
- `apps/mobile/src/components/ParentalTour.tsx`

---

#### 13.6 B-CP4: Related Article Recommendations

**Current state**:
- Endpoint `GET /api/news/:id/related?limit=3` exists and returns articles with the same team or sport.
- **No UI** shows related articles in the article detail view.

**What needs to happen**:

**Web** -- Article detail view (likely in a modal or dedicated page when user clicks "Read more" on a `NewsCard`):

```
+-------------------------------------------+
|  [Article Title]                           |
|  [Article content / summary]               |
|                                            |
|  ---                                       |
|  You Might Also Like                       |
|  +--------+ +--------+ +--------+          |
|  |  Card  | |  Card  | |  Card  |          |
|  | thumb  | | thumb  | | thumb  |          |
|  | title  | | title  | | title  |          |
|  +--------+ +--------+ +--------+          |
+-------------------------------------------+
```

- Fetch `GET /api/news/:id/related?limit=3` when article detail loads.
- Render as a horizontal row of compact `NewsCard` components.
- Clicking a related article navigates to that article's detail.
- i18n keys already exist: `related.title` ("You might also like" / "Tambien te puede interesar"), `related.empty`.

**Mobile** -- Article detail screen:
- Same section at the bottom of the article scroll view.
- Use compact card layout (thumbnail + title, horizontal scroll).

**Files to modify**:
- `apps/web/src/components/NewsCard.tsx` or article detail component
- `apps/mobile/src/screens/HomeFeed.tsx` or article detail screen
- New component if needed: `RelatedArticles` (web + mobile)

---

#### 13.7 B-EN4: Reading History

**Current state**:
- Endpoint `GET /api/news/history?userId=&page=&limit=` exists and returns paginated reading history from `ActivityLog` entries.
- i18n keys exist: `history.title` ("Recently Read"), `history.empty`, `history.see_all`.
- **No UI** shows reading history on the home screen.

**What needs to happen**:

**Web** -- Home page (`apps/web/src/app/page.tsx`), below the main feed:

```
+-------------------------------------------+
|  Recently Read                   See all > |
|  +--------+ +--------+ +--------+          |
|  |  Card  | |  Card  | |  Card  |          |
|  | thumb  | | thumb  | | thumb  |          |
|  | title  | | title  | | title  |          |
|  +--------+ +--------+ +--------+          |
+-------------------------------------------+
```

- Fetch `GET /api/news/history?userId=<id>&limit=5` on home page load.
- Only show section if user has history (non-empty response).
- Horizontal scroll row of compact news cards.
- "See all" navigates to a full-page reading history view (or expands inline).

**Mobile** -- HomeFeed screen (`apps/mobile/src/screens/HomeFeed.tsx`):
- Same horizontal section below the main FlatList (or as a ListHeaderComponent section).
- Only show if history is non-empty.

**Files to modify**:
- `apps/web/src/app/page.tsx` (home page)
- `apps/mobile/src/screens/HomeFeed.tsx`
- New component if needed: `ReadingHistory` (web + mobile)

---

#### 13.8 B-CP5: Content Filtering by User Language

**Current state**:
- `RssSource.language` exists in the data model (e.g., `'es'`, `'en'`, `'it'`).
- `User.locale` exists (default `'es'`).
- `User.country` exists (default `'ES'`).
- `feed-ranker.ts` has locale/country boost logic.
- The news endpoint accepts `locale` as a query parameter.

**What needs to happen**:

1. **Verify end-to-end flow**:
   - When a user with `locale='es'` requests `/api/news`, do they see Spanish-language sources ranked higher?
   - When a user with `locale='en'` requests, do English sources rank higher?
   - Are non-matching language sources completely filtered out, or just ranked lower?

2. **Expected behavior**: Sources matching the user's language should be ranked significantly higher but NOT filtered out entirely (kids might follow international teams with non-local sources). The feed ranker's locale boost should provide at least 2x weight to matching-language sources.

3. **Verify the locale parameter is passed**: Check that both web and mobile frontends pass the user's locale to the API:
   - Web: `apps/web/src/lib/api.ts` -- does `fetchNews()` include `locale` param?
   - Mobile: `apps/mobile/src/lib/api.ts` -- same check.

4. **Fix if needed**: If locale is not being passed to the API, add it. If the feed ranker's language boost is insufficient, tune the weight.

**Files to verify/modify**:
- `apps/api/src/services/feed-ranker.ts`
- `apps/api/src/routes/news.ts`
- `apps/web/src/lib/api.ts`
- `apps/mobile/src/lib/api.ts`

---

#### 13.9 B-MP6: Native Reel Player Audit

**Current state**:
- `expo-video` integrated for MP4 playback in `apps/mobile/src/components/VideoPlayer.tsx`.
- YouTube/Instagram/TikTok use WebView embed with error detection and fallback to external app.
- `VideoPlayer` component handles all video types with a strategy pattern.

**What needs to happen**:

This is an **audit and documentation** task, not a code change.

1. **Audit current content**: Query the database to determine what percentage of Reels are:
   - YouTube embeds (majority)
   - Direct MP4 (if any)
   - Instagram / TikTok embeds (if any)

2. **Document findings** in a brief section in `docs/en/06-service-overview.md` under a "Video Player Strategy" heading:
   - Which content types use native player (expo-video): MP4 only.
   - Which use WebView embed: YouTube, Instagram, TikTok.
   - Which fall back to external app: YouTube videos that block embedding (error 153/101/150).
   - Performance notes: native player is smoother, WebView has 1-2s load delay.

3. **If any MP4 sources exist or could be added**: Verify expo-video works correctly on both iOS and Android simulators. Note any issues.

4. **No major code change expected**. If the audit reveals that 100% of content is YouTube embeds, document that native player is ready for future MP4 sources but currently unused.

**Files to verify**:
- `apps/mobile/src/components/VideoPlayer.tsx`
- `apps/api/prisma/seed.ts` (check reel video types in seed data)

**Output**: Updated documentation in `docs/en/06-service-overview.md`.

---

## UI Mockups

### OAuth Login Page (Web)

```
+---------------------------------------------------+
|                                                     |
|                    (soccer ball)                     |
|                    SportyKids                       |
|                                                     |
|   +---------------------------------------------+  |
|   |  (G) Sign in with Google                     |  |
|   +---------------------------------------------+  |
|                                                     |
|   +---------------------------------------------+  |
|   |  () Sign in with Apple                       |  |
|   +---------------------------------------------+  |
|                                                     |
|   -------------- or continue with ---------------   |
|                                                     |
|   +---------------------------------------------+  |
|   |  Email                                       |  |
|   +---------------------------------------------+  |
|   +---------------------------------------------+  |
|   |  Password                                    |  |
|   +---------------------------------------------+  |
|                                                     |
|   +---------------------------------------------+  |
|   |            [  Log in  ]                      |  |
|   +---------------------------------------------+  |
|                                                     |
|             Create account                          |
|           Continue without account                  |
|                                                     |
+---------------------------------------------------+
```

### OAuth Login Page (Mobile)

```
+-------------------------------+
|                               |
|         (soccer ball)         |
|         SportyKids            |
|         Log in                |
|                               |
| +---------------------------+ |
| | Email                     | |
| +---------------------------+ |
| +---------------------------+ |
| | Password                  | |
| +---------------------------+ |
|                               |
| +---------------------------+ |
| |       [ Log in ]          | |
| +---------------------------+ |
|                               |
| -------- or sign in with --- |
|                               |
| +---------------------------+ |
| | (G) Sign in with Google   | |
| +---------------------------+ |
| +---------------------------+ |
| | () Sign in with Apple     | |
| +---------------------------+ |
|                               |
|      Create account           |
|   Continue without account    |
|                               |
+-------------------------------+
```

### Schedule Lock UI (Parental Panel - Web)

```
+-------------------------------------------+
|  Restrictions                              |
|  ---------------------------------------- |
|  ...existing time limits section...        |
|                                            |
|  ======================================== |
|                                            |
|  Schedule Lock                             |
|                                            |
|  [ ] Enable schedule lock                  |
|                                            |
|  When enabled:                             |
|  +---------------------------------------+ |
|  | Start hour: [  7  v ]                 | |
|  | End hour:   [ 21  v ]                 | |
|  | Timezone:   [ Europe/Madrid      v ]  | |
|  +---------------------------------------+ |
|                                            |
|  (i) Your child can use SportyKids from   |
|      7:00 to 21:00 (Europe/Madrid)        |
|                                            |
+-------------------------------------------+
```

### Related Articles Section (Article Detail)

```
+-------------------------------------------+
|  ...article content...                     |
|                                            |
|  ---------------------------------------- |
|  You Might Also Like                       |
|                                            |
|  +--------+  +--------+  +--------+       |
|  |[image] |  |[image] |  |[image] |       |
|  |        |  |        |  |        |       |
|  |Title of|  |Title of|  |Title of|       |
|  |article |  |article |  |article |       |
|  |Source   |  |Source   |  |Source   |       |
|  +--------+  +--------+  +--------+       |
+-------------------------------------------+
```

### Reading History Section (Home)

```
+-------------------------------------------+
|  Recently Read                   See all > |
|  +---------+ +---------+ +---------+      |
|  |[thumb]  | |[thumb]  | |[thumb]  |      |
|  |Title    | |Title    | |Title    |      |
|  |3h ago   | |5h ago   | |1d ago   |      |
|  +---------+ +---------+ +---------+      |
+-------------------------------------------+
```

---

## Acceptance Criteria

### Feature 7: OAuth Social Login

- [ ] `GET /api/auth/google` redirects to Google consent screen (not 501)
- [ ] `GET /api/auth/google/callback` exchanges code, creates/finds user, issues JWT pair, redirects to frontend
- [ ] `POST /api/auth/google/token` accepts Google ID token from mobile, verifies server-side, returns `AuthResponse`
- [ ] `GET /api/auth/apple` redirects to Apple authorization (not 501)
- [ ] `POST /api/auth/apple/callback` handles Apple POST callback, verifies identity token, issues JWT pair
- [ ] `POST /api/auth/apple/token` accepts Apple identity token from mobile, verifies with JWKS, returns `AuthResponse`
- [ ] New user created via Google has `authProvider='google'`, `socialId` set, `passwordHash=null`
- [ ] New user created via Apple has `authProvider='apple'`, `socialId` set, `passwordHash=null`
- [ ] Existing user with same email is linked (not duplicated) when signing in with social provider
- [ ] JWT tokens issued by social login work with all existing `requireAuth` / `requireRole` middleware
- [ ] Web login page shows "Sign in with Google" and "Sign in with Apple" buttons
- [ ] Web register page shows the same social buttons
- [ ] Mobile Login screen shows social sign-in buttons
- [ ] Mobile Register screen shows social sign-in buttons
- [ ] Mobile Google flow uses `expo-auth-session` and obtains ID token
- [ ] Mobile Apple flow uses `expo-apple-authentication` (native iOS dialog)
- [ ] OAuth state parameter prevents CSRF on web redirect flows
- [ ] Apple nonce is generated, hashed, and verified
- [ ] `Prisma migration` adds `socialId` column to User without data loss
- [ ] App gracefully handles missing env vars (buttons hidden or disabled, not crashing)
- [ ] When `GOOGLE_CLIENT_ID` is not set, Google button is not shown
- [ ] When `APPLE_CLIENT_ID` is not set, Apple button is not shown
- [ ] Parent can sign up via Google, then link anonymous child via existing `POST /api/auth/link-child`
- [ ] All new i18n keys added to both `es.json` and `en.json`

### Feature 13: Minor Items

**B-UX7**:
- [ ] API error responses include a string `code` field matching `KID_FRIENDLY_ERRORS` keys
- [ ] `getErrorType()` maps HTTP 401 to `unauthorized` and 429 to `rate_limited`
- [ ] New i18n keys added for `rate_limited`, `format_blocked`, `limit_reached`, `unauthorized` in both locales
- [ ] `ErrorState` renders correct kid-friendly message for each error type

**B-UX8**:
- [ ] Quiz correct answer triggers `haptic('success')`
- [ ] Quiz incorrect answer triggers `haptic('error')`
- [ ] Sticker collection tap triggers `haptic('light')`
- [ ] Check-in sticker award triggers `haptic('success')`
- [ ] Reel like triggers `haptic('light')`
- [ ] Tab switch triggers `haptic('selection')`
- [ ] Haptics degrade silently on unsupported platforms (no crashes)

**B-MP3**:
- [ ] HomeFeed screen has pull-to-refresh with `BrandedRefreshControl`
- [ ] Reels screen has pull-to-refresh with `BrandedRefreshControl`
- [ ] Collection screen has pull-to-refresh with `BrandedRefreshControl`
- [ ] Refresh title text uses i18n (not hardcoded English)

**B-PT4**:
- [ ] Parental panel Restrictions tab shows "Schedule Lock" section (web + mobile)
- [ ] Toggle to enable/disable schedule (default: disabled = 0-24)
- [ ] Hour pickers for start (0-23) and end (1-24) appear when enabled
- [ ] Timezone dropdown with at least 10 common timezones
- [ ] Saving calls `PUT /api/parents/profile/:userId` with correct fields
- [ ] Description text updates dynamically as hours change

**B-PT6**:
- [ ] Parental tour appears after first PIN creation on web
- [ ] Parental tour appears after first PIN creation on mobile
- [ ] Tour does not appear on subsequent visits
- [ ] Tour can be skipped

**B-CP4**:
- [ ] Article detail view shows "You Might Also Like" section (web + mobile)
- [ ] Section fetches from `GET /api/news/:id/related?limit=3`
- [ ] Section hidden when no related articles exist
- [ ] Clicking related article navigates to that article

**B-EN4**:
- [ ] Home page shows "Recently Read" section below main feed (web + mobile)
- [ ] Section fetches from `GET /api/news/history?userId=<id>&limit=5`
- [ ] Section hidden when user has no reading history
- [ ] "See all" link exists (can be placeholder for now)

**B-CP5**:
- [ ] User with `locale='es'` sees Spanish-language sources ranked higher in feed
- [ ] User with `locale='en'` sees English-language sources ranked higher
- [ ] Both web and mobile pass `locale` query param to news endpoint
- [ ] Non-matching language sources still appear (ranked lower, not filtered out)

**B-MP6**:
- [ ] Documentation in `docs/en/06-service-overview.md` describes video player strategy
- [ ] Audit results (% YouTube vs MP4 vs other) documented
- [ ] No regressions in existing VideoPlayer behavior

---

## Technical Requirements

### New Dependencies

| Package | Version | Where | Purpose |
|---------|---------|-------|---------|
| `passport` | ^0.7 | `apps/api` | Authentication framework |
| `passport-google-oauth20` | ^2 | `apps/api` | Google OAuth 2.0 strategy |
| `passport-apple` | ^2 | `apps/api` | Apple Sign In strategy |
| `google-auth-library` | ^9 | `apps/api` | Verify Google ID tokens (mobile flow) |
| `expo-auth-session` | ~6.x (SDK 54 compatible) | `apps/mobile` | OAuth browser flow for mobile |
| `expo-apple-authentication` | ~7.x (SDK 54 compatible) | `apps/mobile` | Native Apple Sign In |
| `expo-crypto` | ~13.x (SDK 54 compatible) | `apps/mobile` | Generate nonce for Apple Sign In |

### Environment Variables (New)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID. If absent, Google login is disabled. |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | Full URL for Google callback (e.g., `http://localhost:3001/api/auth/google/callback`) |
| `GOOGLE_SUCCESS_REDIRECT_URL` | No | Frontend URL for post-login redirect (e.g., `http://localhost:3000/auth/callback`) |
| `APPLE_CLIENT_ID` | No | Apple Services ID |
| `APPLE_TEAM_ID` | No | Apple Developer Team ID |
| `APPLE_KEY_ID` | No | Apple private key ID |
| `APPLE_PRIVATE_KEY` | No | Apple `.p8` private key contents |

### Database Migration

One migration adding `socialId String?` to User model. Non-breaking (nullable column). Index on `(authProvider, socialId)` for lookup performance.

### API Changes Summary

| Method | Route | Change |
|--------|-------|--------|
| GET | `/api/auth/google` | Replace 501 stub with Passport redirect |
| GET | `/api/auth/google/callback` | Replace 501 stub with callback handler |
| POST | `/api/auth/google/token` | **New** -- mobile token exchange |
| GET | `/api/auth/apple` | Replace 501 stub with Passport redirect |
| POST | `/api/auth/apple/callback` | **Change from GET to POST** + replace stub |
| POST | `/api/auth/apple/token` | **New** -- mobile token exchange |

### Frontend Changes Summary

**Web**:
- `apps/web/src/lib/auth.ts` -- Add `loginWithGoogle()`, `loginWithApple()` functions
- New: `apps/web/src/app/auth/callback/page.tsx` -- OAuth callback landing page (reads tokens from URL)
- Login/Register pages -- Add social buttons
- Home page -- Add reading history section
- Article detail -- Add related articles section
- Parental panel (Restrictions tab) -- Add schedule lock UI

**Mobile**:
- `apps/mobile/src/lib/auth.ts` -- Add `loginWithGoogle()`, `loginWithApple()` functions
- `apps/mobile/src/screens/Login.tsx` -- Add social buttons
- `apps/mobile/src/screens/Register.tsx` -- Add social buttons
- `apps/mobile/src/screens/HomeFeed.tsx` -- Add pull-to-refresh + reading history
- `apps/mobile/src/screens/Reels.tsx` -- Add pull-to-refresh + haptics
- `apps/mobile/src/screens/Quiz.tsx` -- Add pull-to-refresh + haptics
- `apps/mobile/src/screens/Collection.tsx` -- Add pull-to-refresh + haptics
- `apps/mobile/src/screens/ParentalControl.tsx` -- Add schedule lock UI + verify tour

---

## Implementation Decisions

### ID-1: Passport.js over manual OAuth

**Decision**: Use Passport.js with `passport-google-oauth20` and `passport-apple` strategies.

**Rationale**: Passport handles the OAuth state machine, token exchange, and profile normalization. This avoids manual HTTP calls to Google/Apple token endpoints and reduces security surface area. The session-less approach (serialize user to JWT, not session) keeps the existing architecture intact.

**Alternative considered**: Manual OAuth using `googleapis` or `apple-signin-auth`. Rejected because Passport provides a well-tested, community-maintained abstraction with consistent callback patterns.

### ID-2: Separate token endpoints for mobile

**Decision**: Add `POST /api/auth/google/token` and `POST /api/auth/apple/token` for mobile flows instead of using the redirect flow.

**Rationale**: Mobile apps use platform-native OAuth (Expo AuthSession, expo-apple-authentication) which return ID tokens directly. These tokens need server-side verification before issuing JWTs. The redirect flow doesn't work for native mobile apps.

### ID-3: Social buttons conditional on env vars

**Decision**: Social login buttons are conditionally rendered based on feature flags derived from env vars. If `GOOGLE_CLIENT_ID` is not set, the Google button doesn't appear.

**Rationale**: Developers running locally without OAuth credentials shouldn't see broken buttons. Production deploys enable buttons by setting env vars. This is implemented via:
- API: `GET /api/auth/providers` endpoint returns `{ google: boolean, apple: boolean }` based on env var presence.
- Frontend: Fetches providers on load, conditionally renders buttons.

### ID-4: Account linking by email match

**Decision**: When a user signs in with Google/Apple and an account with the same email exists (created via email/password), the social provider is **linked** to the existing account rather than creating a duplicate.

**Rationale**: Users expect a single account per email. This prevents confusion when a parent registers with email first, then tries Google later.

**Risk**: If someone has an email account and a different person has a Google account with the same email, linking would be incorrect. Mitigation: this scenario is extremely unlikely for a family app, and Google/Apple verify email ownership.

### ID-5: Apple callback as POST

**Decision**: Change `/api/auth/apple/callback` from GET to POST.

**Rationale**: Apple Sign In always sends the callback as a POST request with form-encoded body. This is Apple's design and cannot be changed. The existing GET stub must be replaced with POST.

### ID-6: Haptic intensity mapping

**Decision**: Use `light` for browsing interactions (taps, likes), `success`/`error` for feedback (quiz answers, rewards), `selection` for navigation (tab switches).

**Rationale**: Follows iOS Human Interface Guidelines for haptic intensity. Avoids haptic fatigue from overuse of strong feedback.

### ID-7: Schedule lock as optional toggle

**Decision**: Schedule lock defaults to disabled (0-24 = all day). Parents explicitly enable it.

**Rationale**: Most parents in early beta won't want to set schedule restrictions immediately. Defaulting to "off" avoids accidental lockouts. The parental-guard middleware already handles the 0-24 case as "no restriction."

---

## Testing Decisions

### TD-1: OAuth integration tests with mocks

**Scope**: Unit + integration tests for OAuth flows. Do NOT test against real Google/Apple APIs in CI.

**Approach**:
- Mock `passport-google-oauth20` and `passport-apple` strategies to return fake profiles.
- Test `findOrCreateSocialUser` with various scenarios: new user, existing user by socialId, existing user by email (linking), missing email (Apple privacy).
- Test that JWT tokens issued via social login work with `requireAuth` middleware.
- Test mobile token endpoints with mocked Google/Apple token verification.

**Files**:
- New: `apps/api/src/__tests__/auth-social.test.ts`
- Update: `apps/api/src/__tests__/auth.test.ts` (if exists)

### TD-2: Error mapping unit tests

**Scope**: Unit tests for `getErrorType()` function in `packages/shared/src/constants/errors.ts`.

**Test cases**:
- `getErrorType(401)` returns `'unauthorized'`
- `getErrorType(429)` returns `'rate_limited'`
- `getErrorType(404)` returns `'not_found'`
- `getErrorType(500)` returns `'server'`
- `getErrorType('rate limit')` returns `'rate_limited'`
- `getErrorType('format_blocked')` returns `'format_blocked'`
- `getErrorType('schedule_locked')` returns `'schedule_locked'`

### TD-3: Schedule lock UI tests

**Scope**: Test that the schedule lock UI correctly sends the right API payload.

**Test cases**:
- Toggle OFF sends `allowedHoursStart=0, allowedHoursEnd=24`
- Toggle ON with 7-21 sends `allowedHoursStart=7, allowedHoursEnd=21`
- Timezone selection persists correctly
- Cross-midnight range (e.g., 22-6) is allowed

### TD-4: Haptics test strategy

**Scope**: Haptics cannot be tested in automated tests (no vibration motor in CI).

**Approach**: Verify that `haptic()` calls are present in the right event handlers via code review. The `haptics.ts` module already has a try/catch fallback so it won't crash in test environments.

### TD-5: Pull-to-refresh tests

**Scope**: Verify that refresh handlers are connected and fetch fresh data.

**Approach**: Component render tests that verify `BrandedRefreshControl` is rendered inside FlatList/ScrollView. Integration tests that mock API and verify data refetch on pull.

### TD-6: Parental tour trigger test

**Scope**: Verify tour appears after first PIN creation.

**Test cases**:
- Tour appears when localStorage/AsyncStorage flag is absent
- Tour does not appear when flag is present
- Tour sets flag on completion
- Tour sets flag on skip

### TD-7: Content language filtering test

**Scope**: Integration test for feed ranker language boost.

**Test cases**:
- Feed with mixed es/en sources: `locale='es'` query returns Spanish sources ranked higher
- Feed with mixed es/en sources: `locale='en'` query returns English sources ranked higher
- Both locales still return sources from other languages (not filtered out)

---

## Out of Scope

1. **Google One Tap / Sign In With Google web SDK**: Only redirect flow for web. One Tap can be added later.
2. **Facebook / X / GitHub OAuth**: Only Google and Apple for now.
3. **Multi-factor authentication (MFA)**: Beyond scope for a kids' app.
4. **Email verification flow**: Not required for MVP. Social providers verify email.
5. **Password reset / forgot password**: Separate feature, not part of this PRD.
6. **OAuth for child accounts**: Children use anonymous auth. Only parents use social login.
7. **Full reading history page**: B-EN4 adds the "Recently Read" section to home. A dedicated history page is future work.
8. **Minute-level schedule granularity**: Schedule lock uses hour-level precision only (0-23).
9. **Video transcoding / self-hosted MP4**: B-MP6 is audit only. No new video hosting.

---

## Future Considerations

1. **Google One Tap**: After redirect flow works, add One Tap for even lower friction on web.
2. **OAuth token refresh**: Google and Apple tokens can expire. Current implementation issues our own JWT pair and doesn't store provider tokens. If we need to call provider APIs later (e.g., read Google contacts to find other families), we'll need to store and refresh provider tokens.
3. **Account unlinking**: Allow a user to disconnect Google/Apple from their account (keeping email/password). Requires UI in profile settings.
4. **Multiple social providers per account**: A user might want both Google AND Apple linked. Current model stores one `authProvider` + one `socialId`. To support multiple, would need a `SocialAccount` join table.
5. **Family sharing (Apple)**: Apple's Family Sharing could let a parent share the subscription (when monetized) with child accounts. Requires App Store integration.
6. **Haptic preferences**: Some users may want to disable haptics. Could add a toggle in settings.
7. **Advanced schedule lock**: Day-of-week rules (e.g., weekday 7-21, weekend 8-22). Current implementation is same hours every day.
8. **Reading history recommendations**: Use reading history to improve feed ranking (already partially done in `feed-ranker.ts` behavioral signals).
