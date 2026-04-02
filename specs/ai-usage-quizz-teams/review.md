# Code Review: Groq AI Provider + Explicar Fácil Mobile

## Summary

The implementation satisfies every PRD requirement with clean, minimal diffs. The Groq provider follows the established pattern for OpenAI-compatible providers exactly, and the mobile `NewsCard` feature is complete and accessible. There are two real issues to fix: a test that cannot actually exercise the error-throw path as written (the `providerAvailable` cache blocks it), and a missing `accessibilityHint` on the explain button compared to the heart button's own pattern. The remaining items are low-priority suggestions. No security or data-flow problems were found.

---

## PRD Compliance

| Requirement | Source | Status | Notes |
|---|---|---|---|
| `AIProvider` union includes `'groq'` | §4.1.1 | PASS | Line 12 of `ai-client.ts` |
| `getModelName` returns `llama-3.1-8b-instant` for groq (both purposes) | §4.1.2 | PASS | Lines 104 and 111 |
| `isProviderAvailable` checks `GROQ_API_KEY` presence | §4.1.3 | PASS | Lines 140–141 |
| `dispatch` case 'groq' guards key, uses `sendViaOpenAICompat` with correct base URL | §4.1.4 | PASS | Lines 329–340 |
| `GROQ_BASE_URL` env var overrides base URL | §4.1.4 | PASS | Line 338 |
| `GROQ_MODEL` env var overrides model | §4.1.2 | PASS | Lines 104, 111 |
| No new npm package needed | D2 | PASS | Uses existing `openai` SDK |
| `fetchNewsSummary` already exists in `api.ts`, no changes needed | §4.3 | PASS | Lines 162–170 of `api.ts` |
| "Explain it Easy" button present in mobile `NewsCard` | §4.2.2–4.2.5 | PASS | Lines 157–168 of `NewsCard.tsx` |
| Two-button `actionRow` layout | §4.2.5 | PASS | Lines 138–169 |
| Summary panel shows loading/error/success states | §4.2.5 | PASS | Lines 172–196 |
| `LayoutAnimation.configureNext` called before state update | D4, §4.2.3 | PASS | Lines 48–49 |
| `summaryFetched` ref prevents duplicate API calls | D5, AC-7 | PASS | Lines 32, 52 |
| Empty string treated as error (AC-8) | D6, §4.2.3 | PASS | Lines 59–62 |
| `accessibilityRole="button"` and `accessibilityState={{ expanded }}` on explain button | AC-4 | PASS | Lines 161–162 |
| `accessibilityLabel` uses `summary.explain_easy` key | AC-4 | PASS | Line 163 |
| `explainButtonActive` style turns yellow when open | AC-5 | PASS | Lines 319–322 |
| All UI strings use `t(key, locale)` — no hardcoded text | CLAUDE.md | PASS | All new strings use `t()` |
| All identifiers in English | CLAUDE.md | PASS | No Spanish identifiers introduced |
| `summary.*` i18n keys exist in both `es.json` and `en.json` | PRD §9 (no changes needed claim) | PASS | `explain_easy`, `adapted_for_age`, `loading`, `error` confirmed present |
| `CLAUDE.md` updated with Groq env vars | §4.4 | PASS | (per implementation-notes.md) |
| Unit tests for ai-client (Groq availability, dispatch error, model, base URL) | §7.1 | PARTIAL — see Critical #1 |
| Unit tests for mobile NewsCard | §7.2 | PARTIAL — see Warning #1 |

---

## TODO: Critical Issues (must fix)

- [ ] **`apps/api/src/services/__tests__/ai-client.test.ts:90-103`** — The "throws AIServiceError when GROQ_API_KEY is empty" test cannot reach the `dispatch` guard. The module is imported with `GROQ_API_KEY=gsk_key`, so `isProviderAvailable()` sets `providerAvailable = true` and caches it for 60 s. Clearing the key with `vi.stubEnv('GROQ_API_KEY', '')` **after** the import does not reset `providerAvailable`, so `sendMessage` passes the availability check, enters `dispatch`, reads the now-empty env var, and throws — this accidentally works, but only because the 60-second cache happens to have a stale `true` value from the earlier stub. The test is fragile: if `vi.resetModules()` in `beforeEach` runs after another test that left `providerAvailable = false`, this test will throw an `AIServiceError` for the wrong reason (`provider not available` instead of `GROQ_API_KEY is required`). Fix: after `vi.stubEnv('GROQ_API_KEY', '')`, also call `vi.stubEnv('AI_PROVIDER', 'groq')` again and import **freshly** so that `providerAvailable` is `null`. To force dispatch to run with no key, set `GROQ_API_KEY` only after `isProviderAvailable` is bypassed — the simplest fix is to do a fresh import with `GROQ_API_KEY=''` so `isProviderAvailable` returns `false` immediately, then verify the error message is "not available" (which is also a valid test for the graceful-degradation path). Alternatively, split into two tests: one for the availability-false path and one mocking `isProviderAvailable` to return `true`.

---

## TODO: Warnings (should fix)

- [ ] **`apps/mobile/src/components/__tests__/NewsCard.test.tsx` (all tests)** — All 13 tests use `NewsCard.toString()` to assert identifier presence. This approach tests that the source code *contains certain strings* rather than that the component *behaves correctly at runtime*. It will give false positives if an identifier is present but unreachable (dead branch), and it will not catch regressions where, for example, `summaryFetched.current` is set before the fetch succeeds (causing the error state to be shown on retry). The PRD (§7.2) explicitly requests behavioral tests: "Pressing the button calls `fetchNewsSummary` once", "While loading, renders `ActivityIndicator`", etc. Given the project uses `vitest` without a full React Native renderer in this environment, the current approach is a pragmatic workaround — but the implementation-notes.md acknowledges it as a limitation. At minimum, add a comment in the test file explaining why source-inspection is used instead of rendering, so future maintainers do not mistake it for the intended testing strategy.

- [ ] **`apps/mobile/src/components/NewsCard.tsx:163`** — The explain button has `accessibilityLabel` and `accessibilityRole` but no `accessibilityHint`, unlike the heart button (line 91) which has `accessibilityHint={t('a11y.news_card.save_hint', locale)}`. For a button whose behaviour (expanding a hidden panel) is non-obvious, a hint such as `t('a11y.news_card.explain_hint', locale)` would improve the screen-reader experience for the 6-14 age group this app targets. The i18n key would need to be added to `es.json` / `en.json`.

---

## TODO: Suggestions (nice to have)

- [ ] **`apps/api/src/services/ai-client.ts:113`** — The fallback `return 'llama3.2'` at the bottom of `getModelName` is now unreachable because all four providers are handled by explicit `if` guards before it. Consider adding a TypeScript exhaustive-check comment or removing the dead fallback to reduce noise. The compiler does not catch this because `AIProvider` is a string union and the function's return type is inferred as `string`.

- [ ] **`apps/api/src/services/__tests__/ai-client.test.ts:74-86`** — The two tests for `openrouter` and `anthropic` availability (lines 74-86) are included in a `describe` block titled "ai-client — Groq provider". They belong in a separate describe for clarity, or in the existing provider tests if such a block exists, rather than being mixed into the Groq-specific suite.

- [ ] **`apps/mobile/src/components/NewsCard.tsx:57`** — `user?.age ?? 10` silently defaults to age 10 (mapping to age range 9-11) for users without an `age` field. The PRD documents this is intentional and matches the web's `userAge` derivation. A short inline comment would make the intent explicit for the next developer.

---

## Technical Debt Assessment

No new technical debt was introduced. The implementation is consistent with the existing codebase patterns: Groq follows the exact same code path as OpenRouter, and the mobile feature mirrors the web's `AgeAdaptedSummary` approach. The only pre-existing concern carried into this diff is the source-inspection test strategy for mobile, which is acknowledged in the implementation notes.

---

## Files Reviewed

| File | Notes |
|---|---|
| `apps/api/src/services/ai-client.ts` | Clean. The Groq case is a minimal, correct addition. Types, error handling, env var patterns, and the singleton all conform to the established structure. |
| `apps/mobile/src/components/NewsCard.tsx` | Clean. All new state, handler, JSX, and styles match the PRD spec. `LayoutAnimation.configureNext` is correctly called before the state update. All UI strings use `t()`. No hardcoded user-visible text. |
| `apps/mobile/vitest.setup.ts` | `Animated.sequence` and `LayoutAnimation` mocks are correctly placed in the `react-native` mock object. No issues. |
| `apps/api/src/services/__tests__/ai-client.test.ts` | Good coverage of model resolution and base URL. The dispatch-error test has a fragile dependency on module-singleton state (see Critical #1). |
| `apps/mobile/src/components/__tests__/NewsCard.test.tsx` | All 13 assertions pass the intent check but are source-inspection rather than behavioral (see Warning #1). Mock setup and `beforeEach` cleanup are correct. |
| `apps/mobile/src/lib/api.ts` — `fetchNewsSummary` | Confirmed at lines 162-170: signature matches what `NewsCard.tsx` passes (`newsId: string, age: number, locale: string`). No changes needed, no issues. |
| `packages/shared/src/i18n/es.json` | `summary.explain_easy`, `summary.adapted_for_age`, `summary.loading`, `summary.error` all confirmed present. |
| `packages/shared/src/i18n/en.json` | Same four keys confirmed present. |

---

## Verification

Run on 2026-04-02. All suites run independently from repo root.

| Suite | Files | Tests | Result |
|---|---|---|---|
| API (`apps/api`) | 50 | 565 | ✅ All pass |
| Web (`apps/web`) | 17 | 120 | ✅ All pass |
| Mobile (`apps/mobile`) | 20 | 174 | ✅ All pass |
| **Total** | **87** | **859** | ✅ |

**Lint**: `eslint .` — no errors, no warnings.

**TypeCheck**: Pre-existing errors exist in `push-sender.ts`, `redis-cache.ts`, `subscription.ts`, `ErrorBoundary.tsx`, `ParentalControl.tsx`, `Reels.tsx` (all on `main`, unrelated to this feature). No new typecheck errors introduced by this diff.

Note: the dispatch-error test (Critical #1) currently passes due to incidental cache state. The issue will manifest if test ordering changes. Reproduce by running that single test in isolation first.
