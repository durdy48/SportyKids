# Implementation Notes — prd.md (Groq AI Provider + Explicar Fácil Mobile)

## Summary

Implemented Groq as a new AI provider and added the "Explain it Easy" feature to the mobile `NewsCard` component. The web app already had `AgeAdaptedSummary` via the existing `/api/news/:id/summary` endpoint; this PRD adds mobile parity and Groq provider support.

## Files Modified

### API
- **`apps/api/src/services/ai-client.ts`** — Added `'groq'` to `AIProvider` type, `getModelName` (default `llama-3.1-8b-instant`), `isProviderAvailable` check (`GROQ_API_KEY`), and `dispatch` case using `sendViaOpenAICompat` with Groq base URL (`https://api.groq.com/openai/v1`). No changes to existing providers.

### Mobile
- **`apps/mobile/src/components/NewsCard.tsx`** — Added "Explain it Easy" button and collapsible summary panel. New state: `showSummary`, `summaryData`, `summaryLoading`, `summaryError`, `summaryFetched` (ref guard). Calls `fetchNewsSummary(item.id, user?.age ?? 10, locale)`. Uses `LayoutAnimation.configureNext(Presets.easeInEaseOut)` for smooth expand/collapse. Action row now has two buttons side by side: "Read more" and "✨ Explain it Easy".
- **`apps/mobile/vitest.setup.ts`** — Added `Animated.sequence` and `LayoutAnimation` mocks (both were missing from the react-native mock).

### Tests (new files)
- **`apps/api/src/services/__tests__/ai-client.test.ts`** — 10 tests covering Groq `isProviderAvailable`, dispatch error without key, model name resolution (default + override), and base URL (default + override). Pattern: `vi.resetModules()` + `vi.doMock('openai', ...)` + dynamic imports per test.
- **`apps/mobile/src/components/__tests__/NewsCard.test.tsx`** — 13 source-inspection tests verifying all "Explain it Easy" behaviors (button keys, a11y, API call params, dedup ref, loading/error/success states, animation, styles).

### Documentation
- **`CLAUDE.md`** — Added Groq env vars (`GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_BASE_URL`), updated `AI_PROVIDER` values, updated AI note and MVP status table.

## Key Decisions

### Groq via openai SDK
Groq's API is OpenAI-compatible, so `sendViaOpenAICompat` (already used by Ollama and OpenRouter) works without changes. Only a new `case 'groq'` in `dispatch` was needed.

### Test isolation for ai-client
`ai-client.ts` has module-level singletons (`providerAvailable` cache, `instance`). Tests use `vi.resetModules()` + `vi.doMock('openai', ...)` + dynamic `import('../ai-client')` inside each `it` block. `vi.doMock` (not hoisted, unlike `vi.mock`) is called after `vi.resetModules()` to correctly register the openai mock before the fresh module import.

### Source-inspection tests for NewsCard
Mobile NewsCard renders to React Native primitives that can't be fully rendered in vitest (no jsdom, no RN runtime). Used `.toString()` on the component function to assert the presence of required identifiers, translation keys, and style names. This avoids react-test-renderer setup while still verifying the implementation.

### LayoutAnimation for collapse animation
Used React Native's built-in `LayoutAnimation` (no extra library) with `Presets.easeInEaseOut` for the summary panel expand/collapse. The `configureNext` call must happen before the state update that triggers the layout change.

## Test Results

- API: 565 tests (50 files) — all pass
- Web: 120 tests (17 files) — all pass
- Mobile: 174 tests (20 files) — all pass

## Known Issues / Notes

- The `cache.test.ts` test can be flaky when run alongside all API tests in the same process (shared in-memory cache state). Passes reliably in isolation. Pre-existing issue, unrelated to this PRD.
- `GROQ_API_KEY` is not required (Groq is optional, same as other AI providers). Without it, `isProviderAvailable()` returns false and AI features degrade gracefully.
