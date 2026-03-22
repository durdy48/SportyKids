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
| App móvil | React Native + Expo | React Navigation 7 |
| Validación | Zod 4 | — |
| RSS | rss-parser 3 | — |
| Cron | node-cron 4 | — |
| Shared | @sportykids/shared | Tipos, constantes, utils, i18n |

**Nota**: Prisma v7 no es compatible con este proyecto (rompe la config de datasource url). Usar Prisma ^6.

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
│   ├── types/           # User, NewsItem, Reel, QuizQuestion, ParentalProfile, AgeRange
│   ├── constants/       # SPORTS, TEAMS, AGE_RANGES, COLORS
│   ├── utils/           # sportToColor, sportToEmoji, formatDate, truncateText
│   └── i18n/            # es.json, en.json, t(), getSportLabel(), getAgeRangeLabel()
├── apps/api/
│   ├── prisma/          # schema.prisma, migrations/, seed.ts
│   └── src/
│       ├── routes/      # news.ts, reels.ts, quiz.ts, users.ts, parents.ts
│       ├── services/    # aggregator.ts (RSS), classifier.ts (team detection)
│       ├── jobs/        # sync-feeds.ts (cron cada 30min)
│       ├── middleware/   # error-handler.ts, auth.ts (placeholder)
│       └── config/      # database.ts (PrismaClient singleton)
├── apps/web/src/
│   ├── app/             # / (home), /onboarding, /reels, /quiz, /team, /parents
│   ├── components/      # NewsCard, FiltersBar, NavBar, OnboardingWizard, ReelCard,
│   │                    # QuizGame, PinInput, ParentalPanel
│   ├── lib/             # api.ts (cliente API), user-context.tsx (UserProvider + useUser)
│   └── styles/          # globals.css (Tailwind + CSS vars)
├── apps/mobile/src/
│   ├── screens/         # HomeFeed, Reels, Quiz, FavoriteTeam, Onboarding, ParentalControl
│   ├── components/      # NewsCard, FiltersBar
│   ├── navigation/      # Bottom tabs (5): News, Reels, Quiz, My Team, Parents
│   └── lib/             # api.ts, user-context.tsx
└── docs/
    ├── es/              # 10 documentos en español
    └── en/              # 10 documentos en inglés
```

## API REST — endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/news?sport=&team=&age=&page=&limit=` | Noticias con filtros |
| GET | `/api/news/:id` | Detalle noticia |
| GET | `/api/news/sources/list` | Fuentes RSS activas |
| POST | `/api/news/sync` | Sincronización manual |
| GET | `/api/reels?sport=&age=&page=&limit=` | Feed de reels |
| GET | `/api/reels/:id` | Detalle reel |
| GET | `/api/quiz/questions?count=&sport=` | Preguntas aleatorias |
| POST | `/api/quiz/answer` | Enviar respuesta `{userId, questionId, answer}` |
| GET | `/api/quiz/score/:userId` | Puntuación total |
| POST | `/api/users` | Crear usuario (onboarding) |
| GET | `/api/users/:id` | Obtener usuario |
| PUT | `/api/users/:id` | Actualizar preferencias |
| POST | `/api/parents/setup` | Crear PIN parental |
| POST | `/api/parents/verify-pin` | Verificar PIN |
| GET | `/api/parents/profile/:userId` | Perfil parental |
| PUT | `/api/parents/profile/:userId` | Actualizar restricciones |
| GET | `/api/parents/activity/:userId` | Resumen actividad semanal |
| POST | `/api/parents/activity/record` | Registrar actividad |

## Modelos de datos (Prisma)

- **NewsItem** — noticias agregadas de RSS (`rssGuid` único para dedup)
- **User** — perfil del niño (`favoriteSports` y `selectedFeeds` son JSON strings en SQLite)
- **Reel** — vídeos cortos (seed con YouTube embeds en MVP)
- **QuizQuestion** — preguntas trivia (`options` es JSON string, `correctAnswer` es índice 0-3)
- **ParentalProfile** — control parental (1:1 con User, PIN hasheado SHA-256)
- **ActivityLog** — tracking de actividad (tipos: `news_viewed`, `reels_viewed`, `quizzes_played`)
- **RssSource** — fuentes RSS configurables (activables/desactivables)

**Nota SQLite**: Los arrays se almacenan como JSON strings. Al migrar a PostgreSQL, cambiar a arrays nativos.

## Flujo de datos

1. **Cron job** (`sync-feeds.ts`) cada 30min + al arrancar → consume RSS de AS, Mundo Deportivo, Marca
2. **Aggregator** (`aggregator.ts`) parsea RSS, limpia HTML, extrae imágenes
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

## Estado del MVP

| Fase | Estado | Funcionalidades |
|------|--------|----------------|
| 0 | ✅ Completada | Wireframes, flujos, definición |
| 1 | ✅ Completada | Home Feed, filtros, agregador RSS (163+ noticias reales) |
| 2 | ✅ Completada | Onboarding (4 pasos), equipo favorito |
| 3 | ✅ Completada | Reels (10 seed), Quiz (15 preguntas, sistema de puntos) |
| 4 | ✅ Completada | Control parental (PIN, formatos, actividad semanal) |
| 5 | 🔲 Pendiente | Test interno + beta cerrada (5-10 familias) |

## Fuentes RSS activas

| Fuente | Deporte | Estado |
|--------|---------|--------|
| AS - Football | football | ✅ Funciona |
| AS - Basketball | basketball | ✅ Funciona |
| Mundo Deportivo | football | ✅ Funciona |
| Marca | football | ⚠️ Intermitente (DNS issues) |

## Deuda técnica conocida

- Sin tests automatizados (unitarios ni integración)
- Sin autenticación real (JWT/sesiones)
- PIN parental con SHA-256 (migrar a bcrypt)
- Restricciones parentales solo en frontend
- Reels son placeholders (YouTube embeds, no vídeos reales)
- Quiz con preguntas estáticas del seed (no se generan automáticamente)
- SQLite en desarrollo (migrar a PostgreSQL para producción)

## Entorno de desarrollo — notas

- npm global apunta a registro corporativo (`art.tupl.com`). El proyecto tiene `.npmrc` con `registry=https://registry.npmjs.org/`.
- Si hay errores EPERM en la caché npm, usar `--cache /private/tmp/claude-502/npm-cache`.
- tsx puede fallar con EPERM en sandbox. Usar `dangerouslyDisableSandbox: true` o `TSX_IPC_DIR`.
- Prisma migrate necesita `PRISMA_ENGINES_DIR=/private/tmp/claude-502/prisma-engines` en sandbox.

## Instrucciones breves

When compacting, preserve the full list of modified files and current test status.
