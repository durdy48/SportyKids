# Store Assets & Deployment — Product Requirements Document

## Overview

Phase 3 prepares SportyKids for production deployment and app store submission. This covers four workstreams:

1. **Asset Generation** — Programmatically create app icons, splash screens, and store marketing graphics.
2. **Dynamic API Configuration** — Replace the hardcoded dev API_BASE with an environment-aware fallback chain.
3. **Production Infrastructure** — Dockerize the API, deploy to Fly.io with managed Postgres and Redis, and extend CI/CD with automated deployment.
4. **Store Readiness** — Structure EAS credentials, document store account setup, define screenshot specs, and prepare ASO metadata in ES+EN.

No store accounts (Apple Developer Program, Google Play Console) exist yet. This phase structures everything so that once accounts are created, submission is a single `eas submit` command away.

---

## Problem Statement

SportyKids has a fully functional MVP (Phases 0–4 complete) but no path to put it in front of real users:

- The mobile app has **zero visual assets** — no icon, no splash screen, no store graphics.
- `API_BASE` is **hardcoded to a local IP** (`http://192.168.1.147:3001/api`), making any build beyond the developer's machine non-functional.
- There is **no production server** — the API only runs locally via `tsx watch`.
- There is **no Dockerfile**, no deployment config, no CD pipeline.
- EAS submit credentials are **empty placeholders**.
- No ASO (App Store Optimization) metadata exists.

Phase 5 (beta testing with 5–10 families) cannot begin until all of the above is resolved.

---

## Goals

| # | Goal | Success Metric |
|---|------|---------------|
| G1 | Generate production-quality placeholder assets | icon.png, adaptive-icon.png, splash-icon.png, favicon.png, feature-graphic.png exist at correct dimensions and pass store validation |
| G2 | API_BASE resolves correctly per environment | Dev → localhost, preview → preview.fly.dev, production → production.fly.dev, with env var override |
| G3 | API runs in production on Fly.io | `GET /api/health` returns 200 from `sportykids-api.fly.dev` |
| G4 | CI/CD deploys on push to main | Merge to main triggers Docker build + `fly deploy` automatically |
| G5 | EAS config ready for submission | `eas build --platform all --profile production` succeeds; `eas submit` only blocked on account credentials |
| G6 | ASO metadata defined | Title, subtitle, description, keywords in ES+EN ready to paste into store consoles |

---

## Target Users

- **Developer (immediate)** — needs one-command deploy and asset generation.
- **Beta families (Phase 5)** — need a working production URL and installable app (TestFlight / internal track).
- **Store reviewers (future)** — need compliant metadata, appropriate screenshots, and a working app.

---

## Core Features

### F1: Asset Generation Script

**File**: `apps/mobile/scripts/generate-assets.mjs` (ES module, runs with Node >= 20)

**Dependency**: `sharp` (added as devDependency to `apps/mobile/package.json`)

**Assets to generate**:

| Asset | Dimensions | Background | Content | Output Path |
|-------|-----------|------------|---------|-------------|
| `icon.png` | 1024×1024 | `#2563EB` (solid) | White "SK" centered, Bold 400px | `apps/mobile/src/assets/icon.png` |
| `adaptive-icon.png` | 512×512 | Transparent | White "SK" centered on `#2563EB` circle (r=220, centered), Bold 200px | `apps/mobile/src/assets/adaptive-icon.png` |
| `splash-icon.png` | 200×200 | Transparent | White "SK" on `#2563EB` circle, used by expo-splash-screen | `apps/mobile/src/assets/splash-icon.png` |
| `favicon.png` | 48×48 | `#2563EB` | White "SK" 20px | `apps/mobile/src/assets/favicon.png` |
| `feature-graphic.png` | 1024×500 | `#2563EB` | White "SportyKids" centered, Bold 72px; subtitle "Sports news for kids" 32px below | `apps/mobile/src/assets/feature-graphic.png` |

**Algorithm for text rendering with sharp** (sharp does not render fonts natively — use SVG overlay):

```javascript
// Example for icon.png
import sharp from 'sharp';

const svgText = `
<svg width="1024" height="1024">
  <rect width="1024" height="1024" fill="#2563EB" rx="180"/>
  <text x="512" y="560" font-family="Arial, Helvetica, sans-serif"
        font-size="400" font-weight="bold" fill="white"
        text-anchor="middle" dominant-baseline="middle">SK</text>
</svg>`;

await sharp(Buffer.from(svgText))
  .png()
  .toFile('apps/mobile/src/assets/icon.png');
```

Note: Use `Arial, Helvetica, sans-serif` as the font family in SVG since Poppins is not available in headless Node environments. The visual result is close enough for placeholder assets. When real brand assets are designed, these will be replaced.

**`app.json` changes** — add icon, splash, and adaptive icon fields:

```jsonc
// apps/mobile/app.json — fields to add/modify
{
  "expo": {
    "icon": "./src/assets/icon.png",
    "splash": {
      "image": "./src/assets/splash-icon.png",
      "backgroundColor": "#F8FAFC",
      "resizeMode": "contain"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./src/assets/adaptive-icon.png",
        "backgroundColor": "#2563EB"
      },
      "package": "com.sportykids.app"
    },
    "ios": {
      "bundleIdentifier": "com.sportykids.app",
      "supportsTablet": true
    },
    "web": {
      "favicon": "./src/assets/favicon.png"
    }
  }
}
```

**npm script** — add to `apps/mobile/package.json`:

```json
{
  "scripts": {
    "generate-assets": "node scripts/generate-assets.mjs"
  }
}
```

**Edge cases**:
- Script must be idempotent — overwrite existing files without error.
- Script must create the `src/assets/` subdirectories if missing.
- Script must validate output dimensions after generation (sharp metadata check).
- If `sharp` is not installed, print a clear error: `"Run: npm install --save-dev sharp"`.

---

### F2: Dynamic API_BASE Configuration

**File to modify**: `apps/mobile/src/config.ts`

**Current state** (broken for non-dev):
```typescript
const ENV = {
  dev: { API_BASE: 'http://192.168.1.147:3001/api' },
  preview: { API_BASE: 'https://sportykids-api-preview.fly.dev/api' },
  production: { API_BASE: 'https://sportykids-api.fly.dev/api' },
};
// Hardcoded to ENV.dev
```

**New implementation** — fallback chain:

```typescript
import Constants from 'expo-constants';

const ENV_MAP: Record<string, string> = {
  production: 'https://sportykids-api.fly.dev/api',
  preview: 'https://sportykids-api-preview.fly.dev/api',
};

function resolveApiBase(): string {
  // 1. Explicit env var override (highest priority)
  const envOverride = process.env.EXPO_PUBLIC_API_BASE;
  if (envOverride) return envOverride;

  // 2. EAS channel-based detection
  const channel = Constants.expoConfig?.extra?.eas?.channel
    ?? Constants.expoConfig?.updates?.channel
    ?? undefined;

  if (channel && ENV_MAP[channel]) {
    return ENV_MAP[channel];
  }

  // 3. Development fallback — use Expo debugger host IP for physical device compatibility
  const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (debuggerHost) {
    return `http://${debuggerHost}:3001/api`;
  }

  // 4. Last resort localhost (simulator only)
  return 'http://localhost:3001/api';
}

export const API_BASE = resolveApiBase();
```

**New file**: `apps/mobile/.env.example`

```bash
# SportyKids Mobile — Environment Variables
# Copy to .env and adjust values.

# Override API base URL (optional — auto-detected from EAS channel)
# EXPO_PUBLIC_API_BASE=https://sportykids-api.fly.dev/api
```

**Update `.gitignore`** — add:

```
# Mobile env
apps/mobile/.env
apps/mobile/.env.local
```

**Behavior matrix**:

| Context | API_BASE resolves to |
|---------|---------------------|
| `EXPO_PUBLIC_API_BASE` set | Exact value from env var |
| EAS build, channel=production | `https://sportykids-api.fly.dev/api` |
| EAS build, channel=preview | `https://sportykids-api-preview.fly.dev/api` |
| `expo start` on physical device | `http://<debuggerHostIP>:3001/api` |
| `expo start` on simulator | `http://localhost:3001/api` |

**Edge cases**:
- `Constants.expoConfig` may be undefined in bare workflow — the chain handles this with `?.` and falls through.
- `hostUri` format is `"192.168.1.189:8081"` — split on `:` and take index 0.
- If the developer changes WiFi networks, the debugger host IP updates automatically on next `expo start`.

---

### F3: Production Dockerfile (API)

**New file**: `apps/api/Dockerfile`

Multi-stage build optimized for monorepo + Prisma:

```dockerfile
# ---- Stage 1: Install dependencies ----
FROM node:20-slim AS deps

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy workspace structure for npm install
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm ci --ignore-scripts

# ---- Stage 2: Build ----
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source
COPY package.json package-lock.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build shared package
RUN npm run build --workspace=packages/shared

# Build API
RUN npm run build:api

# ---- Stage 3: Production ----
FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system sportykids && adduser --system --ingroup sportykids sportykids

# Copy only production artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/package.json ./package.json

USER sportykids

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "apps/api/dist/index.js"]
```

**Key decisions**:
- `node:20-slim` — minimal Debian image, compatible with Prisma binary targets.
- OpenSSL is required by Prisma for query engine.
- Non-root user `sportykids` for security.
- PORT=8080 matches Fly.io's default internal port.
- `--ignore-scripts` in `npm ci` prevents postinstall scripts that may fail in Docker; Prisma generate is run explicitly.

**New file**: `apps/api/.dockerignore`

```
node_modules
dist
.env
.env.*
*.db
.expo
__tests__
*.test.ts
*.spec.ts
coverage
.git
```

---

### F4: Fly.io Deployment Configuration

**New file**: `fly.toml` (project root)

```toml
app = "sportykids-api"
primary_region = "mad"  # Madrid — closest to target audience (Spain)

[build]
  dockerfile = "apps/api/Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"
  LOG_LEVEL = "info"
  CACHE_PROVIDER = "redis"
  MODERATION_FAIL_OPEN = "false"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    type = "requests"
    hard_limit = 250
    soft_limit = 200

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  path = "/api/health"
  timeout = "5s"

[deploy]
  release_command = "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma"
```

**Secrets to set via `fly secrets set`** (NOT in fly.toml):

```bash
fly secrets set DATABASE_URL="postgres://..." \
  REDIS_URL="redis://..." \
  JWT_SECRET="<random-64-char>" \
  JWT_REFRESH_SECRET="<random-64-char>" \
  AI_PROVIDER="ollama" \
  SENTRY_DSN="" \
  POSTHOG_API_KEY=""
```

**Database**: Fly Postgres (managed):

```bash
fly postgres create --name sportykids-db --region mad --vm-size shared-cpu-1x --initial-cluster-size 1 --volume-size 1
fly postgres attach sportykids-db --app sportykids-api
```

This auto-sets `DATABASE_URL` as a secret.

**Redis**: Upstash Redis via Fly marketplace:

```bash
fly redis create --name sportykids-redis --region mad --plan free
```

This auto-sets `REDIS_URL` as a secret.

---

### F5: CI/CD Deployment Pipeline

**File to modify**: `.github/workflows/ci.yml`

Add a new job `deploy` that runs after the existing build job succeeds, only on pushes to `main`:

```yaml
  deploy:
    name: Deploy to Fly.io
    needs: [build-api]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    concurrency:
      group: deploy-production
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

**Required GitHub repository secret**: `FLY_API_TOKEN` — obtained via `fly tokens create deploy`.

**Concurrency**: `cancel-in-progress: false` ensures we never cancel a deploy mid-flight. If two pushes happen quickly, the second deploy queues.

---

### F6: EAS Build & Submit Configuration

**File to modify**: `apps/mobile/eas.json`

```json
{
  "cli": {
    "version": ">= 15.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": {
        "EXPO_PUBLIC_API_BASE": "https://sportykids-api-preview.fly.dev/api"
      },
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "channel": "production",
      "env": {
        "EXPO_PUBLIC_API_BASE": "https://sportykids-api.fly.dev/api"
      },
      "ios": {
        "autoIncrement": true
      },
      "android": {
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "APPLE_ID_HERE",
        "ascAppId": "ASC_APP_ID_HERE",
        "appleTeamId": "APPLE_TEAM_ID_HERE"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

**Key changes from current**:
- Added `cli.appVersionSource: "remote"` — EAS manages version numbers.
- Added `channel` to each profile — enables F2's channel-based API_BASE detection.
- Added `EXPO_PUBLIC_API_BASE` env vars to preview and production profiles.
- Added `autoIncrement` for production builds.
- Android submit targets `internal` track (for beta testing in Phase 5).
- Submit placeholders clearly marked with `_HERE` suffix.

**Add to `.gitignore`**:

```
# Google Play service account key
google-service-account.json
```

---

### F7: Store Account Setup Documentation

New file `docs/en/11-store-deployment.md` and `docs/es/11-despliegue-tiendas.md`.

**Apple Developer Account Setup**:

1. Enroll at https://developer.apple.com/programs/ ($99/year)
2. Create App ID with bundle identifier `com.sportykids.app`
3. Create App Store Connect listing for "SportyKids"
4. Note the ASC App ID (numeric) → update `eas.json` submit.production.ios.ascAppId
5. Note the Team ID → update `eas.json` submit.production.ios.appleTeamId
6. For OAuth (Apple Sign In): create Services ID, configure domains/redirect URLs
7. Age rating: set to 4+ (no objectionable content)
8. Privacy nutrition labels: configure based on data collected (name, email, usage data)
9. Kids category: select "Kids" primary category, age band 9-11

**Google Play Console Setup**:

1. Register at https://play.google.com/console ($25 one-time)
2. Create app "SportyKids" with default language Spanish (Spain)
3. Complete Data Safety form (aligns with our Privacy Policy)
4. Set content rating → IARC questionnaire (no violence, no gambling, no user-generated content)
5. Target audience: Under 13 → triggers Families Policy compliance
6. Create a service account for automated uploads: Google Cloud Console → IAM → Service Account → download JSON key → place as `apps/mobile/google-service-account.json`
7. Grant service account "Release Manager" role in Play Console
8. Create internal testing track for Phase 5 beta

**OAuth Production Callback URLs** — when accounts are created, update:

| Provider | Callback URL |
|----------|-------------|
| Google (web) | `https://sportykids-api.fly.dev/api/auth/google/callback` |
| Apple (web) | `https://sportykids-api.fly.dev/api/auth/apple/callback` |

Set these via environment variables: `GOOGLE_CALLBACK_URL`, `GOOGLE_SUCCESS_REDIRECT_URL`.

---

### F8: ASO Metadata

**New file**: `apps/mobile/store-metadata/en.json`

```json
{
  "name": "SportyKids — Sports News for Kids",
  "subtitle": "Safe sports news, quizzes & reels",
  "description": "SportyKids delivers age-appropriate sports news for children aged 6 to 14. Follow your favorite teams, watch short sports reels, take daily quizzes, and collect stickers — all in a safe, ad-free environment with full parental controls.\n\nFeatures:\n• Personalized sports feed from 180+ trusted sources\n• Short video reels from verified sports channels\n• Daily quizzes adapted to your child's age\n• Collectible stickers and achievement badges\n• Parental controls with PIN, time limits, and content filters\n• Weekly activity digest for parents\n• Works offline — cached articles available anytime\n• No ads, no tracking without consent\n\nSupported sports: Football, Basketball, Tennis, Swimming, Athletics, Cycling, Formula 1, Padel\n\nPrivacy first: COPPA and GDPR-K compliant. No data collected without parental consent for children under 13.",
  "keywords": "kids sports news,children sports app,safe news for kids,sports quiz,parental controls,football news kids,basketball kids,sports reels",
  "promotionalText": "Daily sports quizzes and collectible stickers are here!",
  "category": "News",
  "secondaryCategory": "Kids"
}
```

**New file**: `apps/mobile/store-metadata/es.json`

```json
{
  "name": "SportyKids — Noticias Deportivas Niños",
  "subtitle": "Noticias deportivas seguras y divertidas",
  "description": "SportyKids ofrece noticias deportivas adaptadas para niños de 6 a 14 años. Sigue a tus equipos favoritos, mira reels deportivos cortos, participa en quizzes diarios y colecciona cromos — todo en un entorno seguro, sin anuncios y con control parental completo.\n\nCaracterísticas:\n• Feed deportivo personalizado de más de 180 fuentes verificadas\n• Reels de vídeo cortos de canales deportivos verificados\n• Quizzes diarios adaptados a la edad de tu hijo\n• Cromos coleccionables e insignias de logros\n• Control parental con PIN, límites de tiempo y filtros de contenido\n• Resumen semanal de actividad para padres\n• Funciona sin conexión — artículos en caché disponibles siempre\n• Sin anuncios, sin rastreo sin consentimiento\n\nDeportes soportados: Fútbol, Baloncesto, Tenis, Natación, Atletismo, Ciclismo, Fórmula 1, Pádel\n\nPrivacidad primero: Cumple COPPA y RGPD-K. No se recogen datos sin consentimiento parental para menores de 13 años.",
  "keywords": "noticias deportivas niños,app deportes niños,noticias seguras niños,quiz deportivo,control parental,fútbol niños,baloncesto niños,reels deportivos",
  "promotionalText": "¡Quizzes deportivos diarios y cromos coleccionables!",
  "category": "Noticias",
  "secondaryCategory": "Niños"
}
```

---

### F9: Screenshot Specifications

Screenshots are captured manually from simulators, NOT generated by code. The PRD specifies what to capture.

**iOS Screenshots** (required sizes):

| Device | Dimensions | Required |
|--------|-----------|----------|
| iPhone 6.7" (15 Pro Max) | 1290×2796 | Yes (mandatory for App Store) |
| iPhone 6.5" (14 Plus) | 1284×2778 | Yes |
| iPad 12.9" (6th gen) | 2048×2732 | Only if `supportsTablet: true` |

**Android Screenshots**:

| Type | Dimensions | Required |
|------|-----------|----------|
| Phone | 1080×1920 (min) | Yes, 2-8 screenshots |
| Feature graphic | 1024×500 | Yes (generated in F1) |

**Screenshots to capture** (5 per locale, per platform):

1. **Home Feed** — showing multiple sport cards with colored headers, filters visible
2. **Reels** — vertical video feed with a reel playing
3. **Quiz** — question screen with answer options and score counter
4. **Collection** — sticker collection grid showing different rarities
5. **Parental Controls** — parental panel showing time limits and activity chart

Capture with light theme, sample data visible, Spanish locale first, then English.

---

### F10: Splash Screen Integration

`expo-splash-screen` is included with Expo SDK 54 by default.

Expo SDK 54 uses the `splash.image` field in `app.json` for the static splash screen shown during app load. The `app.json` changes in F1 handle this.

For a smooth transition from splash to app content, add to `apps/mobile/src/App.tsx`:

```typescript
import * as SplashScreen from 'expo-splash-screen';
import { useCallback } from 'react';

// Prevent auto-hide so we control when it disappears
SplashScreen.preventAutoHideAsync();

// Inside the root component, after data is loaded:
const onLayoutRootView = useCallback(async () => {
  await SplashScreen.hideAsync();
}, []);

// Apply onLayout to the root View
```

The splash screen shows `splash-icon.png` (the SK logo) centered on `#F8FAFC` background. It auto-hides once the root component mounts and calls `hideAsync()`.

---

## UI Mockups

### App Icon (1024×1024)

```
┌──────────────────────────┐
│                          │
│      ██████████████      │
│      ██████████████      │
│      ████  ████████      │  Background: #2563EB
│      ████    ██████      │  Rounded corners: 180px radius
│      ████████  ████      │
│      ██████████████      │  White "SK" centered
│      ████████  ████      │  Font: Bold sans-serif, 400px
│      ████        ██      │
│      ████████████████    │
│      ██████████████      │
│                          │
└──────────────────────────┘
```

### Splash Screen Layout

```
┌─────────────────────┐
│                     │
│                     │
│                     │
│                     │
│                     │
│      ┌───────┐      │  Background: #F8FAFC
│      │  SK   │      │  Centered SK logo (200×200)
│      │ (logo)│      │  Blue circle with white text
│      └───────┘      │
│                     │
│                     │
│                     │
│                     │
│                     │
└─────────────────────┘
```

### Feature Graphic (1024×500)

```
┌──────────────────────────────────────────┐
│                                          │
│           S p o r t y K i d s            │  Background: #2563EB
│         Sports news for kids             │  "SportyKids": white, bold, 72px
│                                          │  Subtitle: white, 32px
└──────────────────────────────────────────┘
```

---

## Acceptance Criteria

### AC1: Asset Generation
- [ ] Running `npm run generate-assets --workspace=apps/mobile` creates all 5 PNG files in `apps/mobile/src/assets/`.
- [ ] `icon.png` is exactly 1024×1024 pixels.
- [ ] `adaptive-icon.png` is exactly 512×512 pixels with transparent background.
- [ ] `splash-icon.png` is exactly 200×200 pixels with transparent background.
- [ ] `favicon.png` is exactly 48×48 pixels.
- [ ] `feature-graphic.png` is exactly 1024×500 pixels.
- [ ] All files are valid PNG format (verified by sharp metadata read-back).
- [ ] Script is idempotent — running twice produces identical output.

### AC2: app.json Configuration
- [ ] `apps/mobile/app.json` references icon, splash, adaptiveIcon, and favicon.
- [ ] `expo start` shows the custom splash screen instead of the default Expo one.
- [ ] `eas build --profile preview --platform ios` generates an IPA with the custom icon.

### AC3: Dynamic API_BASE
- [ ] `apps/mobile/src/config.ts` exports `API_BASE` as a string.
- [ ] When `EXPO_PUBLIC_API_BASE` is set, that value is used.
- [ ] When running an EAS build with `channel=production`, API_BASE is `https://sportykids-api.fly.dev/api`.
- [ ] When running `expo start` on a physical device, API_BASE uses the debugger host IP.
- [ ] When running `expo start` on a simulator, API_BASE falls back to `http://localhost:3001/api`.
- [ ] `apps/mobile/.env.example` exists with documented variables.

### AC4: Dockerfile
- [ ] `docker build -f apps/api/Dockerfile .` succeeds from the project root.
- [ ] The resulting image runs and responds to `GET /api/health` on port 8080.
- [ ] The image runs as non-root user `sportykids`.
- [ ] Image size is under 500MB.
- [ ] Prisma client is generated and functional inside the image.

### AC5: Fly.io Deployment
- [ ] `fly.toml` exists at project root with app name `sportykids-api`.
- [ ] Health check path is `/api/health`.
- [ ] Release command runs Prisma migrations.
- [ ] `fly deploy` from local machine succeeds (given `FLY_API_TOKEN`).

### AC6: CI/CD
- [ ] `.github/workflows/ci.yml` has a `deploy` job.
- [ ] Deploy job only runs on push to `main` (not on PRs).
- [ ] Deploy job depends on the existing build job succeeding.
- [ ] Deploy uses `superfly/flyctl-actions` with `FLY_API_TOKEN` secret.
- [ ] Concurrent deploys do not cancel each other.

### AC7: EAS Submit Config
- [ ] `eas.json` has `channel` field in all build profiles.
- [ ] `eas.json` has `submit.production` with iOS and Android sections.
- [ ] `eas.json` has `cli.appVersionSource: "remote"`.
- [ ] `eas.json` has `autoIncrement: true` for production iOS and Android.

### AC8: ASO Metadata
- [ ] `apps/mobile/store-metadata/en.json` and `es.json` exist.
- [ ] Both contain `name`, `subtitle`, `description`, `keywords`, `promotionalText`, `category`.
- [ ] Keywords are under 100 characters (iOS limit).
- [ ] Description is under 4000 characters (both stores).

### AC9: Documentation
- [ ] `docs/en/11-store-deployment.md` exists with store setup steps.
- [ ] `docs/es/11-despliegue-tiendas.md` exists (Spanish translation).
- [ ] Both docs reference specific `eas.json` fields to update.

### AC10: Splash Screen
- [ ] `expo-splash-screen` `preventAutoHideAsync()` is called before component mount.
- [ ] `hideAsync()` is called after root component layout.
- [ ] Splash shows the SK logo on `#F8FAFC` background.

---

## Technical Requirements

### Dependencies to Add

| Package | Workspace | Type | Purpose |
|---------|-----------|------|---------|
| `sharp` | `apps/mobile` | devDependency | Asset generation script |

No other new dependencies required. `expo-splash-screen` ships with Expo SDK 54. `expo-constants` is already installed.

### Files to Create

| File | Description |
|------|-------------|
| `apps/mobile/scripts/generate-assets.mjs` | Asset generation script |
| `apps/mobile/src/assets/icon.png` | App icon (generated) |
| `apps/mobile/src/assets/adaptive-icon.png` | Android adaptive icon (generated) |
| `apps/mobile/src/assets/splash-icon.png` | Splash screen icon (generated) |
| `apps/mobile/src/assets/favicon.png` | Web favicon (generated) |
| `apps/mobile/src/assets/feature-graphic.png` | Play Store feature graphic (generated) |
| `apps/mobile/.env.example` | Mobile environment variables template |
| `apps/api/Dockerfile` | Production API Docker image |
| `apps/api/.dockerignore` | Docker build exclusions |
| `fly.toml` | Fly.io deployment config |
| `apps/mobile/store-metadata/en.json` | English ASO metadata |
| `apps/mobile/store-metadata/es.json` | Spanish ASO metadata |
| `docs/en/11-store-deployment.md` | Deployment documentation (EN) |
| `docs/es/11-despliegue-tiendas.md` | Deployment documentation (ES) |

### Files to Modify

| File | Changes |
|------|---------|
| `apps/mobile/app.json` | Add icon, splash, adaptiveIcon, web.favicon fields |
| `apps/mobile/eas.json` | Add channels, env vars, cli config, autoIncrement |
| `apps/mobile/package.json` | Add `generate-assets` script, `sharp` devDependency |
| `apps/mobile/src/config.ts` | Replace hardcoded API_BASE with fallback chain |
| `apps/mobile/src/App.tsx` | Add splash screen hide logic |
| `.github/workflows/ci.yml` | Add deploy job |
| `.gitignore` | Add mobile .env files and google-service-account.json |

### Build & Verification Commands

```bash
# Generate assets
cd apps/mobile && npm run generate-assets

# Verify Dockerfile builds
docker build -f apps/api/Dockerfile -t sportykids-api .
docker run -p 8080:8080 -e DATABASE_URL="..." sportykids-api

# Verify EAS config
cd apps/mobile && npx eas build --profile preview --platform ios --non-interactive --dry-run

# Run existing tests (should still pass)
npm run test:all
```

---

## Implementation Decisions

| Decision | Rationale |
|----------|-----------|
| `sharp` for asset generation, not Canvas/Puppeteer | sharp is fast, has no native GUI dependencies, works in CI, and handles SVG→PNG natively |
| SVG text overlay instead of font rendering | sharp cannot load custom fonts; SVG with system fonts (Arial) produces clean text rendering without external dependencies |
| `fly.toml` at project root, not in `apps/api/` | Fly CLI expects `fly.toml` at the working directory; placing it at root with `build.dockerfile` pointing to `apps/api/Dockerfile` is the standard monorepo pattern |
| Madrid (`mad`) as primary Fly region | Target audience is Spanish children; lowest latency |
| `auto_stop_machines = "stop"` | Saves cost during low-traffic periods (beta); machines wake in ~300ms on request |
| `min_machines_running = 1` | Ensures at least one machine is always warm for health checks and cron jobs |
| `appVersionSource: "remote"` in EAS | EAS manages version/build numbers, avoiding conflicts between developers |
| Android submit to `internal` track | Phase 5 beta testing uses internal track; promote to production later |
| Release command for Prisma migrations | Runs before new version goes live; if migration fails, deploy is aborted |
| No preview deployment environment | Simplicity — one production environment is sufficient for beta; preview can be added later |
| Generated assets are committed to git | They are small (~50KB total), deterministic, and needed by EAS builds which clone the repo |
| Fallback chain for API_BASE | Maximum flexibility: env var override for CI, EAS channel for builds, debugger host for dev, localhost as last resort |

---

## Testing Decisions

### Existing Tests Must Pass

All 652+ existing tests must continue to pass after these changes. The changes are additive and do not modify any application logic.

### New Tests to Write

**`apps/mobile/__tests__/config.test.ts`** — Unit tests for the new `resolveApiBase` function:

- `EXPO_PUBLIC_API_BASE` env var takes priority over everything
- EAS channel `"production"` returns production URL
- EAS channel `"preview"` returns preview URL
- Debugger host IP is extracted correctly from `hostUri`
- Fallback to `localhost` when no other signal available

To make `resolveApiBase` testable, export it as a named export in addition to the `API_BASE` constant. Mock `expo-constants` and `process.env` in tests.

**Asset generation script self-validation**: The script validates output dimensions after generation. No separate test file — the script's validation step serves as the test:

```javascript
// At end of generate-assets.mjs:
for (const [name, expectedWidth, expectedHeight] of manifest) {
  const meta = await sharp(outputPath).metadata();
  assert.strictEqual(meta.width, expectedWidth, `${name} width mismatch`);
  assert.strictEqual(meta.height, expectedHeight, `${name} height mismatch`);
}
console.log('All assets generated and validated.');
```

**Dockerfile**: Manual verification only (requires Docker daemon). Not included in CI test suite:

```bash
docker build -f apps/api/Dockerfile -t sportykids-api:test .
docker run --rm -p 8080:8080 -e DATABASE_URL="postgresql://..." sportykids-api:test &
curl http://localhost:8080/api/health
```

---

## Out of Scope

- **Custom domain** — Using `*.fly.dev` for now. Custom domain setup is a future task.
- **Preview/staging environment** — Single production environment for beta. Preview environment can be added post-launch.
- **Real brand assets** — Designer-created icons and graphics. The generated placeholders are sufficient for beta.
- **App Store / Play Store submission** — This phase prepares everything but does not submit. Submission happens after Phase 5 beta.
- **Web deployment** — The Next.js webapp deployment is a separate concern (likely Vercel). This PRD covers API + mobile only.
- **Push notification certificates** — APNs keys and FCM config are handled separately.
- **Monitoring dashboards** — Sentry and PostHog are already integrated; creating dashboards is operational, not code.
- **CDN / media storage** — Images are served from RSS source URLs. No CDN needed yet.
- **Load testing** — Not needed for 5–10 family beta.
- **Multi-region deployment** — Single region (Madrid) is sufficient for Spanish beta audience.

---

## Future Considerations

1. **Custom domain**: `api.sportykids.app` with SSL via Fly.io certificates.
2. **Preview environment**: `sportykids-api-preview.fly.dev` deployed from PRs, torn down after merge.
3. **Web deployment**: Vercel with `NEXT_PUBLIC_API_BASE` pointing to the Fly.io API.
4. **Professional branding**: Replace generated assets with designer artwork before public launch.
5. **Automated screenshots**: Use Maestro or Detox to capture store screenshots in CI.
6. **Multi-region**: Add `cdg` (Paris), `lhr` (London) regions as user base grows beyond Spain.
7. **Database read replicas**: Fly Postgres supports read replicas for scaling read-heavy queries.
8. **Background workers**: Separate Fly machine for cron jobs so they don't compete with API requests.
9. **Rate limiting with Redis**: Move from IP-based in-memory rate limiting to Redis-backed (shared across machines).
10. **App Store review automation**: Fastlane or EAS metadata for automated screenshot upload and release notes.
