# SportyKids — MVP to Product: Fase 6 — Post-Lanzamiento & Crecimiento

**Fase**: 6 de 6 — Sostenibilidad y diferenciación post-lanzamiento
**Prioridad**: MEDIA-ALTA — sin revenue, el producto tiene fecha de caducidad
**Dependencias**: Fase 5 completada (app publicada en tiendas)
**Estimación**: Backlog continuo — priorizar por métricas post-lanzamiento
**Contexto**: Análisis estratégico v3 (2026-03-28) — Backlog P2

---

## Objetivo

Una vez publicada la app, pasar de "estar en tiendas" a "crecer de forma sostenible". Esta fase aborda los tres vectores que determinan si SportyKids tiene futuro como producto: monetización (revenue que financie el desarrollo), diferenciación técnica (vídeo nativo que elimina la dependencia de YouTube), y canales de distribución B2B que reduzcan el coste de adquisición de usuarios.

---

## Contexto post-lanzamiento

Las decisiones de esta fase deben tomarse con datos reales de la versión 1.0.0:
- ¿Qué deporte retiene más a los usuarios?
- ¿En qué paso del onboarding hay más abandono?
- ¿Qué porcentaje de padres activan el PIN parental?
- ¿Cuál es el D7 retention?
- ¿Qué contenido genera más reportes?

Los ítems de esta fase son el backlog priorizado, no un plan secuencial fijo. Se ordenarán según lo que indiquen las métricas del primer mes.

---

## Alcance

### 1. Modelo de monetización

**Recomendación para v1.1: Suscripción familiar**

Estructura propuesta:
- **Gratis**: 5 noticias/día, quiz diario (3 preguntas), reels limitados (5/día), 1 deporte
- **SportyKids Premium** (2,99 EUR/mes ó 24,99 EUR/año): noticias ilimitadas, quiz ilimitado, reels ilimitados, todos los deportes, digest semanal PDF, sin límites de tiempo
- **Descuento familiar**: precio único para hasta 3 hijos en la misma familia (cuenta del padre)

**Implementación técnica:**
- Integrar **RevenueCat** como plataforma de gestión de suscripciones (soporta iOS App Store, Google Play y Stripe para web)
- RevenueCat gestiona automáticamente: trial periods, renovaciones, cancelaciones, restore purchases
- Añadir campo `subscriptionTier: 'free' | 'premium'` al modelo `User` en Prisma
- Crear middleware `requirePremium` que bloquea endpoints con límites en tier free
- UI: `UpgradePrompt` component que aparece al alcanzar límites del tier free
- Los padres pagan, los hijos consumen — la suscripción se asocia al `ParentalProfile`

**Consideraciones Apple/Google:**
- Apple cobra 30% el primer año, 15% a partir del segundo (Small Business Program)
- Google cobra 15% el primer año, 15% también (desde 2022)
- Las suscripciones familiares en apps Kids deben gestionarse a través del padre, no del menor
- Precio en EUR incluye IVA — ajustar por mercado (UK: GBP, US: USD)

**Archivos a crear/modificar:**
- `apps/api/src/services/subscription.ts` — lógica de verificación de tier
- `apps/api/src/middleware/require-premium.ts` — middleware de acceso premium
- `apps/api/prisma/schema.prisma` — campo `subscriptionTier` en User
- `apps/mobile/src/screens/Upgrade.tsx` — pantalla de upgrade con paywall
- `apps/web/src/app/upgrade/page.tsx` — página web de upgrade

### 2. Vídeo nativo — Eliminar dependencia de YouTube

**Problema a resolver:** Los Reels actuales son embeds de YouTube que pueden mostrar ads y contenido sugerido externo. Google Play Families Policy lo puede considerar violación.

**Solución propuesta: Pipeline de vídeo propio**

Arquitectura:
```
YouTube RSS Feed → Video Aggregator (ya existe)
       ↓
Descargar vídeo con yt-dlp (server-side)
       ↓
Transcoding a MP4 720p con ffmpeg
       ↓
Storage en S3-compatible (Cloudflare R2 o Backblaze B2)
       ↓
CDN URL → expo-video nativo en mobile, <video> en web
```

**Fases de implementación:**
1. Instalar `expo-video` en mobile (`npx expo install expo-video`)
2. Crear servicio `video-processor.ts` que descarga y transcodifica con `yt-dlp` + `ffmpeg`
3. Integrar Cloudflare R2 (o Backblaze B2) para storage de vídeos
4. Job `process-videos.ts` que procesa los nuevos Reels del Video Aggregator
5. Actualizar `VideoPlayer.tsx` mobile para usar `expo-video` con la URL de R2
6. Actualizar `VideoPlayer.tsx` web para usar `<video>` nativo

**Ventajas:**
- Cero ads, cero vídeos sugeridos — control editorial total
- Modo offline: los vídeos pueden pre-cachearse en el dispositivo
- Métricas reales de visualización (segundos vistos, completados)
- Diferenciador premium: "Vídeos sin publicidad"

**Estimación:** 2–3 semanas (la parte de storage y CDN es la más compleja)

### 3. Canal B2B — Clubes y academias

**Propuesta: Plan "SportyKids Club"**

Modelo:
- Una academia o club compra licencias por niño (e.g., 1,99 EUR/niño/mes)
- El club puede personalizar: logo, colores, fuentes RSS del club propio (si tiene web o Instagram)
- Los niños del club acceden con código de invitación
- El entrenador/coordinador tiene un panel de seguimiento de actividad del grupo

**Implementación técnica (MVP del B2B):**
1. Nuevo modelo `Organization` en Prisma: `name`, `logoUrl`, `customColors`, `inviteCode`
2. Campo `organizationId` en `User` (nullable — usuarios B2B vs. consumer)
3. Endpoint `POST /api/auth/join-organization` — unirse con código de invitación
4. Panel de organización: `GET /api/organizations/:id/activity` — actividad del grupo
5. Onboarding alternativo para clubs: en lugar de "¿cuáles son tus deportes favoritos?", el club pre-configura los deportes relevantes

**Go-to-market:**
- Contacto directo con 5–10 escuelas de fútbol base en España (Andalucía, Madrid, Cataluña)
- Oferta de prueba gratuita de 3 meses para el primer club
- Material de presentación: deck de 10 slides + vídeo demo de 2 minutos

### 4. Certificación de seguridad — kidSAFE Seal

**Qué es:** kidSAFE es el programa de certificación de seguridad para apps infantiles más reconocido en el mercado angloparlante. El sello "kidSAFE+" (para apps con funciones de comunidad/social) o "kidSAFE" (solo content app) es un activo de marketing directo para padres.

**Proceso:**
1. Completar el formulario de aplicación en kidSAFE.com
2. Auditoría técnica de la app por el equipo de kidSAFE
3. Review de privacy policy, parental controls y moderación de contenido
4. Coste: ~$500–1500/año según el tamaño de la app
5. Una vez certificado: añadir el sello en las fichas de tienda y en la app

**Valor de marketing:** "Certificada como segura para niños por kidSAFE" es el argumento de venta más potente para padres que no conocen la marca SportyKids.

### 5. Contenido exclusivo — Ligas juveniles

**Diferenciación irreplicable:** Cubrir competiciones infantiles y juveniles (ligas escolares, campeonatos autonómicos, torneos de base) que los grandes medios ignoran completamente.

**Implementación:**
- Acordar con 2–3 federaciones regionales de fútbol la posibilidad de publicar resultados y noticias
- Crear fuentes RSS propias de las competiciones (scraping de los resultados con Cheerio si no tienen RSS nativo)
- Añadir categoría `youth_football`, `youth_basketball`, etc. al sistema de fuentes RSS
- Contenido escrito en lenguaje adaptado para niños (usar AI summarizer existente)

**Pilot:** Comenzar con la Liga Autonómica de Fútbol Base de Andalucía (donde está el equipo) como caso de uso

### 6. Notificaciones en tiempo real — Resultados de partidos

**Valor:** "Tu equipo acaba de marcar" es el push notification que más engagement genera. Es el tipo de contenido que hace que el usuario abra la app inmediatamente.

**Implementación:**
- Conectar TheSportsDB (ya integrado para estadísticas) con websocket o polling de resultados en vivo
- Nuevo job `live-scores.ts` que hace polling cada 5 minutos durante las ventanas de partidos
- Si hay gol del equipo favorito del usuario: `push-sender.ts` envía notificación
- Formato: "⚽ ¡Gol! Real Madrid 2–0 Barcelona (min. 67)"
- Opt-in específico en las preferencias de push del usuario

---

## Métricas de éxito (a 6 meses de lanzamiento)

| Métrica | Target |
|---------|--------|
| Downloads totales | 1,000+ |
| DAU/MAU ratio | > 20% |
| D30 retention | > 15% |
| Usuarios premium (conversion) | > 5% de activos |
| MRR | > 500 EUR |
| NPS | > 50 |
| Crashes por sesión | < 0.1% |
| Contenido moderado correctamente | > 99% |

---

## Priorización recomendada (basada en impacto/esfuerzo)

| Item | Impacto | Esfuerzo | Cuándo |
|------|---------|----------|--------|
| Monetización (RevenueCat) | MUY ALTO | MEDIO | Mes 1 post-lanzamiento |
| Notificaciones tiempo real | ALTO | BAJO | Mes 1 post-lanzamiento |
| Canal B2B (MVP) | ALTO | MEDIO | Mes 2 post-lanzamiento |
| Vídeo nativo | ALTO | ALTO | Mes 2–3 post-lanzamiento |
| Certificación kidSAFE | MEDIO | BAJO | Mes 3 post-lanzamiento |
| Contenido ligas juveniles | ALTO | ALTO | Mes 3–4 post-lanzamiento |

---

## Fuera de alcance (para esta fase)

- Redes sociales o funcionalidades de comunidad entre niños (riesgo regulatorio, COPPA implica parental consent para todo social)
- Sticker trading entre usuarios (mismo riesgo)
- Versión web premium (solo mobile en v1)
- Internacionalización a nuevos mercados fuera de ES/GB/US/FR/IT/DE

---

## Dependencias externas

| Servicio | Para qué | Coste estimado |
|----------|----------|----------------|
| RevenueCat | Gestión de suscripciones | Free hasta $2.5k MRR |
| Cloudflare R2 | Storage de vídeos nativos | $0.015/GB/mes |
| yt-dlp + ffmpeg | Descarga y transcoding | Open source (coste de compute) |
| kidSAFE | Certificación de seguridad | ~$500–1500/año |
| TheSportsDB (premium) | Live scores API | ~$20/mes |
