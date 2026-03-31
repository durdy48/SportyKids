# Code Review: Legal & Compliance Foundation

## Summary

The feature is well-structured and follows project conventions for i18n, component patterns, and API design. However, there are two critical authorization bugs in the delete flow (missing parental session token on web and mobile), several hardcoded `localhost` URLs in mobile code that will break in production, and a few moderate issues around error handling and type safety. Overall assessment: **needs changes** (3 critical, 8 warnings, 7 suggestions).

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| Age gate with 3 paths (adult 18+, teen 13-17, child <13) | prd.md | OK | Web and mobile both implement all three paths |
| Child path requires parental consent + mandatory PIN creation | prd.md | OK | Checkbox + PIN create/confirm flow on both platforms |
| Existing users forced to age gate if ageGateCompleted=false | prd.md | OK | Web: user-context redirect. Mobile: nav guard |
| /privacy and /terms public pages with i18n ES/EN | prd.md | OK | Both pages with locale switcher and Suspense |
| DELETE /api/users/:id/data — hard delete, requires auth + parental session | prd.md | Issue | Endpoint correct, but web/mobile callers don't pass session token |
| PostHog/Sentry disabled until consentGiven=true | prd.md | OK | Web: initAnalytics(consentGiven). API: shouldTrackUser() |
| Legal links in login, register, onboarding, parental panel | prd.md | OK | All four locations on both platforms |
| consentDate auto-set server-side on transition to true | prd.md | OK | users.ts checks previous state before setting |

## TODO: Critical Issues (must fix)

- [x] **`apps/web/src/components/ParentalPanel.tsx:1044`** -- `deleteUserData(user.id)` is called without passing the parental session token. The API requires a valid `X-Parental-Session` header for child accounts with a parental profile (line 137-142 of `users.ts`). Deletion will return 403 for any child account with a parental profile. Should pass the session token from the parental panel's authenticated state.

- [x] **`apps/mobile/src/screens/ParentalControl.tsx:910-915`** -- Same bug on mobile. The delete handler includes the auth token but omits the `X-Parental-Session` header. Should include the parental session token in the request headers.

- [x] **`apps/api/src/routes/users.ts:146-157`** -- The delete transaction does not handle the `children` relation. If a parent account is deleted while child users still reference it via `parentUserId`, `prisma.user.delete` will fail with a foreign key constraint violation. Should either set `parentUserId = null` on children before deleting, or reject the request with a clear error explaining that child accounts must be deleted first.

## TODO: Warnings (should fix)

- [x] **`apps/mobile/src/screens/AgeGate.tsx:21`** -- `WEB_BASE` is hardcoded to `http://localhost:3000`. Legal page links from the mobile app will not work on physical devices or in production. Should use a configurable constant (e.g., in `apps/mobile/src/config.ts` alongside `API_BASE`).

- [x] **`apps/mobile/src/screens/Login.tsx`, `Register.tsx`, `Onboarding.tsx`, `ParentalControl.tsx`** -- All hardcode `http://localhost:3000` for legal page URLs (5+ occurrences). Should extract into a `WEB_BASE` constant in `apps/mobile/src/config.ts`.

- [x] **`apps/web/src/app/age-gate/page.tsx:54-56,74-76`** -- The `catch` blocks silently swallow errors and proceed with `handleComplete()`. A user could complete the age gate client-side without the server recording consent. Should show an error and block progression if the API call fails.

- [x] **`apps/web/src/components/ParentalPanel.tsx:1045-1046`** -- After deleting, clears `sportykids-user` and `sportykids-theme` but the actual user ID key in `user-context.tsx` is `sportykids_usuario_id`. The wrong localStorage keys are cleared, so the user may appear still logged in. Should clear the correct keys or call `logout()` from context.

- [x] **`apps/web/src/app/privacy/page.tsx:427`**, **`apps/web/src/app/terms/page.tsx:295`** -- Suspense fallback text `"Loading..."` is hardcoded in English. Should use a spinner without text or an i18n key.

- [x] **`apps/web/src/lib/analytics.ts:16`** -- `initAnalytics(consentGiven?: boolean)` checks `consentGiven === false` but `undefined` does not trigger the guard. Calling `initAnalytics()` with no args will initialize PostHog. Should check `consentGiven !== true` instead.

- [x] **`apps/web/src/lib/api.ts:updateUser`** -- The `updateUser` function accepts `Partial<CreateUserData>` but consent fields aren't in `CreateUserData`. The age gate casts to `Record<string, unknown>` to work around this. Should update the signature or add consent fields to the type.

- [x] **`apps/web/src/app/age-gate/page.tsx:41-59,62-79`** -- `handleParentPath` and `handleTeenContinue` are nearly identical. Could be collapsed into a single function.

## TODO: Suggestions (nice to have)

- [x] **`apps/web/src/app/privacy/page.tsx`** and **`apps/web/src/app/terms/page.tsx`** -- `LegalReviewBanner` component is duplicated. Extract to `apps/web/src/components/LegalReviewBanner.tsx`.

- [x] **`apps/web/src/app/privacy/page.tsx:50`** -- Date string `'Marzo 2026'` / `'March 2026'` is hardcoded. Consider making it a constant.

- [x] **`apps/mobile/src/screens/__tests__/AgeGate.test.tsx`** -- Tests only verify module import and check `.toString()` output for testIDs. Very shallow. Consider adding render tests with `@testing-library/react-native`.

- [x] **`apps/api/src/__tests__/data-deletion.test.ts`** -- Could add test for deleting a parent who has linked children (the FK constraint bug).

- [x] **`apps/web/src/app/age-gate/page.tsx:48-51`** -- `as Record<string, unknown>` type assertion bypasses type constraints. Code smell from the API client type gap.

- [x] **`apps/web/src/components/ParentalPanel.tsx:1066-1068`** -- Legal links use `<a href="/privacy">` instead of Next.js `<Link>`, causing full page reloads.

- [x] **`apps/web/src/components/OnboardingWizard.tsx:360-362`** -- Same: `<a>` tags instead of `<Link>`.

## Technical Debt Assessment

**Post-review update**: All 18 TODO items have been resolved. The hardcoded localhost URLs are now configurable via `WEB_BASE` in config.ts, the `LegalReviewBanner` component has been extracted, the type assertions removed, and all authorization bugs in the delete flow fixed. Net technical debt: **neutral** — the feature adds no new debt.

## Files Reviewed

| File | Notes |
|---|---|
| `apps/web/src/app/age-gate/page.tsx` | Functional but has duplicated handlers, silent error swallowing, type assertions |
| `apps/web/src/app/privacy/page.tsx` | Well-structured, i18n-compliant, legal review banners |
| `apps/web/src/app/terms/page.tsx` | Same quality, duplicated LegalReviewBanner |
| `apps/mobile/src/screens/AgeGate.tsx` | Good mobile UX, hardcoded localhost |
| `apps/api/src/routes/users.ts` | Consent fields and DELETE solid, missing FK cascade handling |
| `apps/api/src/services/monitoring.ts` | Clean shouldTrackUser, consent gating works |
| `apps/web/src/lib/analytics.ts` | Consent gating works but undefined vs false asymmetry |
| `apps/web/src/lib/user-context.tsx` | Age gate redirect correct |
| `apps/web/src/lib/api.ts` | deleteUserData well-implemented |
| `apps/web/src/components/ParentalPanel.tsx` | Delete flow missing session token + wrong localStorage key |
| `apps/web/src/components/OnboardingWizard.tsx` | Legal links present, uses a tags |
| `apps/mobile/src/navigation/index.tsx` | Age gate nav guard correct |
| `apps/mobile/src/screens/Login.tsx` | Legal links, hardcoded localhost |
| `apps/mobile/src/screens/Register.tsx` | Legal links, hardcoded localhost |
| `apps/mobile/src/screens/Onboarding.tsx` | Legal links, hardcoded localhost |
| `apps/mobile/src/screens/ParentalControl.tsx` | Delete missing session header, hardcoded localhost |
| `apps/mobile/src/lib/api.ts` | Consent fields added |
| `packages/shared/src/types/index.ts` | Consent fields correct |
| `packages/shared/src/i18n/en.json` | Complete key set |
| `packages/shared/src/i18n/es.json` | Complete translations |
| Test files (6 files) | API tests strong, web tests decent, mobile tests shallow |

## Verification

Tests, lint, and typecheck results from implementation phase:

- **Lint**: Clean (0 warnings)
- **Typecheck**: Web and Mobile clean. API has pre-existing errors only.
- **Tests**: 602 total (441 API + 85 Web + 76 Mobile) — all passing
