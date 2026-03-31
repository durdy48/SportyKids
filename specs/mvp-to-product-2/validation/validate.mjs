#!/usr/bin/env node
/**
 * Validation script — Run 2 (re-validation after code review fixes).
 *
 * Re-runs ALL 30 original checks (V1.1–V4.9b) as regression, plus
 * 7 Appendix-A checks (items 16–22) that verify code-review fixes.
 *
 * Exit 0 = all pass, exit 1 = at least one failure.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..', '..');
const EVIDENCE_DIR = join(ROOT, 'specs', 'mvp-to-product-2', 'validation-assets', 'run-2');
const REPORT_PATH = join(ROOT, 'specs', 'mvp-to-product-2', 'validation-assets', 'validation-report-run-2.md');
const API_BASE = 'http://localhost:3001/api';

mkdirSync(EVIDENCE_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const results = [];
let passCount = 0;
let failCount = 0;

function record(id, name, passed, detail = '') {
  const status = passed ? 'PASS' : 'FAIL';
  results.push({ id, name, status, detail });
  if (passed) passCount++;
  else failCount++;
  console.log(`  ${passed ? '\x1b[32m✔' : '\x1b[31m✘'} ${id}: ${name}\x1b[0m${detail ? ` — ${detail}` : ''}`);
}

function saveEvidence(filename, content) {
  writeFileSync(join(EVIDENCE_DIR, filename), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

function readProjectFile(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

function fileContains(relPath, pattern) {
  const content = readProjectFile(relPath);
  if (typeof pattern === 'string') return content.includes(pattern);
  return pattern.test(content);
}

function runCmd(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 120_000, ...opts });
  } catch (e) {
    return e.stdout || e.stderr || e.message || '';
  }
}

function runTests(testPath, workspace) {
  // Mobile tests must run from apps/mobile; API from apps/api; shared from root
  let cwd = ROOT;
  let relativePath = testPath;
  if (testPath.startsWith('apps/mobile/')) {
    cwd = join(ROOT, 'apps', 'mobile');
    relativePath = testPath.replace('apps/mobile/', '');
  } else if (testPath.startsWith('apps/api/')) {
    cwd = join(ROOT, 'apps', 'api');
    relativePath = testPath.replace('apps/api/', '');
  }
  const cmd = `npx vitest run ${relativePath} --reporter=verbose 2>&1`;
  const output = runCmd(cmd, { timeout: 180_000, cwd });
  return output;
}

/** Create a JWT for testing admin endpoints. Uses jsonwebtoken via Node eval. */
function createTestAdminToken() {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  // Use single quotes for the outer shell string to avoid quoting issues with the secret
  const cmd = `node -e 'const jwt=require("jsonwebtoken");console.log(jwt.sign({userId:"test-admin",role:"admin"},"${secret}",{expiresIn:"5m"}))'`;
  return runCmd(cmd).trim();
}

async function fetchJson(url, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: {}, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n========================================');
  console.log('  SportyKids — Validation Run 2');
  console.log('  Mobile Security & Moderation');
  console.log('========================================\n');

  const startTime = Date.now();

  // =========================================================================
  // FEATURE 1 — Error Boundary (V1.1–V1.5)
  // =========================================================================
  console.log('\n--- Feature 1: React Native Error Boundary ---\n');

  // V1.1 — ErrorBoundary component exists
  {
    const exists = fileExists('apps/mobile/src/components/ErrorBoundary.tsx');
    record('V1.1', 'ErrorBoundary.tsx exists', exists);
    if (exists) {
      saveEvidence('V1.1-file-exists.txt', 'File found at apps/mobile/src/components/ErrorBoundary.tsx');
    }
  }

  // V1.2 — ErrorBoundary is a class component with getDerivedStateFromError
  {
    const content = readProjectFile('apps/mobile/src/components/ErrorBoundary.tsx');
    const isClass = /class\s+ErrorBoundary\s+extends\s+React\.Component/.test(content);
    const hasDerived = content.includes('getDerivedStateFromError');
    const hasDidCatch = content.includes('componentDidCatch');
    const pass = isClass && hasDerived && hasDidCatch;
    record('V1.2', 'ErrorBoundary is class component with lifecycle methods', pass,
      `class=${isClass}, getDerivedStateFromError=${hasDerived}, componentDidCatch=${hasDidCatch}`);
    saveEvidence('V1.2-class-check.txt', `isClass: ${isClass}\nhasDerived: ${hasDerived}\nhasDidCatch: ${hasDidCatch}`);
  }

  // V1.3 — ErrorBoundary wraps entire App
  {
    const appContent = readProjectFile('apps/mobile/src/App.tsx');
    const importsEB = /import\s+\{?\s*ErrorBoundary\s*\}?\s+from/.test(appContent);
    const wrapsApp = /<ErrorBoundary[\s>]/.test(appContent) && /<\/ErrorBoundary>/.test(appContent);
    const pass = importsEB && wrapsApp;
    record('V1.3', 'ErrorBoundary wraps entire app in App.tsx', pass,
      `imports=${importsEB}, wraps=${wrapsApp}`);
  }

  // V1.4 — ErrorBoundary uses KID_FRIENDLY_ERRORS.crash
  {
    const content = readProjectFile('apps/mobile/src/components/ErrorBoundary.tsx');
    const usesCrash = content.includes('KID_FRIENDLY_ERRORS.crash') || content.includes('KID_FRIENDLY_ERRORS').valueOf() && content.includes('.crash');
    const importsKFE = /KID_FRIENDLY_ERRORS/.test(content);
    const pass = usesCrash && importsKFE;
    record('V1.4', 'ErrorBoundary uses KID_FRIENDLY_ERRORS.crash', pass);
  }

  // V1.5 — ErrorBoundary reports to Sentry (dynamic import)
  {
    const content = readProjectFile('apps/mobile/src/components/ErrorBoundary.tsx');
    const hasSentry = content.includes('@sentry/react-native');
    const hasDynamicImport = /import\s*\(\s*['"]@sentry\/react-native['"]\s*\)/.test(content);
    const hasCatch = /catch\s*\{/.test(content) || /catch\s*\(/.test(content);
    const pass = hasSentry && hasDynamicImport && hasCatch;
    record('V1.5', 'Sentry reporting via dynamic import with catch fallback', pass,
      `hasSentry=${hasSentry}, dynamicImport=${hasDynamicImport}, catchFallback=${hasCatch}`);
  }

  // =========================================================================
  // FEATURE 2 — JWT in SecureStore (V2.1–V2.7)
  // =========================================================================
  console.log('\n--- Feature 2: JWT Tokens in expo-secure-store ---\n');

  // V2.1 — secure-storage.ts exists
  {
    const exists = fileExists('apps/mobile/src/lib/secure-storage.ts');
    record('V2.1', 'secure-storage.ts exists', exists);
  }

  // V2.2 — secure-storage exports required functions
  {
    const content = readProjectFile('apps/mobile/src/lib/secure-storage.ts');
    const exports = ['secureGetItem', 'secureSetItem', 'secureDeleteItem', 'migrateTokensToSecureStore', 'isSecureStoreAvailable'];
    const missing = exports.filter(e => !content.includes(`export async function ${e}`) && !content.includes(`export function ${e}`));
    const pass = missing.length === 0;
    record('V2.2', 'secure-storage exports all required functions', pass,
      missing.length ? `missing: ${missing.join(', ')}` : 'all present');
  }

  // V2.3 — secure-storage uses expo-secure-store
  {
    const content = readProjectFile('apps/mobile/src/lib/secure-storage.ts');
    const usesESS = content.includes('expo-secure-store');
    record('V2.3', 'secure-storage uses expo-secure-store', usesESS);
  }

  // V2.4 — secure-storage falls back to AsyncStorage
  {
    const content = readProjectFile('apps/mobile/src/lib/secure-storage.ts');
    const usesAS = content.includes('AsyncStorage');
    record('V2.4', 'secure-storage falls back to AsyncStorage', usesAS);
  }

  // V2.5 — auth.ts imports from secure-storage (not AsyncStorage directly for tokens)
  {
    const content = readProjectFile('apps/mobile/src/lib/auth.ts');
    const importsSecure = content.includes('./secure-storage') || content.includes('../lib/secure-storage');
    const usesSecureFns = content.includes('secureGetItem') && content.includes('secureSetItem') && content.includes('secureDeleteItem');
    const pass = importsSecure && usesSecureFns;
    record('V2.5', 'auth.ts uses secure-storage for token operations', pass,
      `importsSecure=${importsSecure}, usesSecureFns=${usesSecureFns}`);
  }

  // V2.6 — App.tsx calls initSecureTokenStorage on startup
  {
    const content = readProjectFile('apps/mobile/src/App.tsx');
    const imports = content.includes('initSecureTokenStorage');
    const calls = content.includes('initSecureTokenStorage()');
    const pass = imports && calls;
    record('V2.6', 'App.tsx calls initSecureTokenStorage on startup', pass);
  }

  // V2.7 — expo-secure-store in package.json dependencies
  {
    const pkg = JSON.parse(readProjectFile('apps/mobile/package.json'));
    const hasDep = !!(pkg.dependencies?.['expo-secure-store'] || pkg.devDependencies?.['expo-secure-store']);
    record('V2.7', 'expo-secure-store in mobile package.json', hasDep);
  }

  // =========================================================================
  // FEATURE 3 — YouTube Embed Sandbox (V3.1–V3.8)
  // =========================================================================
  console.log('\n--- Feature 3: YouTube Embed Sandbox Parameters ---\n');

  // V3.1 — youtube.ts exists in shared utils
  {
    const exists = fileExists('packages/shared/src/utils/youtube.ts');
    record('V3.1', 'youtube.ts exists in shared utils', exists);
  }

  // V3.2 — youtube.ts exports buildYouTubeEmbedUrl, extractYouTubeVideoId, getYouTubePlayerVars
  {
    const content = readProjectFile('packages/shared/src/utils/youtube.ts');
    const fns = ['buildYouTubeEmbedUrl', 'extractYouTubeVideoId', 'getYouTubePlayerVars'];
    const missing = fns.filter(f => !content.includes(`export function ${f}`));
    const pass = missing.length === 0;
    record('V3.2', 'youtube.ts exports all 3 public functions', pass,
      missing.length ? `missing: ${missing.join(', ')}` : 'all present');
  }

  // V3.3 — Child-safe params: modestbranding, rel=0, iv_load_policy=3, disablekb=1, playsinline=1
  {
    const content = readProjectFile('packages/shared/src/utils/youtube.ts');
    const params = [
      ["modestbranding", "'1'"],
      ["rel", "'0'"],
      ["iv_load_policy", "'3'"],
      ["disablekb", "'1'"],
      ["playsinline", "'1'"],
    ];
    const checks = params.map(([key, val]) => ({
      key,
      found: content.includes(`${key}: ${val}`) || content.includes(`${key}: '${val.replace(/'/g, '')}'`)
    }));
    const allFound = checks.every(c => c.found);
    record('V3.3', 'Child-safe params present in CHILD_SAFE_PARAMS', allFound,
      checks.map(c => `${c.key}=${c.found}`).join(', '));
  }

  // V3.4 — Web-only fs=0 param
  {
    const content = readProjectFile('packages/shared/src/utils/youtube.ts');
    const hasFs0 = content.includes("fs: '0'");
    const hasWebOnly = content.includes('WEB_ONLY_PARAMS');
    const pass = hasFs0 && hasWebOnly;
    record('V3.4', 'Web-only fs=0 param in WEB_ONLY_PARAMS', pass);
  }

  // V3.5 — shared/utils/index.ts re-exports YouTube functions
  {
    const content = readProjectFile('packages/shared/src/utils/index.ts');
    const reExports = content.includes("from './youtube'");
    const hasBuild = content.includes('buildYouTubeEmbedUrl');
    const hasExtract = content.includes('extractYouTubeVideoId');
    const hasPlayerVars = content.includes('getYouTubePlayerVars');
    const pass = reExports && hasBuild && hasExtract && hasPlayerVars;
    record('V3.5', 'shared/utils/index.ts re-exports YouTube functions', pass);
  }

  // V3.6 — Web VideoPlayer uses buildYouTubeEmbedUrl from shared
  {
    const content = readProjectFile('apps/web/src/components/VideoPlayer.tsx');
    const importsBuild = content.includes('buildYouTubeEmbedUrl');
    const importsShared = content.includes('@sportykids/shared');
    const pass = importsBuild && importsShared;
    record('V3.6', 'Web VideoPlayer uses buildYouTubeEmbedUrl from shared', pass);
  }

  // V3.7 — Web VideoPlayer uses sandbox attribute on iframes
  {
    const content = readProjectFile('apps/web/src/components/VideoPlayer.tsx');
    const hasSandbox = content.includes('sandbox=');
    const hasAllowScripts = content.includes('allow-scripts');
    const hasAllowSameOrigin = content.includes('allow-same-origin');
    const pass = hasSandbox && hasAllowScripts && hasAllowSameOrigin;
    record('V3.7', 'Web VideoPlayer uses sandbox attribute on iframes', pass,
      `sandbox=${hasSandbox}, allow-scripts=${hasAllowScripts}, allow-same-origin=${hasAllowSameOrigin}`);
  }

  // V3.8 — Mobile VideoPlayer uses getYouTubePlayerVars from shared
  {
    const content = readProjectFile('apps/mobile/src/components/VideoPlayer.tsx');
    const importsPlayerVars = content.includes('getYouTubePlayerVars');
    const importsShared = content.includes('@sportykids/shared');
    const pass = importsPlayerVars && importsShared;
    record('V3.8', 'Mobile VideoPlayer uses getYouTubePlayerVars from shared', pass);
  }

  // =========================================================================
  // FEATURE 4 — Fail-Closed Content Moderation (V4.1–V4.9b)
  // =========================================================================
  console.log('\n--- Feature 4: Fail-Closed Content Moderation ---\n');

  // V4.1 — content-moderator.ts exports shouldFailOpen
  {
    const content = readProjectFile('apps/api/src/services/content-moderator.ts');
    const hasExport = content.includes('export function shouldFailOpen');
    record('V4.1', 'content-moderator.ts exports shouldFailOpen', hasExport);
  }

  // V4.2 — shouldFailOpen returns true in dev, false in production
  {
    const content = readProjectFile('apps/api/src/services/content-moderator.ts');
    const checksNodeEnv = content.includes("process.env.NODE_ENV !== 'production'") || content.includes("process.env.NODE_ENV === 'production'");
    const checksEnvVar = content.includes("MODERATION_FAIL_OPEN");
    const pass = checksNodeEnv && checksEnvVar;
    record('V4.2', 'shouldFailOpen checks NODE_ENV and MODERATION_FAIL_OPEN', pass);
  }

  // V4.3 — moderateContent returns pending on AI failure in production
  {
    const content = readProjectFile('apps/api/src/services/content-moderator.ts');
    const returnsPending = content.includes("status: 'pending'") && content.includes('fail-closed');
    record('V4.3', 'moderateContent returns pending on AI failure (fail-closed path)', returnsPending);
  }

  // V4.4 — moderateContent returns approved on AI failure in dev (fail-open)
  {
    const content = readProjectFile('apps/api/src/services/content-moderator.ts');
    const returnsApproved = content.includes("status: 'approved'") && content.includes('fail-open');
    record('V4.4', 'moderateContent returns approved on AI failure (fail-open path)', returnsApproved);
  }

  // V4.5 — admin.ts route exists
  {
    const exists = fileExists('apps/api/src/routes/admin.ts');
    record('V4.5', 'admin.ts route exists', exists);
  }

  // V4.6 — admin route registered in index.ts
  {
    const content = readProjectFile('apps/api/src/index.ts');
    const importsAdmin = content.includes("import adminRouter from './routes/admin'");
    const usesAdmin = content.includes("app.use('/api/admin', adminRouter)");
    const pass = importsAdmin && usesAdmin;
    record('V4.6', 'Admin router registered in index.ts', pass,
      `imports=${importsAdmin}, uses=${usesAdmin}`);
  }

  // V4.7 — admin moderation endpoint requires auth + admin role
  {
    const content = readProjectFile('apps/api/src/routes/admin.ts');
    const hasRequireAuth = content.includes('requireAuth');
    const hasRequireRole = content.includes("requireRole('admin')");
    const pass = hasRequireAuth && hasRequireRole;
    record('V4.7', 'Admin endpoint requires auth + admin role', pass);
  }

  // V4.8 — KID_FRIENDLY_ERRORS has crash entry
  {
    const content = readProjectFile('packages/shared/src/constants/errors.ts');
    const hasCrash = content.includes("crash:");
    const hasCrashTitle = content.includes("kid_errors.crash_title");
    const hasCrashMessage = content.includes("kid_errors.crash_message");
    const pass = hasCrash && hasCrashTitle && hasCrashMessage;
    record('V4.8', 'KID_FRIENDLY_ERRORS has crash entry', pass);
  }

  // V4.9a — i18n es.json has crash keys
  {
    const content = readProjectFile('packages/shared/src/i18n/es.json');
    const hasCrashTitle = content.includes('crash_title');
    const hasCrashMessage = content.includes('crash_message');
    const hasRestart = content.includes('"restart"');
    const pass = hasCrashTitle && hasCrashMessage && hasRestart;
    record('V4.9a', 'i18n es.json has crash_title, crash_message, restart', pass);
  }

  // V4.9b — i18n en.json has crash keys
  {
    const content = readProjectFile('packages/shared/src/i18n/en.json');
    const hasCrashTitle = content.includes('crash_title');
    const hasCrashMessage = content.includes('crash_message');
    const hasRestart = content.includes('"restart"');
    const pass = hasCrashTitle && hasCrashMessage && hasRestart;
    record('V4.9b', 'i18n en.json has crash_title, crash_message, restart', pass);
  }

  // =========================================================================
  // TEST RUNS (V-T1 through V-T5)
  // =========================================================================
  console.log('\n--- Test Suite Runs ---\n');

  // V-T1 — ErrorBoundary tests pass
  {
    const output = runTests('apps/mobile/src/components/__tests__/ErrorBoundary.test.tsx');
    const passed = output.includes('Tests  ') ? !output.includes('fail') || output.includes('0 failed') : output.includes('passed');
    const allPass = !output.includes('FAIL') || output.includes('✓') || output.includes('Tests  ');
    // More reliable: check exit and for failure indicators
    const hasFailed = /\d+\s+failed/.test(output) && !/0\s+failed/.test(output);
    const pass = !hasFailed && (output.includes('passed') || output.includes('✓'));
    record('V-T1', 'ErrorBoundary tests pass', pass);
    saveEvidence('V-T1-errorboundary-tests.txt', output);
  }

  // V-T2 — secure-storage tests pass
  {
    const output = runTests('apps/mobile/src/lib/__tests__/secure-storage.test.ts');
    const hasFailed = /\d+\s+failed/.test(output) && !/0\s+failed/.test(output);
    const pass = !hasFailed && (output.includes('passed') || output.includes('✓'));
    record('V-T2', 'secure-storage tests pass', pass);
    saveEvidence('V-T2-secure-storage-tests.txt', output);
  }

  // V-T3 — auth tests pass
  {
    const output = runTests('apps/mobile/src/lib/__tests__/auth.test.ts');
    const hasFailed = /\d+\s+failed/.test(output) && !/0\s+failed/.test(output);
    const pass = !hasFailed && (output.includes('passed') || output.includes('✓'));
    record('V-T3', 'auth tests pass', pass);
    saveEvidence('V-T3-auth-tests.txt', output);
  }

  // V-T4 — YouTube utils tests pass
  {
    const output = runTests('packages/shared/src/utils/__tests__/youtube.test.ts');
    const hasFailed = /\d+\s+failed/.test(output) && !/0\s+failed/.test(output);
    const pass = !hasFailed && (output.includes('passed') || output.includes('✓'));
    record('V-T4', 'YouTube utils tests pass', pass);
    saveEvidence('V-T4-youtube-tests.txt', output);
  }

  // V-T5 — content-moderator tests pass
  {
    const output = runTests('apps/api/src/services/__tests__/content-moderator.test.ts');
    const hasFailed = /\d+\s+failed/.test(output) && !/0\s+failed/.test(output);
    const pass = !hasFailed && (output.includes('passed') || output.includes('✓'));
    record('V-T5', 'content-moderator tests pass', pass);
    saveEvidence('V-T5-content-moderator-tests.txt', output);
  }

  // =========================================================================
  // API LIVE CHECKS (V-A1 through V-A3)
  // =========================================================================
  console.log('\n--- API Live Checks ---\n');

  // V-A1 — Health check
  {
    const { status, body } = await fetchJson(`${API_BASE}/health`);
    const pass = status === 200 && body?.status === 'ok';
    record('V-A1', 'GET /api/health returns 200', pass, `status=${status}`);
    saveEvidence('V-A1-health.json', body);
  }

  // V-A2 — Admin endpoint rejects unauthenticated requests
  {
    const { status } = await fetchJson(`${API_BASE}/admin/moderation/pending`);
    const pass = status === 401;
    record('V-A2', 'Admin endpoint rejects unauthenticated (401)', pass, `status=${status}`);
  }

  // V-A3 — Admin endpoint rejects non-admin JWT
  {
    const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    const nonAdminToken = runCmd(
      `node -e 'const jwt=require("jsonwebtoken");console.log(jwt.sign({userId:"test-child",role:"child"},"${secret}",{expiresIn:"5m"}))'`,
    ).trim();
    const { status } = await fetchJson(`${API_BASE}/admin/moderation/pending`, {
      Authorization: `Bearer ${nonAdminToken}`,
    });
    const pass = status === 403;
    record('V-A3', 'Admin endpoint rejects non-admin JWT (403)', pass, `status=${status}`);
  }

  // =========================================================================
  // APPENDIX A — Code Review Fixes (items 16–22)
  // =========================================================================
  console.log('\n--- Appendix A: Code Review Fixes ---\n');

  // A16 — buildYouTubeEmbedUrl produces disablekb=1 (not disablekb=0)
  {
    // Evaluate the function by reading the source and checking CHILD_SAFE_PARAMS
    const content = readProjectFile('packages/shared/src/utils/youtube.ts');
    // Check the constant definition
    const hasDisablekb1 = /disablekb:\s*'1'/.test(content);
    const noDisablekb0 = !/disablekb:\s*'0'/.test(content);
    // Also verify via node execution
    const evalOutput = runCmd(
      `node -e "
        const {buildYouTubeEmbedUrl} = require('${join(ROOT, 'packages/shared/src/utils/youtube.ts').replace(/'/g, "\\'")}');
        console.log('noop');
      " 2>&1 || true`,
    );
    // Since it's TS, use tsx or just check the source
    // More reliable: run via the test infrastructure
    const tsxOutput = runCmd(
      `node -e "
        // Parse the TS source to verify disablekb value
        const fs = require('fs');
        const src = fs.readFileSync('${join(ROOT, 'packages/shared/src/utils/youtube.ts').replace(/'/g, "\\'")}', 'utf8');
        const match = src.match(/disablekb:\\s*'(\\d)'/);
        console.log(match ? match[1] : 'NOT_FOUND');
      "`,
    ).trim();
    const pass = hasDisablekb1 && noDisablekb0 && tsxOutput === '1';
    record('A16', 'buildYouTubeEmbedUrl uses disablekb=1 (not 0)', pass,
      `source has disablekb:\'1\'=${hasDisablekb1}, no \'0\'=${noDisablekb0}, extracted=${tsxOutput}`);
    saveEvidence('A16-disablekb.txt', `CHILD_SAFE_PARAMS disablekb value: ${tsxOutput}\nhasDisablekb1: ${hasDisablekb1}\nnoDisablekb0: ${noDisablekb0}`);
  }

  // A17 — GET /api/admin/moderation/pending returns correct shape with admin JWT
  {
    const adminToken = createTestAdminToken();
    const { status, body } = await fetchJson(`${API_BASE}/admin/moderation/pending`, {
      Authorization: `Bearer ${adminToken}`,
    });

    let pass = false;
    let detail = `status=${status}`;

    if (status === 200 && body) {
      const hasPending = Array.isArray(body.pending);
      const hasTotal = typeof body.total === 'number';
      const hasOldest = typeof body.oldestPendingMinutes === 'number';
      const shapeOk = hasPending && hasTotal && hasOldest;

      // Check item shape if there are items
      let itemShapeOk = true;
      if (body.pending?.length > 0) {
        const item = body.pending[0];
        itemShapeOk = (
          'id' in item &&
          'title' in item &&
          'summary' in item &&
          'createdAt' in item &&
          'pendingMinutes' in item &&
          (typeof item.summary === 'string' && item.summary.length <= 200)
        );
      }

      // Check ordering (createdAt ASC)
      let orderOk = true;
      if (body.pending?.length > 1) {
        for (let i = 1; i < body.pending.length; i++) {
          if (new Date(body.pending[i].createdAt) < new Date(body.pending[i - 1].createdAt)) {
            orderOk = false;
            break;
          }
        }
      }

      // Check max 100 items
      const limitOk = (body.pending?.length ?? 0) <= 100;

      pass = shapeOk && itemShapeOk && orderOk && limitOk;
      detail = `status=${status}, shape=${shapeOk}, itemShape=${itemShapeOk}, order=${orderOk}, limit=${limitOk}, count=${body.pending?.length}`;
    }

    record('A17', 'Admin moderation endpoint returns correct shape', pass, detail);
    saveEvidence('A17-admin-response.json', body);
  }

  // A18 — Stale pending threshold is 30 minutes in sync-feeds.ts
  {
    const content = readProjectFile('apps/api/src/jobs/sync-feeds.ts');
    const match = content.match(/STALE_PENDING_THRESHOLD_MINUTES\s*=\s*(\d+)/);
    const value = match ? parseInt(match[1], 10) : null;
    const pass = value === 30;
    record('A18', 'Stale pending threshold is 30 minutes', pass,
      `value=${value}`);
    saveEvidence('A18-stale-threshold.txt', `STALE_PENDING_THRESHOLD_MINUTES = ${value}`);
  }

  // A19 — ErrorBoundary uses COLORS constants, NOT hardcoded hex for bg/text/muted
  {
    const content = readProjectFile('apps/mobile/src/components/ErrorBoundary.tsx');
    const usesColorsImport = /import.*COLORS.*from.*@sportykids\/shared/.test(content) || content.includes("{ COLORS");

    // Check that the main UI colors use COLORS.xxx not hardcoded hex
    // Acceptable hardcoded: #FFFFFF for button text, debug-only colors (#FEF2F2, #DC2626, #7F1D1D)
    const styleSection = content.slice(content.indexOf('StyleSheet.create'));

    const usesColorsBackground = styleSection.includes('COLORS.background');
    const usesColorsText = styleSection.includes('COLORS.text');
    const usesColorsMuted = styleSection.includes('COLORS.muted');
    const usesColorsBlue = styleSection.includes('COLORS.blue');

    // Verify NO hardcoded #F8FAFC (background), #1E293B (text), #6B7280 (muted) in styles
    const hasHardcodedBg = /['"]#F8FAFC['"]/.test(styleSection);
    const hasHardcodedText = /['"]#1E293B['"]/.test(styleSection);
    const hasHardcodedMuted = /['"]#6B7280['"]/.test(styleSection);

    const pass = usesColorsImport && usesColorsBackground && usesColorsText && usesColorsMuted && usesColorsBlue
      && !hasHardcodedBg && !hasHardcodedText && !hasHardcodedMuted;
    record('A19', 'ErrorBoundary uses COLORS constants (no hardcoded theme hex)', pass,
      `import=${usesColorsImport}, bg=${usesColorsBackground}, text=${usesColorsText}, muted=${usesColorsMuted}, blue=${usesColorsBlue}, noHardcodedBg=${!hasHardcodedBg}, noHardcodedText=${!hasHardcodedText}, noHardcodedMuted=${!hasHardcodedMuted}`);
    saveEvidence('A19-colors-usage.txt', `COLORS import: ${usesColorsImport}\nCOLORS.background: ${usesColorsBackground}\nCOLORS.text: ${usesColorsText}\nCOLORS.muted: ${usesColorsMuted}\nCOLORS.blue: ${usesColorsBlue}\nHardcoded #F8FAFC: ${hasHardcodedBg}\nHardcoded #1E293B: ${hasHardcodedText}\nHardcoded #6B7280: ${hasHardcodedMuted}`);
  }

  // A20 — Web VideoPlayer: ALL iframes have allowFullScreen={false}
  {
    const content = readProjectFile('apps/web/src/components/VideoPlayer.tsx');
    // Count all iframe occurrences
    const iframeMatches = content.match(/<iframe[\s\S]*?\/>/g) || [];
    const totalIframes = iframeMatches.length;

    // Count iframes with allowFullScreen={false}
    const iframesWithDisabled = iframeMatches.filter(iframe => iframe.includes('allowFullScreen={false}')).length;

    // Ensure no iframe has allowFullScreen={true} or allowFullScreen without value
    const iframesWithEnabled = iframeMatches.filter(iframe =>
      iframe.includes('allowFullScreen={true}') ||
      (iframe.includes('allowFullScreen') && !iframe.includes('allowFullScreen={false}'))
    ).length;

    const pass = totalIframes > 0 && iframesWithDisabled === totalIframes && iframesWithEnabled === 0;
    record('A20', 'Web VideoPlayer: ALL iframes have allowFullScreen={false}', pass,
      `total iframes=${totalIframes}, with false=${iframesWithDisabled}, with true/default=${iframesWithEnabled}`);
    saveEvidence('A20-allowfullscreen.txt', `Total iframes: ${totalIframes}\nWith allowFullScreen={false}: ${iframesWithDisabled}\nWith enabled: ${iframesWithEnabled}`);
  }

  // A21 — ErrorBoundary tests include render-based tests
  {
    const content = readProjectFile('apps/mobile/src/components/__tests__/ErrorBoundary.test.tsx');

    // Check for render-based tests:
    // 1. Tests that render a throwing child and check crash UI
    const hasThrowingChild = content.includes('ThrowingChild');
    const hasCrashUICheck = content.includes('crash_title') || content.includes('crash_message');
    const hasRenderTest = content.includes('renders crash UI') || content.includes('renders children');
    const hasRestartTest = content.includes('restart button') || content.includes('handleRestart');

    // Check for react-test-renderer or testing-library usage
    const hasRenderer = content.includes('react-test-renderer') || content.includes('@testing-library');
    const hasCreate = content.includes('create(') || content.includes('render(');

    const pass = hasThrowingChild && hasCrashUICheck && hasRenderTest && hasRestartTest && hasRenderer && hasCreate;
    record('A21', 'ErrorBoundary tests include render-based tests', pass,
      `throwingChild=${hasThrowingChild}, crashUI=${hasCrashUICheck}, renderTest=${hasRenderTest}, restartTest=${hasRestartTest}, renderer=${hasRenderer}`);
    saveEvidence('A21-render-tests.txt', `ThrowingChild component: ${hasThrowingChild}\nCrash UI verification: ${hasCrashUICheck}\nRender test: ${hasRenderTest}\nRestart button test: ${hasRestartTest}\nRenderer import: ${hasRenderer}\nCreate/render call: ${hasCreate}`);
  }

  // A22 — All original checks still pass (covered by V1.1–V4.9b above)
  {
    const originalChecks = results.filter(r => r.id.startsWith('V'));
    const allOriginalPass = originalChecks.every(r => r.status === 'PASS');
    record('A22', 'All original V-checks pass (regression)', allOriginalPass,
      `${originalChecks.filter(r => r.status === 'PASS').length}/${originalChecks.length} passed`);
  }

  // =========================================================================
  // Summary
  // =========================================================================
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const total = passCount + failCount;

  console.log('\n========================================');
  console.log(`  Results: ${passCount}/${total} passed, ${failCount} failed`);
  console.log(`  Duration: ${duration}s`);
  console.log('========================================\n');

  // =========================================================================
  // Generate Markdown Report
  // =========================================================================

  const now = new Date().toISOString();
  let report = `# Validation Report — Run 2\n\n`;
  report += `**Date:** ${now}\n`;
  report += `**Duration:** ${duration}s\n`;
  report += `**Result:** ${failCount === 0 ? 'ALL PASSED' : `${failCount} FAILED`}\n`;
  report += `**Total checks:** ${total} (${passCount} passed, ${failCount} failed)\n\n`;

  report += `## Original Checks (V1.1–V4.9b) — Regression\n\n`;
  report += `| ID | Check | Status | Detail |\n`;
  report += `|----|-------|--------|--------|\n`;
  for (const r of results.filter(r => r.id.startsWith('V'))) {
    report += `| ${r.id} | ${r.name} | ${r.status === 'PASS' ? '✅' : '❌'} ${r.status} | ${r.detail} |\n`;
  }

  report += `\n## Appendix A Checks (A16–A22) — Code Review Fixes\n\n`;
  report += `| ID | Check | Status | Detail |\n`;
  report += `|----|-------|--------|--------|\n`;
  for (const r of results.filter(r => r.id.startsWith('A'))) {
    report += `| ${r.id} | ${r.name} | ${r.status === 'PASS' ? '✅' : '❌'} ${r.status} | ${r.detail} |\n`;
  }

  report += `\n## Evidence Files\n\n`;
  try {
    const evidenceFiles = readdirSync(EVIDENCE_DIR).sort();
    for (const f of evidenceFiles) {
      report += `- \`${f}\`\n`;
    }
  } catch {
    report += `_No evidence directory found_\n`;
  }

  report += `\n---\n_Generated by validate.mjs — Run 2_\n`;

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, report);
  console.log(`Report saved to: ${REPORT_PATH}`);
  saveEvidence('summary.json', { date: now, duration, total, passed: passCount, failed: failCount, results });

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Validation script crashed:', err);
  process.exit(2);
});
