# Guia de desarrollo

## Requisitos previos

- Node.js >= 20
- npm >= 10
- Git
- (Opcional) Ollama para servicios de IA local

No se necesita Docker ni PostgreSQL para desarrollo local (se usa SQLite).

## Instalacion

```bash
git clone <repo-url>
cd sportykids
npm install
```

Si npm apunta a un registro privado, crea un `.npmrc` en la raiz:
```
registry=https://registry.npmjs.org/
```

## Configuracion

Crear el fichero de entorno para la API:

```bash
# apps/api/.env
DATABASE_URL="file:./dev.db"
PORT=3001
NODE_ENV=development

# JWT (requerido para autenticacion)
JWT_SECRET=tu-secreto-jwt-aqui
JWT_REFRESH_SECRET=tu-secreto-refresh-aqui

# AI Provider (opcional - default: ollama)
AI_PROVIDER=ollama
# Para OpenRouter:
# AI_PROVIDER=openrouter
# OPENROUTER_API_KEY=sk-...
# Para Anthropic:
# AI_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-...
```

## Base de datos

```bash
# Ejecutar migraciones
npm run db:migrate

# Generar cliente Prisma
npm run db:generate

# Cargar datos de ejemplo (fuentes RSS, reels, preguntas quiz, stickers, achievements, team stats)
cd apps/api && npx tsx prisma/seed.ts
```

El seed ahora incluye:
- 47 fuentes RSS (8 deportes)
- 10 reels
- 15 preguntas de quiz
- 36 stickers (4 rarezas)
- 20 achievements (5 categorias)
- 15 equipos con estadisticas

## Arrancar en desarrollo

Necesitas dos terminales:

```bash
# Terminal 1: API
npm run dev:api

# Terminal 2: Webapp
npm run dev:web
```

- API: http://localhost:3001
- Webapp: http://localhost:3000

Para la app movil (requiere Expo CLI):
```bash
npm run dev:mobile
```

La configuracion de la URL del API en mobile esta centralizada en `apps/mobile/src/config.ts` con 3 entornos (dev, preview, production). No hardcodear URLs en screens individuales.

### Servicios de IA (opcional)

Para habilitar moderacion de contenido, resumenes y quiz dinamicos:

```bash
# Instalar Ollama (macOS)
brew install ollama

# Arrancar Ollama
ollama serve

# Descargar un modelo (ej. llama3.2)
ollama pull llama3.2
```

Sin Ollama, los servicios AI operan en modo **fail-open**: la moderacion aprueba todo y los resumenes/quizzes no se generan automaticamente.

## Comandos disponibles

| Comando | Descripcion |
|---------|-------------|
| `npm run dev:api` | Arranca API con hot reload (tsx watch) |
| `npm run dev:web` | Arranca webapp Next.js en modo desarrollo |
| `npm run dev:mobile` | Arranca Expo para la app movil |
| `npm run build:api` | Compila la API a JavaScript |
| `npm run build:web` | Genera build de produccion de la webapp |
| `npm run db:migrate` | Ejecuta migraciones de Prisma |
| `npm run db:generate` | Regenera el cliente Prisma |
| `npm run lint` | Ejecuta ESLint en todo el monorepo |
| `npm run test` | Ejecuta todos los tests del monorepo |
| `npm run test:api` | Ejecuta tests de la API (Vitest) |

## Estructura de una nueva ruta API

1. Crear fichero en `apps/api/src/routes/` (nombre en ingles, ej. `teams.ts`)
2. Definir schemas de validacion con Zod
3. Implementar handlers con tipado de Express
4. Exportar el router como default
5. Importar y montar en `apps/api/src/index.ts`
6. Si la ruta necesita proteccion parental, aplicar middleware `parental-guard`

## Estructura de un nuevo servicio

1. Crear fichero en `apps/api/src/services/` (nombre en ingles, ej. `team-stats.ts`)
2. Si usa IA, importar `aiClient` de `ai-client.ts`
3. Exportar funciones con tipado TypeScript
4. Importar desde las rutas que lo necesiten

## Estructura de una nueva pagina web

1. Crear carpeta en `apps/web/src/app/<nombre>/` (nombre en ingles, ej. `/collection`)
2. Crear `page.tsx` (puede ser Server o Client Component)
3. Usar `useUser()` para acceder al contexto del usuario (de `user-context`)
4. Importar componentes compartidos de `@/components/` (ej. `NewsCard`, `FiltersBar`, `StickerGrid`)
5. Usar funciones de `@/lib/api.ts` para llamadas al backend

## Convenciones

- **Idioma del codigo**: identificadores, nombres de ficheros, tipos, funciones y variables en **ingles**
- **Idioma de la UI**: espanol por defecto, con soporte i18n para otros idiomas
- **Terminos tecnicos**: se mantienen en ingles (deploy, feed, quiz, onboarding)
- **Nombres de ficheros**: kebab-case para utilidades, PascalCase para componentes React
- **Tipos compartidos**: definir en `packages/shared/src/types/`
- **Constantes**: definir en `packages/shared/src/constants/` (`SPORTS`, `TEAMS`, `COLORS`, `AGE_RANGES`)
- **Traducciones**: anadir en `packages/shared/src/i18n/es.json` y `en.json`

## Sistema de internacionalizacion (i18n)

El paquete `@sportykids/shared` incluye un modulo de i18n:

```
packages/shared/src/i18n/
├── es.json    # Traducciones en espanol
├── en.json    # Traducciones en ingles
└── index.ts   # Funcion t(key, locale)
```

### Uso basico

```typescript
import { t } from '@sportykids/shared/i18n';

// Traducir un texto
t('sports.football', 'es');  // -> "Futbol"
t('sports.football', 'en');  // -> "Football"
```

### Anadir nuevas traducciones

1. Anadir la clave en `es.json` y `en.json`
2. Usar `t('nueva.clave', locale)` en el componente

### Referencia de constantes y utilidades compartidas

| Antes (espanol) | Ahora (ingles) | Ubicacion |
|-----------------|----------------|-----------|
| `DEPORTES` | `SPORTS` | `packages/shared/src/constants/` |
| `EQUIPOS` | `TEAMS` | `packages/shared/src/constants/` |
| `COLORES` | `COLORS` | `packages/shared/src/constants/` |
| `RANGOS_EDAD` | `AGE_RANGES` | `packages/shared/src/constants/` |
| `deporteAColor()` | `sportToColor()` | `packages/shared/src/utils/` |
| `deporteAEmoji()` | `sportToEmoji()` | `packages/shared/src/utils/` |
| `formatearFecha()` | `formatDate()` | `packages/shared/src/utils/` |
| `truncarTexto()` | `truncateText()` | `packages/shared/src/utils/` |

## Dependencias clave anadidas (Sprint 7-8)

| Paquete | Capa | Uso |
|---------|------|-----|
| `jsonwebtoken` | API | Firma y verificacion de JWT (access + refresh tokens) |
| `expo-server-sdk` | API | Envio de push notifications a dispositivos Expo |
| `expo-notifications` | Mobile | Registro de push tokens y recepcion de notificaciones |
| `expo-device` | Mobile | Deteccion de dispositivo fisico (push solo en fisico, no en emulador) |

## Cron Jobs

El sistema tiene los siguientes jobs programados:

| Job | Fichero | Frecuencia | Descripcion |
|-----|---------|------------|-------------|
| Sync Feeds | `sync-feeds.ts` | Cada 30 min + al arrancar | Sincroniza feeds RSS, modera contenido |
| Daily Quiz | `generate-daily-quiz.ts` | 06:00 UTC | Genera preguntas diarias con IA |
| Daily Missions | `generate-daily-missions.ts` | 05:00 UTC | Genera misiones diarias |
| Weekly Digests | `send-weekly-digests.ts` | 08:00 UTC diario | Envia digests semanales |
| Streak Reminder | (push-notifications) | 20:00 UTC diario | Recordatorio de racha a usuarios que no han hecho check-in |

## Tests

El proyecto usa **Vitest** como framework de testing para la API:

```bash
# Ejecutar todos los tests de la API
cd apps/api && npx vitest run

# Ejecutar tests en modo watch
cd apps/api && npx vitest
```

Ficheros de test existentes:
- `apps/api/src/utils/safe-json-parse.test.ts` — 6 tests (parser JSON seguro)
- `apps/api/src/utils/url-validator.test.ts` — 16 tests (validacion SSRF)
- `apps/api/src/services/gamification.test.ts` — 7 tests (rachas, stickers, logros)
- `apps/api/src/services/feed-ranker.test.ts` — 7 tests (ranking personalizado)

Configuracion en `apps/api/vitest.config.ts`. Se usa `vi.mock` para Prisma y `vi.useFakeTimers` para tests de tiempo.
