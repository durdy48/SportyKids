# SportyKids — Deuda Tecnica y Backlog Pendiente

## Contexto

SportyKids tiene completadas las Fases 0-4, los 6 milestones de la Fase 5 (M1-M6), el Backlog Evolutivo (6 PRDs), y los sprints 1-4 del Product Owner (parcialmente — sprints 1-2 completos, sprints 3-4 al ~50%). El proyecto tiene **274 tests en 25 archivos** pero solo en la API. Web y Mobile tienen 0 tests.

Este documento consolida **toda la deuda tecnica identificada y el backlog funcional pendiente** para llevar SportyKids de beta cerrada a produccion. Se divide en dos bloques: (A) deuda tecnica que bloquea la calidad y estabilidad, y (B) features funcionales pendientes de sprints anteriores.

---

## Feature 1: Infraestructura de Testing — Web y Mobile (CRITICA)

### Problema

La API tiene 274 tests en 25 archivos (Vitest), pero **apps/web (56 archivos) y apps/mobile (32 archivos) tienen 0 tests**. Cualquier cambio en frontend puede introducir regresiones sin deteccion. Los jobs de background (sync-feeds, generate-daily-quiz, generate-daily-missions, streak-reminder, send-weekly-digests) tampoco tienen tests.

### Alcance

1. **Configurar Vitest + React Testing Library en apps/web**:
   - `vitest.config.ts` con soporte Next.js (App Router)
   - Tests para componentes criticos: `OnboardingWizard`, `QuizGame`, `ParentalPanel`, `PinInput`, `ReelPlayer`, `NewsCard`
   - Tests para hooks/contexts: `useUser`, `useFavorites`, `useOfflineCache`
   - Mock de `fetch` para llamadas API

2. **Configurar Vitest + React Native Testing Library en apps/mobile**:
   - `vitest.config.ts` con soporte Expo/React Native
   - Tests para screens criticas: `HomeFeed`, `Quiz`, `ParentalControl`, `Onboarding`, `Login`
   - Tests para lib: `api.ts`, `auth.ts`, `push-notifications.ts`

3. **Tests para jobs de background en API**:
   - `sync-feeds.ts`, `sync-videos.ts`, `generate-daily-quiz.ts`, `generate-daily-missions.ts`
   - `streak-reminder.ts`, `send-weekly-digests.ts`, `sync-team-stats.ts`
   - Mockear dependencias externas (RSS feeds, AI providers, push delivery)

4. **Actualizar CI** (`.github/workflows/ci.yml`):
   - Anadir step de tests web
   - Anadir step de tests mobile
   - Anadir coverage reporting (upload de metricas)

### Estimacion: 2-3 semanas (ongoing, empezar por componentes de mayor riesgo)

---

## Feature 2: ESLint y Linting Consistente (CRITICA)

### Problema

Los scripts de lint existen en `package.json` (`eslint . --ext .ts,.tsx`) pero **no hay ficheros de configuracion de ESLint** (`.eslintrc.*` ni `eslint.config.*`) en el proyecto. CI ejecuta lint pero probablemente no detecta nada util. No hay reglas de codigo consistentes entre API, Web y Mobile.

### Alcance

1. **Crear configuracion ESLint raiz** (`eslint.config.js` o `.eslintrc.json`):
   - Reglas base: `no-console` (warn), `no-unused-vars`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/strict`
   - Configuracion por workspace: API (Node), Web (Next.js/React), Mobile (React Native/Expo)
   - Compartir reglas via preset del monorepo

2. **Integrar con Prettier** (si no existe):
   - Formateo consistente entre todos los workspaces
   - `.prettierrc` en raiz

3. **Limpiar warnings existentes**:
   - Ejecutar lint, categorizar, y resolver o suprimir justificadamente

### Estimacion: 1-2 dias

---

## Feature 3: Mobile Typecheck en CI (CRITICA)

### Problema

El CI (`.github/workflows/ci.yml`) ejecuta `tsc --noEmit` para API y Web pero **no para Mobile**. Errores de tipos en apps/mobile (32 archivos fuente) pueden pasar a produccion sin ser detectados. Esto es especialmente peligroso porque Mobile tiene dependencias con versiones diferentes a Web (ej: React 19.1.0 vs 19.2.4).

### Alcance

1. **Anadir typecheck mobile a CI**:
   - Nuevo step en el job de lint: `cd apps/mobile && npx tsc --noEmit`
   - Asegurar que las dependencias de tipos estan instaladas (React Native, Expo)

2. **Resolver errores de tipos existentes**:
   - Ejecutar `tsc --noEmit` localmente y corregir lo que aparezca
   - Si hay errores de terceros, suprimir con `@ts-expect-error` puntual y documentar

3. **Consolidar Prisma generate en CI**:
   - Actualmente se ejecuta en lint job Y en cada build job (duplicado)
   - Mover a un setup step compartido que solo corra una vez
   - Anadir cache de Prisma engines para acelerar CI

### Estimacion: 0.5-1 dia

---

## Feature 4: Logging Estructurado (CRITICA)

### Problema

Hay **88 `console.*` en la API** (console.log, console.error, console.warn) sin formato estructurado. Sentry esta inicializado (`monitoring.ts`) pero no integrado con los logs del codigo. En produccion no hay forma de filtrar, buscar, ni correlacionar errores. PostHog analytics esta igualmente solo inicializado sin eventos reales.

### Alcance

1. **Reemplazar `console.*` por logger estructurado**:
   - Instalar `pino` (o similar ligero) como logger principal
   - Niveles: `debug`, `info`, `warn`, `error` con contexto JSON
   - Formato: `{ timestamp, level, message, service, requestId, ...context }`
   - Reemplazar los 88 `console.*` existentes por llamadas al logger

2. **Integrar logger con Sentry**:
   - Enviar `error` y `warn` a Sentry automaticamente
   - Anadir breadcrumbs para `info` en flujos criticos (auth, parental, moderation)
   - Contexto de usuario (userId, role) en cada error report

3. **Integrar eventos con PostHog**:
   - Eventos minimos: `onboarding_completed`, `quiz_played`, `sticker_earned`, `parental_pin_verified`
   - Funnels: onboarding completion rate, daily retention
   - Respetar privacy: no PII, solo metricas anonimizadas

4. **Request ID middleware**:
   - Generar UUID por request para correlacion de logs
   - Pasar en header `X-Request-ID`

### Estimacion: 2-3 dias

---

## Feature 5: Session Tokens Parentales Persistentes (CRITICA)

### Problema

Los session tokens parentales (tras verificar PIN) se almacenan en un `Map` in-memory con TTL de 5 minutos. **Se pierden al reiniciar el servidor** y **no funcionan con multiples instancias** (PM2 cluster, Kubernetes). Un padre que verifica su PIN y el servidor se reinicia pierde la sesion inmediatamente. En una app de ninos donde el control parental es critico, esta fragilidad es inaceptable.

### Alcance

1. **Migrar session tokens a base de datos**:
   - Nuevo modelo `ParentalSession` en Prisma: `id`, `userId`, `token` (unique), `expiresAt`, `createdAt`
   - TTL de 5 minutos (configurable)
   - Cleanup automatico de tokens expirados (cron o lazy deletion)

2. **Alternativa: migrar a Redis** (si `CACHE_PROVIDER=redis`):
   - Usar Redis `SET` con `EX` para TTL automatico
   - Fallback a DB si Redis no esta disponible

3. **Actualizar middleware `parental-guard.ts`**:
   - Verificar token contra DB/Redis en vez de Map in-memory
   - Mantener interfaz identica para los frontends

### Estimacion: 0.5-1 dia

---

## Feature 6: Migracion Real a PostgreSQL (ALTA)

### Problema

SQLite es single-writer (causa `SQLITE_BUSY` bajo carga concurrente), arrays almacenados como JSON strings (queries ineficientes), y `GROUP BY` con `HAVING` se hace en memoria por limitaciones del driver (news.ts linea 220). Los scripts de migracion (`docker-compose.yml`, `migrate-to-postgres.sh`) ya existen pero no se ha ejecutado la migracion real. **Bajo carga de multiples familias en beta, SQLite se rompera.**

### Alcance

1. **Ejecutar migracion**:
   - `docker compose up -d postgres` (PostgreSQL 16 ya configurado)
   - Cambiar `DATABASE_URL` a PostgreSQL
   - `npx prisma migrate deploy`
   - Re-seed datos iniciales

2. **Optimizar schema para PostgreSQL**:
   - Cambiar campos JSON string (`favoriteSports`, `selectedFeeds`, `options`, `pushPreferences`) a arrays nativos `String[]` o `Json`
   - Migrar queries con agregacion in-memory a `GROUP BY` + `HAVING` nativo (news.ts linea 220)
   - Indices para queries frecuentes: `NewsItem(sport, safetyStatus, publishedAt)`, `ActivityLog(userId, type, timestamp)`

3. **Tests con PostgreSQL**:
   - Ejecutar suite completa de 274 tests contra PostgreSQL
   - Verificar compatibilidad de todas las queries Prisma

4. **Documentar proceso**:
   - Guia paso a paso en docs/
   - Script de rollback a SQLite (ya existe)

### Estimacion: 2-3 dias

---

## Feature 7: OAuth / Social Login (ALTA)

### Problema

JWT + email/password esta implementado (B-TF3), pero los endpoints de OAuth devuelven 501 (placeholder). **Para app stores (especialmente iOS) y reduccion de friccion en onboarding, se necesita al menos Google y Apple sign-in.** Los padres no quieren crear "otra cuenta mas" con email y password. Apple Sign In es **obligatorio** en iOS si ofreces cualquier otro social login.

### Alcance

1. **Google OAuth 2.0**:
   - Web: Redirect flow via `GET /api/auth/google` -> Google consent -> callback
   - Mobile: Expo AuthSession con Google provider
   - Crear/vincular usuario al callback, emitir JWT

2. **Apple Sign In**:
   - Web: Apple JS SDK
   - Mobile: Expo Apple Authentication (nativo)
   - Obligatorio para iOS App Store si hay social login

3. **Modelo de datos**:
   - Campo `authProvider` ya existe en User (`anonymous`, `email`)
   - Anadir: `google`, `apple`
   - Campo `socialId` para ID del provider externo
   - Un usuario puede tener multiples providers (link accounts)

4. **Flujo de vinculacion**:
   - Padre se registra con Google -> crea cuenta `role: parent`
   - Vincula perfil(es) de hijo anonimo(s) via `POST /api/auth/link-child`
   - El nino sigue usando la app sin login, el padre controla desde su cuenta

5. **Seguridad**:
   - Verificar tokens con las APIs de Google/Apple (no confiar en el client)
   - CSRF protection en redirect flows
   - Nonce validation para Apple

### Estimacion: 1-2 semanas

---

## Feature 8: Error Handler Robusto (ALTA)

### Problema

El error handler actual (`middleware/error-handler.ts`) es basico: solo hace `console.error` + responde 500 generico. No diferencia entre errores de validacion (400), autenticacion (401), autorizacion (403), not found (404), rate limiting (429), ni errores internos (500). Tampoco integra con Sentry.

### Alcance

1. **Clases de error tipadas**:
   - `ValidationError` (400) — input invalido (Zod)
   - `AuthenticationError` (401) — token expirado/invalido
   - `AuthorizationError` (403) — sin permisos
   - `NotFoundError` (404) — recurso no existe
   - `ConflictError` (409) — duplicado
   - `RateLimitError` (429) — demasiadas requests
   - Cada clase con `statusCode`, `code` (machine-readable), `message` (human-readable)

2. **Error handler centralizado**:
   - Detectar tipo de error y responder con status code correcto
   - Formato consistente: `{ error: { code, message, details? } }`
   - En development: incluir stack trace
   - En production: ocultar detalles internos

3. **Integrar con Sentry**:
   - Solo reportar errores 5xx (no 4xx)
   - Contexto: userId, route, method, requestId

4. **Mensajes kid-friendly en frontends**:
   - Mapear `error.code` a claves i18n existentes (`KID_FRIENDLY_ERRORS` en shared)
   - Componente `ErrorState` ya existe — conectar con codigos de error reales

### Estimacion: 1-2 dias

---

## Feature 9: Limpieza de Codigo Deprecated y Versiones (ALTA)

### Problema

Hay codigo deprecated y **inconsistencias de versiones** que aumentan la carga de mantenimiento y esconden bugs:
- `sportBoost()` y `recencyBoost()` en `feed-ranker.ts` marcadas `@deprecated` (reemplazadas por `sportFrequencyBoost()` y `recencyDecay()`)
- **React version mismatch**: Web usa 19.2.4, Mobile usa 19.1.0 — puede causar bugs sutiles en hooks compartidos
- `skipLibCheck: true` en `tsconfig.json` de Web enmascara errores de tipos en dependencias
- 3 jobs (missions, sync-feeds, quiz) con locale hardcodeado en notificaciones push en vez de usar `user.locale`
- CI duplica Prisma generate (una vez en lint job, otra en cada build job)

### Alcance

1. **Eliminar funciones deprecated en feed-ranker.ts**:
   - Borrar `sportBoost()` y `recencyBoost()`
   - Actualizar tests que las referencien
   - Verificar que ningun import las use

2. **Alinear versiones de React**:
   - Actualizar Mobile a React 19.2.4 (o la version compatible con Expo SDK 54)
   - Si Expo SDK 54 requiere 19.1.0, documentar la restriccion y anadir nota en CLAUDE.md
   - Verificar compatibilidad de `@sportykids/shared` con ambas versiones

3. **Eliminar `skipLibCheck: true` de Web**:
   - Resolver los errores de tipos que aparezcan
   - Si son de terceros incompatibles, suprimir con `@ts-expect-error` puntual

4. **Usar `user.locale` en jobs de push notifications**:
   - `generate-daily-missions.ts` (linea 36)
   - `sync-feeds.ts` (linea 44)
   - `generate-daily-quiz.ts` (linea 201)
   - Cargar locale del usuario antes de enviar notificacion

5. **Optimizar CI**:
   - Prisma generate solo una vez (en setup step compartido)
   - Anadir cache de Prisma engines

### Estimacion: 1-2 dias

---

## Feature 10: Completar Sprint 3 — Confianza Parental (ALTA)

### Problema

3 items del Sprint 3 del Product Owner estan parcialmente implementados. El backend tiene fundamentos pero las UIs no estan completas ni pulidas:
- **B-PT1**: Digest semanal para padres (servicio `digest-generator.ts` existe, PDF generation con jspdf, email con nodemailer — falta UI de configuracion y envio real)
- **B-PT2**: Modo "Ver lo que ve mi hijo" (endpoint `GET /api/parents/preview/:userId` existe — falta componente `FeedPreviewModal` completo)
- **B-PT3**: Limites granulares por tipo de contenido (campos `maxNewsMinutes`, `maxReelsMinutes`, `maxQuizMinutes` existen en DB — falta UI con sliders)

### Alcance

1. **B-PT1 — Digest semanal completo**:
   - UI en `ParentalPanel` tab para configurar: dia de envio, email destino, activar/desactivar
   - Preview del digest en navegador (`GET /api/parents/digest/:userId/preview`)
   - Descarga PDF (`GET /api/parents/digest/:userId/download`)
   - Cron job `send-weekly-digests.ts` ya existe — verificar que funciona end-to-end
   - Template de email atractivo con resumen visual

2. **B-PT2 — Preview del feed del hijo**:
   - Componente `FeedPreviewModal` que muestra el feed exacto que ve el nino
   - Aplicar todas las restricciones parentales activas (formato, deporte, tiempo)
   - Boton "Vista previa" en la tab de restricciones del panel parental
   - Reutilizar componentes `NewsCard` y `ReelCard` existentes

3. **B-PT3 — Limites granulares UI**:
   - 3 sliders en tab de restricciones: Noticias (min), Reels (min), Quiz (min)
   - Valores actuales: `maxNewsMinutes`, `maxReelsMinutes`, `maxQuizMinutes`
   - Visual: icono + label + slider + valor actual
   - Componente `LimitReached` ya existe — conectar con limites por tipo

4. **Mobile parity**:
   - Replicar las 3 features en las screens mobile correspondientes

### Estimacion: 1-2 semanas

---

## Feature 11: Completar Sprint 4 — Motor de Retencion (ALTA)

### Problema

Item **B-EN1** (Mision del dia) esta parcialmente implementado. El modelo `DailyMission` existe, el servicio `mission-generator.ts` genera misiones, el cron `generate-daily-missions.ts` corre a las 05:00 UTC, y los endpoints API existen. Falta completar la logica de rewards y la UI.

### Alcance

1. **B-EN1 — Misiones diarias completas**:
   - Logica de progreso: actualizar `progress` cuando el usuario completa acciones (leer noticia, jugar quiz, ver reel)
   - Hooking: integrar con `ActivityLog` para detectar completitud automatica
   - Claim reward: al completar mision, otorgar sticker/puntos segun `rewardType` y `rewardRarity`
   - Componente `MissionCard` en Home (web): mostrar mision activa con barra de progreso
   - Celebracion al completar (reutilizar confetti de `celebrations.ts`)
   - Si la mision expira sin completar, mostrar "Manana tendras otra oportunidad!"

2. **Mobile parity**:
   - `MissionCard` component para mobile
   - Integracion con el feed principal

3. **Notificacion push**:
   - "Tu mision del dia esta lista!" a las 07:00 hora local del usuario
   - "Casi completas tu mision!" si progreso > 50% a las 18:00

### Estimacion: 1 semana

---

## Feature 12: Dark Mode — Web y Mobile (MEDIA)

### Problema

Item **B-UX4** del Sprint 4 del Product Owner, no iniciado. Los tokens CSS (`--color-background`, `--color-text`, etc.) ya estan preparados en `globals.css` con valores light/dark. Tailwind 4 soporta `dark:` nativo. El `UserContext` ya tiene campo `theme` pero no se usa. Los ninos de 12-14 y los padres de noche esperan dark mode como feature estandar en 2026.

### Alcance

1. **Web — Activar dark mode con Tailwind**:
   - Anadir `darkMode: 'class'` en Tailwind config (o `'media'` para system)
   - Toggle en `NavBar` que cicle: system -> dark -> light
   - Persistir preferencia en localStorage (`sportykids-theme`)
   - Script inline en `layout.tsx` para prevenir flash de tema incorrecto
   - Revisar todos los componentes y anadir variantes `dark:` donde necesario

2. **Mobile — Activar dark mode con React Native**:
   - Usar `useColorScheme()` de React Native + toggle manual
   - Crear `theme.ts` con tokens light/dark basados en `COLORS` del shared
   - Aplicar tema en todos los screens y componentes
   - Persistir preferencia en AsyncStorage

3. **Tokens de diseno dark ya definidos en CLAUDE.md**:
   - Background: `#0F172A`
   - Text: `#F1F5F9`
   - Surface: `#1E293B`
   - Border: `#334155`
   - Muted: `#94A3B8`

### Estimacion: 3-5 dias

---

## Feature 13: Items Menores Pendientes del Product Owner (BAJA)

### Problema

Varios items de prioridad P1-P2 del Product Owner no estan incluidos en ningun sprint o quedaron fuera del alcance. Son mejoras incrementales que mejoran la experiencia pero no bloquean el lanzamiento.

### Alcance

1. **B-UX7 — Mensajes de error kid-friendly**:
   - Componente `ErrorState` existe — conectar con codigos de error reales del backend
   - Mapear HTTP errors a claves i18n (`KID_FRIENDLY_ERRORS` en shared)
   - Mensajes tipo "Oops, el balon se fue fuera! Intentalo de nuevo."

2. **B-UX8 — Haptic feedback en mobile**:
   - `expo-haptics` ya esta instalado
   - Anadir vibracion sutil en: respuesta quiz, coleccion sticker, check-in, like
   - Modulo `haptics.ts` ya existe en `apps/mobile/src/lib/`

3. **B-MP3 — Pull-to-refresh con branding**:
   - `BrandedRefreshControl` componente ya existe
   - Integrar en todas las screens con scroll (HomeFeed, Reels, Collection)

4. **B-PT4 — Horario / Bloqueo nocturno UI**:
   - Backend ya implementado: `allowedHoursStart`/`allowedHoursEnd` en `ParentalProfile`
   - `parental-guard.ts` ya enforcea schedule lock
   - Falta: UI en panel parental para configurar horario

5. **B-PT6 — Tour onboarding parental**:
   - Componente `ParentalTour` ya existe (web y mobile)
   - Verificar que se activa tras crear PIN por primera vez

6. **B-CP4 — Recomendaciones "Si te gusto esto..."**:
   - Endpoint `GET /api/news/:id/related?limit=3` ya existe
   - Falta: componente de articulos relacionados en la vista de detalle

7. **B-EN4 — Historial de lectura**:
   - Endpoint `GET /api/news/history?userId=&page=&limit=` ya existe
   - Falta: seccion "Leido recientemente" en Home feed

8. **B-CP5 — Filtrado de contenido por idioma**:
   - `RssSource.language` y `User.locale` ya existen
   - Feed ranker ya tiene locale/country boost
   - Verificar que el filtrado funciona correctamente end-to-end

9. **B-MP6 — Player nativo para Reels**:
   - `expo-video` ya integrado para MP4
   - YouTube/Instagram/TikTok usan iframes como fallback
   - Evaluar si convertir mas contenido a MP4 directo

### Estimacion: 1-2 semanas (items individuales de 0.5-2 dias)

---

## Resumen de prioridades

| # | Feature | Prioridad | Estimacion | Dependencias |
|---|---------|-----------|------------|--------------|
| 1 | Testing — Web y Mobile | **CRITICA** | 2-3 sem | Ninguna |
| 2 | ESLint y Linting | **CRITICA** | 1-2 dias | Ninguna |
| 3 | Mobile Typecheck en CI | **CRITICA** | 0.5-1 dia | Ninguna |
| 4 | Logging Estructurado | **CRITICA** | 2-3 dias | Ninguna |
| 5 | Session Tokens Persistentes | **CRITICA** | 0.5-1 dia | Ninguna |
| 6 | Migracion PostgreSQL | **ALTA** | 2-3 dias | Ninguna |
| 7 | OAuth / Social Login | **ALTA** | 1-2 sem | Ninguna |
| 8 | Error Handler Robusto | **ALTA** | 1-2 dias | Feature 4 (logger) |
| 9 | Limpieza Deprecated + Versiones | **ALTA** | 1-2 dias | Ninguna |
| 10 | Completar Sprint 3 — Parental | **ALTA** | 1-2 sem | Ninguna |
| 11 | Completar Sprint 4 — Retencion | **ALTA** | 1 sem | Ninguna |
| 12 | Dark Mode (B-UX4) | MEDIA | 3-5 dias | Ninguna |
| 13 | Items Menores PO | BAJA | 1-2 sem | Varias |

### Orden recomendado de implementacion

**Bloque 1 — Fundacion critica (1-2 semanas)**:
1. Feature 3 (Mobile typecheck CI) — 0.5 dias, cierra agujero de deteccion
2. Feature 2 (ESLint) — 1-2 dias, quality gates reales
3. Feature 5 (Session tokens persistentes) — 0.5-1 dia, fix critico para control parental
4. Feature 4 (Logging estructurado) — 2-3 dias, necesario para debugging en beta
5. Feature 8 (Error handler) — 1-2 dias, depende del logger

**Bloque 2 — Infraestructura alta (1-2 semanas)**:
6. Feature 9 (Limpieza deprecated + versiones) — 1-2 dias, reduce ruido y riesgo
7. Feature 6 (PostgreSQL) — 2-3 dias, prerequisito para escalar en beta

**Bloque 3 — Completar Features (2-3 semanas)**:
8. Feature 10 (Sprint 3 parental) — 1-2 sem, alto valor para padres
9. Feature 11 (Sprint 4 retencion) — 1 sem, alto valor para engagement
10. Feature 12 (Dark mode) — 3-5 dias, expectativa estandar

**Bloque 4 — Produccion y lanzamiento (2-3 semanas)**:
11. Feature 7 (OAuth) — 1-2 sem, prerequisito para app stores
12. Feature 1 (Testing web/mobile) — ongoing en paralelo desde bloque 1
13. Feature 13 (Items menores) — priorizar por impacto
