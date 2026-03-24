# API Reference

Base URL: `http://localhost:3001/api`

## Health Check

### `GET /api/health`
Verifica que la API esta corriendo y el estado del proveedor AI.

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-24T18:00:00.000Z",
  "aiProvider": "ollama",
  "aiAvailable": true
}
```

---

## Noticias (News)

> **Nota**: Las rutas auxiliares de noticias estan en espanol (`/fuentes/`, `/sincronizar`, `/resumen`).

### `GET /api/news`
Listado de noticias con filtros y paginacion. Protegido por middleware `parental-guard` (formato, deporte, tiempo).

**Query params:**

| Param | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `sport` | string | — | Filtrar por deporte (`football`, `basketball`, etc.) |
| `team` | string | — | Filtrar por equipo (busqueda parcial) |
| `age` | number | — | Filtrar noticias apropiadas para esta edad |
| `source` | string | — | Filtrar por fuente (busqueda parcial) |
| `page` | number | 1 | Numero de pagina |
| `limit` | number | 20 | Resultados por pagina (max 50) |
| `userId` | string | — | Para ranking personalizado (feed ranker) |
| `mode` | string | `cards` | Modo de vista: `headlines`, `cards`, `explain` |

**Respuesta:**
```json
{
  "news": [
    {
      "id": "clx...",
      "title": "Real Madrid gana la Champions",
      "summary": "El equipo blanco...",
      "imageUrl": "https://...",
      "source": "AS - Futbol",
      "sourceUrl": "https://as.com/...",
      "sport": "football",
      "team": "Real Madrid",
      "minAge": 6,
      "maxAge": 14,
      "safetyStatus": "approved",
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

### `GET /api/news/:id/resumen`
Resumen adaptado por edad de una noticia, generado por IA.

**Query params:**

| Param | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `age` | string | `9-11` | Rango de edad: `6-8`, `9-11`, `12-14` |
| `locale` | string | `es` | Idioma del resumen: `es`, `en` |

**Respuesta:**
```json
{
  "newsItemId": "clx...",
  "ageRange": "6-8",
  "locale": "es",
  "summary": "Un equipo de futbol muy famoso llamado Real Madrid gano un partido muy importante..."
}
```

### `GET /api/news/fuentes/listado`
Lista de fuentes RSS activas.

### `GET /api/news/fuentes/catalogo`
Catalogo completo de fuentes disponibles (activas e inactivas), incluyendo fuentes personalizadas.

**Respuesta:**
```json
{
  "sources": [
    {
      "id": "clx...",
      "name": "AS - Futbol",
      "url": "https://feeds.as.com/...",
      "sport": "football",
      "active": true,
      "isCustom": false,
      "language": "es",
      "country": "ES",
      "lastSync": "2026-03-24T12:00:00.000Z"
    }
  ],
  "total": 47
}
```

### `POST /api/news/fuentes/custom`
Anadir una fuente RSS personalizada.

**Body:**
```json
{
  "userId": "clx...",
  "name": "ESPN Deportes",
  "url": "https://www.espn.com/espn/rss/...",
  "sport": "football",
  "language": "es",
  "country": "US"
}
```

### `DELETE /api/news/fuentes/custom`
Eliminar una fuente RSS personalizada.

**Body:**
```json
{ "sourceId": "clx...", "userId": "clx..." }
```

### `POST /api/news/sincronizar`
Ejecuta sincronizacion manual de todos los feeds.

**Respuesta:**
```json
{ "message": "Sync completed", "newsAdded": 42 }
```

---

## Reels

Protegido por middleware `parental-guard`.

### `GET /api/reels`
Feed de videos cortos.

**Query params:**

| Param | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `sport` | string | — | Filtrar por deporte |
| `age` | number | — | Filtrar por edad apropiada |
| `page` | number | 1 | Pagina |
| `limit` | number | 10 | Resultados por pagina |

**Respuesta:**
```json
{
  "reels": [
    {
      "id": "clx...",
      "title": "Top 10 goles de La Liga",
      "videoUrl": "https://www.youtube.com/embed/...",
      "thumbnailUrl": "https://img.youtube.com/vi/.../maxresdefault.jpg",
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
Detalle de un reel por ID.

---

## Quiz

Protegido por middleware `parental-guard`.

### `GET /api/quiz/questions`
Obtener preguntas aleatorias. Soporta filtrado por edad y preguntas diarias.

**Query params:**

| Param | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `count` | number | 5 | Numero de preguntas (max 20) |
| `sport` | string | — | Filtrar por deporte |
| `age` | string | — | Rango de edad: `6-8`, `9-11`, `12-14` |
| `daily` | boolean | false | Solo preguntas del quiz diario |

**Respuesta:**
```json
{
  "questions": [
    {
      "id": "clx...",
      "question": "Cuantos jugadores tiene un equipo de futbol?",
      "options": ["9", "10", "11", "12"],
      "correctAnswer": 2,
      "sport": "football",
      "points": 10,
      "relatedNewsItemId": null,
      "isDaily": false,
      "ageRange": "9-11",
      "generatedAt": null,
      "expiresAt": null
    }
  ]
}
```

### `POST /api/quiz/answer`
Enviar respuesta y recibir feedback. Actualiza puntos y evalua logros de gamificacion.

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
  "pointsEarned": 10,
  "newStickers": [],
  "newAchievements": []
}
```

### `GET /api/quiz/score/:userId`
Puntuacion total del usuario.

### `POST /api/quiz/generate`
Generacion manual de preguntas de quiz a partir de noticias recientes (usa IA).

**Body:**
```json
{
  "sport": "football",
  "count": 5,
  "ageRange": "9-11"
}
```

**Respuesta:**
```json
{
  "generated": 5,
  "questions": [...]
}
```

---

## Usuarios (Users)

### `POST /api/users`
Crear usuario (onboarding de 5 pasos).

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
Obtener perfil del usuario (incluye `streak`, `totalPoints`, `lastActiveDate`).

### `PUT /api/users/:id`
Actualizar preferencias del usuario (todos los campos opcionales).

### `POST /api/users/:id/notifications`
Guardar preferencias de notificacion del usuario.

**Body:**
```json
{
  "dailyQuiz": true,
  "newStickers": true,
  "teamNews": true,
  "weeklyReport": false
}
```

### `GET /api/users/:id/notifications`
Obtener preferencias de notificacion del usuario.

---

## Gamificacion

### `POST /api/gamification/checkin`
Registrar check-in diario. Otorga +2 puntos y actualiza racha.

**Body:**
```json
{ "userId": "clx..." }
```

**Respuesta:**
```json
{
  "pointsEarned": 2,
  "streak": 5,
  "newStickers": [],
  "newAchievements": [{ "id": "...", "name": "3-day streak", "icon": "..." }]
}
```

### `GET /api/gamification/stickers/:userId`
Obtener todos los cromos del usuario.

**Respuesta:**
```json
{
  "stickers": [
    {
      "id": "clx...",
      "sticker": {
        "name": "Golden Boot",
        "sport": "football",
        "rarity": "epic",
        "imageUrl": "..."
      },
      "earnedAt": "2026-03-24T10:00:00.000Z"
    }
  ],
  "total": 12,
  "available": 36
}
```

### `GET /api/gamification/achievements/:userId`
Obtener logros del usuario (desbloqueados y pendientes).

### `GET /api/gamification/leaderboard`
Tabla de clasificacion por puntos.

**Query params:**

| Param | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `limit` | number | 10 | Numero de usuarios |

### `GET /api/gamification/stats/:userId`
Estadisticas completas de gamificacion del usuario.

**Respuesta:**
```json
{
  "totalPoints": 450,
  "streak": 5,
  "stickersCollected": 12,
  "stickersTotal": 36,
  "achievementsUnlocked": 8,
  "achievementsTotal": 20,
  "rank": 3
}
```

### `POST /api/gamification/evaluate`
Forzar evaluacion de logros y cromos para un usuario.

**Body:**
```json
{ "userId": "clx..." }
```

---

## Equipos (Teams)

### `GET /api/teams/:name/stats`
Obtener estadisticas de un equipo.

**Respuesta:**
```json
{
  "teamName": "Real Madrid",
  "sport": "football",
  "wins": 22,
  "draws": 5,
  "losses": 3,
  "position": 1,
  "topScorer": "Vinicius Jr",
  "nextMatch": "vs Barcelona - 30 Mar",
  "updatedAt": "2026-03-24T00:00:00.000Z"
}
```

---

## Control Parental (Parents)

> **Nota**: Las rutas de control parental estan en espanol (`/configurar`, `/verificar-pin`, `/perfil/`, `/actividad/`).

### `POST /api/parents/configurar`
Crear o actualizar perfil parental con PIN. El PIN se hashea con bcrypt.

**Body:**
```json
{
  "userId": "clx...",
  "pin": "1234",
  "allowedFormats": ["news", "quiz"],
  "allowedSports": ["football", "basketball"],
  "maxDailyMinutes": 30
}
```

### `POST /api/parents/verificar-pin`
Verificar PIN de acceso. Devuelve un token de sesion (TTL 5 minutos).

**Body:**
```json
{ "userId": "clx...", "pin": "1234" }
```

**Respuesta:**
```json
{
  "verified": true,
  "exists": true,
  "profile": { ... },
  "sessionToken": "abc123...",
  "sessionExpiresAt": "2026-03-24T18:05:00.000Z"
}
```

### `GET /api/parents/perfil/:userId`
Obtener perfil parental (sin PIN).

### `PUT /api/parents/perfil/:userId`
Actualizar restricciones.

**Body:**
```json
{
  "allowedFormats": ["news"],
  "allowedSports": ["football"],
  "maxDailyMinutes": 45
}
```

### `GET /api/parents/actividad/:userId`
Resumen de actividad semanal con duraciones.

**Respuesta:**
```json
{
  "news_viewed": 12,
  "reels_viewed": 5,
  "quizzes_played": 3,
  "totalPoints": 85,
  "totalMinutes": 47,
  "period": "last 7 days",
  "byDay": [
    { "date": "2026-03-24", "minutes": 12, "activities": 5 }
  ],
  "bySport": {
    "football": 8,
    "basketball": 4
  }
}
```

### `POST /api/parents/actividad/registrar`
Registrar una accion del usuario con duracion.

**Body:**
```json
{
  "userId": "clx...",
  "type": "news_viewed",
  "durationSeconds": 45,
  "contentId": "clx...",
  "sport": "football"
}
```

---

## Middleware parental-guard

Las rutas de `news`, `reels` y `quiz` estan protegidas por el middleware `parental-guard.ts` que enforce restricciones server-side:

| Verificacion | Descripcion |
|-------------|-------------|
| **Formato** | Si el formato (news/reels/quiz) no esta en `allowedFormats`, devuelve 403 |
| **Deporte** | Si el deporte solicitado no esta en `allowedSports`, filtra resultados |
| **Tiempo** | Si el usuario ha excedido `maxDailyMinutes`, devuelve 429 |

## Nota sobre i18n

Los endpoints devuelven los datos con identificadores en ingles (nombres de campos, valores de deporte, tipos de actividad). Los clientes (webapp y app movil) son responsables de traducir estos valores al idioma del usuario utilizando la funcion `t(key, locale)` del paquete `@sportykids/shared`.

Ejemplo: el campo `sport: "football"` se muestra como "Futbol" en la UI espanola mediante `t('sports.football', 'es')`.
