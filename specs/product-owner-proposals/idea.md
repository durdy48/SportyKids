# SportyKids — Product Owner: Propuestas para un producto exquisito

## Visión

SportyKids tiene un MVP sólido (Fases 0-4 + Phase 5 M1-M6). Para ser un producto **irresistible en el mercado** y diferenciarse como LA app de deportes para niños, necesita pasar de "funcional" a "premium".

**Filosofía**:
- **Simplicidad absoluta** — un niño de 6 años lo entiende sin ayuda
- **Control parental total** — los padres se sienten 100% seguros
- **Delight visual** — el niño QUIERE abrir la app cada día

## Backlog existente (no duplicar)

Ya documentados en `specs/phase-5-differentiators/`:
- `backlog-scraping.md` — Ingesta alternativa para fuentes sin RSS
- `backlog-user-locale.md` — Configuración de idioma/país del usuario
- `backlog-multi-source-reels.md` — Reels de múltiples plataformas
- `backlog-video-aggregator.md` — Agregador de vídeos dinámico (YouTube RSS)

---

## 1. UX/UI Polish — "De funcional a premium"

### B-UX1: Skeleton Loading (reemplazar spinners)
- **Prioridad**: P0 | **Esfuerzo**: M (3-5 días)
- **Qué**: Reemplazar todos los spinners/texto "Cargando..." por skeletons con shimmer que replican la forma del contenido (cards en Home, grid en Collection, barras en Quiz). Los niños interpretan spinners como "roto".
- **Dónde**: `HomeFeedClient.tsx`, `collection/page.tsx`, `quiz/page.tsx`, `team/page.tsx`, todas las screens mobile
- **Impacto**: Percepción de velocidad 3x mejor. Primera impresión premium.

### B-UX2: Animaciones de celebración (stickers, logros, rachas)
- **Prioridad**: P0 | **Esfuerzo**: M (3-5 días)
- **Qué**: Confetti al ganar un sticker, glow + shake al desbloquear logro, animación de fuego en hitos de racha. Actualmente `RewardToast` es un card estático. Sin celebración, la gamificación es invisible.
- **Dónde**: `RewardToast.tsx`, `StickerCard.tsx`, `StreakCounter.tsx` + librería ligera (canvas-confetti ~3KB)
- **Impacto**: El loop de dopamina. Sin esto, los stickers no generan emoción.

### B-UX3: Transiciones entre páginas
- **Prioridad**: P1 | **Esfuerzo**: S (1-2 días)
- **Qué**: Fade-in/slide-up al montar cada página. Actualmente las páginas "saltan" sin transición. CSS `@keyframes` en wrapper principal. En mobile, transiciones nativas de React Navigation.
- **Impacto**: Sensación de app viva vs. "páginas que cambian".

### B-UX4: Modo oscuro
- **Prioridad**: P1 | **Esfuerzo**: M (3-5 días)
- **Qué**: Tema oscuro respetando `prefers-color-scheme`. Los tokens CSS (`--color-background`, `--color-text`) ya están preparados. Añadir capa `dark:` en Tailwind. Toggle en NavBar.
- **Impacto**: Padres de noche + niños 12-14 que prefieren dark mode. Expectativa estándar 2026.

### B-UX5: Empty states con ilustraciones y CTAs
- **Prioridad**: P1 | **Esfuerzo**: S (1-2 días)
- **Qué**: Empty states actuales = emoji + texto genérico. Crear ilustraciones SVG kid-friendly con CTAs contextuales. Ej: colección vacía -> "Juega al quiz para ganar tu primer cromo!" + botón a `/quiz`.
- **Impacto**: Nuevos usuarios entienden qué hacer. Reduce abandono en primeros minutos.

### B-UX6: Feedback visual en PIN
- **Prioridad**: P1 | **Esfuerzo**: S (1-2 días)
- **Qué**: `PinInput` muestra cajas que se llenan con dots pero sin feedback visual. Añadir scale + pulse de borde al llenar cada dígito, y shake al PIN incorrecto. Solo CSS.
- **Impacto**: El PIN es la puerta al control parental — debe sentirse responsivo y seguro.

### B-UX7: Mensajes de error kid-friendly
- **Prioridad**: P2 | **Esfuerzo**: S (1-2 días)
- **Qué**: Errores actuales son genéricos. Componente `ErrorState` con mensajes adaptados: "Oops, el balón se fue fuera! Inténtalo de nuevo." + botón retry. Mapear HTTP errors a claves i18n.
- **Impacto**: Un niño de 7 años nunca debería ver un mensaje técnico.

### B-UX8: Haptic feedback en mobile
- **Prioridad**: P2 | **Esfuerzo**: S (1-2 días)
- **Qué**: Vibración sutil (Expo Haptics) al responder quiz, coleccionar sticker, hacer check-in, y like/share en reels.
- **Impacto**: Detalle que separa "app nativa" de "web en wrapper".

---

## 2. Engagement y Retención — "Que vuelvan cada día"

> Filosofía: obsesión con el engagement del niño. Simplificar brutalmente.

### B-EN1: Misión del día / Daily Challenge
- **Prioridad**: P0 | **Esfuerzo**: L (1-2 semanas)
- **Qué**: Misiones diarias: "Lee 2 noticias + haz el quiz" = sticker raro. Usa `ActivityLog` existente + gamificación. **LA razón para abrir la app cada día.**
- **Dónde**: Modelo `DailyMission`, servicio `mission-generator.ts`, componente `MissionCard` en Home
- **Impacto**: **Palanca de retención #1**. Sin esto no hay retención.

### B-EN2: Favoritos (bookmark simple)
- **Prioridad**: P1 | **Esfuerzo**: S (1-2 días)
- **Qué**: Un corazón, un tap, guardado. Sin página nueva — solo sección "Guardados" en Home. Mínimo viable.
- **Dónde**: `NewsCard.tsx`, `HeadlineRow.tsx`, localStorage/AsyncStorage
- **Impacto**: "Quiero enseñarle a papá esta noticia de Mbappé."

### B-EN3: Badge "Trending"
- **Prioridad**: P1 | **Esfuerzo**: S (1-2 días)
- **Qué**: Un chip en la card. Noticias vistas >X veces en 24h via `ActivityLog`. Cero complejidad, máximo FOMO.
- **Impacto**: Social proof. "Todos leen sobre la final de Champions."

### B-EN4: Historial de lectura
- **Prioridad**: P2 | **Esfuerzo**: S (1-2 días)
- **Qué**: "Leído recientemente" debajo del feed. Query sobre datos que ya existen en `ActivityLog`.
- **Impacto**: "Esa noticia que leí ayer de Alcaraz..."

---

## 3. Confianza Parental — "Los padres se sienten 100% seguros"

### B-PT1: Digest semanal para padres (email/PDF)
- **Prioridad**: P0 | **Esfuerzo**: L (1-2 semanas)
- **Qué**: Email o PDF descargable semanal: tiempo/día, categorías consumidas, quiz performance, resumen de moderación. Los datos ya existen — esto es presentación.
- **Impacto**: **Diferenciador clave**. Transparencia proactiva sin esfuerzo del padre. Ninguna app de niños lo hace bien.

### B-PT2: Modo "Ver lo que ve mi hijo"
- **Prioridad**: P0 | **Esfuerzo**: M (3-5 días)
- **Qué**: Botón "Vista previa" en control parental que muestra el feed exacto que ve el niño con restricciones actuales. Reutiliza componentes del feed.
- **Impacto**: Nada genera más confianza que "míralo tú mismo". Diferenciador vs. competidores.

### B-PT3: Límites de tiempo granulares (por tipo de contenido)
- **Prioridad**: P1 | **Esfuerzo**: M (3-5 días)
- **Qué**: Hoy hay un solo `maxDailyTimeMinutes` global. Permitir: 30 min noticias, 15 min reels, 10 min quiz. `parental-guard.ts` ya comprueba tipo — extender. Tres sliders en restricciones.
- **Impacto**: "Que lea noticias pero no 2 horas de reels." Necesidad real de padres.

### B-PT4: Horario / Bloqueo nocturno
- **Prioridad**: P1 | **Esfuerzo**: M (3-5 días)
- **Qué**: Sin acceso antes de las 7am o después de las 9pm. `allowedHoursStart`/`allowedHoursEnd` en `ParentalProfile`. Enforced en `parental-guard.ts`. `LimitReached` con tema "hora de dormir".
- **Impacto**: Feature #1 más pedida en apps para niños.

### B-PT5: Botón de reportar contenido (para niños)
- **Prioridad**: P1 | **Esfuerzo**: S (1-2 días)
- **Qué**: Icono bandera en `NewsCard` y `ReelCard`. Tabla `ContentReport`. Reportes visibles en actividad parental.
- **Impacto**: Enseña responsabilidad digital. Red de seguridad extra. Sistema bidireccional.

### B-PT6: Tour de onboarding parental
- **Prioridad**: P2 | **Esfuerzo**: S (1-2 días)
- **Qué**: Tras crear PIN, tour de 3 tooltips del panel parental: "Aquí ves actividad", "Aquí pones límites", "Aquí gestionas contenido".
- **Impacto**: Reduce soporte, aumenta descubrimiento de features.

---

## 4. Contenido y Personalización — "La app me conoce"

### B-CP1: Búsqueda
- **Prioridad**: P0 | **Esfuerzo**: M (3-5 días)
- **Qué**: **No hay búsqueda en ningún sitio**. SearchBar en Home, `?q=` en `GET /api/news` (SQL LIKE). Búsquedas sugeridas para niños ("Champions League", "NBA", equipos de TEAMS).
- **Dónde**: Componente `SearchBar`, route `news.ts`, `HomeFeedClient.tsx`
- **Impacto**: Table stakes. Niño que acaba de ver un partido quiere buscar su equipo.

### B-CP2: Feed "Para ti" con señales de comportamiento
- **Prioridad**: P1 | **Esfuerzo**: L (1-2 semanas)
- **Qué**: Feed ranker actual = pesos estáticos (+5 equipo, +3 deporte). Enriquecer con `ActivityLog`: deportes más leídos, fuentes más clicadas, decay temporal. `RankableItem` ya es genérico.
- **Impacto**: "Esta app me conoce" — mejora con el uso.

### B-CP3: Estadísticas de equipo en vivo
- **Prioridad**: P1 | **Esfuerzo**: L (1-2 semanas)
- **Qué**: `TeamStats` son seed estáticos. Integrar API deportiva (API-Football, TheSportsDB) con cron diario.
- **Impacto**: Datos reales >> datos seed. Diferenciador core del Team Hub.

### B-CP4: Recomendaciones "Si te gustó esto..."
- **Prioridad**: P2 | **Esfuerzo**: M (3-5 días)
- **Qué**: Tras leer artículo, 2-3 relacionados por equipo/deporte. Filtrado simple por metadata existente.
- **Impacto**: Mantiene flujo de lectura, aumenta artículos/sesión.

### B-CP5: Filtrado de contenido por idioma del usuario
- **Prioridad**: P2 | **Esfuerzo**: M (3-5 días)
- **Qué**: Priorizar fuentes RSS que coincidan con locale (`RssSource.language` ya existe). Complementa `backlog-user-locale.md`.
- **Impacto**: Niño hispanohablante de 8 años no debería ver inglés por defecto.

---

## 5. Mobile — Paridad y sensación nativa

### B-MP1: Paridad de features mobile (RSS custom + check-in)
- **Prioridad**: P0 | **Esfuerzo**: M (3-5 días)
- **Qué**: Mobile no tiene RSS custom ni check-in diario. Web sí. Portar catalog browser y check-in a mobile.
- **Impacto**: Gaps entre plataformas = frustración y churn.

### B-MP2: Centralizar API_BASE
- **Prioridad**: P0 | **Esfuerzo**: S (1-2 días)
- **Qué**: Cada screen importa `API_BASE` separado, hardcodeado a IP local. Crear `config.ts` único. Deuda técnica documentada.
- **Impacto**: Bloquea testing en dispositivos reales.

### B-MP3: Pull-to-refresh con branding
- **Prioridad**: P1 | **Esfuerzo**: S (1-2 días)
- **Qué**: `RefreshControl` usa spinner genérico. Custom con logo/mascota SportyKids.
- **Impacto**: Detalle de polish que comunica calidad.

### B-MP4: Modo offline (cola de lectura)
- **Prioridad**: P1 | **Esfuerzo**: L (1-2 semanas)
- **Qué**: Cachear últimas 20 noticias + resúmenes en AsyncStorage. Banner offline en vez de error. Niños usan tablets sin internet (coche, campo, avión).
- **Impacto**: Elimina fricción enorme. Los niños no entienden "no hay conexión".

### B-MP5: Push Notifications (implementación completa)
- **Prioridad**: P1 | **Esfuerzo**: L (1-2 semanas)
- **Qué**: UI y API existen pero no hay delivery. Expo Push: token, DB, envío. Triggers: quiz disponible, noticias equipo, racha en peligro, sticker nuevo.
- **Impacto**: **Driver #1 de retención diaria**. "Tu racha se va a romper!" = +DAU significativo.

### B-MP6: Player nativo para Reels
- **Prioridad**: P2 | **Esfuerzo**: XL (2+ semanas)
- **Qué**: Reels = iframes YouTube (lento, branding, autoplay limitado). `expo-av`/`expo-video` con MP4. Complementa `backlog-video-aggregator.md`.
- **Impacto**: Feature más débil visualmente. YouTube embeds no son nativos.

---

## 6. Fundación Técnica — "Que no se rompa"

### B-TF1: Suite de tests automatizados
- **Prioridad**: P0 | **Esfuerzo**: XL (2+ semanas)
- **Qué**: Cero tests hoy. Vitest para API (gamification, feed-ranker, parental-guard) + React Testing Library para componentes clave. Empezar por áreas de riesgo del `review.md`.
- **Impacto**: Sin tests, cada cambio puede romper features. Bloquea shipping con confianza.

### B-TF2: Corregir issues críticos del review
- **Prioridad**: P0 | **Esfuerzo**: M (3-5 días)
- **Qué**: 9 críticos (endpoints sin auth, JSON.parse sin try/catch, URL mismatch, PIN hash en caché) + 14 warnings en `review.md`. Fix antes de beta.
- **Impacto**: Seguridad. SSRF via RSS custom y quiz sin auth = inaceptable en app de niños.

### B-TF3: Autenticación (JWT + Social Login)
- **Prioridad**: P1 | **Esfuerzo**: L (1-2 semanas)
- **Qué**: JWT + login social (Google, Microsoft, Facebook/Meta, Apple). Los padres crean cuenta con SU cuenta social y asocian el perfil del niño. Sin formularios de registro, sin contraseñas. Middleware `auth.ts` placeholder ya existe. Opciones: NextAuth.js (web) + Expo AuthSession (mobile), o provider unificado (Clerk/Auth0).
- **Impacto**: App de niños sin auth no pasa app store review. Social login simplifica onboarding y refuerza que la cuenta del padre = el control.

### B-TF4: Migración a PostgreSQL
- **Prioridad**: P1 | **Esfuerzo**: L (1-2 semanas)
- **Qué**: SQLite no soporta concurrencia, todo es JSON string, no apto para producción. Migrar via Prisma a arrays nativos. Resuelve ~6 issues del review.
- **Impacto**: Fiabilidad y escalabilidad. Requisito antes de usuarios reales.

### B-TF5: Capa de caché para API
- **Prioridad**: P1 | **Esfuerzo**: M (3-5 días)
- **Qué**: Cada page load va directo a DB. Caché in-memory o Redis: news feed (5min), team stats (1h), stickers (24h). El feed ranker ya carga todo en memoria — cachear elimina bottleneck.
- **Impacto**: De cientos de ms a single-digit ms para contenido cacheado.

### B-TF6: Monitorización y analytics
- **Prioridad**: P2 | **Esfuerzo**: M (3-5 días)
- **Qué**: Sentry + analytics privacy-friendly (PostHog/Plausible). DAU, artículos/sesión, quiz completion, retención rachas, funnel onboarding.
- **Impacto**: No se mejora lo que no se mide.

### B-TF7: Pipeline CI/CD
- **Prioridad**: P2 | **Esfuerzo**: M (3-5 días)
- **Qué**: GitHub Actions: lint, type-check, tests en PR. Auto-deploy en merge. Expo EAS Build para mobile. Depende de B-TF1.
- **Impacto**: Quality gates automáticos previenen regresiones.

---

## Roadmap sugerido (sprints de 2 semanas)

### Sprint 1: "Base sólida" (Semana 1-2)
| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| B-TF2: Fix issues críticos del review | P0 | M |
| B-MP2: Centralizar API_BASE | P0 | S |
| B-UX1: Skeleton loading | P0 | M |
| B-CP1: Búsqueda | P0 | M |
| B-TF1: Iniciar suite de tests | P0 | ongoing |

### Sprint 2: "Capa de delight" (Semana 3-4)
| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| B-UX2: Animaciones de celebración | P0 | M |
| B-UX3: Transiciones entre páginas | P1 | S |
| B-UX5: Empty states con ilustraciones | P1 | S |
| B-UX6: Feedback visual PIN | P1 | S |
| B-EN2: Favoritos (bookmark simple) | P1 | S |
| B-EN3: Badge trending | P1 | S |

### Sprint 3: "Confianza parental" (Semana 5-6)
| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| B-PT1: Digest semanal para padres | P0 | L |
| B-PT2: Modo "Ver lo que ve mi hijo" | P0 | M |
| B-PT3: Límites granulares por tipo | P1 | M |
| B-PT5: Botón reportar contenido | P1 | S |
| B-TF3: Autenticación JWT + Social Login | P1 | L |

### Sprint 4: "Motor de retención" (Semana 7-8)
| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| B-EN1: Misión del día | P0 | L |
| B-MP1: Paridad features mobile | P0 | M |
| B-MP5: Push notifications | P1 | L |
| B-UX4: Modo oscuro | P1 | M |

### Sprint 5: "Polish premium" (Semana 9-10)
| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| B-CP2: Feed "Para ti" algorítmico | P1 | L |
| B-CP3: Estadísticas en vivo | P1 | L |
| B-MP4: Modo offline | P1 | L |
| B-EN4: Historial de lectura | P2 | S |
| B-TF5: Caché API | P1 | M |

---

## Resumen de prioridades

| Prioridad | Items | Esfuerzo total estimado |
|-----------|-------|------------------------|
| **P0** (crítico para mercado) | 9 items | ~5-7 semanas |
| **P1** (alto valor) | 15 items | ~7-9 semanas |
| **P2** (nice to have) | 7 items | ~2-3 semanas |
| **Total** | **31 items** | **~14-19 semanas** |
