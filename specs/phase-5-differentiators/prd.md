# SportyKids Differentiators — PRD Overview + Milestone 1

## Document Index

This PRD covers 6 milestones that transform SportyKids from a basic news aggregator into an adaptive, AI-powered kids sports platform. Due to the scope, the PRD is split across multiple files:

| File | Milestone | Scope | Dependencies |
|------|-----------|-------|-------------|
| **prd.md** (this file) | M1: AI Infrastructure + Content Safety | Multi-provider AI (free PoC → Claude production), content moderation, RSS catalog (prefixed + custom) | None |
| **prd2.md** | M2: Age-Adapted Content ("Explain it Easy") | AI summaries, age profiles, "Explain it Easy" button | M1 |
| **prd3.md** | M3: Dynamic Quiz from Real News | AI quiz generation, daily quiz job | M1 |
| **prd4.md** | M4: Gamification (Stickers, Streaks, Achievements) | Sticker album, streaks, achievements, points | None (independent) |
| **prd5.md** | M5: Robust Parental Controls | Backend enforcement, bcrypt, activity tracking, reports | M1 |
| **prd6.md** | M6: Smart Feed + Enriched Team + Improved Reels | Personalized feed, team stats, TikTok reels | M2 |

### Dependency Graph

```
M1 (AI + Safety) ──┬──> M2 (Summaries) ──> M6 (Feed + Team + Reels)
                    ├──> M3 (Quiz)
                    └──> M5 (Parental)

M4 (Gamification) ── independent (parallel with M2/M3)
```

### Recommended Implementation Order

**Sequential**: M1 → M2 → M3 → M4 → M5 → M6

**With 2 developers**: M1 → (M2 + M4 in parallel) → (M3 + M5 in parallel) → M6

---

# PRD: Milestone 1 — AI Infrastructure + Content Safety

## 1. Overview

Milestone 1 establishes the AI foundation for SportyKids with a **multi-provider architecture** that starts with a free solution for proof of concept and can be upgraded to Claude API for production. It implements automatic content moderation for child safety, expands the RSS source catalog from 4 to 30-50 curated sources (plus the ability to add custom sources manually), and ensures only age-appropriate content reaches kids. This milestone is the prerequisite for all subsequent AI-powered features (summaries, quiz generation, personalization).

## 2. Problem Statement

The current SportyKids MVP serves raw RSS content to children aged 6-14 without any content safety filtering. Sports news sources frequently contain references to betting sponsors, violent incidents, doping scandals, and other content inappropriate for minors. Additionally, the RSS catalog is limited to 4 Spanish sources, providing insufficient coverage across the 8 supported sports and international markets.

## 3. Goals

- **G1**: Establish a reusable, **provider-agnostic** AI client service that starts with a free solution and can be upgraded to Claude API without code changes.
- **G2**: Automatically moderate 100% of ingested news articles before they reach child users.
- **G3**: Expand RSS coverage from 4 sources to 30-50 curated sources across all 8 sports and multiple countries, **plus allow adding custom RSS URLs manually**.
- **G4**: Maintain a full audit trail of rejected content for parental review.
- **G5**: Zero breaking changes to existing API response shapes — add fields, never remove.

## 4. Target Users

| User | Relevance to M1 |
|------|-----------------|
| Kids (6-14) | Only see `approved` content; no exposure to moderation internals |
| Parents | Can audit rejected content reasons via parental panel (future milestone extends UI) |
| System (aggregator) | Calls moderator in pipeline; tags every NewsItem with safety status |

## 5. Core Features

---

### 5.1 AI Client Service — Multi-Provider Architecture

**File**: `apps/api/src/services/ai-client.ts`

Create a **provider-agnostic** AI client that supports multiple backends via a strategy pattern. The PoC starts with a **free solution** (Ollama local models or a free-tier OpenAI-compatible API) and can be upgraded to Claude API for production without changing any consumer code.

#### 5.1.1 Provider Strategy

The system supports three provider backends, selected via the `AI_PROVIDER` env var:

| Provider | `AI_PROVIDER` value | Cost | Quality | Use case |
|----------|-------------------|------|---------|----------|
| **Ollama** (default) | `ollama` | Free | Medium | Local development, PoC, testing |
| **OpenRouter Free** | `openrouter` | Free tier available | Medium-High | PoC with cloud models (Llama, Mistral, Gemma) |
| **Anthropic Claude** | `anthropic` | Paid | High | Production |

**Default provider is `ollama`** — zero cost, runs locally, no API key needed.

#### 5.1.2 Dependencies

Add to `apps/api/package.json`:

```json
{
  "openai": "^4.70.0"
}
```

The `openai` SDK is used as a universal client because both Ollama and OpenRouter expose **OpenAI-compatible** chat completion APIs. This means one SDK covers the two free providers. Anthropic SDK is added later as an optional dependency when upgrading to production.

**Ollama setup** (developer responsibility, not automated):
- Install Ollama locally: `brew install ollama` (macOS) or from ollama.ai
- Pull a small model: `ollama pull llama3.2:3b` (for moderation) or `ollama pull gemma2:9b` (better quality)
- Ollama runs on `http://localhost:11434` by default

#### 5.1.3 Environment Variables

Add to `apps/api/.env` (and document in `apps/api/.env.example`):

```env
# AI Provider: "ollama" (free, local), "openrouter" (free tier, cloud), "anthropic" (paid, production)
AI_PROVIDER=ollama

# Ollama config (default provider — free, local)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL_MODERATION=llama3.2:3b
OLLAMA_MODEL_GENERATION=gemma2:9b

# OpenRouter config (free tier — cloud alternative)
# Sign up at openrouter.ai for a free API key
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL_MODERATION=meta-llama/llama-3.2-3b-instruct:free
OPENROUTER_MODEL_GENERATION=google/gemma-2-9b-it:free

# Anthropic config (production — paid)
ANTHROPIC_API_KEY=
AI_MODEL_MODERATION=claude-haiku-4-5-20251001
AI_MODEL_GENERATION=claude-sonnet-4-6

# Shared config
AI_MAX_RETRIES=3
AI_RETRY_DELAY_MS=1000
AI_RATE_LIMIT_RPM=50
```

#### 5.1.4 Service Interface

```typescript
// apps/api/src/services/ai-client.ts

type AIProvider = 'ollama' | 'openrouter' | 'anthropic';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIRequestOptions {
  model?: 'moderation' | 'generation';
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

class AIClient {
  private static instance: AIClient;
  private provider: AIProvider;
  private requestTimestamps: number[];

  private constructor();
  static getInstance(): AIClient;

  async sendMessage(
    messages: AIMessage[],
    options?: AIRequestOptions
  ): Promise<AIResponse>;

  getProvider(): AIProvider;

  // Internal
  private async sendViaOpenAICompat(messages, options, baseUrl, apiKey, model): Promise<AIResponse>;
  private async sendViaAnthropic(messages, options): Promise<AIResponse>;
  private async waitForRateLimit(): Promise<void>;
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T>;
}

export { AIClient, AIRequestOptions, AIResponse, AIMessage, AIProvider };
```

#### 5.1.5 Behavior

- **Singleton**: `AIClient.getInstance()` creates one instance per process. Reads `AI_PROVIDER` env var (default: `'ollama'`).
- **Provider routing**:
  - `ollama` and `openrouter`: Use the `openai` SDK (OpenAI-compatible API). Set `baseURL` and `apiKey` per provider. Ollama doesn't need an API key (pass `'ollama'` as placeholder).
  - `anthropic`: Use `@anthropic-ai/sdk` (only imported dynamically when this provider is selected — allows the app to run without it installed for PoC).
- **Model selection**: `options.model` (`'moderation'` or `'generation'`) maps to the corresponding model env var for the active provider.
- **Rate limiting**: Same sliding window logic. For Ollama (local), set RPM to 999 (effectively unlimited). For OpenRouter free tier, respect 20 RPM.
- **Retries**: On `5xx` or `429`, retry up to `AI_MAX_RETRIES` times with exponential backoff. On `4xx` (except 429), throw immediately.
- **Logging**: Every call logs: `[AI] Provider: ${provider}, Model: ${model}, Tokens: ${in}/${out}, Latency: ${ms}ms`.
- **Error handling**: Wrap errors in `AIServiceError`:

```typescript
class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly originalError: unknown,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}
```

#### 5.1.6 OpenAI-Compatible Implementation

The core of the free providers. Both Ollama and OpenRouter use the same code path:

```typescript
private async sendViaOpenAICompat(
  messages: AIMessage[],
  options: AIRequestOptions,
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<AIResponse> {
  const client = new OpenAI({ baseURL: baseUrl, apiKey });
  const response = await client.chat.completions.create({
    model,
    messages: [
      ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
      ...messages,
    ],
    max_tokens: options.maxTokens ?? 500,
    temperature: options.temperature ?? 0,
  });
  return {
    content: response.choices[0]?.message?.content ?? '',
    provider: this.provider,
    model,
    usage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}
```

#### 5.1.7 Edge Cases

- **Missing API key for Anthropic**: Only throws when `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` is missing. Ollama needs no key. OpenRouter key is checked only when that provider is selected.
- **Ollama not running**: If Ollama is not running locally, `sendMessage` will throw a connection error. The retry logic handles transient failures. Log a helpful message: `[AI] Ollama not reachable at ${OLLAMA_BASE_URL}. Is it running? (brew services start ollama)`.
- **Empty response**: If the response content is empty, throw `AIServiceError` with `retryable: true`.
- **Provider upgrade path**: Switching from `ollama` to `anthropic` requires only changing `AI_PROVIDER` in `.env` and adding `@anthropic-ai/sdk` to dependencies. No code changes in consumers.

#### 5.1.8 Quality Considerations

Free models have lower quality than Claude. The moderation prompt (section 5.2) and quiz/summary prompts (M2/M3) must be designed to work with smaller models. Specific adaptations:
- Keep prompts concise — smaller models struggle with very long system prompts
- Use explicit JSON format instructions with examples
- The moderator fail-open behavior (section 5.2.3) is especially important with free models, as they may produce malformed JSON more often
- Log moderation accuracy metrics (approved/rejected ratio) so quality can be monitored when switching providers

---

### 5.2 Content Moderator

**File**: `apps/api/src/services/content-moderator.ts`

Classifies every news article as safe or unsafe for children before it enters the visible feed.

#### 5.2.1 Service Interface

```typescript
// apps/api/src/services/content-moderator.ts

type SafetyStatus = 'approved' | 'rejected';

interface ModerationResult {
  status: SafetyStatus;
  reason?: string;
}

interface ModerationCategory {
  id: string;
  label: string;
  description: string;
}

const MODERATION_CATEGORIES: ModerationCategory[] = [
  {
    id: 'betting_gambling',
    label: 'Betting & Gambling',
    description: 'References to sports betting, gambling sponsors, odds, or wagering'
  },
  {
    id: 'violence_aggression',
    label: 'Violence & Aggression',
    description: 'Physical violence, fights between players/fans, graphic injury descriptions, threats'
  },
  {
    id: 'toxic_controversy',
    label: 'Toxic Controversy',
    description: 'Racism, sexism, homophobia, doping scandals, insults, hate speech, harassment'
  },
  {
    id: 'sexual_inappropriate',
    label: 'Sexual & Inappropriate',
    description: 'Sexual content, inappropriate relationships, explicit language'
  },
  {
    id: 'drugs_alcohol',
    label: 'Drugs & Alcohol',
    description: 'Drug use, alcohol promotion, substance abuse (excluding medical/doping which falls under toxic_controversy)'
  }
];

async function moderateContent(
  title: string,
  summary: string
): Promise<ModerationResult>;

export { moderateContent, ModerationResult, SafetyStatus, MODERATION_CATEGORIES };
```

#### 5.2.2 System Prompt

The moderator must use this exact system prompt (store as a constant in the file):

```typescript
const MODERATION_SYSTEM_PROMPT = `You are a content safety moderator for SportyKids, a sports news app for children aged 6-14.

Your job is to classify sports news articles as APPROVED or REJECTED based on whether they are appropriate for children.

REJECT articles that contain any of the following:
1. BETTING & GAMBLING: References to sports betting, gambling sponsors, odds, bookmakers, or wagering of any kind.
2. VIOLENCE & AGGRESSION: Graphic descriptions of physical violence, fights between players or fans, detailed injury gore, or threats. Note: Normal sports contact (tackles, fouls, collisions) is APPROVED.
3. TOXIC CONTROVERSY: Racism, sexism, homophobia, doping accusations with graphic details, personal insults, hate speech, or harassment. Note: Factual reporting of sanctions or bans is APPROVED if neutral in tone.
4. SEXUAL & INAPPROPRIATE: Any sexual content, inappropriate relationships, or explicit language.
5. DRUGS & ALCOHOL: Drug use references, alcohol brand promotion, or substance abuse.

APPROVE articles about:
- Match results, scores, standings, statistics
- Player transfers, signings, contract renewals
- Training, tactics, team news
- Tournaments, schedules, fixtures
- Records, achievements, milestones
- Youth sports, academy news
- Inspirational stories about athletes
- Equipment, stadiums, fan culture (non-violent)

Respond ONLY with a JSON object. No other text.
If APPROVED: {"status": "approved"}
If REJECTED: {"status": "rejected", "reason": "<category_id>: <brief explanation in English>"}

Example rejected: {"status": "rejected", "reason": "betting_gambling: Article promotes betting odds for upcoming match"}
Example approved: {"status": "approved"}`;
```

#### 5.2.3 Implementation Details

The `moderateContent` function:

1. Calls `AIClient.getInstance().sendMessage()` with `model: 'moderation'`, `maxTokens: 150`, `temperature: 0`.
2. The user message format: `"Title: ${title}\nSummary: ${summary}"`
3. Parses the JSON response. If parsing fails, log the raw response and return `{status: 'approved'}` (fail-open for MVP; we don't want to block content due to parsing errors). **This is especially important with free models (Ollama/OpenRouter) which produce malformed JSON more frequently.**
4. Validates that `status` is either `'approved'` or `'rejected'`. If invalid, treat as `approved`.
5. If the AI client throws an `AIServiceError`, log the error and return `{status: 'approved'}` (fail-open). Log at `warn` level so it's visible but doesn't crash the sync.
6. **Log moderation metrics**: Track and log the ratio of approved/rejected/parse-errors per sync run. This allows monitoring quality across different providers and deciding when to upgrade from free to paid.

#### 5.2.4 Batch Moderation

Add a batch function for bulk processing during sync:

```typescript
async function moderateContentBatch(
  items: Array<{ id: string; title: string; summary: string }>
): Promise<Map<string, ModerationResult>>;
```

This function processes items sequentially (not in parallel) to respect rate limits. It uses the same `moderateContent` function internally. Between each call, it yields to the event loop with a minimal `await new Promise(resolve => setTimeout(resolve, 50))` to prevent blocking.

---

### 5.3 Prisma Schema Changes

**Migration name**: `add_safety_and_source_metadata`

#### 5.3.1 NewsItem Changes

Add to the `NewsItem` model in `apps/api/prisma/schema.prisma`:

```prisma
model NewsItem {
  id            String   @id @default(cuid())
  title         String
  summary       String
  imageUrl      String?
  source        String
  sourceUrl     String
  sport         String
  team          String?
  minAge        Int      @default(6)
  maxAge        Int      @default(14)
  publishedAt   DateTime
  createdAt     DateTime @default(now())
  rssGuid       String   @unique

  // M1: Safety moderation
  safetyStatus  String   @default("pending")  // "pending" | "approved" | "rejected"
  safetyReason  String?                        // null if approved, category + explanation if rejected
  moderatedAt   DateTime?                      // when moderation was performed
}
```

**Important**: The `safetyStatus` default is `"pending"`. Existing rows in the database will get `"pending"` after migration. A backfill script is needed (see section 5.3.3).

#### 5.3.2 RssSource Changes

Expand the `RssSource` model:

```prisma
model RssSource {
  id           String    @id @default(cuid())
  name         String
  url          String    @unique
  sport        String
  active       Boolean   @default(true)
  lastSyncedAt DateTime?

  // M1: Source catalog metadata
  country      String    @default("ES")       // ISO 3166-1 alpha-2
  language     String    @default("es")        // ISO 639-1
  logoUrl      String?
  description  String    @default("")
  category     String    @default("general")   // "general" | "team" | "league" | "youth"

  // M1: Custom sources
  isCustom     Boolean   @default(false)       // true for user-added sources (not from seed catalog)
  addedBy      String?                         // userId of who added this source (null for catalog sources)
}
```

#### 5.3.3 Backfill Script

**File**: `apps/api/prisma/backfill-safety.ts`

A one-time script that:
1. Queries all `NewsItem` records where `safetyStatus = 'pending'`.
2. Runs `moderateContentBatch()` on them.
3. Updates each record with the result.
4. Logs progress: `Moderated X/Y items. Approved: A, Rejected: R`.

Run with: `npx tsx apps/api/prisma/backfill-safety.ts`

This script is idempotent — it only processes items with `safetyStatus = 'pending'`.

---

### 5.4 Aggregator Pipeline Changes

**File**: `apps/api/src/services/aggregator.ts`

#### 5.4.1 Modified `syncSource` Flow

Current flow:
```
parse RSS → clean HTML → extract image → classifyNews() → upsert to DB
```

New flow:
```
parse RSS → clean HTML → extract image → classifyNews() → moderateContent() → upsert to DB (with safety fields)
```

Specific changes to `syncSource()`:

1. After calling `classifyNews(title, summary)` to get `{team, minAge, maxAge}`.
2. Call `moderateContent(title, summary)` to get `{status, reason}`.
3. Include `safetyStatus`, `safetyReason`, and `moderatedAt: new Date()` in the Prisma `upsert` data.
4. On the `update` clause of the upsert: do NOT overwrite `safetyStatus` if the item already exists and has been moderated (i.e., `safetyStatus !== 'pending'`). This prevents re-moderation of already-processed items on re-sync.

To handle the "don't overwrite existing moderation" logic, change the upsert strategy:

```typescript
// Check if item exists first
const existing = await prisma.newsItem.findUnique({
  where: { rssGuid: guid },
  select: { safetyStatus: true }
});

if (existing) {
  // Update content fields only, preserve safety status if already moderated
  await prisma.newsItem.update({
    where: { rssGuid: guid },
    data: {
      title,
      summary,
      imageUrl,
      // ... other content fields
      // Only update safety if it was pending
      ...(existing.safetyStatus === 'pending' ? {
        safetyStatus: moderationResult.status,
        safetyReason: moderationResult.reason ?? null,
        moderatedAt: new Date(),
      } : {}),
    },
  });
} else {
  await prisma.newsItem.create({
    data: {
      title, summary, imageUrl, source, sourceUrl, sport,
      team, minAge, maxAge, publishedAt, rssGuid: guid,
      safetyStatus: moderationResult.status,
      safetyReason: moderationResult.reason ?? null,
      moderatedAt: new Date(),
    },
  });
}
```

#### 5.4.2 Sync Logging

Add counters to `syncSource` return value:

```typescript
interface SyncResult {
  newsAdded: number;
  newsUpdated: number;
  approved: number;
  rejected: number;
  moderationErrors: number;
}
```

Log at the end of each source sync:
```
[Sync] Source "AS Football": +12 new, 10 approved, 2 rejected, 0 errors
```

---

### 5.5 API Route Changes

**File**: `apps/api/src/routes/news.ts`

#### 5.5.1 GET `/api/news` — Add Safety Filter

Add `safetyStatus` to the Prisma `where` clause. Default behavior: only return `approved` items.

```typescript
// In the GET /api/news handler, add to the where clause:
const where: Prisma.NewsItemWhereInput = {
  // ... existing filters (sport, team, age)
  safetyStatus: 'approved',  // Always filter for approved content
};
```

No query parameter to override this. Kids NEVER see non-approved content through this endpoint.

#### 5.5.2 GET `/api/news/:id` — Add Safety Filter

Add `safetyStatus: 'approved'` to the `findUnique` or `findFirst` query. If the item exists but is not approved, return 404 (same as if it doesn't exist). Do NOT leak the existence of rejected content.

#### 5.5.3 POST `/api/news/sincronizar` — Update Response

Update the response shape to include moderation stats:

```json
{
  "message": "Sincronización completada",
  "newsAdded": 15,
  "approved": 12,
  "rejected": 3,
  "moderationErrors": 0
}
```

#### 5.5.4 GET `/api/news/fuentes/catalogo` — New Endpoint

New route that returns the full RSS source catalog with metadata, grouped by sport.

**Path**: `GET /api/news/fuentes/catalogo`
**Auth**: None (public, needed for onboarding)
**Query params**: None

**Response shape**:

```json
{
  "sources": [
    {
      "id": "clxyz...",
      "name": "AS Football",
      "url": "https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada/",
      "sport": "football",
      "active": true,
      "country": "ES",
      "language": "es",
      "logoUrl": "https://as.com/favicon.ico",
      "description": "Noticias de fútbol del diario AS",
      "category": "general"
    }
  ],
  "total": 42,
  "bySport": {
    "football": 15,
    "basketball": 6,
    "tennis": 5,
    "swimming": 3,
    "athletics": 3,
    "cycling": 4,
    "formula1": 3,
    "padel": 3
  }
}
```

Register this route in `news.ts` BEFORE the `/:id` route to avoid path conflicts (Express matches routes in order).

#### 5.5.5 POST `/api/news/fuentes/custom` — Add Custom RSS Source

New endpoint that allows parents or users to manually add RSS sources not in the predefined catalog.

**Path**: `POST /api/news/fuentes/custom`
**Auth**: None for MVP (should be behind parental PIN in production)

**Request body** (validated with Zod):

```json
{
  "url": "https://example.com/rss/football.xml",
  "name": "My Custom Source",
  "sport": "football",
  "userId": "clxyz..."
}
```

**Validation rules**:
- `url`: Required. Must be a valid URL starting with `http://` or `https://`. Must be unique (no duplicate URLs).
- `name`: Required. String, 2-100 chars.
- `sport`: Required. Must be one of the 8 valid sports.
- `userId`: Required. Must reference an existing user.

**Behavior**:
1. Validate the request body with Zod.
2. Check the URL is not already in the database (return 409 Conflict if duplicate).
3. **Validate the RSS feed**: Attempt to fetch and parse the URL with `rss-parser`. If it fails or returns 0 items, return 400 with `{error: "invalid_feed", message: "Could not parse RSS feed at this URL"}`.
4. Create an `RssSource` record with `isCustom: true`, `addedBy: userId`, `country: "XX"` (unknown), `language: "unknown"`, `category: "general"`.
5. Immediately trigger a sync for this single source (`syncSource()`) so the user sees content right away.
6. Return the created source with the count of news items synced.

**Response shape** (success — 201):

```json
{
  "source": {
    "id": "clxyz...",
    "name": "My Custom Source",
    "url": "https://example.com/rss/football.xml",
    "sport": "football",
    "isCustom": true,
    "addedBy": "clxyz..."
  },
  "newsImported": 12
}
```

**Error responses**:
- 400: Invalid body or unparseable RSS feed
- 409: URL already exists in catalog

#### 5.5.6 DELETE `/api/news/fuentes/custom/:id` — Remove Custom RSS Source

Allows removing custom-added sources. Catalog (seed) sources cannot be deleted.

**Path**: `DELETE /api/news/fuentes/custom/:id`

**Behavior**:
1. Fetch the `RssSource` by ID.
2. If not found → 404.
3. If `isCustom` is false → 403 with `{error: "cannot_delete_catalog", message: "Catalog sources cannot be deleted"}`.
4. Delete the source record. Associated `NewsItem` records remain in the database (they were already synced).
5. Return 200 with `{deleted: true}`.

---

### 5.6 Expanded RSS Source Seed

**File**: `apps/api/prisma/seed.ts`

Replace or extend the existing 4-source seed with a curated catalog of 30-50 sources. The seed must be idempotent (use `upsert` on `url`).

#### 5.6.1 Source Requirements

Each source must be a real, working RSS feed URL. Group sources by sport with the following distribution:

| Sport | Min Sources | Countries |
|-------|------------|-----------|
| football | 8-10 | ES, UK, IT, FR, DE, US |
| basketball | 4-5 | ES, US |
| tennis | 3-4 | ES, UK, FR |
| swimming | 2-3 | ES, US |
| athletics | 2-3 | ES, UK |
| cycling | 3-4 | ES, FR, IT |
| formula1 | 2-3 | ES, UK |
| padel | 2-3 | ES |

#### 5.6.2 Source Data Shape

Each source in the seed must include all fields:

```typescript
const RSS_CATALOG: Array<{
  name: string;
  url: string;
  sport: string;
  country: string;
  language: string;
  logoUrl: string | null;
  description: string;
  category: 'general' | 'team' | 'league' | 'youth';
}> = [
  {
    name: 'AS - Fútbol',
    url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada/',
    sport: 'football',
    country: 'ES',
    language: 'es',
    logoUrl: 'https://as.com/favicon.ico',
    description: 'Últimas noticias de fútbol del diario AS',
    category: 'general',
  },
  // ... 29-49 more
];
```

#### 5.6.3 Seed Behavior

- Use `prisma.rssSource.upsert({ where: { url }, create: { ...allFields }, update: { ...metadataFieldsOnly } })`.
- The `update` clause should update metadata fields (`country`, `language`, `logoUrl`, `description`, `category`) but NOT `active` or `lastSyncedAt` (preserve user/system state).
- Log: `Seeded X RSS sources (Y created, Z updated)`.

#### 5.6.4 Important Notes on Feed URLs

- All URLs must be validated as real RSS/Atom feeds before inclusion.
- Prefer HTTPS URLs.
- For sources that are known to have intermittent DNS issues (e.g., Marca), note this in the description field.
- If a feed URL cannot be confirmed as working, mark it with `active: false` in the seed.

---

### 5.7 Shared Type Updates

**File**: `packages/shared/src/types/index.ts`

#### 5.7.1 Extend NewsItem Type

```typescript
// Add to existing NewsItem interface
interface NewsItem {
  id: string;
  title: string;
  summary: string;
  imageUrl?: string;
  source: string;
  sourceUrl: string;
  sport: string;
  team?: string;
  minAge: number;
  maxAge: number;
  publishedAt: string; // ISO date string
  // M1: Safety
  safetyStatus: 'pending' | 'approved' | 'rejected';
  safetyReason?: string;
  moderatedAt?: string; // ISO date string
}
```

#### 5.7.2 Extend RssSource Type

```typescript
interface RssSource {
  id: string;
  name: string;
  url: string;
  sport: string;
  active: boolean;
  lastSyncedAt?: string;
  // M1: Catalog metadata
  country: string;
  language: string;
  logoUrl?: string;
  description: string;
  category: 'general' | 'team' | 'league' | 'youth';
  // M1: Custom sources
  isCustom: boolean;
  addedBy?: string;
}
```

#### 5.7.3 New Types

```typescript
type SafetyStatus = 'pending' | 'approved' | 'rejected';

interface SafetyResult {
  status: 'approved' | 'rejected';
  reason?: string;
}

interface RssSourceCatalogResponse {
  sources: RssSource[];
  total: number;
  bySport: Record<string, number>;
}
```

#### 5.7.4 Export

All new types must be exported from the shared package's main entry point. Verify the export path in `packages/shared/src/index.ts` or `packages/shared/package.json` `"exports"` field.

---

### 5.8 i18n Additions

**File**: `packages/shared/src/i18n/es.json` and `en.json`

Add keys for any new UI-visible strings. For M1, the main additions are for the source catalog:

```json
// es.json additions
{
  "sources.catalog_title": "Fuentes de noticias",
  "sources.catalog_subtitle": "Elige tus fuentes favoritas",
  "sources.select_all": "Seleccionar todas",
  "sources.deselect_all": "Deseleccionar todas",
  "sources.selected_count": "{{count}} fuentes seleccionadas",
  "sources.country_ES": "España",
  "sources.country_GB": "Reino Unido",
  "sources.country_US": "Estados Unidos",
  "sources.country_FR": "Francia",
  "sources.country_IT": "Italia",
  "sources.country_DE": "Alemania",
  "sources.category_general": "General",
  "sources.category_team": "Equipo",
  "sources.category_league": "Liga",
  "sources.category_youth": "Cantera",
  "sources.add_custom": "Añadir fuente personalizada",
  "sources.custom_url_placeholder": "URL del feed RSS",
  "sources.custom_name_placeholder": "Nombre de la fuente",
  "sources.custom_sport_label": "Deporte",
  "sources.custom_add_button": "Añadir fuente",
  "sources.custom_validating": "Validando feed RSS...",
  "sources.custom_success": "Fuente añadida correctamente ({{count}} noticias importadas)",
  "sources.custom_error_invalid": "No se pudo leer el feed RSS de esta URL",
  "sources.custom_error_duplicate": "Esta URL ya existe en el catálogo",
  "sources.custom_delete_confirm": "¿Eliminar esta fuente personalizada?",
  "sources.custom_badge": "Personalizada",
  "sync.approved": "aprobadas",
  "sync.rejected": "rechazadas",
  "sync.moderation_errors": "errores de moderación"
}
```

```json
// en.json additions
{
  "sources.catalog_title": "News sources",
  "sources.catalog_subtitle": "Choose your favorite sources",
  "sources.select_all": "Select all",
  "sources.deselect_all": "Deselect all",
  "sources.selected_count": "{{count}} sources selected",
  "sources.country_ES": "Spain",
  "sources.country_GB": "United Kingdom",
  "sources.country_US": "United States",
  "sources.country_FR": "France",
  "sources.country_IT": "Italy",
  "sources.country_DE": "Germany",
  "sources.category_general": "General",
  "sources.category_team": "Team",
  "sources.category_league": "League",
  "sources.category_youth": "Youth",
  "sources.add_custom": "Add custom source",
  "sources.custom_url_placeholder": "RSS feed URL",
  "sources.custom_name_placeholder": "Source name",
  "sources.custom_sport_label": "Sport",
  "sources.custom_add_button": "Add source",
  "sources.custom_validating": "Validating RSS feed...",
  "sources.custom_success": "Source added successfully ({{count}} news imported)",
  "sources.custom_error_invalid": "Could not parse RSS feed at this URL",
  "sources.custom_error_duplicate": "This URL already exists in the catalog",
  "sources.custom_delete_confirm": "Delete this custom source?",
  "sources.custom_badge": "Custom",
  "sync.approved": "approved",
  "sync.rejected": "rejected",
  "sync.moderation_errors": "moderation errors"
}
```

---

### 5.9 Web App — Source Catalog in Onboarding (Step 4)

**File**: `apps/web/src/components/OnboardingWizard.tsx` (modify existing) or create a new sub-component `apps/web/src/components/SourceCatalog.tsx` if the wizard file is already large.

#### 5.9.1 Current Onboarding Flow

The existing onboarding has these steps:
1. Name + Age
2. Favorite Sports
3. Favorite Team
4. (Currently: basic feed selection or finalize)

#### 5.9.2 Modified Step 4: Source Catalog

Replace or enhance step 4 to show the full RSS catalog. The catalog is fetched from `GET /api/news/fuentes/catalogo`.

**Behavior**:
- Sources are grouped by sport (only show sports the user selected in step 2).
- Each source shows: logo (or sport icon fallback), name, country flag emoji, description.
- Custom-added sources show a "Custom" badge to distinguish them from catalog sources.
- Sources are selectable via checkboxes/toggles.
- "Select all" / "Deselect all" per sport group.
- A counter at the bottom shows: "X sources selected".
- Default: all sources for selected sports are pre-checked.
- The selected source IDs are saved to `User.selectedFeeds` (JSON string array) on submission.
- Minimum 1 source must be selected to proceed.
- **"Add custom source" button** at the bottom of each sport group (or at the top of the catalog). Opens an inline form to add a custom RSS URL (see section 5.5.5). After successful addition, the new source appears in the list and is auto-selected.

---

### 5.10 Web App — API Client Update

**File**: `apps/web/src/lib/api.ts`

Add functions:

```typescript
async function fetchSourceCatalog(): Promise<RssSourceCatalogResponse> {
  const res = await fetch(`${API_BASE}/news/fuentes/catalogo`);
  if (!res.ok) throw new Error('Failed to fetch source catalog');
  return res.json();
}

async function addCustomSource(data: {
  url: string;
  name: string;
  sport: string;
  userId: string;
}): Promise<{ source: RssSource; newsImported: number }> {
  const res = await fetch(`${API_BASE}/news/fuentes/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to add custom source');
  }
  return res.json();
}

async function deleteCustomSource(sourceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/news/fuentes/custom/${sourceId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete source');
}
```

Export all alongside existing functions.

---

## 6. UI Mockups

### 6.1 Onboarding Step 4 — Source Catalog (Web)

```
┌─────────────────────────────────────────────┐
│         Step 4 of 4                         │
│                                             │
│   ⚽ NEWS SOURCES                           │
│   Choose your favorite sources              │
│                                             │
│   ── Football (8 sources) ── [Select all]   │
│                                             │
│   ┌─────────────────────────────────┐       │
│   │ [✓] 🇪🇸 AS - Fútbol             │       │
│   │     Noticias de fútbol del AS   │       │
│   ├─────────────────────────────────┤       │
│   │ [✓] 🇪🇸 Mundo Deportivo         │       │
│   │     Diario deportivo de BCN     │       │
│   ├─────────────────────────────────┤       │
│   │ [✓] 🇪🇸 Marca                   │       │
│   │     Noticias deportivas Marca   │       │
│   ├─────────────────────────────────┤       │
│   │ [ ] 🇬🇧 BBC Sport Football     │       │
│   │     Football news from BBC      │       │
│   ├─────────────────────────────────┤       │
│   │ [ ] 🇬🇧 Sky Sports Football    │       │
│   │     Premier League & more       │       │
│   └─────────────────────────────────┘       │
│                                             │
│   ── Basketball (4 sources) ── [Select all] │
│                                             │
│   ┌─────────────────────────────────┐       │
│   │ [✓] 🇪🇸 AS - Baloncesto         │       │
│   │     Noticias de basket del AS   │       │
│   ├─────────────────────────────────┤       │
│   │ [ ] 🇺🇸 ESPN NBA               │       │
│   │     NBA news and scores         │       │
│   └─────────────────────────────────┘       │
│                                             │
│   ─────────────────────────────────────     │
│   [ + Add custom RSS source ]               │
│                                             │
│   ─────────────────────────────────────     │
│   5 sources selected                        │
│                                             │
│            [ ← Back ]  [ Finish → ]         │
│                                             │
└─────────────────────────────────────────────┘
```

### 6.2 Sync Response (API — JSON)

```
POST /api/news/sincronizar

Response:
{
  "message": "Sincronización completada",
  "newsAdded": 28,
  "approved": 24,
  "rejected": 4,
  "moderationErrors": 0
}
```

### 6.3 Source Catalog Response (API — JSON)

```
GET /api/news/fuentes/catalogo

Response:
{
  "sources": [
    {
      "id": "clxyz123",
      "name": "AS - Fútbol",
      "sport": "football",
      "country": "ES",
      "language": "es",
      "logoUrl": "https://as.com/favicon.ico",
      "description": "Últimas noticias de fútbol del diario AS",
      "category": "general",
      "active": true,
      ...
    },
    ...
  ],
  "total": 42,
  "bySport": {
    "football": 15,
    "basketball": 6,
    ...
  }
}
```

---

## 7. Acceptance Criteria

### AI Client Service (Multi-Provider)
- [ ] `openai` SDK installed in `apps/api/package.json` (covers Ollama + OpenRouter)
- [ ] `AIClient` singleton in `apps/api/src/services/ai-client.ts` reads `AI_PROVIDER` env var (default: `ollama`)
- [ ] `sendMessage()` routes to the correct provider (Ollama, OpenRouter, or Anthropic)
- [ ] Ollama provider works with no API key and `http://localhost:11434/v1` as base URL
- [ ] OpenRouter provider works with `OPENROUTER_API_KEY` and free-tier models
- [ ] Anthropic provider works when `@anthropic-ai/sdk` is installed and `ANTHROPIC_API_KEY` is set
- [ ] `sendMessage()` resolves model name from the provider-specific env vars
- [ ] Rate limiter prevents exceeding `AI_RATE_LIMIT_RPM` requests per minute
- [ ] Retries up to `AI_MAX_RETRIES` on 5xx and 429 errors with exponential backoff
- [ ] `AIServiceError` class is exported and used for all error wrapping
- [ ] Missing `ANTHROPIC_API_KEY` throws only when `sendMessage` is called, not on import

### Content Moderator
- [ ] `moderateContent(title, summary)` returns `{status, reason?}`
- [ ] System prompt covers all 5 rejection categories
- [ ] Uses the moderation model configured for the active provider (Ollama: `llama3.2:3b`, OpenRouter: free Llama, Anthropic: Haiku)
- [ ] Response parsed as JSON; parse failures fail-open to `approved`
- [ ] AI client errors fail-open to `approved` with a `warn`-level log
- [ ] `moderateContentBatch()` processes items sequentially with 50ms delay between calls
- [ ] Moderation result includes the category ID in the reason (e.g., `"betting_gambling: ..."`)

### Prisma Schema
- [ ] `NewsItem` has new fields: `safetyStatus` (default `"pending"`), `safetyReason` (nullable), `moderatedAt` (nullable)
- [ ] `RssSource` has new fields: `country` (default `"ES"`), `language` (default `"es"`), `logoUrl` (nullable), `description` (default `""`), `category` (default `"general"`)
- [ ] Migration runs cleanly: `npm run db:migrate`
- [ ] Prisma client regenerates: `npm run db:generate`
- [ ] Backfill script `prisma/backfill-safety.ts` processes all `pending` items and is idempotent

### Aggregator Pipeline
- [ ] `syncSource()` calls `moderateContent()` after `classifyNews()` for every new item
- [ ] Upsert includes `safetyStatus`, `safetyReason`, `moderatedAt`
- [ ] Existing items with non-pending safety status are not re-moderated on re-sync
- [ ] `syncSource()` returns `SyncResult` with counts: `newsAdded`, `newsUpdated`, `approved`, `rejected`, `moderationErrors`
- [ ] Sync logs include moderation stats per source

### API Routes
- [ ] `GET /api/news` only returns items where `safetyStatus = 'approved'`
- [ ] `GET /api/news/:id` returns 404 for non-approved items
- [ ] `POST /api/news/sincronizar` response includes `approved`, `rejected`, `moderationErrors`
- [ ] `GET /api/news/fuentes/catalogo` returns all sources with metadata, total, and bySport counts
- [ ] Catalog route is registered BEFORE `/:id` route to avoid path conflicts

### RSS Seed
- [ ] Seed contains 30-50 RSS sources across all 8 sports
- [ ] Every source has: `name`, `url`, `sport`, `country`, `language`, `description`, `category`
- [ ] Seed is idempotent (upsert on `url`)
- [ ] Seed `update` clause preserves `active` and `lastSyncedAt`
- [ ] At least 2 sources per sport

### Shared Types
- [ ] `NewsItem` type includes `safetyStatus`, `safetyReason`, `moderatedAt`
- [ ] `RssSource` type includes `country`, `language`, `logoUrl`, `description`, `category`, `isCustom`, `addedBy`
- [ ] `SafetyStatus`, `SafetyResult`, `RssSourceCatalogResponse` types are exported
- [ ] All new types are accessible via `@sportykids/shared`

### i18n
- [ ] All `sources.*` and `sync.*` keys added to both `es.json` and `en.json`
- [ ] No hardcoded UI text in new components

### Custom RSS Sources
- [ ] `POST /api/news/fuentes/custom` creates a new source with `isCustom: true`
- [ ] The endpoint validates the RSS URL by attempting to fetch and parse it
- [ ] Invalid RSS URLs return 400 with a descriptive error message
- [ ] Duplicate URLs return 409 Conflict
- [ ] After creation, the source is immediately synced and news count is returned
- [ ] `DELETE /api/news/fuentes/custom/:id` deletes custom sources only
- [ ] Attempting to delete a catalog source returns 403
- [ ] Custom sources show a "Custom" badge in the catalog UI
- [ ] `addCustomSource()` and `deleteCustomSource()` added to `apps/web/src/lib/api.ts`

### Web — Source Catalog
- [ ] `fetchSourceCatalog()` added to `apps/web/src/lib/api.ts`
- [ ] Onboarding step 4 fetches and displays the source catalog
- [ ] Sources grouped by sport; only sports selected in step 2 are shown
- [ ] Each source displays name, country, and description
- [ ] "Select all" / "Deselect all" per sport group
- [ ] Counter shows number of selected sources
- [ ] Minimum 1 source required to proceed
- [ ] Selected source IDs saved to `User.selectedFeeds`
- [ ] "Add custom source" button is visible and opens an inline form
- [ ] Custom source form validates URL, name, and sport before submission
- [ ] Successfully added custom source appears in the list and is auto-selected

### No Regressions
- [ ] Existing `GET /api/news` response shape is backward compatible (new fields added, none removed)
- [ ] Existing `GET /api/news/fuentes/listado` still works unchanged
- [ ] Web home feed still loads and displays news
- [ ] Onboarding still completes successfully
- [ ] `npm run build:api` succeeds
- [ ] `npm run build:web` succeeds

---

## 8. Technical Requirements

### 8.1 Performance

- Moderation of a single article should complete in under 3 seconds (Haiku is fast).
- A full sync of 50 sources should complete within 15 minutes including moderation.
- The catalog endpoint should respond in under 200ms (simple DB query).

### 8.2 Error Handling

- All AI errors are caught and logged, never crash the sync process.
- The moderator fails open (approves) on error — this is a deliberate MVP decision. Document it with a `// TODO: Consider fail-closed for production` comment.
- The AI client must never throw unhandled promise rejections.

### 8.3 Logging

- AI client logs: request model, input/output token counts, latency per call.
- Moderator logs: article title (truncated to 80 chars), result status, reason if rejected.
- Aggregator logs: per-source summary with moderation stats.
- Use `console.log` with structured prefixes: `[AI]`, `[Moderation]`, `[Sync]`.

### 8.4 Testing Strategy

No automated tests are required for M1 (consistent with existing codebase which has zero tests). However, the backfill script and manual sync endpoint serve as integration smoke tests. Document manual verification steps in the PR description.

### 8.5 Environment Setup

Add `.env.example` entries (if file exists) or add comments to existing `.env`:

```env
# AI Provider: "ollama" (free, local), "openrouter" (free tier, cloud), "anthropic" (paid, production)
AI_PROVIDER=ollama

# Ollama config (default — free, local, no API key needed)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL_MODERATION=llama3.2:3b
OLLAMA_MODEL_GENERATION=gemma2:9b

# OpenRouter config (free tier — cloud alternative, sign up at openrouter.ai)
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL_MODERATION=meta-llama/llama-3.2-3b-instruct:free
OPENROUTER_MODEL_GENERATION=google/gemma-2-9b-it:free

# Anthropic config (production — paid, add @anthropic-ai/sdk when upgrading)
ANTHROPIC_API_KEY=
AI_MODEL_MODERATION=claude-haiku-4-5-20251001
AI_MODEL_GENERATION=claude-sonnet-4-6

# Shared AI config
AI_MAX_RETRIES=3
AI_RETRY_DELAY_MS=1000
AI_RATE_LIMIT_RPM=50
```

### 8.6 Ollama Setup Guide (for developers)

For the default free AI provider:
1. Install: `brew install ollama` (macOS) or download from ollama.ai
2. Start: `brew services start ollama` (or `ollama serve`)
3. Pull models: `ollama pull llama3.2:3b && ollama pull gemma2:9b`
4. Verify: `curl http://localhost:11434/v1/models` should return the model list
5. No API key needed — Ollama runs locally on port 11434

---

## 9. Out of Scope

The following are explicitly NOT part of Milestone 1:

- **AI-generated summaries** — Milestone 2 feature. M1 only moderates, does not rewrite content.
- **AI quiz generation** — Milestone 3 feature.
- **Personalized feed ranking** — Milestone 6 feature.
- **Parental dashboard for rejected content audit** — Future enhancement. M1 stores the data but does not build the UI.
- **Mobile app changes** — M1 only modifies web and API. Mobile will pick up the changes via API compatibility.
- **User-specific source selection in sync** — The aggregator syncs ALL active sources. Filtering by user's `selectedFeeds` happens at query time in the news route, not at sync time. This is the existing behavior and does not change.
- **JWT/auth** — Remains a placeholder as per MVP status.
- **PostgreSQL migration** — Remains on SQLite for M1.
- **Automated tests** — Deferred to a dedicated testing milestone.
- **Feed URL health checking / automatic deactivation** — Future enhancement.

---

## 10. Future Considerations

- **Fail-closed moderation**: For production, switch from fail-open to fail-closed (reject on error) once confidence in AI reliability is established. This is a one-line change in `moderateContent`.
- **Provider upgrade path**: When ready for production quality, change `AI_PROVIDER=anthropic` in `.env`, install `@anthropic-ai/sdk`, and set `ANTHROPIC_API_KEY`. No code changes required in consumers. Monitor quality metrics (approved/rejected/error ratios) to decide when to upgrade.
- **Caching moderation results**: If the same article appears in multiple RSS feeds (different GUIDs but same content), consider content-hash-based caching to avoid duplicate API calls.
- **Moderation model upgrades**: The `AI_MODEL_MODERATION` env var allows swapping models without code changes. Monitor Anthropic's model releases for faster/cheaper options.
- **Webhook for moderation**: Instead of inline moderation during sync, consider a queue-based approach where items are ingested immediately as `pending` and moderated asynchronously. This would decouple sync speed from moderation speed.
- **Source health monitoring**: Track per-source error rates and auto-disable sources that fail consistently. Add `errorCount` and `lastErrorAt` fields to `RssSource`.
- **Content deduplication**: Multiple sources often cover the same story. A future milestone could use embeddings to detect and merge duplicate stories.
