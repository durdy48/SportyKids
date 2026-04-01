# 11. Store Deployment Guide

This document covers the full deployment pipeline: production infrastructure, app store preparation, and submission workflow.

## Production Infrastructure

### Fly.io (API)

The API is deployed to [Fly.io](https://fly.io) in the Madrid (`mad`) region.

**Configuration**: `fly.toml` at project root.

```bash
# Create the app (one-time)
fly apps create sportykids-api

# Create managed Postgres
fly postgres create --name sportykids-db --region mad --vm-size shared-cpu-1x --initial-cluster-size 1 --volume-size 1
fly postgres attach sportykids-db --app sportykids-api

# Create Redis (Upstash via Fly marketplace)
fly redis create --name sportykids-redis --region mad --plan free

# Set secrets
fly secrets set \
  JWT_SECRET="<random-64-char>" \
  JWT_REFRESH_SECRET="<random-64-char>" \
  AI_PROVIDER="ollama" \
  SENTRY_DSN="" \
  POSTHOG_API_KEY=""

# Deploy
fly deploy
```

Database migrations run automatically before each deploy via `release_command` in `fly.toml`.

### CI/CD

Merging to `main` triggers automatic deployment via GitHub Actions:

1. **Setup** → install dependencies
2. **Lint & Typecheck** → ESLint + TypeScript
3. **Test** → API, Web, Mobile test suites
4. **Build** → API + Web compilation
5. **Deploy** → `fly deploy --remote-only`

**Required GitHub secret**: `FLY_API_TOKEN` — obtain via `fly tokens create deploy`.

### Docker

The API Dockerfile (`apps/api/Dockerfile`) is a multi-stage build:

1. **deps** — installs npm dependencies
2. **builder** — generates Prisma client, compiles TypeScript
3. **runner** — production image with non-root `sportykids` user

```bash
# Build locally
docker build -f apps/api/Dockerfile -t sportykids-api .

# Run locally
docker run -p 8080:8080 -e DATABASE_URL="postgresql://..." sportykids-api
```

## Apple Developer Account Setup

1. Enroll at https://developer.apple.com/programs/ ($99/year)
2. Create App ID with bundle identifier `com.sportykids.app`
3. Create App Store Connect listing for "SportyKids"
4. Note the ASC App ID (numeric) → update `eas.json` `submit.production.ios.ascAppId`
5. Note the Team ID → update `eas.json` `submit.production.ios.appleTeamId`
6. For OAuth (Apple Sign In): create Services ID, configure domains/redirect URLs
7. Age rating: set to 4+ (no objectionable content)
8. Privacy nutrition labels: configure based on data collected (name, email, usage data)
9. Kids category: select "Kids" primary category, age band 9-11

## Google Play Console Setup

1. Register at https://play.google.com/console ($25 one-time)
2. Create app "SportyKids" with default language Spanish (Spain)
3. Complete Data Safety form (aligns with our Privacy Policy)
4. Set content rating → IARC questionnaire (no violence, no gambling, no user-generated content)
5. Target audience: Under 13 → triggers Families Policy compliance
6. Create a service account for automated uploads:
   - Google Cloud Console → IAM → Service Account → download JSON key
   - Place as `apps/mobile/google-service-account.json` (gitignored)
7. Grant service account "Release Manager" role in Play Console
8. Create internal testing track for Phase 5 beta

## OAuth Production Callback URLs

When accounts are created, update environment variables:

| Provider | Callback URL |
|----------|-------------|
| Google (web) | `https://sportykids-api.fly.dev/api/auth/google/callback` |
| Apple (web) | `https://sportykids-api.fly.dev/api/auth/apple/callback` |

Set via: `GOOGLE_CALLBACK_URL`, `GOOGLE_SUCCESS_REDIRECT_URL`.

## EAS Build & Submit

### Build profiles

| Profile | Channel | Use case |
|---------|---------|----------|
| `development` | development | Dev client with simulator support |
| `preview` | preview | Internal distribution (APK + Ad Hoc) |
| `production` | production | Store submission with auto-increment |

### Building

```bash
# Preview build (internal testing)
cd apps/mobile
eas build --profile preview --platform all

# Production build (store submission)
eas build --profile production --platform all
```

### Submitting

```bash
# iOS — requires Apple Developer account credentials in eas.json
eas submit --platform ios --latest

# Android — requires google-service-account.json
eas submit --platform android --latest
```

Update `eas.json` submit placeholders with real values before first submission:
- `ios.appleId` → your Apple ID email
- `ios.ascAppId` → numeric App Store Connect app ID
- `ios.appleTeamId` → your Team ID
- `android.serviceAccountKeyPath` → path to Google service account JSON

## ASO Metadata

Store metadata files are in `apps/mobile/store-metadata/`:
- `en.json` — English metadata
- `es.json` — Spanish metadata

Both contain: `name`, `subtitle`, `description`, `keywords`, `promotionalText`, `category`, `secondaryCategory`.

Copy these values into the respective store consoles when creating listings.

## Screenshots

Screenshots are captured manually from simulators. Required captures (5 per locale, per platform):

1. **Home Feed** — sport cards with colored headers, filters visible
2. **Reels** — vertical video feed with a reel playing
3. **Quiz** — question screen with answer options and score counter
4. **Collection** — sticker collection grid showing different rarities
5. **Parental Controls** — parental panel showing time limits and activity chart

### iOS dimensions

| Device | Dimensions | Required |
|--------|-----------|----------|
| iPhone 6.7" (15 Pro Max) | 1290×2796 | Yes (mandatory) |
| iPhone 6.5" (14 Plus) | 1284×2778 | Yes |
| iPad 12.9" (6th gen) | 2048×2732 | If `supportsTablet: true` |

### Android dimensions

| Type | Dimensions | Required |
|------|-----------|----------|
| Phone | 1080×1920 (min) | Yes, 2-8 screenshots |
| Feature graphic | 1024×500 | Yes (generated by asset script) |

Capture with light theme, sample data visible, Spanish locale first, then English.
