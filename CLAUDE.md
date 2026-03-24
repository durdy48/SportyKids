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
| ORM | Prisma 6 | SQLite (dev) |
| Webapp | Next.js 16 (App Router) | Tailwind CSS 4 |
| App móvil | React Native 0.81 + Expo SDK 54 | React Navigation 7 |
| Validación | Zod 4 | — |
| RSS | rss-parser 3 | — |
| Cron | node-cron 4 | — |
| AI Client | openai SDK (multi-provider) | Ollama/OpenRouter/Anthropic |
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

# Seed (desde apps/api/)
npx tsx prisma/seed.ts
```

## Arquitectura del monorepo

```
sportykids/
├── packages/shared/src/
│   ├── types/           # User, NewsItem, Reel, QuizQuestion, ParentalProfile, AgeRange,
│   │                    # SafetyStatus, SafetyResult, RssSource, RssSourceCatalogResponse
│   ├── constants/       # SPORTS, TEAMS, AGE_RANGES, COLORS
│   ├── utils/           # sportToColor, sportToEmoji, formatDate, truncateText
│   └── i18n/            # es.json, en.json, t(), getSportLabel(), getAgeRangeLabel()
├── apps/api/
│   ├── prisma/          # schema.prisma, migrations/, seed.ts
│   └── src/
│       ├── routes/      # news.ts, reels.ts, quiz.ts, users.ts, parents.ts
│       ├── services/    # aggregator.ts (RSS), classifier.ts (team detection),
│       │                # ai-client.ts (multi-provider), content-moderator.ts,
│       │                # summarizer.ts (age-adapted summaries),
│       │                # gamification.ts (streaks, stickers, achievements),
│       │                # feed-ranker.ts (smart feed), team-stats.ts (team stats)
│       ├── jobs/        # sync-feeds.ts (cron cada 30min), generate-daily-quiz.ts (cron 06:00 UTC)
│       ├── middleware/   # error-handler.ts, auth.ts (placeholder), parental-guard.ts (M5)
│       └── config/      # database.ts (PrismaClient singleton)
├── apps/web/src/
│   ├── app/             # / (home, 3 feed modes), /onboarding (5 steps), /reels (TikTok vertical),
│   │                    # /quiz, /team (stats hub), /parents (5 tabs), /collection
│   ├── components/      # NewsCard, FiltersBar, NavBar, OnboardingWizard, ReelCard,
│   │                    # QuizGame, PinInput, ParentalPanel, AgeAdaptedSummary,
│   │                    # StickerCard, StreakCounter, AchievementBadge, RewardToast,
│   │                    # FeedModeToggle, HeadlineRow, TeamStatsCard, TeamReelsStrip,
│   │                    # ReelPlayer, VerticalFeed, NotificationSettings, LimitReached
│   ├── lib/             # api.ts (cliente API), user-context.tsx (UserProvider + useUser)
│   └── styles/          # globals.css (Tailwind + CSS vars)
├── apps/mobile/
│   ├── App.tsx           # Entry point (registerRootComponent)
│   ├── metro.config.js   # Monorepo-aware Metro config (disableHierarchicalLookup)
│   ├── app.json          # Expo config
│   └── src/
│       ├── App.tsx        # Root component (SafeAreaProvider + UserProvider + Navigation)
│       ├── screens/       # HomeFeed, Reels, Quiz, FavoriteTeam, Onboarding, ParentalControl
│       ├── components/    # NewsCard, FiltersBar
│       ├── navigation/    # Bottom tabs (5): News, Reels, Quiz, My Team, Parents
│       └── lib/           # api.ts, user-context.tsx
└── docs/
    ├── es/              # 10 documentos en español
    └── en/              # 10 documentos en inglés
```

## API REST — endpoints (rutas reales en español)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/news?sport=&team=&age=&page=&limit=` | Noticias con filtros |
| GET | `/api/news/:id` | Detalle noticia |
| GET | `/api/news/:id/resumen?age=&locale=` | Resumen adaptado por edad (M2) |
| GET | `/api/news/fuentes/listado` | Fuentes RSS activas |
| GET | `/api/news/fuentes/catalogo` | Catálogo completo de fuentes RSS con metadata |
| POST | `/api/news/fuentes/custom` | Añadir fuente RSS personalizada |
| DELETE | `/api/news/fuentes/custom/:id` | Eliminar fuente personalizada |
| POST | `/api/news/sincronizar` | Sincronización manual (incluye stats de moderación) |
| GET | `/api/reels?sport=&age=&page=&limit=` | Feed de reels (M6: Reel fields videoType, aspectRatio) |
| GET | `/api/reels/:id` | Detalle reel |
| GET | `/api/teams/:teamName/stats` | Estadísticas de equipo (M6) |
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
| POST | `/api/users` | Crear usuario (onboarding) |
| GET | `/api/users/:id` | Obtener usuario |
| PUT | `/api/users/:id` | Actualizar preferencias |
| POST | `/api/parents/configurar` | Crear PIN parental |
| POST | `/api/parents/verificar-pin` | Verificar PIN |
| GET | `/api/parents/perfil/:userId` | Perfil parental |
| PUT | `/api/parents/perfil/:userId` | Actualizar restricciones |
| GET | `/api/parents/actividad/:userId` | Resumen actividad semanal |
| POST | `/api/parents/actividad/registrar` | Registrar actividad |

**IMPORTANTE**: Las rutas de `news` (excepto CRUD) y `parents` están en **español** en el backend. Los endpoints de `users`, `reels`, y `quiz` están en inglés. Verificar siempre contra `apps/api/src/routes/` antes de consumir desde frontends.

## Modelos de datos (Prisma)

- **NewsItem** — noticias agregadas de RSS (`rssGuid` único para dedup). Campos M1: `safetyStatus` (pending/approved/rejected), `safetyReason`, `moderatedAt`
- **User** — perfil del niño (`favoriteSports` y `selectedFeeds` son JSON strings en SQLite). Campos M4: `currentStreak`, `longestStreak`, `lastActiveDate`, `currentQuizCorrectStreak`, `quizPerfectCount`
- **Sticker** — cromos digitales coleccionables (M4). Rarezas: common, rare, epic, legendary
- **UserSticker** — relación usuario-sticker (M4). Unique: `[userId, stickerId]`
- **Achievement** — definiciones de logros (M4). 20 predefinidos. Unique: `key`
- **UserAchievement** — logros desbloqueados por usuario (M4). Unique: `[userId, achievementId]`
- **Reel** — vídeos cortos (seed con YouTube embeds). Campos M6: `videoType`, `aspectRatio`, `previewGifUrl`
- **TeamStats** — estadísticas de equipos (M6). Seed con 15 equipos. Unique: `teamName`
- **QuizQuestion** — preguntas trivia (`options` es JSON string, `correctAnswer` es índice 0-3). Campos M3: `generatedAt`, `ageRange`, `expiresAt` (daily questions expire after 48h)
- **NewsSummary** — resúmenes adaptados por edad (M2). Unique: `[newsItemId, ageRange, locale]`. Cascade delete con NewsItem.
- **ParentalProfile** — control parental (1:1 con User, PIN hasheado bcrypt M5). Session tokens in-memory (5 min TTL)
- **ActivityLog** — tracking de actividad (tipos: `news_viewed`, `reels_viewed`, `quizzes_played`). Campos M5: `durationSeconds`, `contentId`, `sport`
- **RssSource** — fuentes RSS configurables (activables/desactivables). Campos M1: `country`, `language`, `logoUrl`, `description`, `category`, `isCustom`, `addedBy`

**Nota SQLite**: Los arrays se almacenan como JSON strings. Al migrar a PostgreSQL, cambiar a arrays nativos.

## Flujo de datos

1. **Cron job** (`sync-feeds.ts`) cada 30min + al arrancar → consume RSS de 40+ fuentes
2. **Aggregator** (`aggregator.ts`) parsea RSS, limpia HTML, extrae imágenes
3. **Content Moderator** (`content-moderator.ts`) clasifica contenido como safe/unsafe via AI (fail-open)
3. **Classifier** (`classifier.ts`) detecta equipo por keywords en título (20+ equipos/deportistas)
4. **API** sirve contenido filtrado por sport, team, age → frontends consumen via fetch
5. **User context** (web: localStorage, mobile: AsyncStorage) persiste ID del usuario

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
- Para añadir un idioma: crear `XX.json`, importar en `i18n/index.ts`, añadir a tipo `Locale`

## Tokens de diseño

| Token | CSS var | Valor |
|-------|---------|-------|
| Blue (primario) | `--color-blue` | `#2563EB` |
| Green (éxito) | `--color-green` | `#22C55E` |
| Yellow (puntos) | `--color-yellow` | `#FACC15` |
| Background | `--color-background` | `#F8FAFC` |
| Text | `--color-text` | `#1E293B` |
| Tipografía títulos | `--font-poppins` | Poppins |
| Tipografía cuerpo | `--font-inter` | Inter |

En React Native usar `COLORS` del shared: `COLORS.blue`, `COLORS.green`, etc.

## Seguridad

- App dirigida a **niños de 6-14 años**. Todo contenido debe ser apropiado.
- Control parental con PIN de 4 dígitos (SHA-256). **Mejorar a bcrypt** antes de producción.
- Sin autenticación real en MVP — usuario se identifica por ID sin JWT.
- Restricciones parentales se aplican en frontend (ocultar tabs). **Validar en backend** antes de producción.
- Fuentes de contenido exclusivamente de prensa deportiva verificada.
- **M1: Moderación automática** — Todas las noticias pasan por un moderador AI que filtra contenido inapropiado (apuestas, violencia, contenido sexual, etc.). Solo las noticias `approved` se muestran a niños. Las rechazadas se guardan para auditoría parental.

## Estado del MVP

| Fase | Estado | Funcionalidades |
|------|--------|----------------|
| 0 | ✅ Completada | Wireframes, flujos, definición |
| 1 | ✅ Completada | Home Feed, filtros, agregador RSS (163+ noticias reales) |
| 2 | ✅ Completada | Onboarding (4 pasos), equipo favorito |
| 3 | ✅ Completada | Reels (10 seed), Quiz (15 preguntas, sistema de puntos) |
| 4 | ✅ Completada | Control parental (PIN, formatos, actividad semanal) |
| 5 | 🔲 Pendiente | Test interno + beta cerrada (5-10 familias) |

## Fuentes RSS

**40+ fuentes predefinidas** en el catálogo (`prisma/seed.ts`), distribuidas en los 8 deportes y varios países (ES, GB, US). Además se pueden **añadir fuentes personalizadas** via `POST /api/news/fuentes/custom`.

Fuentes principales: AS, Marca, Mundo Deportivo, Sport, BBC Sport, ESPN, CyclingNews, SwimSwam, Autosport, etc.

**Nota**: Marca tiene DNS issues intermitentes. Algunas fuentes internacionales pueden no devolver contenido consistentemente.

## Documentación

Después de cada cambio, arreglo o implementación nueva, revisa toda la documentación de la carpeta "docs" y actualiza de acuerdo a lo realizado para mantener todo con lo último.

# Testing

Después de cada cambio, arreglo o implementación nueva, asegurate de mantener los tests sin fallos y con buena cobertura.


## Deuda técnica conocida

- Sin tests automatizados (unitarios ni integración)
- Sin autenticación real (JWT/sesiones)
- ~~PIN parental con SHA-256~~ → M5: migrado a bcrypt con migración transparente
- ~~Restricciones parentales solo en frontend~~ → M5: middleware backend `parental-guard.ts` en news/reels/quiz
- Reels son placeholders (YouTube embeds, no vídeos reales)
- ~~Quiz con preguntas estáticas del seed~~ → M3 implementado: quiz dinámico con generación AI diaria (cron 06:00 UTC) + fallback a seed
- SQLite en desarrollo (migrar a PostgreSQL para producción)
- `API_BASE` hardcodeado en cada screen del mobile (debería centralizarse en un único módulo)
- Rutas API inconsistentes: mezcla de español e inglés (news/parents en español, quiz/reels/users en inglés)

## Entorno de desarrollo — notas

- npm global apunta a registro corporativo (`art.tupl.com`). El proyecto tiene `.npmrc` con `registry=https://registry.npmjs.org/`.
- Si hay errores EPERM en la caché npm, usar `--cache /private/tmp/claude-502/npm-cache`.
- tsx puede fallar con EPERM en sandbox. Usar `dangerouslyDisableSandbox: true` o `TSX_IPC_DIR`.
- Prisma migrate necesita `PRISMA_ENGINES_DIR=/private/tmp/claude-502/prisma-engines` en sandbox.

## App móvil (Expo) — notas críticas

- **Expo SDK 54** con React Native 0.81.5, React 19.1.0. Versiones deben coincidir exactamente con las que espera el SDK.
- **Node 24** es compatible con SDK 54 pero NO con SDK 52 (metro-cache falla con `ERR_PACKAGE_PATH_NOT_EXPORTED`).
- **Monorepo + Metro**: npm hoists dependencias a la raíz. Metro resuelve desde root por defecto, lo que causa que use versiones incorrectas. `metro.config.js` con `disableHierarchicalLookup: true` es **obligatorio** (ver `apps/mobile/metro.config.js`).
- **Entry point**: `package.json` → `"main": "App.tsx"` (raíz de mobile). `App.tsx` importa y registra via `registerRootComponent` desde `src/App.tsx`. NO usar `node_modules/expo/AppEntry.js` (no resuelve en monorepo).
- **IP local para dispositivos físicos**: El móvil no resuelve `localhost`. Todos los `API_BASE` en `apps/mobile/src/` apuntan a `http://192.168.1.189:3001/api`. Actualizar si cambia la IP de red.
- **Expo Go**: La versión de Expo Go del dispositivo debe coincidir con el SDK instalado. SDK 54 = Expo Go más reciente del App Store.
- **AsyncStorage**: Usar `@react-native-async-storage/async-storage@2.2.0` (v3 no es compatible con SDK 54).

## Instrucciones breves

When compacting, preserve the full list of modified files and current test status.
