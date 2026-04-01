# Phase 5: Beta Testing & Store Launch

| Field | Value |
|-------|-------|
| **Phase** | 5 — Beta Testing & Store Launch |
| **Priority** | P0 (final phase before public availability) |
| **Target** | Public launch on App Store + Google Play |
| **Dependencies** | Phases 0-4 complete (including Accessibility & Production Quality) |
| **Estimated effort** | 3-4 weeks (includes store review turnaround) |
| **Launch scope** | Mobile only (iOS + Android). Web remains internal demo. |

---

## 1. Overview & Goals

SportyKids has completed all technical phases (0 through 4, including accessibility audit, Sentry mobile, and E2E tests). The app has never been used by its target audience — children aged 6-14 and their parents — outside of development.

Phase 5 bridges the gap between "technically ready" and "publicly available" by:

1. **Setting up a staging environment** for beta builds to hit a real but isolated backend.
2. **Distributing beta builds** to 2 confirmed families via TestFlight and Google Play Internal Testing.
3. **Running a structured 3-week beta protocol** with monitoring and feedback collection.
4. **Preparing all store assets and metadata** for submission.
5. **Submitting to Apple App Store and Google Play Store** and handling review cycles.

### Goals

- Validate the full end-to-end experience with real families (onboarding, daily use, parental controls).
- Achieve NPS >= 7/10 from parent feedback.
- Achieve 0 critical crashes during the beta period.
- Successfully submit and get approved on both App Store and Google Play.
- Launch version 1.0.0 with gradual rollout.

### Non-Goals

- Marketing campaigns or press outreach.
- ASO optimization beyond initial metadata.
- Expansion to new markets or languages.
- Apple "Designed for Kids" program (apply post-launch with real data).
- Web app store presence (PWA listing, etc.).
- Monetization or in-app purchases.

---

## 2. Technical Requirements

### 2.1 Staging Environment

The preview EAS channel currently points to `sportykids-api-preview.fly.dev`. This will be renamed to `sportykids-api-staging.fly.dev` with a dedicated Fly.io app and PostgreSQL database.

#### 2.1.1 `fly.staging.toml`

Create at repository root:

```toml
# fly.staging.toml — Staging environment for beta testing
app = "sportykids-api-staging"
primary_region = "mad"

[build]
  dockerfile = "apps/api/Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"
  LOG_LEVEL = "info"
  CACHE_PROVIDER = "memory"          # No Redis needed for staging
  MODERATION_FAIL_OPEN = "false"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0            # Allow full stop when idle (cost saving)

  [http_service.concurrency]
    type = "requests"
    hard_limit = 50
    soft_limit = 25

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  path = "/api/health"
  timeout = "5s"

[deploy]
  release_command = "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma"
```

Key differences from production (`fly.toml`):
- `app = "sportykids-api-staging"` (separate Fly.io app)
- `CACHE_PROVIDER = "memory"` (no Redis needed, fewer moving parts)
- `min_machines_running = 0` (stop when idle to save costs)
- Lower concurrency limits (only 2 families using it)

#### 2.1.2 Setup Script

Create `scripts/setup-staging.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# scripts/setup-staging.sh — Create and configure the staging environment on Fly.io
#
# Prerequisites:
#   - flyctl installed and authenticated (`fly auth login`)
#   - Repository root as working directory
#
# Usage:
#   bash scripts/setup-staging.sh

APP_NAME="sportykids-api-staging"
REGION="mad"

echo "=== SportyKids Staging Setup ==="

# 1. Create the Fly.io app (if it doesn't exist)
if fly apps list | grep -q "$APP_NAME"; then
  echo "[skip] App $APP_NAME already exists"
else
  echo "[create] Creating Fly.io app: $APP_NAME"
  fly apps create "$APP_NAME" --org personal
fi

# 2. Provision PostgreSQL (Fly Postgres)
PG_APP="${APP_NAME}-db"
if fly apps list | grep -q "$PG_APP"; then
  echo "[skip] Postgres app $PG_APP already exists"
else
  echo "[create] Provisioning PostgreSQL for staging"
  fly postgres create \
    --name "$PG_APP" \
    --region "$REGION" \
    --vm-size shared-cpu-1x \
    --initial-cluster-size 1 \
    --volume-size 1
  echo "[attach] Attaching PostgreSQL to $APP_NAME"
  fly postgres attach "$PG_APP" --app "$APP_NAME"
fi

# 3. Set required secrets
echo ""
echo "[secrets] Setting secrets for $APP_NAME..."
echo "You will be prompted for values. Press Enter to skip any secret."
echo ""

read -rp "JWT_SECRET (required): " JWT_SECRET
read -rp "JWT_REFRESH_SECRET (required): " JWT_REFRESH_SECRET
read -rp "SENTRY_DSN (optional, Enter to skip): " SENTRY_DSN

SECRETS="JWT_SECRET=$JWT_SECRET JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
if [ -n "$SENTRY_DSN" ]; then
  SECRETS="$SECRETS SENTRY_DSN=$SENTRY_DSN"
fi

fly secrets set $SECRETS --app "$APP_NAME"

# 4. Deploy
echo ""
echo "[deploy] Deploying to staging..."
fly deploy --config fly.staging.toml --app "$APP_NAME"

# 5. Seed the staging database
echo ""
echo "[seed] Seeding staging database with test data..."
fly ssh console --app "$APP_NAME" -C "npx tsx prisma/seed.ts"

echo ""
echo "=== Staging setup complete ==="
echo "API URL: https://$APP_NAME.fly.dev/api"
echo "Health:  https://$APP_NAME.fly.dev/api/health"
echo ""
echo "Next steps:"
echo "  1. Update apps/mobile/eas.json preview channel to point to https://$APP_NAME.fly.dev/api"
echo "  2. Build preview: eas build --profile preview --platform all"
```

#### 2.1.3 EAS Preview Channel Update

In `apps/mobile/eas.json`, update the preview build to point to the staging API:

```jsonc
// Before:
"EXPO_PUBLIC_API_BASE": "https://sportykids-api-preview.fly.dev/api"

// After:
"EXPO_PUBLIC_API_BASE": "https://sportykids-api-staging.fly.dev/api"
```

---

### 2.2 App Version & Build Configuration

#### 2.2.1 `app.json` Changes

File: `apps/mobile/app.json`

```jsonc
{
  "expo": {
    "name": "SportyKids",
    "slug": "sportykids",
    "version": "1.0.0",                    // was "0.1.0"
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "icon": "./src/assets/icon.png",
    "splash": {
      "image": "./src/assets/splash-icon.png",
      "backgroundColor": "#F8FAFC",
      "resizeMode": "contain"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.sportykids.app",
      "buildNumber": "1",                  // NEW — required for App Store
      "infoPlist": {                        // NEW — Kids category requirements
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./src/assets/adaptive-icon.png",
        "backgroundColor": "#2563EB"
      },
      "package": "com.sportykids.app",
      "versionCode": 1                     // NEW — required for Google Play
    },
    "web": {
      "favicon": "./src/assets/favicon.png"
    },
    "plugins": [
      ["@sentry/react-native/expo", {
        "organization": "sportykids",
        "project": "mobile"
      }]
    ]
  }
}
```

Changes:
- `version`: `"0.1.0"` -> `"1.0.0"`
- `ios.buildNumber`: Added `"1"`
- `ios.infoPlist.ITSAppUsesNonExemptEncryption`: `false` (avoids export compliance prompt)
- `android.versionCode`: Added `1`

#### 2.2.2 `eas.json` Changes

File: `apps/mobile/eas.json`

```jsonc
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
        "EXPO_PUBLIC_API_BASE": "https://sportykids-api-staging.fly.dev/api"
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
        // -------------------------------------------------------
        // HOW TO FILL THESE VALUES:
        // 1. appleId     — Your Apple ID email used for App Store Connect
        // 2. ascAppId    — Found in App Store Connect > App > General > App Information
        //                   It's the numeric ID (e.g., "6741234567")
        // 3. appleTeamId — Found in https://developer.apple.com/account > Membership
        //                   It's a 10-char alphanumeric (e.g., "ABCD1234EF")
        //
        // These are set AFTER creating the app in App Store Connect (Section 4.1)
        // -------------------------------------------------------
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
        // -------------------------------------------------------
        // HOW TO SET UP:
        // 1. Create a Google Cloud service account with "Service Account User" role
        // 2. In Google Play Console > Setup > API access, link the service account
        // 3. Grant "Release manager" permission to the service account
        // 4. Download the JSON key and save as apps/mobile/google-service-account.json
        // 5. Add google-service-account.json to .gitignore (contains secrets)
        //
        // track options: "internal" -> "alpha" -> "beta" -> "production"
        // Start with "internal" for beta, promote to "production" for launch
        // -------------------------------------------------------
      }
    }
  }
}
```

**Important**: Add `google-service-account.json` to `apps/mobile/.gitignore`.

---

### 2.3 Store Metadata & Screenshots

#### 2.3.1 Review Existing Metadata

The existing files at `apps/mobile/store-metadata/es.json` and `en.json` are complete and well-written. Minor additions needed:

**Add to both `es.json` and `en.json`:**

```jsonc
{
  // ... existing fields ...
  "supportUrl": "https://sportykids-api.fly.dev/api/health",  // Placeholder — replace with real support page
  "privacyPolicyUrl": "https://sportykids.app/privacy",       // Points to web app /privacy route
  "marketingUrl": "",                                          // Optional, leave empty for now
  "ageRating": "4+",                                          // Apple: 4+ / Google: "Everyone"
  "copyright": "2026 SportyKids"
}
```

**Apple-specific fields** (add to both locale files):

| Field | ES | EN |
|-------|----|----|
| `whatsNew` | "Primera version publica. Noticias deportivas seguras para ninos." | "First public release. Safe sports news for kids." |

**Google-specific fields** (add to both locale files):

| Field | ES | EN |
|-------|----|----|
| `shortDescription` | "Noticias deportivas seguras para ninos de 6-14 anos" | "Safe sports news for kids aged 6-14" |

The `shortDescription` must be <= 80 characters (Google Play limit).

#### 2.3.2 Screenshot Generation Script

Create `scripts/generate-screenshots.mjs`:

This Playwright script captures the web app at mobile viewport sizes to generate store screenshots. While these are web captures (not native screenshots), they accurately represent the UI since the web and mobile apps share the same design system and layout.

```javascript
// scripts/generate-screenshots.mjs
//
// Generates store screenshots using Playwright against the running web app.
// Prerequisites: npm run dev:web (running on localhost:3000)
// Usage: node scripts/generate-screenshots.mjs
//
// Output:
//   apps/mobile/store-metadata/screenshots/ios/    (iPhone 15 Pro: 1179x2556)
//   apps/mobile/store-metadata/screenshots/android/ (Pixel 8: 1080x2400)

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DEVICES = {
  ios: {
    name: 'iPhone 15 Pro',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3, // Output: 1179x2556
    outputDir: join(ROOT, 'apps/mobile/store-metadata/screenshots/ios'),
  },
  android: {
    name: 'Pixel 8',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625, // Output: ~1080x2402
    outputDir: join(ROOT, 'apps/mobile/store-metadata/screenshots/android'),
  },
};

const SCREENS = [
  {
    name: '01-home-feed',
    path: '/',
    waitFor: '[data-testid="news-card"]',
    description: 'Home feed with personalized sports news',
  },
  {
    name: '02-quiz',
    path: '/quiz',
    waitFor: '[data-testid="quiz-game"]',
    description: 'Daily sports quiz',
  },
  {
    name: '03-reels',
    path: '/reels',
    waitFor: '[data-testid="reel-card"]',
    description: 'Short sports video reels',
  },
  {
    name: '04-collection',
    path: '/collection',
    waitFor: '[data-testid="sticker-card"]',
    description: 'Sticker collection and achievements',
  },
  {
    name: '05-parental',
    path: '/parents',
    waitFor: '[data-testid="parental-panel"]',
    description: 'Parental controls dashboard',
  },
];

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function captureScreenshots() {
  const browser = await chromium.launch();

  for (const [platform, device] of Object.entries(DEVICES)) {
    mkdirSync(device.outputDir, { recursive: true });
    console.log(`\n--- ${device.name} (${platform}) ---`);

    const context = await browser.newContext({
      viewport: device.viewport,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });

    // Set up a user context (skip onboarding)
    await context.addCookies([]);
    const page = await context.newPage();

    // Seed user via localStorage to skip onboarding
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem(
        'sportykids-user',
        JSON.stringify({
          id: 'screenshot-user',
          name: 'Demo',
          age: 10,
          favoriteSports: ['football', 'basketball', 'tennis'],
          locale: 'en',
        }),
      );
    });

    for (const screen of SCREENS) {
      console.log(`  Capturing ${screen.name}...`);
      await page.goto(`${BASE_URL}${screen.path}`, {
        waitUntil: 'networkidle',
      });

      // Wait for key element (with timeout fallback)
      try {
        await page.waitForSelector(screen.waitFor, { timeout: 5000 });
      } catch {
        console.log(`    Warning: ${screen.waitFor} not found, capturing anyway`);
      }

      // Small delay for animations to settle
      await page.waitForTimeout(500);

      const filepath = join(device.outputDir, `${screen.name}.png`);
      await page.screenshot({ path: filepath, fullPage: false });
      console.log(`    Saved: ${filepath}`);
    }

    await context.close();
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to apps/mobile/store-metadata/screenshots/');
}

captureScreenshots().catch((err) => {
  console.error('Screenshot generation failed:', err);
  process.exit(1);
});
```

**Screenshot output structure:**

```
apps/mobile/store-metadata/screenshots/
├── ios/
│   ├── 01-home-feed.png      (1179x2556 — iPhone 15 Pro 6.7")
│   ├── 02-quiz.png
│   ├── 03-reels.png
│   ├── 04-collection.png
│   └── 05-parental.png
└── android/
    ├── 01-home-feed.png       (1080x2400 — Pixel 8)
    ├── 02-quiz.png
    ├── 03-reels.png
    ├── 04-collection.png
    └── 05-parental.png
```

Add `apps/mobile/store-metadata/screenshots/` to `.gitignore` (generated artifacts).

**ASCII mockup of screenshot composition (for reference):**

```
+------------------+    +------------------+    +------------------+
|   SportyKids     |    |   Daily Quiz     |    |   Reels          |
|   ____________   |    |   ____________   |    |                  |
|  | News Card  |  |    |  | Question   |  |    |  +----------+   |
|  | Football   |  |    |  | __________ |  |    |  | Video    |   |
|  |____________|  |    |  | A) Option  |  |    |  | Preview  |   |
|  | News Card  |  |    |  | B) Option  |  |    |  +----------+   |
|  | Basketball |  |    |  | C) Option  |  |    |  +----------+   |
|  |____________|  |    |  | D) Option  |  |    |  | Video    |   |
|  | News Card  |  |    |  |____________|  |    |  | Preview  |   |
|  |____________|  |    |                  |    |  +----------+   |
|  [Filters Bar ]  |    |  Score: 45 pts   |    |                  |
+------------------+    +------------------+    +------------------+
   01-home-feed            02-quiz               03-reels

+------------------+    +------------------+
|   Collection     |    |   Parents        |
|   ____________   |    |   ____________   |
|  | Sticker    |  |    |  | Activity   |  |
|  | Grid       |  |    |  | Summary    |  |
|  |  [] [] []  |  |    |  |____________|  |
|  |  [] [] []  |  |    |  | Time       |  |
|  |____________|  |    |  | Limits     |  |
|  | Streak: 5  |  |    |  |____________|  |
|  | Badge: ... |  |    |  | Schedule   |  |
|  |____________|  |    |  |____________|  |
+------------------+    +------------------+
   04-collection           05-parental
```

#### 2.3.3 Store Assets Checklist

**Apple App Store requires:**

| Asset | Spec | Status |
|-------|------|--------|
| App Icon | 1024x1024 PNG, no alpha | Exists (`icon.png` via generate-assets) |
| Screenshots 6.7" | 1290x2796 or 1179x2556, 5-10 images | Generate via script |
| Screenshots 6.5" | 1242x2688, 5-10 images | Optional (6.7" can auto-scale) |
| Screenshots 5.5" | 1242x2208, 5-10 images | Optional |
| App Preview Video | 15-30s, optional | Out of scope |
| Privacy Policy URL | Public HTTPS | Exists: web `/privacy` |
| Support URL | Public HTTPS | Need: use `/api/health` as placeholder or create page |
| Description | 4000 chars max | Exists in `en.json` / `es.json` |
| Keywords | 100 chars max, comma-separated | Exists in metadata files |
| What's New | Required for updates | Add to metadata |

**Google Play Store requires:**

| Asset | Spec | Status |
|-------|------|--------|
| App Icon | 512x512 PNG, 32-bit | Exists (resize from 1024x1024) |
| Feature Graphic | 1024x500 PNG/JPG | Exists via `generate-assets` script |
| Screenshots | 2-8 per device type, 16:9 or 9:16 | Generate via script |
| Short Description | 80 chars max | Add to metadata |
| Full Description | 4000 chars max | Exists |
| Privacy Policy URL | Public HTTPS | Exists |
| Content Rating | IARC questionnaire | Complete during submission |
| Data Safety | Form in Play Console | Complete during submission |

---

### 2.4 Review Notes & Store Compliance

#### 2.4.1 `specs/mvp-to-product-5/review-notes.md`

Create this file with prepared responses for common rejection scenarios:

**Apple Review Notes (to include in "Notes for Review" field):**

```
SportyKids is a kids' sports news app for ages 6-14. Key review information:

KIDS CATEGORY:
- Target age range: 6-14 years old
- All content is moderated by AI before being shown to children
- Content sources are exclusively verified sports news outlets (182 RSS sources)
- YouTube embeds use child-safe parameters (no ads, no related videos, sandbox iframe)
- No user-generated content visible to children
- No external links that leave the app without parental controls

PARENTAL CONTROLS:
- 4-digit PIN required to access parental settings
- Parents can set time limits per content type (news, reels, quizzes)
- Parents can restrict allowed sports and content formats
- Schedule lock (bedtime hours) enforced server-side
- Weekly activity digest available for parents

SIGN IN WITH APPLE:
- Available on the Login screen alongside Google Sign In and email registration
- Anonymous usage is also supported (no account required)

PRIVACY:
- Privacy Policy: https://sportykids-api.fly.dev/privacy (also accessible in-app)
- No data collected without parental consent for children under 13
- COPPA and GDPR-K compliant age gate at first launch
- Analytics (PostHog) only initialized after parental consent
- Sentry crash reporting sends no PII

TEST ACCOUNT:
- The app can be used without an account (anonymous mode)
- To test parental controls: create a user, then set up a PIN in the Parents tab
```

**Google Review Notes (for "App content" declarations):**

```
FAMILIES POLICY COMPLIANCE:
- App is designed for children aged 6-14
- All content is AI-moderated before display
- No behavioral advertising
- No data collection without verifiable parental consent (COPPA)
- Parental controls with PIN protection

CONTENT RATING (IARC):
- No violence, no sexual content, no profanity
- Sports news only from verified journalistic sources
- Recommended rating: PEGI 3 / ESRB Everyone
```

#### 2.4.2 Apple Kids Category Requirements

Apple has specific requirements for Kids Category apps. Verification checklist:

| Requirement | SportyKids Status | Action Needed |
|-------------|-------------------|---------------|
| Must select a Kids age band (5 & Under, 6-8, 9-11) | Target 6-14, select "9-11" primary | Select in App Store Connect |
| No third-party analytics without consent | PostHog gated on `consentGiven` | Verified |
| No external links without parental gate | YouTube embeds sandboxed, no raw external links | Verified |
| No ads | No ads in app | Verified |
| Must comply with COPPA | Age gate + parental consent flow implemented | Verified |
| Sign In with Apple required (if any social login) | Apple Sign In implemented | Verified |
| Privacy Policy must be accessible | `/privacy` page exists | Verified |

#### 2.4.3 Apple Privacy Nutrition Labels

Map of data collection for Apple's privacy questions:

| Data Type | Collected? | Purpose | Linked to Identity? |
|-----------|-----------|---------|---------------------|
| Contact Info (email) | Yes (optional) | Account creation | Yes (if account created) |
| Identifiers (user ID) | Yes | App functionality | Yes |
| Usage Data (quiz scores, activity) | Yes | App functionality | Yes |
| Diagnostics (crash logs) | Yes (opt-in) | Crash reporting via Sentry | No |
| Analytics | Yes (opt-in) | App improvement via PostHog | No |

**Important**: If the user stays anonymous (no account), the only data collected is a local UUID. Crash reporting via Sentry collects no PII.

Selection in App Store Connect: **"Data Used to Track You": No** / **"Data Linked to You": Contact Info (if registered), Identifiers**

#### 2.4.4 Google Data Safety Form

| Question | Answer |
|----------|--------|
| Does your app collect or share user data? | Yes |
| Is all collected data encrypted in transit? | Yes (HTTPS enforced) |
| Can users request data deletion? | Yes (`DELETE /api/users/:id/data`) |
| **Data types collected:** | |
| - Personal info (email) | Optional, for account creation |
| - App activity (quiz scores, reading history) | For app functionality |
| - Device info (crash logs) | Optional, for diagnostics |
| **Data shared with third parties?** | No (Sentry/PostHog are processors, not third-party sharing) |

#### 2.4.5 IARC Content Rating

Complete the IARC questionnaire in Google Play Console:

| Question Category | Answer |
|-------------------|--------|
| Violence | None |
| Sexual Content | None |
| Language | None |
| Controlled Substances | None |
| User Interaction | Limited (content reports only, no chat) |
| Data Sharing | With parental consent only |

Expected rating: **PEGI 3 / ESRB Everyone / USK 0**

---

## 3. Beta Testing Protocol

### 3.1 Distribution Setup

#### 3.1.1 TestFlight (iOS)

**Prerequisites:**
- Apple Developer Program membership ($99/year) — see Section 4.1.1
- App created in App Store Connect
- EAS CLI authenticated: `eas login`

**Build and distribute:**

```bash
# Build iOS preview for TestFlight
cd apps/mobile
eas build --profile preview --platform ios

# After build completes, upload to TestFlight
# Note: For TestFlight, use production profile (TestFlight IS the production pipeline)
eas build --profile production --platform ios
eas submit --platform ios --profile production
```

**Invite testers:**
1. In App Store Connect > TestFlight > Internal Testing, create group "Beta Families"
2. Add tester emails (max 100 internal testers)
3. Testers receive email invite, install via TestFlight app

#### 3.1.2 Google Play Internal Testing (Android)

**Prerequisites:**
- Google Play Console account ($25 one-time) — see Section 4.2.1
- App created in Google Play Console
- Service account key configured (see `eas.json` comments)

**Build and distribute:**

```bash
# Build Android production AAB
cd apps/mobile
eas build --profile production --platform android

# Submit to internal testing track
eas submit --platform android --profile production
```

**Invite testers:**
1. In Google Play Console > Testing > Internal testing, create email list
2. Add tester Gmail addresses
3. Share the opt-in URL with testers
4. Testers install from Play Store (marked as internal test)

### 3.2 Beta Testing Guide

Create `specs/mvp-to-product-5/beta-guide.md` with the following content:

---

**Target:** 2 confirmed families (expandable to 5-10 if needed)

**Ideal tester profile:**
- At least 1 family with a child aged 6-8
- At least 1 family with a child aged 9-14
- Mix of sports interests (not just football)
- At least 1 family willing to test in English (i18n validation)

#### Week 1 — Setup & First Impressions (Days 1-7)

| Day | Child Tasks | Parent Tasks |
|-----|-------------|--------------|
| 1 | Install app, complete onboarding | Install app, observe child's onboarding |
| 1 | Explore the home feed freely (15 min) | Set up parental PIN and configure restrictions |
| 2-7 | Use app daily for 10-15 min | Note any confusing UX or content concerns |

**Parent checklist (Week 1):**
- [ ] App installed successfully on child's device
- [ ] Onboarding completed (name, age, sports, team)
- [ ] Parental PIN created
- [ ] Time limits configured (if desired)
- [ ] Schedule lock configured (if desired)
- [ ] Child can browse news, watch reels, take quiz

#### Week 2 — Daily Use & Engagement (Days 8-14)

| Activity | Frequency | Who |
|----------|-----------|-----|
| Read 3+ news articles | Daily | Child |
| Complete the daily quiz | Daily | Child |
| Watch 2+ reels | Daily | Child |
| Check collection/stickers | 2-3 times/week | Child |
| Review activity in Parents tab | 2 times/week | Parent |
| Note any content concerns | Ongoing | Parent |
| Report inappropriate content (if seen) | As needed | Child (with parent) |

#### Week 3 — Feedback Collection (Days 15-21)

**Parent questionnaire:**

1. How easy was it to set up parental controls? (1-5)
2. Did you feel comfortable with the content your child saw? (1-5)
3. What was the most confusing part of the setup? (open)
4. Was anything missing that you needed as a parent? (open)
5. How likely are you to recommend SportyKids to another parent? (NPS 0-10)
6. How would you rate the app overall? (1-5)
7. Did you experience any crashes or errors? (yes/no + details)
8. Any other comments? (open)

**Child questionnaire (filled with parent present):**

1. What did you like the most? (options: news / quiz / reels / stickers / my team)
2. Was anything confusing or hard to understand? (open)
3. Would you use SportyKids every day? (yes / no / sometimes)
4. What sport content would you like to see more of? (open)
5. Was the app fun? (emoji scale: very fun / fun / ok / boring)

**Optional:** 30-minute video call with each family for qualitative feedback.

### 3.3 Monitoring During Beta

#### 3.3.1 Sentry Crash Monitoring

Sentry is already integrated in the mobile app (`@sentry/react-native` with `Sentry.wrap(App)`). During beta:

- **Alert threshold:** Any unhandled exception triggers a Sentry alert
- **Review cadence:** Daily check of Sentry dashboard for first 7 days, then every 2 days
- **Critical crash definition:** Any crash that closes the app (unhandled native exception or JS fatal)
- **Response SLA:** Critical crashes investigated within 24 hours, fix shipped within 48 hours

Configure Sentry alerts:
1. Set `EXPO_PUBLIC_SENTRY_DSN` in EAS production/preview builds
2. In Sentry dashboard: create alert rule "New issue in mobile project" -> notify via email

#### 3.3.2 PostHog Analytics

PostHog is opt-in and gated on `consentGiven`. If beta families consent:

- Track DAU/WAU (daily/weekly active users)
- Track feature usage: news reads, quiz completions, reel views, sticker collections
- Track onboarding completion rate
- Track retention D1, D7

If families do not consent, analytics data will not be available. Rely on manual feedback instead.

#### 3.3.3 Content Report Review

- Check `ContentReport` table daily during beta via API: `GET /api/reports/parent/:userId`
- Any reported content reviewed and actioned within 24 hours
- Track moderation false positives (content that passed AI moderation but was reported by users)

### 3.4 Go/No-Go Criteria

Before proceeding to store submission, ALL criteria must be met:

| Criterion | Threshold | Measurement |
|-----------|-----------|-------------|
| Parent NPS | >= 7/10 average | Questionnaire Q5 |
| Parent satisfaction (controls) | >= 4/5 average | Questionnaire Q1 |
| Content safety confidence | >= 4/5 average | Questionnaire Q2 |
| Critical crashes | 0 | Sentry dashboard |
| Non-critical bugs | <= 3 open (none blocking) | Manual tracking |
| Inappropriate content reports | 0 unresolved after 24h | ContentReport table |
| E2E tests | 100% passing | CI pipeline (24 Playwright tests) |
| Store blockers | 0 open | Manual checklist |
| Beta duration | >= 14 days of active use | Activity logs |

**If criteria are NOT met:**
1. Identify the gaps (which criteria failed)
2. Create fix tasks with priority P0
3. Deploy fixes to staging
4. Extend beta by 1 week
5. Re-evaluate criteria

---

## 4. Store Submission Process

### 4.1 Apple App Store

#### 4.1.1 Account Creation

**If Apple Developer account does not exist:**

1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with your Apple ID (or create one)
3. Enroll as an Individual ($99/year)
4. Wait for approval (usually 24-48 hours)
5. Accept the Apple Developer Agreement

**After account is active:**

1. Go to https://appstoreconnect.apple.com
2. Click "+" > "New App"
3. Fill in:
   - Platform: iOS
   - Name: "SportyKids"
   - Primary Language: English (U.S.)
   - Bundle ID: `com.sportykids.app` (register in Certificates, Identifiers & Profiles first)
   - SKU: `sportykids-ios`
4. Note the `ascAppId` (numeric) for `eas.json`
5. Note your `appleTeamId` from Membership page

#### 4.1.2 App Store Connect Configuration Checklist

| Step | Details | Done |
|------|---------|------|
| Create App ID | `com.sportykids.app` in Certificates portal | [ ] |
| Create app in App Store Connect | Name: "SportyKids" | [ ] |
| Set pricing | Free | [ ] |
| Select primary category | News | [ ] |
| Select secondary category | Kids | [ ] |
| Select Kids age band | 9-11 (covers primary target) | [ ] |
| Upload app icon | 1024x1024 from `store-metadata/` | [ ] |
| Upload screenshots | 5 images, 6.7" (iPhone 15 Pro) | [ ] |
| Write description | Copy from `store-metadata/en.json` | [ ] |
| Write keywords | Copy from `store-metadata/en.json` | [ ] |
| Set promotional text | Copy from `store-metadata/en.json` | [ ] |
| Set What's New | "First public release" | [ ] |
| Add Spanish localization | Copy from `store-metadata/es.json` | [ ] |
| Set Privacy Policy URL | `https://sportykids.app/privacy` or Fly.io URL | [ ] |
| Set Support URL | Create or use existing contact page | [ ] |
| Complete Privacy Nutrition Labels | See Section 2.4.3 | [ ] |
| Complete Age Rating questionnaire | Select "Made for Kids" | [ ] |
| Set `ITSAppUsesNonExemptEncryption` to NO | In `app.json` infoPlist | [ ] |
| Review Notes | Paste from Section 2.4.1 | [ ] |
| Update `eas.json` with real Apple IDs | `appleId`, `ascAppId`, `appleTeamId` | [ ] |

#### 4.1.3 Build & Submit

```bash
cd apps/mobile

# 1. Build production iOS
eas build --profile production --platform ios

# 2. Submit to App Store Connect
eas submit --platform ios --profile production

# 3. In App Store Connect:
#    - Select the uploaded build
#    - Assign to the app version 1.0.0
#    - Fill in all metadata (if not done)
#    - Click "Submit for Review"
```

**Timeline:** Apple review typically takes 1-3 business days. First submissions may take up to 7 days.

#### 4.1.4 Common Rejection Causes & Prepared Responses

| Rejection Reason | Response Strategy |
|-----------------|-------------------|
| **Guideline 1.3 — Kids Category** "App does not meet Kids Category requirements" | Point to: AI content moderation, parental PIN, no external links without gate, no ads, COPPA consent flow. Include screenshots of age gate and parental controls. |
| **Guideline 2.1 — Performance** "App crashes on launch" | Fix crash, ensure Sentry is capturing it, re-test on physical device before resubmission. |
| **Guideline 2.3.1 — Sign In with Apple** "App offers third-party login but not Sign In with Apple" | Apple Sign In IS implemented. Point reviewer to Login screen. If not visible, check OAuth env vars. |
| **Guideline 5.1.1 — Data Collection** "App collects data without adequate consent" | Point to age gate flow, COPPA consent for under-13, privacy policy. PostHog/Sentry gated on consent. |
| **Guideline 5.1.2 — Data Use and Sharing** "Privacy policy does not adequately describe data practices" | Review and update `/privacy` page to explicitly list all data types per Apple's feedback. |
| **Guideline 4.8 — Sign In** "Cannot test the app, need demo account" | App works in anonymous mode. Add clear demo instructions in Review Notes. |

### 4.2 Google Play Store

#### 4.2.1 Account Creation

**If Google Play Console account does not exist:**

1. Go to https://play.google.com/console/signup
2. Sign in with Google account
3. Accept Developer Distribution Agreement
4. Pay one-time $25 registration fee
5. Complete identity verification (may take 2-5 business days)

**After account is active:**

1. Create new app in Google Play Console
2. Fill in:
   - App name: "SportyKids"
   - Default language: English (United States)
   - App or Game: App
   - Free or Paid: Free
3. Complete the app content declarations (see below)

#### 4.2.2 Families Policy Compliance

Google has specific requirements for apps that target children:

| Requirement | SportyKids Compliance |
|-------------|----------------------|
| Must select target audience including children | Yes, 6-14 years |
| Comply with Families Policy | Yes |
| No behavioral advertising | No ads at all |
| No data collection without verifiable parental consent | COPPA consent flow implemented |
| API level must be current | Expo SDK 54 targets current API levels |
| Must have a privacy policy | Yes, `/privacy` |
| Must complete Data Safety form | See Section 2.4.4 |
| Must complete IARC rating | See Section 2.4.5 |
| Must declare "Teacher Approved" or not | No (not applying for this) |

**Important:** Google may require apps in the Families program to participate in the "Designed for Families" (DFF) program. If prompted, accept and complete the additional requirements.

#### 4.2.3 Google Play Console Configuration Checklist

| Step | Details | Done |
|------|---------|------|
| Create app | Name: "SportyKids" | [ ] |
| Set up store listing | Copy from `store-metadata/en.json` | [ ] |
| Add Spanish translation | Copy from `store-metadata/es.json` | [ ] |
| Upload feature graphic | 1024x500 from `store-metadata/` | [ ] |
| Upload app icon | 512x512 (resize from 1024x1024) | [ ] |
| Upload screenshots | 5 images, phone size | [ ] |
| Set category | News & Magazines | [ ] |
| Set content rating | Complete IARC questionnaire | [ ] |
| Complete Data Safety form | Per Section 2.4.4 | [ ] |
| Set target audience | Include children (6-14) | [ ] |
| Accept Families Policy | Review and accept | [ ] |
| Set Privacy Policy URL | Same as iOS | [ ] |
| Create service account | For EAS submit (see `eas.json` comments) | [ ] |
| Upload service account key | `google-service-account.json` | [ ] |
| Set up internal testing track | Add tester emails | [ ] |

#### 4.2.4 Build & Submit

```bash
cd apps/mobile

# 1. Build production Android (AAB)
eas build --profile production --platform android

# 2. Submit to Google Play (internal track)
eas submit --platform android --profile production

# 3. In Google Play Console:
#    - Verify the build appears in Internal testing
#    - Promote to Closed testing (if internal testing passed)
#    - Promote to Production
```

**Track progression:**

```
Internal testing  →  Closed testing  →  Open testing  →  Production
(no review)          (review ~1-3d)     (optional)       (review ~1-7d)
```

**Do not skip tracks.** Google may reject apps that jump directly to production without testing track history.

#### 4.2.5 Common Google Play Rejection Causes

| Rejection Reason | Response Strategy |
|-----------------|-------------------|
| **Families Policy violation** | Ensure all Families declarations are accurate. Double-check no third-party SDKs send data without consent. |
| **Data Safety form incomplete** | Review form against actual data collection. Be precise about what PostHog/Sentry collect. |
| **Metadata policy violation** | Ensure description does not mention competing platforms, use misleading screenshots, or contain spam keywords. |
| **Content rating mismatch** | Re-take IARC questionnaire if content has changed. |
| **Target audience declaration** | If Google flags the app as "not suitable for children," provide evidence of content moderation, parental controls, and COPPA compliance. |

---

## 5. Post-Launch

### 5.1 Rollout Strategy

**iOS (App Store):**
- Apple does not support percentage-based rollout for new apps
- Version 1.0.0 goes live immediately upon approval
- Monitor crash rate in first 24 hours via Sentry
- If crash rate > 1%, prepare emergency fix

**Android (Google Play):**
- Use staged rollout: 10% -> 25% -> 50% -> 100%
- Each stage: wait 48 hours and monitor
- Rollout progression criteria:
  - Crash-free rate >= 99%
  - No critical ANRs
  - No new 1-star reviews mentioning crashes

**Monitoring dashboard (first 30 days):**

| Metric | Tool | Alert Threshold |
|--------|------|-----------------|
| Crash-free rate | Sentry | < 99% |
| ANR rate (Android) | Google Play Console | > 0.5% |
| 1-star reviews | App Store / Play Store | > 2 in 24h |
| API error rate | Fly.io metrics | 5xx > 1% |
| API latency p95 | Fly.io metrics | > 2s |

### 5.2 If Rejected

**Workflow:**

1. Read the rejection notice carefully — identify the exact guideline cited
2. Check `review-notes.md` for a prepared response
3. If it's a code/compliance issue:
   - Create branch `fix/store-review-{platform}-{issue}`
   - Fix the issue with minimal changes
   - Run full test suite (`npm run test:all`)
   - Deploy to staging, verify the fix
   - Build new production binary
   - Re-submit with a clear explanation in "Notes for Review"
4. If it's a metadata/declaration issue:
   - Fix directly in App Store Connect / Google Play Console
   - Re-submit without new build
5. If the rejection seems incorrect:
   - **Apple:** Use the Resolution Center to appeal, or request a phone call with App Review
   - **Google:** Use the "Appeal" button in the Policy Status page

**Re-submission timeline:**
- Apple re-reviews typically take 1-2 days (faster than initial)
- Google re-reviews typically take 1-3 days

---

## 6. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Staging environment operational | `curl https://sportykids-api-staging.fly.dev/api/health` returns 200 |
| 2 | Preview builds point to staging | Check `EXPO_PUBLIC_API_BASE` in preview build config |
| 3 | App version is 1.0.0 | Check `app.json` version field |
| 4 | Beta distributed to 2 families | TestFlight + Play Internal Testing invites sent |
| 5 | Beta protocol runs >= 14 days | Activity logs confirm daily usage |
| 6 | Parent NPS >= 7/10 | Questionnaire results |
| 7 | 0 critical crashes during beta | Sentry dashboard zero fatal errors |
| 8 | All E2E tests passing | CI green (24 Playwright tests) |
| 9 | Store metadata complete (both stores) | Screenshots + descriptions + declarations uploaded |
| 10 | App approved on Apple App Store | Status "Ready for Sale" in App Store Connect |
| 11 | App approved on Google Play Store | Status "Published" in Google Play Console |
| 12 | Android rollout reaches 100% | Staged rollout completed |
| 13 | `review-notes.md` created | File exists with prepared responses |
| 14 | `beta-guide.md` created | File exists with 3-week protocol |
| 15 | `validation.md` created | File exists with verification steps |

---

## 7. Validation Checklist

Create `specs/mvp-to-product-5/validation.md` with:

```markdown
# Phase 5 Validation Checklist

## Infrastructure
- [ ] `fly.staging.toml` exists and is valid TOML
- [ ] `scripts/setup-staging.sh` exists and is executable
- [ ] Staging app deployed: `curl -s https://sportykids-api-staging.fly.dev/api/health | jq .status` returns "ok"
- [ ] Staging DB is seeded (news, reels, quiz questions, stickers exist)
- [ ] Staging is isolated from production (different DATABASE_URL)

## Build Configuration
- [ ] `apps/mobile/app.json` version is "1.0.0"
- [ ] `apps/mobile/app.json` has ios.buildNumber "1"
- [ ] `apps/mobile/app.json` has android.versionCode 1
- [ ] `apps/mobile/app.json` has ITSAppUsesNonExemptEncryption false
- [ ] `apps/mobile/eas.json` preview points to staging URL
- [ ] `apps/mobile/eas.json` submit section has documented placeholders
- [ ] `google-service-account.json` is in `.gitignore`

## Store Metadata
- [ ] `store-metadata/es.json` has all required fields (name, subtitle, description, keywords, supportUrl, privacyPolicyUrl, shortDescription, whatsNew)
- [ ] `store-metadata/en.json` has all required fields
- [ ] `shortDescription` is <= 80 characters in both locales
- [ ] Screenshots generated for iOS (5 images at 1179x2556)
- [ ] Screenshots generated for Android (5 images at 1080x2400)
- [ ] `scripts/generate-screenshots.mjs` exists and runs without error

## Beta Distribution
- [ ] iOS preview build completes: `eas build --profile preview --platform ios`
- [ ] Android preview build completes: `eas build --profile preview --platform android`
- [ ] TestFlight group created and testers invited
- [ ] Google Play Internal Testing list created and testers invited
- [ ] Both families can install and open the app

## Beta Testing
- [ ] All families completed Week 1 (setup + first impressions)
- [ ] All families completed Week 2 (daily use)
- [ ] All families completed Week 3 (feedback questionnaire)
- [ ] Parent NPS >= 7/10 average
- [ ] Parent controls satisfaction >= 4/5
- [ ] 0 critical crashes in Sentry
- [ ] 0 unresolved content reports after 24h

## Store Submission
- [ ] Apple Developer account active
- [ ] Google Play Console account active
- [ ] `eas.json` updated with real Apple IDs (appleId, ascAppId, appleTeamId)
- [ ] `google-service-account.json` configured and tested
- [ ] iOS production build + submit successful
- [ ] Android production build + submit successful
- [ ] App Store Connect metadata complete (description, screenshots, privacy labels, age rating)
- [ ] Google Play Console metadata complete (listing, data safety, IARC, families policy)

## Post-Submission
- [ ] Apple review passed (or rejection addressed and re-submitted)
- [ ] Google review passed (or rejection addressed and re-submitted)
- [ ] Android staged rollout: 10% deployed
- [ ] Android staged rollout: 50% deployed
- [ ] Android staged rollout: 100% deployed
- [ ] Sentry crash-free rate >= 99% for first 48 hours
- [ ] No critical 1-star reviews

## Documentation
- [ ] `specs/mvp-to-product-5/review-notes.md` created
- [ ] `specs/mvp-to-product-5/beta-guide.md` created
- [ ] `specs/mvp-to-product-5/validation.md` created
- [ ] `docs/en/` and `docs/es/` updated with Phase 5 status
```

---

## 8. Out of Scope

The following items are explicitly **not** part of Phase 5:

- **Marketing campaigns** — No PR, social media, or influencer outreach. Organic discovery only at launch.
- **ASO optimization** — Initial metadata is set; keyword optimization happens post-launch with data.
- **New market expansion** — App supports ES/EN and 6 countries already configured. No new locales.
- **Apple "Designed for Kids" program** — Apply post-launch once the app has real usage data and reviews.
- **Web app deployment** — Web stays as internal demo. No web store presence (PWA listing, etc.).
- **Monetization** — No in-app purchases, subscriptions, or ad integration.
- **Responding to store reviews** — Handled in a post-launch operations process, not this phase.
- **Automated screenshot framing** — Screenshots are raw captures. Device frame overlays are a nice-to-have for later.
- **App preview videos** — Optional for both stores. Can be added post-launch.
- **Custom domain** — The app uses `sportykids-api.fly.dev`. A custom domain (`sportykids.app`) is desirable but not blocking for launch.

---

## Appendix A: Files to Create

| File | Description |
|------|-------------|
| `fly.staging.toml` | Fly.io config for staging environment |
| `scripts/setup-staging.sh` | Script to provision staging on Fly.io |
| `scripts/generate-screenshots.mjs` | Playwright screenshot generation for store |
| `specs/mvp-to-product-5/beta-guide.md` | Testing guide for beta families |
| `specs/mvp-to-product-5/review-notes.md` | Prepared responses for store reviewers |
| `specs/mvp-to-product-5/validation.md` | Validation checklist for all deliverables |

## Appendix B: Files to Modify

| File | Changes |
|------|---------|
| `apps/mobile/app.json` | Version 1.0.0, buildNumber, versionCode, infoPlist |
| `apps/mobile/eas.json` | Preview URL to staging, submit section documentation |
| `apps/mobile/store-metadata/es.json` | Add supportUrl, privacyPolicyUrl, shortDescription, whatsNew |
| `apps/mobile/store-metadata/en.json` | Add supportUrl, privacyPolicyUrl, shortDescription, whatsNew |
| `apps/mobile/.gitignore` | Add `google-service-account.json` |
| `.gitignore` | Add `apps/mobile/store-metadata/screenshots/` |
| `docs/en/10-roadmap-and-decisions.md` | Update Phase 5 status |
| `docs/es/10-roadmap-y-decisiones.md` | Update Phase 5 status |
| `CLAUDE.md` | Update Phase 5 status from pending to in-progress/complete |
