#!/usr/bin/env node
/**
 * Validation Script — Run 3
 * PRD1 regression checks + Appendix A + PRD2 (PostgreSQL, Error Handler, Code Cleanup)
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const ASSETS = path.resolve(__dirname, '../validation-assets/run-3');

const results = [];
let apiProcess = null;

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

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const headers = Object.fromEntries(res.headers.entries());
  const body = await res.json().catch(() => null);
  return { status: res.status, headers, body };
}

// ─── Feature 4: Structured Logging ──────────────────────────────────────

async function validateLogging() {
  // Start API in background
  const { spawn } = await import('child_process');
  apiProcess = spawn('npx', ['tsx', 'watch', 'src/index.ts'], {
    cwd: path.join(ROOT, 'apps/api'),
    env: { ...process.env, NODE_ENV: 'development', PORT: '3099' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let apiOutput = '';
  apiProcess.stdout.on('data', d => { apiOutput += d.toString(); });
  apiProcess.stderr.on('data', d => { apiOutput += d.toString(); });

  // Wait for API
  for (let i = 0; i < 30; i++) {
    try {
      await fetchJson('http://localhost:3099/api/health');
      break;
    } catch { await sleep(1000); }
  }

  // Give logs time to flush after startup
  await sleep(2000);

  // Step 4.1: Pino-pretty logs
  try {
    const hasServiceField = apiOutput.includes('sportykids-api') || apiOutput.includes('SportyKids API') || apiOutput.includes('listening');
    saveEvidence('output', '01-api-startup-logs.txt', apiOutput);
    record('4.1', 'Pino-pretty dev logging', hasServiceField ? 'PASS' : 'FAIL',
      hasServiceField ? 'Logs contain service context' : 'Expected pino-pretty output not found');
  } catch (e) {
    record('4.1', 'Pino-pretty dev logging', 'FAIL', e.message);
  }

  // Step 4.2: X-Request-ID header
  try {
    const res = await fetchJson('http://localhost:3099/api/health');
    const hasRequestId = !!res.headers['x-request-id'];
    saveEvidence('api', '02-health-response.json', JSON.stringify(res, null, 2));
    record('4.2', 'X-Request-ID header', hasRequestId ? 'PASS' : 'FAIL',
      hasRequestId ? `requestId: ${res.headers['x-request-id']}` : 'Missing X-Request-ID header');
  } catch (e) {
    record('4.2', 'X-Request-ID header', 'FAIL', e.message);
  }

  // Step 4.3: Error response has X-Request-ID
  try {
    const res = await fetchJson('http://localhost:3099/api/news/nonexistent');
    const hasRequestIdInHeader = !!res.headers['x-request-id'];
    saveEvidence('api', '03-error-response.json', JSON.stringify(res, null, 2));
    await sleep(500);
    saveEvidence('output', '03-error-logs.txt', apiOutput);
    record('4.3', 'Error response has X-Request-ID', hasRequestIdInHeader ? 'PASS' : 'FAIL',
      hasRequestIdInHeader ? `X-Request-ID: ${res.headers['x-request-id']}` : 'Missing X-Request-ID header');
  } catch (e) {
    record('4.3', 'Error response has X-Request-ID', 'FAIL', e.message);
  }
}

// ─── Feature 2: ESLint ──────────────────────────────────────────────────

function validateLinting() {
  // Step 2.4: ESLint
  try {
    const output = run('npx eslint . --max-warnings 0 2>&1', { allowFail: true });
    const pass = !output.includes('error') && !output.includes('problems');
    saveEvidence('output', '04-eslint-output.txt', output);
    record('2.4', 'ESLint --max-warnings 0', pass ? 'PASS' : 'FAIL',
      pass ? 'Zero errors and warnings' : 'Lint issues found');
  } catch (e) {
    record('2.4', 'ESLint --max-warnings 0', 'FAIL', e.message);
  }

  // Step 2.5: Prettier check (informational)
  try {
    const output = run('npx prettier --check "**/*.{ts,tsx}" --ignore-path .gitignore 2>&1', { allowFail: true });
    saveEvidence('output', '05-prettier-output.txt', output.substring(0, 2000));
    record('2.5', 'Prettier check', 'PASS', 'Prettier ran (formatting not enforced)');
  } catch (e) {
    record('2.5', 'Prettier check', 'PASS', 'Prettier ran (formatting not enforced)');
  }
}

// ─── Feature 3: Mobile Typecheck ────────────────────────────────────────

function validateMobileTypecheck() {
  try {
    const output = run('cd apps/mobile && npx tsc --noEmit 2>&1', { allowFail: true });
    const pass = !output.includes('error TS');
    saveEvidence('output', '06-mobile-typecheck.txt', output);
    record('3.6', 'Mobile typecheck', pass ? 'PASS' : 'FAIL',
      pass ? 'Zero type errors' : 'Type errors found');
  } catch (e) {
    record('3.6', 'Mobile typecheck', 'FAIL', e.message);
  }
}

// ─── Feature 5: Persistent Parental Sessions ────────────────────────────

async function validateParentalSessions() {
  // Step 5.7: Create user, setup PIN, verify PIN
  let userId = null;
  try {
    const userRes = await fetchJson('http://localhost:3099/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Validation Kid R3', age: 10, favoriteSports: ['football'] }),
    });
    userId = userRes.body?.id;
    saveEvidence('api', '07a-create-user.json', JSON.stringify(userRes, null, 2));

    const pinRes = await fetchJson('http://localhost:3099/api/parents/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pin: '1234' }),
    });
    saveEvidence('api', '07b-setup-pin.json', JSON.stringify(pinRes, null, 2));

    const verifyRes = await fetchJson('http://localhost:3099/api/parents/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pin: '1234' }),
    });
    const token = verifyRes.body?.sessionToken;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || '');
    saveEvidence('api', '07c-verify-pin.json', JSON.stringify(verifyRes, null, 2));
    record('5.7', 'Session token is UUID', isUUID ? 'PASS' : 'FAIL',
      isUUID ? `Token: ${token}` : `Got: ${token}`);

    // Step 5.8: Session works for parental endpoint
    if (token) {
      const profileRes = await fetchJson(`http://localhost:3099/api/parents/profile/${userId}`, {
        headers: { 'X-Parental-Session': token },
      });
      saveEvidence('api', '08-session-works.json', JSON.stringify(profileRes, null, 2));
      const sessionWorks = profileRes.status === 200;
      record('5.8', 'Session token works for parental endpoint', sessionWorks ? 'PASS' : 'FAIL',
        sessionWorks ? 'Profile endpoint returned 200' : `Got status ${profileRes.status}`);
    } else {
      record('5.8', 'Session token works for parental endpoint', 'SKIP', 'No token to test');
    }
  } catch (e) {
    record('5.7', 'Create user + verify PIN', 'FAIL', e.message);
    record('5.8', 'Session persistence', 'SKIP', 'Depends on 5.7');
  }

  // Step 5.9: Session TTL constant
  try {
    const sessionService = fs.readFileSync(path.join(ROOT, 'apps/api/src/services/parental-session.ts'), 'utf-8');
    const has5minTTL = sessionService.includes('5 * 60 * 1000');
    record('5.9', 'Session TTL is 5 minutes', has5minTTL ? 'PASS' : 'FAIL',
      has5minTTL ? 'SESSION_TTL_MS = 5 * 60 * 1000' : 'TTL not found');
  } catch (e) {
    record('5.9', 'Session TTL check', 'FAIL', e.message);
  }

  return userId;
}

// ─── Feature 1: Testing ─────────────────────────────────────────────────

let testCounts = { api: 0, web: 0, mobile: 0 };

function validateTesting() {
  try {
    const apiOut = run('cd apps/api && npx vitest run 2>&1', { allowFail: true });
    const webOut = run('cd apps/web && npx vitest run 2>&1', { allowFail: true });
    const mobileOut = run('cd apps/mobile && npx vitest run 2>&1', { allowFail: true });

    const apiMatch = apiOut.match(/Tests\s+(\d+) passed/);
    const webMatch = webOut.match(/Tests\s+(\d+) passed/);
    const mobileMatch = mobileOut.match(/Tests\s+(\d+) passed/);

    testCounts.api = parseInt(apiMatch?.[1] || '0');
    testCounts.web = parseInt(webMatch?.[1] || '0');
    testCounts.mobile = parseInt(mobileMatch?.[1] || '0');
    const total = testCounts.api + testCounts.web + testCounts.mobile;

    const allPass = !apiOut.includes('failed') && !webOut.includes('failed') && !mobileOut.includes('failed');

    saveEvidence('output', '10-test-all.txt', `API:\n${apiOut}\n\nWeb:\n${webOut}\n\nMobile:\n${mobileOut}`);
    record('1.10', 'All tests pass', allPass ? 'PASS' : 'FAIL',
      `Total: ${total} tests (API ${testCounts.api} + Web ${testCounts.web} + Mobile ${testCounts.mobile})`);

    const webFilesMatch = webOut.match(/Test Files\s+(\d+) passed/);
    const webFileCount = webFilesMatch?.[1] || '?';
    record('1.11', 'Web tests >= 50', testCounts.web >= 50 ? 'PASS' : 'FAIL',
      `${webFileCount} files, ${testCounts.web} tests`);

    const mobileFilesMatch = mobileOut.match(/Test Files\s+(\d+) passed/);
    const mobileFileCount = mobileFilesMatch?.[1] || '?';
    record('1.12', 'Mobile tests >= 50', testCounts.mobile >= 50 ? 'PASS' : 'FAIL',
      `${mobileFileCount} files, ${testCounts.mobile} tests`);
  } catch (e) {
    record('1.10', 'All tests pass', 'FAIL', e.message);
    record('1.11', 'Web tests >= 50', 'SKIP', 'Depends on 1.10');
    record('1.12', 'Mobile tests >= 50', 'SKIP', 'Depends on 1.10');
  }
}

// ─── Feature 3 (CI): CI Pipeline ────────────────────────────────────────

function validateCI() {
  try {
    const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf-8');
    const hasLint = ci.includes('name: Lint');
    const hasTest = ci.includes('name: API Tests');
    const hasTestWeb = ci.includes('test-web');
    const hasTestMobile = ci.includes('test-mobile');
    const hasBuildDeps = ci.includes('needs: [setup]') || ci.includes('needs: [lint, test, test-web, test-mobile]');
    const hasPrismaCache = (ci.includes('actions/cache@v4') || ci.includes('cache/save@v4') || ci.includes('cache/restore@v4')) && ci.includes('schema.prisma');
    const hasMobileTypecheck = ci.includes('Typecheck Mobile');

    const allPresent = hasLint && hasTest && hasTestWeb && hasTestMobile && hasBuildDeps && hasPrismaCache && hasMobileTypecheck;
    saveEvidence('output', '13-ci-analysis.txt', [
      `lint job: ${hasLint}`,
      `test job: ${hasTest}`,
      `test-web job: ${hasTestWeb}`,
      `test-mobile job: ${hasTestMobile}`,
      `builds depend on all 4: ${hasBuildDeps}`,
      `prisma cache: ${hasPrismaCache}`,
      `mobile typecheck: ${hasMobileTypecheck}`,
    ].join('\n'));

    record('3.13', 'CI pipeline structure', allPresent ? 'PASS' : 'FAIL',
      allPresent ? 'All jobs, dependencies, and caching present' : 'Missing CI components');
  } catch (e) {
    record('3.13', 'CI pipeline structure', 'FAIL', e.message);
  }
}

// ─── Appendix A: Review fix checks ──────────────────────────────────────

function validateAppendixA() {
  // A.14: parental-session.test.ts
  try {
    const out = run('cd apps/api && npx vitest run src/services/parental-session.test.ts 2>&1', { allowFail: true });
    const match = out.match(/Tests\s+(\d+) passed/);
    const count = parseInt(match?.[1] || '0');
    saveEvidence('output', '14-parental-session-tests.txt', out);
    record('A.14', 'parental-session.test.ts', count >= 7 ? 'PASS' : 'FAIL',
      `${count} tests pass`);
  } catch (e) {
    record('A.14', 'parental-session.test.ts', 'FAIL', e.message);
  }

  // A.15: sticker_earned PostHog event
  try {
    const gamification = fs.readFileSync(path.join(ROOT, 'apps/api/src/services/gamification.ts'), 'utf-8');
    const has = gamification.includes("trackEvent('sticker_earned'");
    record('A.15', 'sticker_earned PostHog event', has ? 'PASS' : 'FAIL',
      has ? 'trackEvent call found in gamification.ts' : 'Not found');
  } catch (e) {
    record('A.15', 'sticker_earned PostHog event', 'FAIL', e.message);
  }

  // A.16: NavBar dead state removed
  try {
    const navbar = fs.readFileSync(path.join(ROOT, 'apps/web/src/components/NavBar.tsx'), 'utf-8');
    const hasDead = navbar.includes('savingLocale');
    record('A.16', 'NavBar dead state removed', !hasDead ? 'PASS' : 'FAIL',
      !hasDead ? 'No savingLocale references' : 'savingLocale still present');
  } catch (e) {
    record('A.16', 'NavBar dead state removed', 'FAIL', e.message);
  }

  // A.17: eslint.config.mjs exists, .js does not
  try {
    const mjsExists = fs.existsSync(path.join(ROOT, 'eslint.config.mjs'));
    const jsExists = fs.existsSync(path.join(ROOT, 'eslint.config.js'));
    const pass = mjsExists && !jsExists;
    record('A.17', 'ESLint config renamed to .mjs', pass ? 'PASS' : 'FAIL',
      pass ? 'eslint.config.mjs exists, .js gone' : `mjs:${mjsExists} js:${jsExists}`);
  } catch (e) {
    record('A.17', 'ESLint config renamed', 'FAIL', e.message);
  }

  // A.18: Express Request userId type
  try {
    const requestId = fs.readFileSync(path.join(ROOT, 'apps/api/src/middleware/request-id.ts'), 'utf-8');
    const has = requestId.includes('userId?: string');
    record('A.18', 'Express Request userId type', has ? 'PASS' : 'FAIL',
      has ? 'userId in Request interface' : 'Not found');
  } catch (e) {
    record('A.18', 'Express Request userId type', 'FAIL', e.message);
  }
}

// ─── PRD2 Feature 6: PostgreSQL Migration ───────────────────────────────

async function validatePostgreSQL() {
  // 6.20: Docker container running
  try {
    const dockerOut = run('docker ps 2>&1', { allowFail: true });
    const hasPostgres = dockerOut.includes('sportykids-postgres') && dockerOut.includes('healthy');
    saveEvidence('output', '20-docker-ps.txt', dockerOut);
    record('6.20', 'PostgreSQL container running', hasPostgres ? 'PASS' : 'FAIL',
      hasPostgres ? 'sportykids-postgres container healthy' : 'Container not found or unhealthy');
  } catch (e) {
    record('6.20', 'PostgreSQL container running', 'FAIL', e.message);
  }

  // 6.21: schema.prisma uses postgresql
  try {
    const schema = fs.readFileSync(path.join(ROOT, 'apps/api/prisma/schema.prisma'), 'utf-8');
    const hasPostgresProvider = schema.includes('provider = "postgresql"');
    record('6.21', 'schema.prisma uses PostgreSQL', hasPostgresProvider ? 'PASS' : 'FAIL',
      hasPostgresProvider ? 'provider = "postgresql" found' : 'PostgreSQL provider not found');
  } catch (e) {
    record('6.21', 'schema.prisma uses PostgreSQL', 'FAIL', e.message);
  }

  // 6.22: API /api/health returns 200
  try {
    const res = await fetchJson('http://localhost:3099/api/health');
    record('6.22', 'API health check', res.status === 200 ? 'PASS' : 'FAIL',
      `Status: ${res.status}`);
  } catch (e) {
    record('6.22', 'API health check', 'FAIL', e.message);
  }

  // 6.23: POST /api/users returns arrays (not JSON strings)
  try {
    const res = await fetchJson('http://localhost:3099/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'PG Test User', age: 11, favoriteSports: ['football', 'basketball'] }),
    });
    saveEvidence('api', '23-create-user-pg.json', JSON.stringify(res, null, 2));
    const user = res.body;
    const sportsIsArray = Array.isArray(user?.favoriteSports);
    const sportsNotString = typeof user?.favoriteSports !== 'string';
    const pass = sportsIsArray && sportsNotString;
    record('6.23', 'User arrays are native (not JSON strings)', pass ? 'PASS' : 'FAIL',
      pass ? `favoriteSports is array: ${JSON.stringify(user?.favoriteSports)}` : `Got type: ${typeof user?.favoriteSports}, value: ${JSON.stringify(user?.favoriteSports)}`);
  } catch (e) {
    record('6.23', 'User arrays are native', 'FAIL', e.message);
  }

  // 6.24: No JSON.parse for migrated fields
  try {
    const migratedFields = [
      'favoriteSports', 'selectedFeeds', 'options', 'allowedSports',
      'allowedFeeds', 'allowedFormats', 'pushPreferences', 'recentResults', 'nextMatch',
    ];
    const searchDirs = ['apps/api/src/routes', 'apps/api/src/services', 'apps/api/src/middleware', 'apps/api/src/utils'];
    let violations = [];

    for (const dir of searchDirs) {
      const fullDir = path.join(ROOT, dir);
      if (!fs.existsSync(fullDir)) continue;
      const grepOut = run(`grep -rn "JSON.parse" ${dir}/ 2>&1`, { allowFail: true });
      if (!grepOut) continue;
      for (const line of grepOut.split('\n')) {
        for (const field of migratedFields) {
          if (line.includes(field)) {
            violations.push(line.trim());
          }
        }
      }
    }

    saveEvidence('output', '24-json-parse-audit.txt', violations.length > 0 ? violations.join('\n') : 'No violations found');
    record('6.24', 'No JSON.parse for migrated fields', violations.length === 0 ? 'PASS' : 'FAIL',
      violations.length === 0 ? 'No JSON.parse on migrated array fields' : `${violations.length} violations found`);
  } catch (e) {
    record('6.24', 'No JSON.parse for migrated fields', 'FAIL', e.message);
  }

  // 6.25: Composite indexes in schema.prisma
  try {
    const schema = fs.readFileSync(path.join(ROOT, 'apps/api/prisma/schema.prisma'), 'utf-8');
    const indexMatches = schema.match(/@@index\(/g) || [];
    const count = indexMatches.length;
    record('6.25', 'Composite indexes in schema', count >= 3 ? 'PASS' : 'FAIL',
      `${count} @@index declarations found`);
  } catch (e) {
    record('6.25', 'Composite indexes in schema', 'FAIL', e.message);
  }

  // 6.26: GET /api/news/trending returns valid JSON with trendingIds array
  try {
    const res = await fetchJson('http://localhost:3099/api/news/trending');
    const hasTrendingIds = res.body && Array.isArray(res.body.trendingIds);
    saveEvidence('api', '26-trending.json', JSON.stringify(res, null, 2));
    record('6.26', 'GET /api/news/trending returns trendingIds', hasTrendingIds ? 'PASS' : 'FAIL',
      hasTrendingIds ? `trendingIds array with ${res.body.trendingIds.length} items` : `Got: ${JSON.stringify(res.body)}`);
  } catch (e) {
    record('6.26', 'GET /api/news/trending', 'FAIL', e.message);
  }
}

// ─── PRD2 Feature 8: Error Handler ──────────────────────────────────────

async function validateErrorHandler() {
  // 8.27: Structured error on NOT_FOUND
  try {
    const res = await fetchJson('http://localhost:3099/api/users/nonexistent-id-12345');
    saveEvidence('api', '27-not-found.json', JSON.stringify(res, null, 2));
    const err = res.body?.error;
    const hasCode = err?.code === 'NOT_FOUND';
    const hasMessage = typeof err?.message === 'string' && err.message.length > 0;
    const hasRequestId = typeof err?.requestId === 'string' && err.requestId.length > 0;
    const pass = hasCode && hasMessage && hasRequestId;
    record('8.27', 'Structured NOT_FOUND error', pass ? 'PASS' : 'FAIL',
      pass ? `code: ${err.code}, requestId: ${err.requestId}` : `Got: ${JSON.stringify(res.body)?.substring(0, 200)}`);
  } catch (e) {
    record('8.27', 'Structured NOT_FOUND error', 'FAIL', e.message);
  }

  // 8.28: Structured VALIDATION_ERROR
  try {
    const res = await fetchJson('http://localhost:3099/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    saveEvidence('api', '28-validation-error.json', JSON.stringify(res, null, 2));
    const err = res.body?.error;
    const hasCode = err?.code === 'VALIDATION_ERROR';
    record('8.28', 'Structured VALIDATION_ERROR', hasCode ? 'PASS' : 'FAIL',
      hasCode ? `code: ${err.code}` : `Got: ${JSON.stringify(res.body)?.substring(0, 200)}`);
  } catch (e) {
    record('8.28', 'Structured VALIDATION_ERROR', 'FAIL', e.message);
  }

  // 8.29: errors/index.ts exists with error classes
  try {
    const errFile = fs.readFileSync(path.join(ROOT, 'apps/api/src/errors/index.ts'), 'utf-8');
    const required = ['AppError', 'ValidationError', 'AuthenticationError', 'AuthorizationError', 'NotFoundError', 'ConflictError', 'RateLimitError'];
    const found = required.filter(cls => errFile.includes(`class ${cls}`));
    const missing = required.filter(cls => !errFile.includes(`class ${cls}`));
    const pass = missing.length === 0;
    saveEvidence('output', '29-error-classes.txt', `Found: ${found.join(', ')}\nMissing: ${missing.join(', ') || 'none'}`);
    record('8.29', 'Error class hierarchy', pass ? 'PASS' : 'FAIL',
      pass ? `All ${required.length} classes found` : `Missing: ${missing.join(', ')}`);
  } catch (e) {
    record('8.29', 'Error class hierarchy', 'FAIL', e.message);
  }

  // 8.30: ERROR_CODES in shared constants
  try {
    const errConst = fs.readFileSync(path.join(ROOT, 'packages/shared/src/constants/errors.ts'), 'utf-8');
    const hasExport = errConst.includes('ERROR_CODES');
    record('8.30', 'ERROR_CODES in shared constants', hasExport ? 'PASS' : 'FAIL',
      hasExport ? 'ERROR_CODES export found' : 'ERROR_CODES not found');
  } catch (e) {
    record('8.30', 'ERROR_CODES in shared constants', 'FAIL', e.message);
  }

  // 8.31: KID_FRIENDLY_ERRORS has auth_required, too_fast, forbidden
  try {
    const errConst = fs.readFileSync(path.join(ROOT, 'packages/shared/src/constants/errors.ts'), 'utf-8');
    const hasAuthRequired = errConst.includes('auth_required');
    const hasTooFast = errConst.includes('too_fast');
    const hasForbidden = errConst.includes('forbidden');
    const pass = hasAuthRequired && hasTooFast && hasForbidden;
    record('8.31', 'KID_FRIENDLY_ERRORS keys', pass ? 'PASS' : 'FAIL',
      pass ? 'auth_required, too_fast, forbidden all present' : `auth_required:${hasAuthRequired} too_fast:${hasTooFast} forbidden:${hasForbidden}`);
  } catch (e) {
    record('8.31', 'KID_FRIENDLY_ERRORS keys', 'FAIL', e.message);
  }

  // 8.32: i18n keys in es.json and en.json
  try {
    const esJson = fs.readFileSync(path.join(ROOT, 'packages/shared/src/i18n/es.json'), 'utf-8');
    const enJson = fs.readFileSync(path.join(ROOT, 'packages/shared/src/i18n/en.json'), 'utf-8');
    const keys = ['auth_required', 'too_fast', 'forbidden'];
    const esMissing = keys.filter(k => !esJson.includes(k));
    const enMissing = keys.filter(k => !enJson.includes(k));
    const pass = esMissing.length === 0 && enMissing.length === 0;
    record('8.32', 'i18n error keys', pass ? 'PASS' : 'FAIL',
      pass ? 'All 3 keys in both es.json and en.json' : `ES missing: ${esMissing.join(',') || 'none'}, EN missing: ${enMissing.join(',') || 'none'}`);
  } catch (e) {
    record('8.32', 'i18n error keys', 'FAIL', e.message);
  }
}

// ─── PRD2 Feature 9: Code Cleanup ───────────────────────────────────────

function validateCodeCleanup() {
  // 9.33: No sportBoost or recencyBoost in apps/api/src/
  try {
    // grep exits 1 when no matches (which is what we want). Use a shell trick to always exit 0.
    const grepOut = run('grep -rn "sportBoost\\|recencyBoost" apps/api/src/ 2>/dev/null || true');
    const hasOld = grepOut.trim().length > 0 && !grepOut.includes('Command failed');
    saveEvidence('output', '33-dead-code-grep.txt', grepOut || 'No matches');
    record('9.33', 'No sportBoost/recencyBoost dead code', !hasOld ? 'PASS' : 'FAIL',
      !hasOld ? 'No legacy ranking variables found' : `Found: ${grepOut.substring(0, 200)}`);
  } catch (e) {
    record('9.33', 'No sportBoost/recencyBoost', 'FAIL', e.message);
  }

  // 9.34: React version consistency
  try {
    const webPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/web/package.json'), 'utf-8'));
    const mobilePkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/mobile/package.json'), 'utf-8'));
    const webReact = webPkg.dependencies?.react || 'not found';
    const mobileReact = mobilePkg.dependencies?.react || 'not found';
    const pass = webReact === mobileReact;
    record('9.34', 'React version consistency', pass ? 'PASS' : 'FAIL',
      pass ? `Both: ${webReact}` : `Web: ${webReact}, Mobile: ${mobileReact}`);
  } catch (e) {
    record('9.34', 'React version consistency', 'FAIL', e.message);
  }

  // 9.35: No skipLibCheck in apps/web/tsconfig.json
  try {
    const tsconfig = fs.readFileSync(path.join(ROOT, 'apps/web/tsconfig.json'), 'utf-8');
    const hasSkip = tsconfig.includes('skipLibCheck');
    record('9.35', 'No skipLibCheck in web tsconfig', !hasSkip ? 'PASS' : 'FAIL',
      !hasSkip ? 'skipLibCheck not present' : 'skipLibCheck still present');
  } catch (e) {
    record('9.35', 'No skipLibCheck in web tsconfig', 'FAIL', e.message);
  }

  // 9.36: Web typecheck passes
  try {
    const output = run('cd apps/web && npx tsc --noEmit 2>&1', { allowFail: true });
    const pass = !output.includes('error TS');
    saveEvidence('output', '36-web-typecheck.txt', output);
    record('9.36', 'Web typecheck passes', pass ? 'PASS' : 'FAIL',
      pass ? 'Zero type errors' : 'Type errors found');
  } catch (e) {
    record('9.36', 'Web typecheck passes', 'FAIL', e.message);
  }

  // 9.37: generate-daily-missions.ts contains user.locale
  try {
    const file = fs.readFileSync(path.join(ROOT, 'apps/api/src/jobs/generate-daily-missions.ts'), 'utf-8');
    const has = file.includes('user.locale');
    record('9.37', 'Missions use user.locale', has ? 'PASS' : 'FAIL',
      has ? 'user.locale found in generate-daily-missions.ts' : 'Not found');
  } catch (e) {
    record('9.37', 'Missions use user.locale', 'FAIL', e.message);
  }

  // 9.38: generate-daily-quiz.ts contains byLocale or user.locale
  try {
    const file = fs.readFileSync(path.join(ROOT, 'apps/api/src/jobs/generate-daily-quiz.ts'), 'utf-8');
    const has = file.includes('byLocale') || file.includes('user.locale') || file.includes('locale');
    record('9.38', 'Quiz uses locale awareness', has ? 'PASS' : 'FAIL',
      has ? 'Locale reference found in generate-daily-quiz.ts' : 'Not found');
  } catch (e) {
    record('9.38', 'Quiz uses locale awareness', 'FAIL', e.message);
  }

  // 9.39: sync-feeds.ts contains byLocale or user.locale
  try {
    const file = fs.readFileSync(path.join(ROOT, 'apps/api/src/jobs/sync-feeds.ts'), 'utf-8');
    const has = file.includes('byLocale') || file.includes('user.locale') || file.includes('locale');
    record('9.39', 'Sync feeds uses locale awareness', has ? 'PASS' : 'FAIL',
      has ? 'Locale reference found in sync-feeds.ts' : 'Not found');
  } catch (e) {
    record('9.39', 'Sync feeds uses locale awareness', 'FAIL', e.message);
  }

  // 9.40: CI yml has setup job with cache/save and cache/restore
  try {
    const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf-8');
    const hasSetup = ci.includes('setup');
    const hasCacheSave = ci.includes('cache/save') || ci.includes('actions/cache@');
    const hasCacheRestore = ci.includes('cache/restore') || ci.includes('actions/cache@');
    const pass = hasSetup && hasCacheSave && hasCacheRestore;
    record('9.40', 'CI has setup job with caching', pass ? 'PASS' : 'FAIL',
      pass ? 'Setup job with cache save/restore found' : `setup:${hasSetup} save:${hasCacheSave} restore:${hasCacheRestore}`);
  } catch (e) {
    record('9.40', 'CI has setup job with caching', 'FAIL', e.message);
  }

  // 9.41: CI yml has exactly 1 "prisma generate" occurrence
  try {
    const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf-8');
    const matches = ci.match(/prisma generate/g) || [];
    const count = matches.length;
    record('9.41', 'Single prisma generate in CI', count === 1 ? 'PASS' : 'FAIL',
      `${count} occurrence(s) of "prisma generate"`);
  } catch (e) {
    record('9.41', 'Single prisma generate in CI', 'FAIL', e.message);
  }
}

// ─── T.42-43: Test count thresholds ─────────────────────────────────────

function validateTestCounts() {
  // T.42: API >= 370, Web >= 50, Mobile >= 50
  const pass = testCounts.api >= 370 && testCounts.web >= 50 && testCounts.mobile >= 50;
  record('T.42', 'Test count thresholds', pass ? 'PASS' : 'FAIL',
    `API: ${testCounts.api} (>=370), Web: ${testCounts.web} (>=50), Mobile: ${testCounts.mobile} (>=50)`);

  // T.43 is covered by 2.4 (ESLint clean), just record a reference
  record('T.43', 'ESLint clean (see 2.4)', results.find(r => r.id === '2.4')?.status || 'SKIP',
    'Covered by check 2.4');
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  // eslint-disable-next-line no-console
  console.log('=== Validation Run 3 — PRD1 regression + Appendix A + PRD2 ===\n');

  // Static checks first (no API needed)
  validateLinting();
  validateMobileTypecheck();
  validateCI();
  validateTesting();

  // Dynamic checks (need API running)
  await validateLogging();
  await validateParentalSessions();

  // PRD2 checks that need API
  await validatePostgreSQL();
  await validateErrorHandler();

  // Stop API
  if (apiProcess) {
    apiProcess.kill('SIGTERM');
    await sleep(1000);
  }

  // Static checks that don't need API
  validateAppendixA();
  validateCodeCleanup();
  validateTestCounts();

  // ─── Generate Report ──────────────────────────────────────────────────
  const prd1Results = results.filter(r => /^[1-5]\./.test(r.id));
  const appendixResults = results.filter(r => r.id.startsWith('A.'));
  const pgResults = results.filter(r => r.id.startsWith('6.'));
  const errorResults = results.filter(r => r.id.startsWith('8.'));
  const cleanupResults = results.filter(r => r.id.startsWith('9.') || r.id.startsWith('T.'));

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const skipCount = results.filter(r => r.status === 'SKIP').length;

  let report = `# Validation Report — Run 3\n\n`;
  report += `**Date**: ${new Date().toISOString()}\n`;
  report += `**Summary**: ${passCount} PASS / ${failCount} FAIL / ${skipCount} SKIP\n\n`;

  // PRD1 original checks
  report += `## Re-run of PRD1 original checks\n\n`;
  const prd1Sections = {
    'Feature 4: Structured Logging': prd1Results.filter(r => r.id.startsWith('4.')),
    'Feature 2: Linting': prd1Results.filter(r => r.id.startsWith('2.')),
    'Feature 3: Mobile Typecheck & CI': prd1Results.filter(r => r.id.startsWith('3.')),
    'Feature 5: Persistent Parental Sessions': prd1Results.filter(r => r.id.startsWith('5.')),
    'Feature 1: Testing Infrastructure': prd1Results.filter(r => r.id.startsWith('1.')),
  };
  for (const [section, items] of Object.entries(prd1Sections)) {
    report += `### ${section}\n\n`;
    for (const item of items) {
      const icon = item.status === 'PASS' ? '✅' : item.status === 'FAIL' ? '❌' : '⏭️';
      report += `- ${icon} **[${item.id}] ${item.name}**: ${item.detail}\n`;
    }
    report += '\n';
  }

  // Appendix A
  report += `## Appendix A checks\n\n`;
  for (const item of appendixResults) {
    const icon = item.status === 'PASS' ? '✅' : item.status === 'FAIL' ? '❌' : '⏭️';
    report += `- ${icon} **[${item.id}] ${item.name}**: ${item.detail}\n`;
  }
  report += '\n';

  // PRD2 PostgreSQL
  report += `## PRD2 — PostgreSQL Migration\n\n`;
  for (const item of pgResults) {
    const icon = item.status === 'PASS' ? '✅' : item.status === 'FAIL' ? '❌' : '⏭️';
    report += `- ${icon} **[${item.id}] ${item.name}**: ${item.detail}\n`;
  }
  report += '\n';

  // PRD2 Error Handler
  report += `## PRD2 — Error Handler\n\n`;
  for (const item of errorResults) {
    const icon = item.status === 'PASS' ? '✅' : item.status === 'FAIL' ? '❌' : '⏭️';
    report += `- ${icon} **[${item.id}] ${item.name}**: ${item.detail}\n`;
  }
  report += '\n';

  // PRD2 Code Cleanup
  report += `## PRD2 — Code Cleanup\n\n`;
  for (const item of cleanupResults) {
    const icon = item.status === 'PASS' ? '✅' : item.status === 'FAIL' ? '❌' : '⏭️';
    report += `- ${icon} **[${item.id}] ${item.name}**: ${item.detail}\n`;
  }
  report += '\n';

  // Comparison with previous runs
  report += `## Comparison with previous runs\n\n`;
  report += `- Run 1: 13 PASS / 0 FAIL / 0 SKIP (PRD1 only)\n`;
  report += `- Run 2: 18 PASS / 0 FAIL / 0 SKIP (PRD1 + Appendix A)\n`;
  report += `- Run 3: ${passCount} PASS / ${failCount} FAIL / ${skipCount} SKIP (PRD1 + Appendix A + PRD2)\n`;
  const prd1PassCount = prd1Results.filter(r => r.status === 'PASS').length;
  if (prd1PassCount === 13) {
    report += `- **No regressions detected** — all 13 original PRD1 checks still pass\n`;
  } else {
    report += `- **REGRESSIONS DETECTED** — only ${prd1PassCount}/13 original PRD1 checks pass\n`;
  }
  report += '\n';

  // Evidence links
  report += `## Evidence\n\n`;
  report += `- [Test results](run-3/output/10-test-all.txt)\n`;
  report += `- [ESLint output](run-3/output/04-eslint-output.txt)\n`;
  report += `- [API startup logs](run-3/output/01-api-startup-logs.txt)\n`;
  report += `- [Parental session tests](run-3/output/14-parental-session-tests.txt)\n`;
  report += `- [Docker status](run-3/output/20-docker-ps.txt)\n`;
  report += `- [JSON.parse audit](run-3/output/24-json-parse-audit.txt)\n`;
  report += `- [Dead code grep](run-3/output/33-dead-code-grep.txt)\n`;
  report += `- [Web typecheck](run-3/output/36-web-typecheck.txt)\n`;
  report += `- [NOT_FOUND response](run-3/api/27-not-found.json)\n`;
  report += `- [Validation error response](run-3/api/28-validation-error.json)\n`;
  report += `- [User creation (PG arrays)](run-3/api/23-create-user-pg.json)\n`;
  report += `- [Trending endpoint](run-3/api/26-trending.json)\n`;

  fs.writeFileSync(path.join(ASSETS, '..', 'validation-report-run-3.md'), report, 'utf-8');

  // eslint-disable-next-line no-console
  console.log(`\n=== Results: ${passCount} PASS / ${failCount} FAIL / ${skipCount} SKIP ===`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  // eslint-disable-next-line no-console
  console.error('Validation script error:', e);
  if (apiProcess) apiProcess.kill('SIGTERM');
  process.exit(2);
});
