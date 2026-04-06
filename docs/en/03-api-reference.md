# API Reference

Base URL: `http://localhost:3001/api`

## Health Check

### `GET /api/health`
Verifies that the API is running and checks AI provider availability.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-24T18:00:00.000Z",
  "aiProvider": "ollama",
  "aiAvailable": true
}
```

---

## Authentication

### `POST /api/auth/register`
Register a new user with email and password.

**Body:**
```json
{
  "email": "parent@example.com",
  "password": "securePassword123",
  "name": "Pablo",
  "role": "child"
}
```

**Response:**
```json
{
  "user": { "id": "clx...", "email": "parent@example.com", "name": "Pablo", "role": "child" },
  "accessToken": "eyJhbG...",
  "refreshToken": "abc123..."
}
```

### `POST /api/auth/login`
Login with email and password.

**Body:**
```json
{
  "email": "parent@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "user": { "id": "clx...", "email": "parent@example.com", "name": "Pablo", "role": "child" },
  "accessToken": "eyJhbG...",
  "refreshToken": "abc123..."
}
```

### `POST /api/auth/refresh`
Refresh an expired access token using a valid refresh token. Refresh tokens are rotated on each use.

**Body:**
```json
{
  "refreshToken": "abc123..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "newToken123..."
}
```

### `POST /api/auth/logout`
Revoke a refresh token.

**Body:**
```json
{
  "refreshToken": "abc123..."
}
```

### `GET /api/auth/me`
Get the currently authenticated user's profile. Requires a valid access token in the `Authorization: Bearer <token>` header.

**Response:**
```json
{
  "id": "clx...",
  "email": "parent@example.com",
  "name": "Pablo",
  "role": "child"
}
```

### `POST /api/auth/upgrade`
Upgrade an anonymous user to an authenticated account by linking an email and password.

**Body:**
```json
{
  "userId": "clx...",
  "email": "parent@example.com",
  "password": "securePassword123"
}
```

### `POST /api/auth/link-child`
Link a child user to a parent account.

**Body:**
```json
{
  "parentUserId": "clx...",
  "childUserId": "clx..."
}
```

> **Note**: The auth middleware is non-blocking -- anonymous users (without a token) can still access the API for backward compatibility. Authenticated requests include the user in `req.user`.

### OAuth Social Login

#### `GET /api/auth/providers`
Returns which OAuth providers are currently enabled on the server.

**Response:**
```json
{
  "providers": {
    "google": true,
    "apple": true
  }
}
```

#### `GET /api/auth/google`
Redirects to Google OAuth 2.0 consent screen. Sets a CSRF `state` parameter in the session.

#### `GET /api/auth/google/callback`
Google OAuth callback. Validates CSRF `state`, exchanges the authorization code for tokens, creates or links the user account, and returns JWT tokens.

**Response:**
```json
{
  "user": { "id": "clx...", "email": "user@gmail.com", "name": "Pablo", "role": "child", "authProvider": "google" },
  "accessToken": "eyJhbG...",
  "refreshToken": "abc123..."
}
```

#### `POST /api/auth/google/token`
Mobile flow: verify a Google ID token obtained from the native Google Sign-In SDK.

**Body:**
```json
{
  "idToken": "eyJhbG..."
}
```

**Response:** Same as `/api/auth/google/callback`.

#### `GET /api/auth/apple`
Redirects to Apple authorization page. Sets a CSRF `state` and `nonce` in the session.

#### `POST /api/auth/apple/callback`
Apple Sign In callback (POST, per Apple's spec). Validates CSRF `state`, verifies the `id_token` against Apple's JWKS endpoint, checks `nonce`, and returns JWT tokens.

**Response:**
```json
{
  "user": { "id": "clx...", "email": "user@privaterelay.appleid.com", "name": "Pablo", "role": "child", "authProvider": "apple" },
  "accessToken": "eyJhbG...",
  "refreshToken": "abc123..."
}
```

#### `POST /api/auth/apple/token`
Mobile flow: verify an Apple identity token obtained from the native Apple Sign-In SDK.

**Body:**
```json
{
  "identityToken": "eyJhbG...",
  "fullName": { "givenName": "Pablo", "familyName": "Garcia" }
}
```

**Response:** Same as `/api/auth/apple/callback`.

### Token details

| Token | TTL | Storage |
|-------|-----|---------|
| Access token (JWT) | 15 minutes | Memory / HTTP header |
| Refresh token | 7 days | Database (`RefreshToken` model), rotated on each refresh |

---

## Articles

> **Note**: Several news sub-routes use Spanish paths (`/fuentes/`, `/sincronizar`, `/resumen`). Always verify against `apps/api/src/routes/news.ts`.

### `GET /api/news`
List of articles with filters and pagination. Results are ranked by the feed ranker when a user ID is provided (team affinity, sport preference, source following).

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `sport` | string | -- | Filter by sport (football, basketball, etc.) |
| `team` | string | -- | Filter by team (partial match) |
| `age` | number | -- | Filter articles appropriate for this age |
| `source` | string | -- | Filter by source (partial match) |
| `userId` | string | -- | User ID for personalized feed ranking |
| `q` | string | -- | Search query (matches title and summary via SQL LIKE) |
| `mode` | string | `cards` | Display mode: `headlines`, `cards`, `explain` |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Results per page (max 50) |

**Response:**
```json
{
  "news": [
    {
      "id": "clx...",
      "title": "Real Madrid wins the Champions League",
      "summary": "The white team...",
      "imageUrl": "https://...",
      "source": "AS - Football",
      "sourceUrl": "https://as.com/...",
      "sport": "football",
      "team": "Real Madrid",
      "minAge": 6,
      "maxAge": 14,
      "publishedAt": "2026-03-22T10:00:00.000Z",
      "createdAt": "2026-03-22T18:00:00.000Z",
      "rssGuid": "https://as.com/...",
      "safetyStatus": "approved"
    }
  ],
  "total": 500,
  "page": 1,
  "totalPages": 25
}
```

### `GET /api/news/:id`
Article detail by ID.

### `GET /api/news/:id/resumen`
Get an age-adapted AI summary of a news article.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `age` | string | `9-11` | Age range: `6-8`, `9-11`, or `12-14` |
| `locale` | string | `es` | Language: `es` or `en` |

**Response:**
```json
{
  "summary": "A simplified explanation of the article...",
  "ageRange": "6-8",
  "locale": "es",
  "newsItemId": "clx..."
}
```

### `GET /api/news/trending`
IDs of trending news (most viewed in the last 24h). Threshold: >5 views.

**Response:**
```json
{
  "trendingIds": ["clx...", "clx..."]
}
```

### `GET /api/news/fuentes/listado`
List of active RSS sources.

### `GET /api/news/fuentes/catalogo`
Full catalog of all RSS sources (active and inactive), including custom sources.

### `POST /api/news/fuentes/custom`
Add a custom RSS source. **Requires JWT authentication** (`Authorization: Bearer <token>`).

**Body:**
```json
{
  "name": "My Sports Blog",
  "url": "https://example.com/rss",
  "sport": "football",
  "userId": "clx..."
}
```

### `DELETE /api/news/fuentes/custom`
Remove a custom RSS source.

**Body:**
```json
{
  "sourceId": "clx...",
  "userId": "clx..."
}
```

### `POST /api/news/sincronizar`
Triggers manual synchronization of all feeds.

**Response:**
```json
{ "message": "Sync completed", "newsAdded": 42 }
```

---

## Reels

### `GET /api/reels`
Short video feed. Only returns reels with `safetyStatus: "approved"`. Order is random but deterministic per day (seed: `md5(id || UTC_date)`): the feed rotates at midnight UTC for variety. Falls back to `publishedAt` descending in non-PostgreSQL environments.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `sport` | string | -- | Filter by sport |
| `age` | number | -- | Filter by appropriate age |
| `page` | number | 1 | Page |
| `limit` | number | 10 | Results per page |

**Response:**
```json
{
  "reels": [
    {
      "id": "clx...",
      "title": "Top 10 goals of La Liga",
      "videoUrl": "https://www.youtube.com/embed/...",
      "thumbnailUrl": "https://img.youtube.com/vi/.../mqdefault.jpg",
      "source": "La Liga Official",
      "sport": "football",
      "team": "Real Madrid",
      "minAge": 6,
      "maxAge": 14,
      "durationSeconds": 60,
      "videoType": "youtube_embed",
      "aspectRatio": "16:9",
      "rssGuid": "yt:video:abc123def45",
      "videoSourceId": "clx...",
      "safetyStatus": "approved",
      "publishedAt": "2026-03-25T10:00:00.000Z",
      "createdAt": "2026-03-25T12:00:00.000Z"
    }
  ],
  "total": 10,
  "page": 1,
  "totalPages": 1
}
```

### `GET /api/reels/:id`
Reel detail by ID.

### `GET /api/reels/sources/list`
Active video sources.

### `GET /api/reels/sources/catalog`
Full video source catalog with per-sport counts.

### `POST /api/reels/sources/custom`
Add a custom video source. Body: `{ name, feedUrl, platform, sport, userId, channelId?, playlistId? }`.

### `DELETE /api/reels/sources/custom/:id`
Delete a custom video source. Requires auth. Only the user who created it can delete it.

### `POST /api/reels/sync`
Manual video sync of all active video sources. Requires auth.

---

## Quiz

### `GET /api/quiz/questions`
Get random questions. Supports age-based filtering and daily quiz questions.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `count` | number | 5 | Number of questions (max 20) |
| `sport` | string | -- | Filter by sport |
| `age` | string | -- | Filter by age range (`6-8`, `9-11`, `12-14`) |
| `daily` | boolean | false | Return only daily quiz questions |

**Response:**
```json
{
  "questions": [
    {
      "id": "clx...",
      "question": "How many players does a football team have?",
      "options": ["9", "10", "11", "12"],
      "correctAnswer": 2,
      "sport": "football",
      "points": 10,
      "relatedArticleId": null,
      "isDaily": false,
      "ageRange": "9-11",
      "generatedAt": null,
      "expiresAt": null
    }
  ]
}
```

### `POST /api/quiz/answer`
Submit an answer and receive feedback. Awards gamification points (+10 correct, +50 perfect round of 5/5).

**Body:**
```json
{
  "userId": "clx...",
  "questionId": "clx...",
  "answer": 2
}
```

**Response:**
```json
{
  "correct": true,
  "correctAnswer": 2,
  "pointsEarned": 10
}
```

### `GET /api/quiz/score/:userId`
User's total score.

### `POST /api/quiz/generate`
Manually trigger AI-generated quiz questions from recent news articles. Uses round-robin by sport.

**Body:**
```json
{
  "sport": "football",
  "count": 5,
  "ageRange": "9-11"
}
```

**Response:**
```json
{
  "generated": 5,
  "questions": [ ... ]
}
```

---

## Users

### `POST /api/users`
Create user (onboarding).

**Body:**
```json
{
  "name": "Pablo",
  "age": 10,
  "favoriteSports": ["football", "tennis"],
  "favoriteTeam": "Real Madrid",
  "selectedFeeds": []
}
```

### `GET /api/users/:id`
Get user profile (includes `totalPoints`, `loginStreak`, `notificationPreferences`).

### `PUT /api/users/:id`
Update user preferences (all fields optional).

### `POST /api/users/:id/notifications`
Update notification preferences.

**Body:**
```json
{
  "dailyQuiz": true,
  "teamNews": true,
  "achievements": false
}
```

### `GET /api/users/:id/notifications`
Get current notification preferences.

### `POST /api/users/:id/notifications/subscribe`
Register a push notification token (Expo push token) for the user.

**Body:**
```json
{
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxx]"
}
```

**Response:**
```json
{
  "success": true,
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxx]"
}
```

> Push tokens are stored in the `PushToken` model and used by the server to deliver notifications via `expo-server-sdk`.

---

## Parental Control

> **Note**: Parental routes use Spanish paths (`/configurar`, `/verificar-pin`, `/perfil/`, `/actividad/`). Always verify against `apps/api/src/routes/parents.ts`.

### `POST /api/parents/configurar`
Create or update parental profile with PIN. PIN is hashed with bcrypt.

**Body:**
```json
{
  "userId": "clx...",
  "pin": "1234",
  "allowedFormats": ["news", "quiz"],
  "allowedSports": ["football", "basketball"],
  "maxDailyTimeMinutes": 30
}
```

### `POST /api/parents/verificar-pin`
Verify access PIN. Returns a session token (5-minute TTL) on success. Transparently migrates legacy SHA-256 hashes to bcrypt.

**PIN lockout**: after 5 consecutive failed attempts, the account is locked for 15 minutes.

**Body:**
```json
{ "userId": "clx...", "pin": "1234" }
```

**Response (success):**
```json
{
  "verified": true,
  "exists": true,
  "sessionToken": "abc123...",
  "profile": { ... }
}
```

**Response (wrong PIN -- 401):**
```json
{
  "error": "Incorrect PIN",
  "attemptsRemaining": 3
}
```

**Response (locked out -- 423):**
```json
{
  "error": "Account locked due to too many failed attempts",
  "lockedUntil": "2026-03-27T18:15:00.000Z",
  "remainingSeconds": 900
}
```

### `GET /api/parents/perfil/:userId`
Get parental profile (without PIN).

### `PUT /api/parents/perfil/:userId`
Update restrictions.

**Body:**
```json
{
  "allowedFormats": ["news"],
  "allowedSports": ["football"],
  "maxDailyTimeMinutes": 45
}
```

### `GET /api/parents/actividad/:userId`
Weekly activity summary with duration tracking.

**Response:**
```json
{
  "news_viewed": 12,
  "reels_viewed": 5,
  "quizzes_played": 3,
  "totalPoints": 85,
  "totalDurationMinutes": 42,
  "period": "last 7 days"
}
```

### `POST /api/parents/actividad/registrar`
Log a user action with optional duration and content details.

**Body:**
```json
{
  "userId": "clx...",
  "type": "news_viewed",
  "durationSeconds": 120,
  "contentId": "clx...",
  "sport": "football"
}
```

### `GET /api/parents/preview/:userId`
Preview the child's feed with parental restrictions applied. Lets parents see exactly what the child sees.

**Response:**
```json
{
  "news": [ ... ],
  "reels": [ ... ],
  "restrictions": {
    "allowedFormats": ["news", "quiz"],
    "allowedSports": ["football", "basketball"],
    "maxNewsMinutes": 20,
    "maxReelsMinutes": 10,
    "maxQuizMinutes": 15
  }
}
```

### `PUT /api/parents/digest/:userId`
Configure weekly digest preferences.

**Body:**
```json
{
  "digestEnabled": true,
  "digestEmail": "parent@example.com",
  "digestDay": 1
}
```

| Field | Type | Description |
|-------|------|-------------|
| `digestEnabled` | boolean | Enable/disable digest |
| `digestEmail` | string (email) | Email to send digest to (nullable) |
| `digestDay` | number (0-6) | Day of week (0=Sunday, 1=Monday, ...) |

### `GET /api/parents/digest/:userId`
Get digest preferences.

**Response:**
```json
{
  "digestEnabled": true,
  "digestEmail": "parent@example.com",
  "digestDay": 1
}
```

### `GET /api/parents/digest/:userId/preview`
Preview the digest data as JSON.

**Response:**
```json
{
  "childName": "Pablo",
  "period": "2026-03-19 — 2026-03-26",
  "activity": { "news_viewed": 12, "reels_viewed": 5, "quizzes_played": 3, "totalMinutes": 47 },
  "topSports": ["football", "basketball"],
  "achievements": [],
  "streakDays": 5
}
```

### `GET /api/parents/digest/:userId/download`
Download the digest as a PDF file. Returns `Content-Type: application/pdf`.

---

## Daily Missions

### `GET /api/missions/today/:userId`
Get the user's daily mission. If none exists for today, one is generated automatically.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `locale` | string | `es` | Language: `es`, `en` |

**Response:**
```json
{
  "id": "clx...",
  "userId": "clx...",
  "date": "2026-03-26",
  "type": "read_news",
  "title": "Curious Reader",
  "description": "Read 3 news articles today",
  "target": 3,
  "progress": 1,
  "completed": false,
  "rewardType": "sticker",
  "rewardRarity": "rare",
  "rewardPoints": 15,
  "claimed": false
}
```

### `POST /api/missions/claim`
Claim the reward for a completed mission.

**Body:**
```json
{ "userId": "clx..." }
```

**Response:**
```json
{
  "claimed": true,
  "pointsAwarded": 15,
  "stickerAwarded": { "id": "clx...", "name": "...", "rarity": "rare" }
}
```

---

## Content Reports

### `POST /api/reports`
Submit a content report (child flags content as inappropriate).

**Body:**
```json
{
  "userId": "clx...",
  "contentType": "news",
  "contentId": "clx...",
  "reason": "inappropriate",
  "details": "Optional text with more context"
}
```

**Response:**
```json
{
  "id": "clx...",
  "status": "pending",
  "createdAt": "2026-03-26T10:00:00.000Z"
}
```

### `GET /api/reports/parent/:userId`
Get reports submitted by the child, for parental review.

**Response:**
```json
{
  "reports": [
    {
      "id": "clx...",
      "contentType": "news",
      "contentId": "clx...",
      "reason": "inappropriate",
      "details": null,
      "status": "pending",
      "createdAt": "2026-03-26T10:00:00.000Z"
    }
  ]
}
```

### `PUT /api/reports/:reportId`
Update a report's status (parental review).

**Body:**
```json
{
  "status": "reviewed"
}
```

**Response:**
```json
{
  "id": "clx...",
  "status": "reviewed",
  "updatedAt": "2026-03-26T12:00:00.000Z"
}
```

---

## Gamification

### `GET /api/gamification/stickers`
Get all available stickers, optionally filtered by sport.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `sport` | string | -- | Filter by sport |

### `GET /api/gamification/stickers/:userId`
Get a user's collected stickers.

### `GET /api/gamification/achievements`
Get all available achievements.

### `GET /api/gamification/achievements/:userId`
Get a user's unlocked achievements.

### `POST /api/gamification/check-in`
Register a daily login check-in. Awards +2 points and updates the login streak.

**Body:**
```json
{ "userId": "clx..." }
```

**Response:**
```json
{
  "pointsAwarded": 2,
  "loginStreak": 5,
  "newStickers": [],
  "newAchievements": []
}
```

### `GET /api/gamification/summary/:userId`
Get a user's full gamification summary (points, streak, sticker count, achievement count).

---

## Teams

### `GET /api/teams/:name/stats`
Get team statistics by team name.

**Response:**
```json
{
  "teamName": "Real Madrid",
  "sport": "football",
  "wins": 22,
  "draws": 5,
  "losses": 3,
  "position": 1,
  "topScorer": "Vinicius Jr",
  "nextMatch": "Real Madrid vs Barcelona - March 30",
  "updatedAt": "2026-03-24T00:00:00.000Z"
}
```

---

## Data Models (new)

### RefreshToken
Stores refresh tokens for JWT authentication.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Primary key |
| `token` | string | Unique refresh token string |
| `userId` | string | FK to User |
| `expiresAt` | DateTime | Expiration date (7 days from creation) |
| `revoked` | boolean | Whether the token has been revoked |

### PushToken
Stores Expo push notification tokens per user.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Primary key |
| `userId` | string | FK to User |
| `token` | string | Expo push token (`ExponentPushToken[...]`) |
| `createdAt` | DateTime | When the token was registered |

### User (new fields)

| Field | Type | Description |
|-------|------|-------------|
| `email` | string? | Email for authentication (nullable for anonymous users) |
| `passwordHash` | string? | bcrypt-hashed password |
| `authProvider` | string | Auth provider: `local` or `anonymous` |
| `role` | string | User role: `child`, `parent`, or `admin` |
| `parentUserId` | string? | FK to parent User (for linked accounts) |
| `locale` | string | User locale for per-user localization (default: `es`) |

---

## Rate Limiting

All API endpoints are protected by rate limiting (`express-rate-limit`). Requests exceeding the limit receive a `429 Too Many Requests` response with standard rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`).

| Tier | Routes | Limit | Env var |
|------|--------|-------|---------|
| Auth | `/api/auth/login`, `/api/auth/register` | 5 req/min | `RATE_LIMIT_AUTH` |
| PIN | `/api/parents/verify-pin` | 10 req/min | `RATE_LIMIT_PIN` |
| Content | `/api/news/*`, `/api/reels/*`, `/api/quiz/*` | 60 req/min | `RATE_LIMIT_CONTENT` |
| Sync | `/api/news/sync`, `/api/reels/sync`, `/api/teams/sync` | 2 req/min | `RATE_LIMIT_SYNC` |
| Default | All other `/api/*` | 100 req/min | `RATE_LIMIT_DEFAULT` |

All limits are configurable via the corresponding environment variables.

---

## Admin

### `GET /api/admin/moderation/pending`
Returns all content (news and reels) in `pending` moderation status.

**Requires**: `Authorization: Bearer <token>` with `admin` role.

**Response:**
```json
{
  "news": {
    "count": 3,
    "items": [
      { "id": "...", "title": "...", "source": "AS", "sport": "football", "safetyReason": null, "createdAt": "..." }
    ]
  },
  "reels": {
    "count": 1,
    "items": [
      { "id": "...", "title": "...", "sport": "tennis", "safetyReason": null, "createdAt": "..." }
    ]
  },
  "totalPending": 4
}
```

---

## Internationalization (i18n)

All user-facing strings returned by the API support internationalization. The shared package (`@sportykids/shared`) includes an i18n system at `packages/shared/src/i18n/` with locale files (`es.json`, `en.json`) and a `t(key, locale)` translation function.

- The API uses English identifiers internally (model names, field names)
- Some route paths are in Spanish (news sub-routes, parents) -- see notes above
- User-facing labels and messages can be localized via the `t()` function
- Supported locales: `es` (Spanish), `en` (English)
