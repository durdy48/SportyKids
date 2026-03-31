# Implementation Notes — Legal & Compliance Foundation

## prd.md implementation

### Summary

Implemented all 6 core features from the PRD: Age Gate, Legal Pages, Data Deletion, Analytics Consent Gate, i18n keys, and Legal Links integration. All features work across API, Web, and Mobile platforms.

### Files Created

| File | Purpose |
|------|---------|
| `apps/api/prisma/migrations/20260330161817_add_consent_fields/migration.sql` | Prisma migration adding consent fields to User |
| `apps/web/src/app/age-gate/page.tsx` | Age gate page with 3 paths (adult/teen/child) |
| `apps/web/src/app/privacy/page.tsx` | Privacy Policy page (ES/EN, public) |
| `apps/web/src/app/terms/page.tsx` | Terms of Service page (ES/EN, public) |
| `apps/mobile/src/screens/AgeGate.tsx` | Mobile age gate screen |
| `apps/api/src/__tests__/user-consent.test.ts` | 6 tests for consent field CRUD |
| `apps/api/src/__tests__/data-deletion.test.ts` | 8 tests for DELETE endpoint |
| `apps/api/src/__tests__/analytics-consent.test.ts` | 3 tests for shouldTrackUser |
| `apps/web/src/__tests__/age-gate.test.tsx` | 6 tests for age gate page |
| `apps/web/src/__tests__/legal-pages.test.tsx` | 10 tests for privacy/terms pages |
| `apps/mobile/src/screens/__tests__/AgeGate.test.tsx` | 3 tests for mobile age gate |

### Files Modified

| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Added `ageGateCompleted`, `consentGiven`, `consentDate`, `consentBy` to User |
| `apps/api/src/routes/users.ts` | Consent fields in POST/PUT/GET + new DELETE /:id/data endpoint |
| `apps/api/src/services/monitoring.ts` | Added `shouldTrackUser()`, gated PostHog on consent |
| `apps/web/src/lib/api.ts` | Added `deleteUserData()` function |
| `apps/web/src/lib/analytics.ts` | Gated PostHog init on consent parameter |
| `apps/web/src/lib/user-context.tsx` | Age gate redirect + analytics consent init |
| `apps/web/src/components/ParentalPanel.tsx` | Danger zone (delete account) + legal links footer |
| `apps/web/src/components/OnboardingWizard.tsx` | Legal links in step 1 |
| `apps/mobile/src/navigation/index.tsx` | AgeGate screen + navigation guard |
| `apps/mobile/src/screens/Login.tsx` | Legal links footer |
| `apps/mobile/src/screens/Register.tsx` | Legal links footer |
| `apps/mobile/src/screens/Onboarding.tsx` | Legal links in step 1 |
| `apps/mobile/src/screens/ParentalControl.tsx` | Delete account section + legal links + timeChip styles |
| `apps/mobile/src/lib/api.ts` | Consent fields in CreateUserData |
| `apps/mobile/vitest.setup.ts` | Mock for expo-web-browser |
| `packages/shared/src/types/index.ts` | Consent fields on User interface |
| `packages/shared/src/i18n/en.json` | age_gate, legal, delete_account keys |
| `packages/shared/src/i18n/es.json` | age_gate, legal, delete_account keys (Spanish) |

### Dependency Added

- `expo-web-browser` — added to `apps/mobile` for in-app browser legal page links

### Test Results

| Suite | Files | Tests |
|-------|-------|-------|
| API | 42 | 441 (17 new) |
| Web | 16 | 85 (16 new) |
| Mobile | 12 | 76 (7 new) |
| **Total** | **70** | **602** |

### Design Decisions Made During Implementation

1. **Privacy/Terms page content**: Rendered inline per locale (not via i18n keys) due to the length of legal text. i18n keys are used for labels (title, back, last_updated).

2. **`[LEGAL REVIEW REQUIRED]` markers**: Highlighted with yellow background component (`LegalReviewBanner`) on legal pages for visibility.

3. **Age gate redirect**: Implemented in `UserProvider` effect (web) and navigation guard (mobile). Exempt paths: `/age-gate`, `/privacy`, `/terms`.

4. **Delete endpoint authorization**: Uses JWT auth + parental session header (`X-Parental-Session`). For child accounts with a `ParentalProfile`, a valid session is required. Self-delete allowed for adults/teens.

5. **Analytics gating**: `shouldTrackUser()` on API checks DB per call. On web, PostHog initialization is deferred until consent is confirmed. Server-level Sentry errors (no user context) still captured.

6. **Mobile legal links**: Open via `expo-web-browser` pointing to web URLs rather than native screens to avoid content duplication.

### Known Issues

1. **Pre-existing flaky test**: `pin-lockout.test.ts` "locks after 5 failed attempts" occasionally fails when run in full suite but passes in isolation (test isolation issue, not a real bug).

2. **Legal text drafts**: All `[LEGAL REVIEW REQUIRED]` sections need review by a qualified attorney before production use. Contact email and physical address placeholders need filling in.

3. **Pre-existing API typecheck errors**: `monitoring.ts` (Sentry types), `mission-generator.ts`, `redis-cache.ts`, and vitest/vite type resolution issues exist but are pre-existing and unrelated to this feature.
