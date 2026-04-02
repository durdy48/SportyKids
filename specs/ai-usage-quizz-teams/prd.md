# PRD: Groq AI Provider Integration + "Explain it Easy" on Mobile

**Document version**: 1.0
**Date**: 2026-04-02
**Status**: Ready for implementation
**Target branch**: `feature/groq-explain-easy`

---

## 1. Overview

SportyKids includes an age-adapted summary feature called "Explain it Easy" ("Explicar Fácil"). When a child taps the button on a news card, the backend calls an AI model to rewrite the article at the child's reading level (6-8, 9-11, or 12-14 years old) in their preferred language. The summary is cached in the `NewsSummary` table so subsequent requests are instant.

The feature is fully built on the web app but is **broken in production** because the default AI provider (Ollama) is not available on Fly.io. As a result the backend returns an empty string and the web UI displays an error state. The mobile app does not have the feature at all.

This PRD describes two changes:

1. **Add Groq as a new AI provider** in `apps/api/src/services/ai-client.ts` so summaries work in production without running a local Ollama instance.
2. **Build the "Explain it Easy" button and summary panel in the mobile NewsCard** (`apps/mobile/src/components/NewsCard.tsx`) to bring the mobile app to feature-parity with the web.

---

## 2. Goals

| # | Goal | Success metric |
|---|------|----------------|
| G1 | Summaries work in Fly.io production | `GET /api/news/:id/summary` returns a non-empty string when `AI_PROVIDER=groq` and `GROQ_API_KEY` is set |
| G2 | Mobile has "Explain it Easy" | The button appears on every NewsCard on mobile; tapping it fetches and displays the summary |
| G3 | Graceful degradation | If Groq is down or the key is missing, the API returns an empty string (no crash); the mobile UI shows the error state |
| G4 | Minimal diff | The Groq provider reuses the existing `sendViaOpenAICompat` helper — no new SDK required |

---

## 3. Out of Scope

- Changes to the web app UI (already works, just needs the backend provider fix).
- Caching layer changes (the `NewsSummary` Prisma model already handles deduplication).
- Changes to the quiz question generator or any other AI consumer beyond the summarizer.
- A provider selection UI (switching providers remains an env-var concern).
- Streaming responses.
- Support for any Groq model other than `llama-3.1-8b-instant` (it covers all three age ranges well within the free tier).

---

## 4. Technical Requirements

### 4.1 `apps/api/src/services/ai-client.ts` — Add Groq Provider

#### 4.1.1 Type changes

Extend the `AIProvider` union type (line 12):

```typescript
// Before
export type AIProvider = 'ollama' | 'openrouter' | 'anthropic';

// After
export type AIProvider = 'ollama' | 'openrouter' | 'anthropic' | 'groq';
```

#### 4.1.2 `getModelName` — add Groq model resolution (inside the existing function, after the `anthropic` block)

```typescript
if (cfg.provider === 'groq') {
  return process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
}
```

This applies identically for both `moderation` and `generation` purposes because the same model is used for both on Groq's free tier.

#### 4.1.3 `isProviderAvailable` — add Groq health check (after the `anthropic` block)

```typescript
} else if (cfg.provider === 'groq') {
  providerAvailable = !!process.env.GROQ_API_KEY;
}
```

The pattern mirrors the `openrouter` check: if the key is present we treat the provider as available. An actual HTTP ping is unnecessary because Groq's free tier is always on and latency is ~300 ms.

#### 4.1.4 `dispatch` — add Groq case (before the `default` case)

```typescript
case 'groq': {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AIServiceError(
      'GROQ_API_KEY is required when AI_PROVIDER=groq',
      'groq',
      { retryable: false },
    );
  }
  const baseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
  return sendViaOpenAICompat(baseUrl, apiKey, model, messages, 'groq');
}
```

`sendViaOpenAICompat` already exists and accepts any OpenAI-compatible base URL, so no new helper is needed.

#### 4.1.5 `AIClientConfig` — no changes needed

The config struct reads `AI_PROVIDER` from env at call time. Adding `groq` to the union type is the only config change required.

---

### 4.2 `apps/mobile/src/components/NewsCard.tsx` — Add "Explain it Easy" Button and Summary Panel

#### 4.2.1 UI Layout (ASCII mockup)

```
┌─────────────────────────────────────────┐
│  [Image or no-image area]               │
│  [Sport badge]          [Heart button]  │
├─────────────────────────────────────────┤
│  TITLE (2 lines max)                    │
│  Summary preview (2 lines, gray)        │
│  Source · Date            🔥 Trending   │
│                                         │
│  ┌───────────────┐  ┌─────────────────┐ │
│  │  Read more →  │  │  ✨ Explain easy│ │ ← NEW button
│  └───────────────┘  └─────────────────┘ │
│                                         │
│  ╔═══════════════════════════════════╗  │ ← Animated panel
│  ║ [Adapted for ages 9-11]           ║  │   (height: 0 → auto)
│  ║                                   ║  │
│  ║  The article text rewritten for   ║  │
│  ║  children...                      ║  │
│  ╚═══════════════════════════════════╝  │
│                                         │
│  You might also like                    │
│   ⚽ Related article title 1           │
│   🏀 Related article title 2           │
└─────────────────────────────────────────┘
```

The summary panel animates open/closed using `LayoutAnimation.configureNext` from React Native (no external library required, runs on the native driver).

#### 4.2.2 New state variables

Add the following `useState` and `useRef` declarations at the top of the `NewsCard` component, alongside the existing ones:

```typescript
const [showSummary, setShowSummary] = useState(false);
const [summaryData, setSummaryData] = useState<{
  summary: string;
  ageRange: string;
} | null>(null);
const [summaryLoading, setSummaryLoading] = useState(false);
const [summaryError, setSummaryError] = useState(false);
const summaryFetched = useRef(false);
```

#### 4.2.3 `handleExplain` function

Add this handler inside the component, after `handleToggleFavorite`:

```typescript
const handleExplain = async () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  const next = !showSummary;
  setShowSummary(next);

  if (next && !summaryFetched.current) {
    summaryFetched.current = true;
    setSummaryLoading(true);
    setSummaryError(false);
    try {
      const age = user?.age ?? 10;
      const data = await fetchNewsSummary(item.id, age, locale);
      if (data.summary) {
        setSummaryData({ summary: data.summary, ageRange: data.ageRange });
      } else {
        setSummaryError(true);
      }
    } catch {
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
    }
  }
};
```

**Notes:**
- `LayoutAnimation.configureNext` must be called **before** the state change that triggers re-render. The `easeInEaseOut` preset gives a smooth height animation.
- `summaryFetched.current` prevents re-fetching when the user closes and reopens the panel for the same card.
- If the API returns `summary: ""` (empty string, which happens when the provider is down), we show the error state rather than blank content.
- `user?.age ?? 10` mirrors the web's `userAge` derivation.

#### 4.2.4 Required import additions

Add to the top-level imports:

```typescript
import { LayoutAnimation, ActivityIndicator } from 'react-native';
import { fetchNewsSummary } from '../lib/api';
```

`LayoutAnimation` is already part of `react-native` — no new package needed.

#### 4.2.5 JSX additions

**"Explain it Easy" button** — place it in a new `flexDirection: 'row'` wrapper alongside the existing "Read more" button:

```tsx
{/* Action buttons row */}
<View style={styles.actionRow}>
  <TouchableOpacity
    style={styles.readButton}
    accessible={true}
    accessibilityLabel={t('a11y.news_card.read', locale, { title: item.title })}
    accessibilityRole="link"
    onPress={() => {
      Linking.openURL(item.sourceUrl);
      if (!showRelated && related.length === 0) {
        fetchRelatedArticles(item.id, 3).then((res) => {
          setRelated(res.related);
          if (res.related.length > 0) setShowRelated(true);
        }).catch(() => {});
      }
    }}
  >
    <Text style={styles.readButtonText}>{t('buttons.read_more', locale)}</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.explainButton, showSummary && styles.explainButtonActive]}
    onPress={handleExplain}
    accessible={true}
    accessibilityRole="button"
    accessibilityState={{ expanded: showSummary }}
    accessibilityLabel={t('summary.explain_easy', locale)}
  >
    <Text style={[styles.explainButtonText, showSummary && styles.explainButtonTextActive]}>
      {'\u2728'} {t('summary.explain_easy', locale)}
    </Text>
  </TouchableOpacity>
</View>
```

**Summary panel** — place it immediately after the action buttons row and before the related section:

```tsx
{showSummary && (
  <View style={styles.summaryPanel}>
    {summaryLoading && (
      <View style={styles.summaryLoading}>
        <ActivityIndicator size="small" color={COLORS.blue} />
        <Text style={styles.summaryLoadingText}>{t('summary.loading', locale)}</Text>
      </View>
    )}

    {summaryError && !summaryLoading && (
      <Text style={styles.summaryError}>{t('summary.error', locale)}</Text>
    )}

    {summaryData && !summaryLoading && !summaryError && (
      <View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>
            {t('summary.adapted_for_age', locale, { range: summaryData.ageRange })}
          </Text>
        </View>
        <Text style={styles.summaryText}>{summaryData.summary}</Text>
      </View>
    )}
  </View>
)}
```

#### 4.2.6 New StyleSheet entries

The existing `button` and `buttonText` styles should be renamed to `readButton` and `readButtonText` for clarity (only referenced inside this component). Add these new styles:

```typescript
actionRow: {
  flexDirection: 'row',
  gap: 8,
  marginBottom: 4,
},
readButton: {
  flex: 1,
  backgroundColor: COLORS.blue,
  paddingVertical: 10,
  borderRadius: 12,
  alignItems: 'center',
},
readButtonText: {
  color: '#fff',
  fontSize: 14,
  fontWeight: '600',
},
explainButton: {
  flex: 1,
  paddingVertical: 10,
  borderRadius: 12,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: 'transparent',
},
explainButtonActive: {
  backgroundColor: '#FACC15',
  borderColor: '#FACC15',
},
explainButtonText: {
  fontSize: 13,
  fontWeight: '600',
  color: colors.muted,
},
explainButtonTextActive: {
  color: '#1E293B',
},
summaryPanel: {
  marginTop: 8,
  backgroundColor: colors.background,
  borderLeftWidth: 3,
  borderLeftColor: COLORS.blue,
  borderRadius: 8,
  padding: 12,
  marginBottom: 4,
},
summaryLoading: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
summaryLoadingText: {
  fontSize: 12,
  color: colors.muted,
},
summaryError: {
  fontSize: 13,
  color: colors.muted,
},
summaryBadge: {
  alignSelf: 'flex-start',
  backgroundColor: '#22C55E',
  borderRadius: 20,
  paddingHorizontal: 10,
  paddingVertical: 3,
  marginBottom: 8,
},
summaryBadgeText: {
  fontSize: 11,
  fontWeight: '600',
  color: '#fff',
},
summaryText: {
  fontSize: 13,
  color: colors.text,
  lineHeight: 20,
},
```

#### 4.2.7 `ThemeColors` usage

The component already receives `colors` from `useUser()`. Check that `colors.background` and `colors.muted` are defined on the `ThemeColors` type in `apps/mobile/src/lib/theme.ts` before using them in the styles. If `background` or `muted` are missing, add them following the existing pattern.

---

### 4.3 `apps/mobile/src/lib/api.ts` — `fetchNewsSummary` already exists

Inspection of `apps/mobile/src/lib/api.ts` confirms that `fetchNewsSummary` is **already present** at lines 162-170:

```typescript
export async function fetchNewsSummary(
  newsId: string,
  age: number,
  locale: string,
): Promise<{ summary: string; ageRange: string; generatedAt: string }> {
  const res = await authFetch(`${API_BASE}/news/${newsId}/summary?age=${age}&locale=${locale}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}
```

No changes are needed to `api.ts`. The import in `NewsCard.tsx` simply needs to be added.

---

### 4.4 `CLAUDE.md` — Document new env vars

Add the following rows to the "Variables de entorno" table:

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `AI_PROVIDER` | No | `ollama` (default), `openrouter`, `anthropic`, **`groq`** |
| `GROQ_API_KEY` | Sí (si `AI_PROVIDER=groq`) | Groq API key. Obtener en console.groq.com |
| `GROQ_BASE_URL` | No | Override del endpoint Groq (default: `https://api.groq.com/openai/v1`) |
| `GROQ_MODEL` | No | Override del modelo Groq (default: `llama-3.1-8b-instant`) |

---

## 5. Implementation Decisions

### D1 — Groq uses the existing OpenAI-compatible helper

Groq's Chat Completions API is 100% compatible with the OpenAI SDK. The existing `sendViaOpenAICompat` function accepts a `baseUrl` and `apiKey`, so adding Groq requires zero new code paths — only a new `case` in `dispatch` and a new `else if` in `isProviderAvailable`. This is the minimum viable change.

### D2 — No new npm package for Groq

The project already has `openai` as a dependency. Groq does not require `@groq-sdk` when using the OpenAI-compatible endpoint. Adding a package would increase bundle size and add maintenance overhead for no benefit.

### D3 — Model: `llama-3.1-8b-instant`

This model is available on Groq's free tier (14,400 requests/day, ~300 ms average latency). It produces coherent child-friendly summaries in both Spanish and English. The existing age-range prompts in `summarizer.ts` work unchanged. If a higher-quality model is needed later, it can be swapped via the `GROQ_MODEL` env var without code changes.

### D4 — Mobile animation via `LayoutAnimation`, not `Animated`

`LayoutAnimation` animates layout changes automatically — the height of the panel goes from 0 to its natural height without manually tracking a height value. `LayoutAnimation.Presets.easeInEaseOut` takes ~300 ms and runs on the native thread. No external library (`react-native-reanimated`) is needed.

### D5 — `summaryFetched` ref to prevent duplicate requests

The fetch is triggered on `showSummary = true`. Without a guard, toggling the panel closed and re-opening it would fire the API again. The `useRef` guard ensures one fetch per card mount, consistent with the web's `hasFetched` ref in `AgeAdaptedSummary.tsx`.

### D6 — Empty-string treated as error

When the Groq API call succeeds but the provider is unavailable or the summarizer returns `""`, the mobile UI must not display a blank panel. The empty-string check (`if (data.summary)`) converts a blank response into the error state, which shows the `summary.error` i18n string.

### D7 — Action row refactor

The existing single "Read more" button is replaced by a two-button row (`actionRow` flexbox). The original `button`/`buttonText` style names are renamed to `readButton`/`readButtonText` to avoid naming conflicts. This is an internal rename — no prop changes, no breaking changes to callers.

---

## 6. Acceptance Criteria

### AC-1: Groq provider registered

- Given `AI_PROVIDER=groq` and a valid `GROQ_API_KEY`, calling `getAIClient().sendMessage(messages, 'generation')` returns an `AIResponse` with `provider === 'groq'` and a non-empty `content` field.
- Given `AI_PROVIDER=groq` and no `GROQ_API_KEY`, `isProviderAvailable()` returns `false` and `sendMessage` throws `AIServiceError` without making any HTTP call.
- The TypeScript type `AIProvider` includes `'groq'` and compiles without errors.

### AC-2: Summarizer works end-to-end with Groq

- Given `AI_PROVIDER=groq` and a valid key, `GET /api/news/:id/summary?age=10&locale=es` returns `{ summary: "<non-empty string>", ageRange: "9-11", generatedAt: "..." }` with HTTP 200.
- The second call for the same `(newsId, ageRange, locale)` is served from the `NewsSummary` cache (no second Groq API call).

### AC-3: Web "Explain it Easy" button works in production

- After deploying with `AI_PROVIDER=groq` and `GROQ_API_KEY` set on Fly.io, clicking the "Explain it Easy" button on the web shows the summary panel with a non-empty summary (not the error state).

### AC-4: Mobile "Explain it Easy" button is present

- The "Explain it Easy" button appears on every `NewsCard` in the mobile home feed.
- The button is accessible: `accessibilityRole="button"`, `accessibilityState={{ expanded }}`, and `accessibilityLabel` uses the `summary.explain_easy` i18n key.

### AC-5: Mobile summary panel animates open/closed

- Tapping the button for the first time animates the panel from height 0 to its content height using `LayoutAnimation`.
- Tapping a second time collapses the panel back to 0.
- The "Explain it Easy" button turns yellow (`#FACC15`) when the panel is open.

### AC-6: Mobile summary panel shows correct states

- While the API call is in progress, the panel shows an `ActivityIndicator` and the `summary.loading` translation string.
- If the API call fails (network error, non-2xx, or empty string), the panel shows the `summary.error` translation string.
- On success, the panel shows a green badge with `summary.adapted_for_age` (interpolated with the age range) and the summary text.

### AC-7: No duplicate API calls

- Opening and closing the summary panel multiple times for the same card results in exactly one call to `GET /api/news/:id/summary` per card mount.

### AC-8: Graceful degradation

- If `GROQ_API_KEY` is not set, `generateSummary` in `summarizer.ts` returns `""`, the API returns `{ summary: "" }`, and the mobile client shows the error state rather than crashing.

---

## 7. Testing Decisions

### 7.1 Unit tests for `ai-client.ts`

File: `apps/api/src/__tests__/services/ai-client.test.ts` (already exists, check the test file for current patterns).

Add test cases:
- `isProviderAvailable()` returns `true` when `AI_PROVIDER=groq` and `GROQ_API_KEY` is set.
- `isProviderAvailable()` returns `false` when `AI_PROVIDER=groq` and `GROQ_API_KEY` is absent.
- `sendMessage` dispatches to `sendViaOpenAICompat` with `baseURL = 'https://api.groq.com/openai/v1'` when `AI_PROVIDER=groq`.
- `sendMessage` throws `AIServiceError` with `retryable: false` when `AI_PROVIDER=groq` and key is missing.

Mock pattern: use `vi.mock('openai')` (already used in the existing test file). Do not make real HTTP calls in tests.

### 7.2 Unit tests for mobile `NewsCard`

File: `apps/mobile/src/__tests__/components/NewsCard.test.tsx` (already exists).

Add test cases:
- Renders the "Explain it Easy" button (find by `accessibilityLabel` matching `summary.explain_easy` translation).
- Pressing the button calls `fetchNewsSummary` once with `(item.id, user.age, locale)`.
- While loading, renders `ActivityIndicator`.
- On success, renders summary text and the age badge.
- On error (rejected promise), renders the error message.
- Pressing the button a second time does NOT call `fetchNewsSummary` again (ref guard).

Mock pattern: `jest.mock('../../lib/api', () => ({ fetchNewsSummary: jest.fn(), ... }))` — consistent with how `fetchRelatedArticles` is mocked in the same file.

### 7.3 Integration test for the summary endpoint

File: `apps/api/src/__tests__/routes/news.test.ts` (already exists).

Add a test that:
- Sets `AI_PROVIDER=groq` and `GROQ_API_KEY=test-key` in the test environment.
- Mocks the OpenAI SDK `create` method to return a fixed summary string.
- Calls `GET /api/news/:id/summary?age=10&locale=es` and asserts `{ summary: "...", ageRange: "9-11" }` with status 200.

The test must not make real Groq API calls — mock at the `openai` module level.

### 7.4 What NOT to test

- Real Groq API connectivity — this is an integration concern for staging/production, not a unit test concern.
- The `LayoutAnimation` animation itself — React Native's animation system is not testable at the unit level.

---

## 8. Setup Guide

### Step 1 — Get a Groq API key

1. Go to [https://console.groq.com](https://console.groq.com) and sign in (or create a free account).
2. Navigate to **API Keys** > **Create API Key**.
3. Copy the key. It looks like `gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
4. The free tier includes 14,400 requests/day, which is sufficient for production usage given that summaries are cached per `(newsId, ageRange, locale)`.

### Step 2 — Configure local development

Add to `apps/api/.env` (or the root `.env` if shared):

```
AI_PROVIDER=groq
GROQ_API_KEY=gsk_your_key_here
```

Restart the API server. Test with:

```bash
curl "http://localhost:3001/api/news/<any-news-id>/summary?age=10&locale=es"
```

You should receive a JSON response with a non-empty `summary` field within ~1-2 seconds on the first call.

### Step 3 — Configure Fly.io production

Set the secrets on the Fly.io app:

```bash
fly secrets set AI_PROVIDER=groq GROQ_API_KEY=gsk_your_key_here --app sportykids-api
```

Fly.io will restart the machine automatically. No redeployment is needed.

To verify:

```bash
fly ssh console --app sportykids-api
# Inside the machine:
curl "http://localhost:3000/api/news/<any-news-id>/summary?age=10&locale=es"
```

### Step 4 — Configure Fly.io staging (optional but recommended)

```bash
fly secrets set AI_PROVIDER=groq GROQ_API_KEY=gsk_your_key_here --app sportykids-api-staging
```

### Step 5 — Verify in-app on web

1. Open the webapp in production or staging.
2. Click any news card's "Explain it Easy" button.
3. The summary panel should appear with a green badge and age-adapted text (not the error state).

### Step 6 — Verify on mobile (after building NewsCard changes)

1. Run `npm run dev:mobile` and open in Expo Go.
2. Navigate to the home feed.
3. Tap the "Explain it Easy" button on any card.
4. The button should turn yellow, the panel should animate open, and the summary should appear.

---

## 9. Files to Change (Summary)

| File | Change |
|------|--------|
| `apps/api/src/services/ai-client.ts` | Add `'groq'` to `AIProvider`, `getModelName`, `isProviderAvailable`, and `dispatch` |
| `apps/mobile/src/components/NewsCard.tsx` | Add "Explain it Easy" button, summary panel, `handleExplain` handler, new styles |
| `CLAUDE.md` | Document `GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_MODEL` env vars |
| `apps/api/src/__tests__/services/ai-client.test.ts` | Add Groq provider test cases |
| `apps/mobile/src/__tests__/components/NewsCard.test.tsx` | Add summary panel test cases |

No changes needed to:
- `apps/api/src/services/summarizer.ts` (already handles provider-agnostic responses)
- `apps/api/src/routes/news.ts` (endpoint already exists)
- `apps/mobile/src/lib/api.ts` (`fetchNewsSummary` already exists at line 162)
- `apps/web/src/components/AgeAdaptedSummary.tsx` (already built)
- `packages/shared/src/i18n/en.json` or `es.json` (all required keys already present)
