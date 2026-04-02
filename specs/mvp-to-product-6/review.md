# Code Review: Phase 6 — Post-Launch Growth (Round 3)

| Field | Value |
|-------|-------|
| **Reviewer** | Claude Opus 4.6 |
| **Date** | 2026-04-02 |
| **Assessment** | Pass with notes |
| **Round** | 3 (after 2 rounds of fixes) |
| **PRDs** | prd.md (6.1 Subscription), prd2.md (6.2 Live Scores), prd3.md (6.3 B2B Organizations) |

## Summary

The codebase is in good shape after two rounds of fixes. Code is well-structured, properly typed, uses i18n consistently, and follows security best practices. No critical issues remain. Found 3 warnings (race conditions in org operations, string replace behavior) and 5 suggestions (accessibility, dead code, test quality).

## PRD Compliance

All requirements satisfied across all 3 PRDs. Subscription tiers, live scores, B2B organizations, and related UI are implemented across API, web, and mobile.

## TODO: Critical Issues (must fix)

None

## TODO: Warnings (should fix)

- [x] **apps/api/src/routes/organizations.ts:63-93** — Organization creation is not atomic. The flow does: check user has no org -> create org -> update user as admin. If create succeeds but user update fails, there's an orphaned org. Also, concurrent requests from same user could both pass the `existingUser.organizationId` check (TOCTOU). Wrap lines 76-93 in `prisma.$transaction()`.

- [x] **apps/api/src/routes/auth.ts:618-664** — Join-organization check-then-act race condition. Two concurrent requests with the same invite code could both pass the capacity check and exceed `maxMembers`. Wrap in `prisma.$transaction()` with serializable isolation or add a unique constraint guard.

- [x] **apps/api/src/services/live-scores.ts:219-222** — `buildNotificationPayload` uses `String.replace()` which only replaces the first occurrence of each placeholder. If a template contains `{homeTeam}` twice, only the first gets replaced. Use `replaceAll()` instead: `title = title.replaceAll(key, value); body = body.replaceAll(key, value);`

## TODO: Suggestions (nice to have)

- [x] **apps/api/src/services/invite-code.ts:31** — `isValidCodeFormat()` is not used in production code (only in tests). Either integrate it into the join validation path or remove it as dead code.

- [x] **apps/mobile/src/screens/JoinOrganization.tsx:1** — `React` is imported but not needed with modern JSX transform. Unused import.

- [x] **apps/web/src/components/OrgSettings.tsx + JoinOrgModal.tsx** — Both modals have `role="dialog"` and `aria-modal="true"` but lack keyboard Escape handler and focus trapping. Users can tab outside the modal.

- [x] **apps/web/src/components/OrgMemberList.tsx:91 + organizations/page.tsx:76** — `confirm()` is not i18n-friendly — the OK/Cancel buttons appear in the browser's language, not the app's locale.

- [x] **apps/api/src/routes/organizations.ts:405-416** — Activity daily breakdown `findMany` with `take: 10000` could still be large for 500-member orgs over period=`all`. Consider a stricter cap for `all` period or paginating the daily breakdown.

## Technical Debt Assessment

**Net effect: Positive.** The Phase 6 code is well-organized and follows established patterns. The main remaining debt items are:
1. **Non-atomic multi-step operations** (W1, W2) — org creation and joining should use transactions to prevent race conditions under concurrent load.
2. **String replace semantics** (W3) — a correctness issue that would surface with specific i18n templates.
3. **Modal accessibility** (S3) — functional but could be more robust with focus traps.

Overall code quality is high. No security vulnerabilities, no type safety issues, no dead code of concern.

## Verification

```
Lint:    PASS — 0 errors, 0 warnings
API:     555 tests passed (49 files)
Web:     120 tests passed (17 files)
Mobile:  161 tests passed (19 files)
Total:   836 tests passed
```

## Files Reviewed

| # | File | Notes |
|---|------|-------|
| 1 | `apps/api/src/services/subscription.ts` | Clean. Tier resolution correct. |
| 2 | `apps/api/src/middleware/subscription-guard.ts` | Clean. IDOR prevention via JWT. |
| 3 | `apps/api/src/routes/subscription.ts` | Clean. Timing-safe auth, ownership check. |
| 4 | `apps/api/src/services/live-scores.ts` | W3: `replace` → `replaceAll`. |
| 5 | `apps/api/src/services/schedule-check.ts` | Clean. Timezone handling correct. |
| 6 | `apps/api/src/services/push-sender.ts` | Clean. Batch fetch avoids N+1. |
| 7 | `apps/api/src/services/invite-code.ts` | S1: `isValidCodeFormat` unused in production. |
| 8 | `apps/api/src/middleware/require-org-admin.ts` | Clean. |
| 9 | `apps/api/src/routes/organizations.ts` | W1: Non-atomic creation. S5: Large result set. |
| 10 | `apps/api/src/routes/live.ts` | Clean. |
| 11 | `apps/api/src/jobs/live-scores.ts` | Clean. Batched, cleanup logic. |
| 12 | `apps/mobile/src/screens/Upgrade.tsx` | Clean. i18n, a11y, fallback URL. |
| 13 | `apps/mobile/src/components/LimitReachedModal.tsx` | Clean. |
| 14 | `apps/mobile/src/screens/JoinOrganization.tsx` | S2: Unused React import. |
| 15 | `apps/web/src/app/upgrade/page.tsx` | Clean. |
| 16 | `apps/web/src/app/organizations/page.tsx` | S4: `confirm()` not i18n-friendly. |
| 17 | `apps/web/src/components/JoinOrgModal.tsx` | S3: No focus trap. |
| 18 | `apps/web/src/components/OrgActivityChart.tsx` | Clean. |
| 19 | `apps/web/src/components/OrgActivitySummary.tsx` | Clean. |
| 20 | `apps/web/src/components/OrgMemberList.tsx` | S4: `confirm()` not i18n-friendly. |
| 21 | `apps/web/src/components/OrgSettings.tsx` | S3: No focus trap. |
| 22 | `apps/api/src/routes/auth.ts` (join-org) | W2: Race condition on join. |
| 23 | `apps/api/src/routes/users.ts` (live-scores) | Clean. |
| 24 | `packages/shared/src/types/index.ts` | Clean. Well-typed. |
| 25 | `packages/shared/src/constants/index.ts` | Clean. |
| 26 | `packages/shared/src/constants/errors.ts` | Clean. |
| 27 | `apps/api/src/services/__tests__/subscription.test.ts` | Good coverage. |
| 28 | `apps/api/src/routes/__tests__/organizations.test.ts` | Adequate. |
| 29 | `apps/api/src/services/__tests__/live-scores.test.ts` | Good coverage. |
