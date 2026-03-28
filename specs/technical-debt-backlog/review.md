# Code Review: Technical Debt Backlog -- PRD4

## Summary

PRD4 implements OAuth social login (Google + Apple) and nine UX polish items. The implementation is generally solid -- all listed acceptance criteria have corresponding code, tests pass (561 total), and lint is clean. However, there are **critical security gaps** in the OAuth implementation: the Google OAuth `state` parameter is not verified on callback (CSRF vulnerability), the Apple identity token is decoded without signature verification (the PRD explicitly requires JWKS verification), and the `passport-apple` dependency is installed but never imported. These must be addressed before production deployment.

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| GET /api/auth/google redirects to consent screen | 7.1 AC | Done | Passport redirect works when env vars set |
| GET /api/auth/google/callback exchanges code, issues JWT | 7.1 AC | Done | Missing state validation (see critical) |
| POST /api/auth/google/token verifies ID token server-side | 7.1 AC | Done | Uses google-auth-library correctly |
| GET /api/auth/apple redirects to Apple auth | 7.2 AC | Done | Manual redirect (no passport-apple) |
| POST /api/auth/apple/callback handles POST, verifies token | 7.2 AC | Partial | JWT decoded but NOT verified with JWKS |
| POST /api/auth/apple/token for mobile | 7.2 AC | Partial | Same -- no JWKS verification |
| socialId field + composite index | 7.3 AC | Done | Schema correct |
| findOrCreateSocialUser (3 flows) | 7.4 AC | Done | Well-structured, tested |
| Account linking by email | 7.4 AC | Done | |
| JWT tokens work with existing middleware | 7.1 AC | Done | Tested in auth-social.test.ts |
| Web social buttons conditional on env vars | 7.7 AC | Done | fetchAuthProviders pattern |
| Mobile social buttons conditional | 7.7 AC | Done | Same pattern |
| OAuth state parameter prevents CSRF | 7.5 AC | **Not met** | State generated but never validated |
| Apple nonce generated, hashed, verified | 7.5 AC | **Not met** | Nonce generated in URL but never verified |
| i18n keys for social auth | 7.7 AC | Done | Both es.json and en.json |
| SocialAuthRequest type in shared | 7.6 AC | Done | |
| B-UX7: Kid-friendly error types | 13.1 AC | Done | 4 new types + getErrorType mappings |
| B-UX8: Haptic feedback | 13.2 AC | Done | 6+ interaction points |
| B-MP3: Pull-to-refresh | 13.3 AC | Done | 4 screens + i18n fix |
| B-PT4: Schedule lock UI | 13.4 AC | Done | Web + mobile with timezone |
| B-PT6: Parental tour | 13.5 AC | Done | Verified, mobile fixed |
| B-CP4: Related articles | 13.6 AC | Done | Web + mobile |
| B-EN4: Reading history | 13.7 AC | Done | Horizontal scroll on home |
| B-CP5: Locale content filtering | 13.8 AC | Done | locale param passed by both frontends |
| B-MP6: Native reel player audit | 13.9 AC | Done | Documented in service-overview |
| Mobile Google flow uses expo-auth-session | 7.1 AC | **Not met** | Uses Linking.openURL instead (noted in known issues) |
| Mobile Apple flow uses expo-apple-authentication | 7.2 AC | **Not met** | Uses Linking.openURL instead (noted in known issues) |

## TODO: Critical Issues (must fix)

- [x] **apps/api/src/routes/auth.ts:294** -- Google OAuth `state` parameter is generated but never validated on callback (line 298). The callback does not compare the returned `state` query param against the one sent. This is a **CSRF vulnerability**. The state should be stored (e.g., in a short-lived cookie or cache) on the `/google` route and verified on `/google/callback`. Passport's built-in state validation only works with sessions, which are not used here.

- [x] **apps/api/src/routes/auth.ts:404-406** -- Apple callback decodes the JWT payload without any signature verification: `JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString())`. An attacker can craft an arbitrary JWT with any `sub` and `email` claims and the server will accept it as a valid Apple login. PRD section 7.5 explicitly requires: "Fetch JWKS from `https://appleid.apple.com/auth/keys`, verify JWT signature, check `iss`, `aud`, `exp` claims." This applies to both the `/apple/callback` (line 404) and `/apple/token` (line 457) endpoints.

- [x] **apps/api/src/routes/auth.ts:387-388** -- Apple nonce is generated in the authorization URL but never verified when the identity token is returned. The PRD requires: "Generate a nonce, hash it (SHA256), send hashed nonce to Apple, verify the `nonce` claim in the returned identity token." Currently the nonce is discarded.

- [x] **apps/web/src/app/auth/callback/page.tsx:23-24** -- OAuth tokens are passed as URL query parameters (`?token=<JWT>&refresh=<token>`). These tokens will be visible in browser history, server logs, and any analytics tools. While this is a common pattern for OAuth callbacks, the tokens should be consumed and the URL cleaned immediately. The current code does store them but does **not** remove the tokens from the URL. Add `window.history.replaceState({}, '', '/auth/callback')` after reading the params.

## TODO: Warnings (should fix)

- [x] **apps/api/package.json:33** -- `passport-apple` (^2.0.2) and `@types/passport-apple` (^2.0.3) are installed as dependencies but never imported anywhere. Apple auth is implemented manually. Either use `passport-apple` for Apple web flow (consistent with Google's passport approach) or remove the unused dependency to reduce attack surface and bundle size.

- [x] **apps/mobile/src/screens/Quiz.tsx:31,55,71** -- Three `console.error` calls with `// eslint-disable-next-line no-console` comments. Per CLAUDE.md, structured logging should be used. In mobile context where Pino is not available, these should at minimum use `__DEV__ && console.error(...)` pattern (as done in MissionCard.tsx:47) to avoid logging in production builds.

- [x] **apps/mobile/src/screens/Login.tsx:108 + Register.tsx:146** -- Mobile social login buttons use `Linking.openURL(API_BASE + '/auth/google')` which redirects to the API server's OAuth flow. After authentication, the server redirects to the web callback URL -- this will NOT return the user to the mobile app. The mobile OAuth flow needs deep linking (URL scheme) to receive the callback, or should use the `loginWithSocialToken` function from `auth.ts` with an ID token obtained via `expo-auth-session`. As implemented, tapping the social buttons on mobile will lose the user.

- [x] **apps/api/src/routes/auth.ts:268-270** -- `express.urlencoded({ extended: true })` middleware is added to the entire auth router via `router.use()`. This affects ALL subsequent routes, not just Apple's callback. It should be scoped to only the Apple callback route to avoid unexpected body parsing on other endpoints.

- [x] **apps/web/src/app/auth/callback/page.tsx:27-39** -- The OAuth callback fetches `/auth/me` without error handling for non-JSON responses (e.g., if the API returns HTML on error). The `.then(res => res.json())` will throw on non-JSON. Add a `res.ok` check before parsing.

- [x] **apps/api/src/services/auth-service.ts:116** -- `findOrCreateSocialUser` return type is `{ user: Record<string, unknown>; isNewUser: boolean }`. The `Record<string, unknown>` type loses all type safety. This should use the Prisma `User` type or at minimum a more specific interface matching the fields actually accessed (`.id`, `.role`, `.parentUserId`).

- [x] **apps/mobile/src/screens/Login.tsx:172,199 + Register.tsx:199** -- Several style values use hardcoded colors (`'#FFFFFF'`, `'#E5E7EB'`, `'#9CA3AF'`, `'#000000'`) instead of the theme-aware `colors.*` system. These will not adapt to dark mode. The input background (`'#FFFFFF'`), border colors, and placeholder colors should use `colors.surface`, `colors.border`, and `colors.muted`.

- [x] **apps/api/src/routes/auth.ts:375-391** -- The Apple authorization redirect builds the URL manually with `URLSearchParams`. The `response_mode: 'form_post'` is correct, but the `scope: 'name email'` requires Apple to be configured for these scopes in the developer console. If not configured, Apple silently drops the scopes. The implementation should document this prerequisite.

## TODO: Suggestions (nice to have)

- [x] **apps/api/src/routes/auth.ts:299-318** -- The Google callback handler has deeply nested callbacks. Consider extracting to an async function for readability: `async function handleGoogleCallback(req, res) { ... }`.

- [x] **apps/api/src/__tests__/auth-social.test.ts:370-375** -- `createFakeAppleToken` helper is duplicated between the `POST /api/auth/apple/token` and `POST /api/auth/apple/callback` describe blocks. Extract to a shared helper at the top of the file.

- [x] **apps/web/src/components/OnboardingWizard.tsx:55** -- `fetchAuthProviders().then(setProviders).catch(() => {})` silently swallows errors. This is acceptable for a feature flag check, but a debug-level log would help with troubleshooting.

- [x] **apps/mobile/src/screens/HomeFeed.tsx:44** -- `fetchReadingHistory` error is silently caught with `.catch(() => {})`. Consider showing the section only on success (current behavior is correct) but logging the error in `__DEV__` mode.

- [x] **apps/api/src/services/feed-ranker.ts:123** -- `languageBoost` function signature uses `string | null | undefined` for `itemLanguage`. A simpler approach would be to normalize to empty string at the call site and accept `string` only.

- [x] **packages/shared/src/constants/errors.ts:131** -- The `getErrorType` string matching for `'429'` inside a message string could produce false positives if an article title contains "429". Consider only matching when the string starts with or equals the status code.

- [x] **apps/web/src/app/auth/callback/page.tsx** -- The callback page has no `<Suspense>` boundary. Since it uses `useSearchParams()` (which requires Suspense in Next.js 14+), this may cause a build warning or runtime error in production builds.

## Technical Debt Assessment

**OAuth implementation** adds moderate new debt. The critical security issues (state validation, Apple JWT verification) are documented in the known issues of the implementation notes, but they represent real attack vectors that must be resolved before any public beta. The `passport-apple` unused dependency is a minor but unnecessary addition to the dependency tree.

**UX polish items** are clean and well-integrated. Haptic feedback, pull-to-refresh, schedule lock, related articles, and reading history all follow existing patterns and use proper i18n. The code is consistent with the established architecture.

**Mobile social login** is the most incomplete area. The buttons exist and conditionally render, but they redirect to the web OAuth flow via `Linking.openURL` which cannot return the user to the app. The implementation notes acknowledge this (`expo-auth-session and expo-apple-authentication not installed yet`) but it means the mobile social login buttons are non-functional in practice.

**Test coverage** is good for the auth-service unit tests (findOrCreateSocialUser) and the API integration tests (providers, google/token, apple/token, apple/callback). The auth-oauth test rewrite properly mocks passport and tests route behavior. No tests exist for the web callback page or mobile social login screens, which is acceptable given they are primarily UI wiring.

**Overall**: The codebase is clean, follows conventions, and the non-OAuth features are production-ready. The OAuth implementation needs the security fixes listed above before it can be considered secure for production use.

## Verification Results

```
Tests:
  API:    39 files, 423 tests -- all passed
  Web:    14 files,  69 tests -- all passed
  Mobile: 11 files,  69 tests -- all passed
  Total:  64 files, 561 tests -- all passed

Lint: eslint . -- clean (0 warnings, 0 errors)
```

## Files Reviewed

- `apps/api/src/services/passport.ts` (new)
- `apps/api/src/__tests__/auth-social.test.ts` (new)
- `apps/web/src/app/auth/callback/page.tsx` (new)
- `apps/api/prisma/schema.prisma` (socialId + index)
- `apps/api/src/services/auth-service.ts` (findOrCreateSocialUser)
- `apps/api/src/routes/auth.ts` (OAuth routes)
- `apps/api/src/utils/format-user.ts` (socialId stripping)
- `apps/api/src/__tests__/routes/auth-oauth.test.ts` (rewrite)
- `packages/shared/src/types/index.ts` (SocialAuthRequest, socialId)
- `apps/web/src/lib/api.ts` (fetchAuthProviders, locale)
- `apps/web/src/lib/auth.ts` (getGoogleLoginUrl, getAppleLoginUrl)
- `apps/web/src/components/OnboardingWizard.tsx` (social buttons)
- `apps/mobile/src/lib/auth.ts` (fetchAuthProviders, loginWithSocialToken)
- `apps/mobile/src/screens/Login.tsx` (social buttons)
- `apps/mobile/src/screens/Register.tsx` (social buttons)
- `packages/shared/src/constants/errors.ts` (new error types + getErrorType)
- `packages/shared/src/i18n/en.json` (new keys)
- `packages/shared/src/i18n/es.json` (new keys)
- `apps/mobile/src/screens/Quiz.tsx` (haptics + pull-to-refresh)
- `apps/mobile/src/screens/Collection.tsx` (haptics + pull-to-refresh)
- `apps/mobile/src/screens/Reels.tsx` (haptics + pull-to-refresh)
- `apps/mobile/src/navigation/index.tsx` (haptic on tab switch)
- `apps/mobile/src/components/MissionCard.tsx` (haptics)
- `apps/mobile/src/lib/user-context.tsx` (haptic on check-in)
- `apps/mobile/src/components/BrandedRefreshControl.tsx` (i18n fix)
- `apps/mobile/src/screens/HomeFeed.tsx` (pull-to-refresh + reading history + locale)
- `apps/web/src/components/ParentalPanel.tsx` (schedule lock UI)
- `apps/mobile/src/screens/ParentalControl.tsx` (schedule lock + tour)
- `apps/web/src/components/NewsCard.tsx` (related articles)
- `apps/mobile/src/components/NewsCard.tsx` (related articles)
- `apps/web/src/app/HomeFeedClient.tsx` (locale passing + reading history)
- `apps/mobile/src/lib/api.ts` (locale in fetchNews)
- `apps/api/src/services/feed-ranker.ts` (locale boost)
- `docs/en/06-service-overview.md` (Video Player Strategy)
- `apps/api/package.json` (dependencies)
