# Validation Report — Run 6 (post /t-review #2)

**Date**: 2026-04-02
**Branch**: mvp-to-product-6/post-launch-growth
**Scope**: Full re-validation of all 3 PRDs + Appendix A (review #2 fixes)

## Summary

| Result | Count |
|--------|-------|
| PASS   | 22    |
| FAIL   | 0     |
| SKIP   | 0     |

**All 22 checks pass.** No regressions from the review #2 fixes.

## Regression Tests

| Check | Result | Evidence |
|-------|--------|----------|
| API tests | **PASS** | 49 files, 555 tests — all green |
| Web tests | **PASS** | 17 files, 120 tests — all green |
| Mobile tests | **PASS** | 19 files, 161 tests — all green |
| ESLint | **PASS** | 0 errors, 0 warnings |
| **Total** | **PASS** | **836 tests passed** |

## Appendix A — Security Fixes

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 28 | `invite-code.ts` uses `crypto.randomInt` | **PASS** | Line 1: `import { randomInt } from 'node:crypto'`; Line 21: `ALPHABET[randomInt(ALPHABET.length)]`. No `Math.random` anywhere. |
| 29 | `subscription-guard.ts` JWT userId takes precedence | **PASS** | Line 34: `req.auth?.userId` checked first with IDOR prevention comment. Falls back to query/header only for anonymous. |
| 30 | `subscription/status/:userId` ownership check | **PASS** | Lines 16-29: After `requireAuth`, checks `req.auth.userId === req.params.userId` OR caller is parent. Returns 403 otherwise. |

## Appendix A — Performance Fixes

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 31 | Activity endpoint uses `groupBy` | **PASS** | Lines 370-396: Two `prisma.activityLog.groupBy` calls (by type for totals, by userId for active member count). No unbounded `findMany`. |
| 32 | `getSubscriptionStatus()` no redundant query | **PASS** | Lines 137-142: Passes pre-fetched `TierUserData` to `resolveEffectiveTier()` instead of re-querying. |
| 33 | `live-scores.ts` batched processing | **PASS** | Lines 257-267: `BATCH_SIZE = 5` with `Promise.all(batch.map(...))` replacing sequential for loop. |

## Appendix A — i18n Fixes

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 34 | `OrgMemberList.tsx` all strings via `t()` | **PASS** | Uses `t('org.today')`, `t('org.yesterday')`, `t('org.days_ago', ...)`, `t('org.sort_name')`, `t('org.sort_last_active')`, `t('org.sort_streak')`. All 7 keys present in both `en.json` and `es.json`. |
| 35 | `OrgActivityChart.tsx` aria-label via i18n | **PASS** | Line 41: `t('org.chart_bar_label', locale, ...)`. Key present in both locale files. |

## Appendix A — Error Handling

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 36 | `organizations/page.tsx` catch blocks set error | **PASS** | 4 catch blocks all call `setError(t('kid_errors.generic_message', locale))`. Error banner with `role="alert"` at line 141. |

## Appendix A — Other Fixes

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 37 | `Upgrade.tsx` WEB_BASE fallback | **PASS** | `FALLBACK_WEB_BASE = 'https://sportykids.app'`, used as `WEB_BASE \|\| FALLBACK_WEB_BASE` for legal links. |
| 38 | `live.ts` min teamName length >= 3 | **PASS** | Line 19: `if (teamName.length < 3) throw new ValidationError(...)` |
| 39 | Org update: slug stability | **PASS** | Lines 152-163: Compares `parsed.data.name !== currentOrg.name` before regenerating slug. |
| 40 | `OrgSettings.tsx` COLORS from shared | **PASS** | Line 4: `import { t, COLORS } from '@sportykids/shared'`. Uses `COLORS.blue` and `COLORS.green`. |

## Original PRD Regression Checks

| Check | Result | Evidence |
|-------|--------|----------|
| subscriptionGuard on news/reels/quiz | **PASS** | Present on 8 route handlers across 3 files |
| Webhook timingSafeEqual | **PASS** | `subscription.ts` uses `crypto.timingSafeEqual` with length pre-check |
| Family plan take:3 | **PASS** | `FAMILY_PLAN_MAX_CHILDREN = 3`, used in `take:` parameter |
| live-scores.test.ts | **PASS** | 24 tests passed |
| schedule-check.test.ts | **PASS** | 7 tests passed |
| push-sender-live.test.ts | **PASS** | 5 tests passed |
| invite-code.test.ts | **PASS** | 20 tests passed |
| require-org-admin.test.ts | **PASS** | 6 tests passed |
| organizations.test.ts | **PASS** | 15 tests passed |
| subscription.test.ts (org tier) | **PASS** | 23 tests passed (including org-based tier resolution) |

## Comparison with Previous Run (Run 5)

No regressions. Run 5 had 27/27 PASS for B2B Channel validation. Run 6 confirms all original checks still pass plus the 14 new Appendix A checks for review #2 fixes all pass.

## Evidence

- [checks-summary.json](run-6/output/checks-summary.json)
