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

## Autenticacion (Auth)

### `POST /api/auth/register`
Registro de usuario con email y contrasena. El password se hashea con bcrypt.

**Body:**
```json
{
  "email": "padre@example.com",
  "password": "miPassword123",
  "name": "Pablo",
  "role": "parent"
}
```

**Respuesta:**
```json
{
  "user": {
    "id": "clx...",
    "email": "padre@example.com",
    "name": "Pablo",
    "role": "parent"
  },
  "accessToken": "eyJhbG...",
  "refreshToken": "abc123..."
}
```

### `POST /api/auth/login`
Login con email y contrasena. Devuelve access token (15 min TTL) y refresh token (7 dias, rotado).

**Body:**
```json
{
  "email": "padre@example.com",
  "password": "miPassword123"
}
```

**Respuesta:**
```json
{
  "user": { "id": "clx...", "email": "padre@example.com", "name": "Pablo", "role": "parent" },
  "accessToken": "eyJhbG...",
  "refreshToken": "abc123..."
}
```

### `POST /api/auth/refresh`
Rota el refresh token y emite un nuevo access token.

**Body:**
```json
{ "refreshToken": "abc123..." }
```

**Respuesta:**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "def456..."
}
```

### `POST /api/auth/logout`
Invalida el refresh token actual.

**Body:**
```json
{ "refreshToken": "abc123..." }
```

### `GET /api/auth/me`
Obtener el usuario autenticado a partir del access token (header `Authorization: Bearer <token>`).

**Respuesta:**
```json
{
  "id": "clx...",
  "email": "padre@example.com",
  "name": "Pablo",
  "role": "parent"
}
```

### `POST /api/auth/upgrade`
Convertir un usuario anonimo existente en usuario autenticado (anadir email + password).

**Body:**
```json
{
  "userId": "clx...",
  "email": "padre@example.com",
  "password": "miPassword123"
}
```

### `POST /api/auth/link-child`
Vincular un perfil de nino a una cuenta de padre autenticada.

**Body:**
```json
{
  "parentUserId": "clx...",
  "childUserId": "clx..."
}
```

> **Nota**: El middleware de autenticacion es **no bloqueante** — compatible con usuarios anonimos existentes. Si se proporciona un token JWT valido, se adjunta el usuario al request; si no, el request continua sin autenticacion.

### OAuth Social Login

#### `GET /api/auth/providers`
Devuelve que proveedores OAuth estan habilitados en el servidor.

**Respuesta:**
```json
{
  "providers": {
    "google": true,
    "apple": true
  }
}
```

#### `GET /api/auth/google`
Redirige a la pantalla de consentimiento de Google OAuth 2.0. Establece un parametro CSRF `state` en la sesion.

#### `GET /api/auth/google/callback`
Callback de Google OAuth. Valida el `state` CSRF, intercambia el codigo de autorizacion por tokens, crea o vincula la cuenta de usuario y devuelve tokens JWT.

**Respuesta:**
```json
{
  "user": { "id": "clx...", "email": "user@gmail.com", "name": "Pablo", "role": "child", "authProvider": "google" },
  "accessToken": "eyJhbG...",
  "refreshToken": "abc123..."
}
```

#### `POST /api/auth/google/token`
Flujo mobile: verifica un Google ID token obtenido del SDK nativo de Google Sign-In.

**Body:**
```json
{
  "idToken": "eyJhbG..."
}
```

**Respuesta:** Igual que `/api/auth/google/callback`.

#### `GET /api/auth/apple`
Redirige a la pagina de autorizacion de Apple. Establece `state` CSRF y `nonce` en la sesion.

#### `POST /api/auth/apple/callback`
Callback de Apple Sign In (POST, segun la especificacion de Apple). Valida el `state` CSRF, verifica el `id_token` contra el endpoint JWKS de Apple, comprueba el `nonce` y devuelve tokens JWT.

**Respuesta:**
```json
{
  "user": { "id": "clx...", "email": "user@privaterelay.appleid.com", "name": "Pablo", "role": "child", "authProvider": "apple" },
  "accessToken": "eyJhbG...",
  "refreshToken": "abc123..."
}
```

#### `POST /api/auth/apple/token`
Flujo mobile: verifica un Apple identity token obtenido del SDK nativo de Apple Sign-In.

**Body:**
```json
{
  "identityToken": "eyJhbG...",
  "fullName": { "givenName": "Pablo", "familyName": "Garcia" }
}
```

**Respuesta:** Igual que `/api/auth/apple/callback`.

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
| `q` | string | — | Busqueda por texto (coincide en titulo y resumen via SQL LIKE) |
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

### `GET /api/news/trending`
IDs de noticias en tendencia (mas vistas en las ultimas 24h). Umbral: >5 vistas.

**Respuesta:**
```json
{
  "trendingIds": ["clx...", "clx..."]
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
Anadir una fuente RSS personalizada. **Requiere autenticacion JWT** (`Authorization: Bearer <token>`).

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
Feed de videos cortos. Solo devuelve reels con `safetyStatus: "approved"`, ordenados por `publishedAt` descendente.

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
      "thumbnailUrl": "https://img.youtube.com/vi/.../mqdefault.jpg",
      "source": "La Liga Official",
      "sport": "football",
      "team": "Real Madrid",
      "minAge": 6,
      "maxAge": 14,
      "durationSeconds": 60,
      "videoType": "youtube_embed",
      "aspectRatio": "16:9",
      "previewGifUrl": null,
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
Detalle de un reel por ID.

### `GET /api/reels/sources/list`
Fuentes de video activas.

### `GET /api/reels/sources/catalog`
Catalogo completo de fuentes de video con conteo por deporte.

**Respuesta:**
```json
{
  "sources": [...],
  "total": 22,
  "bySport": { "football": 5, "basketball": 3, ... }
}
```

### `POST /api/reels/sources/custom`
Anadir fuente de video personalizada.

**Body:**
```json
{
  "name": "Mi Canal",
  "feedUrl": "https://www.youtube.com/feeds/videos.xml?channel_id=UC...",
  "platform": "youtube_channel",
  "sport": "football",
  "userId": "user-id",
  "channelId": "UC..."
}
```

### `DELETE /api/reels/sources/custom/:id`
Eliminar fuente de video personalizada. Requiere autenticacion. Solo el usuario que la creo puede eliminarla.

### `POST /api/reels/sync`
Sincronizacion manual de todas las fuentes de video. Requiere autenticacion.

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

### `POST /api/users/:id/notifications/subscribe`
Suscribir preferencias de notificacion y registrar push token del dispositivo.

**Body:**
```json
{
  "dailyQuiz": true,
  "newStickers": true,
  "teamNews": true,
  "weeklyReport": false,
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

El campo `pushToken` es un token de Expo Push Notifications. Se almacena en el modelo `PushToken` y se usa para enviar notificaciones push reales al dispositivo.

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
Verificar PIN de acceso. Devuelve un token de sesion (TTL 5 minutos). Migra transparentemente hashes SHA-256 legacy a bcrypt.

**Bloqueo por intentos fallidos**: tras 5 intentos consecutivos incorrectos, la cuenta se bloquea durante 15 minutos.

**Body:**
```json
{ "userId": "clx...", "pin": "1234" }
```

**Respuesta (exito):**
```json
{
  "verified": true,
  "exists": true,
  "profile": { ... },
  "sessionToken": "abc123...",
  "sessionExpiresAt": "2026-03-24T18:05:00.000Z"
}
```

**Respuesta (PIN incorrecto -- 401):**
```json
{
  "error": "PIN incorrecto",
  "attemptsRemaining": 3
}
```

**Respuesta (cuenta bloqueada -- 423):**
```json
{
  "error": "Cuenta bloqueada por demasiados intentos fallidos",
  "lockedUntil": "2026-03-27T18:15:00.000Z",
  "remainingSeconds": 900
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

### `GET /api/parents/preview/:userId`
Preview del feed del hijo con las restricciones parentales aplicadas. Permite a los padres ver exactamente lo que el nino ve.

**Respuesta:**
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
Configurar preferencias de digest semanal.

**Body:**
```json
{
  "digestEnabled": true,
  "digestEmail": "padre@example.com",
  "digestDay": 1
}
```

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `digestEnabled` | boolean | Activar/desactivar digest |
| `digestEmail` | string (email) | Email donde enviar el digest (nullable) |
| `digestDay` | number (0-6) | Dia de la semana (0=domingo, 1=lunes, ...) |

### `GET /api/parents/digest/:userId`
Obtener preferencias de digest.

**Respuesta:**
```json
{
  "digestEnabled": true,
  "digestEmail": "padre@example.com",
  "digestDay": 1
}
```

### `GET /api/parents/digest/:userId/preview`
Vista previa del digest en formato JSON.

**Respuesta:**
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
Descargar el digest como PDF. Devuelve `Content-Type: application/pdf`.

---

## Misiones diarias (Daily Missions)

### `GET /api/missions/today/:userId`
Obtener la mision diaria del usuario. Si no existe, se genera automaticamente.

**Query params:**

| Param | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `locale` | string | `es` | Idioma: `es`, `en` |

**Respuesta:**
```json
{
  "id": "clx...",
  "userId": "clx...",
  "date": "2026-03-26",
  "type": "read_news",
  "title": "Lector curioso",
  "description": "Lee 3 noticias hoy",
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
Reclamar la recompensa de una mision completada.

**Body:**
```json
{ "userId": "clx..." }
```

**Respuesta:**
```json
{
  "claimed": true,
  "pointsAwarded": 15,
  "stickerAwarded": { "id": "clx...", "name": "...", "rarity": "rare" }
}
```

---

## Reportes de contenido (Content Reports)

### `POST /api/reports`
Enviar un reporte de contenido (el nino marca contenido como inapropiado).

**Body:**
```json
{
  "userId": "clx...",
  "contentType": "news",
  "contentId": "clx...",
  "reason": "inappropriate",
  "details": "Texto opcional con mas contexto"
}
```

**Respuesta:**
```json
{
  "id": "clx...",
  "status": "pending",
  "createdAt": "2026-03-26T10:00:00.000Z"
}
```

### `GET /api/reports/parent/:userId`
Obtener reportes enviados por el hijo, para revision parental.

**Respuesta:**
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
Actualizar el estado de un reporte (revision parental).

**Body:**
```json
{
  "status": "reviewed"
}
```

**Respuesta:**
```json
{
  "id": "clx...",
  "status": "reviewed",
  "updatedAt": "2026-03-26T12:00:00.000Z"
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

## Modelos nuevos

### PushToken
Almacena tokens de push de Expo por usuario y dispositivo.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | string | ID unico |
| `userId` | string | Referencia al usuario |
| `token` | string | Expo push token (`ExponentPushToken[...]`) |
| `createdAt` | DateTime | Fecha de registro |

### RefreshToken
Almacena refresh tokens JWT para rotacion segura.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | string | ID unico |
| `userId` | string | Referencia al usuario |
| `token` | string | Token hasheado |
| `expiresAt` | DateTime | Expiracion (7 dias) |
| `createdAt` | DateTime | Fecha de creacion |

### Campos nuevos en User (autenticacion)

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `email` | string? | Email del usuario (unico, nullable) |
| `passwordHash` | string? | Hash bcrypt del password |
| `authProvider` | string | Proveedor de auth: `anonymous`, `email` |
| `role` | string | Rol: `child`, `parent` |
| `parentUserId` | string? | ID del padre (para vincular cuentas) |
| `locale` | string | Idioma preferido del usuario (`es`, `en`) |

---

## Triggers de push notifications

El sistema envia notificaciones push reales mediante `expo-server-sdk` en 5 escenarios:

| Trigger | Momento | Contenido |
|---------|---------|-----------|
| Quiz listo | Al generarse el quiz diario (06:00 UTC) | "Tu quiz del dia esta listo" |
| Noticia del equipo | Al sincronizar feeds, si hay noticia del equipo favorito | "Nueva noticia de [equipo]" |
| Recordatorio de racha | 20:00 UTC diario (cron) si el usuario no ha hecho check-in | "No pierdas tu racha de X dias" |
| Cromo obtenido | Al ganar un sticker via quiz/check-in/mision | "Has ganado un nuevo cromo: [nombre]" |
| Mision lista | Al generarse la mision diaria (05:00 UTC) | "Tu mision del dia te espera" |

Las notificaciones respetan las preferencias del usuario (`dailyQuiz`, `teamNews`, `newStickers`). Al tocar una notificacion, la app navega a la pantalla correspondiente (deep linking).

---

## Rate Limiting

Todos los endpoints de la API estan protegidos por rate limiting (`express-rate-limit`). Las peticiones que excedan el limite reciben una respuesta `429 Too Many Requests` con headers estandar de rate-limit (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`).

| Tier | Rutas | Limite | Variable de entorno |
|------|-------|--------|---------------------|
| Auth | `/api/auth/login`, `/api/auth/register` | 5 req/min | `RATE_LIMIT_AUTH` |
| PIN | `/api/parents/verify-pin` | 10 req/min | `RATE_LIMIT_PIN` |
| Content | `/api/news/*`, `/api/reels/*`, `/api/quiz/*` | 60 req/min | `RATE_LIMIT_CONTENT` |
| Sync | `/api/news/sync`, `/api/reels/sync`, `/api/teams/sync` | 2 req/min | `RATE_LIMIT_SYNC` |
| Default | Todos los demas `/api/*` | 100 req/min | `RATE_LIMIT_DEFAULT` |

Todos los limites son configurables via las variables de entorno correspondientes.

---

## Admin

### `GET /api/admin/moderation/pending`
Devuelve todo el contenido (noticias y reels) en estado `pending` de moderacion.

**Requiere**: `Authorization: Bearer <token>` con rol `admin`.

**Respuesta:**
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

## Nota sobre i18n

Los endpoints devuelven los datos con identificadores en ingles (nombres de campos, valores de deporte, tipos de actividad). Los clientes (webapp y app movil) son responsables de traducir estos valores al idioma del usuario utilizando la funcion `t(key, locale)` del paquete `@sportykids/shared`.

Ejemplo: el campo `sport: "football"` se muestra como "Futbol" en la UI espanola mediante `t('sports.football', 'es')`.
