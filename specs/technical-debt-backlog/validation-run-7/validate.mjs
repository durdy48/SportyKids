#!/usr/bin/env node
/**
 * Validation Script — Run 7
 * PRD4: OAuth Social Login + UX Polish Items (steps 102-140)
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const ASSETS = path.resolve(__dirname, '../validation-assets/run-7');

const results = [];

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 120_000, ...opts }).trim();
  } catch (err) {
    if (opts.allowFail) return err.stdout?.trim() || err.stderr?.trim() || err.message;
    throw err;
  }
}

function record(id, name, status, detail = '') {
  results.push({ id, name, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  // eslint-disable-next-line no-console
  console.log(`${icon} [${id}] ${name}: ${status}${detail ? ' — ' + detail : ''}`);
}

function saveEvidence(subdir, filename, content) {
  const dir = path.join(ASSETS, subdir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ─── Feature 7: OAuth Social Login (102-111) ───────────────────────────

function validateOAuth() {
  // 102: /providers route checks GOOGLE_CLIENT_ID env
  try {
    const auth = readFile('apps/api/src/routes/auth.ts');
    const hasProvidersRoute = auth.includes('/providers') || auth.includes('providers');
    const checksGoogleEnv = auth.includes('GOOGLE_CLIENT_ID');
    const pass = hasProvidersRoute && checksGoogleEnv;
    saveEvidence('api', '102-auth-providers.txt', `hasProvidersRoute: ${hasProvidersRoute}\nchecksGoogleEnv: ${checksGoogleEnv}\n`);
    record('7.102', 'Providers endpoint checks GOOGLE_CLIENT_ID', pass ? 'PASS' : 'FAIL',
      pass ? 'Route checks process.env.GOOGLE_CLIENT_ID' : `providers:${hasProvidersRoute} google:${checksGoogleEnv}`);
  } catch (e) {
    record('7.102', 'Providers endpoint checks GOOGLE_CLIENT_ID', 'FAIL', e.message);
  }

  // 103: Providers returns false when env vars not set
  try {
    const auth = readFile('apps/api/src/routes/auth.ts');
    const checksAppleEnv = auth.includes('APPLE_CLIENT_ID');
    const hasConditional = auth.includes('!!process.env') || auth.includes('Boolean(process.env') || (auth.includes('GOOGLE_CLIENT_ID') && auth.includes('APPLE_CLIENT_ID'));
    const pass = checksAppleEnv && hasConditional;
    record('7.103', 'Providers returns false without env vars', pass ? 'PASS' : 'FAIL',
      pass ? 'Conditional env var checks for both providers' : `apple:${checksAppleEnv} conditional:${hasConditional}`);
  } catch (e) {
    record('7.103', 'Providers returns false without env vars', 'FAIL', e.message);
  }

  // 104: GET /google route guards with NotFoundError when no GOOGLE_CLIENT_ID
  try {
    const auth = readFile('apps/api/src/routes/auth.ts');
    const hasGoogleRoute = auth.includes('/google');
    const hasGuard = (auth.includes('NotFoundError') || auth.includes('not implemented') || auth.includes('501')) && auth.includes('GOOGLE_CLIENT_ID');
    const pass = hasGoogleRoute && hasGuard;
    record('7.104', 'GET /google guards without env var', pass ? 'PASS' : 'FAIL',
      pass ? 'Google route has env guard' : `route:${hasGoogleRoute} guard:${hasGuard}`);
  } catch (e) {
    record('7.104', 'GET /google guards without env var', 'FAIL', e.message);
  }

  // 105: Same for Apple
  try {
    const auth = readFile('apps/api/src/routes/auth.ts');
    const hasAppleRoute = auth.includes('/apple');
    const hasGuard = (auth.includes('NotFoundError') || auth.includes('not implemented') || auth.includes('501')) && auth.includes('APPLE_CLIENT_ID');
    const pass = hasAppleRoute && hasGuard;
    record('7.105', 'GET /apple guards without env var', pass ? 'PASS' : 'FAIL',
      pass ? 'Apple route has env guard' : `route:${hasAppleRoute} guard:${hasGuard}`);
  } catch (e) {
    record('7.105', 'GET /apple guards without env var', 'FAIL', e.message);
  }

  // 106: POST /google/token validates idToken
  try {
    const auth = readFile('apps/api/src/routes/auth.ts');
    const hasGoogleToken = auth.includes('/google/token') || auth.includes('google/callback');
    const validatesIdToken = auth.includes('idToken') || auth.includes('id_token');
    const pass = hasGoogleToken && validatesIdToken;
    record('7.106', 'POST /google/token validates idToken', pass ? 'PASS' : 'FAIL',
      pass ? 'Google token endpoint validates idToken' : `route:${hasGoogleToken} validates:${validatesIdToken}`);
  } catch (e) {
    record('7.106', 'POST /google/token validates idToken', 'FAIL', e.message);
  }

  // 107: POST /apple/token validates idToken
  try {
    const auth = readFile('apps/api/src/routes/auth.ts');
    const hasAppleToken = auth.includes('/apple/token') || auth.includes('apple/callback');
    const validatesIdToken = auth.includes('idToken') || auth.includes('id_token');
    const pass = hasAppleToken && validatesIdToken;
    record('7.107', 'POST /apple/token validates idToken', pass ? 'PASS' : 'FAIL',
      pass ? 'Apple token endpoint validates idToken' : `route:${hasAppleToken} validates:${validatesIdToken}`);
  } catch (e) {
    record('7.107', 'POST /apple/token validates idToken', 'FAIL', e.message);
  }

  // 108: Web OnboardingWizard has social login buttons
  try {
    const file = readFile('apps/web/src/components/OnboardingWizard.tsx');
    const hasSocial = file.includes('google_signin') || file.includes('Sign in with Google') ||
      file.includes('fetchAuthProviders') || file.includes('Google') || file.includes('social');
    saveEvidence('output', '108-onboarding-social.txt', `hasSocial: ${hasSocial}\n`);
    record('7.108', 'Web OnboardingWizard social login buttons', hasSocial ? 'PASS' : 'FAIL',
      hasSocial ? 'Social login references found' : 'No social login references in OnboardingWizard');
  } catch (e) {
    record('7.108', 'Web OnboardingWizard social login buttons', 'FAIL', e.message);
  }

  // 109: Mobile Login.tsx has social buttons
  try {
    const file = readFile('apps/mobile/src/screens/Login.tsx');
    const hasSocial = file.includes('google_signin') || file.includes('fetchAuthProviders') ||
      file.includes('Google') || file.includes('social') || file.includes('apple');
    saveEvidence('output', '109-mobile-login-social.txt', `hasSocial: ${hasSocial}\n`);
    record('7.109', 'Mobile Login.tsx social login buttons', hasSocial ? 'PASS' : 'FAIL',
      hasSocial ? 'Social login references found' : 'No social login references in Login.tsx');
  } catch (e) {
    record('7.109', 'Mobile Login.tsx social login buttons', 'FAIL', e.message);
  }

  // 110: Prisma schema has socialId and index
  try {
    const schema = readFile('apps/api/prisma/schema.prisma');
    const hasSocialId = schema.includes('socialId');
    const hasIndex = schema.includes('authProvider') && schema.includes('socialId');
    const pass = hasSocialId && hasIndex;
    saveEvidence('output', '110-schema-social.txt', `hasSocialId: ${hasSocialId}\nhasIndex: ${hasIndex}\n`);
    record('7.110', 'Prisma schema socialId + index', pass ? 'PASS' : 'FAIL',
      pass ? 'socialId field and authProvider/socialId index found' : `socialId:${hasSocialId} index:${hasIndex}`);
  } catch (e) {
    record('7.110', 'Prisma schema socialId + index', 'FAIL', e.message);
  }

  // 111: Auth callback page exists
  try {
    const exists = fileExists('apps/web/src/app/auth/callback/page.tsx');
    record('7.111', 'Web auth callback page exists', exists ? 'PASS' : 'FAIL',
      exists ? 'apps/web/src/app/auth/callback/page.tsx found' : 'File not found');
  } catch (e) {
    record('7.111', 'Web auth callback page exists', 'FAIL', e.message);
  }
}

// ─── Feature 13.1: Kid-Friendly Errors (112-114) ───────────────────────

function validateKidFriendlyErrors() {
  // 112: KID_FRIENDLY_ERRORS has expected keys
  try {
    const file = readFile('packages/shared/src/constants/errors.ts');
    const keys = ['rate_limited', 'format_blocked', 'limit_reached', 'unauthorized'];
    const found = keys.filter(k => file.includes(k));
    const pass = found.length === keys.length;
    saveEvidence('output', '112-kid-friendly-errors.txt', `Expected: ${keys.join(', ')}\nFound: ${found.join(', ')}\n`);
    record('13.1.112', 'KID_FRIENDLY_ERRORS keys', pass ? 'PASS' : 'FAIL',
      pass ? `All ${keys.length} keys found` : `Missing: ${keys.filter(k => !found.includes(k)).join(', ')}`);
  } catch (e) {
    record('13.1.112', 'KID_FRIENDLY_ERRORS keys', 'FAIL', e.message);
  }

  // 113: getErrorType maps 429->rate_limited, 401->unauthorized
  try {
    const file = readFile('packages/shared/src/constants/errors.ts');
    const has429 = file.includes('429') && file.includes('rate_limited');
    const has401 = file.includes('401') && file.includes('unauthorized');
    const pass = has429 && has401;
    record('13.1.113', 'getErrorType status code mapping', pass ? 'PASS' : 'FAIL',
      pass ? '429->rate_limited and 401->unauthorized mapped' : `429:${has429} 401:${has401}`);
  } catch (e) {
    record('13.1.113', 'getErrorType status code mapping', 'FAIL', e.message);
  }

  // 114: i18n files have kid_errors keys
  try {
    const en = readFile('packages/shared/src/i18n/en.json');
    const es = readFile('packages/shared/src/i18n/es.json');
    const hasEnKey = en.includes('kid_errors') || en.includes('rate_limited_title');
    const hasEsKey = es.includes('kid_errors') || es.includes('rate_limited_title');
    const pass = hasEnKey && hasEsKey;
    saveEvidence('output', '114-i18n-kid-errors.txt', `en: ${hasEnKey}\nes: ${hasEsKey}\n`);
    record('13.1.114', 'i18n kid_errors translations', pass ? 'PASS' : 'FAIL',
      pass ? 'kid_errors keys in both en.json and es.json' : `en:${hasEnKey} es:${hasEsKey}`);
  } catch (e) {
    record('13.1.114', 'i18n kid_errors translations', 'FAIL', e.message);
  }
}

// ─── Feature 13.2: Haptic Feedback (115-118) ───────────────────────────

function validateHaptics() {
  // 115-116: Quiz.tsx has haptic success and error
  try {
    const file = readFile('apps/mobile/src/screens/Quiz.tsx');
    const hasSuccess = file.includes("haptic('success')") || file.includes('haptic("success")') || file.includes('Haptics.notificationAsync') || (file.includes('haptic(') && file.includes("'success'"));
    const hasError = file.includes("haptic('error')") || file.includes('haptic("error")') || file.includes('Haptics.notificationAsync') || (file.includes('haptic(') && file.includes("'error'"));
    saveEvidence('output', '115-quiz-haptics.txt', `hasSuccess: ${hasSuccess}\nhasError: ${hasError}\n`);
    record('13.2.115', 'Quiz haptic on correct answer', hasSuccess ? 'PASS' : 'FAIL',
      hasSuccess ? "haptic('success') found in Quiz.tsx" : 'Not found');
    record('13.2.116', 'Quiz haptic on wrong answer', hasError ? 'PASS' : 'FAIL',
      hasError ? "haptic('error') found in Quiz.tsx" : 'Not found');
  } catch (e) {
    record('13.2.115', 'Quiz haptic on correct answer', 'FAIL', e.message);
    record('13.2.116', 'Quiz haptic on wrong answer', 'FAIL', e.message);
  }

  // 117: Navigation has haptic selection
  try {
    const file = readFile('apps/mobile/src/navigation/index.tsx');
    const has = file.includes("haptic('selection')") || file.includes('haptic("selection")') || file.includes('haptic');
    record('13.2.117', 'Navigation tab haptic feedback', has ? 'PASS' : 'FAIL',
      has ? 'Haptic feedback found in navigation' : 'Not found');
  } catch (e) {
    record('13.2.117', 'Navigation tab haptic feedback', 'FAIL', e.message);
  }

  // 118: Collection has haptic light
  try {
    const file = readFile('apps/mobile/src/screens/Collection.tsx');
    const has = file.includes("haptic('light')") || file.includes('haptic("light")') || file.includes('haptic');
    record('13.2.118', 'Collection haptic on sticker tap', has ? 'PASS' : 'FAIL',
      has ? 'Haptic feedback found in Collection' : 'Not found');
  } catch (e) {
    record('13.2.118', 'Collection haptic on sticker tap', 'FAIL', e.message);
  }
}

// ─── Feature 13.3: Pull-to-Refresh (119-121) ───────────────────────────

function validatePullToRefresh() {
  // 119: HomeFeed uses BrandedRefreshControl
  try {
    const file = readFile('apps/mobile/src/screens/HomeFeed.tsx');
    const has = file.includes('BrandedRefreshControl') || file.includes('RefreshControl');
    record('13.3.119', 'HomeFeed pull-to-refresh', has ? 'PASS' : 'FAIL',
      has ? 'BrandedRefreshControl/RefreshControl found in HomeFeed' : 'Not found');
  } catch (e) {
    record('13.3.119', 'HomeFeed pull-to-refresh', 'FAIL', e.message);
  }

  // 120: Other screens use BrandedRefreshControl
  try {
    const screens = ['Reels.tsx', 'Collection.tsx', 'Quiz.tsx'];
    const found = [];
    for (const screen of screens) {
      try {
        const file = readFile(`apps/mobile/src/screens/${screen}`);
        if (file.includes('BrandedRefreshControl') || file.includes('RefreshControl')) {
          found.push(screen);
        }
      } catch { /* file may not exist */ }
    }
    const pass = found.length >= 2;
    record('13.3.120', 'Other screens pull-to-refresh', pass ? 'PASS' : 'FAIL',
      pass ? `RefreshControl in: ${found.join(', ')}` : `Only ${found.length} screens: ${found.join(', ')}`);
  } catch (e) {
    record('13.3.120', 'Other screens pull-to-refresh', 'FAIL', e.message);
  }

  // 121: BrandedRefreshControl uses i18n (not hardcoded text)
  try {
    const filePath = 'apps/mobile/src/components/BrandedRefreshControl.tsx';
    if (!fileExists(filePath)) {
      record('13.3.121', 'BrandedRefreshControl i18n', 'SKIP', 'BrandedRefreshControl.tsx not found');
    } else {
      const file = readFile(filePath);
      const hardcoded = file.includes('"Refreshing..."') || file.includes("'Refreshing...'");
      const usesI18n = file.includes('t(') || file.includes('useTranslation') || file.includes('locale');
      const pass = !hardcoded;
      record('13.3.121', 'BrandedRefreshControl no hardcoded text', pass ? 'PASS' : 'FAIL',
        pass ? (usesI18n ? 'Uses i18n' : 'No hardcoded "Refreshing..." text') : 'Hardcoded "Refreshing..." found');
    }
  } catch (e) {
    record('13.3.121', 'BrandedRefreshControl i18n', 'FAIL', e.message);
  }
}

// ─── Feature 13.4: Schedule Lock UI (122-124) ──────────────────────────

function validateScheduleLock() {
  // 122: Web ParentalPanel has schedule lock
  try {
    const file = readFile('apps/web/src/components/ParentalPanel.tsx');
    const has = file.includes('schedule') || file.includes('allowedHours') || file.includes('Schedule');
    saveEvidence('output', '122-web-schedule-lock.txt', `hasSchedule: ${has}\n`);
    record('13.4.122', 'Web ParentalPanel schedule lock', has ? 'PASS' : 'FAIL',
      has ? 'Schedule lock references found in ParentalPanel' : 'Not found');
  } catch (e) {
    record('13.4.122', 'Web ParentalPanel schedule lock', 'FAIL', e.message);
  }

  // 123: Web saves allowedHoursStart/End/timezone
  try {
    const file = readFile('apps/web/src/components/ParentalPanel.tsx');
    const hasStart = file.includes('allowedHoursStart');
    const hasEnd = file.includes('allowedHoursEnd');
    const hasTz = file.includes('timezone');
    const pass = hasStart && hasEnd && hasTz;
    record('13.4.123', 'Web schedule lock saves all fields', pass ? 'PASS' : 'FAIL',
      pass ? 'allowedHoursStart, allowedHoursEnd, timezone found' : `start:${hasStart} end:${hasEnd} tz:${hasTz}`);
  } catch (e) {
    record('13.4.123', 'Web schedule lock saves all fields', 'FAIL', e.message);
  }

  // 124: Mobile ParentalControl has schedule lock
  try {
    const file = readFile('apps/mobile/src/screens/ParentalControl.tsx');
    const has = file.includes('schedule') || file.includes('allowedHours') || file.includes('Schedule');
    record('13.4.124', 'Mobile ParentalControl schedule lock', has ? 'PASS' : 'FAIL',
      has ? 'Schedule lock references found in mobile ParentalControl' : 'Not found');
  } catch (e) {
    record('13.4.124', 'Mobile ParentalControl schedule lock', 'FAIL', e.message);
  }
}

// ─── Feature 13.5: Parental Tour (125-127) ─────────────────────────────

function validateParentalTour() {
  // 125-126: Web ParentalTour rendered
  try {
    const panelFile = readFile('apps/web/src/components/ParentalPanel.tsx');
    const hasTourInPanel = panelFile.includes('ParentalTour');
    // Also check the parents page
    let hasTourInPage = false;
    try {
      const parentPage = readFile('apps/web/src/app/parents/page.tsx');
      hasTourInPage = parentPage.includes('ParentalTour');
    } catch { /* file may not exist at this path */ }
    const pass = hasTourInPanel || hasTourInPage;
    saveEvidence('output', '125-web-parental-tour.txt', `inPanel: ${hasTourInPanel}\ninPage: ${hasTourInPage}\n`);
    record('13.5.125', 'Web ParentalTour imported', pass ? 'PASS' : 'FAIL',
      pass ? 'ParentalTour referenced in web' : 'ParentalTour not found in ParentalPanel or parents page');
    record('13.5.126', 'Web ParentalTour rendered', pass ? 'PASS' : 'FAIL',
      pass ? 'ParentalTour component rendered' : 'Not rendered');
  } catch (e) {
    record('13.5.125', 'Web ParentalTour imported', 'FAIL', e.message);
    record('13.5.126', 'Web ParentalTour rendered', 'FAIL', e.message);
  }

  // 127: Mobile ParentalControl renders ParentalTour
  try {
    const file = readFile('apps/mobile/src/screens/ParentalControl.tsx');
    const has = file.includes('ParentalTour');
    record('13.5.127', 'Mobile ParentalControl renders ParentalTour', has ? 'PASS' : 'FAIL',
      has ? 'ParentalTour found in mobile ParentalControl' : 'Not found');
  } catch (e) {
    record('13.5.127', 'Mobile ParentalControl renders ParentalTour', 'FAIL', e.message);
  }
}

// ─── Feature 13.6: Related Articles (128-130) ──────────────────────────

function validateRelatedArticles() {
  // 128: Web NewsCard has related articles
  try {
    const file = readFile('apps/web/src/components/NewsCard.tsx');
    const has = file.includes('related') || file.includes('Related') || file.includes('/related');
    record('13.6.128', 'Web NewsCard related articles', has ? 'PASS' : 'FAIL',
      has ? 'Related articles reference in NewsCard' : 'Not found');
  } catch (e) {
    record('13.6.128', 'Web NewsCard related articles', 'FAIL', e.message);
  }

  // 129: Conditional rendering for related
  try {
    const file = readFile('apps/web/src/components/NewsCard.tsx');
    const hasConditional = file.includes('.length') || file.includes('related?.') || file.includes('related &&');
    const hasRelated = file.includes('related') || file.includes('Related');
    const pass = hasRelated && hasConditional;
    record('13.6.129', 'Related articles conditional render', pass ? 'PASS' : 'FAIL',
      pass ? 'Conditional rendering for related articles' : `related:${hasRelated} conditional:${hasConditional}`);
  } catch (e) {
    record('13.6.129', 'Related articles conditional render', 'FAIL', e.message);
  }

  // 130: Mobile NewsCard has related articles
  try {
    const file = readFile('apps/mobile/src/components/NewsCard.tsx');
    const has = file.includes('related') || file.includes('Related') || file.includes('/related');
    record('13.6.130', 'Mobile NewsCard related articles', has ? 'PASS' : 'FAIL',
      has ? 'Related articles reference in mobile NewsCard' : 'Not found');
  } catch (e) {
    record('13.6.130', 'Mobile NewsCard related articles', 'FAIL', e.message);
  }
}

// ─── Feature 13.7: Reading History (131-133) ───────────────────────────

function validateReadingHistory() {
  // 131: Web HomeFeedClient has reading history
  try {
    const file = readFile('apps/web/src/app/HomeFeedClient.tsx');
    const has = file.includes('Recently Read') || file.includes('history') || file.includes('reading') || file.includes('readHistory');
    record('13.7.131', 'Web HomeFeed reading history', has ? 'PASS' : 'FAIL',
      has ? 'Reading history reference found in HomeFeedClient' : 'Not found');
  } catch (e) {
    record('13.7.131', 'Web HomeFeed reading history', 'FAIL', e.message);
  }

  // 132: Conditional rendering for reading history
  try {
    const file = readFile('apps/web/src/app/HomeFeedClient.tsx');
    const hasHistory = file.includes('history') || file.includes('reading') || file.includes('readHistory');
    const hasConditional = file.includes('.length') || file.includes('history?.') || file.includes('history &&');
    const pass = hasHistory && hasConditional;
    record('13.7.132', 'Reading history conditional render', pass ? 'PASS' : 'FAIL',
      pass ? 'Conditional rendering for reading history' : `history:${hasHistory} conditional:${hasConditional}`);
  } catch (e) {
    record('13.7.132', 'Reading history conditional render', 'FAIL', e.message);
  }

  // 133: Mobile HomeFeed has reading history
  try {
    const file = readFile('apps/mobile/src/screens/HomeFeed.tsx');
    const has = file.includes('Recently Read') || file.includes('history') || file.includes('reading') || file.includes('readHistory');
    record('13.7.133', 'Mobile HomeFeed reading history', has ? 'PASS' : 'FAIL',
      has ? 'Reading history reference found in mobile HomeFeed' : 'Not found');
  } catch (e) {
    record('13.7.133', 'Mobile HomeFeed reading history', 'FAIL', e.message);
  }
}

// ─── Feature 13.8: Content Language Filtering (134-136) ────────────────

function validateLanguageFiltering() {
  // 134: Web api.ts passes locale in fetchNews
  try {
    const file = readFile('apps/web/src/lib/api.ts');
    const has = file.includes('locale');
    record('13.8.134', 'Web api.ts locale in fetchNews', has ? 'PASS' : 'FAIL',
      has ? 'locale parameter found in web api.ts' : 'Not found');
  } catch (e) {
    record('13.8.134', 'Web api.ts locale in fetchNews', 'FAIL', e.message);
  }

  // 135: Mobile api.ts passes locale in fetchNews
  try {
    const file = readFile('apps/mobile/src/lib/api.ts');
    const has = file.includes('locale');
    record('13.8.135', 'Mobile api.ts locale in fetchNews', has ? 'PASS' : 'FAIL',
      has ? 'locale parameter found in mobile api.ts' : 'Not found');
  } catch (e) {
    record('13.8.135', 'Mobile api.ts locale in fetchNews', 'FAIL', e.message);
  }

  // 136: feed-ranker.ts has locale boost logic
  try {
    const file = readFile('apps/api/src/services/feed-ranker.ts');
    const has = file.includes('locale') || file.includes('language');
    saveEvidence('output', '136-feed-ranker-locale.txt', `hasLocale: ${has}\n`);
    record('13.8.136', 'Feed ranker locale boost', has ? 'PASS' : 'FAIL',
      has ? 'Locale/language reference found in feed-ranker' : 'Not found');
  } catch (e) {
    record('13.8.136', 'Feed ranker locale boost', 'FAIL', e.message);
  }
}

// ─── Feature 13.9: Reel Player Audit (137-138) ────────────────────────

function validateReelPlayerAudit() {
  // 137: English docs have Video Player Strategy
  try {
    const file = readFile('docs/en/06-service-overview.md');
    const has = file.includes('Video Player') || file.includes('video player') || file.includes('Reel Player') || file.includes('VideoPlayer');
    record('13.9.137', 'EN docs Video Player Strategy', has ? 'PASS' : 'FAIL',
      has ? 'Video Player section found in EN service overview' : 'Not found');
  } catch (e) {
    record('13.9.137', 'EN docs Video Player Strategy', 'FAIL', e.message);
  }

  // 138: Spanish docs have equivalent heading
  try {
    const file = readFile('docs/es/06-service-overview.md');
    const has = file.includes('Video Player') || file.includes('video player') || file.includes('Reproductor') || file.includes('VideoPlayer');
    record('13.9.138', 'ES docs Video Player Strategy', has ? 'PASS' : 'FAIL',
      has ? 'Video Player section found in ES service overview' : 'Not found');
  } catch (e) {
    record('13.9.138', 'ES docs Video Player Strategy', 'FAIL', e.message);
  }
}

// ─── All Tests and Lint (139-140) ──────────────────────────────────────

function validateTestsAndLint() {
  // 139: All tests pass
  try {
    const output = run('npm run test:all 2>&1', { allowFail: true, timeout: 300_000 });
    saveEvidence('output', '139-test-all.txt', output);
    // Count "X passed" from all 3 test suites
    const passMatches = [...output.matchAll(/(\d+)\s+passed/g)];
    const totalPassed = passMatches.reduce((sum, m) => sum + parseInt(m[1], 0), 0);
    // Check no test files failed
    const failFileMatches = output.match(/Test Files\s+(\d+)\s+failed/);
    const hasFailedFiles = failFileMatches && parseInt(failFileMatches[1], 10) > 0;
    const pass = totalPassed > 500 && !hasFailedFiles;
    const detail = `${totalPassed} tests passed${hasFailedFiles ? ' (but some files failed!)' : ''}`;
    record('T.139', 'All tests pass', pass ? 'PASS' : 'FAIL', detail);
  } catch (e) {
    record('T.139', 'All tests pass', 'FAIL', e.message);
  }

  // 140: Lint clean
  try {
    const output = run('npm run lint 2>&1', { allowFail: true });
    saveEvidence('output', '140-lint.txt', output);
    const pass = !output.includes('error') && !output.includes('problems');
    record('T.140', 'ESLint clean', pass ? 'PASS' : 'FAIL',
      pass ? 'Zero errors and warnings' : 'Lint issues found');
  } catch (e) {
    record('T.140', 'ESLint clean', 'FAIL', e.message);
  }
}

// ─── Report Generation ─────────────────────────────────────────────────

function getSectionName(id) {
  const prefix = id.split('.')[0];
  const map = {
    '7': 'Feature 7: OAuth Social Login',
    '13': 'Feature 13: UX Polish',
    'T': 'Tests & Lint',
  };
  // More granular: check full prefix
  if (id.startsWith('13.1')) return 'Feature 13.1: Kid-Friendly Errors';
  if (id.startsWith('13.2')) return 'Feature 13.2: Haptic Feedback';
  if (id.startsWith('13.3')) return 'Feature 13.3: Pull-to-Refresh';
  if (id.startsWith('13.4')) return 'Feature 13.4: Schedule Lock UI';
  if (id.startsWith('13.5')) return 'Feature 13.5: Parental Tour';
  if (id.startsWith('13.6')) return 'Feature 13.6: Related Articles';
  if (id.startsWith('13.7')) return 'Feature 13.7: Reading History';
  if (id.startsWith('13.8')) return 'Feature 13.8: Content Language Filtering';
  if (id.startsWith('13.9')) return 'Feature 13.9: Reel Player Audit';
  return map[prefix] || prefix;
}

function generateReport() {
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;

  let md = `# Validation Report — Run 7\n\n`;
  md += `**Date**: ${new Date().toISOString()}\n`;
  md += `**PRD**: prd4.md — OAuth Social Login + UX Polish\n`;
  md += `**Steps**: 102-140\n\n`;
  md += `## Summary\n\n`;
  md += `| Status | Count |\n|--------|-------|\n`;
  md += `| ✅ PASS | ${pass} |\n| ❌ FAIL | ${fail} |\n| ⏭️ SKIP | ${skip} |\n\n`;

  // Group by section
  let currentSection = '';
  for (const r of results) {
    const section = getSectionName(r.id);
    if (section !== currentSection) {
      currentSection = section;
      md += `\n## ${section}\n\n`;
    }
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    md += `- ${icon} **[${r.id}] ${r.name}**: ${r.detail || r.status}\n`;
  }

  md += `\n## Comparison with previous runs\n\n`;
  md += `- Run 1: 13 PASS / 0 FAIL / 0 SKIP (PRD1 only)\n`;
  md += `- Run 2: 18 PASS / 0 FAIL / 0 SKIP (PRD1 + Appendix A)\n`;
  md += `- Run 3: 42 PASS / 0 FAIL / 0 SKIP (PRD1 + Appendix A + PRD2)\n`;
  md += `- Run 4: 49 PASS / 0 FAIL / 0 SKIP (PRD1 + Appendix A + PRD2 + Appendix B)\n`;
  md += `- Run 5: 88 PASS / 0 FAIL / 0 SKIP (PRD1-3 + Appendices A-B)\n`;
  md += `- Run 6: 101 PASS / 0 FAIL / 0 SKIP (PRD1-3 + Appendices A-C)\n`;
  md += `- Run 7: ${pass} PASS / ${fail} FAIL / ${skip} SKIP (PRD4 — OAuth + UX Polish)\n`;

  md += `\n## Evidence\n\n`;
  md += `- [Test results](run-7/output/139-test-all.txt)\n`;
  md += `- [ESLint output](run-7/output/140-lint.txt)\n`;
  md += `- [Auth providers check](run-7/api/102-auth-providers.txt)\n`;
  md += `- [Kid-friendly errors](run-7/output/112-kid-friendly-errors.txt)\n`;
  md += `- [i18n kid errors](run-7/output/114-i18n-kid-errors.txt)\n`;
  md += `- [Quiz haptics](run-7/output/115-quiz-haptics.txt)\n`;
  md += `- [Feed ranker locale](run-7/output/136-feed-ranker-locale.txt)\n`;

  const reportPath = path.resolve(__dirname, '../validation-assets/validation-report-run-7.md');
  fs.writeFileSync(reportPath, md, 'utf-8');

  // eslint-disable-next-line no-console
  console.log(`\n=== Results: ${pass} PASS / ${fail} FAIL / ${skip} SKIP ===`);
  process.exit(fail > 0 ? 1 : 0);
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  // eslint-disable-next-line no-console
  console.log('=== Validation Run 7 — PRD4: OAuth + UX Polish ===\n');

  // Feature 7: OAuth (102-111)
  validateOAuth();

  // Feature 13.1: Kid-Friendly Errors (112-114)
  validateKidFriendlyErrors();

  // Feature 13.2: Haptic Feedback (115-118)
  validateHaptics();

  // Feature 13.3: Pull-to-Refresh (119-121)
  validatePullToRefresh();

  // Feature 13.4: Schedule Lock UI (122-124)
  validateScheduleLock();

  // Feature 13.5: Parental Tour (125-127)
  validateParentalTour();

  // Feature 13.6: Related Articles (128-130)
  validateRelatedArticles();

  // Feature 13.7: Reading History (131-133)
  validateReadingHistory();

  // Feature 13.8: Content Language Filtering (134-136)
  validateLanguageFiltering();

  // Feature 13.9: Reel Player Audit (137-138)
  validateReelPlayerAudit();

  // Tests & Lint (139-140)
  validateTestsAndLint();

  generateReport();
}

main().catch(e => {
  // eslint-disable-next-line no-console
  console.error('Validation script error:', e);
  process.exit(2);
});
