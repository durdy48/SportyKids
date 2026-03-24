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

### `GET /api/news/fuentes/listado`
List of active RSS sources.

### `GET /api/news/fuentes/catalogo`
Full catalog of all RSS sources (active and inactive), including custom sources.

### `POST /api/news/fuentes/custom`
Add a custom RSS source.

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
Short video feed.

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
      "thumbnailUrl": "https://img.youtube.com/vi/.../hqdefault.jpg",
      "source": "SportyKids",
      "sport": "football",
      "team": null,
      "minAge": 6,
      "maxAge": 14,
      "durationSeconds": 120,
      "videoType": "youtube",
      "aspectRatio": "16:9",
      "previewGifUrl": null,
      "createdAt": "2026-03-22T18:00:00.000Z"
    }
  ],
  "total": 10,
  "page": 1,
  "totalPages": 1
}
```

### `GET /api/reels/:id`
Reel detail by ID.

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

**Body:**
```json
{ "userId": "clx...", "pin": "1234" }
```

**Response:**
```json
{
  "verified": true,
  "exists": true,
  "sessionToken": "abc123...",
  "profile": { ... }
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

## Internationalization (i18n)

All user-facing strings returned by the API support internationalization. The shared package (`@sportykids/shared`) includes an i18n system at `packages/shared/src/i18n/` with locale files (`es.json`, `en.json`) and a `t(key, locale)` translation function.

- The API uses English identifiers internally (model names, field names)
- Some route paths are in Spanish (news sub-routes, parents) -- see notes above
- User-facing labels and messages can be localized via the `t()` function
- Supported locales: `es` (Spanish), `en` (English)
