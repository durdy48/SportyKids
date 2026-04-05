# SportyKids — Admin Dashboard

**Fase**: Post-lanzamiento — Operaciones internas
**Prioridad**: MEDIA-ALTA — sin visibilidad operativa, los problemas se detectan tarde
**Dependencias**: Fases 1–6 completadas (auth admin, endpoints existentes)
**Estimación**: 3–4 semanas (backend + frontend por secciones)
**Contexto**: Análisis estratégico v4 (2026-03-28) — Backlog operativo

---

## Objetivo

Construir un panel de administración interno **exclusivamente en la webapp** (`apps/web`) para SportyKids que permita monitorizar el estado del sistema, analizar el uso real de la app, moderar contenido pendiente, gestionar fuentes RSS/vídeo, disparar operaciones de mantenimiento manualmente y tener visibilidad sobre usuarios, organizaciones y suscripciones.

El dashboard es una herramienta interna — no accesible para usuarios finales ni desde la app móvil.

---

## Problema actual

La API tiene soporte para rol `admin` y dos endpoints de administración (`GET /api/admin/moderation/pending` y `POST /api/admin/quiz/generate`), pero:
- No existe ninguna interfaz visual de administración
- Las operaciones de mantenimiento requieren SQL manual o llamadas curl
- No hay métricas de uso agregadas accesibles sin consultar directamente la base de datos
- Los 10 cron jobs no tienen panel de control — solo se disparan dos manualmente
- La moderación de contenido es completamente reactiva (se ve lo que está pendiente, pero no se puede actuar)
- No hay forma de gestionar fuentes RSS/vídeo sin acceso directo a la base de datos

---

## Decisiones técnicas

### Stack del dashboard

| Decisión | Elección | Motivo |
|----------|----------|--------|
| Ubicación | `apps/web/src/app/admin/` | Solo webapp, nunca mobile |
| Librería UI | **Tremor** | Diseñada para dashboards de admin: KPI cards, gráficas, tablas nativas; Tailwind-based; simple de usar |
| Gráficas | Tremor nativo (Recharts bajo el capó) | Sin dependencias extra |
| Aspecto visual | Distinto al de la app de niños | Paleta neutra (gris/slate), tipografía más compacta, density alta — imposible de confundir con la app |
| Analytics | Pre-computadas noche anterior | Job nocturno materializa métricas en caché; el dashboard no genera carga en DB de producción |
| Admin user | Script CLI de Node | `npx tsx scripts/create-admin.ts <email>` — sin superficie de ataque, explícito |

### Skills a usar durante la implementación

Al generar código del dashboard invocar siempre:
- **`/frontend-design`** (skill Claude Code) — para decisiones de layout, componentes y UX del admin
- **`design:design-system`** — al definir tokens y patrones del admin separados de la app principal
- **`design:accessibility-review`** — antes de cada sección, el dashboard también debe ser accesible

---

## Creación del usuario admin inicial

**Script**: `apps/api/scripts/create-admin.ts`

```bash
# Uso
npx tsx apps/api/scripts/create-admin.ts antonio@tupl.io

# El script:
# 1. Busca el usuario por email (debe existir previamente)
# 2. Si existe: actualiza role a 'admin'
# 3. Si no existe: crea el usuario con role 'admin' y password temporal que se muestra en consola
# 4. Imprime confirmación con ID de usuario
```

No se necesita endpoint de bootstrap — el script se ejecuta localmente o con `fly ssh console` en producción.

---

## Alcance completo

El dashboard se organiza en **6 secciones**. Cada sección tiene sus propios endpoints backend y su página frontend. El spec completo se convierte en PRDs por sección.

---

### Sección 1 — Visión general (Home)

**Propósito:** Panorama rápido del estado del sistema al entrar al dashboard.

**Widgets Tremor:**
- `Metric` cards: usuarios totales, DAU (ayer), noticias pendientes de moderar, fuentes RSS activas
- `AreaChart`: actividad diaria últimos 30 días (news_viewed + reel_view + quiz_answered) — datos pre-computados
- `DonutChart`: distribución free vs. premium
- `Table`: estado de los 10 cron jobs (nombre, último run, tiempo desde el último run, status badge)
- `Callout` de alertas: contenido pendiente > 30min, fuentes RSS sin sync > 6h

**Datos:**
- KPIs en tiempo real (query ligera, cached 5 min)
- Actividad últimos 30 días: pre-computada por job nocturno → guardada en caché Redis/memory
- Estado de jobs: last run desde modelo `JobRun` (ver Sección 5)

**Endpoint nuevo:**
- `GET /api/admin/overview` — KPIs + alertas activas (cached 5 min)
- `GET /api/admin/analytics/activity-chart` — datos pre-computados para el AreaChart (cached hasta próximo job nocturno)

---

### Sección 2 — Moderación de contenido

**Propósito:** Revisar y actuar sobre noticias y reels pendientes de moderación. Primera prioridad de implementación.

**Funcionalidades:**
- `Table` Tremor: noticias en `safetyStatus: 'pending'` ordenadas por `pendingMinutes` desc — título, fuente, deporte, resumen, motivo AI, tiempo pendiente
- Mismo para reels pendientes
- Acciones por fila: **Aprobar** / **Rechazar** (modal con campo de motivo)
- Selección múltiple → batch approve / batch reject
- Filtros: por tipo (news/reel), por deporte, por fuente, por rango de tiempo pendiente
- `Table` secundaria: `ContentReport` por estado — quién reportó, qué contenido, motivo, fecha → acciones: revisado / desestimar / actuar (rechaza el contenido asociado)

**Endpoints nuevos:**
- `PATCH /api/admin/content/:type/:id/approve` — aprueba (`type`: news | reel)
- `PATCH /api/admin/content/:type/:id/reject` — `{ reason: string }`
- `POST /api/admin/content/batch` — `{ ids: string[]; type: 'news'|'reel'; action: 'approve'|'reject'; reason?: string }`
- `GET /api/admin/reports?status=&contentType=&page=` — lista ContentReport paginada
- `PATCH /api/admin/reports/:id` — actualizar estado + acción opcional sobre el contenido

**Endpoints existentes a extender:**
- `GET /api/admin/moderation/pending` — añadir filtros `?type=&sport=&source=` y paginación real

---

### Sección 3 — Analytics de uso

**Propósito:** Entender cómo se usa la app con datos estables, sin impacto en producción.

**Arquitectura de datos:**
- Job nocturno `compute-analytics` (cron `0 2 * * *`, 2am UTC) calcula todas las métricas del día anterior
- Resultado guardado en un nuevo modelo `AnalyticsSnapshot` con `date`, `metric`, `value` (Json)
- El dashboard lee únicamente de `AnalyticsSnapshot` — nunca queries pesadas en tiempo real

**Métricas a mostrar:**

| Métrica | Fuente | Componente Tremor |
|---------|--------|-------------------|
| DAU / MAU últimos 30 días | ActivityLog → AnalyticsSnapshot | AreaChart |
| Retención D1 / D7 / D30 | Cohortes por createdAt → AnalyticsSnapshot | BarChart |
| Distribución por deporte | ActivityLog groupBy sport → Snapshot | BarChart |
| Deporte con mayor tiempo de lectura | Sum durationSeconds → Snapshot | BarList |
| Distribución por país | User groupBy country → Snapshot | BarList |
| Tasa de activación parental | ParentalProfile / User → Snapshot | Metric + ProgressBar |
| Tasa de consentimiento | User.consentGiven → Snapshot | Metric + ProgressBar |
| Quiz engagement rate | quiz_answered / usuarios activos → Snapshot | Metric |
| Misiones completadas vs. reclamadas | DailyMission → Snapshot | DonutChart |
| Funnel onboarding | registro → consent → quiz → streak → premium → Snapshot | Funnel (custom) |

**Endpoints nuevos:**
- `GET /api/admin/analytics/snapshot?from=&to=&metrics=` — datos pre-computados por rango de fechas
- `GET /api/admin/analytics/top-content?from=&to=&limit=` — top noticias (query directa, lightweight, solo IDs + count)

**Nuevo modelo Prisma:**
```prisma
model AnalyticsSnapshot {
  id        String   @id @default(cuid())
  date      DateTime // Día al que corresponden los datos (truncado a 00:00 UTC)
  metric    String   // 'dau', 'mau', 'sport_activity', 'retention_d1', etc.
  value     Json     // Estructura varía según la métrica
  createdAt DateTime @default(now())

  @@unique([date, metric])
  @@index([date])
}
```

---

### Sección 4 — Gestión de fuentes

**Propósito:** Activar, desactivar y monitorizar fuentes RSS y de vídeo sin acceso a DB.

**Funcionalidades:**
- `Table` Tremor: todas las `RssSource` — nombre, deporte, país, estado toggle, último sync, noticias generadas
- Toggle activo/inactivo por fila (inline, sin modal)
- Filtros: por deporte, país, tipo (predefinida/custom)
- Botón "Sync ahora" por fila — dispara aggregator para esa fuente concreta
- `Badge` de error si última sync > umbral esperado
- Mismo panel para `VideoSource` (canales YouTube)
- Formulario para añadir nueva fuente (RSS o vídeo): nombre, URL del feed, deporte, country → validación antes de guardar
- Eliminar fuentes custom con confirmación (las predefinidas no se pueden eliminar, solo desactivar)

**Endpoints nuevos:**
- `GET /api/admin/sources/rss?sport=&country=&active=` — lista con stats (`newsCount`, `lastSyncedAt`)
- `PATCH /api/admin/sources/rss/:id` — toggle `active`, actualizar campos
- `DELETE /api/admin/sources/rss/:id` — solo fuentes custom (`isCustom: true`)
- `POST /api/admin/sources/rss/:id/sync` — sync manual de una fuente RSS
- `GET /api/admin/sources/video?sport=&active=` — lista VideoSource con stats
- `PATCH /api/admin/sources/video/:id` — toggle `active`
- `DELETE /api/admin/sources/video/:id` — solo custom
- `POST /api/admin/sources/video/:id/sync` — sync manual

---

### Sección 5 — Operaciones y jobs

**Propósito:** Disparar manualmente cualquier cron job y ver su estado e historial.

**Jobs disponibles:**

| Job | Descripción | Frecuencia |
|-----|-------------|------------|
| `sync-feeds` | Sincroniza todas las fuentes RSS | 30 min |
| `sync-videos` | Sincroniza canales YouTube | 2h |
| `sync-team-stats` | Stats de equipos vía TheSportsDB | Diario 4am |
| `generate-daily-quiz` | Genera preguntas con AI | Diario 6am |
| `generate-daily-missions` | Misiones del día | Diario 5am |
| `streak-reminder` | Push a usuarios con racha activa | Diario 6pm |
| `mission-reminder` | Push a misiones > 50% progreso | Diario 6pm |
| `send-weekly-digests` | PDF/email de actividad semanal | Semanal |
| `live-scores` | Polling de partidos en vivo | 5 min |
| `compute-analytics` | Materializa métricas para dashboard | Diario 2am |

**Funcionalidades:**
- `Table` Tremor: un job por fila — nombre, último run (relative time), duración media, status `Badge` (ok/stale/never), botón "Disparar"
- Al hacer clic en "Disparar": confirmación modal → POST → feedback inmediato (el job corre async, el status se actualiza en la tabla vía polling cada 5s mientras hay un job `running`)
- Click en el nombre del job → drawer lateral con historial de las últimas 20 ejecuciones
- Alerta visual si un job no ha corrido en más del doble de su frecuencia esperada

**Nuevo modelo Prisma:**
```prisma
model JobRun {
  id          String    @id @default(cuid())
  jobName     String
  startedAt   DateTime  @default(now())
  finishedAt  DateTime?
  status      String    // 'running' | 'success' | 'error'
  output      Json?     // { processed: number, errors: number, details: string }
  triggeredBy String    @default("cron") // 'cron' | 'manual'
  triggeredId String?   // userId del admin si es manual

  @@index([jobName, startedAt])
}
```

**Endpoints nuevos:**
- `GET /api/admin/jobs` — estado de todos los jobs (último JobRun de cada uno)
- `POST /api/admin/jobs/:name/trigger` — trigger manual, crea JobRun con `triggeredBy: 'manual'`
- `GET /api/admin/jobs/:name/history?limit=20` — historial de ejecuciones

**Instrumentación de jobs existentes:** cada job envuelve su lógica principal en:
```typescript
const run = await prisma.jobRun.create({ data: { jobName, status: 'running', triggeredBy } });
try {
  const output = await runJobLogic();
  await prisma.jobRun.update({ where: { id: run.id }, data: { status: 'success', finishedAt: new Date(), output } });
} catch (e) {
  await prisma.jobRun.update({ where: { id: run.id }, data: { status: 'error', finishedAt: new Date(), output: { error: e.message } } });
}
```

---

### Sección 6 — Usuarios y organizaciones

**Propósito:** Buscar usuarios, ver su estado y gestionar organizaciones B2B. Herramienta de soporte.

**Funcionalidades — Usuarios:**
- `TextInput` de búsqueda por email o ID → `Table` de resultados
- Ficha de usuario (página `/admin/users/[id]`):
  - Datos: rol, tier, país, locale, `consentGiven`, `consentDate`, `lastLoginAt`, `organizationId`, `authProvider`
  - `ActivityLog` de las últimas 10 acciones (tipo, sport, duración, fecha)
  - Stickers y logros desbloqueados
  - Racha actual y récord
- Acciones (con confirmación modal):
  - **Cambiar tier** (free ↔ premium) — para soporte sin tocar RevenueCat
  - **Cambiar rol** (child ↔ parent) — para correcciones de onboarding
  - **Revocar tokens** — cierra todas las sesiones activas (elimina todos los RefreshToken del usuario)

**Funcionalidades — Organizaciones:**
- `Table` Tremor: nombre, slug, deporte, miembros activos / maxMembers, `Badge` activa/inactiva
- Filtros: por deporte, por estado
- Click en fila → página detalle `/admin/organizations/[id]`:
  - Datos: inviteCode, admin de la org, fecha de creación
  - `Table` de miembros con su actividad reciente
  - Gráfica de actividad de la organización (últimos 30 días, pre-computada)
  - Acciones: regenerar inviteCode, desactivar organización

**Endpoints nuevos:**
- `GET /api/admin/users?q=&page=&limit=` — búsqueda paginada
- `GET /api/admin/users/:id` — ficha completa (actividad reciente incluida)
- `PATCH /api/admin/users/:id/tier` — `{ tier: 'free'|'premium' }`
- `PATCH /api/admin/users/:id/role` — `{ role: 'child'|'parent'|'admin' }`
- `POST /api/admin/users/:id/revoke-tokens` — elimina todos los RefreshToken del usuario
- `GET /api/admin/organizations?sport=&active=&page=` — lista paginada con stats
- `GET /api/admin/organizations/:id` — detalle con miembros y actividad
- `PATCH /api/admin/organizations/:id` — `{ active: boolean, maxMembers: number }`

**Endpoints existentes a reutilizar:**
- `POST /api/organizations/:id/regenerate-code` — accesible desde el admin sin duplicar lógica

---

## Autenticación y acceso

- El dashboard es **solo webapp** (`apps/web/src/app/admin/`) — sin acceso mobile
- Middleware de Next.js verifica JWT + `role === 'admin'` en cada ruta `/admin/*`; si no → redirect a `/`
- Los endpoints `/api/admin/*` ya usan `requireAuth + requireRole('admin')`
- El NavBar principal de la app **no muestra el link de admin** salvo que el usuario tenga rol admin

**Middleware frontend:**
```typescript
// apps/web/src/middleware.ts
// Si pathname.startsWith('/admin') y role !== 'admin' → redirect a '/'
```

---

## Diseño visual

El admin tiene su propio lenguaje visual, diferenciado intencionalmente de la app de niños:

| Aspecto | App de niños | Admin dashboard |
|---------|-------------|-----------------|
| Paleta | Azul vivo, verde, amarillo | Slate/gris neutro, acentos indigo |
| Tipografía | Poppins (títulos), Inter | Inter únicamente, tamaños más compactos |
| Densidad | Holgada, cards grandes | Alta densidad — más datos por pantalla |
| Animaciones | Confetti, reward toasts | Ninguna — funcional y directo |
| Componentes | Personalizados | **Tremor** + Tailwind |

**Layout admin:**
- Sidebar fija izquierda con 6 secciones + logo "Admin" en la parte superior
- Contenido principal en área de scroll independiente
- Sin NavBar de la app principal — layout completamente separado

---

## Implementación técnica

### Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `apps/api/scripts/create-admin.ts` | Script CLI para crear usuario admin inicial |
| `apps/api/src/services/admin-stats.ts` | Queries de analytics para el job nocturno |
| `apps/api/src/services/job-runner.ts` | Wrapper de trigger manual de jobs + registro JobRun |
| `apps/api/src/jobs/compute-analytics.ts` | Job nocturno que materializa métricas → AnalyticsSnapshot |
| `apps/web/src/app/admin/layout.tsx` | Layout admin con sidebar Tremor + auth check |
| `apps/web/src/app/admin/page.tsx` | Sección 1: Home/overview |
| `apps/web/src/app/admin/moderation/page.tsx` | Sección 2: Moderación de contenido |
| `apps/web/src/app/admin/analytics/page.tsx` | Sección 3: Analytics de uso |
| `apps/web/src/app/admin/sources/page.tsx` | Sección 4: Gestión de fuentes |
| `apps/web/src/app/admin/jobs/page.tsx` | Sección 5: Operaciones y jobs |
| `apps/web/src/app/admin/users/page.tsx` | Sección 6: Lista de usuarios |
| `apps/web/src/app/admin/users/[id]/page.tsx` | Sección 6: Ficha de usuario |
| `apps/web/src/app/admin/organizations/page.tsx` | Sección 6: Lista de organizaciones |
| `apps/web/src/app/admin/organizations/[id]/page.tsx` | Sección 6: Detalle de organización |

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `apps/api/src/routes/admin.ts` | Añadir todos los endpoints de las 6 secciones |
| `apps/api/prisma/schema.prisma` | Añadir modelos `JobRun` y `AnalyticsSnapshot` |
| `apps/api/src/jobs/*.ts` (todos) | Instrumentar con JobRun start/finish |
| `apps/api/src/index.ts` | Registrar job `compute-analytics` en el scheduler |
| `apps/web/src/middleware.ts` | Añadir guard para rutas `/admin/*` |
| `apps/web/src/components/NavBar.tsx` | Mostrar link admin solo si role === 'admin' |
| `packages/shared/src/i18n/es.json` | Claves `admin.*` |
| `packages/shared/src/i18n/en.json` | Ídem en inglés |

### Dependencia nueva

```bash
# En apps/web únicamente
npm install @tremor/react --workspace=apps/web
```

Tremor es compatible con Next.js 14+ y Tailwind CSS 3/4. Sin conflictos con el stack actual.

---

## Priorización de implementación (para PRDs)

| Sección | Impacto operativo | Esfuerzo | PRD orden |
|---------|------------------|----------|-----------|
| Moderación (S2) | MUY ALTO — contenido acumulado | BAJO | 1 |
| Dashboard home (S1) | ALTO — visibilidad inmediata | MEDIO | 2 |
| Operaciones/Jobs (S5) | ALTO — elimina SQL manual | MEDIO | 3 |
| Gestión de fuentes (S4) | MEDIO | BAJO | 4 |
| Analytics (S3) | ALTO — datos de negocio | ALTO | 5 |
| Usuarios y orgs (S6) | MEDIO — soporte | MEDIO | 6 |

---

## Criterios de aceptación

- [ ] Solo usuarios con `role: 'admin'` pueden acceder a `/admin/*` (redirección a `/` en caso contrario)
- [ ] El script `create-admin.ts` crea o promueve un usuario a admin correctamente
- [ ] La app mobile no tiene ningún punto de entrada al admin dashboard
- [ ] El NavBar principal no muestra el link de admin a usuarios no-admin
- [ ] El dashboard home carga en menos de 2s (KPIs en tiempo real + datos de actividad pre-computados)
- [ ] Se puede aprobar o rechazar contenido pendiente desde la UI sin SQL
- [ ] Las acciones batch de moderación funcionan para lotes de al menos 50 items
- [ ] Se puede disparar manualmente cualquier job y ver el resultado en la UI
- [ ] El modelo `JobRun` registra cada ejecución (cron y manual) con status y duración
- [ ] Los datos de analytics tienen como máximo 24h de lag (calculados en el job nocturno)
- [ ] Se puede buscar un usuario por email y ver su ficha completa
- [ ] Se puede activar/desactivar cualquier fuente RSS o de vídeo desde la UI
- [ ] Tremor instalado solo en `apps/web` — sin impacto en API ni mobile
- [ ] Tests unitarios para `admin-stats.ts` y `job-runner.ts`
- [ ] El admin dashboard pasa la revisión de accesibilidad WCAG 2.1 AA (skill `design:accessibility-review`)

---

## Fuera de alcance

- Acceso desde la app mobile
- Sistema de roles granulares (moderador vs. superadmin) — un único rol `admin`
- Auditoría de acciones de admin (log de quién aprobó qué) — backlog P3
- Integración con Sentry o PostHog dashboard — se accede directamente a esas herramientas
- Gestión de suscripciones en RevenueCat — se gestiona desde su propio dashboard
- Push manual a segmentos de usuarios — backlog P3
- Soporte multi-idioma del dashboard (el admin siempre en español)
