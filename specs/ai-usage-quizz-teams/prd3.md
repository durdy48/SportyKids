# PRD 3: Quiz Variety — Per-User Deduplication, All-Sports Coverage & Timeless Trivia

**Project**: SportyKids
**Feature Area**: Quiz
**Status**: Specification
**Date**: 2026-04-02
**Priority**: High

---

## 1. Overview

The quiz is one of SportyKids' primary engagement loops — children earn points, unlock achievements, and maintain streaks by answering sports questions daily. Today, the quiz pool has two significant problems:

1. **Repetition**: Daily questions are generated from the last 48 hours of news only. When there is no breaking news for a given sport, the system falls back to the same 15 static seed questions, which children see again and again. There is no mechanism to remember which questions an individual child has already answered.

2. **Narrow coverage**: Because questions are always tied to recent news articles, sports with fewer RSS sources (athletics, cycling, padel, swimming) produce few or no daily questions. Children who favour those sports see a disproportionately news-heavy football/basketball diet, or the generic seed fallback.

This PRD specifies changes that solve both problems without introducing external ML services or vector similarity:

- A **`UserQuizHistory` model** records every question-answer event per user, and a 60-day deduplication window ensures a child never sees the same question twice within that period.
- A **timeless trivia mode** in the AI generator creates sport-general knowledge questions (rules, records, legends, competition formats) that are decoupled from the news cycle and cover all eight sports equally.
- A **wider news window** (30 days instead of 48 hours) for news-based generation gives the system far more source material, reducing churn.
- A **topic tag** on each question prevents the system from generating semantically duplicate questions even before they are served to any user.

---

## 2. Goals

| # | Goal | Metric |
|---|------|--------|
| G1 | Eliminate repeated questions per child | A child who plays daily should not see the same question twice within 60 days |
| G2 | Ensure all 8 sports have ≥ 1 question available every day | Daily availability check: for every sport × age range combination, at least 1 non-expired, non-seen question exists |
| G3 | Balanced sport distribution in a served set | In any 5-question set served without a sport filter, no single sport contributes more than 2 questions |
| G4 | Timeless questions form ≥ 30 % of every served set | Serving mix: 70 % recent/daily questions + 30 % timeless questions |
| G5 | Eliminate global topic-level duplicates at generation time | Zero pairs of questions with the same `topic` generated within a rolling 30-day window |

---

## 3. Out of Scope

The following are explicitly **not** part of this PRD:

- **Vector embeddings or semantic similarity** — topic deduplication uses a simple string tag, not cosine similarity or any embedding model.
- **Adaptive difficulty** — question difficulty is still determined solely by `ageRange`; there is no per-user difficulty curve or spaced-repetition algorithm.
- **Real-time quiz multiplayer** — all quiz sessions are still single-player and asynchronous.
- **Manual question authoring UI** — parents and admins cannot create custom questions through a dashboard.
- **Video or image questions** — all questions remain text-only with four text options.
- **Changing the scoring model** — points per question remain at 10; rewards and achievements are unchanged.
- **Per-sport subscriptions** — sport-specific quiz packs behind the premium tier are not part of this work.
- **Analytics dashboards** — no new reporting endpoints for admins beyond what already exists.

---

## 4. Technical Requirements

### 4.1 Schema Changes

#### 4.1.1 New model: `UserQuizHistory`

Add to `apps/api/prisma/schema.prisma`:

```prisma
model UserQuizHistory {
  id          String   @id @default(cuid())
  userId      String
  questionId  String
  answeredAt  DateTime @default(now())

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  question    QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([userId, questionId])
  @@index([userId, answeredAt])
}
```

**Rationale for `@@unique([userId, questionId])`**: prevents double-recording if a client retries the answer endpoint; the unique constraint makes the write idempotent.

**Rationale for `@@index([userId, answeredAt])`**: the serving query filters `answeredAt > now() - 60 days`, so the composite index keeps that lookup O(log n) even as history grows.

**Cascade deletes**: when a User or QuizQuestion is deleted (e.g. GDPR erasure), all associated history rows are automatically removed.

#### 4.1.2 Updated model: `QuizQuestion`

Add two new fields:

```prisma
model QuizQuestion {
  id              String    @id @default(cuid())
  question        String
  options         String[]
  correctAnswer   Int
  sport           String
  points          Int       @default(10)
  relatedNewsId   String?
  generatedAt     DateTime?
  ageRange        String?
  expiresAt       DateTime?
  isTimeless      Boolean   @default(false)   // NEW
  topic           String?                      // NEW

  userHistory     UserQuizHistory[]            // NEW relation

  @@index([expiresAt, sport])
  @@index([isTimeless, sport, ageRange])       // NEW — for timeless serving queries
  @@index([topic])                             // NEW — for global topic dedup check
}
```

**`isTimeless: Boolean @default(false)`**
- `true` for questions generated from the timeless trivia cron (no `relatedNewsId`, no `expiresAt`).
- `false` for news-based daily questions and seed questions (existing behaviour).

**`topic: String?`**
- Short string tag describing the question subject, e.g. `"Real Madrid Champions League"`, `"ATP tennis rules"`, `"Michael Jordan career stats"`, `"Olympic swimming butterfly stroke"`.
- Set by the AI generator for all new questions (both news-based and timeless).
- NULL for the 15 legacy seed questions; they are exempt from topic dedup.
- Maximum 80 characters, lowercased, trimmed before storage.

#### 4.1.3 `User` model: add relation

```prisma
model User {
  // ... existing fields
  quizHistory     UserQuizHistory[]   // NEW
}
```

#### 4.1.4 Migration strategy

1. Generate and apply a Prisma migration:
   ```
   npx prisma migrate dev --name add_quiz_history_and_timeless_fields
   ```
2. The migration adds `isTimeless` with a default of `false` — all existing rows backfill silently.
3. The migration adds `topic` as nullable — all existing rows stay NULL; no data backfill needed.
4. The `UserQuizHistory` table starts empty; history is accumulated from the first answer after deployment.
5. No downtime required; the new columns and table are additive.

---

### 4.2 `quiz-generator.ts` Changes

File: `apps/api/src/services/quiz-generator.ts`

#### 4.2.1 Existing function (unchanged interface)

```typescript
generateQuestionFromNews(
  newsItem: NewsItem,
  ageRange: AgeRange,
  locale: Locale
): Promise<GeneratedQuestion | null>
```

Change: the AI prompt must now also return a `topic` field (see prompt structure below).

#### 4.2.2 New function: `generateTimelessQuestion`

```typescript
generateTimelessQuestion(
  sport: Sport,
  ageRange: AgeRange,
  locale: Locale
): Promise<GeneratedQuestion | null>
```

**Input**: sport identifier, age range, locale.
**Output**: same `GeneratedQuestion` shape as the existing function, plus `isTimeless: true` and a `topic` string.
**Returns `null`** if the AI provider is unavailable or the output fails Zod validation (fail-closed behaviour matches existing code).

**Prompt structure** (system + user pattern, same as existing generator):

```
SYSTEM:
You are creating sports trivia for children aged {ageRangeLabel}.
Generate ONE multiple-choice question about {sportLabel}.
The question must be about general sports knowledge, NOT recent news.
Topics to draw from: rules of the sport, competition formats, historical records,
famous athletes (past or present), iconic moments, statistics that are stable over time.
The question must be fun, educational, and appropriate for children.

Output JSON with this exact shape:
{
  "question": "string",
  "options": ["string", "string", "string", "string"],
  "correctAnswer": 0|1|2|3,
  "topic": "string (max 80 chars, describes the subject, e.g. 'FIFA World Cup history')",
  "explanation": "string (1 sentence, kid-friendly)"
}

Rules:
- correctAnswer is the 0-based index of the correct option in the options array.
- The question must have exactly one correct answer.
- The three wrong options must be plausible but clearly incorrect.
- topic must be descriptive enough to avoid regenerating the same question again.
- Do NOT reference events from the last 6 months.
- Use simple language appropriate for {ageRangeLabel}.

USER:
Generate a timeless trivia question about {sportLabel} for children aged {ageRangeLabel}.
```

**Zod schema** (extends existing validation):

```typescript
const TimelessQuestionSchema = z.object({
  question: z.string().min(10).max(300),
  options: z.array(z.string().min(1).max(200)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  topic: z.string().min(3).max(80),
  explanation: z.string().optional(),
});
```

**Return shape** (`GeneratedQuestion` extended):

```typescript
interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  sport: Sport;
  ageRange: AgeRange;
  topic: string;
  isTimeless: boolean;
  relatedNewsId?: string;
  explanation?: string;
}
```

---

### 4.3 `generate-daily-quiz.ts` Job Changes

File: `apps/api/src/jobs/generate-daily-quiz.ts`

#### 4.3.1 News window: 48 hours → 30 days

```typescript
// Before
const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

// After
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
```

**Rationale**: widening the window from 48 hours to 30 days gives the generator a much larger pool of news articles. The round-robin sport balancing and the topic dedup check (see §4.3.3) prevent stale or repetitive questions.

**Note**: Questions generated from older news articles should still expire after 48 hours (`expiresAt = now() + 48h`). The wider window is for *source selection*, not for *question lifetime*.

#### 4.3.2 Topic dedup check at generation time

Before persisting any generated question (news-based or timeless), the job must query:

```typescript
const TOPIC_DEDUP_WINDOW_DAYS = 30;
const topicCutoff = new Date(Date.now() - TOPIC_DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

const existing = await prisma.quizQuestion.findFirst({
  where: {
    topic: generatedQuestion.topic,
    generatedAt: { gte: topicCutoff },
  },
  select: { id: true },
});

if (existing) {
  logger.info({ topic: generatedQuestion.topic }, 'Skipping question: topic already covered in last 30 days');
  continue; // skip this question, try next article or sport
}
```

- Comparison is **exact string match** on `topic` (lowercased, trimmed).
- Legacy seed questions (topic = NULL) are excluded from this check and never block generation.
- If a topic collision is detected, the job moves to the next article or sport in the round-robin; it does NOT retry with a different prompt for the same article.

#### 4.3.3 Per-sport minimum guarantee

After the main generation loop, run a gap-fill pass:

```typescript
for (const sport of SPORTS) {
  for (const ageRange of AGE_RANGES) {
    const count = await prisma.quizQuestion.count({
      where: {
        sport,
        ageRange,
        OR: [
          { expiresAt: { gt: new Date() } },   // non-expired daily
          { isTimeless: true },                  // timeless never expires
        ],
      },
    });
    if (count < MINIMUM_QUESTIONS_PER_SPORT_AGE) {
      // generate one timeless question for this sport/ageRange
    }
  }
}

const MINIMUM_QUESTIONS_PER_SPORT_AGE = 3;
```

This ensures that even for sports with no recent news (e.g. padel), every age range always has at least 3 non-expired questions available.

#### 4.3.4 Weekly timeless generation cron

Add a **separate cron job**: `apps/api/src/jobs/generate-timeless-quiz.ts`

- **Schedule**: `0 5 * * 1` — Every Monday at 05:00 UTC
- **Logic**: For each sport (8) × each age range (3) = 24 combinations, generate 2 timeless questions = **48 questions per week maximum** (minus topic collisions).
- Questions have `isTimeless = true`, `expiresAt = null`, `generatedAt = now()`.
- Topic dedup applies: if a topic already exists in the last 30 days, skip and try again (up to 3 attempts per sport/ageRange slot).
- Register the job in `apps/api/src/index.ts` alongside the existing cron registrations.

**Summary table of cron jobs after this change**:

| Job | Schedule | What it does |
|-----|----------|--------------|
| `sync-feeds.ts` | Every 30 min | RSS aggregation |
| `generate-daily-quiz.ts` | Daily 06:00 UTC | News-based questions (30d window) + per-sport gap fill |
| `generate-timeless-quiz.ts` | Monday 05:00 UTC | 48 general knowledge questions (new) |
| Other existing jobs | Unchanged | — |

---

### 4.4 `quiz.ts` Route Changes

File: `apps/api/src/routes/quiz.ts`

#### 4.4.1 GET /api/quiz/questions — updated serving logic

**Query params** (additions in bold):

| Param | Type | Description |
|-------|------|-------------|
| `count` | int | Number of questions to return (default 5, max 20) |
| `age` | string | Age range filter: `6-8`, `9-11`, `12-14` |
| `sport` | string? | Optional sport filter |
| **`userId`** | string? | If provided, exclude questions answered in the last 60 days |

**Algorithm** (pseudocode):

```
1. Resolve answeredIds:
   IF userId provided:
     answeredIds = SELECT questionId FROM UserQuizHistory
                   WHERE userId = $userId
                   AND answeredAt > now() - 60 days

2. Build base filters:
   baseWhere = {
     ageRange: age,
     sport: sportFilter (if provided),
     id: { notIn: answeredIds },
   }

3. Fetch recent/daily questions (pool A):
   poolA = SELECT * FROM QuizQuestion
           WHERE isTimeless = false
           AND generatedAt IS NOT NULL        -- not seed
           AND (expiresAt IS NULL OR expiresAt > now())
           AND ...baseWhere

4. Fetch timeless questions (pool B):
   poolB = SELECT * FROM QuizQuestion
           WHERE isTimeless = true
           AND ...baseWhere

5. Fetch seed questions (fallback pool C):
   poolC = SELECT * FROM QuizQuestion
           WHERE generatedAt IS NULL
           AND ...baseWhere (sport filter if provided)
           -- NOTE: seed questions are NOT filtered by userId (last-resort)

6. Determine target counts:
   targetTimeless = ceil(count * 0.30)   -- 30% timeless
   targetRecent   = count - targetTimeless

7. Apply sport balance (only if no sport filter):
   Shuffle poolA and poolB separately (Fisher-Yates).
   From each shuffled pool, select up to targetRecent / targetTimeless items
   ensuring no single sport appears more than floor(count / 4) + 1 times
   across the combined selected set.
   (For count=5: max 2 per sport)

8. Combine and fill:
   selected = pick(poolA, targetRecent) + pick(poolB, targetTimeless)
   IF len(selected) < count:
     gap = count - len(selected)
     selected += pick(poolC, gap)   -- seed fallback

9. Final Fisher-Yates shuffle of selected.
10. Return selected[0..count].
```

**Sport balance rule** (step 7):
For a requested set of `N` questions with no sport filter, no sport may contribute more than `⌊N/4⌋ + 1` questions. For N=5 this is `⌊5/4⌋ + 1 = 2`. Implementation: after shuffling, scan the merged candidate list in order, maintaining a per-sport counter, and skip items that would exceed the cap.

**Performance note**: `answeredIds` may grow large for active users. Cap the lookup to the last 60 days via the index on `(userId, answeredAt)`. Add a `LIMIT 1000` safety cap on the `answeredIds` subquery — in practice no child will answer more than 1000 distinct questions in 60 days.

#### 4.4.2 POST /api/quiz/answer — persist to UserQuizHistory

Current behaviour: accumulates total score (likely on User or in-memory).
**New behaviour**: also upsert a `UserQuizHistory` record.

```typescript
// After validating the answer and updating score:
if (body.userId && body.questionId) {
  await prisma.userQuizHistory.upsert({
    where: {
      userId_questionId: {
        userId: body.userId,
        questionId: body.questionId,
      },
    },
    create: {
      userId: body.userId,
      questionId: body.questionId,
    },
    update: {
      answeredAt: new Date(), // update timestamp on re-answer (edge case)
    },
  });
}
```

- The upsert is **non-blocking** to the answer response: if it fails (e.g. constraint violation), log the error and proceed — the score update takes priority.
- `userId` and `questionId` are required in the request body for history to be recorded; anonymous sessions without a userId bypass history tracking.

---

### 4.5 Affected Files Summary

| File | Type of Change |
|------|----------------|
| `apps/api/prisma/schema.prisma` | Add `UserQuizHistory` model, add `isTimeless` + `topic` + `userHistory` to `QuizQuestion`, add `quizHistory` relation to `User` |
| `apps/api/prisma/migrations/<timestamp>_add_quiz_history_and_timeless_fields/` | Generated migration SQL |
| `apps/api/src/services/quiz-generator.ts` | Add `generateTimelessQuestion()`, update `GeneratedQuestion` type to include `topic` + `isTimeless`, update news-based generator prompt to also return `topic` |
| `apps/api/src/jobs/generate-daily-quiz.ts` | Change news window to 30d, add topic dedup check, add per-sport gap-fill pass |
| `apps/api/src/jobs/generate-timeless-quiz.ts` | **New file** — weekly Monday 05:00 UTC timeless trivia generation |
| `apps/api/src/routes/quiz.ts` | Update GET /api/quiz/questions with per-user dedup + 70/30 mix + sport balance; update POST /api/quiz/answer to persist UserQuizHistory |
| `apps/api/src/index.ts` | Register `generate-timeless-quiz` cron |
| `packages/shared/src/types/index.ts` | Export `UserQuizHistory` type if needed by frontends |

No frontend changes are required for this PRD. The web and mobile quiz UIs consume the existing `GET /api/quiz/questions` endpoint; the improved question pool and deduplication are transparent to them. The only required client change is ensuring `userId` is passed in the `GET /api/quiz/questions` query (it is already passed in the current implementation per the route spec).

---

## 5. Implementation Decisions

### Decision 1: Simple string topic tag instead of embeddings

**Rejected alternative**: compute embeddings for each question and use cosine similarity to detect near-duplicate questions globally.

**Chosen approach**: AI model returns a short `topic` string; exact-match dedup on that string within a 30-day window.

**Rationale**: The AI model already understands question content and can produce consistent, descriptive topic tags when explicitly instructed. Exact-string dedup on a human-readable tag is debuggable, requires no external service, and performs well with a simple database index. The cost of an occasional near-duplicate question (different wording, same subject) is acceptable for a children's app.

### Decision 2: 60-day dedup window, not lifetime

**Rejected alternative**: never show a child the same question twice (lifetime dedup).

**Chosen approach**: 60-day rolling window.

**Rationale**: A child who plays daily for a year would accumulate 1,000+ answered question IDs. With a lifetime window, the pool of "fresh" questions would shrink continuously until the child saw only new questions — which requires continuous generation. A 60-day window balances freshness with the reality that children's sports knowledge grows; a question they found hard in October may be educational again in February.

### Decision 3: `UserQuizHistory` as a first-class Prisma model

**Rejected alternative**: store answered question IDs as a JSON array in the `User` model.

**Chosen approach**: dedicated model with a composite unique constraint and indexed timestamp.

**Rationale**: A JSON array cannot be efficiently queried for "which question IDs from this user's history are in this candidate set". A relational model supports efficient JOIN and WHERE IN operations. The unique constraint also makes the write naturally idempotent.

### Decision 4: 70/30 mix hardcoded, not configurable

**Rejected alternative**: make the ratio a parental setting or admin config.

**Chosen approach**: hardcode 70/30 in the serving logic.

**Rationale**: Adding configuration introduces UX complexity for a ratio that is an implementation detail. The 70/30 split is a reasonable starting point; it can be adjusted in code once we have data on engagement.

### Decision 5: Separate weekly cron for timeless questions

**Rejected alternative**: generate timeless questions on demand (lazy generation when the pool runs low).

**Chosen approach**: proactive weekly batch generation.

**Rationale**: On-demand generation adds latency to the quiz API endpoint and complicates error handling. A background cron job decouples generation from serving, is easier to monitor, and ensures the timeless pool is always pre-warmed.

### Decision 6: Expanded news window for generation (48h → 30d)

**Rejected alternative**: keep 48h and increase polling frequency.

**Chosen approach**: 30-day lookback with topic dedup.

**Rationale**: The 48-hour window was chosen to keep questions "fresh" (news-relevant), but this caused extreme variability — zero questions on slow news days. The topic dedup check (30-day window) prevents re-generating questions about the same event even when it stays in the 30-day lookback. The result: more source material, similar question freshness, fewer gaps.

---

## 6. Acceptance Criteria

### AC-1: Per-user deduplication
- **Given** a user has answered question Q in the last 60 days,
  **When** `GET /api/quiz/questions?userId={user.id}&age=9-11` is called,
  **Then** question Q does not appear in the response.

- **Given** a user has answered question Q exactly 61 days ago,
  **When** `GET /api/quiz/questions?userId={user.id}&age=9-11` is called,
  **Then** question Q may appear in the response.

- **Given** no `userId` param is provided,
  **When** `GET /api/quiz/questions?age=9-11` is called,
  **Then** all non-expired questions are eligible (no dedup applied, backward compatible).

### AC-2: Answer persistence
- **Given** a valid `POST /api/quiz/answer` with `{userId, questionId, answer}`,
  **Then** a `UserQuizHistory` row with `(userId, questionId)` is created or updated.

- **Given** the same `POST /api/quiz/answer` is sent twice (retry scenario),
  **Then** only one `UserQuizHistory` row exists for that `(userId, questionId)` pair.

### AC-3: Topic deduplication at generation time
- **Given** a question with `topic = "ATP tennis rules"` was generated 15 days ago,
  **When** the daily job tries to generate a question that returns `topic = "ATP tennis rules"`,
  **Then** the new question is skipped and not persisted.

- **Given** a question with `topic = "ATP tennis rules"` was generated 31 days ago,
  **When** the daily job generates a question with the same topic,
  **Then** the new question IS persisted (outside the 30-day dedup window).

### AC-4: Timeless questions
- **Given** the weekly cron has run,
  **Then** the database contains at least 1 question per sport per age range with `isTimeless = true` and `expiresAt = null`.

- **Given** a `GET /api/quiz/questions?count=10&age=9-11` call with a large `userId` (many answered questions),
  **When** the recent/daily pool is exhausted after dedup,
  **Then** the response is filled with timeless questions up to the requested count.

### AC-5: 70/30 mix
- **Given** both recent and timeless questions are available (no sport filter, large pool),
  **When** `GET /api/quiz/questions?count=10&age=9-11` is called,
  **Then** the response contains approximately 7 recent/daily questions and 3 timeless questions (±1 due to rounding and pool constraints).

### AC-6: Sport balance
- **Given** no `sport` filter in the request and questions from all 8 sports are available,
  **When** `GET /api/quiz/questions?count=5&age=9-11` is called,
  **Then** no single sport appears more than 2 times in the 5 returned questions.

### AC-7: Per-sport minimum availability
- **Given** the daily job has run and the weekly timeless job has run,
  **Then** for every sport × age range combination, `GET /api/quiz/questions?sport={sport}&age={ageRange}&count=1` returns at least 1 question (even for low-traffic sports like padel or athletics).

### AC-8: Seed fallback
- **Given** a brand new user (empty history) and the daily + timeless pools are empty (e.g. fresh test environment),
  **When** `GET /api/quiz/questions?count=5&age=9-11` is called,
  **Then** the response returns up to 5 questions from the 15 seed questions.

### AC-9: GDPR cascade delete
- **Given** `DELETE /api/users/:id/data` is called,
  **Then** all `UserQuizHistory` rows for that user are deleted (via Prisma cascade).

---

## 7. Testing Decisions

### 7.1 Unit tests: `quiz-generator.ts`

File: `apps/api/src/services/__tests__/quiz-generator.test.ts` (extend existing)

- **`generateTimelessQuestion` — happy path**: mock AI client to return valid JSON; assert returned object has `isTimeless: true`, `topic` string, valid `options` array of length 4, `correctAnswer` in 0–3.
- **`generateTimelessQuestion` — AI failure**: mock AI client to throw; assert function returns `null`.
- **`generateTimelessQuestion` — invalid JSON from AI**: mock AI client to return malformed JSON; assert Zod validation fails and function returns `null`.
- **`generateTimelessQuestion` — all 8 sports × 3 age ranges**: call with each combination; assert `sport` field on return matches input.
- **News-based generator `topic` field**: mock AI to return updated shape with `topic`; assert `topic` is present on returned object.

### 7.2 Unit tests: `generate-daily-quiz.ts` job

File: `apps/api/src/jobs/__tests__/generate-daily-quiz.test.ts` (extend existing)

- **30-day news window**: mock `prisma.newsItem.findMany`; assert `publishedAt` filter uses `>= now() - 30 days`.
- **Topic dedup skip**: mock `prisma.quizQuestion.findFirst` to return an existing question with same topic; assert that `prisma.quizQuestion.create` is NOT called for that topic.
- **Topic dedup pass**: mock `prisma.quizQuestion.findFirst` to return `null`; assert `prisma.quizQuestion.create` IS called.
- **Per-sport gap fill**: mock per-sport count to return 0; assert `generateTimelessQuestion` is called for that sport/ageRange combination.
- **Per-sport gap fill — already sufficient**: mock per-sport count to return 3; assert `generateTimelessQuestion` is NOT called.

### 7.3 Unit tests: `generate-timeless-quiz.ts` job (new)

File: `apps/api/src/jobs/__tests__/generate-timeless-quiz.test.ts`

- **Happy path**: mock `generateTimelessQuestion` to return a valid question for each call; assert 48 `prisma.quizQuestion.create` calls (8 sports × 3 age ranges × 2 per slot).
- **Topic collision on retry**: first call returns topic X (already in DB), second call returns topic Y; assert only Y is persisted.
- **Max retries exceeded**: all 3 retry attempts return colliding topics; assert no question is created for that slot, job continues to next slot.
- **AI unavailable**: `generateTimelessQuestion` returns `null`; assert job logs warning and moves to next slot without crashing.

### 7.4 Unit tests: `quiz.ts` route

File: `apps/api/src/routes/__tests__/quiz.test.ts` (extend existing)

- **Dedup with userId**: seed DB with a `UserQuizHistory` row for question Q; call `GET /api/quiz/questions?userId=...`; assert Q is absent from response.
- **Dedup — 61 days old**: seed history with `answeredAt = now() - 61 days`; assert Q appears in response (outside window).
- **No userId — no dedup**: assert all non-expired questions are eligible.
- **70/30 mix**: seed 20 recent + 20 timeless questions; assert ~30% of returned 10 questions are timeless.
- **Sport balance**: seed questions for all 8 sports; call without sport filter `count=5`; assert no sport appears >2 times.
- **Seed fallback**: empty daily + timeless pool; assert response contains seed questions.
- **POST /api/quiz/answer — history upsert**: call endpoint; assert `UserQuizHistory` row created.
- **POST /api/quiz/answer — idempotent**: call endpoint twice with same `questionId`; assert only 1 `UserQuizHistory` row exists.

### 7.5 Integration tests

File: `apps/api/src/routes/__tests__/quiz.integration.test.ts` (new or extend)

- **End-to-end dedup flow**: create user, answer 5 questions via POST, call GET → assert none of the 5 answered questions appear.
- **Sport balance in real DB query**: insert 10 football + 1 of each other sport for age `9-11`; call GET count=5 → assert football ≤ 2 in result.

### 7.6 What NOT to test

- AI model output quality (prompt engineering) — outside unit test scope; validated manually.
- Exact 70/30 ratio when pool sizes are very small (< 5 questions) — boundary conditions documented in AC-5 allow ±1 tolerance.
- Cron scheduling intervals — testing that node-cron fires at the right time is brittle; we test the job function directly.

---

## Appendix A: Timeless Trivia Topic Examples by Sport

These examples illustrate the breadth of topics the AI generator should be guided to cover. They are embedded in the system prompt implicitly via the topic categories listed.

| Sport | Example topics |
|-------|---------------|
| Football | FIFA World Cup history, offside rule, famous penalties, club records, iconic goals |
| Basketball | NBA Finals records, shot clock rule, famous players, three-point line history |
| Tennis | Grand Slam formats, ATP/WTA ranking system, famous rivalries, tie-break rules |
| Swimming | Olympic event formats, butterfly stroke technique, world record holders, FINA rules |
| Athletics | Olympic track distances, field event rules, sprint world records, decathlon events |
| Cycling | Tour de France history, jersey colours, velodrome rules, Grand Tour formats |
| Formula 1 | Points scoring system, famous champions, circuit records, pit stop rules |
| Padel | Court dimensions, scoring rules, famous players, padel vs tennis differences |

---

## Appendix B: `GeneratedQuestion` Interface (extended)

```typescript
// packages/shared/src/types/index.ts (or apps/api/src/services/quiz-generator.ts)
export interface GeneratedQuestion {
  question: string;
  options: string[];       // exactly 4 elements
  correctAnswer: number;   // 0-3
  sport: Sport;
  ageRange: AgeRange;
  topic: string;           // NEW — max 80 chars, lowercased
  isTimeless: boolean;     // NEW — true for timeless trivia
  relatedNewsId?: string;  // undefined for timeless questions
  explanation?: string;    // optional kid-friendly explanation
  points?: number;         // default 10
}
```
