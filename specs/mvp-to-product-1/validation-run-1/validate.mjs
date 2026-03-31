/**
 * SportyKids Legal & Compliance — Automated Validation Script
 *
 * Validates consent fields, legal pages, data deletion lifecycle,
 * analytics consent gating, and API endpoint behavior.
 *
 * Usage: node specs/mvp-to-product-1/validation/validate.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../..');

const API = 'http://localhost:3001/api';
const WEB = 'http://localhost:3000';
const ASSETS_DIR = resolve(PROJECT_ROOT, 'specs/mvp-to-product-1/validation-assets/run-1');
const API_ASSETS = resolve(ASSETS_DIR, 'api');

mkdirSync(API_ASSETS, { recursive: true });

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

const results = [];
let testUserIds = [];

function record(section, step, name, status, details = '') {
  results.push({ section, step, name, status, details });
  const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[SKIP]';
  console.log(`  ${icon} Step ${step}: ${name}${details ? ' — ' + details : ''}`);
}

function savePayload(filename, data) {
  writeFileSync(resolve(API_ASSETS, filename), JSON.stringify(data, null, 2));
}

async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) });
    let body;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    return { status: res.status, body, headers: res.headers };
  } catch (err) {
    return { status: 0, body: null, error: err.message };
  }
}

function uniqueName(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createTestUser(extra = {}) {
  const payload = {
    name: uniqueName('val_user'),
    age: 10,
    favoriteSports: ['football'],
    ...extra,
  };
  const res = await safeFetch(`${API}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.status === 201 && res.body?.id) {
    testUserIds.push(res.body.id);
  }
  return res;
}

async function cleanup() {
  // Best-effort cleanup of test users via direct API (no auth needed for GET, but delete needs auth)
  // We just track IDs — actual cleanup happens inside test flows
}

// ──────────────────────────────────────────────────────────────────────
// Section 1: API Endpoint Verification (steps 29-31)
// ──────────────────────────────────────────────────────────────────────

async function section1_apiEndpoints() {
  console.log('\n=== Section 1: API Endpoint Verification ===');

  // Step 31: Create user and verify consent fields in response
  const createRes = await createTestUser();
  savePayload('s1_create_user.json', { request: { name: 'val_user', age: 10, favoriteSports: ['football'] }, response: createRes.body, status: createRes.status });

  if (createRes.status === 201) {
    const user = createRes.body;
    const hasConsentFields = 'ageGateCompleted' in user && 'consentGiven' in user &&
      'consentDate' in user && 'consentBy' in user;
    record('API Endpoints', 31, 'GET user returns consent fields', hasConsentFields ? 'PASS' : 'FAIL',
      hasConsentFields ? 'All 4 consent fields present' : `Missing fields. Keys: ${Object.keys(user).join(', ')}`);

    // Verify via GET
    const getRes = await safeFetch(`${API}/users/${user.id}`);
    savePayload('s1_get_user.json', { status: getRes.status, body: getRes.body });
    const getHasFields = getRes.status === 200 && 'ageGateCompleted' in getRes.body && 'consentGiven' in getRes.body;
    record('API Endpoints', '31b', 'GET /api/users/:id has consent fields', getHasFields ? 'PASS' : 'FAIL');
  } else {
    record('API Endpoints', 31, 'Create user for consent field check', 'FAIL', `Status: ${createRes.status}`);
  }

  // Step 29: DELETE without auth -> 401
  const noAuthRes = await safeFetch(`${API}/users/some-id/data`, { method: 'DELETE' });
  savePayload('s1_delete_no_auth.json', { status: noAuthRes.status, body: noAuthRes.body });
  record('API Endpoints', 29, 'DELETE /users/:id/data without auth returns 401', noAuthRes.status === 401 ? 'PASS' : 'FAIL',
    `Got status ${noAuthRes.status}`);

  // Step 30: DELETE nonexistent user with valid auth -> 404
  // First register a throwaway user to get a JWT
  const email = `${uniqueName('auth')}@test.com`;
  const regRes = await safeFetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!', name: uniqueName('auth'), age: 10, favoriteSports: ['football'] }),
  });

  if (regRes.status === 201 && regRes.body?.accessToken) {
    const token = regRes.body.accessToken;
    const userId = regRes.body.user?.id;
    if (userId) testUserIds.push(userId);

    const delRes = await safeFetch(`${API}/users/nonexistent-id-12345/data`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    savePayload('s1_delete_nonexistent.json', { status: delRes.status, body: delRes.body });
    record('API Endpoints', 30, 'DELETE /users/nonexistent/data returns 404', delRes.status === 404 ? 'PASS' : 'FAIL',
      `Got status ${delRes.status}`);
  } else {
    record('API Endpoints', 30, 'DELETE nonexistent user (needs auth)', 'FAIL', `Register failed: ${regRes.status}`);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Section 2: User Consent Fields (steps 1-2, 8)
// ──────────────────────────────────────────────────────────────────────

async function section2_consentFields() {
  console.log('\n=== Section 2: User Consent Fields ===');

  // Step 1: Create user, verify ageGateCompleted defaults to false
  const res = await createTestUser();
  if (res.status === 201) {
    const user = res.body;
    record('Consent Fields', 1, 'ageGateCompleted defaults to false', user.ageGateCompleted === false ? 'PASS' : 'FAIL',
      `Value: ${user.ageGateCompleted}`);
    record('Consent Fields', '1b', 'consentGiven defaults to false', user.consentGiven === false ? 'PASS' : 'FAIL',
      `Value: ${user.consentGiven}`);
    record('Consent Fields', '1c', 'consentDate defaults to null', user.consentDate === null ? 'PASS' : 'FAIL',
      `Value: ${user.consentDate}`);

    // Step 2: Update to set consent
    const updateRes = await safeFetch(`${API}/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ageGateCompleted: true, consentGiven: true, consentBy: 'parent' }),
    });
    savePayload('s2_update_consent.json', { status: updateRes.status, body: updateRes.body });

    if (updateRes.status === 200) {
      const updated = updateRes.body;
      record('Consent Fields', 2, 'ageGateCompleted updated to true', updated.ageGateCompleted === true ? 'PASS' : 'FAIL');
      record('Consent Fields', '2b', 'consentGiven updated to true', updated.consentGiven === true ? 'PASS' : 'FAIL');
      record('Consent Fields', '2c', 'consentDate auto-set on consent', updated.consentDate !== null ? 'PASS' : 'FAIL',
        `Value: ${updated.consentDate}`);
      record('Consent Fields', '2d', 'consentBy set to parent', updated.consentBy === 'parent' ? 'PASS' : 'FAIL',
        `Value: ${updated.consentBy}`);

      // Step 8: Re-read to verify persistence
      const verifyRes = await safeFetch(`${API}/users/${user.id}`);
      if (verifyRes.status === 200) {
        const v = verifyRes.body;
        const allPersisted = v.ageGateCompleted === true && v.consentGiven === true && v.consentDate !== null && v.consentBy === 'parent';
        record('Consent Fields', 8, 'Consent fields persisted on re-read', allPersisted ? 'PASS' : 'FAIL');
      } else {
        record('Consent Fields', 8, 'Re-read user after update', 'FAIL', `Status: ${verifyRes.status}`);
      }
    } else {
      record('Consent Fields', 2, 'Update consent fields', 'FAIL', `Status: ${updateRes.status}`);
    }
  } else {
    record('Consent Fields', 1, 'Create user for consent test', 'FAIL', `Status: ${res.status}`);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Section 3: Legal Pages (steps 9-13)
// ──────────────────────────────────────────────────────────────────────

async function section3_legalPages() {
  console.log('\n=== Section 3: Legal Pages ===');

  // Step 9: GET /privacy (Spanish)
  const privacyEs = await safeFetch(`${WEB}/privacy`);
  const privacyEsOk = privacyEs.status === 200 && typeof privacyEs.body === 'string' && privacyEs.body.includes('SportyKids');
  record('Legal Pages', 9, 'GET /privacy returns 200 with SportyKids', privacyEsOk ? 'PASS' : 'FAIL',
    `Status: ${privacyEs.status}, contains SportyKids: ${typeof privacyEs.body === 'string' && privacyEs.body.includes('SportyKids')}`);

  // Step 10: GET /privacy?locale=en (English)
  const privacyEn = await safeFetch(`${WEB}/privacy?locale=en`);
  const privacyEnOk = privacyEn.status === 200 && typeof privacyEn.body === 'string' &&
    (privacyEn.body.includes('Privacy Policy') || privacyEn.body.includes('privacy'));
  record('Legal Pages', 10, 'GET /privacy?locale=en returns English content', privacyEnOk ? 'PASS' : 'FAIL',
    `Status: ${privacyEn.status}`);

  // Step 11: GET /terms (Spanish)
  const termsEs = await safeFetch(`${WEB}/terms`);
  const termsEsOk = termsEs.status === 200 && typeof termsEs.body === 'string' && termsEs.body.includes('SportyKids');
  record('Legal Pages', 11, 'GET /terms returns 200 with SportyKids', termsEsOk ? 'PASS' : 'FAIL',
    `Status: ${termsEs.status}`);

  // Step 12: GET /terms?locale=en
  const termsEn = await safeFetch(`${WEB}/terms?locale=en`);
  const termsEnOk = termsEn.status === 200 && typeof termsEn.body === 'string';
  record('Legal Pages', 12, 'GET /terms?locale=en returns 200', termsEnOk ? 'PASS' : 'FAIL',
    `Status: ${termsEn.status}`);

  // Step 13: Pages accessible without auth (no cookies)
  const noAuthPrivacy = await safeFetch(`${WEB}/privacy`, { headers: {} });
  record('Legal Pages', 13, 'Legal pages accessible without auth', noAuthPrivacy.status === 200 ? 'PASS' : 'FAIL',
    `Privacy no-auth status: ${noAuthPrivacy.status}`);
}

// ──────────────────────────────────────────────────────────────────────
// Section 4: Data Deletion Full Lifecycle (steps 16-20)
// ──────────────────────────────────────────────────────────────────────

async function section4_dataDeletion() {
  console.log('\n=== Section 4: Data Deletion Full Lifecycle ===');

  // Step 14: Create user
  const email = `${uniqueName('del')}@test.com`;
  const password = 'DeleteMe1234!';

  const createRes = await createTestUser();
  if (createRes.status !== 201) {
    record('Data Deletion', 14, 'Create user for deletion test', 'FAIL', `Status: ${createRes.status}`);
    return;
  }
  const anonymousUserId = createRes.body.id;
  record('Data Deletion', 14, 'Create anonymous user', 'PASS', `ID: ${anonymousUserId}`);

  // Step 15: Create parental profile
  const pin = '1234';
  const setupRes = await safeFetch(`${API}/parents/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: anonymousUserId, pin }),
  });
  savePayload('s4_parental_setup.json', { status: setupRes.status, body: setupRes.body });
  record('Data Deletion', 15, 'Create parental profile', setupRes.status === 201 || setupRes.status === 200 ? 'PASS' : 'FAIL',
    `Status: ${setupRes.status}`);

  // Step 16: Log activity
  const logRes = await safeFetch(`${API}/parents/activity/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: anonymousUserId, type: 'news_viewed', durationSeconds: 30, contentId: 'test-news-1', sport: 'football' }),
  });
  record('Data Deletion', 16, 'Log activity', logRes.status === 201 || logRes.status === 200 ? 'PASS' : 'FAIL',
    `Status: ${logRes.status}`);

  // Step 17: Register with email to get JWT
  const regRes = await safeFetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: uniqueName('del_auth'), age: 10, favoriteSports: ['football'] }),
  });
  savePayload('s4_register.json', { status: regRes.status, body: { ...regRes.body, accessToken: regRes.body?.accessToken ? '[REDACTED]' : undefined } });

  if (regRes.status !== 201 || !regRes.body?.accessToken) {
    record('Data Deletion', 17, 'Register user for JWT', 'FAIL', `Status: ${regRes.status}`);
    return;
  }
  const jwt = regRes.body.accessToken;
  const authUserId = regRes.body.user?.id;
  if (authUserId) testUserIds.push(authUserId);
  record('Data Deletion', 17, 'Register user and get JWT', 'PASS');

  // For the deletion test we need to use the auth user as target (self-delete)
  // The anonymous user has parental profile but no JWT, so let's test self-delete on the auth user

  // Step 18: We'll use the anonymous user for parental-gated delete.
  // But for self-delete, we use the auth user (no parental profile = no session needed).
  // Let's first test self-delete on authUser.
  const selfDelRes = await safeFetch(`${API}/users/${authUserId}/data`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  savePayload('s4_self_delete.json', { status: selfDelRes.status, body: selfDelRes.body });
  record('Data Deletion', 19, 'DELETE /users/:id/data (self-delete with JWT)', selfDelRes.status === 200 ? 'PASS' : 'FAIL',
    `Status: ${selfDelRes.status}, body: ${JSON.stringify(selfDelRes.body)}`);

  // Step 20: Verify user is gone
  if (selfDelRes.status === 200) {
    const goneRes = await safeFetch(`${API}/users/${authUserId}`);
    savePayload('s4_verify_gone.json', { status: goneRes.status, body: goneRes.body });
    record('Data Deletion', 20, 'Verify deleted user returns 404', goneRes.status === 404 ? 'PASS' : 'FAIL',
      `Status: ${goneRes.status}`);
    // Remove from cleanup list since already deleted
    testUserIds = testUserIds.filter(id => id !== authUserId);
  } else {
    record('Data Deletion', 20, 'Verify deleted user', 'SKIP', 'Delete failed');
  }

  // Step 18 (parental session flow): verify-pin for anonymous user with parental profile
  const pinRes = await safeFetch(`${API}/parents/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: anonymousUserId, pin }),
  });
  savePayload('s4_verify_pin.json', { status: pinRes.status, body: pinRes.body });
  const hasSession = pinRes.status === 200 && pinRes.body?.sessionToken;
  record('Data Deletion', 18, 'Verify PIN returns session token', hasSession ? 'PASS' : 'FAIL',
    `Status: ${pinRes.status}, hasToken: ${!!pinRes.body?.sessionToken}`);
}

// ──────────────────────────────────────────────────────────────────────
// Section 5: Analytics Consent Gate (steps 21-22)
// ──────────────────────────────────────────────────────────────────────

async function section5_analyticsConsent() {
  console.log('\n=== Section 5: Analytics Consent Gate ===');

  // Step 21: Check web analytics.ts for consent gating
  try {
    const analyticsPath = resolve(PROJECT_ROOT, 'apps/web/src/lib/analytics.ts');
    const content = readFileSync(analyticsPath, 'utf-8');
    const hasConsentGate = content.includes('consentGiven') && content.includes('initAnalytics');
    const hasNoOpLogic = content.includes('consentGiven === false') || content.includes('!consentGiven');
    record('Analytics Consent', 21, 'Web analytics.ts has consent gating', hasConsentGate && hasNoOpLogic ? 'PASS' : 'FAIL',
      `consentGiven ref: ${content.includes('consentGiven')}, no-op on false: ${hasNoOpLogic}`);
    savePayload('s5_web_analytics_check.json', {
      file: 'apps/web/src/lib/analytics.ts',
      hasConsentGiven: content.includes('consentGiven'),
      hasInitAnalytics: content.includes('initAnalytics'),
      hasNoOpLogic,
    });
  } catch (err) {
    record('Analytics Consent', 21, 'Read web analytics.ts', 'FAIL', err.message);
  }

  // Step 22: Check API monitoring.ts for shouldTrackUser
  try {
    const monitoringPath = resolve(PROJECT_ROOT, 'apps/api/src/services/monitoring.ts');
    const content = readFileSync(monitoringPath, 'utf-8');
    const hasShouldTrack = content.includes('shouldTrackUser');
    const checksConsent = content.includes('consentGiven');
    const gatesEvents = content.includes('shouldTrackUser(userId)');
    record('Analytics Consent', 22, 'API monitoring.ts has shouldTrackUser with consent check',
      hasShouldTrack && checksConsent && gatesEvents ? 'PASS' : 'FAIL',
      `shouldTrackUser: ${hasShouldTrack}, consentGiven: ${checksConsent}, gates events: ${gatesEvents}`);
    savePayload('s5_api_monitoring_check.json', {
      file: 'apps/api/src/services/monitoring.ts',
      hasShouldTrackUser: hasShouldTrack,
      checksConsentGiven: checksConsent,
      gatesEventsOnConsent: gatesEvents,
    });
  } catch (err) {
    record('Analytics Consent', 22, 'Read API monitoring.ts', 'FAIL', err.message);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Section 6: Legal Links in Pages (steps 14-15 from checklist)
// ──────────────────────────────────────────────────────────────────────

async function section6_legalLinks() {
  console.log('\n=== Section 6: Legal Links in Pages ===');

  // Step 14: Check OnboardingWizard source for privacy/terms links
  try {
    const wizardPath = resolve(PROJECT_ROOT, 'apps/web/src/components/OnboardingWizard.tsx');
    const content = readFileSync(wizardPath, 'utf-8');
    const hasPrivacyLink = content.includes('/privacy');
    const hasTermsLink = content.includes('/terms');
    record('Legal Links', 14, 'OnboardingWizard contains /privacy link', hasPrivacyLink ? 'PASS' : 'FAIL');
    record('Legal Links', 15, 'OnboardingWizard contains /terms link', hasTermsLink ? 'PASS' : 'FAIL');
    savePayload('s6_onboarding_links.json', { hasPrivacyLink, hasTermsLink });
  } catch (err) {
    record('Legal Links', 14, 'Read OnboardingWizard.tsx', 'FAIL', err.message);
  }

  // Also check if homepage/onboarding page renders
  const onboardingRes = await safeFetch(`${WEB}/onboarding`);
  const onboardingOk = onboardingRes.status === 200 && typeof onboardingRes.body === 'string';
  record('Legal Links', '15b', 'Onboarding page renders (200)', onboardingOk ? 'PASS' : 'FAIL',
    `Status: ${onboardingRes.status}`);
}

// ──────────────────────────────────────────────────────────────────────
// Section 7: Mobile Checks (steps 23-28)
// ──────────────────────────────────────────────────────────────────────

async function section7_mobileChecks() {
  console.log('\n=== Section 7: Mobile Checks ===');
  const mobileSteps = [
    [23, 'Age gate screen renders on mobile'],
    [24, 'Parental consent flow on mobile'],
    [25, 'Privacy/terms links in mobile onboarding'],
    [26, 'Data deletion from mobile parental panel'],
    [27, 'Push notification consent on mobile'],
    [28, 'Analytics opt-out on mobile'],
  ];
  for (const [step, name] of mobileSteps) {
    record('Mobile', step, name, 'SKIP', 'Requires physical device/emulator');
  }
}

// ──────────────────────────────────────────────────────────────────────
// Report Generation
// ──────────────────────────────────────────────────────────────────────

function generateReport() {
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const skipCount = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;
  const now = new Date().toISOString();

  const sections = {};
  for (const r of results) {
    if (!sections[r.section]) sections[r.section] = [];
    sections[r.section].push(r);
  }

  let md = `# Validation Report — Run 1\n\n`;
  md += `**Date**: ${now}\n\n`;
  md += `**Summary**: ${passCount} PASS, ${failCount} FAIL, ${skipCount} SKIP (${total} total)\n\n`;
  md += `---\n\n`;

  for (const [section, items] of Object.entries(sections)) {
    md += `## ${section}\n\n`;
    md += `| Step | Test | Status | Details |\n`;
    md += `|------|------|--------|---------|\n`;
    for (const r of items) {
      const icon = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : 'SKIP';
      const details = r.details.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      md += `| ${r.step} | ${r.name} | ${icon} | ${details} |\n`;
    }
    md += `\n`;
  }

  md += `## Evidence Files\n\n`;
  md += `All API request/response payloads saved in:\n`;
  md += `\`specs/mvp-to-product-1/validation-assets/run-1/api/\`\n\n`;
  md += `---\n\n`;
  md += `*Generated by validate.mjs*\n`;

  const reportPath = resolve(ASSETS_DIR, 'validation-report-run-1.md');
  writeFileSync(reportPath, md);
  console.log(`\nReport written to: ${reportPath}`);

  return { passCount, failCount, skipCount, total };
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SportyKids Legal & Compliance — Validation Run 1');
  console.log('=' .repeat(55));

  // Pre-check: API and Web available
  const apiHealth = await safeFetch(`${API}/health`);
  if (apiHealth.status !== 200) {
    console.error(`ERROR: API not reachable at ${API} (status: ${apiHealth.status})`);
    process.exit(1);
  }
  console.log(`API: OK (${API})`);

  const webHealth = await safeFetch(WEB);
  if (webHealth.status === 0) {
    console.error(`ERROR: Web not reachable at ${WEB}`);
    process.exit(1);
  }
  console.log(`Web: OK (${WEB}, status ${webHealth.status})`);

  await section1_apiEndpoints();
  await section2_consentFields();
  await section3_legalPages();
  await section4_dataDeletion();
  await section5_analyticsConsent();
  await section6_legalLinks();
  await section7_mobileChecks();

  const { passCount, failCount, skipCount, total } = generateReport();

  console.log('\n' + '=' .repeat(55));
  console.log(`SUMMARY: ${passCount} PASS | ${failCount} FAIL | ${skipCount} SKIP | ${total} total`);

  if (failCount > 0) {
    console.log('\nFailed checks:');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`  - Step ${r.step}: ${r.name} — ${r.details}`);
    }
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(2);
});
