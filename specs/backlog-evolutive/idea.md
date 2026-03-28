# SportyKids — Backlog Evolutivo Consolidado

## Contexto

SportyKids tiene completadas las Fases 0-4 y los 6 milestones de la Fase 5 (M1-M6), más los sprints 1-8 del Product Owner (B-UX1-6, B-EN1-3, B-PT1-5, B-TF1-3, B-MP1-2, B-MP5, B-CP1, B-UX4). El proyecto está en fase de **test interno + beta cerrada con 5-10 familias**.

Este documento consolida **todo el trabajo pendiente** para llevar SportyKids de MVP a producto premium listo para producción. Incluye features nuevas, mejoras técnicas y deuda técnica.

---

## Feature 1: Video Aggregator — Reels dinámicos (ALTA)

### Problema

Los Reels son 10 vídeos estáticos del seed. Los niños ven siempre los mismos vídeos. Para el test con familias, necesitan contenido fresco diario.

### Solución

Sistema de agregación de vídeos desde YouTube usando **YouTube RSS feeds** (gratis, sin API key), paralelo al agregador RSS de noticias existente.

### Alcance

1. **Modelo `VideoSource` en Prisma** — configurable por canal/playlist YouTube, deporte, activo/inactivo
   - Campos: `id`, `name`, `platform` (youtube_channel/youtube_playlist), `feedUrl` (unique), `channelId`, `playlistId`, `sport`, `active`, `isCustom`, `addedBy`, `lastSyncedAt`, `createdAt`

2. **Extender modelo `Reel`** con campos de dedup y moderación:
   - `rssGuid` (unique, nullable) — ID del vídeo YouTube para dedup (`yt:video:XXX`)
   - `videoSourceId` — FK lógica a VideoSource
   - `safetyStatus` (default "approved") — moderación igual que noticias
   - `safetyReason`, `moderatedAt`, `publishedAt`

3. **Servicio `video-aggregator.ts`** — espejo de `aggregator.ts`:
   - Parsear feeds YouTube RSS con `rss-parser` (soporta Atom, formato de YouTube)
   - Deduplicar por `rssGuid` en tabla Reel
   - Moderar título/descripción con `moderateContent()` existente
   - Detectar equipo con `classifyNews()` existente
   - Generar thumbnails automáticas desde YouTube (`img.youtube.com/vi/{id}/mqdefault.jpg`)
   - Upsert a tabla Reel con `videoType: 'youtube_embed'`

4. **Cron job `sync-videos.ts`** — cada 6 horas + al arrancar API
   - Patrón idéntico a `sync-feeds.ts`

5. **Seed 20+ VideoSources** cubriendo los 8 deportes:
   - Football: La Liga, FC Barcelona, Real Madrid, Premier League, UEFA Champions League
   - Basketball: NBA, EuroLeague
   - Tennis: ATP Tour, WTA, Roland Garros
   - Formula 1: F1 Official
   - Swimming: World Aquatics
   - Cycling: GCN en Español, Tour de France
   - Padel: Premier Padel, World Padel Tour
   - Athletics: World Athletics, Olympics

6. **Endpoints API** (espejo de gestión de fuentes RSS):
   - `GET /api/reels/fuentes/listado` — sources activas
   - `GET /api/reels/fuentes/catalogo` — catálogo completo con conteos por deporte
   - `POST /api/reels/fuentes/custom` — añadir canal/playlist YouTube personalizado
   - `DELETE /api/reels/fuentes/custom/:id` — eliminar fuente custom
   - `POST /api/reels/sincronizar` — sync manual de vídeos

7. **Filtrar reels por `safetyStatus: 'approved'`** en endpoint existente GET /api/reels
8. **Ordenar por `publishedAt` desc** (vídeos más recientes primero)

### Notas técnicas

- YouTube RSS: `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID`
- Devuelve ~15 últimos vídeos en formato Atom, parseable con rss-parser
- Gratis, sin API key, sin límite de requests
- Los seed reels existentes no se rompen (campos nuevos son nullable o tienen defaults)
- No requiere cambios en frontend (mismo formato `youtube_embed`)

### Estimación: 2-3 días

---

## Feature 2: Configuración de Locale/País del Usuario (MEDIA)

### Problema

El locale de la app está hardcodeado en localStorage (default español). No hay forma de que el usuario configure idioma/país durante el onboarding. El contenido mostrado no se filtra por idioma del usuario.

### Solución

Persistir locale y país en el modelo User, selector en onboarding, y filtrado de contenido por idioma.

### Alcance

1. **Extender modelo `User`** en Prisma:
   - `country String @default("ES")` — país del usuario (ya existe `locale`)

2. **Onboarding — selector de idioma** en Step 1:
   - Selector visual de idioma (Español/English) junto al nombre y edad
   - El locale seleccionado determina: UI, fuentes RSS priorizadas, idioma de resúmenes AI, idioma de quiz

3. **Filtrado de contenido por idioma**:
   - Priorizar noticias de fuentes RSS cuyo `language` coincida con el `locale` del usuario
   - `RssSource.language` ya existe — usar para scoring en feed-ranker
   - Lo mismo para VideoSources cuando se implemente

4. **Componentes afectados**:
   - Modelo User (Prisma migration)
   - `OnboardingWizard.tsx` (web) + `Onboarding.tsx` (mobile) — step 1
   - `UserProvider` / `user-context.tsx` — sync locale desde servidor
   - `HomeFeedClient.tsx` / `HomeFeed.tsx` — pasar locale a API
   - Quiz generation — generar en idioma del usuario
   - Summary generation — generar en idioma del usuario

### Estimación: 1 día

---

## Feature 3: Ingesta Alternativa — Google News RSS (MEDIA)

### Problema

Varios medios deportivos españoles no tienen RSS:
- estadiodeportivo.com
- muchodeporte.com
- eldesmarque.com
- elcorreodeandalucia.com (elcorreoweb.es)

### Solución

Usar Google News RSS como workaround inmediato (zero dependencias nuevas, usa infraestructura RSS existente). Opcionalmente, implementar scraper con Cheerio a largo plazo.

### Alcance

1. **Google News RSS** (fase 1 — inmediato):
   - Formato: `https://news.google.com/rss/search?q=site:estadiodeportivo.com+deportes&hl=es&gl=ES`
   - Añadir como RssSources normales en el seed
   - Funciona con el agregador RSS existente sin cambios

2. **Scraper con Cheerio** (fase 2 — largo plazo):
   - Nuevo servicio `apps/api/src/services/scraper.ts`
   - CSS selectors configurables por fuente (título, resumen, imagen, enlace)
   - Añadir campo `ingestMethod` a `RssSource`: `'rss'` | `'scraper'` | `'api'`
   - Integrar en el cron de sync-feeds

3. **News API aggregators** (fase 3 — producción):
   - NewsAPI.org, GNews.io, Mediastack como fallback de pago
   - Servicio `news-api-client.ts` con abstracción multi-provider

### Estimación: 0.5 días (Google News RSS) + 1-2 días (Cheerio)

---

## Feature 4: Seguridad — PIN Lockout + Rate Limiting (MEDIA)

### Problema

- El PIN parental no tiene protección contra fuerza bruta (un niño puede probar PINs infinitos)
- Los endpoints API no tienen rate limiting (vulnerable a abuso)

### Alcance

1. **PIN Lockout tras 5 intentos fallidos**:
   - Añadir campos a `ParentalProfile`: `failedAttempts Int @default(0)`, `lockedUntil DateTime?`
   - En `POST /api/parents/verificar-pin`: incrementar contador al fallar, lockout 15 min tras 5 fallos
   - Reset contador al verificar correctamente
   - Mostrar mensaje kid-friendly: "Demasiados intentos. Espera 15 minutos."
   - Componente `PinInput` muestra countdown cuando locked

2. **Rate Limiting en API**:
   - Instalar `express-rate-limit`
   - Límites por endpoint:
     - Auth (login/register): 5 req/min por IP
     - PIN verification: 10 req/min por IP
     - Content (news/reels/quiz): 60 req/min por IP
     - Sync manual: 2 req/min por IP
   - Respuesta 429 con mensaje amigable

### Estimación: 0.5-1 día

---

## Feature 5: Soporte Multi-plataforma en Reels (BAJA)

### Problema

Todos los reels son YouTube embeds. Para diversificar contenido, soportar Instagram y TikTok embeds.

### Alcance

1. **ReelCard multi-plataforma** — detectar `videoType` y renderizar:
   - `youtube_embed` → iframe YouTube (ya implementado)
   - `instagram_embed` → Instagram oEmbed (`api.instagram.com/oembed?url=...`)
   - `tiktok_embed` → TikTok oEmbed (`tiktok.com/oembed?url=...`)
   - `mp4` → tag `<video>` nativo (ya implementado)

2. **Ampliar VideoSource.platform**:
   - Añadir `'instagram_account'` y `'manual'` como tipos
   - Instagram/TikTok solo como curación manual (no discovery automático)

### Dependencia: Feature 1 (Video Aggregator) debe estar implementada primero.

### Estimación: 1-2 días

---

## Feature 6: Mejora del Feed Algorítmico (BAJA)

### Problema

El feed ranker actual (`feed-ranker.ts`) usa pesos estáticos (+5 equipo, +3 deporte). Las señales de comportamiento del `ActivityLog` no se aprovechan al máximo.

### Alcance

1. **Señales de comportamiento enriquecidas**:
   - Deportes más leídos (peso basado en frecuencia de ActivityLog)
   - Fuentes más clicadas (boost a fuentes preferidas)
   - Decay temporal (noticias recientes valen más)
   - Penalización por contenido ya visto

2. **Modelo de scoring actualizado**:
   - Base: +5 equipo favorito, +3 deporte favorito
   - Behavioral: +2 deporte frecuente, +1 fuente frecuente
   - Temporal: multiplicador de frescura (1.0 → 0.5 en 48h)
   - Already-read: -3 si ya fue vista

### Estimación: 1-2 días

---

## Feature 7: Preparación para Producción (MEDIA)

### Problema

El stack actual (SQLite, InMemoryCache, sin OAuth) no es apto para producción multi-usuario.

### Alcance

1. **Migración a PostgreSQL**:
   - `docker-compose.yml` y `migrate-to-postgres.sh` ya existen
   - Cambiar JSON strings a arrays nativos de PostgreSQL
   - Probar todas las queries con PostgreSQL
   - Documentar proceso de migración

2. **Redis para caché**:
   - `InMemoryCache` ya tiene interfaz abstracta (Redis-ready)
   - Implementar `RedisCache` como alternativa
   - Configurar via variable de entorno `CACHE_PROVIDER=memory|redis`

3. **OAuth / Social Login**:
   - JWT + email/password ya implementado
   - Añadir: Google, Apple (mínimo para app stores)
   - Opciones: NextAuth.js (web) + Expo AuthSession (mobile), o Clerk/Auth0

4. **Consistencia de rutas API**:
   - Rutas de news/parents en español, quiz/reels/users en inglés
   - Definir convención y migrar (breaking change, necesita versionado o redirects)

### Estimación: 1-2 semanas (total)

---

## Feature 8: Expansión de Tests (MEDIA)

### Problema

Hay 14 archivos de test con 135 tests (Vitest), pero la cobertura se concentra en servicios. Faltan tests de integración para rutas API y componentes frontend.

### Alcance

1. **Tests de integración API**:
   - Tests para cada ruta con supertest
   - Cubrir: auth flows, parental guard, feed ranking, video sync
   - Casos edge: rate limiting, PIN lockout, content moderation

2. **Tests de componentes web**:
   - React Testing Library para componentes clave
   - Cubrir: OnboardingWizard, QuizGame, ParentalPanel, ReelCard

3. **Tests E2E** (futuro):
   - Playwright para flujos críticos: onboarding → leer noticia → quiz → colección

### Estimación: 1-2 semanas (ongoing)

---

## Resumen de prioridades

| # | Feature | Prioridad | Estimación | Dependencias |
|---|---------|-----------|------------|--------------|
| 1 | Video Aggregator (Reels dinámicos) | **ALTA** | 2-3 días | Ninguna |
| 2 | User Locale/País | MEDIA | 1 día | Ninguna |
| 3 | Google News RSS (ingesta alternativa) | MEDIA | 0.5-2 días | Ninguna |
| 4 | PIN Lockout + Rate Limiting | MEDIA | 0.5-1 día | Ninguna |
| 5 | Multi-plataforma Reels | BAJA | 1-2 días | Feature 1 |
| 6 | Feed Algorítmico mejorado | BAJA | 1-2 días | Ninguna |
| 7 | Preparación Producción (PG, Redis, OAuth) | MEDIA | 1-2 sem | Ninguna |
| 8 | Expansión de Tests | MEDIA | 1-2 sem | Ongoing |

### Orden recomendado de implementación

1. **Feature 1** (Video Aggregator) — mayor impacto para beta con familias
2. **Feature 4** (PIN Lockout + Rate Limiting) — seguridad crítica para app de niños
3. **Feature 2** (User Locale) — mejora UX para beta
4. **Feature 3** (Google News RSS) — más contenido
5. **Feature 6** (Feed Algorítmico) — personalización
6. **Feature 5** (Multi-plataforma Reels) — diversificación
7. **Feature 7** (Producción) — antes de lanzamiento público
8. **Feature 8** (Tests) — ongoing en paralelo
