/**
 * SportyKids Legal & Compliance — Automated Validation Script (Run 2)
 *
 * Re-runs all original checks (steps 1-31) plus Appendix A checks (steps 32-41)
 * to verify review fixes and catch regressions.
 *
 * Usage: node specs/mvp-to-product-1/validation/validate-run2.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../..');

const API = 'http://localhost:3001/api';
const WEB = 'http://localhost:3000';
const ASSETS_DIR = resolve(PROJECT_ROOT, 'specs/mvp-to-product-1/validation-assets/run-2');
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

// ──────────────────────────────────────────────────────────────────────
// Section 1: API Endpoint Verification (steps 29-31) — ORIGINAL
// ──────────────────────────────────────────────────────────────────────

async function section1_apiEndpoints() {
  console.log('\n=== Section 1: API Endpoint Verification (Original) ===');

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
// Section 2: User Consent Fields (steps 1-2, 8) — ORIGINAL
// ──────────────────────────────────────────────────────────────────────

async function section2_consentFields() {
  console.log('\n=== Section 2: User Consent Fields (Original) ===');

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
// Section 3: Legal Pages (steps 9-13) — ORIGINAL
// ──────────────────────────────────────────────────────────────────────

async function section3_legalPages() {
  console.log('\n=== Section 3: Legal Pages (Original) ===');

  const privacyEs = await safeFetch(`${WEB}/privacy`);
  const privacyEsOk = privacyEs.status === 200 && typeof privacyEs.body === 'string' && privacyEs.body.includes('SportyKids');
  record('Legal Pages', 9, 'GET /privacy returns 200 with SportyKids', privacyEsOk ? 'PASS' : 'FAIL',
    `Status: ${privacyEs.status}, contains SportyKids: ${typeof privacyEs.body === 'string' && privacyEs.body.includes('SportyKids')}`);

  const privacyEn = await safeFetch(`${WEB}/privacy?locale=en`);
  const privacyEnOk = privacyEn.status === 200 && typeof privacyEn.body === 'string' &&
    (privacyEn.body.includes('Privacy Policy') || privacyEn.body.includes('privacy'));
  record('Legal Pages', 10, 'GET /privacy?locale=en returns English content', privacyEnOk ? 'PASS' : 'FAIL',
    `Status: ${privacyEn.status}`);

  const termsEs = await safeFetch(`${WEB}/terms`);
  const termsEsOk = termsEs.status === 200 && typeof termsEs.body === 'string' && termsEs.body.includes('SportyKids');
  record('Legal Pages', 11, 'GET /terms returns 200 with SportyKids', termsEsOk ? 'PASS' : 'FAIL',
    `Status: ${termsEs.status}`);

  const termsEn = await safeFetch(`${WEB}/terms?locale=en`);
  const termsEnOk = termsEn.status === 200 && typeof termsEn.body === 'string';
  record('Legal Pages', 12, 'GET /terms?locale=en returns 200', termsEnOk ? 'PASS' : 'FAIL',
    `Status: ${termsEn.status}`);

  const noAuthPrivacy = await safeFetch(`${WEB}/privacy`, { headers: {} });
  record('Legal Pages', 13, 'Legal pages accessible without auth', noAuthPrivacy.status === 200 ? 'PASS' : 'FAIL',
    `Privacy no-auth status: ${noAuthPrivacy.status}`);
}

// ──────────────────────────────────────────────────────────────────────
// Section 4: Data Deletion Full Lifecycle (steps 14-20) — ORIGINAL
// ──────────────────────────────────────────────────────────────────────

async function section4_dataDeletion() {
  console.log('\n=== Section 4: Data Deletion Full Lifecycle (Original) ===');

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

  // Step 19: Self-delete
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
    testUserIds = testUserIds.filter(id => id !== authUserId);
  } else {
    record('Data Deletion', 20, 'Verify deleted user', 'SKIP', 'Delete failed');
  }

  // Step 18: Parental session flow
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
// Section 5: Analytics Consent Gate (steps 21-22) — ORIGINAL
// ──────────────────────────────────────────────────────────────────────

async function section5_analyticsConsent() {
  console.log('\n=== Section 5: Analytics Consent Gate (Original) ===');

  try {
    const analyticsPath = resolve(PROJECT_ROOT, 'apps/web/src/lib/analytics.ts');
    const content = readFileSync(analyticsPath, 'utf-8');
    const hasConsentGate = content.includes('consentGiven') && content.includes('initAnalytics');
    const hasNoOpLogic = content.includes('consentGiven !== true');
    record('Analytics Consent', 21, 'Web analytics.ts has consent gating', hasConsentGate && hasNoOpLogic ? 'PASS' : 'FAIL',
      `consentGiven ref: ${content.includes('consentGiven')}, strict !== true check: ${hasNoOpLogic}`);
    savePayload('s5_web_analytics_check.json', { file: 'apps/web/src/lib/analytics.ts', hasConsentGiven: content.includes('consentGiven'), hasInitAnalytics: content.includes('initAnalytics'), hasStrictCheck: hasNoOpLogic });
  } catch (err) {
    record('Analytics Consent', 21, 'Read web analytics.ts', 'FAIL', err.message);
  }

  try {
    const monitoringPath = resolve(PROJECT_ROOT, 'apps/api/src/services/monitoring.ts');
    const content = readFileSync(monitoringPath, 'utf-8');
    const hasShouldTrack = content.includes('shouldTrackUser');
    const checksConsent = content.includes('consentGiven');
    const gatesEvents = content.includes('shouldTrackUser(userId)');
    record('Analytics Consent', 22, 'API monitoring.ts has shouldTrackUser with consent check',
      hasShouldTrack && checksConsent && gatesEvents ? 'PASS' : 'FAIL',
      `shouldTrackUser: ${hasShouldTrack}, consentGiven: ${checksConsent}, gates events: ${gatesEvents}`);
    savePayload('s5_api_monitoring_check.json', { file: 'apps/api/src/services/monitoring.ts', hasShouldTrackUser: hasShouldTrack, checksConsentGiven: checksConsent, gatesEventsOnConsent: gatesEvents });
  } catch (err) {
    record('Analytics Consent', 22, 'Read API monitoring.ts', 'FAIL', err.message);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Section 6: Legal Links in Pages (steps 14-15 from checklist) — ORIGINAL
// ──────────────────────────────────────────────────────────────────────

async function section6_legalLinks() {
  console.log('\n=== Section 6: Legal Links in Pages (Original) ===');

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

  const onboardingRes = await safeFetch(`${WEB}/onboarding`);
  const onboardingOk = onboardingRes.status === 200 && typeof onboardingRes.body === 'string';
  record('Legal Links', '15b', 'Onboarding page renders (200)', onboardingOk ? 'PASS' : 'FAIL',
    `Status: ${onboardingRes.status}`);
}

// ──────────────────────────────────────────────────────────────────────
// Section 7: Mobile Checks (steps 23-28) — SKIPPED
// ──────────────────────────────────────────────────────────────────────

async function section7_mobileChecks() {
  console.log('\n=== Section 7: Mobile Checks (SKIP) ===');
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
// Section 8: Appendix A — Review Fixes (steps 34-40)
// ──────────────────────────────────────────────────────────────────────

async function section8_appendixA() {
  console.log('\n=== Section 8: Appendix A — Review Fixes ===');

  // ── Step 34: Parent-child delete cascade ──
  console.log('\n  --- Step 34: Parent-child delete ---');

  // 1) Register a parent user (role=parent) to get JWT
  const parentEmail = `${uniqueName('parent')}@test.com`;
  const parentRegRes = await safeFetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: parentEmail, password: 'Parent1234!', name: uniqueName('par'), age: 12, favoriteSports: ['football'], role: 'parent' }),
  });

  if (parentRegRes.status !== 201 || !parentRegRes.body?.accessToken) {
    record('Appendix A', 34, 'Parent-child delete: register parent', 'FAIL', `Status: ${parentRegRes.status}`);
  } else {
    const parentJwt = parentRegRes.body.accessToken;
    const parentId = parentRegRes.body.user?.id;
    if (parentId) testUserIds.push(parentId);

    // 2) Create an anonymous child user
    const childRes = await createTestUser({ name: uniqueName('child'), age: 8 });
    if (childRes.status !== 201) {
      record('Appendix A', 34, 'Parent-child delete: create child', 'FAIL', `Status: ${childRes.status}`);
    } else {
      const childId = childRes.body.id;

      // 3) Link child to parent via POST /api/auth/link-child
      const linkRes = await safeFetch(`${API}/auth/link-child`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${parentJwt}` },
        body: JSON.stringify({ childUserId: childId }),
      });
      savePayload('s8_link_child.json', { status: linkRes.status, body: linkRes.body });

      if (linkRes.status !== 200) {
        record('Appendix A', 34, 'Parent-child delete: link child to parent', 'FAIL', `Status: ${linkRes.status}`);
      } else {
        // Verify child now has parentUserId set
        const childBefore = await safeFetch(`${API}/users/${childId}`);
        const linkedOk = childBefore.body?.parentUserId === parentId;

        // 4) Delete the parent
        const delRes = await safeFetch(`${API}/users/${parentId}/data`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${parentJwt}` },
        });
        savePayload('s8_parent_child_delete.json', { parentId, childId, linkedParentUserId: childBefore.body?.parentUserId, deleteStatus: delRes.status, deleteBody: delRes.body });

        if (delRes.status === 200) {
          // 5) Verify parent is gone
          const parentGone = await safeFetch(`${API}/users/${parentId}`);
          const parentDeleted = parentGone.status === 404;

          // 6) Verify child still exists with parentUserId = null
          const childCheck = await safeFetch(`${API}/users/${childId}`);
          const childExists = childCheck.status === 200;
          const childParentNull = childCheck.body?.parentUserId === null;

          savePayload('s8_parent_child_verify.json', {
            linkedBeforeDelete: linkedOk,
            parentGoneStatus: parentGone.status,
            childCheckStatus: childCheck.status,
            childParentUserId: childCheck.body?.parentUserId,
          });

          record('Appendix A', 34, 'Parent-child delete: parent deleted, child survives with null parentUserId',
            parentDeleted && childExists && childParentNull ? 'PASS' : 'FAIL',
            `Linked: ${linkedOk}, parent gone: ${parentDeleted}, child exists: ${childExists}, child.parentUserId: ${childCheck.body?.parentUserId}`);

          testUserIds = testUserIds.filter(id => id !== parentId);
        } else {
          record('Appendix A', 34, 'Parent-child delete: delete parent', 'FAIL', `Delete status: ${delRes.status}`);
        }
      }
    }
  }

  // ── Step 35: WEB_BASE in mobile config ──
  console.log('\n  --- Step 35: WEB_BASE in mobile config ---');
  try {
    const configPath = resolve(PROJECT_ROOT, 'apps/mobile/src/config.ts');
    const content = readFileSync(configPath, 'utf-8');
    const hasWebBase = content.includes('WEB_BASE');
    const isExported = content.includes('export') && content.includes('WEB_BASE');
    record('Appendix A', 35, 'Mobile config.ts exports WEB_BASE', hasWebBase && isExported ? 'PASS' : 'FAIL',
      `WEB_BASE found: ${hasWebBase}, exported: ${isExported}`);
    savePayload('s8_mobile_config.json', { file: 'apps/mobile/src/config.ts', hasWebBase, isExported, content: content.substring(0, 500) });
  } catch (err) {
    record('Appendix A', 35, 'Read mobile config.ts', 'FAIL', err.message);
  }

  // ── Step 36: No hardcoded localhost:3000 in mobile screens ──
  console.log('\n  --- Step 36: No hardcoded localhost in mobile screens ---');
  try {
    const screensDir = resolve(PROJECT_ROOT, 'apps/mobile/src/screens');
    const screenFiles = readdirSync(screensDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
    let hardcodedFiles = [];
    for (const file of screenFiles) {
      const content = readFileSync(resolve(screensDir, file), 'utf-8');
      if (content.includes('http://localhost:3000')) {
        hardcodedFiles.push(file);
      }
    }
    record('Appendix A', 36, 'No hardcoded localhost:3000 in mobile screens',
      hardcodedFiles.length === 0 ? 'PASS' : 'FAIL',
      hardcodedFiles.length === 0 ? 'Zero occurrences found' : `Found in: ${hardcodedFiles.join(', ')}`);
    savePayload('s8_mobile_screens_check.json', { screensChecked: screenFiles.length, hardcodedFiles });
  } catch (err) {
    record('Appendix A', 36, 'Scan mobile screens', 'FAIL', err.message);
  }

  // ── Step 37: Age gate error handling ──
  console.log('\n  --- Step 37: Age gate error handling ---');
  try {
    const ageGatePath = resolve(PROJECT_ROOT, 'apps/web/src/app/age-gate/page.tsx');
    const content = readFileSync(ageGatePath, 'utf-8');
    const hasErrorState = content.includes('useState') && content.includes('error');
    const hasCatchSetError = content.includes('catch') && content.includes('setError');
    record('Appendix A', 37, 'Age gate has error handling with setError in catch blocks',
      hasErrorState && hasCatchSetError ? 'PASS' : 'FAIL',
      `Error state: ${hasErrorState}, catch+setError: ${hasCatchSetError}`);
    savePayload('s8_age_gate_errors.json', { file: 'apps/web/src/app/age-gate/page.tsx', hasErrorState, hasCatchSetError });
  } catch (err) {
    record('Appendix A', 37, 'Read age-gate page.tsx', 'FAIL', err.message);
  }

  // ── Step 38: Analytics guard uses !== true (not === false) ──
  console.log('\n  --- Step 38: Analytics guard strict check ---');
  try {
    const analyticsPath = resolve(PROJECT_ROOT, 'apps/web/src/lib/analytics.ts');
    const content = readFileSync(analyticsPath, 'utf-8');
    const usesStrictCheck = content.includes('consentGiven !== true');
    const usesLooseCheck = content.includes('consentGiven === false');
    record('Appendix A', 38, 'Analytics uses consentGiven !== true (not === false)',
      usesStrictCheck && !usesLooseCheck ? 'PASS' : 'FAIL',
      `!== true: ${usesStrictCheck}, === false: ${usesLooseCheck}`);
    savePayload('s8_analytics_guard.json', { usesStrictCheck, usesLooseCheck });
  } catch (err) {
    record('Appendix A', 38, 'Read analytics.ts', 'FAIL', err.message);
  }

  // ── Step 39: localStorage cleanup clears all sportykids-prefixed keys ──
  console.log('\n  --- Step 39: localStorage cleanup ---');
  try {
    const panelPath = resolve(PROJECT_ROOT, 'apps/web/src/components/ParentalPanel.tsx');
    const content = readFileSync(panelPath, 'utf-8');
    const clearsAllPrefixed = content.includes('sportykids') &&
      (content.includes('Object.keys(localStorage)') || content.includes('Object.keys(window.localStorage)')) &&
      content.includes('startsWith');
    record('Appendix A', 39, 'ParentalPanel clears all sportykids-prefixed localStorage keys',
      clearsAllPrefixed ? 'PASS' : 'FAIL',
      `Dynamic prefix clearing: ${clearsAllPrefixed}`);
    savePayload('s8_localstorage_cleanup.json', { clearsAllPrefixed });
  } catch (err) {
    record('Appendix A', 39, 'Read ParentalPanel.tsx', 'FAIL', err.message);
  }

  // ── Step 40: Legal links use next/link Link component ──
  console.log('\n  --- Step 40: Legal links use next/link ---');
  try {
    const panelPath = resolve(PROJECT_ROOT, 'apps/web/src/components/ParentalPanel.tsx');
    const content = readFileSync(panelPath, 'utf-8');
    const importsNextLink = content.includes("from 'next/link'") || content.includes('from "next/link"');
    const usesLinkForPrivacy = /Link\s+href=.*\/privacy/.test(content);
    const usesLinkForTerms = /Link\s+href=.*\/terms/.test(content);
    record('Appendix A', 40, 'ParentalPanel legal links use next/link <Link>',
      importsNextLink && usesLinkForPrivacy && usesLinkForTerms ? 'PASS' : 'FAIL',
      `imports next/link: ${importsNextLink}, Link for /privacy: ${usesLinkForPrivacy}, Link for /terms: ${usesLinkForTerms}`);
    savePayload('s8_nextlink_check.json', { importsNextLink, usesLinkForPrivacy, usesLinkForTerms });
  } catch (err) {
    record('Appendix A', 40, 'Read ParentalPanel.tsx', 'FAIL', err.message);
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

  // Separate original vs appendix
  const originalSections = Object.entries(sections).filter(([s]) => s !== 'Appendix A');
  const appendixSection = sections['Appendix A'] || [];

  const originalPass = results.filter(r => r.section !== 'Appendix A' && r.status === 'PASS').length;
  const originalFail = results.filter(r => r.section !== 'Appendix A' && r.status === 'FAIL').length;
  const originalSkip = results.filter(r => r.section !== 'Appendix A' && r.status === 'SKIP').length;
  const appendixPass = appendixSection.filter(r => r.status === 'PASS').length;
  const appendixFail = appendixSection.filter(r => r.status === 'FAIL').length;

  let md = `# Validation Report — Run 2 (post /t-review #1)\n\n`;
  md += `**Date**: ${now}\n\n`;
  md += `**Summary**: ${passCount} PASS, ${failCount} FAIL, ${skipCount} SKIP (${total} total)\n\n`;
  md += `---\n\n`;

  // Re-run of original checks
  md += `## Re-run of Original Checks (steps 1-31)\n\n`;
  md += `**Sub-total**: ${originalPass} PASS, ${originalFail} FAIL, ${originalSkip} SKIP\n\n`;

  for (const [section, items] of originalSections) {
    md += `### ${section}\n\n`;
    md += `| Step | Test | Status | Details |\n`;
    md += `|------|------|--------|---------|\n`;
    for (const r of items) {
      const details = r.details.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      md += `| ${r.step} | ${r.name} | ${r.status} | ${details} |\n`;
    }
    md += `\n`;
  }

  // Appendix A checks
  md += `## Appendix A Checks (steps 34-40)\n\n`;
  md += `**Sub-total**: ${appendixPass} PASS, ${appendixFail} FAIL\n\n`;

  if (appendixSection.length > 0) {
    md += `| Step | Test | Status | Details |\n`;
    md += `|------|------|--------|---------|\n`;
    for (const r of appendixSection) {
      const details = r.details.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      md += `| ${r.step} | ${r.name} | ${r.status} | ${details} |\n`;
    }
    md += `\n`;
  }

  // Comparison with Run 1
  md += `## Comparison with Run 1\n\n`;
  md += `| Metric | Run 1 | Run 2 | Delta |\n`;
  md += `|--------|-------|-------|-------|\n`;
  md += `| PASS | 29 | ${passCount} | ${passCount >= 29 ? '+' : ''}${passCount - 29} |\n`;
  md += `| FAIL | 0 | ${failCount} | ${failCount > 0 ? '+' : ''}${failCount} |\n`;
  md += `| SKIP | 6 | ${skipCount} | ${skipCount >= 6 ? '+' : ''}${skipCount - 6} |\n`;
  md += `| Total | 35 | ${total} | +${total - 35} |\n`;
  md += `\n`;

  if (failCount === 0 && originalFail === 0) {
    md += `**No regressions detected.** All original checks continue to pass.\n\n`;
    md += `**Appendix A checks**: All ${appendixPass} review-fix verifications passed.\n\n`;
  } else if (originalFail > 0) {
    md += `**REGRESSIONS DETECTED**: ${originalFail} original check(s) now failing.\n\n`;
    for (const r of results.filter(r => r.section !== 'Appendix A' && r.status === 'FAIL')) {
      md += `- Step ${r.step}: ${r.name} — ${r.details}\n`;
    }
    md += `\n`;
  }

  if (appendixFail > 0) {
    md += `**Appendix A failures**: ${appendixFail} review-fix check(s) failing.\n\n`;
    for (const r of appendixSection.filter(r => r.status === 'FAIL')) {
      md += `- Step ${r.step}: ${r.name} — ${r.details}\n`;
    }
    md += `\n`;
  }

  md += `## Evidence Files\n\n`;
  md += `All API request/response payloads saved in:\n`;
  md += `\`specs/mvp-to-product-1/validation-assets/run-2/api/\`\n\n`;
  md += `---\n\n`;
  md += `*Generated by validate-run2.mjs*\n`;

  const reportPath = resolve(ASSETS_DIR, 'validation-report-run-2.md');
  writeFileSync(reportPath, md);
  console.log(`\nReport written to: ${reportPath}`);

  return { passCount, failCount, skipCount, total };
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SportyKids Legal & Compliance — Validation Run 2 (post /t-review #1)');
  console.log('='.repeat(65));

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

  // Original checks (steps 1-31)
  await section1_apiEndpoints();
  await section2_consentFields();
  await section3_legalPages();
  await section4_dataDeletion();
  await section5_analyticsConsent();
  await section6_legalLinks();
  await section7_mobileChecks();

  // Appendix A checks (steps 34-40)
  await section8_appendixA();

  const { passCount, failCount, skipCount, total } = generateReport();

  console.log('\n' + '='.repeat(65));
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
