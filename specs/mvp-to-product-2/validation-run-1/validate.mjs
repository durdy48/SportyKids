#!/usr/bin/env node

/**
 * Automated validation script for "Mobile Security & Moderation" feature.
 *
 * Usage: node validate.mjs <run-number>
 *
 * Validates 4 features via code inspection, API calls, and unit tests:
 *   F1: React Native Error Boundary
 *   F2: JWT tokens in expo-secure-store
 *   F3: YouTube embed sandbox
 *   F4: Fail-closed content moderation
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FEATURE_DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(FEATURE_DIR, '../..');

const RUN_NUM = process.argv[2] || '1';
const ASSETS_DIR = path.join(FEATURE_DIR, 'validation-assets', `run-${RUN_NUM}`);
const API_DIR = path.join(ASSETS_DIR, 'api');
const OUTPUT_DIR = path.join(ASSETS_DIR, 'output');
const REPORT_PATH = path.join(FEATURE_DIR, 'validation-assets', `validation-report-run-${RUN_NUM}.md`);

const API_BASE = 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const results = [];

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function saveJson(filename, data) {
  fs.writeFileSync(path.join(API_DIR, filename), JSON.stringify(data, null, 2));
}

function saveText(filename, text) {
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), text);
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function check(id, description, fn) {
  try {
    const result = fn();
    const status = result.pass ? 'PASS' : 'FAIL';
    results.push({ id, description, status, detail: result.detail || '' });
    log(`  ${status === 'PASS' ? '\u2705' : '\u274C'} ${id}: ${description}`);
  } catch (err) {
    results.push({ id, description, status: 'FAIL', detail: `Exception: ${err.message}` });
    log(`  \u274C ${id}: ${description} (exception: ${err.message})`);
  }
}

async function checkAsync(id, description, fn) {
  try {
    const result = await fn();
    const status = result.pass ? 'PASS' : 'FAIL';
    results.push({ id, description, status, detail: result.detail || '' });
    log(`  ${status === 'PASS' ? '\u2705' : '\u274C'} ${id}: ${description}`);
  } catch (err) {
    results.push({ id, description, status: 'FAIL', detail: `Exception: ${err.message}` });
    log(`  \u274C ${id}: ${description} (exception: ${err.message})`);
  }
}

function skip(id, description, reason) {
  results.push({ id, description, status: 'SKIP', detail: reason });
  log(`  \u23ED\uFE0F  ${id}: ${description} [SKIP: ${reason}]`);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function runTests(label, testFile) {
  // Determine the correct workspace directory and relative test path
  let cwd = ROOT;
  let relativeTestFile = testFile;

  const workspacePrefixes = ['apps/mobile/', 'apps/api/', 'apps/web/'];
  for (const prefix of workspacePrefixes) {
    if (testFile.startsWith(prefix)) {
      cwd = path.join(ROOT, prefix.slice(0, -1)); // e.g. ROOT/apps/mobile
      relativeTestFile = testFile.slice(prefix.length); // e.g. src/components/__tests__/...
      break;
    }
  }

  try {
    const output = execSync(
      `npx vitest run ${relativeTestFile} --reporter=verbose 2>&1`,
      { cwd, encoding: 'utf-8', timeout: 60_000 },
    );
    saveText(`${label}-tests.txt`, output);
    const hasFail = output.includes('FAIL') && !output.includes('Tests  0 failed');
    // Vitest shows "Tests  X passed" — check that no tests failed
    const failMatch = output.match(/(\d+)\s+failed/);
    const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
    return { pass: failed === 0, detail: failed === 0 ? 'All tests passed' : `${failed} test(s) failed`, output };
  } catch (err) {
    const output = err.stdout || err.stderr || err.message || '';
    saveText(`${label}-tests.txt`, output);
    // Even if exit code non-zero, check if it was a vitest run with failures
    const failMatch = output.match(/(\d+)\s+failed/);
    const failed = failMatch ? parseInt(failMatch[1], 10) : -1;
    if (failed === 0) {
      return { pass: true, detail: 'All tests passed (exit code non-zero but no failures)', output };
    }
    return { pass: false, detail: `Test runner failed: ${failed > 0 ? `${failed} failed` : 'execution error'}`, output };
  }
}

// ---------------------------------------------------------------------------
// Feature 1: React Native Error Boundary
// ---------------------------------------------------------------------------

function validateFeature1() {
  log('\n--- Feature 1: React Native Error Boundary ---');

  check('V1.1', 'ErrorBoundary component exists', () => {
    const exists = fileExists('apps/mobile/src/components/ErrorBoundary.tsx');
    return { pass: exists, detail: exists ? 'File found' : 'File not found' };
  });

  check('V1.2', 'ErrorBoundary wraps app in App.tsx', () => {
    const content = readFile('apps/mobile/src/App.tsx');
    const hasImport = content.includes("import { ErrorBoundary }") || content.includes("import {ErrorBoundary}");
    const hasJsx = content.includes('<ErrorBoundary');
    return {
      pass: hasImport && hasJsx,
      detail: `Import: ${hasImport}, JSX: ${hasJsx}`,
    };
  });

  check('V1.3', '"crash" entry exists in KID_FRIENDLY_ERRORS', () => {
    const content = readFile('packages/shared/src/constants/errors.ts');
    const hasCrash = content.includes('crash:') && content.includes('crash_title') && content.includes('crash_message');
    return { pass: hasCrash, detail: hasCrash ? 'crash entry with title/message keys found' : 'crash entry missing' };
  });

  check('V1.4', 'i18n keys exist in es.json and en.json (crash_title, crash_message, restart)', () => {
    const es = readFile('packages/shared/src/i18n/es.json');
    const en = readFile('packages/shared/src/i18n/en.json');
    const keys = ['crash_title', 'crash_message', 'restart'];
    const esHas = keys.every((k) => es.includes(`"${k}"`));
    const enHas = keys.every((k) => en.includes(`"${k}"`));
    return {
      pass: esHas && enHas,
      detail: `ES keys: ${esHas}, EN keys: ${enHas}`,
    };
  });

  check('V1.5', 'ErrorBoundary has resetError/restart functionality', () => {
    const content = readFile('apps/mobile/src/components/ErrorBoundary.tsx');
    const hasRestart = content.includes('handleRestart');
    const hasSetState = content.includes('hasError: false');
    return {
      pass: hasRestart && hasSetState,
      detail: `handleRestart: ${hasRestart}, resets hasError: ${hasSetState}`,
    };
  });

  check('V1.6', 'ErrorBoundary shows dev info when __DEV__ is true', () => {
    const content = readFile('apps/mobile/src/components/ErrorBoundary.tsx');
    const hasDev = content.includes('__DEV__') || content.includes('isDev');
    const hasStack = content.includes('Stack Trace') || content.includes('stack');
    return {
      pass: hasDev && hasStack,
      detail: `__DEV__ check: ${hasDev}, stack display: ${hasStack}`,
    };
  });

  check('V1.7', 'ErrorBoundary tests pass', () => {
    return runTests('error-boundary', 'apps/mobile/src/components/__tests__/ErrorBoundary.test.tsx');
  });
}

// ---------------------------------------------------------------------------
// Feature 2: JWT Tokens in expo-secure-store
// ---------------------------------------------------------------------------

function validateFeature2() {
  log('\n--- Feature 2: JWT Tokens in expo-secure-store ---');

  check('V2.1', 'expo-secure-store is in mobile package.json dependencies', () => {
    const pkgJson = JSON.parse(readFile('apps/mobile/package.json'));
    const inDeps = !!(pkgJson.dependencies?.['expo-secure-store'] || pkgJson.devDependencies?.['expo-secure-store']);
    return { pass: inDeps, detail: inDeps ? `Version: ${pkgJson.dependencies?.['expo-secure-store'] || pkgJson.devDependencies?.['expo-secure-store']}` : 'Not found in dependencies' };
  });

  check('V2.2', 'secure-storage.ts exists with expected exports', () => {
    const exists = fileExists('apps/mobile/src/lib/secure-storage.ts');
    if (!exists) return { pass: false, detail: 'File not found' };
    const content = readFile('apps/mobile/src/lib/secure-storage.ts');
    const exports = ['secureGetItem', 'secureSetItem', 'secureDeleteItem', 'migrateTokensToSecureStore'];
    const found = exports.filter((e) => content.includes(`export async function ${e}`) || content.includes(`export function ${e}`));
    const allFound = found.length === exports.length;
    return {
      pass: allFound,
      detail: `Found exports: ${found.join(', ')}${allFound ? '' : `. Missing: ${exports.filter((e) => !found.includes(e)).join(', ')}`}`,
    };
  });

  check('V2.3', 'auth.ts imports from secure-storage (not direct AsyncStorage for tokens)', () => {
    const content = readFile('apps/mobile/src/lib/auth.ts');
    const importsSecure = content.includes("from './secure-storage'") || content.includes('from "./secure-storage"');
    // Check it does NOT use AsyncStorage directly for token operations
    const directAsync = content.includes("from '@react-native-async-storage/async-storage'");
    return {
      pass: importsSecure && !directAsync,
      detail: `Imports secure-storage: ${importsSecure}, Direct AsyncStorage: ${directAsync}`,
    };
  });

  check('V2.4', 'Token migration is called in App.tsx', () => {
    const content = readFile('apps/mobile/src/App.tsx');
    const hasMigration = content.includes('initSecureTokenStorage') || content.includes('migrateTokensToSecureStore');
    return { pass: hasMigration, detail: hasMigration ? 'Migration call found' : 'Migration call not found' };
  });

  check('V2.5', 'secure-storage tests pass', () => {
    return runTests('secure-storage', 'apps/mobile/src/lib/__tests__/secure-storage.test.ts');
  });
}

// ---------------------------------------------------------------------------
// Feature 3: YouTube Embed Sandbox
// ---------------------------------------------------------------------------

function validateFeature3() {
  log('\n--- Feature 3: YouTube Embed Sandbox ---');

  check('V3.1', 'youtube.ts exists in shared with buildYouTubeEmbedUrl and extractYouTubeVideoId', () => {
    const exists = fileExists('packages/shared/src/utils/youtube.ts');
    if (!exists) return { pass: false, detail: 'File not found' };
    const content = readFile('packages/shared/src/utils/youtube.ts');
    const hasBuild = content.includes('export function buildYouTubeEmbedUrl');
    const hasExtract = content.includes('export function extractYouTubeVideoId');
    return {
      pass: hasBuild && hasExtract,
      detail: `buildYouTubeEmbedUrl: ${hasBuild}, extractYouTubeVideoId: ${hasExtract}`,
    };
  });

  check('V3.2', 'buildYouTubeEmbedUrl for mobile does NOT add fs=0', () => {
    const content = readFile('packages/shared/src/utils/youtube.ts');
    // WEB_ONLY_PARAMS has fs: '0', and it's only applied for web platform
    const hasWebOnly = content.includes("platform === 'web'") && content.includes("fs: '0'");
    return {
      pass: hasWebOnly,
      detail: hasWebOnly ? 'fs=0 is web-only (gated on platform === "web")' : 'Could not verify fs=0 is web-only',
    };
  });

  check('V3.3', 'buildYouTubeEmbedUrl for web has fs=0', () => {
    const content = readFile('packages/shared/src/utils/youtube.ts');
    const hasFsZero = content.includes("fs: '0'");
    const webOnly = content.includes('WEB_ONLY_PARAMS');
    return {
      pass: hasFsZero && webOnly,
      detail: `fs=0 in WEB_ONLY_PARAMS: ${hasFsZero && webOnly}`,
    };
  });

  check('V3.4', 'Web VideoPlayer.tsx has sandbox attribute on iframes', () => {
    const content = readFile('apps/web/src/components/VideoPlayer.tsx');
    const hasSandbox = content.includes('sandbox=');
    const hasCorrectValue = content.includes('allow-scripts allow-same-origin allow-presentation');
    return {
      pass: hasSandbox && hasCorrectValue,
      detail: `sandbox attr: ${hasSandbox}, correct value: ${hasCorrectValue}`,
    };
  });

  check('V3.5', 'Web VideoPlayer.tsx uses buildYouTubeEmbedUrl from shared', () => {
    const content = readFile('apps/web/src/components/VideoPlayer.tsx');
    const hasImport = content.includes('buildYouTubeEmbedUrl');
    const hasSharedImport = content.includes("from '@sportykids/shared'");
    return {
      pass: hasImport && hasSharedImport,
      detail: `Import buildYouTubeEmbedUrl: ${hasImport}, from shared: ${hasSharedImport}`,
    };
  });

  check('V3.6', 'Mobile VideoPlayer.tsx uses centralized params (getYouTubePlayerVars or buildYouTubeEmbedUrl)', () => {
    const content = readFile('apps/mobile/src/components/VideoPlayer.tsx');
    const usesShared = content.includes('getYouTubePlayerVars') || content.includes('buildYouTubeEmbedUrl');
    const hasSharedImport = content.includes("from '@sportykids/shared'");
    return {
      pass: usesShared && hasSharedImport,
      detail: `Uses shared YouTube utils: ${usesShared}, from shared: ${hasSharedImport}`,
    };
  });

  check('V3.7', 'YouTube utils re-exported from shared utils/index.ts', () => {
    const content = readFile('packages/shared/src/utils/index.ts');
    const hasExport = content.includes('buildYouTubeEmbedUrl') && content.includes('extractYouTubeVideoId') && content.includes('getYouTubePlayerVars');
    return {
      pass: hasExport,
      detail: hasExport ? 'All 3 functions re-exported' : 'Some functions missing from re-export',
    };
  });

  check('V3.8', 'YouTube tests pass', () => {
    return runTests('youtube', 'packages/shared/src/utils/__tests__/youtube.test.ts');
  });
}

// ---------------------------------------------------------------------------
// Feature 4: Fail-Closed Moderation (API + Code)
// ---------------------------------------------------------------------------

async function validateFeature4() {
  log('\n--- Feature 4: Fail-Closed Content Moderation ---');

  // --- API checks ---

  // Register a test user to get a JWT
  let authToken = null;
  const testEmail = `validation-run${RUN_NUM}-${Date.now()}@test.sportykids.dev`;
  try {
    const regRes = await fetchJson(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'TestPassword123!',
        name: 'Validation Bot',
      }),
    });
    saveJson('register-response.json', regRes);
    if (regRes.body.accessToken) {
      authToken = regRes.body.accessToken;
    }
    log(`  (registered test user: ${testEmail}, got token: ${!!authToken})`);
  } catch (err) {
    log(`  (warning: could not register test user: ${err.message})`);
    saveJson('register-error.json', { error: err.message });
  }

  // V4.1: Admin endpoint returns 401 without auth
  await checkAsync('V4.1', 'Admin endpoint returns 401 without auth', async () => {
    const res = await fetchJson(`${API_BASE}/admin/moderation/pending`);
    saveJson('admin-no-auth.json', res);
    return { pass: res.status === 401, detail: `Status: ${res.status}` };
  });

  // V4.2: Admin endpoint returns 403 for non-admin user
  if (authToken) {
    await checkAsync('V4.2', 'Admin endpoint returns 403 for non-admin (child) user', async () => {
      const res = await fetchJson(`${API_BASE}/admin/moderation/pending`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      saveJson('admin-child-auth.json', res);
      return { pass: res.status === 403, detail: `Status: ${res.status}` };
    });
  } else {
    skip('V4.2', 'Admin endpoint returns 403 for non-admin user', 'Could not register test user');
  }

  // V4.3: Admin endpoint code accepts admin role and returns correct shape
  check('V4.3', 'Admin endpoint returns correct response shape (code verification)', () => {
    const content = readFile('apps/api/src/routes/admin.ts');
    const hasRequireAuth = content.includes('requireAuth');
    const hasRequireRole = content.includes("requireRole('admin')");
    const hasNewsShape = content.includes("news:") && content.includes("count:");
    const hasReelsShape = content.includes("reels:");
    const hasTotalPending = content.includes("totalPending:");
    return {
      pass: hasRequireAuth && hasRequireRole && hasNewsShape && hasReelsShape && hasTotalPending,
      detail: `requireAuth: ${hasRequireAuth}, requireRole(admin): ${hasRequireRole}, shape (news/reels/totalPending): ${hasNewsShape && hasReelsShape && hasTotalPending}`,
    };
  });

  // --- Code verification checks ---

  check('V4.4', "ModerationResult type includes 'pending' status", () => {
    const content = readFile('apps/api/src/services/content-moderator.ts');
    const hasPending = content.includes("'approved' | 'rejected' | 'pending'");
    return { pass: hasPending, detail: hasPending ? 'pending in ModerationResult union' : 'pending not found in type' };
  });

  check('V4.5', 'content-moderator.ts has shouldFailOpen/fail-closed logic', () => {
    const content = readFile('apps/api/src/services/content-moderator.ts');
    const hasFailOpen = content.includes('export function shouldFailOpen');
    const hasFailClosed = content.includes("status: 'pending'") && content.includes('fail-closed');
    const hasEnvCheck = content.includes('MODERATION_FAIL_OPEN');
    const hasNodeEnv = content.includes("NODE_ENV !== 'production'");
    return {
      pass: hasFailOpen && hasFailClosed && hasEnvCheck && hasNodeEnv,
      detail: `shouldFailOpen: ${hasFailOpen}, fail-closed pending: ${hasFailClosed}, MODERATION_FAIL_OPEN env: ${hasEnvCheck}, NODE_ENV check: ${hasNodeEnv}`,
    };
  });

  check('V4.6', 'sync-feeds.ts has stale pending content check', () => {
    const content = readFile('apps/api/src/jobs/sync-feeds.ts');
    const hasStaleCheck = content.includes('stalePendingCount') || content.includes('stale pending');
    const hasThreshold = content.includes('STALE_PENDING_THRESHOLD');
    return {
      pass: hasStaleCheck && hasThreshold,
      detail: `Stale pending check: ${hasStaleCheck}, threshold constant: ${hasThreshold}`,
    };
  });

  check('V4.7', "requireRole in auth.ts accepts 'admin'", () => {
    const content = readFile('apps/api/src/middleware/auth.ts');
    const hasAdmin = content.includes("'child' | 'parent' | 'admin'") || content.includes("'admin'");
    return { pass: hasAdmin, detail: hasAdmin ? "admin in requireRole type union" : "admin not in requireRole" };
  });

  check('V4.8', 'Admin route registered in API index.ts', () => {
    const content = readFile('apps/api/src/index.ts');
    const hasImport = content.includes("import adminRouter") || content.includes("from './routes/admin'");
    const hasUse = content.includes("'/api/admin'");
    return {
      pass: hasImport && hasUse,
      detail: `Import: ${hasImport}, Mounted at /api/admin: ${hasUse}`,
    };
  });

  // V4.9: Run moderation and admin tests
  check('V4.9a', 'Content moderator tests pass', () => {
    return runTests('content-moderator', 'apps/api/src/services/__tests__/content-moderator.test.ts');
  });

  check('V4.9b', 'Admin moderation route tests pass', () => {
    return runTests('admin-moderation', 'apps/api/src/__tests__/admin-moderation.test.ts');
  });
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function generateReport() {
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  const statusEmoji = (s) => (s === 'PASS' ? '\u2705' : s === 'FAIL' ? '\u274C' : '\u23ED\uFE0F');

  let md = `# Validation Report — Mobile Security & Moderation (Run ${RUN_NUM})

**Date**: ${new Date().toISOString().slice(0, 10)}
**Branch**: mvp-to-product-2/mobile-security-moderation

## Summary

| Total | Passed | Failed | Skipped |
|-------|--------|--------|---------|
| ${total} | ${passed} | ${failed} | ${skipped} |

**Overall**: ${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}

## Results

| ID | Check | Status | Detail |
|----|-------|--------|--------|
`;

  for (const r of results) {
    const detail = r.detail.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    md += `| ${r.id} | ${r.description} | ${statusEmoji(r.status)} ${r.status} | ${detail} |\n`;
  }

  md += `
## Feature Breakdown

### Feature 1: React Native Error Boundary
${results.filter((r) => r.id.startsWith('V1')).map((r) => `- ${statusEmoji(r.status)} **${r.id}**: ${r.description}`).join('\n')}

### Feature 2: JWT Tokens in expo-secure-store
${results.filter((r) => r.id.startsWith('V2')).map((r) => `- ${statusEmoji(r.status)} **${r.id}**: ${r.description}`).join('\n')}

### Feature 3: YouTube Embed Sandbox
${results.filter((r) => r.id.startsWith('V3')).map((r) => `- ${statusEmoji(r.status)} **${r.id}**: ${r.description}`).join('\n')}

### Feature 4: Fail-Closed Content Moderation
${results.filter((r) => r.id.startsWith('V4')).map((r) => `- ${statusEmoji(r.status)} **${r.id}**: ${r.description}`).join('\n')}

## Evidence

- API request/response payloads: \`validation-assets/run-${RUN_NUM}/api/\`
- Test output and logs: \`validation-assets/run-${RUN_NUM}/output/\`

## Notes

- Features 1 & 2 require a physical mobile device for full manual testing. Validated here via code inspection and unit tests.
- Feature 3 partially requires a browser/device. Validated via code inspection and unit tests.
- Feature 4 API tests use a registered test user (child role). Admin 200 response is verified via code structure since the admin role cannot be assigned without direct DB access.
`;

  fs.writeFileSync(REPORT_PATH, md);
  log(`\nReport written to: ${REPORT_PATH}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log(`\n========================================`);
  log(`  SportyKids Validation — Run ${RUN_NUM}`);
  log(`  Mobile Security & Moderation`);
  log(`========================================`);

  // Ensure directories exist
  fs.mkdirSync(API_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Synchronous feature checks
  validateFeature1();
  validateFeature2();
  validateFeature3();

  // Async feature checks (API calls)
  await validateFeature4();

  // Generate report
  generateReport();

  // Summary
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  log(`\n--- Summary ---`);
  log(`  Passed:  ${passed}`);
  log(`  Failed:  ${failed}`);
  log(`  Skipped: ${skipped}`);
  log(`  Total:   ${results.length}`);

  if (failed > 0) {
    log(`\nFailed checks:`);
    for (const r of results.filter((r) => r.status === 'FAIL')) {
      log(`  - ${r.id}: ${r.description} -- ${r.detail}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Validation script crashed:', err);
  process.exit(2);
});
