# SportyKids — Features Diferenciadoras (Fase 5+)

## Objective

Transformar SportyKids de un agregador de noticias deportivas para ninos en un **producto adaptativo** (Netflix + TikTok + escuela) que aprende del nino, adapta el contenido automaticamente y esta controlado por los padres. El diferencial: contenido seguro, lenguaje adaptado por edad, gamificacion adictiva y resumenes con IA.

## Background

El MVP (Fases 0-4) ya tiene: feed de noticias RSS, reels (placeholders), quiz (15 preguntas estaticas), control parental basico y onboarding. Funciona, pero no se diferencia del mercado. Las oportunidades clave son:

- **No existe** una app de noticias deportivas pensada para ninos
- Los padres quieren un entorno **sin apuestas, sin toxicidad, sin polemicas**
- Los ninos consumen contenido tipo **TikTok/Reels** — formato corto es rey
- La **gamificacion** (cromos, rachas, puntos) genera engagement brutal en este rango de edad
- La **IA** permite adaptar lenguaje y generar contenido fresco automaticamente

## Vision del producto

Una app que:
- Aprende del nino (edad + gustos deportivos)
- Adapta el contenido automaticamente (lenguaje + formato)
- Controlada por padres (tiempo, contenido, nivel educativo)
- Segura por diseno (filtrado AI, sin apuestas, sin toxicidad)

---

## What needs to change

### Milestone 1: Infraestructura AI + Seguridad de Contenido

**Objetivo**: Integrar Claude API y filtrar contenido inapropiado automaticamente.

#### 1.1. Integracion con Claude API
- Nueva dependencia: `@anthropic-ai/sdk` en `apps/api/`
- Nuevo servicio: `apps/api/src/services/ai-client.ts` — singleton del cliente Anthropic con configuracion de modelo y rate limiting basico
- Variables de entorno: `ANTHROPIC_API_KEY`, `AI_MODEL_MODERATION` (default: `claude-haiku-4-5-20251001`), `AI_MODEL_GENERATION` (default: `claude-sonnet-4-6`)

#### 1.2. Moderacion automatica de contenido
- Nuevo servicio: `apps/api/src/services/content-moderator.ts` — clasifica cada noticia como safe/unsafe con categoria (apuestas, violencia, polemica toxica)
- Migracion Prisma: anadir a `NewsItem`:
  - `safetyStatus` (String: `"pending"` | `"approved"` | `"rejected"`, default `"pending"`)
  - `safetyReason` (String, opcional)
- Modificar `apps/api/src/services/aggregator.ts`: tras `classifyNews()`, llamar al moderador antes del upsert
- Modificar `apps/api/src/routes/news.ts`: filtrar por `safetyStatus: "approved"` por defecto

#### 1.3. Catalogo de fuentes RSS configurable
El sistema ya tiene `RssSource` en Prisma (url, name, sport, active). Se amplía:
- **Catalogo predefinido amplio**: lista curada de las principales fuentes de prensa deportiva por deporte y pais (AS, Marca, Mundo Deportivo, Sport, ESPN, BBC Sport, L'Equipe, Gazzetta, etc.). Seed con 30-50 fuentes.
- Anadir campos a `RssSource`: `country` (String), `language` (String), `logoUrl` (String), `description` (String), `category` (String: "general", "football", "basketball", "motorsport", etc.)
- **Seleccion en onboarding**: durante el paso 4 (feeds), mostrar el catalogo completo agrupado por deporte, con logos y descripcion. El padre/nino selecciona las fuentes que quiere.
- **Modificable despues**: desde la vista de configuracion parental (protegida por PIN, ver M5), se pueden anadir/quitar fuentes en cualquier momento.
- Las fuentes seleccionadas se guardan en `User.selectedFeeds` (ya existe el campo).
- El aggregator solo sincroniza fuentes activas Y seleccionadas por el usuario.
- Nueva ruta: `GET /api/news/fuentes/catalogo` — devuelve todas las fuentes disponibles con metadata (distinta de `/fuentes/listado` que solo devuelve las activas del usuario)

#### 1.4. Contenido filtrado
Filtrar automaticamente:
- Apuestas y casas de apuestas
- Violencia y agresiones
- Polemicas toxicas (insultos, racismo, dopaje)
- Contenido sexual o inapropiado

Las noticias rechazadas se guardan (para auditoria parental) pero no se muestran a ninos.

**Coste AI estimado**: ~3K tokens/hora (100 tokens/noticia x 30 noticias/sync). Negligible con Haiku.

---

### Milestone 2: Contenido Adaptado por Edad — "Explicamelo Facil"

**Objetivo**: Generar resumenes automaticos adaptados al rango de edad del nino. El boton estrella: "Explicamelo facil".

#### 2.1. Sistema de adaptacion por edad

El contenido se adapta segun tres perfiles:

| Edad | Estilo | Formato principal | Ejemplo |
|------|--------|-------------------|---------|
| **6-8** | Frases cortas, tipo cuento, explicaciones magicas | Mas video que texto | "Un jugador estaba mas cerca de la porteria que el balon cuando recibio el pase" |
| **9-12** | Noticias resumidas, explicaciones simples de reglas, mini curiosidades | Texto + video equilibrado | "El fuera de juego es cuando un jugador esta mas adelantado que el ultimo defensa al recibir el pase" |
| **13-16** | Similar a adulto, con stats, fichajes, contexto tactico | Texto con datos | "Fuera de juego posicional en el minuto 78 — el VAR confirmo por 12cm" |

#### 2.2. Resumenes AI por rango de edad
- Nuevo servicio: `apps/api/src/services/summarizer.ts` — genera resumen adaptado recibiendo titulo + contenido + ageRange
- Nuevo modelo Prisma: `NewsSummary` (newsItemId + ageRange + summary, unique constraint)
- 3 resumenes por noticia (uno por rango de edad), generados tras la moderacion
- Generacion en background para no bloquear el sync de RSS

#### 2.3. Boton "Explicamelo facil"
- Nueva ruta: `GET /api/news/:id/summary?age=10` — devuelve resumen del rango correspondiente
- Nuevo componente: `AgeAdaptedSummary.tsx` — panel expandible con resumen adaptado
- Modificar `NewsCard.tsx`: anadir boton con icono de bombilla/varita magica
- Al pulsar: fetch del resumen, mostrar con animacion, indicador "adaptado para tu edad"

#### 2.4. Modo "explicado" para conceptos deportivos
Cuando la noticia menciona conceptos como "fuera de juego", "tiro libre indirecto", "safety car":
- El resumen incluye una mini-explicacion inline
- Ejemplo: *"Fuera de juego polemico"* → *"Un jugador estaba mas cerca de la porteria que el balon cuando recibio el pase. Eso no esta permitido y el gol no conto."*

**Coste AI estimado**: ~45K tokens/dia (500 tokens/resumen x 3 rangos x 30 noticias/dia). Razonable con Haiku.

---

### Milestone 3: Quiz Dinamico desde Noticias Reales

**Objetivo**: Reemplazar las preguntas estaticas por un quiz diario generado automaticamente desde las noticias del dia.

#### 3.1. Generador de preguntas AI
- Nuevo servicio: `apps/api/src/services/quiz-generator.ts` — recibe NewsItem + ageRange, genera pregunta + 4 opciones + respuesta correcta via Claude
- Validacion con Zod del output JSON del LLM
- Preguntas vinculadas a la noticia fuente (`relatedNewsId`)

#### 3.2. Quiz del dia
- Nuevo job: `apps/api/src/jobs/generate-daily-quiz.ts` — cron diario (6:00 AM), genera 10-15 preguntas de las noticias recientes
- Migracion: anadir `generatedAt`, `ageRange`, `expiresAt` a `QuizQuestion`
- Modificar ruta quiz: priorizar preguntas del dia sobre las del seed

#### 3.3. Experiencia de quiz mejorada
- Indicador "Quiz del dia" en la UI
- Link a la noticia relacionada tras responder
- Preguntas tipo: *"Quien marco mas goles ayer?"*, *"Que equipo gano la Champions?"*

**Coste AI estimado**: ~6K tokens/dia. Negligible. Usar Sonnet para mejor calidad de preguntas.

---

### Milestone 4: Gamificacion — Cromos, Rachas y Logros

**Objetivo**: Sistema de engagement con coleccion digital, rachas diarias y logros desbloqueables.

#### 4.1. Cromos/stickers digitales
- Nuevos modelos: `Sticker` (name, imageUrl, sport, team, rarity) + `UserSticker` (userId, stickerId, source, obtainedAt)
- Rarezas: common, rare, epic, legendary
- 30-40 cromos iniciales: iconos de deportes, escudos de equipos, jugadores celebres
- Se obtienen por: rachas, quiz perfecto, logros, login diario

#### 4.2. Rachas diarias (streaks)
- Anadir a `User`: `currentStreak`, `longestStreak`, `lastActiveDate`
- Nuevo servicio: `apps/api/src/services/gamification.ts` — logica de rachas, evaluacion de logros, otorgamiento de cromos
- Indicador visual de racha (fuego/estrellas) en la UI

#### 4.3. Logros/achievements
- Nuevos modelos: `Achievement` (key, threshold, type, rewardStickerId) + `UserAchievement`
- 15-20 logros predefinidos: "Primera lectura", "Racha de 7 dias", "Quiz perfecto", "50 noticias leidas"
- Notificacion toast al desbloquear

#### 4.4. Album de cromos
- Nueva pagina: `/collection` — grid visual con cromos obtenidos (color) y pendientes (gris)
- Progreso por deporte/equipo
- Componentes: `StickerAlbum`, `AchievementBadge`, `StreakCounter`, `RewardToast`

**Recompensas por accion:**

| Accion | Puntos | Cromo |
|--------|--------|-------|
| Leer noticia | +5 | — |
| Ver reel | +3 | — |
| Quiz correcto | +10 | — |
| Quiz perfecto (5/5) | +50 | Random rare |
| Racha 7 dias | +100 | Cromo epic |
| Racha 30 dias | +500 | Cromo legendary |
| Login diario | +2 | Random common (1/dia) |

---

### Milestone 5: Control Parental Robusto

**Objetivo**: Migrar restricciones al backend, mejorar tracking e informes. Establecer un flujo claro de configuracion inicial + modificacion posterior protegida por PIN.

#### 5.1. Flujo de configuracion parental

**Principio clave**: la configuracion del nino la hace el padre **una sola vez al inicio** (onboarding). Despues, cualquier modificacion se hace desde una **vista de configuracion protegida por PIN**.

**Flujo de onboarding (primera vez):**
1. El padre instala la app y crea el perfil del nino (nombre, edad, deportes)
2. Selecciona fuentes RSS del catalogo (M1.3)
3. Configura restricciones: formatos permitidos (news/reels/quiz), tiempo diario, deportes
4. Crea el PIN de 4 digitos
5. Listo — el nino ya puede usar la app

**Flujo de modificacion (posterior):**
1. Desde el tab "Padres" (ya existe), introducir PIN
2. Accede a vista de configuracion completa con secciones:
   - **Perfil del nino**: edad, nombre (editable)
   - **Fuentes RSS**: anadir/quitar del catalogo
   - **Deportes**: activar/desactivar deportes en el feed
   - **Restricciones**: formatos, tiempo diario, nivel educativo
   - **Actividad**: informes y estadisticas (ver 5.4)
   - **PIN**: cambiar PIN
3. Todos los cambios requieren PIN activo (sesion de 5 minutos tras verificar)

#### 5.2. Validacion en backend
- Nuevo middleware: `apps/api/src/middleware/parental-guard.ts` — verifica formato permitido, tiempo diario, deportes permitidos
- Aplicar a rutas de news, reels y quiz — retorna 403 si no cumple
- El frontend muestra mensaje amigable al nino: "Has alcanzado tu limite de hoy. Vuelve manana!"

#### 5.3. PIN seguro
- Migrar de SHA-256 a bcrypt (`bcryptjs`)
- Migracion transparente: al verificar PIN SHA-256 existente, re-hashear con bcrypt
- Sesion temporal de 5 minutos tras verificar PIN (no pedir en cada accion de config)

#### 5.4. Tracking de tiempo real
- Ampliar `ActivityLog`: `durationSeconds`, `contentId`, `sport`
- Frontend envia duracion de sesion (time-on-screen)

#### 5.5. Panel de informes para padres
- **Controles**: tiempo de uso diario, tipo de contenido (news/reels/quiz), nivel educativo, deportes permitidos
- **Informes**: grafico semanal de uso (barras por dia), desglose por formato, contenido mas visto, alertas de limite
- Nuevo componente: `ActivityChart.tsx` — barras CSS (sin libreria externa)
- Nueva ruta: `GET /api/parents/actividad/:userId/detalle?from=&to=`

---

### Milestone 6: Feed Inteligente + Equipo Favorito Enriquecido + Reels Mejorados

**Objetivo**: Feed personalizado inteligente, experiencia de equipo favorito completa y reels tipo TikTok.

#### 6.1. Feed personalizado inteligente
- Si el nino solo sigue futbol → no meter Formula 1 porque si
- Feed mixto inteligente para multideporte: ponderado por preferencias
- Tres formatos de feed:
  - **Titulares** (estilo Google News): tarjetas rapidas — "El Madrid gano 3-1", "Mbappe marco doblete". Ideal para ninos mayores/padres
  - **Reels** (estilo TikTok): videos cortos de goles, jugadas, mini resumenes. Principal formato para ninos pequenos
  - **Modo explicado**: boton "Explicamelo facil" (Milestone 2)

#### 6.2. Equipo favorito enriquecido
- Nuevo servicio: `apps/api/src/services/team-stats.ts` — estadisticas basicas (posicion liga, ultimos resultados) via API gratuita o scraping con cache
- Nuevo modelo: `TeamStats` (teamName, leaguePosition, recentResults JSON, updatedAt)
- Feed dedicado del equipo: noticias + resumenes AI + reels
- Componentes: `TeamStatsCard` (posicion, racha, ultimos resultados con iconos V/D/E)

#### 6.3. Reels tipo TikTok
- Feed vertical con snap scrolling (swipe up/down)
- Auto-play al entrar en viewport (IntersectionObserver)
- Controles propios: like, compartir
- Anadir a `Reel`: `videoType`, `aspectRatio`, `previewGifUrl`
- Componentes: `ReelPlayer`, `VerticalFeed`

#### 6.4. Concepto de notificaciones
- Campo `pushSubscription` en User
- Endpoint `POST /api/users/:id/notifications/subscribe`
- MVP: solo registrar preferencia. Push real (service worker, FCM) para produccion

---

## Dependencias entre milestones

```
M1 (AI + Seguridad) ──┬──> M2 (Resumenes por edad)
                       ├──> M3 (Quiz dinamico)
                       └──> M5 (Parental robusto)

M2 (Resumenes) ───────────> M6 (Feed inteligente + Equipo + Reels)

M4 (Gamificacion) ── independiente (puede ir en paralelo con M2/M3)
```

**Orden recomendado**: M1 → M2 → M3 → M4 → M5 → M6

**Con 2 desarrolladores**: Tras M1, hacer M2+M4 en paralelo, luego M3+M5 en paralelo, finalmente M6.

## Resumen de impacto

| Milestone | Modelos nuevos | Rutas nuevas | Servicios nuevos | Componentes UI |
|-----------|---------------|-------------|------------------|---------------|
| M1: AI + Seguridad | 0 (campos) | 0 (modifica) | 2 (ai-client, moderator) | 0 |
| M2: Resumenes | 1 (NewsSummary) | 1 | 1 (summarizer) | 2 (AgeAdaptedSummary, boton) |
| M3: Quiz dinamico | 0 (campos) | 0 (modifica) | 1 + 1 job | 1 (modifica QuizGame) |
| M4: Gamificacion | 4 (Sticker, UserSticker, Achievement, UserAchievement) | 4 | 1 (gamification) | 5 + 1 pagina |
| M5: Parental robusto | 0 (campos) | 1 | 1 middleware | 2 (ActivityChart, panel mejorado) |
| M6: Feed + Equipo + Reels | 1 (TeamStats) | 3 | 1 (team-stats) | 4 (TeamStatsCard, ReelPlayer, VerticalFeed, feed inteligente) |

## Coste AI total estimado

| Servicio | Modelo | Tokens/dia | Coste aprox/mes |
|----------|--------|-----------|----------------|
| Moderacion | Haiku | ~3K/hora (~72K/dia) | < $1 |
| Resumenes | Haiku | ~45K | < $2 |
| Quiz | Sonnet | ~6K | < $1 |
| **Total** | — | **~120K/dia** | **< $5/mes** |

## Affected files (principales)

### New files
- `apps/api/src/services/ai-client.ts` — Cliente Anthropic singleton
- `apps/api/src/services/content-moderator.ts` — Moderacion de contenido
- `apps/api/src/services/summarizer.ts` — Resumenes adaptados por edad
- `apps/api/src/services/quiz-generator.ts` — Generacion de preguntas desde noticias
- `apps/api/src/services/gamification.ts` — Logica de rachas, logros, cromos
- `apps/api/src/services/team-stats.ts` — Estadisticas de equipos
- `apps/api/src/jobs/generate-daily-quiz.ts` — Cron diario de quiz
- `apps/api/src/middleware/parental-guard.ts` — Validacion parental en backend
- `apps/web/src/components/AgeAdaptedSummary.tsx` — Resumen expandible
- `apps/web/src/components/StickerAlbum.tsx` — Album de cromos
- `apps/web/src/components/ActivityChart.tsx` — Grafico de actividad
- `apps/web/src/components/ReelPlayer.tsx` — Reproductor mejorado
- `apps/web/src/components/VerticalFeed.tsx` — Feed tipo TikTok
- `apps/web/src/app/collection/page.tsx` — Pagina de coleccion

### Modified files
- `apps/api/prisma/schema.prisma` — Nuevos modelos y campos en todos los milestones
- `apps/api/src/services/aggregator.ts` — Inyectar moderacion y resumenes en pipeline
- `apps/api/src/routes/news.ts` — Filtro de seguridad, ruta de resumen
- `apps/api/src/routes/quiz.ts` — Quiz dinamico
- `apps/api/src/routes/parents.ts` — bcrypt, informes detallados
- `apps/api/src/index.ts` — Registrar nuevos jobs y rutas
- `apps/web/src/components/NewsCard.tsx` — Boton "Explicamelo"
- `apps/web/src/components/QuizGame.tsx` — Quiz del dia
- `apps/web/src/app/team/page.tsx` — Estadisticas de equipo
- `apps/web/src/app/reels/page.tsx` — Feed vertical TikTok
- `packages/shared/src/types/index.ts` — Nuevos tipos
- `packages/shared/src/constants/index.ts` — Nuevas constantes
- `packages/shared/src/i18n/es.json` — Traducciones nuevas
- `packages/shared/src/i18n/en.json` — Traducciones nuevas

## Out of scope (anotado para futuro)

### "Modo entrenador/padre" — Resumen semanal inteligente
Resumen semanal generado por IA tipo:
> "Tu hijo ha aprendido sobre futbol, ha visto 10 videos y ha completado 3 quizzes. Esta semana le intereso especialmente el baloncesto — quizas quiera probar un campus de verano."

- Enviado por email o push notification a padres
- Incluye: deportes explorados, tiempo de uso, progreso en quiz, cromos obtenidos, racha
- Tono: positivo, educativo, como un tutor deportivo
- Requiere: M4 (gamificacion) + M5 (tracking detallado) completados
- Potencial: notificaciones push reales (service worker web, FCM mobile)

### Otras ideas futuras anotadas
- **Modo social**: compartir cromos con amigos (con aprobacion parental)
- **Ligas de quiz**: competir con amigos/clase en quizzes semanales
- **Contenido educativo**: reglas de deportes explicadas como mini-cursos
- **Integracion con colegios**: dashboard para profesores de educacion fisica

---

## Notes

- **Prioridad absoluta**: M1 (seguridad) porque es fundacional y diferencial para padres
- **Mayor impacto en UX**: M2 (Explicamelo facil) — diferencial brutal, no existe en el mercado
- **Mayor engagement**: M4 (gamificacion) — cromos + rachas = retencion
- **Los reels** (M6) son donde esta "el oro" para ninos pequenos, pero requiere contenido real (no solo YouTube embeds). Considerar integracion con APIs de highlights deportivos o generacion de clips
- **El feed inteligente** (M6) es clave: "si el nino solo sigue futbol, no le metas F1 porque si"
- **Modelo AI**: Haiku para clasificacion/resumenes (rapido, barato), Sonnet para generacion de quiz (requiere mas razonamiento)
- **SQLite → PostgreSQL**: Deberia hacerse antes o durante M4 (gamificacion anade muchas relaciones)
- Todo el codigo en ingles, UI con i18n (es/en). Valores de deporte en ingles.
