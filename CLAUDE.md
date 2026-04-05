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

**Estado**: MVP Fases 0-6.4 completadas. Admin Dashboard en progreso (prd6 pendiente). Fase 5 (Beta Testing & Store Launch) en progreso.

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Monorepo | npm workspaces | — |
| API | Express 5 + TypeScript | Node >= 20 |
| ORM | Prisma **6** (v7 incompatible) | PostgreSQL 16 |
| Webapp | Next.js 16 (App Router) | Tailwind CSS 4 |
| App móvil | React Native 0.81 + Expo SDK 54 | React Navigation 7 |
| Validación | Zod 4 | — |
| Cron | node-cron 4 | — |
| AI Client | openai SDK universal (Groq default, OpenRouter, Anthropic, Ollama) | — |
| Caching | CacheProvider InMemory/Redis | ioredis 5 (optional) |
| Logging | Pino 9 | Structured JSON |
| Linting | ESLint 9 + Prettier | Flat config |
| Deploy | Fly.io + Docker | Madrid |
| OAuth | Passport.js + google-auth-library | Google & Apple |
| Shared | @sportykids/shared | Tipos, constantes, utils, i18n |

**Nota AI**: Por defecto `AI_PROVIDER=groq` (gratis: 14,400 req/día, modelo `llama-3.1-8b-instant`). Groq usa openai SDK con `baseURL=https://api.groq.com/openai/v1`. Anthropic se importa dinámicamente solo si `AI_PROVIDER=anthropic`.

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
│   ├── types/           # User, NewsItem, Reel, QuizQuestion, ParentalProfile, Organization, LiveMatchData, etc.
│   ├── constants/       # SPORTS, TEAMS, AGE_RANGES, COLORS, KID_FRIENDLY_ERRORS, ERROR_CODES
│   ├── utils/           # sportToColor, sportToEmoji, formatDate, truncateText, youtube.ts
│   └── i18n/            # es.json, en.json, t(), getSportLabel(), getAgeRangeLabel()
├── apps/api/
│   ├── prisma/          # schema.prisma, migrations/, seed.ts
│   ├── Dockerfile       # Multi-stage production Docker image
│   └── src/
│       ├── routes/      # news.ts, reels.ts, quiz.ts, users.ts, parents.ts, reports.ts,
│       │                # missions.ts, auth.ts, admin.ts, subscription.ts, live.ts, organizations.ts
│       ├── services/    # aggregator.ts, video-aggregator.ts, classifier.ts, ai-client.ts,
│       │                # content-moderator.ts, summarizer.ts, gamification.ts, feed-ranker.ts,
│       │                # team-stats.ts, team-stats-sync.ts, team-ids.ts, cache.ts, redis-cache.ts,
│       │                # digest-generator.ts, mission-generator.ts, auth-service.ts, passport.ts,
│       │                # push-sender.ts, monitoring.ts, logger.ts, parental-session.ts,
│       │                # subscription.ts, live-scores.ts, schedule-check.ts, invite-code.ts,
│       │                # job-runner.ts, admin-stats.ts
│       ├── jobs/        # sync-feeds.ts (30min), sync-videos.ts (6h), generate-daily-quiz.ts (06:00 UTC),
│       │                # generate-daily-missions.ts (05:00 UTC), send-weekly-digests.ts (08:00 UTC),
│       │                # streak-reminder.ts (20:00 UTC), sync-team-stats.ts (04:00 UTC),
│       │                # mission-reminder.ts (18:00 UTC), live-scores.ts (5min),
│       │                # compute-analytics.ts (02:00 UTC)
│       ├── errors/       # AppError, ValidationError, AuthenticationError, NotFoundError, etc.
│       ├── middleware/   # error-handler.ts, auth.ts (JWT + requireAuth + requireRole),
│       │                # parental-guard.ts, subscription-guard.ts, rate-limiter.ts (5 tiers),
│       │                # request-id.ts, require-org-admin.ts
│       └── config/      # database.ts (PrismaClient singleton)
├── apps/web/src/
│   ├── app/             # / (home), /onboarding, /reels, /quiz, /team, /parents, /collection,
│   │                    # /age-gate, /privacy, /terms, /upgrade, /organizations,
│   │                    # (admin)/admin/* (moderation, reports, overview, analytics, jobs)
│   ├── components/      # NewsCard, FiltersBar, NavBar, OnboardingWizard, ReelCard, QuizGame,
│   │                    # PinInput, ParentalPanel, StickerCard, StreakCounter, AchievementBadge,
│   │                    # MissionCard, VideoPlayer, OrgActivitySummary, OrgMemberList,
│   │                    # admin/AdminSidebar, AdminTable, AdminBadge, AdminMetricCard
│   └── lib/             # api.ts, user-context.tsx, celebrations.ts, favorites.ts, analytics.ts
├── apps/mobile/src/
│   ├── screens/         # HomeFeed, Reels, Quiz, FavoriteTeam, Onboarding, ParentalControl,
│   │                    # Collection, Login, Register, RssCatalog, AgeGate, Upgrade, JoinOrganization
│   ├── components/      # NewsCard, FiltersBar, StreakCounter, ErrorBoundary, VideoPlayer, LimitReachedModal
│   ├── navigation/      # Bottom tabs (6): News, Reels, Quiz, Collection, My Team, Parents
│   └── lib/             # api.ts, user-context.tsx, auth.ts, secure-storage.ts, push-notifications.ts
└── docs/                # es/ + en/ (10 documentos cada uno)
```

## API REST — endpoints

> Todas las rutas en **inglés**. Verificar siempre contra `apps/api/src/routes/`.
> Abreviaciones: `(admin)` = requireAuth + requireRole('admin'), `(auth)` = requireAuth, `(orgAdmin)` = requireAuth + org admin check.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/news` | Noticias (`?sport=&team=&age=&page=&limit=&q=&locale=&userId=`, cached 5min) |
| GET | `/api/news/:id` | Detalle noticia |
| GET | `/api/news/:id/summary?age=&locale=` | Resumen adaptado por edad |
| GET | `/api/news/trending` | IDs de noticias en tendencia (>5 vistas en 24h) |
| GET | `/api/news/sources/list` | Fuentes RSS activas (devuelve `sources`) |
| GET | `/api/news/sources/catalog` | Catálogo RSS completo con metadata |
| POST | `/api/news/sources/custom` | Añadir fuente RSS personalizada |
| DELETE | `/api/news/sources/custom/:id` | Eliminar fuente personalizada |
| POST | `/api/news/sync` | Sincronización manual RSS |
| GET | `/api/news/history?userId=&page=&limit=` | Historial de lectura paginado |
| GET | `/api/news/:id/related?limit=3` | Artículos relacionados |
| GET | `/api/reels` | Feed de reels (`?sport=&age=&page=&limit=`, solo approved) |
| GET | `/api/reels/:id` | Detalle reel |
| GET | `/api/reels/sources/list` | Fuentes de video activas (devuelve `sources`) |
| GET | `/api/reels/sources/catalog` | Catálogo de video completo |
| POST | `/api/reels/sources/custom` | Añadir fuente de video personalizada |
| DELETE | `/api/reels/sources/custom/:id` | Eliminar fuente de video personalizada |
| POST | `/api/reels/sync` | Sincronización manual de videos `(auth)` |
| GET | `/api/quiz/questions?count=&sport=&age=` | Preguntas (daily first, seed fallback) |
| POST | `/api/quiz/generate` | Genera quiz diario desde noticias |
| POST | `/api/quiz/answer` | Enviar respuesta `{userId, questionId, answer}` |
| GET | `/api/quiz/score/:userId` | Puntuación total |
| GET | `/api/gamification/stickers` | Catálogo de stickers |
| GET | `/api/gamification/stickers/:userId` | Stickers del usuario |
| GET | `/api/gamification/achievements` | Definiciones de logros |
| GET | `/api/gamification/achievements/:userId` | Logros del usuario |
| GET | `/api/gamification/streaks/:userId` | Racha del usuario |
| POST | `/api/gamification/check-in` | Check-in diario (racha + sticker + logros) |
| POST | `/api/users` | Crear usuario (onboarding) |
| GET | `/api/users/:id` | Obtener usuario |
| PUT | `/api/users/:id` | Actualizar preferencias |
| DELETE | `/api/users/:id/data` | Eliminar datos GDPR Art. 17 `(auth)` |
| PUT | `/api/users/:id/notifications/live-scores` | Prefs notificaciones en vivo `(auth)` |
| POST | `/api/users/:id/notifications/subscribe` | Suscribir push notifications |
| GET | `/api/users/:id/notifications` | Obtener prefs de notificación |
| POST | `/api/parents/setup` | Crear PIN parental |
| POST | `/api/parents/verify-pin` | Verificar PIN |
| GET/PUT | `/api/parents/profile/:userId` | Perfil parental |
| GET | `/api/parents/activity/:userId` | Actividad semanal |
| POST | `/api/parents/activity/log` | Registrar actividad |
| GET | `/api/parents/preview/:userId` | Preview del feed con restricciones |
| GET/PUT | `/api/parents/digest/:userId` | Prefs del digest semanal |
| GET | `/api/parents/digest/:userId/preview` | Vista previa del digest |
| GET | `/api/parents/digest/:userId/download` | Descargar digest como PDF |
| POST | `/api/parents/digest/:userId/test` | Email de prueba (1 cada 5 min) |
| GET | `/api/missions/today/:userId` | Misión diaria |
| POST | `/api/missions/claim` | Reclamar recompensa de misión |
| POST | `/api/auth/register` | Registro email+password |
| POST | `/api/auth/login` | Login email+password |
| POST | `/api/auth/refresh` | Renovar access token |
| POST | `/api/auth/logout` | Revocar refresh token |
| GET | `/api/auth/me` | Usuario actual `(auth)` |
| POST | `/api/auth/upgrade` | Convertir anónimo a cuenta email |
| POST | `/api/auth/link-child` | Parent vincula perfil de hijo |
| GET | `/api/auth/google` | Redirect Google OAuth |
| GET | `/api/auth/google/callback` | Google OAuth callback |
| POST | `/api/auth/google/token` | Mobile: verificar Google ID token |
| GET | `/api/auth/apple` | Redirect Apple Sign In |
| POST | `/api/auth/apple/callback` | Apple Sign In callback |
| POST | `/api/auth/apple/token` | Mobile: verificar Apple identity token |
| GET | `/api/auth/providers` | Providers OAuth configurados |
| POST | `/api/auth/join-organization` | Unirse a org con código `(auth)` |
| POST | `/api/reports` | Enviar reporte de contenido |
| GET | `/api/reports/parent/:userId` | Reportes del hijo |
| PUT | `/api/reports/:reportId` | Actualizar estado de reporte |
| GET | `/api/teams/:teamName/stats` | Stats de equipo (cached 1h) |
| GET | `/api/teams/:teamName/live` | Partido en vivo (cached 60s) |
| POST | `/api/teams/sync` | Sync manual de stats TheSportsDB |
| GET | `/api/admin/moderation/pending` | Contenido pendiente `(admin)` |
| PATCH | `/api/admin/content/:type/:id/approve` | Aprobar contenido `(admin)` |
| PATCH | `/api/admin/content/:type/:id/reject` | Rechazar contenido `(admin)` |
| POST | `/api/admin/content/batch` | Batch approve/reject (max 100) `(admin)` |
| GET | `/api/admin/reports` | ContentReports con filtros `(admin)` |
| PATCH | `/api/admin/reports/:id` | Actualizar estado de reporte `(admin)` |
| GET | `/api/admin/overview` | KPIs, alertas, suscripciones (cached 5min) `(admin)` |
| GET | `/api/admin/analytics/activity-chart` | Actividad diaria 30 días `(admin)` |
| GET | `/api/admin/analytics/snapshot?from&to&metrics` | Snapshots analíticos `(admin)` |
| GET | `/api/admin/analytics/top-content?from&to&limit` | Top contenido por vistas `(admin)` |
| GET | `/api/admin/jobs` | Estado de los 11 cron jobs `(admin)` |
| POST | `/api/admin/jobs/:name/trigger` | Trigger manual de un job (202 Async) `(admin)` |
| GET | `/api/admin/jobs/:name/history` | Historial ejecuciones (max 50) `(admin)` |
| GET | `/api/subscription/status/:userId` | Estado suscripción `(auth)` |
| POST | `/api/subscription/webhook` | RevenueCat webhook (Bearer secret) |
| POST | `/api/organizations` | Crear organización `(auth)` |
| GET | `/api/organizations/:id` | Detalles `(orgAdmin)` |
| PUT | `/api/organizations/:id` | Actualizar ajustes `(orgAdmin)` |
| POST | `/api/organizations/:id/regenerate-code` | Regenerar invite code `(orgAdmin)` |
| GET | `/api/organizations/:id/members` | Miembros paginados `(orgAdmin)` |
| DELETE | `/api/organizations/:id/members/:userId` | Eliminar miembro `(orgAdmin)` |
| POST | `/api/organizations/:id/leave` | Salir de organización `(auth)` |
| GET | `/api/organizations/:id/activity` | Actividad agregada `(orgAdmin)` |

## Modelos de datos (Prisma)

> Arrays usan tipos nativos PostgreSQL `String[]`. JSON usa `Json`/`Json?`. No usar `JSON.parse`/`JSON.stringify`.

- **NewsItem** — noticias RSS (`rssGuid` único). `safetyStatus`: pending/approved/rejected
- **User** — perfil del niño. `favoriteSports`/`selectedFeeds`: `String[]`. `authProvider`: anonymous/email/google/apple. `role`: child/parent. `subscriptionTier`: free/premium. `organizationId`/`organizationRole`: B2B. `pushPreferences`: `Json?`. Campos consent: `ageGateCompleted`, `consentGiven`, `consentDate`, `consentBy`. `locale` (default 'es'), `country` (default 'ES').
- **ParentalProfile** — PIN bcrypt, 1:1 con User. `allowedHoursStart/End` + `timezone`. `maxNewsMinutes`, `maxReelsMinutes`, `maxQuizMinutes`. `failedAttempts`/`lockedUntil` (lockout 5 intentos → 15min). `digestEnabled/Email/Day`. `revenuecatCustomerId`.
- **ParentalSession** — sesiones DB-backed (TTL 5min). `userId` unique.
- **Reel** — vídeos cortos. `rssGuid` unique. `safetyStatus` (default approved). `videoSourceId`.
- **VideoSource** — canales/playlists YouTube. `feedUrl` unique. `platform`: youtube_channel/youtube_playlist.
- **QuizQuestion** — `options`: `String[]`, `correctAnswer` es índice 0-3. `ageRange`, `expiresAt` (48h).
- **NewsSummary** — resúmenes AI. Unique: `[newsItemId, ageRange, locale]`. Cascade delete.
- **DailyMission** — Unique: `[userId, date]`. `rewardType`, `rewardRarity`, `rewardPoints`, `claimed`.
- **Sticker** / **UserSticker** — colección de cromos. Rarezas: common/rare/epic/legendary.
- **Achievement** / **UserAchievement** — 20 logros predefinidos. Unique: `key`.
- **TeamStats** — estadísticas equipos. `recentResults`/`nextMatch`: `Json`.
- **RssSource** — fuentes RSS configurables. `isCustom`, `addedBy`.
- **PushToken** — tokens push por usuario. `token` unique.
- **RefreshToken** — JWT refresh tokens. Rotación: delete viejo + create nuevo.
- **ContentReport** — `status`: pending/reviewed/dismissed/actioned.
- **ActivityLog** — tipos: `news_viewed`, `reels_viewed`, `quizzes_played`. `durationSeconds`, `contentId`, `sport`.
- **Organization** — B2B clubs/academias. `slug` unique, `inviteCode` 6-char unique, `maxMembers` default 100.
- **LiveMatch** — partidos en vivo. `externalEventId` unique. `status`: not_started/live/half_time/finished. Limpieza automática >24h.
- **JobRun** — log de ejecuciones de los 11 cron jobs. `status`: running/success/error. `triggeredBy`: cron/manual. Composite index `[jobName, startedAt]`.
- **AnalyticsSnapshot** — métricas diarias computadas. Unique `[date, metric]`. Valores: dau, mau, retention_d1/d7, sport_activity, subscription_breakdown, parental_activation_rate, consent_rate, quiz_engagement, missions_completed/claimed.

## Flujo de datos

1. `sync-feeds.ts` (30min) → RSS de 182 fuentes → Aggregator → Content Moderator (AI, fail-closed en prod) → Classifier (equipo)
2. `sync-videos.ts` (6h) → YouTube Atom feeds → Video Aggregator → Reels
3. `compute-analytics.ts` (02:00 UTC) → 11 métricas → AnalyticsSnapshot upsert
4. API Cache (`cache.ts`) con TTL configurable por endpoint (InMemory o Redis)
5. Feed Ranker — scoring behavioral (frecuencia deporte, recency decay, source affinity) + diversity injection
6. API → frontends via fetch; offline cache (web: localStorage, mobile: AsyncStorage, 20 artículos)
7. `live-scores.ts` (5min) → TheSportsDB livescores → detecta eventos → push a fans → respeta schedule lock

## i18n

```typescript
import { t, getSportLabel, getAgeRangeLabel } from '@sportykids/shared';
t('home.latest_news', 'es')                              // "Últimas noticias"
t('team.no_recent_news', 'es', { team: 'Real Madrid' }) // con parámetros
getSportLabel('football', 'es')                          // "Fútbol"
```

- Locale en `UserContext` (default `'es'`). Ficheros: `packages/shared/src/i18n/{es,en}.json`
- Para añadir idioma: crear `XX.json`, importar en `i18n/index.ts`, añadir a tipo `Locale`

## Tokens de diseño

| Token | CSS var | Valor |
|-------|---------|-------|
| Blue | `--color-blue` | `#2563EB` |
| Green | `--color-green` | `#22C55E` |
| Yellow | `--color-yellow` | `#FACC15` |
| Background | `--color-background` | `#F8FAFC` / `#0F172A` (dark) |
| Text | `--color-text` | `#1E293B` / `#F1F5F9` (dark) |
| Surface | `--color-surface` | `#FFFFFF` / `#1E293B` (dark) |
| Border | `--color-border` | `#E5E7EB` / `#334155` (dark) |
| Muted | `--color-muted` | `#6B7280` / `#94A3B8` (dark) |
| Fuentes | `--font-poppins` / `--font-inter` | Títulos / Cuerpo |

En React Native usar `COLORS` del shared: `COLORS.blue`, `COLORS.green`, etc.

**Dark Mode**: clase `.dark` en `<html>`. Gestionado por `UserContext` (`theme`: system/light/dark). Script inline en `layout.tsx` previene flash. Persiste en `localStorage` (`sportykids-theme`).

## Seguridad

- App para **niños 6-14 años**. Todo contenido debe ser apropiado.
- **Auth**: JWT access/refresh tokens + email/password + OAuth (Google & Apple via Passport.js).
- **Parental PIN**: bcrypt, 4 dígitos. Sesiones DB-backed (5min TTL). Lockout: 5 fallos → 15min.
- **Parental guard** (`parental-guard.ts`): format/sport/time/schedule checks en backend.
- **Rate limiting**: auth (5/min), PIN (10/min), content (60/min), sync (2/min), default (100/min).
- **Moderación AI**: fail-closed en producción (pending si AI falla). Override: `MODERATION_FAIL_OPEN=true`.
- **Age gate**: 3 caminos — adulto, adolescente 13-17, menor <13 (requiere consentimiento parental).
- **GDPR Art. 17**: `DELETE /api/users/:id/data` — hard delete transaccional.
- **PostHog/Sentry**: solo si `consentGiven=true`. JWT en `expo-secure-store` (mobile).
- **YouTube embeds**: child-safe params centralizados en shared. `sandbox` attribute en web.

## Estado del MVP

| Fase | Estado | Funcionalidades |
|------|--------|----------------|
| 0–4.5 | ✅ | Home Feed, Onboarding, Reels, Quiz, Control Parental, Legal/Compliance |
| Store | ✅ | Dockerfile, Fly.io, CI/CD, EAS, ASO metadata, splash |
| A11y | ✅ | a11y web+mobile, Sentry, Playwright E2E |
| 6.1–6.4 | ✅ | RevenueCat, Live Scores, Orgs B2B, Groq AI |
| Admin S1–S2 | ✅ | Infra admin, Moderación, Reportes |
| Admin S3 | ✅ | Overview KPIs + Recharts |
| Admin S4 | ✅ | Analytics Snapshots (AnalyticsSnapshot, compute-analytics job, /admin/analytics) |
| Admin S5 | ✅ | Operations & Jobs (JobRun, 11 jobs, trigger manual) |
| Admin S6 | 🔄 | Users & Organizations (prd6.md pendiente) |
| 5 | 🔄 | Beta Testing & Store Launch |

## Fuentes RSS

**182 fuentes predefinidas** en `prisma/seed.ts`: 45 RSS directas, 10 Google News ES (Estadio Deportivo, El Desmarque…), 127 team_news Google News (La Liga, Premier, Serie A, NBA, F1, etc.). Fuentes personalizadas via `POST /api/news/sources/custom`.

**Nota**: Marca tiene DNS issues intermitentes.

## Documentación

Después de cada cambio, revisar y actualizar la carpeta `docs/` para mantener la documentación al día.

## Testing

Después de cada cambio, mantener los tests sin fallos y con buena cobertura. Tests actuales: 1121+ (Vitest) + 24 E2E (Playwright).

## Variables de entorno

| Variable | Req | Descripción |
|----------|-----|-------------|
| `DATABASE_URL` | Sí | `postgresql://sportykids:sportykids@localhost:5432/sportykids` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Sí (prod) | Secrets para JWT |
| `AI_PROVIDER` | No | `groq` (default), `openrouter`, `anthropic`, `ollama` |
| `GROQ_API_KEY` | No | Free tier 14,400 req/día. console.groq.com |
| `GROQ_MODEL` | No | Default: `llama-3.1-8b-instant` |
| `GROQ_BASE_URL` | No | Default: `https://api.groq.com/openai/v1` |
| `SENTRY_DSN` | No | Sentry API. Sin valor = deshabilitado |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry web |
| `EXPO_PUBLIC_SENTRY_DSN` | No | Sentry mobile (solo builds prod/preview) |
| `POSTHOG_API_KEY` / `POSTHOG_HOST` | No | PostHog analytics |
| `CACHE_PROVIDER` | No | `memory` (default) o `redis` |
| `REDIS_URL` | No | Default: `redis://localhost:6379` |
| `LOG_LEVEL` | No | `info` (default), fatal/error/warn/debug/trace |
| `MODERATION_FAIL_OPEN` | No | `true` auto-aprueba si AI falla |
| `RATE_LIMIT_AUTH/PIN/CONTENT/SYNC/DEFAULT` | No | Defaults: 5/10/60/2/100 req/min |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Google OAuth. Sin valor = login oculto |
| `GOOGLE_CALLBACK_URL` / `GOOGLE_SUCCESS_REDIRECT_URL` | No | URLs para OAuth Google |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | No | Apple Sign In |
| `EXPO_PUBLIC_API_BASE` | No | Override API base URL mobile |
| `REVENUECAT_WEBHOOK_SECRET` | Sí (prod) | RevenueCat webhook auth |
| `REVENUECAT_API_KEY_APPLE` / `REVENUECAT_API_KEY_GOOGLE` | No | RevenueCat mobile |
| `FLY_API_TOKEN` | No (CI) | Deploy token GitHub secret |

## Infraestructura

- **PostgreSQL local**: `docker compose -f apps/api/docker-compose.yml up -d postgres`
- **Redis local**: `docker compose -f apps/api/docker-compose.yml up -d redis`
- **Production API**: Fly.io `sportykids-api.fly.dev`, región Madrid (`fly.toml`)
- **Staging API**: `sportykids-api-staging.fly.dev` (`fly.staging.toml`). Setup: `bash scripts/setup-staging.sh`
- **CI/CD**: `.github/workflows/ci.yml` — lint, typecheck, test, build + deploy to Fly.io on push to main
- **Mobile builds**: `apps/mobile/eas.json` — profiles development/preview/production con channels
- **Asset generation**: `npm run generate-assets --workspace=apps/mobile` (sharp)
- **Store screenshots**: `node scripts/generate-screenshots.mjs` (Playwright, requiere `npm run dev:web`)

## Entorno de desarrollo — notas

- npm global apunta a registro corporativo. El proyecto tiene `.npmrc` con `registry=https://registry.npmjs.org/`.
- Si hay errores EPERM en la caché npm, usar `--cache /private/tmp/claude-502/npm-cache`.
- tsx puede fallar con EPERM en sandbox → usar `dangerouslyDisableSandbox: true` o `TSX_IPC_DIR`.
- Prisma migrate en sandbox → `PRISMA_ENGINES_DIR=/private/tmp/claude-502/prisma-engines`.

## App móvil (Expo) — notas críticas

- **Expo SDK 54** + React Native 0.81.5 + React 19.1.x (pinned — RN 0.81 requiere exact match 19.1.0).
- **Node 24** compatible con SDK 54 (SDK 52 NO — metro-cache `ERR_PACKAGE_PATH_NOT_EXPORTED`).
- **Metro monorepo**: `metro.config.js` con `disableHierarchicalLookup: true` es **obligatorio**.
- **Entry point**: `package.json → "main": "App.tsx"` → `registerRootComponent` desde `src/App.tsx`. NO usar `expo/AppEntry.js`.
- **IP local**: el móvil no resuelve `localhost`. `API_BASE` apunta a `http://192.168.1.189:3001/api`.
- **AsyncStorage**: usar `@react-native-async-storage/async-storage@2.2.0` (v3 incompatible con SDK 54).

## Workflow y principios de trabajo

- **Simplicidad primero**: cambios mínimos e impacto mínimo. Sin fixes temporales. Buscar causas raíz.
- **Plan antes de implementar**: entrar en plan mode para tareas no triviales (3+ pasos).
- **Verificar antes de cerrar**: correr tests, revisar logs. Criterio: "¿Un staff engineer aprobaría esto?"
- **Subagentes**: usar para investigación paralela y mantener limpio el contexto principal.
- **Bug fixing autónomo**: resolver directamente. Cero context switching del usuario.
- **Gestión de tareas**: Planificar → Verificar → Trackear → Explicar cambios.

## Instrucciones breves

When compacting, preserve the full list of modified files and current test status.
