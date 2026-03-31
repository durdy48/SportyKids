# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma y convenciones

- Las conversaciones con el usuario son en **español**.
- El código (variables, funciones, tipos, modelos, comentarios) está en **inglés**.
- La app soporta **i18n** (español e inglés) via `packages/shared/src/i18n/`. Usar `t(key, locale)` para toda string de UI visible. Helpers: `getSportLabel(sport, locale)`, `getAgeRangeLabel(range, locale)`.
- No hardcodear texto visible al usuario — siempre usar claves de traducción.
- Los valores de deporte son en inglés: `football`, `basketball`, `tennis`, `swimming`, `athletics`, `cycling`, `formula1`, `padel`.

## Descripción del proyecto

**SportyKids** — app de noticias deportivas personalizada para niños (6-14 años) con control parental, feeds RSS configurables, vídeos cortos (Reels) y quizzes interactivos.

**Estado**: MVP Fases 0-4 completadas. Pendiente Fase 5 (test con familias).

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Monorepo | npm workspaces | — |
| API | Express 5 + TypeScript | Node >= 20 |
| ORM | Prisma 6 | PostgreSQL 16 |
| Webapp | Next.js 16 (App Router) | Tailwind CSS 4 |
| App móvil | React Native 0.81 + Expo SDK 54 | React Navigation 7 |
| Validación | Zod 4 | — |
| RSS | rss-parser 3 | — |
| Cron | node-cron 4 | — |
| AI Client | openai SDK (multi-provider) | Ollama/OpenRouter/Anthropic |
| PDF | jspdf | Digest PDF generation |
| Email | nodemailer | Digest email delivery |
| Caching | CacheProvider (InMemory/Redis) | ioredis 5 (optional) |
| Monitoring | Sentry (opt-in) | Error tracking |
| Analytics | PostHog (opt-in) | Privacy-first analytics |
| Video | expo-video (mobile) | Native MP4 player |
| Rate Limiting | express-rate-limit 7 | IP-based tiered rate limiting |
| Secure Storage | expo-secure-store (mobile) | JWT token encryption |
| Haptics | expo-haptics (mobile) | Tactile feedback |
| Logging | Pino 9 | Structured JSON logging |
| Linting | ESLint 9 + Prettier | Flat config |
| OAuth | Passport.js + google-auth-library | Google & Apple Sign In |
| Shared | @sportykids/shared | Tipos, constantes, utils, i18n |

**Nota**: Prisma v7 no es compatible con este proyecto (rompe la config de datasource url). Usar Prisma ^6.

**Nota AI**: El AI client usa `openai` SDK como cliente universal para Ollama y OpenRouter (APIs compatibles). Anthropic se importa dinámicamente solo si `AI_PROVIDER=anthropic`. Por defecto `AI_PROVIDER=ollama` (gratis, local).

## Comandos de desarrollo

```bash
npm run dev:api          # API en :3001 (tsx watch)
npm run dev:web          # Webapp en :3000 (Next.js)
npm run dev:mobile       # App móvil (Expo)
npm run build:api        # Compilar API
npm run build:web        # Build producción webapp
npm run db:migrate       # Migraciones Prisma
npm run db:generate      # Generar cliente Prisma
npm run lint             # ESLint check
npm run lint:fix         # ESLint autofix
npm run test:web         # Web tests
npm run test:mobile      # Mobile tests
npm run test:all         # All workspace tests

# Seed (desde apps/api/)
npx tsx prisma/seed.ts
```

## Arquitectura del monorepo

```
sportykids/
├── packages/shared/src/
│   ├── types/           # User, NewsItem, Reel, QuizQuestion, ParentalProfile, AgeRange,
│   │                    # SafetyStatus, SafetyResult, RssSource, RssSourceCatalogResponse,
│   │                    # VideoSource, VideoPlatform, VideoSourceCatalogResponse,
│   │                    # AuthProvider ('anonymous'|'email'|'google'|'apple')
│   ├── constants/       # SPORTS, TEAMS, AGE_RANGES, COLORS, KID_FRIENDLY_ERRORS, ERROR_CODES
│   ├── utils/           # sportToColor, sportToEmoji, formatDate, truncateText, youtube.ts (child-safe embed)
│   └── i18n/            # es.json, en.json, t(), getSportLabel(), getAgeRangeLabel()
├── apps/api/
│   ├── prisma/          # schema.prisma, migrations/, seed.ts
│   └── src/
│       ├── routes/      # news.ts, reels.ts, quiz.ts, users.ts, parents.ts, reports.ts, missions.ts, auth.ts, admin.ts
│       ├── services/    # aggregator.ts (RSS), video-aggregator.ts (YouTube video RSS),
│       │                # classifier.ts (team detection),
│       │                # ai-client.ts (multi-provider), content-moderator.ts,
│       │                # summarizer.ts (age-adapted summaries),
│       │                # gamification.ts (streaks, stickers, achievements),
│       │                # feed-ranker.ts (behavioral + static feed ranking),
│       │                # team-stats.ts (team stats), team-stats-sync.ts (TheSportsDB live sync),
│       │                # team-ids.ts (TheSportsDB team ID mapping),
│       │                # cache.ts (CacheProvider interface + InMemoryCache + createCache factory + withCache middleware),
│       │                # redis-cache.ts (RedisCache provider, ioredis optional),
│       │                # digest-generator.ts (weekly digest PDF/email),
│       │                # mission-generator.ts (daily missions),
│       │                # auth-service.ts (JWT + password hashing),
│       │                # passport.ts (Passport.js OAuth strategies),
│       │                # push-sender.ts (Expo push notifications),
│       │                # monitoring.ts (Sentry + PostHog init),
│       │                # logger.ts (Pino structured logging),
│       │                # parental-session.ts (DB-backed parental sessions)
│       ├── jobs/        # sync-feeds.ts (cron cada 30min), sync-videos.ts (cron cada 6h),
│       │                # generate-daily-quiz.ts (cron 06:00 UTC),
│       │                # generate-daily-missions.ts (cron 05:00 UTC), send-weekly-digests.ts (cron 08:00 UTC diario),
│       │                # streak-reminder.ts (cron 20:00 UTC), sync-team-stats.ts (cron 04:00 UTC),
│       │                # mission-reminder.ts (cron 18:00 UTC — push for >50% progress missions)
│       ├── errors/       # index.ts (AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError, RateLimitError)
│       ├── middleware/   # error-handler.ts (typed: AppError/Prisma/Zod mapping, Sentry 5xx only), auth.ts (JWT non-blocking + requireAuth + requireRole), parental-guard.ts (M5 + schedule lock), rate-limiter.ts (5 tiers: auth/pin/content/sync/default), request-id.ts (X-Request-Id correlation)
│       └── config/      # database.ts (PrismaClient singleton)
├── apps/web/src/
│   ├── app/             # / (home, 3 feed modes), /onboarding (5 steps), /reels (TikTok vertical),
│   │                    # /quiz, /team (stats hub), /parents (5 tabs), /collection,
│   │                    # auth/callback/ (OAuth callback landing),
│   │                    # /age-gate (age verification gate), /privacy (Privacy Policy),
│   │                    # /terms (Terms of Service)
│   ├── components/      # NewsCard, FiltersBar, SearchBar, NavBar, OnboardingWizard, ReelCard,
│   │                    # QuizGame, PinInput, ParentalPanel, AgeAdaptedSummary,
│   │                    # StickerCard, StreakCounter, AchievementBadge, RewardToast,
│   │                    # FeedModeToggle, HeadlineRow, TeamStatsCard, TeamReelsStrip,
│   │                    # ReelPlayer, VerticalFeed, NotificationSettings, LimitReached,
│   │                    # ReportButton, ContentReportList, FeedPreviewModal, MissionCard,
│   │                    # ErrorState, OfflineBanner, ParentalTour, VideoPlayer, AgeGate
│   ├── lib/             # api.ts (cliente API), user-context.tsx (UserProvider + useUser), celebrations.ts (confetti animations), favorites.ts (client-side bookmarks), offline-cache.ts, analytics.ts
│   └── styles/          # globals.css (Tailwind + CSS vars)
├── apps/mobile/
│   ├── App.tsx           # Entry point (registerRootComponent)
│   ├── metro.config.js   # Monorepo-aware Metro config (disableHierarchicalLookup)
│   ├── app.json          # Expo config
│   └── src/
│       ├── App.tsx        # Root component (SafeAreaProvider + UserProvider + Navigation)
│       ├── screens/       # HomeFeed, Reels, Quiz, FavoriteTeam, Onboarding, ParentalControl, Collection, Login, Register, RssCatalog, AgeGate
│       ├── components/    # NewsCard, FiltersBar, StreakCounter, BrandedRefreshControl,
│       │                  # ErrorState, ErrorBoundary, OfflineBanner, VideoPlayer, ParentalTour
│       ├── navigation/    # Bottom tabs (6): News, Reels, Quiz, Collection, My Team, Parents + Stack (RssCatalog)
│       └── lib/           # api.ts, user-context.tsx, favorites.ts, auth.ts, push-notifications.ts, haptics.ts, offline-cache.ts, theme.ts (dark mode colors), secure-storage.ts (expo-secure-store abstraction)
├── eslint.config.js      # ESLint 9 flat config (monorepo root)
├── .prettierrc           # Prettier config
└── docs/
    ├── es/              # 10 documentos en español
    └── en/              # 10 documentos en inglés
```

## API REST — endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/news?sport=&team=&age=&page=&limit=&q=&locale=&userId=` | Noticias con filtros, busqueda, behavioral ranking (cached 5min) |
| GET | `/api/news/:id` | Detalle noticia |
| GET | `/api/news/:id/summary?age=&locale=` | Resumen adaptado por edad (M2) |
| GET | `/api/news/trending` | IDs de noticias en tendencia (>5 vistas en 24h) |
| GET | `/api/news/sources/list` | Fuentes RSS activas |
| GET | `/api/news/sources/catalog` | Catálogo completo de fuentes RSS con metadata |
| POST | `/api/news/sources/custom` | Añadir fuente RSS personalizada |
| DELETE | `/api/news/sources/custom/:id` | Eliminar fuente personalizada |
| POST | `/api/news/sync` | Sincronización manual (incluye stats de moderación) |
| GET | `/api/reels?sport=&age=&page=&limit=` | Feed de reels (solo approved, ordenado por publishedAt desc) |
| GET | `/api/reels/:id` | Detalle reel |
| GET | `/api/reels/sources/list` | Fuentes de video activas |
| GET | `/api/reels/sources/catalog` | Catálogo completo de fuentes de video con stats por deporte |
| POST | `/api/reels/sources/custom` | Añadir fuente de video personalizada |
| DELETE | `/api/reels/sources/custom/:id` | Eliminar fuente de video personalizada |
| POST | `/api/reels/sync` | Sincronización manual de videos (requireAuth) |
| GET | `/api/teams/:teamName/stats` | Estadísticas de equipo (cached 1h, live via TheSportsDB) |
| POST | `/api/users/:id/notifications/subscribe` | Suscribir preferencias de notificación (M6 MVP) |
| GET | `/api/users/:id/notifications` | Obtener preferencias de notificación |
| GET | `/api/quiz/questions?count=&sport=&age=` | Preguntas (daily first, seed fallback). `age`: '6-8','9-11','12-14' |
| POST | `/api/quiz/generate` | Genera quiz diario desde noticias recientes (M3) |
| POST | `/api/quiz/answer` | Enviar respuesta `{userId, questionId, answer}` |
| GET | `/api/quiz/score/:userId` | Puntuación total |
| GET | `/api/gamification/stickers` | Catálogo de stickers (M4) |
| GET | `/api/gamification/stickers/:userId` | Stickers coleccionados del usuario |
| GET | `/api/gamification/achievements` | Definiciones de logros |
| GET | `/api/gamification/achievements/:userId` | Logros desbloqueados del usuario |
| GET | `/api/gamification/streaks/:userId` | Info de racha del usuario |
| POST | `/api/gamification/check-in` | Check-in diario (racha + sticker + logros) |
| POST | `/api/users` | Crear usuario (onboarding). Acepta opcional `ageGateCompleted`, `consentGiven` |
| GET | `/api/users/:id` | Obtener usuario (incluye campos de consentimiento) |
| PUT | `/api/users/:id` | Actualizar preferencias y campos de consentimiento |
| DELETE | `/api/users/:id/data` | Eliminar todos los datos del usuario (requireAuth + parental session para menores). GDPR Art. 17 |
| POST | `/api/parents/setup` | Crear PIN parental |
| POST | `/api/parents/verify-pin` | Verificar PIN |
| GET | `/api/parents/profile/:userId` | Perfil parental |
| PUT | `/api/parents/profile/:userId` | Actualizar restricciones |
| GET | `/api/parents/activity/:userId` | Resumen actividad semanal |
| POST | `/api/parents/activity/log` | Registrar actividad |
| GET | `/api/parents/preview/:userId` | Preview del feed del hijo con restricciones aplicadas |
| PUT | `/api/parents/digest/:userId` | Configurar preferencias de digest semanal |
| GET | `/api/parents/digest/:userId` | Obtener preferencias de digest |
| GET | `/api/parents/digest/:userId/preview` | Vista previa del digest (JSON) |
| GET | `/api/parents/digest/:userId/download` | Descargar digest como PDF |
| POST | `/api/parents/digest/:userId/test` | Enviar email de prueba del digest (1 cada 5 min) |
| GET | `/api/missions/today/:userId` | Mision diaria del usuario |
| POST | `/api/missions/claim` | Reclamar recompensa de mision completada |
| POST | `/api/auth/register` | Registrar con email+password (devuelve JWT) |
| POST | `/api/auth/login` | Login con email+password (devuelve JWT) |
| POST | `/api/auth/refresh` | Renovar access token con refresh token |
| POST | `/api/auth/logout` | Revocar refresh token |
| GET | `/api/auth/me` | Usuario actual desde JWT (requireAuth) |
| POST | `/api/auth/upgrade` | Convertir usuario anónimo a cuenta email |
| POST | `/api/auth/link-child` | Parent vincula perfil de hijo anónimo |
| GET | `/api/auth/google` | Redirect to Google OAuth consent screen |
| GET | `/api/auth/google/callback` | Google OAuth callback, issues JWT pair |
| POST | `/api/auth/google/token` | Mobile: verify Google ID token, issue JWT pair |
| GET | `/api/auth/apple` | Redirect to Apple authorization |
| POST | `/api/auth/apple/callback` | Apple Sign In callback (POST), issues JWT pair |
| POST | `/api/auth/apple/token` | Mobile: verify Apple identity token, issue JWT pair |
| GET | `/api/auth/providers` | Returns which OAuth providers are configured |
| POST | `/api/reports` | Enviar reporte de contenido |
| GET | `/api/reports/parent/:userId` | Reportes del hijo (para revision parental) |
| PUT | `/api/reports/:reportId` | Actualizar estado del reporte |
| GET | `/api/news/history?userId=&page=&limit=` | Historial de lectura del usuario (paginado) |
| GET | `/api/news/:id/related?limit=3` | Artículos relacionados por equipo/deporte |
| POST | `/api/teams/sync` | Sincronización manual de stats desde TheSportsDB |
| GET | `/api/admin/moderation/pending` | Contenido pendiente de moderación (requireAuth + requireRole('admin')) |

**NOTA**: Todas las rutas API están en **inglés**. Verificar siempre contra `apps/api/src/routes/` antes de consumir desde frontends.

## Modelos de datos (Prisma)

- **NewsItem** — noticias agregadas de RSS (`rssGuid` único para dedup). Campos M1: `safetyStatus` (pending/approved/rejected), `safetyReason`, `moderatedAt`
- **User** — perfil del niño (`favoriteSports` y `selectedFeeds` son arrays nativos PostgreSQL `String[]`). Campos M4: `currentStreak`, `longestStreak`, `lastActiveDate`, `currentQuizCorrectStreak`, `quizPerfectCount`. Campos auth: `email` (unique), `passwordHash`, `authProvider` (anonymous/email/google/apple), `socialId` (String?, provider's external user ID), `role` (child/parent), `parentUserId`, `lastLoginAt`. Campo `locale` (default 'es'). Campo `country` (default 'ES', supported: ES/GB/US/FR/IT/DE). `pushPreferences` es `Json?` nativo. Campos legal/consent: `ageGateCompleted` (Boolean, default false), `consentGiven` (Boolean, default false), `consentDate` (DateTime?), `consentBy` (String? — who gave consent).
- **Sticker** — cromos digitales coleccionables (M4). Rarezas: common, rare, epic, legendary
- **UserSticker** — relación usuario-sticker (M4). Unique: `[userId, stickerId]`
- **Achievement** — definiciones de logros (M4). 20 predefinidos. Unique: `key`
- **UserAchievement** — logros desbloqueados por usuario (M4). Unique: `[userId, achievementId]`
- **Reel** — vídeos cortos (seed con YouTube embeds). Campos M6: `videoType`, `aspectRatio`, `previewGifUrl`. Campos video-aggregator: `rssGuid` (unique), `videoSourceId`, `safetyStatus` (default approved), `safetyReason`, `moderatedAt`, `publishedAt`
- **VideoSource** — fuentes de video (YouTube channels/playlists). Campos: `name`, `platform` (youtube_channel/youtube_playlist), `feedUrl` (unique), `channelId`, `playlistId`, `sport`, `active`, `isCustom`, `addedBy`, `lastSyncedAt`
- **TeamStats** — estadísticas de equipos (M6). Seed con 15 equipos. Unique: `teamName`. `recentResults` (Json) y `nextMatch` (Json?) usan tipos nativos PostgreSQL.
- **QuizQuestion** — preguntas trivia (`options` es array nativo `String[]`, `correctAnswer` es índice 0-3). Campos M3: `generatedAt`, `ageRange`, `expiresAt` (daily questions expire after 48h)
- **NewsSummary** — resúmenes adaptados por edad (M2). Unique: `[newsItemId, ageRange, locale]`. Cascade delete con NewsItem.
- **DailyMission** — misiones diarias del usuario. Campos: `userId`, `date`, `type`, `title`, `description`, `target`, `progress`, `completed`, `rewardType`, `rewardRarity`, `rewardPoints`, `claimed`. Unique: `[userId, date]`
- **ParentalProfile** — control parental (1:1 con User, PIN hasheado bcrypt M5). Session tokens en DB via `ParentalSession` (5 min TTL). Campos granulares: `maxNewsMinutes`, `maxReelsMinutes`, `maxQuizMinutes` (limites por tipo de contenido). Campos digest: `digestEnabled`, `digestEmail`, `digestDay`, `lastDigestSentAt`. Campos schedule lock: `allowedHoursStart` (default 0), `allowedHoursEnd` (default 24), `timezone` (default 'Europe/Madrid'). Default = sin restricción; padres configuran horario si lo desean. Campos lockout: `failedAttempts` (default 0), `lockedUntil` (DateTime?) — 5 intentos fallidos bloquean el PIN por 15 minutos
- **ContentReport** — reportes de contenido enviados por ninos. Campos: `userId`, `contentType` (news/reel), `contentId`, `reason`, `details`, `status` (pending/reviewed/dismissed/actioned)
- **ActivityLog** — tracking de actividad (tipos: `news_viewed`, `reels_viewed`, `quizzes_played`). Campos M5: `durationSeconds`, `contentId`, `sport`
- **RssSource** — fuentes RSS configurables (activables/desactivables). Campos M1: `country`, `language`, `logoUrl`, `description`, `category`, `isCustom`, `addedBy`
- **PushToken** — tokens de push notification por usuario. Campos: `userId`, `token` (unique), `platform` (expo/web), `active`. Cascade delete con User.
- **RefreshToken** — tokens de refresco JWT. Campos: `userId`, `token` (unique), `expiresAt`. Cascade delete con User. Rotación: al usar un refresh token, se elimina el viejo y se crea uno nuevo.
- **ParentalSession** — sesiones parentales persistidas en DB (reemplaza in-memory Map). Campos: `id`, `userId` (unique), `token` (unique), `expiresAt`, `createdAt`. Cascade delete con User. TTL de 5 minutos, limpieza automática de sesiones expiradas.

**Nota PostgreSQL**: Los arrays (`favoriteSports`, `selectedFeeds`, `options`, `allowedSports`, `allowedFeeds`, `allowedFormats`) usan tipos nativos `String[]`. Los campos JSON (`recentResults`, `nextMatch`, `pushPreferences`) usan tipos nativos `Json`/`Json?`. No se usa `JSON.parse`/`JSON.stringify` para estos campos.

## Flujo de datos

1. **Cron job** (`sync-feeds.ts`) cada 30min + al arrancar → consume RSS de 55 fuentes
2. **Aggregator** (`aggregator.ts`) parsea RSS, limpia HTML, extrae imágenes
3. **Content Moderator** (`content-moderator.ts`) clasifica contenido como safe/unsafe via AI (fail-open)
4. **Classifier** (`classifier.ts`) detecta equipo por keywords en título (20+ equipos/deportistas)
5. **Cron job** (`sync-videos.ts`) cada 6h + al arrancar → consume YouTube Atom feeds de 20+ canales
6. **Video Aggregator** (`video-aggregator.ts`) parsea YouTube RSS, extrae videoId, genera embed/thumbnail URLs, modera y crea Reels
7. **API Cache** (`cache.ts`) cachea respuestas en memoria con TTL configurable por endpoint
8. **Feed Ranker** (`feed-ranker.ts`) aplica scoring behavioral (frequency-weighted sport, source affinity, exponential recency decay) + diversity injection + cache invalidation on activity
9. **API** sirve contenido filtrado por sport, team, age → frontends consumen via fetch
10. **Offline cache** (web: localStorage, mobile: AsyncStorage) cachea 20 artículos para lectura offline
11. **User context** (web: localStorage, mobile: AsyncStorage) persiste ID del usuario

## i18n — sistema de traducciones

```typescript
import { t, getSportLabel, getAgeRangeLabel } from '@sportykids/shared';

t('home.latest_news', 'es')     // "Últimas noticias"
t('home.latest_news', 'en')     // "Latest news"
t('team.no_recent_news', 'es', { team: 'Real Madrid' })  // con parámetros

getSportLabel('football', 'es') // "Fútbol"
getAgeRangeLabel('6-8', 'en')   // "6-8 years"
```

- Locale se almacena en `UserContext` (default `'es'`), accesible via `useUser().locale`
- Ficheros: `packages/shared/src/i18n/es.json` y `en.json`
- Namespaces de traducciones incluyen: `age_gate.*`, `legal.*`, `delete_account.*` (entre otros)
- Para añadir un idioma: crear `XX.json`, importar en `i18n/index.ts`, añadir a tipo `Locale`

## Tokens de diseño

| Token | CSS var | Valor |
|-------|---------|-------|
| Blue (primario) | `--color-blue` | `#2563EB` |
| Green (éxito) | `--color-green` | `#22C55E` |
| Yellow (puntos) | `--color-yellow` | `#FACC15` |
| Background | `--color-background` | `#F8FAFC` (light) / `#0F172A` (dark) |
| Text | `--color-text` | `#1E293B` (light) / `#F1F5F9` (dark) |
| Surface | `--color-surface` | `#FFFFFF` (light) / `#1E293B` (dark) |
| Border | `--color-border` | `#E5E7EB` (light) / `#334155` (dark) |
| Muted | `--color-muted` | `#6B7280` (light) / `#94A3B8` (dark) |
| Tipografía títulos | `--font-poppins` | Poppins |
| Tipografía cuerpo | `--font-inter` | Inter |

En React Native usar `COLORS` del shared: `COLORS.blue`, `COLORS.green`, etc.

**Dark Mode**: La clase `.dark` en `<html>` activa los tokens oscuros. Tema gestionado por `UserContext` (`theme`: `system`/`light`/`dark`). Toggle en NavBar (cicla system -> dark -> light). Script inline en `layout.tsx` previene flash. Preferencia persiste en `localStorage` (`sportykids-theme`).

## Seguridad

- App dirigida a **niños de 6-14 años**. Todo contenido debe ser apropiado.
- Control parental con PIN de 4 dígitos (bcrypt). Session tokens en DB (`ParentalSession` model, 5 min TTL). **PIN lockout**: 5 intentos fallidos bloquean por 15 minutos (almacenado en DB, sobrevive reinicios).
- ~~Sin autenticación real~~ → JWT access/refresh tokens + email/password auth + OAuth (Google & Apple via Passport.js)
- Restricciones parentales enforced en backend (`parental-guard.ts`): format/sport/time/schedule checks
- **Rate limiting**: `express-rate-limit` con tiers por endpoint — auth (5/min), PIN (10/min), content (60/min), sync (2/min), default (100/min). Configurable via env vars.
- **Schedule lock (bedtime)**: Parents can set allowed hours (default 0-24, no restriction) with timezone support. Enforced server-side.
- Fuentes de contenido exclusivamente de prensa deportiva verificada.
- **M1: Moderación automática** — Todas las noticias pasan por un moderador AI que filtra contenido inapropiado (apuestas, violencia, contenido sexual, etc.). Solo las noticias `approved` se muestran a niños. Las rechazadas se guardan para auditoría parental. **Fail-closed en producción**: si el AI no responde, el contenido queda en `pending` (no se auto-aprueba). Override con `MODERATION_FAIL_OPEN=true`.
- **Error Boundary** — La app móvil envuelve toda la UI en un `ErrorBoundary` que muestra una pantalla kid-friendly ante crashes y reporta a Sentry (si disponible).
- **JWT en SecureStore** — Los tokens JWT en móvil se almacenan en `expo-secure-store` (keychain/keystore cifrado), con fallback automático a AsyncStorage y migración transparente. `authFetch()` wrapper adjunta `Authorization: Bearer` a todas las peticiones y auto-refresca tokens expirados.
- **YouTube Embed Sandbox** — Los iframes de YouTube usan parámetros child-safe centralizados (`modestbranding`, `rel=0`, `iv_load_policy=3`) y atributo `sandbox` en web para restringir capacidades.
- **Age gate al primer uso** — 3 caminos: adultos (acceso directo), adolescentes 13-17 (acceso con aviso), menores de 13 (requiere consentimiento parental).
- **Consentimiento parental** obligatorio para menores de 13 (COPPA/GDPR-K): confirmación en pantalla + PIN parental obligatorio antes de usar la app.
- **GDPR Art. 17 — derecho de supresion**: `DELETE /api/users/:id/data` elimina todos los datos del usuario en transaccion (hard delete).
- **Analytics condicionado a consentimiento** — PostHog y Sentry solo se inicializan si `consentGiven` es true. Sin tracking hasta que el padre consiente.
- **Politica de Privacidad y Terminos de Servicio** accesibles publicamente en `/privacy` y `/terms` (con i18n ES/EN).
- **Error monitoring**: Sentry (opt-in via `SENTRY_DSN`) tracks unhandled errors. No PII sent.
- **Analytics**: PostHog (opt-in via `POSTHOG_API_KEY`) with minimal anonymized events. Gated on user consent.

## Estado del MVP

| Fase | Estado | Funcionalidades |
|------|--------|----------------|
| 0 | ✅ Completada | Wireframes, flujos, definición |
| 1 | ✅ Completada | Home Feed, filtros, agregador RSS (163+ noticias reales) |
| 2 | ✅ Completada | Onboarding (4 pasos), equipo favorito |
| 3 | ✅ Completada | Reels (10 seed), Quiz (15 preguntas, sistema de puntos) |
| 4 | ✅ Completada | Control parental (PIN, formatos, actividad semanal) |
| 4.5 | ✅ Completada | Legal & Compliance (age gate, COPPA/GDPR-K consent, data deletion, privacy/terms pages) |
| 5 | 🔲 Pendiente | Test interno + beta cerrada (5-10 familias) |

## Fuentes RSS

**182 fuentes predefinidas** en el catálogo (`prisma/seed.ts`), distribuidas en los 8 deportes y cobertura global (ES, GB, US, IT, DE, FR y más). Incluye 45 fuentes RSS directas, 10 fuentes Google News RSS para medios españoles sin RSS nativo (Estadio Deportivo, Mucho Deporte, El Desmarque, El Correo de Andalucía), y **127 fuentes team_news** vía Google News cubriendo equipos y atletas de La Liga, Premier League, Serie A, Bundesliga, Ligue 1, selecciones nacionales, NBA, EuroLeague/ACB, top tenistas, pilotos/escuderías F1, ciclistas, nadadores, atletas y jugadores de pádel. Además se pueden **añadir fuentes personalizadas** via `POST /api/news/fuentes/custom`.

Fuentes principales: AS, Marca, Mundo Deportivo, Sport, BBC Sport, ESPN, CyclingNews, SwimSwam, Autosport, Estadio Deportivo (Google News), El Desmarque (Google News), etc. Plus 127 team/athlete-specific Google News feeds.

**Nota**: Marca tiene DNS issues intermitentes. Algunas fuentes internacionales pueden no devolver contenido consistentemente.

## Documentación

Después de cada cambio, arreglo o implementación nueva, revisa toda la documentación de la carpeta "docs" y actualiza de acuerdo a lo realizado para mantener todo con lo último.

# Testing

Después de cada cambio, arreglo o implementación nueva, asegurate de mantener los tests sin fallos y con buena cobertura.


## Deuda técnica conocida

- ~~Sin tests automatizados~~ → 74+ archivos de test, 652+ tests (Vitest) — API 464 tests (44 archivos), Web 85 tests (16 archivos), Mobile 103 tests (14 archivos)
- ~~Sin linting~~ → ESLint 9 flat config + Prettier. `npx eslint . --max-warnings 0` en CI.
- ~~Mobile no typechecked en CI~~ → Mobile typecheck en CI. Prisma generate cacheado con `actions/cache@v4`.
- ~~Logging no estructurado (88 console.*)~~ → Pino structured logging con request ID correlation. `pino-pretty` en dev.
- ~~Sesiones parentales volátiles (in-memory Map)~~ → `ParentalSession` model en Prisma. Sesiones persisten entre reinicios.
- ~~Sin autenticación real (JWT/sesiones)~~ → JWT access/refresh tokens + email/password auth + OAuth (Google & Apple via Passport.js, conditional on env vars)
- ~~PIN parental con SHA-256~~ → M5: migrado a bcrypt con migración transparente
- ~~Restricciones parentales solo en frontend~~ → M5: middleware backend `parental-guard.ts` en news/reels/quiz + schedule lock
- ~~Reels son placeholders~~ → Native video player (expo-video) para MP4, YouTube/Instagram/TikTok fallback. Video Aggregator importa reels automáticamente de 20+ canales YouTube
- ~~Quiz con preguntas estáticas del seed~~ → M3 implementado: quiz dinámico con generación AI diaria (cron 06:00 UTC) + fallback a seed
- ~~SQLite sin plan de migración~~ → Migrado a PostgreSQL 16. Native types (String[], Json) para arrays y objetos. Composite indexes en NewsItem, Reel y ActivityLog. Trending endpoint usa `groupBy` nativo.
- ~~`API_BASE` hardcodeado en cada screen del mobile~~ → Centralizado en `apps/mobile/src/config.ts`
- ~~Sin CI/CD~~ → GitHub Actions pipeline (lint, typecheck, test, build) + EAS Build config
- ~~Sin error monitoring~~ → Sentry integration (opt-in) + PostHog analytics (opt-in)
- ~~InMemoryCache es single-process~~ → CacheProvider interface with InMemoryCache (default) and RedisCache (optional via `CACHE_PROVIDER=redis`)
- ~~Rutas API inconsistentes: mezcla de español e inglés~~ → Todas las rutas migradas a inglés
- ~~Error handler genérico (500 para todo)~~ → Typed error classes (AppError hierarchy), centralized handler maps AppError/Prisma/Zod to correct HTTP codes. Sentry only 5xx. ERROR_CODES in shared package. Kid-friendly error mapping extended (auth_required, too_fast, forbidden).
- ~~Deprecated feed ranker functions (sportBoost, recencyBoost)~~ → Removed. Use `sportFrequencyBoost` and `recencyDecay` instead.
- ~~React version mismatch (web 19.2.x, mobile 19.1.x)~~ → Aligned to React ~19.1.0 across web and mobile. Pinned to 19.1.x because react-native 0.81 bundles react-native-renderer 19.1.0 and requires exact match.
- ~~skipLibCheck: true in web tsconfig~~ → Removed. Full type checking enabled. `.next/dev` excluded from include, vitest jest-dom types use `@testing-library/jest-dom/vitest`.
- ~~Hardcoded 'es' locale in push notification jobs~~ → All 3 cron jobs (missions, quiz, sync-feeds) now use `user.locale` with 'es' fallback. Users grouped by locale for per-locale push batches.
- ~~CI runs npm ci + prisma generate in every job~~ → Setup job runs once, caches node_modules with Prisma client. Downstream jobs (lint, test, build) restore from cache.
- ~~OAuth routes return 501 stubs~~ → Passport.js OAuth (Google + Apple) with mobile token endpoints. Conditional on env vars.
- ~~No kid-friendly error mapping for 401/429~~ → getErrorType maps all HTTP codes to KID_FRIENDLY_ERRORS keys. 4 new error types.
- ~~No haptic feedback on mobile~~ → expo-haptics integrated in Quiz, Collection, Reels, NavBar, MissionCard
- ~~BrandedRefreshControl not integrated~~ → Pull-to-refresh in HomeFeed, Reels, Collection, Quiz screens
- ~~No schedule lock UI~~ → Schedule Lock section in ParentalPanel (web) and ParentalControl (mobile)
- ~~Related articles endpoint not wired to UI~~ → "You Might Also Like" section in NewsCard (web + mobile)
- ~~Reading history endpoint not wired to UI~~ → "Recently Read" section on HomeFeed (web + mobile)
- ~~Locale not passed to news endpoint from frontends~~ → Both web and mobile pass locale param to fetchNews()
- ~~No privacy policy or terms of service~~ → `/privacy` and `/terms` pages with i18n ES/EN
- ~~No age gate or parental consent~~ → Age gate pre-onboarding with COPPA/GDPR-K consent flow (3 paths: adult, teen 13-17, child <13)
- ~~No data deletion endpoint~~ → `DELETE /api/users/:id/data` with transactional hard delete (GDPR Art. 17)
- ~~Analytics initialize without consent~~ → PostHog/Sentry gated on `consentGiven` field
- ~~No app-level error boundary on mobile~~ → ErrorBoundary class component wrapping entire app, kid-friendly crash screen, Sentry reporting
- ~~JWT tokens in AsyncStorage (unencrypted)~~ → expo-secure-store with auto-migration and AsyncStorage fallback. `authFetch()` wrapper in mobile API client sends Authorization header and auto-refreshes expired tokens.
- ~~YouTube embed params scattered across web/mobile~~ → Centralized child-safe YouTube utils in shared package, iframe sandbox on web
- ~~Content moderation fails open in production~~ → Fail-closed by default in production (content stays pending), override via MODERATION_FAIL_OPEN

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | Sí | PostgreSQL: `postgresql://sportykids:sportykids@localhost:5432/sportykids` |
| `AI_PROVIDER` | No | `ollama` (default), `openrouter`, `anthropic` |
| `SENTRY_DSN` | No | Sentry error tracking (API). Sin valor = deshabilitado |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry para web |
| `POSTHOG_API_KEY` | No | PostHog analytics. Sin valor = deshabilitado |
| `POSTHOG_HOST` | No | PostHog host URL |
| `JWT_SECRET` | Sí (prod) | Secret para JWT tokens |
| `JWT_REFRESH_SECRET` | Sí (prod) | Secret para refresh tokens |
| `RATE_LIMIT_AUTH` | No | Max auth req/min por IP (default: 5) |
| `RATE_LIMIT_PIN` | No | Max PIN verification req/min por IP (default: 10) |
| `RATE_LIMIT_CONTENT` | No | Max content req/min por IP (default: 60) |
| `RATE_LIMIT_SYNC` | No | Max sync req/min por IP (default: 2) |
| `RATE_LIMIT_DEFAULT` | No | Max req/min por IP para otros endpoints (default: 100) |
| `CACHE_PROVIDER` | No | `memory` (default) or `redis` |
| `REDIS_URL` | No | Redis connection URL (default: `redis://localhost:6379`) |
| `LOG_LEVEL` | No | Pino log level: `fatal`, `error`, `warn`, `info` (default), `debug`, `trace` |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID. If absent, Google login hidden |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | Full URL for Google callback |
| `GOOGLE_SUCCESS_REDIRECT_URL` | No | Frontend URL for post-OAuth redirect |
| `APPLE_CLIENT_ID` | No | Apple Services ID. If absent, Apple login hidden |
| `APPLE_TEAM_ID` | No | Apple Developer Team ID |
| `APPLE_KEY_ID` | No | Apple private key ID |
| `APPLE_PRIVATE_KEY` | No | Apple .p8 private key contents |
| `MODERATION_FAIL_OPEN` | No | `true` to auto-approve content when AI moderation fails (default: fail-closed in production) |

## Infraestructura

- **PostgreSQL local**: `docker compose -f apps/api/docker-compose.yml up -d postgres` (PostgreSQL 16)
- **Redis local**: `docker compose -f apps/api/docker-compose.yml up -d redis` (Redis 7)
- **Migración a PostgreSQL**: `bash apps/api/scripts/migrate-to-postgres.sh` (backup, health check, seed, rollback)
- **PostgreSQL es el provider por defecto**. SQLite ya no es soportado.
- **CI/CD**: `.github/workflows/ci.yml` — lint, typecheck, test, build (API + web)
- **Mobile builds**: `apps/mobile/eas.json` — EAS Build profiles (preview + production)

## Entorno de desarrollo — notas

- npm global apunta a registro corporativo (`art.tupl.com`). El proyecto tiene `.npmrc` con `registry=https://registry.npmjs.org/`.
- Si hay errores EPERM en la caché npm, usar `--cache /private/tmp/claude-502/npm-cache`.
- tsx puede fallar con EPERM en sandbox. Usar `dangerouslyDisableSandbox: true` o `TSX_IPC_DIR`.
- Prisma migrate necesita `PRISMA_ENGINES_DIR=/private/tmp/claude-502/prisma-engines` en sandbox.

## App móvil (Expo) — notas críticas

- **Expo SDK 54** con React Native 0.81.5, React 19.2.x. react-native 0.81 peerDependency is `^19.1.0` (semver-compatible with 19.2.x). Expo SDK 54 accepts `*` for React.
- **Node 24** es compatible con SDK 54 pero NO con SDK 52 (metro-cache falla con `ERR_PACKAGE_PATH_NOT_EXPORTED`).
- **Monorepo + Metro**: npm hoists dependencias a la raíz. Metro resuelve desde root por defecto, lo que causa que use versiones incorrectas. `metro.config.js` con `disableHierarchicalLookup: true` es **obligatorio** (ver `apps/mobile/metro.config.js`).
- **Entry point**: `package.json` → `"main": "App.tsx"` (raíz de mobile). `App.tsx` importa y registra via `registerRootComponent` desde `src/App.tsx`. NO usar `node_modules/expo/AppEntry.js` (no resuelve en monorepo).
- **IP local para dispositivos físicos**: El móvil no resuelve `localhost`. Todos los `API_BASE` en `apps/mobile/src/` apuntan a `http://192.168.1.189:3001/api`. Actualizar si cambia la IP de red.
- **Expo Go**: La versión de Expo Go del dispositivo debe coincidir con el SDK instalado. SDK 54 = Expo Go más reciente del App Store.
- **AsyncStorage**: Usar `@react-native-async-storage/async-storage@2.2.0` (v3 no es compatible con SDK 54).

## Workflow y principios de trabajo

### Principios clave
- **Simplicidad primero**: Cada cambio lo más simple posible. Impacto mínimo en el código.
- **Sin atajos**: Buscar causas raíz. Sin fixes temporales. Estándares de senior developer.
- **Impacto mínimo**: Los cambios solo tocan lo necesario. Evitar introducir bugs colaterales.

### Planificación
- Entrar en plan mode para cualquier tarea no trivial (3+ pasos o decisiones de arquitectura).
- Si algo sale mal, **parar y re-planificar** — no seguir empujando a ciegas.
- Escribir specs detallados antes de implementar para reducir ambigüedad.

### Subagentes
- Usar subagentes para mantener limpio el contexto principal.
- Offload de investigación, exploración y análisis paralelo a subagentes.
- Una tarea por subagente para ejecución enfocada.

### Verificación antes de cerrar
- Nunca marcar una tarea completa sin probar que funciona.
- Comparar comportamiento entre main y los cambios cuando sea relevante.
- Criterio: "¿Un staff engineer aprobaría esto?"
- Correr tests, revisar logs, demostrar que funciona.

### Elegancia equilibrada
- Para cambios no triviales: pausar y preguntar "¿hay una forma más elegante?"
- Si un fix se siente hacky: reimplementar la solución elegante.
- Saltarse esto para fixes simples y obvios — no sobre-ingeniería.

### Bug fixing autónomo
- Ante un bug report: resolverlo directamente. No pedir guía paso a paso.
- Apuntar a logs, errores, tests fallidos — luego resolverlos.
- Cero context switching requerido del usuario.

### Gestión de tareas
1. **Planificar**: Escribir plan con items checkeables.
2. **Verificar plan**: Alinear antes de empezar implementación.
3. **Trackear progreso**: Marcar items completos conforme se avanza.
4. **Explicar cambios**: Resumen de alto nivel en cada paso.

## Instrucciones breves

When compacting, preserve the full list of modified files and current test status.
