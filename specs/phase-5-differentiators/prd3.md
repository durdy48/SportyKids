# PRD: Milestone 3 — Dynamic Quiz from Real News

> Part of [SportyKids Differentiators](./prd.md). See main PRD for overview and dependency graph.

## Overview

Replace the static seed quiz questions in SportyKids with AI-generated daily quizzes derived from real news articles. A scheduled job will use the AI client service (from M1) to produce age-appropriate trivia questions each morning, giving kids fresh content tied to actual sports events.

**Dependency**: Requires M1 (multi-provider AI client service exists at `apps/api/src/services/ai-client.ts`).

## Problem Statement

The current quiz module contains 15 hardcoded seed questions that never change. After a few sessions, kids exhaust all questions and lose interest. There is no connection between the news feed and the quiz, missing an opportunity to reinforce reading comprehension and engagement with current sports events.

## Goals

1. Generate 10-15 fresh quiz questions daily from real news articles ingested by the RSS aggregator.
2. Adapt question difficulty and language complexity to the child's age range (6-8, 9-11, 12-14).
3. Maintain backward compatibility — seed questions remain as fallback when no daily questions are available.
4. Link quiz questions back to their source news article to encourage further reading.
5. Support both Spanish and English via existing i18n infrastructure.

## Core Features

### 3.1 Quiz Generator Service

**File**: `apps/api/src/services/quiz-generator.ts`

A service that takes a news article and produces a structured quiz question using the AI client from M1.

**Function signature**:
```typescript
generateQuizFromNews(
  newsItem: NewsItem,
  ageRange: AgeRange,
  locale: Locale
): Promise<GeneratedQuizOutput>
```

**Behavior**:
- Call `aiClient.chat()` (Sonnet model) with a prompt containing the news article title, summary, sport, and team.
- Prompt instructs the LLM to produce a JSON object: `{ question: string, options: string[4], correctAnswer: number (0-3), points: number (10-15) }`.
- The prompt adapts to age range:
  - **6-8**: Simple vocabulary, short sentences, questions about "who" and "what". Points: 10.
  - **9-11**: Moderate vocabulary, questions about events and outcomes. Points: 10-12.
  - **12-14**: Richer vocabulary, questions about statistics, strategy, history. Points: 10-15.
- The prompt specifies the output language based on locale.
- Validate the LLM response with a Zod schema before returning:
```typescript
const GeneratedQuizSchema = z.object({
  question: z.string().min(10).max(300),
  options: z.array(z.string().min(1).max(150)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  points: z.number().int().min(10).max(15),
});
```
- If validation fails, retry once. If it fails again, skip the news item and log a warning.
- Do not throw on failure — return `null` so the job can continue with other articles.

### 3.2 Daily Quiz Job

**File**: `apps/api/src/jobs/generate-daily-quiz.ts`

A cron job that runs daily and populates the database with fresh quiz questions.

**Schedule**: Every day at 06:00 UTC (`0 6 * * *`).

**Algorithm**:
1. Query `NewsItem` table for articles published in the last 48 hours, ordered by `publishedAt DESC`.
2. Filter out articles that already have a linked `QuizQuestion` (via `relatedNewsId`).
3. Select up to 15 articles, diversifying across available sports (round-robin by sport).
4. For each selected article, for each age range (`6-8`, `9-11`, `12-14`):
   - Call `generateQuizFromNews(article, ageRange, 'es')` to generate the Spanish version.
   - Store the result as a `QuizQuestion` row with `generatedAt`, `ageRange`, `expiresAt`, and `relatedNewsId` populated.
5. Log summary: `Generated X questions from Y articles for Z age ranges`.

**Registration**: Import and register in `apps/api/src/jobs/sync-feeds.ts` (or a new `apps/api/src/jobs/index.ts` barrel if one is created) so it starts with the API server.

**Manual trigger**: Add route `POST /api/quiz/generate` (admin-only in future, unprotected for MVP) that runs the generation on demand.

### 3.3 Schema Changes

**Migration**: Add three nullable columns to `QuizQuestion`.

```prisma
model QuizQuestion {
  id            String    @id @default(cuid())
  question      String
  options       String    // JSON string array of 4 options
  correctAnswer Int       // index 0-3
  sport         String
  points        Int       @default(10)
  relatedNewsId String?
  generatedAt   DateTime?
  ageRange      String?   // '6-8' | '9-11' | '12-14'
  expiresAt     DateTime?
}
```

- Existing seed rows have `generatedAt = null`, `ageRange = null`, `expiresAt = null`. They never expire.
- Daily generated rows: `generatedAt = now()`, `expiresAt = generatedAt + 48h`.
- Add index on `(expiresAt, sport)` for efficient querying.

### 3.4 Route Changes

**Modify** `GET /api/quiz/questions`:

Add optional query parameter `age` (e.g., `?age=6-8&count=5&sport=football`).

**Query logic**:
1. First, fetch daily questions: `WHERE generatedAt IS NOT NULL AND expiresAt > NOW()` filtered by sport and ageRange if provided. Order by `generatedAt DESC`.
2. If fewer than `count` daily questions are available, fill the remainder from seed questions (`WHERE generatedAt IS NULL`), filtered by sport.
3. Shuffle the combined result.
4. Return with an additional `isDaily: boolean` field per question.

**Response shape** (extended):
```typescript
{
  questions: Array<QuizQuestion & { isDaily: boolean }>
}
```

**New route** `POST /api/quiz/generate`:
- Triggers `generateDailyQuiz()` manually.
- Returns `{ generated: number, errors: number }`.

### 3.5 UI Changes

#### QuizGame Component (`apps/web/src/components/QuizGame.tsx`)

Add a "Daily Quiz" badge when the current question has `isDaily: true`.

```
┌─────────────────────────────────────────┐
│  Quiz   ★ 30 pts          3/5          │
│─────────────────────────────────────────│
│  ┌─────────────┐                        │
│  │ 🗞 Daily Quiz│  ← badge, only shown  │
│  └─────────────┘    for daily questions  │
│                                          │
│  Which team won the Champions League     │
│  match against Juventus yesterday?       │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │ A) Real Madrid                   │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ B) Barcelona          ✓ correct  │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ C) Atletico Madrid              │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ D) Sevilla                      │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │ 📰 Read the related news  →     │    │ ← link, shown after
│  └─────────────────────────────────┘    │    answering if
│                                          │    relatedNewsId exists
└─────────────────────────────────────────┘
```

#### Quiz Page (`apps/web/src/app/quiz/page.tsx`)

- Pass user's `ageRange` (from `useUser()`) to the API call as `?age=`.
- When no daily questions are available, show a subtle message: "No daily quiz yet, try these!" before falling back to seed questions.

#### Mobile Screens

- `apps/mobile/src/screens/Quiz.tsx`: Same changes — daily badge, related news link, age parameter.

### 3.6 i18n Keys

Add to `packages/shared/src/i18n/es.json`:
```json
{
  "quiz": {
    "daily_quiz": "Quiz del Día",
    "from_today_news": "De las noticias de hoy",
    "read_news": "Lee la noticia relacionada",
    "no_daily": "Aún no hay quiz diario, ¡prueba estos!",
    "generate_success": "Quiz generado correctamente",
    "generate_error": "Error al generar el quiz"
  }
}
```

Add to `packages/shared/src/i18n/en.json`:
```json
{
  "quiz": {
    "daily_quiz": "Daily Quiz",
    "from_today_news": "From today's news",
    "read_news": "Read the related news",
    "no_daily": "No daily quiz yet, try these!",
    "generate_success": "Quiz generated successfully",
    "generate_error": "Error generating quiz"
  }
}
```

### 3.7 API Client Updates

**File**: `apps/web/src/lib/api.ts`

Update `fetchQuestions` to accept an optional `age` parameter:
```typescript
fetchQuestions(count?: number, sport?: string, age?: AgeRange): Promise<{ questions: (QuizQuestion & { isDaily: boolean })[] }>
```

**File**: `apps/mobile/src/lib/api.ts`

Same change for the mobile API client.

## Acceptance Criteria

- [ ] Running `POST /api/quiz/generate` produces 10-15 quiz questions per age range from recent news articles. Each question has 4 options, a correct answer index (0-3), and a valid sport value.
- [ ] Malformed LLM responses are caught and skipped without crashing the job. A warning is logged.
- [ ] Questions for age 6-8 use simpler language than questions for 12-14 (verified manually on sample output).
- [ ] The daily job runs at 06:00 UTC without manual intervention. Verified by checking `generatedAt` timestamps in the database after 24h.
- [ ] `GET /api/quiz/questions?age=9-11&count=5` returns daily questions first, seed questions only as fallback. Expired daily questions (older than 48h) are never returned.
- [ ] QuizGame shows the "Daily Quiz" badge only for questions where `isDaily` is true.
- [ ] After answering a daily question with a `relatedNewsId`, a link to the news article is shown. Clicking it navigates to the news detail page.
- [ ] When no daily questions exist (e.g., fresh install, AI service down), the quiz page shows the fallback message and serves seed questions. The app does not break.
- [ ] All new UI strings use translation keys. Both `es.json` and `en.json` have the new keys. No hardcoded user-visible text.
- [ ] The 15 existing seed questions remain in the database and are unaffected by the migration. They continue to work as fallback.
- [ ] `npx prisma migrate dev` runs cleanly, adding the three nullable columns without data loss.
- [ ] The mobile Quiz screen sends the `age` parameter and displays the daily badge and related news link identically to the web version.

## Technical Requirements

1. **AI Client**: Use the `aiClient` from `apps/api/src/services/ai-client.ts` (M1 dependency). Use the `generation` model role (maps to provider's generation model — Sonnet for Anthropic, larger free model for Ollama/OpenRouter). Prompts must work with smaller models; include explicit JSON examples.
2. **Zod validation**: Define `GeneratedQuizSchema` in `quiz-generator.ts`. Parse LLM output with `.safeParse()`. Retry once on failure.
3. **Prisma migration**: Create via `npx prisma migrate dev --name add-quiz-generation-fields`. Three nullable columns, one composite index.
4. **Cron**: Use `node-cron` (already a dependency). Register in the same pattern as `sync-feeds.ts`.
5. **Error handling**: The generation job must never crash the API server. Wrap in try/catch, log errors, continue.
6. **Rate limiting**: Add a 1-second delay between LLM calls to avoid overwhelming the AI service (`await sleep(1000)` between iterations).
7. **Deduplication**: Before generating, check if a `QuizQuestion` already exists for the same `relatedNewsId` and `ageRange`. Skip if so.
8. **No breaking changes**: The existing `GET /api/quiz/questions` endpoint continues to work without the `age` parameter (returns questions for all age ranges).
9. **Shared types**: Extend the `QuizQuestion` type in `packages/shared/src/types/` with the optional fields `generatedAt`, `ageRange`, `expiresAt`, and `isDaily`.
10. **Code language**: All code identifiers, comments, and variable names in English. UI text via i18n keys only.

## Out of Scope

- **English question generation**: M3 generates questions in Spanish only. Multi-language generation is a future enhancement.
- **Question quality review**: No human moderation workflow. Questions go live immediately after Zod validation.
- **Difficulty scoring**: No algorithmic difficulty rating beyond the age-range bucketing.
- **User-specific question history**: No tracking of which questions a specific user has already seen (deduplication at the question level, not user level).
- **Real-time generation**: Questions are pre-generated by cron, not generated on-the-fly per request.
- **Admin dashboard**: No UI for managing or reviewing generated questions.
- **Push notifications**: No notification when daily quiz is ready.
- **Analytics on question performance**: No tracking of which questions are answered correctly/incorrectly at aggregate level.
