# PRD: Milestone 2 — Age-Adapted Content ("Explain it Easy")

> Part of [SportyKids Differentiators](./prd.md). See main PRD for overview and dependency graph.

## 1. Overview

Milestone 2 introduces an AI-powered content adaptation system that generates age-appropriate summaries of sports news for three distinct age profiles. Each news article gets three tailored summaries — storytelling for young kids (6-8), simplified for tweens (9-11), and detailed for teens (12-14). Users see an "Explain it Easy" button on every news card that expands to reveal a summary matched to their age.

**Dependency**: This milestone requires M1 (AI Infrastructure) to be fully implemented. It assumes the existence of `apps/api/src/services/ai-client.ts` (multi-provider AI client singleton). The summarizer uses the `generation` model role, which maps to the active provider's generation model (Ollama/OpenRouter for PoC, Claude for production).

---

## 2. Problem Statement

Sports news articles from RSS feeds are written for adult audiences. Children aged 6-14 struggle with complex vocabulary, tactical jargon, and dense reporting styles. A 7-year-old cannot understand "offside trap" or "salary cap negotiation" the same way a 13-year-old can. Currently, all users see the same raw summary regardless of age, which reduces engagement and comprehension for younger users.

---

## 3. Goals

| Goal | Metric |
|------|--------|
| Every approved news item has 3 age-adapted summaries | 100% coverage within 5 minutes of RSS sync |
| Summaries respect word limits per age range | 6-8: <=80 words, 9-11: <=120 words, 12-14: <=180 words |
| On-demand fallback for missing summaries | Response time < 3 seconds for first-time generation |
| UI integration is non-disruptive | Button does not alter existing NewsCard layout when collapsed |
| Cost efficiency | Use Haiku model; estimated ~45K tokens/day |

---

## 4. Target Users

| Persona | Age | Needs |
|---------|-----|-------|
| Young Explorer | 6-8 | Simple words, short sentences, story-like tone, magical framing |
| Sports Fan | 9-11 | Clear summaries, basic rule explanations, fun facts |
| Junior Analyst | 12-14 | Stats, tactical context, transfer details, adult-like reporting |

---

## 5. Core Features

### 5.1 Summarizer Service

**File**: `apps/api/src/services/summarizer.ts`

**Primary function**:

```typescript
export async function generateSummary(
  title: string,
  content: string,
  ageRange: AgeRange,
  sport: string,
  locale: Locale
): Promise<string>
```

**Age profile specifications**:

| Age Range | Style | Vocabulary | Max Words | Inline Explanations | Example Tone |
|-----------|-------|-----------|-----------|---------------------|--------------|
| 6-8 | Storytelling, narrative | Very simple, no jargon | 80 | Always explain every sports term with a playful analogy | "Imagine a superhero who kicks the ball so hard..." |
| 9-11 | Summarized news, mini-curiosities | Simple but allows basic sports terms | 120 | Explain uncommon terms in parentheses | "Messi scored a free kick (a special kick you get when the other team breaks a rule)..." |
| 12-14 | Detailed reporting with stats | Adult-like, sports terminology OK | 180 | Only explain advanced tactical/financial terms | "The transfer fee of 80M euros includes performance-based add-ons..." |

**Prompt construction**: The function must build a system prompt that includes:
- The age profile rules (style, vocabulary, max words) from the table above
- The sport context (so the AI knows which domain-specific terms to potentially explain)
- The locale (generate summary in the requested language)
- Instruction to include inline mini-explanations of sports concepts when appropriate for the age range
- Explicit instruction to never include inappropriate content (violence, gambling references, etc.)

**Sports concepts requiring inline explanation** (non-exhaustive, the AI should handle any it encounters):
- Football: offside, free kick, penalty, hat-trick, VAR, transfer window, yellow/red card
- Basketball: three-pointer, slam dunk, free throw, double-double, draft pick
- Tennis: ace, break point, match point, Grand Slam, tiebreak
- Swimming: personal best, split time, relay, medley
- Formula 1: safety car, pit stop, pole position, DRS, grid penalty
- General: MVP, rookie, season, playoff, championship

**Model**: Use the `generation` model role via the AI client from `apps/api/src/services/ai-client.ts`. This maps to the active provider's generation model (e.g., `gemma2:9b` for Ollama, free Gemma for OpenRouter, Haiku for Anthropic). Prompts must be designed to work with smaller models — keep them concise and include explicit JSON format examples.

**Error handling**:
- If AI call fails, return an empty string (do not throw — the summary is a nice-to-have, not critical)
- Log the error with context (newsItemId, ageRange, locale)
- Implement a single retry with exponential backoff (1 second delay)

### 5.2 NewsSummary Prisma Model

**File to modify**: `apps/api/prisma/schema.prisma`

Add the following model:

```prisma
model NewsSummary {
  id         String   @id @default(cuid())
  newsItemId String
  ageRange   String   // '6-8' | '9-11' | '12-14'
  summary    String
  locale     String   @default("es")
  createdAt  DateTime @default(now())

  newsItem   NewsItem @relation(fields: [newsItemId], references: [id], onDelete: Cascade)

  @@unique([newsItemId, ageRange, locale])
}
```

**Modifications to existing NewsItem model**: Add the reverse relation field:

```prisma
model NewsItem {
  // ... existing fields ...
  summaries  NewsSummary[]
}
```

**Migration**: Create a new migration named `add_news_summary`. Run `npx prisma migrate dev --name add_news_summary` from `apps/api/`.

### 5.3 Summary Generation in the Aggregator Pipeline

**File to modify**: `apps/api/src/services/aggregator.ts` (or wherever `syncSource` orchestrates the pipeline after M1)

**Integration point**: After moderation passes (M1) and the news item is upserted to the database, trigger summary generation.

**Implementation requirements**:

```typescript
async function generateSummariesForNewsItem(newsItemId: string, title: string, summary: string, sport: string): Promise<void>
```

- This function must run in the background — do NOT await it in the main sync pipeline. Use `void generateSummariesForNewsItem(...)` or wrap in a fire-and-forget pattern.
- Generate summaries sequentially (not in parallel) to avoid rate limiting: first 6-8, then 9-11, then 12-14.
- Generate for both locales: `es` and `en` (6 total summaries per news item).
- Before generating, check if the summary already exists in the database (idempotency via the `@@unique` constraint).
- Use `prisma.newsSummary.upsert()` with the unique constraint fields as the `where` clause.

**Flow diagram**:
```
syncSource()
  → parseRSS()
  → classifyNews()
  → moderateContent()     [from M1]
  → upsert NewsItem to DB
  → fire-and-forget: generateSummariesForNewsItem()
       → for each locale in ['es', 'en']:
           → for each ageRange in ['6-8', '9-11', '12-14']:
               → check if NewsSummary exists
               → if not: generateSummary() → upsert to DB
```

### 5.4 New API Endpoint

**File to modify**: `apps/api/src/routes/news.ts`

**Endpoint**: `GET /api/news/:id/resumen`

This follows the existing convention where news-related routes use Spanish naming.

**Query parameters**:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `age` | number | No | 10 | User's age (used to determine age range) |
| `locale` | string | No | `es` | `es` or `en` |

**Age-to-range mapping logic**:

```typescript
function ageToRange(age: number): AgeRange {
  if (age <= 8) return '6-8';
  if (age <= 11) return '9-11';
  return '12-14';
}
```

**Response shape** (success — 200):

```json
{
  "summary": "The adapted summary text...",
  "ageRange": "9-11",
  "generatedAt": "2026-03-24T10:30:00.000Z"
}
```

**Response shape** (news item not found — 404):

```json
{
  "error": "News item not found"
}
```

**On-demand generation**: If no `NewsSummary` record exists for the requested `(newsItemId, ageRange, locale)` combination:
1. Fetch the `NewsItem` from the database
2. Call `generateSummary()` synchronously (this is a user-initiated request, they are waiting)
3. Store the result in the database
4. Return it

**Validation**: Use Zod to validate query parameters:
- `age`: number, min 4, max 18, optional (default 10)
- `locale`: enum `['es', 'en']`, optional (default `'es'`)

### 5.5 API Client Extension

**File to modify**: `apps/web/src/lib/api.ts`

Add a new function:

```typescript
export async function fetchNewsSummary(
  newsId: string,
  age: number,
  locale: string
): Promise<{ summary: string; ageRange: string; generatedAt: string }>
```

This calls `GET /api/news/${newsId}/resumen?age=${age}&locale=${locale}`.

### 5.6 UI Components

#### 5.6.1 New Component: AgeAdaptedSummary

**File**: `apps/web/src/components/AgeAdaptedSummary.tsx`

**Props**:

```typescript
interface AgeAdaptedSummaryProps {
  newsId: string;
  locale: Locale;
  userAge: number;
}
```

**Behavior**:
- Starts in a collapsed/hidden state (not rendered until triggered)
- When activated, fetches the summary from `/api/news/:id/resumen`
- Shows a loading state while the request is in flight
- On success, displays the summary in an expandable panel with a slide-down animation
- On error, displays a dismissible error message
- Caches the fetched summary in component state (no re-fetch on toggle)

**Visual design**:
- Background: `--color-background` (#F8FAFC) with a subtle left border in `--color-blue` (#2563EB)
- Rounded corners (8px), padding 12px 16px
- Age range badge: small pill with the age range text, using `--color-green` (#22C55E) background
- Summary text: Inter font, 14px, `--color-text` (#1E293B)
- Slide-down animation: 200ms ease-out

**Loading state**:
- Pulsing placeholder lines (skeleton loader)
- Text: use i18n key `summary.loading`

**Error state**:
- Muted error text using the i18n key `summary.error`
- No retry button (user can collapse and re-expand to retry)

#### 5.6.2 Modify NewsCard Component

**File to modify**: `apps/web/src/components/NewsCard.tsx`

**Changes**:
- Add an "Explain it Easy" button next to the existing "Read more" link
- Button uses a lightbulb icon (use inline SVG or a simple emoji character as fallback)
- Button text: use i18n key `summary.explain_easy`
- Clicking the button toggles the `AgeAdaptedSummary` component below the card content
- The button changes appearance when the summary is expanded (filled vs outlined lightbulb, or color change to `--color-yellow`)
- Get `userAge` from `useUser()` context. If no user/age is available, default to age 10.

**Important**: The button and expanded panel must not disrupt the existing card layout. The summary panel appears below the existing card content, pushing subsequent content down.

### 5.7 i18n Keys

**Files to modify**: `packages/shared/src/i18n/es.json` and `packages/shared/src/i18n/en.json`

**Spanish (`es.json`)** — add under a new `"summary"` top-level key:

```json
{
  "summary": {
    "explain_easy": "Explica fácil",
    "adapted_for_age": "Adaptado para {{range}} años",
    "loading": "Generando resumen...",
    "error": "No se pudo generar el resumen"
  }
}
```

**English (`en.json`)**:

```json
{
  "summary": {
    "explain_easy": "Explain it easy",
    "adapted_for_age": "Adapted for ages {{range}}",
    "loading": "Generating summary...",
    "error": "Could not generate summary"
  }
}
```

### 5.8 Shared Types

**File to modify**: `packages/shared/src/types/index.ts`

Add a new type:

```typescript
export interface NewsSummary {
  id: string;
  newsItemId: string;
  ageRange: AgeRange;
  summary: string;
  locale: string;
  createdAt: string;
}
```

Add an optional field to `NewsItem` type:

```typescript
export interface NewsItem {
  // ... existing fields ...
  summaries?: NewsSummary[];
}
```

---

## 6. UI Mockups (ASCII)

### 6.1 NewsCard — Default State (button visible, summary collapsed)

```
+--------------------------------------------------+
|  [IMAGE PLACEHOLDER / Sport Color Bar]           |
|                                                  |
|  Football                          Real Madrid   |
|  ──────────────────────────────────────────────  |
|  Mbappe scores hat-trick in Champions            |
|  League semifinal against Bayern                 |
|                                                  |
|  Kylian Mbappe led Real Madrid to a stunning     |
|  victory with three goals in Munich...           |
|                                                  |
|  AS  •  24 Mar 2026                              |
|                                                  |
|  [Read more ->]          [💡 Explain it easy]    |
+--------------------------------------------------+
```

### 6.2 NewsCard — Loading State (summary being fetched)

```
+--------------------------------------------------+
|  [IMAGE PLACEHOLDER / Sport Color Bar]           |
|                                                  |
|  Football                          Real Madrid   |
|  ──────────────────────────────────────────────  |
|  Mbappe scores hat-trick in Champions            |
|  League semifinal against Bayern                 |
|                                                  |
|  Kylian Mbappe led Real Madrid to a stunning     |
|  victory with three goals in Munich...           |
|                                                  |
|  AS  •  24 Mar 2026                              |
|                                                  |
|  [Read more ->]          [💡 Explain it easy]    |
|                                                  |
|  ┌──────────────────────────────────────────┐    |
|  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │    |
|  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░        │    |
|  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │    |
|  │                                          │    |
|  │  Generating summary...                   │    |
|  └──────────────────────────────────────────┘    |
+--------------------------------------------------+
```

### 6.3 NewsCard — Expanded State (summary visible)

```
+--------------------------------------------------+
|  [IMAGE PLACEHOLDER / Sport Color Bar]           |
|                                                  |
|  Football                          Real Madrid   |
|  ──────────────────────────────────────────────  |
|  Mbappe scores hat-trick in Champions            |
|  League semifinal against Bayern                 |
|                                                  |
|  Kylian Mbappe led Real Madrid to a stunning     |
|  victory with three goals in Munich...           |
|                                                  |
|  AS  •  24 Mar 2026                              |
|                                                  |
|  [Read more ->]          [💡 Explain it easy]    |
|                                                  |
|  ┌──────────────────────────────────────────┐    |
|  │  [Adapted for ages 9-11]  (green pill)   │    |
|  │                                          │    |
|  │  Mbappe, who plays for Real Madrid,      │    |
|  │  scored three goals (that's called a     │    |
|  │  hat-trick!) in a super important game   │    |
|  │  called the Champions League. They were  │    |
|  │  playing in Munich, Germany against       │    |
|  │  Bayern. Real Madrid won 4-2 and will    │    |
|  │  play in the final!                      │    |
|  │                                          │    |
|  └──────────────────────────────────────────┘    |
+--------------------------------------------------+
```

---

## 7. Acceptance Criteria

### 7.1 Summarizer Service

- [ ] `generateSummary()` exists at `apps/api/src/services/summarizer.ts` and is exported
- [ ] It accepts `(title, content, ageRange, sport, locale)` and returns a `Promise<string>`
- [ ] For age range `6-8`, output is <= 80 words, uses storytelling style
- [ ] For age range `9-11`, output is <= 120 words, includes parenthetical explanations
- [ ] For age range `12-14`, output is <= 180 words, includes stats and tactical context
- [ ] Sports concepts are explained inline at an age-appropriate level
- [ ] Uses the AI client from M1 (`ai-client.ts`) with the `generation` model role (provider-agnostic)
- [ ] Failures return empty string and log the error (no thrown exceptions)
- [ ] Single retry with 1-second delay on failure

### 7.2 Database

- [ ] `NewsSummary` model exists in `schema.prisma` with all specified fields
- [ ] Unique constraint on `[newsItemId, ageRange, locale]` prevents duplicates
- [ ] `onDelete: Cascade` ensures summaries are deleted when a news item is deleted
- [ ] Migration runs cleanly: `npx prisma migrate dev --name add_news_summary`
- [ ] `NewsItem` model has `summaries NewsSummary[]` relation field

### 7.3 Pipeline Integration

- [ ] Summary generation triggers after successful moderation and DB upsert
- [ ] Generation runs in the background (does not block `syncSource` return)
- [ ] Generates 6 summaries per news item (3 age ranges x 2 locales)
- [ ] Existing summaries are not regenerated (idempotent via upsert)
- [ ] Pipeline errors in summary generation do not affect news item ingestion

### 7.4 API Endpoint

- [ ] `GET /api/news/:id/resumen` exists and is registered in the news router
- [ ] Accepts optional `age` (number) and `locale` (string) query params
- [ ] Returns `{summary, ageRange, generatedAt}` on success (200)
- [ ] Returns `{error}` with 404 if news item does not exist
- [ ] On-demand generation works: if no cached summary exists, it generates one, stores it, and returns it
- [ ] Query params are validated with Zod; invalid params return 400
- [ ] Default age is 10 (maps to `9-11`), default locale is `es`

### 7.5 Web UI

- [ ] "Explain it easy" button appears on every `NewsCard`
- [ ] Button text uses i18n key `summary.explain_easy`
- [ ] Clicking the button shows the `AgeAdaptedSummary` panel with a slide-down animation
- [ ] Clicking again collapses the panel
- [ ] Loading state shows skeleton lines and i18n `summary.loading` text
- [ ] Error state shows i18n `summary.error` text
- [ ] Summary panel shows the age range pill with text from `summary.adapted_for_age`
- [ ] Summary is fetched only once (cached in component state on subsequent toggles)
- [ ] User age is read from `useUser()` context; defaults to 10 if unavailable
- [ ] Expanded panel does not break existing card layout

### 7.6 i18n

- [ ] All 4 keys (`explain_easy`, `adapted_for_age`, `loading`, `error`) added to both `es.json` and `en.json`
- [ ] `adapted_for_age` uses `{{range}}` parameter interpolation
- [ ] No hardcoded user-visible strings in any component

### 7.7 Shared Types

- [ ] `NewsSummary` interface exported from `@sportykids/shared`
- [ ] `NewsItem` type updated with optional `summaries?: NewsSummary[]` field

---

## 8. Technical Requirements

### 8.1 Files to Create

| File | Purpose |
|------|---------|
| `apps/api/src/services/summarizer.ts` | AI-powered summary generation service |
| `apps/web/src/components/AgeAdaptedSummary.tsx` | Expandable summary panel component |
| `apps/api/prisma/migrations/XXXXXX_add_news_summary/migration.sql` | Auto-generated by Prisma |

### 8.2 Files to Modify

| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Add `NewsSummary` model, add relation to `NewsItem` |
| `apps/api/src/routes/news.ts` | Add `GET /api/news/:id/resumen` endpoint |
| `apps/api/src/services/aggregator.ts` | Trigger background summary generation after moderation |
| `apps/web/src/components/NewsCard.tsx` | Add "Explain it easy" button and toggle logic |
| `apps/web/src/lib/api.ts` | Add `fetchNewsSummary()` function |
| `packages/shared/src/i18n/es.json` | Add `summary.*` keys |
| `packages/shared/src/i18n/en.json` | Add `summary.*` keys |
| `packages/shared/src/types/index.ts` | Add `NewsSummary` interface, update `NewsItem` |

### 8.3 Environment Variables

No new environment variables required. Uses `AI_MODEL_GENERATION` from M1.

### 8.4 Dependencies

No new npm dependencies required. Uses:
- Anthropic SDK (installed in M1)
- Prisma Client (existing)
- Zod (existing)

### 8.5 Performance Considerations

- Background generation ensures RSS sync is not slowed down
- On-demand generation adds up to ~3 seconds latency on first request for a given summary
- Subsequent requests are instant (served from database)
- Unique constraint prevents duplicate generation work

### 8.6 Estimated AI Token Usage

| Metric | Value |
|--------|-------|
| Tokens per summary (prompt + completion) | ~500 |
| Summaries per news item | 6 (3 ranges x 2 locales) |
| New articles per day | ~30 |
| Daily token usage | ~90K tokens |
| Monthly cost (Haiku pricing) | < $1/month |

---

## 9. Out of Scope

- **Mobile app (React Native)**: Summary integration for `apps/mobile/` is not part of this milestone. Will be a follow-up task.
- **Summary regeneration**: No mechanism to regenerate an existing summary (e.g., if the AI model improves). Can be done manually via DB.
- **User feedback on summaries**: No thumbs-up/down or quality rating system.
- **Concept glossary page**: No standalone page listing all sports terms and definitions.
- **Summary for reels or quizzes**: Only news items get summaries in this milestone.
- **Admin UI for summary management**: No dashboard to view/edit/delete summaries.
- **Streaming responses**: Summaries are returned as complete text, not streamed.

---

## 10. Future Considerations

- **Glossary system (M3+)**: A dedicated glossary of sports terms that can be linked from inline explanations, offering deeper "learn more" functionality.
- **Summary quality monitoring**: Track summary quality metrics and user engagement to tune prompts.
- **Personalized explanations**: Use the user's favorite sport to add relatable analogies (e.g., explaining basketball concepts using football metaphors for a football fan).
- **Mobile integration**: Port `AgeAdaptedSummary` to React Native with appropriate animations.
- **Regeneration API**: Admin endpoint to regenerate summaries when prompts are improved.
- **Pre-generation for popular content**: Priority generation for trending or high-engagement news items.
- **Summary caching layer**: Redis or in-memory cache for frequently accessed summaries to reduce DB reads.
