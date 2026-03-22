# API Reference

Base URL: `http://localhost:3001/api`

## Health Check

### `GET /api/health`
Verifies that the API is running.

**Response:**
```json
{ "status": "ok", "timestamp": "2026-03-22T18:00:00.000Z" }
```

---

## Articles

### `GET /api/news`
List of articles with filters and pagination.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `sport` | string | — | Filter by sport (football, basketball, etc.) |
| `team` | string | — | Filter by team (partial match) |
| `age` | number | — | Filter articles appropriate for this age |
| `source` | string | — | Filter by source (partial match) |
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
      "rssGuid": "https://as.com/..."
    }
  ],
  "total": 163,
  "page": 1,
  "totalPages": 9
}
```

### `GET /api/news/:id`
Article detail by ID.

### `GET /api/news/sources/list`
List of active RSS sources.

### `POST /api/news/sync`
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
| `sport` | string | — | Filter by sport |
| `age` | number | — | Filter by appropriate age |
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
      "thumbnailUrl": "",
      "source": "SportyKids",
      "sport": "football",
      "team": null,
      "minAge": 6,
      "maxAge": 14,
      "durationSeconds": 120,
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
Get random questions.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `count` | number | 5 | Number of questions (max 20) |
| `sport` | string | — | Filter by sport |

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
      "relatedArticleId": null
    }
  ]
}
```

### `POST /api/quiz/answer`
Submit an answer and receive feedback.

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
Get user profile.

### `PUT /api/users/:id`
Update user preferences (all fields optional).

---

## Parental Control

### `POST /api/parents/configure`
Create or update parental profile with PIN.

**Body:**
```json
{
  "userId": "clx...",
  "pin": "1234",
  "allowedFormats": ["news", "quiz"],
  "maxDailyTimeMinutes": 30
}
```

### `POST /api/parents/verify-pin`
Verify access PIN.

**Body:**
```json
{ "userId": "clx...", "pin": "1234" }
```

**Response:**
```json
{ "verified": true, "exists": true, "profile": { ... } }
```

### `GET /api/parents/profile/:userId`
Get parental profile (without PIN).

### `PUT /api/parents/profile/:userId`
Update restrictions.

**Body:**
```json
{
  "allowedFormats": ["news"],
  "maxDailyTimeMinutes": 45
}
```

### `GET /api/parents/activity/:userId`
Weekly activity summary.

**Response:**
```json
{
  "news_viewed": 12,
  "reels_viewed": 5,
  "quizzes_played": 3,
  "totalPoints": 85,
  "period": "last 7 days"
}
```

### `POST /api/parents/activity/log`
Log a user action.

**Body:**
```json
{ "userId": "clx...", "type": "news_viewed" }
```

---

## Internationalization (i18n)

All user-facing strings returned by the API support internationalization. The shared package (`@sportykids/shared`) includes an i18n system at `packages/shared/src/i18n/` with locale files (`es.json`, `en.json`) and a `t(key, locale)` translation function.

- The API uses English identifiers internally (model names, field names, route paths)
- User-facing labels and messages can be localized via the `t()` function
- Supported locales: `es` (Spanish), `en` (English)
