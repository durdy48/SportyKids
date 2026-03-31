# SportyKids — MVP to Product: Fase 3 — Assets de Tienda & Despliegue

**Fase**: 3 de 6 — Publicación técnica
**Prioridad**: CRÍTICA — sin esto no se puede subir el binario a las tiendas
**Dependencias**: Fases 1 y 2 recomendadas antes, pero ejecutable en paralelo
**Estimación**: 4–6 días (incluye tiempo de gestión con Apple/Google)
**Contexto**: Análisis estratégico v3 (2026-03-28) — Blockers P0 operativos

---

## Objetivo

Preparar todo lo necesario para enviar la app a revisión en Apple App Store y Google Play Store: assets visuales (iconos, splash, screenshots, vídeo preview), ficha de tienda optimizada para ASO, configuración de EAS con credenciales reales, API dinámica por entorno, y servidor de producción accesible desde internet con HTTPS.

Esta es la fase más operativa del proceso. No requiere cambios profundos de código pero tiene dependencias externas (cuentas de Apple Developer, Google Play Console, dominio y servidor) que pueden añadir tiempo de espera.

---

## Problema actual

- La carpeta `apps/mobile/assets/` está vacía — no hay iconos ni splash screen
- `API_BASE` en `apps/mobile/src/config.ts` apunta a `http://192.168.1.147:3001/api` (IP local de desarrollo)
- `eas.json` tiene placeholders vacíos para Apple ID, ASC App ID, Apple Team ID y Android Service Account Key
- No existe servidor de producción con HTTPS accesible desde internet
- No hay screenshots ni descripciones de ASO para las fichas de tienda
- OAuth Google + Apple están implementados en código pero inactivos (requieren credenciales + callback URLs en producción)

---

## Alcance

### 1. App Icons y Splash Screen

Generar y configurar todos los assets visuales necesarios:

**Icono de app:**
- Diseño: logo SportyKids en fondo azul (#2563EB), tipografía Poppins, estilo kids-friendly
- iOS: 1024×1024 PNG sin canal alfa, sin esquinas redondeadas (Apple las aplica automáticamente)
- Android: 512×512 PNG (con y sin fondo adaptativo para Android 8+)
- EAS genera automáticamente todos los tamaños intermedios si se le da el `1024×1024`
- Configurar en `app.json`: `"icon": "./assets/icon.png"`, `"android.adaptiveIcon.foregroundImage": "./assets/adaptive-icon.png"`

**Splash screen:**
- Diseño: logo centrado sobre fondo `#F8FAFC` (color background de la app)
- Dimensiones: 1284×2778 px (iPhone 14 Pro Max, el más grande soportado)
- Configurar en `app.json`: `"splash": { "image": "./assets/splash.png", "resizeMode": "contain", "backgroundColor": "#F8FAFC" }`
- `expo-splash-screen` ya está en el SDK — no requiere instalación adicional

**Feature Graphic (Google Play):**
- 1024×500 px PNG o JPEG
- Texto "SportyKids — Noticias deportivas para niños" sobre imagen de fondo deportiva

### 2. API_BASE dinámica por entorno

Reemplazar el hardcode en `apps/mobile/src/config.ts`:

```typescript
// Antes (hardcoded):
export const API_BASE = 'http://192.168.1.147:3001/api';

// Después (dinámica):
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3001/api';
```

- Crear `apps/mobile/.env.development` con `EXPO_PUBLIC_API_BASE=http://localhost:3001/api`
- Crear `apps/mobile/.env.preview` con `EXPO_PUBLIC_API_BASE=https://staging.sportykids.app/api`
- Crear `apps/mobile/.env.production` con `EXPO_PUBLIC_API_BASE=https://api.sportykids.app/api`
- Añadir `extra.apiBase` en `app.json` para que EAS pueda inyectarlo en el build
- Añadir `.env.*` a `.gitignore` (solo el `.env.example` se commitea)

### 3. Servidor de producción

Desplegar la API en un servidor accesible desde internet con:

**Requisitos:**
- HTTPS con certificado SSL válido (Let's Encrypt via Caddy o similar)
- Dominio propio (e.g., `api.sportykids.app`)
- PostgreSQL 16 en producción (puede ser managed: Supabase, Railway, Neon)
- Redis 7 para caché en producción (puede ser Upstash Redis)
- Variables de entorno de producción gestionadas de forma segura

**Opciones de despliegue recomendadas (por simplicidad):**

| Opción | Pros | Contras |
|--------|------|---------|
| Railway | Despliegue desde GitHub, PostgreSQL y Redis managed, SSL automático | Coste desde $5/mes |
| Render | Similar a Railway, free tier disponible | Free tier tiene cold start de 1 min |
| Fly.io | Más control, buena DX, global edge | Curva de configuración mayor |
| VPS + Docker Compose | Control total, más barato | Gestión manual de SSL y actualizaciones |

**Archivos a crear:**
- `Dockerfile` para la API (multi-stage build: builder + runner)
- `fly.toml` o `railway.json` según la opción elegida
- `apps/api/.env.production.example` con todas las variables necesarias

**Variables de producción críticas:**
```
DATABASE_URL=postgresql://...
JWT_SECRET=<64-char random>
JWT_REFRESH_SECRET=<64-char random>
AI_PROVIDER=anthropic (o openrouter)
ANTHROPIC_API_KEY=...
SENTRY_DSN=...
POSTHOG_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.sportykids.app/api/auth/google/callback
GOOGLE_SUCCESS_REDIRECT_URL=https://sportykids.app/auth/callback
APPLE_CLIENT_ID=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY=...
CACHE_PROVIDER=redis
REDIS_URL=...
NODE_ENV=production
MODERATION_FAIL_OPEN=false
```

### 4. EAS Credentials y OAuth en producción

**Apple:**
1. Crear App ID en Apple Developer Portal: `com.sportykids.app`
2. Crear Distribution Certificate y Provisioning Profile
3. Crear app en App Store Connect y obtener ASC App ID
4. Configurar Sign In with Apple en Apple Developer Portal (Services ID)
5. Completar `eas.json` con `appleId`, `ascAppId`, `appleTeamId`

**Google:**
1. Crear app en Google Play Console
2. Generar Service Account Key (JSON) con rol "Release Manager"
3. Configurar OAuth 2.0 credentials en Google Cloud Console para Android + iOS
4. Completar `eas.json` con `serviceAccountKeyPath`

**EAS Submit automatizado:**
```json
// eas.json (sección submit/production):
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "antonio@sportykids.app",
        "ascAppId": "XXXXXXXXXX",
        "appleTeamId": "XXXXXXXXXX"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json",
        "track": "internal"
      }
    }
  }
}
```

### 5. Screenshots y ASO

**Screenshots por dispositivo (mínimo):**
- iPhone 6.7" (iPhone 14 Pro Max): 1290×2796 px — al menos 3
- iPhone 5.5" (iPhone 8 Plus): 1242×2208 px — al menos 3
- iPad Pro 12.9": 2048×2732 px — recomendado, no obligatorio
- Android: 1080×1920 px — al menos 2

**Pantallas a capturar:**
1. Home Feed con noticias reales ("Noticias deportivas a tu medida")
2. Quiz interactivo en acción ("¿Cuánto sabes de tu deporte?")
3. Reels de vídeo verticales ("Vídeos cortos del deporte que te gusta")
4. Panel parental ("Tú controlas lo que ve tu hijo")
5. Colección de stickers ("Colecciona logros mientras aprendes")

**Descripciones ASO (ES):**
- **Título** (30 chars): `SportyKids: Noticias Deporte`
- **Subtítulo** (30 chars): `Seguro, divertido y para niños`
- **Descripción corta Android** (80 chars): `Noticias deportivas seguras para niños de 6 a 14 años con control parental`
- **Keywords iOS** (100 chars): `noticias deportivas niños,fútbol niños,app niños deportes,control parental`

**Previsualización de vídeo (30s):**
- Secuencia: Onboarding (5s) → Feed (5s) → Reel (5s) → Quiz (5s) → Colección (5s) → Panel parental (5s)
- Sin voz, solo música energética y texto en pantalla
- Herramientas: Expo screen recorder o simulador de iOS con QuickTime

---

## Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `apps/mobile/assets/icon.png` | Icono 1024×1024 |
| `apps/mobile/assets/adaptive-icon.png` | Icono adaptativo Android |
| `apps/mobile/assets/splash.png` | Splash screen |
| `apps/mobile/assets/feature-graphic.png` | Feature graphic Google Play |
| `apps/mobile/.env.development` | API base para dev |
| `apps/mobile/.env.preview` | API base para staging |
| `apps/mobile/.env.production` | API base para producción |
| `Dockerfile` | Multi-stage build para la API |
| `fly.toml` (o equivalente) | Config de despliegue |

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `apps/mobile/src/config.ts` | `API_BASE` dinámico via `EXPO_PUBLIC_API_BASE` |
| `apps/mobile/app.json` | Añadir `icon`, `splash`, `android.adaptiveIcon`, `extra.apiBase` |
| `apps/mobile/eas.json` | Completar credenciales Apple + Android |
| `.gitignore` | Añadir `.env.*` y `google-play-key.json` |
| `.env.example` | Actualizar con todas las variables de producción |

---

## Criterios de aceptación

- [ ] `npx expo start` con `EXPO_PUBLIC_API_BASE=http://localhost:3001/api` conecta correctamente al API local
- [ ] `eas build --profile production` genera un `.ipa` / `.aab` válido
- [ ] El icono de app aparece correctamente en el simulador iOS y emulador Android
- [ ] El splash screen se muestra al arrancar la app y hace transición al home
- [ ] `https://api.sportykids.app/api/health` responde con `{ status: 'ok' }` desde internet
- [ ] La API en producción conecta a PostgreSQL y Redis managed
- [ ] Google OAuth funciona end-to-end en producción (login → callback → JWT → home)
- [ ] Apple Sign In funciona end-to-end en producción (token → verify → JWT → home)
- [ ] Screenshots cargadas en App Store Connect y Google Play Console
- [ ] Descripción ASO en ES + EN en ambas plataformas

---

## Fuera de alcance

- Diseño profesional de assets por un diseñador gráfico (se asume generación programática o con herramientas AI)
- App Store Optimization avanzado (A/B testing de assets, análisis de keywords competidores)
- Multi-región de servidores o CDN para contenido estático
- Webapp de SportyKids en dominio propio (eso es un despliegue separado de Next.js)
- CI/CD automatizado para despliegue continuo (GitHub Actions → Railway/Fly)

---

## Decisiones técnicas

| Decisión | Razón |
|----------|-------|
| `EXPO_PUBLIC_*` prefix | Expo lo inyecta automáticamente en el bundle sin configuración adicional |
| Railway/Render sobre VPS propio | Menor complejidad operativa para el lanzamiento inicial; migrable después |
| EAS Build sobre build local | Reproducible, sin dependencias de máquina local, soporta iOS sin Mac |
| Screenshots en simulador | Más rápido y consistente que en dispositivo físico para v1 |
