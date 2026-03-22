# API Reference

Base URL: `http://localhost:3001/api`

## Health Check

### `GET /api/health`
Verifica que la API está corriendo.

**Respuesta:**
```json
{ "status": "ok", "timestamp": "2026-03-22T18:00:00.000Z" }
```

---

## Noticias (News)

### `GET /api/news`
Listado de noticias con filtros y paginación.

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `sport` | string | — | Filtrar por deporte (`football`, `basketball`, etc.) |
| `team` | string | — | Filtrar por equipo (búsqueda parcial) |
| `age` | number | — | Filtrar noticias apropiadas para esta edad |
| `source` | string | — | Filtrar por fuente (búsqueda parcial) |
| `page` | number | 1 | Número de página |
| `limit` | number | 20 | Resultados por página (max 50) |

**Respuesta:**
```json
{
  "news": [
    {
      "id": "clx...",
      "title": "Real Madrid gana la Champions",
      "summary": "El equipo blanco...",
      "imageUrl": "https://...",
      "source": "AS - Fútbol",
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
Detalle de una noticia por ID.

### `GET /api/news/sources/list`
Lista de fuentes RSS activas.

### `POST /api/news/sync`
Ejecuta sincronización manual de todos los feeds.

**Respuesta:**
```json
{ "message": "Sync completed", "newsAdded": 42 }
```

---

## Reels

### `GET /api/reels`
Feed de vídeos cortos.

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `sport` | string | — | Filtrar por deporte |
| `age` | number | — | Filtrar por edad apropiada |
| `page` | number | 1 | Página |
| `limit` | number | 10 | Resultados por página |

**Respuesta:**
```json
{
  "reels": [
    {
      "id": "clx...",
      "title": "Top 10 goles de La Liga",
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
Detalle de un reel por ID.

---

## Quiz

### `GET /api/quiz/questions`
Obtener preguntas aleatorias.

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `count` | number | 5 | Número de preguntas (max 20) |
| `sport` | string | — | Filtrar por deporte |

**Respuesta:**
```json
{
  "questions": [
    {
      "id": "clx...",
      "question": "¿Cuántos jugadores tiene un equipo de fútbol?",
      "options": ["9", "10", "11", "12"],
      "correctAnswer": 2,
      "sport": "football",
      "points": 10,
      "relatedNewsItemId": null
    }
  ]
}
```

### `POST /api/quiz/answer`
Enviar respuesta y recibir feedback.

**Body:**
```json
{
  "userId": "clx...",
  "questionId": "clx...",
  "answer": 2
}
```

**Respuesta:**
```json
{
  "correct": true,
  "correctAnswer": 2,
  "pointsEarned": 10
}
```

### `GET /api/quiz/score/:userId`
Puntuación total del usuario.

---

## Usuarios (Users)

### `POST /api/users`
Crear usuario (onboarding).

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
Obtener perfil del usuario.

### `PUT /api/users/:id`
Actualizar preferencias del usuario (todos los campos opcionales).

---

## Control Parental (Parents)

### `POST /api/parents/configure`
Crear o actualizar perfil parental con PIN.

**Body:**
```json
{
  "userId": "clx...",
  "pin": "1234",
  "allowedFormats": ["news", "quiz"],
  "maxDailyMinutes": 30
}
```

### `POST /api/parents/verify-pin`
Verificar PIN de acceso.

**Body:**
```json
{ "userId": "clx...", "pin": "1234" }
```

**Respuesta:**
```json
{ "verified": true, "exists": true, "profile": { ... } }
```

### `GET /api/parents/profile/:userId`
Obtener perfil parental (sin PIN).

### `PUT /api/parents/profile/:userId`
Actualizar restricciones.

**Body:**
```json
{
  "allowedFormats": ["news"],
  "maxDailyMinutes": 45
}
```

### `GET /api/parents/activity/:userId`
Resumen de actividad semanal.

**Respuesta:**
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
Registrar una acción del usuario.

**Body:**
```json
{ "userId": "clx...", "type": "news_viewed" }
```

---

## Nota sobre i18n

Los endpoints devuelven los datos con identificadores en inglés (nombres de campos, valores de deporte, tipos de actividad). Los clientes (webapp y app móvil) son responsables de traducir estos valores al idioma del usuario utilizando la función `t(key, locale)` del paquete `@sportykids/shared`.

Ejemplo: el campo `sport: "football"` se muestra como "Fútbol" en la UI española mediante `t('sports.football', 'es')`.
