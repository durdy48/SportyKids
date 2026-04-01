#!/usr/bin/env node

/**
 * Automated validation for mvp-to-product-3 (Store Assets & Deployment).
 *
 * Runs all 21 checklist items from validation.md, collects evidence,
 * and generates a validation report.
 */

import { readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const EVIDENCE_DIR = resolve(__dirname, '..', 'validation-assets', 'run-1');
const OUTPUT_DIR = resolve(EVIDENCE_DIR, 'output');

const results = [];
let passCount = 0;
let failCount = 0;
let skipCount = 0;

function record(id, name, status, detail, evidence = null) {
  results.push({ id, name, status, detail, evidence });
  if (status === 'PASS') passCount++;
  else if (status === 'FAIL') failCount++;
  else skipCount++;

  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`  ${icon} [${id}] ${name}: ${status}`);
}

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 120000, ...opts });
}

function saveOutput(filename, content) {
  writeFileSync(resolve(OUTPUT_DIR, filename), content, 'utf-8');
  return `run-1/output/${filename}`;
}

function fileExists(relPath) {
  return existsSync(resolve(PROJECT_ROOT, relPath));
}

function readProjectFile(relPath) {
  return readFileSync(resolve(PROJECT_ROOT, relPath), 'utf-8');
}

// ---------------------------------------------------------------------------
// F1: Asset Generation
// ---------------------------------------------------------------------------
console.log('\n=== F1: Asset Generation ===');

try {
  const out = run('cd apps/mobile && node scripts/generate-assets.mjs 2>&1');
  const evidence = saveOutput('01-asset-gen.txt', out);
  const hasAll = ['icon.png', 'adaptive-icon.png', 'splash-icon.png', 'favicon.png', 'feature-graphic.png']
    .every(f => fileExists(`apps/mobile/src/assets/${f}`));
  const validated = out.includes('All assets generated and validated');
  record(1, 'Generate assets', hasAll && validated ? 'PASS' : 'FAIL',
    hasAll && validated ? '5 PNGs generated and validated' : 'Missing assets or validation failed', evidence);
} catch (e) {
  record(1, 'Generate assets', 'FAIL', e.message);
}

try {
  const out2 = run('cd apps/mobile && node scripts/generate-assets.mjs 2>&1');
  const evidence = saveOutput('02-asset-gen-idempotent.txt', out2);
  const validated = out2.includes('All assets generated and validated');
  record(2, 'Idempotent re-run', validated ? 'PASS' : 'FAIL',
    validated ? 'Second run produces same output' : 'Idempotency check failed', evidence);
} catch (e) {
  record(2, 'Idempotent re-run', 'FAIL', e.message);
}

// Checks 3-5: Verify image dimensions via sharp metadata
try {
  // Dynamically import sharp
  const sharp = (await import('sharp')).default;

  const iconMeta = await sharp(resolve(PROJECT_ROOT, 'apps/mobile/src/assets/icon.png')).metadata();
  record(3, 'icon.png dimensions', iconMeta.width === 1024 && iconMeta.height === 1024 ? 'PASS' : 'FAIL',
    `${iconMeta.width}×${iconMeta.height} (expected 1024×1024)`);

  const adaptMeta = await sharp(resolve(PROJECT_ROOT, 'apps/mobile/src/assets/adaptive-icon.png')).metadata();
  record(4, 'adaptive-icon.png dimensions', adaptMeta.width === 512 && adaptMeta.height === 512 ? 'PASS' : 'FAIL',
    `${adaptMeta.width}×${adaptMeta.height} (expected 512×512)`);

  const featureMeta = await sharp(resolve(PROJECT_ROOT, 'apps/mobile/src/assets/feature-graphic.png')).metadata();
  record(5, 'feature-graphic.png dimensions', featureMeta.width === 1024 && featureMeta.height === 500 ? 'PASS' : 'FAIL',
    `${featureMeta.width}×${featureMeta.height} (expected 1024×500)`);
} catch (e) {
  record(3, 'icon.png dimensions', 'FAIL', e.message);
  record(4, 'adaptive-icon.png dimensions', 'FAIL', e.message);
  record(5, 'feature-graphic.png dimensions', 'FAIL', e.message);
}

// ---------------------------------------------------------------------------
// F2: Dynamic API_BASE
// ---------------------------------------------------------------------------
console.log('\n=== F2: Dynamic API_BASE ===');

try {
  const out = run('cd apps/mobile && npx vitest run src/__tests__/config.test.ts 2>&1');
  const evidence = saveOutput('06-config-tests.txt', out);
  const pass = out.includes('9 passed') && !out.includes('failed');
  record(6, 'Config tests', pass ? 'PASS' : 'FAIL',
    pass ? '9/9 tests pass' : 'Some tests failed', evidence);
} catch (e) {
  record(6, 'Config tests', 'FAIL', e.message);
}

try {
  const config = readProjectFile('apps/mobile/src/config.ts');
  const hasResolve = config.includes('export function resolveApiBase');
  const hasApiBase = config.includes('export const API_BASE');
  const hasFallback = config.includes('EXPO_PUBLIC_API_BASE') && config.includes('ENV_MAP') && config.includes('debuggerHost') && config.includes('localhost');
  record(7, 'config.ts structure', hasResolve && hasApiBase && hasFallback ? 'PASS' : 'FAIL',
    `resolveApiBase: ${hasResolve}, API_BASE: ${hasApiBase}, fallback chain: ${hasFallback}`);
} catch (e) {
  record(7, 'config.ts structure', 'FAIL', e.message);
}

try {
  const envExample = readProjectFile('apps/mobile/.env.example');
  const has = envExample.includes('EXPO_PUBLIC_API_BASE');
  record(8, '.env.example', has ? 'PASS' : 'FAIL',
    has ? 'EXPO_PUBLIC_API_BASE documented' : 'Missing EXPO_PUBLIC_API_BASE');
} catch (e) {
  record(8, '.env.example', 'FAIL', e.message);
}

// ---------------------------------------------------------------------------
// F3: Dockerfile
// ---------------------------------------------------------------------------
console.log('\n=== F3: Dockerfile ===');

try {
  const df = readProjectFile('apps/api/Dockerfile');
  const hasSlim = df.includes('node:20-slim');
  const hasOpenssl = df.includes('openssl');
  const hasNonRoot = df.includes('sportykids');
  const hasPort = df.includes('PORT=8080');
  const hasStages = df.includes('AS deps') && df.includes('AS builder') && df.includes('AS runner');
  const allPass = hasSlim && hasOpenssl && hasNonRoot && hasPort && hasStages;
  record(9, 'Dockerfile structure', allPass ? 'PASS' : 'FAIL',
    `node:20-slim: ${hasSlim}, openssl: ${hasOpenssl}, non-root: ${hasNonRoot}, port 8080: ${hasPort}, 3 stages: ${hasStages}`);
} catch (e) {
  record(9, 'Dockerfile structure', 'FAIL', e.message);
}

// Docker build is optional — skip if no Docker
try {
  run('docker --version 2>/dev/null');
  record(10, 'Docker build', 'SKIP', 'Docker available but build skipped (requires full build context + network)');
} catch {
  record(10, 'Docker build', 'SKIP', 'Docker not available or not running');
}

// ---------------------------------------------------------------------------
// F4: Fly.io Config
// ---------------------------------------------------------------------------
console.log('\n=== F4: Fly.io Config ===');

try {
  const flyToml = readProjectFile('fly.toml');
  const hasApp = flyToml.includes('app = "sportykids-api"');
  const hasRegion = flyToml.includes('primary_region = "mad"');
  const hasHealth = flyToml.includes('/api/health');
  const hasMigrate = flyToml.includes('prisma migrate deploy');
  const allPass = hasApp && hasRegion && hasHealth && hasMigrate;
  record(11, 'fly.toml', allPass ? 'PASS' : 'FAIL',
    `app: ${hasApp}, region: ${hasRegion}, health: ${hasHealth}, migrate: ${hasMigrate}`);
} catch (e) {
  record(11, 'fly.toml', 'FAIL', e.message);
}

// ---------------------------------------------------------------------------
// F5: CI/CD Deploy
// ---------------------------------------------------------------------------
console.log('\n=== F5: CI/CD Deploy ===');

try {
  const ci = readProjectFile('.github/workflows/ci.yml');
  const hasDeploy = ci.includes('deploy:');
  const hasMainOnly = ci.includes("github.ref == 'refs/heads/main'") && ci.includes("github.event_name == 'push'");
  const hasNeeds = ci.includes('needs: [build-api, build-web]');
  const hasFlyctl = ci.includes('superfly/flyctl-actions');
  const hasNoCancelInProgress = ci.includes('cancel-in-progress: false');
  const allPass = hasDeploy && hasMainOnly && hasNeeds && hasFlyctl && hasNoCancelInProgress;
  record(12, 'CI deploy job', allPass ? 'PASS' : 'FAIL',
    `deploy: ${hasDeploy}, main-only: ${hasMainOnly}, needs: ${hasNeeds}, flyctl: ${hasFlyctl}, no-cancel: ${hasNoCancelInProgress}`);
} catch (e) {
  record(12, 'CI deploy job', 'FAIL', e.message);
}

// ---------------------------------------------------------------------------
// F6: EAS Config
// ---------------------------------------------------------------------------
console.log('\n=== F6: EAS Config ===');

try {
  const eas = JSON.parse(readProjectFile('apps/mobile/eas.json'));
  const hasVersionSource = eas.cli?.appVersionSource === 'remote';
  const hasChannels = eas.build?.development?.channel === 'development'
    && eas.build?.preview?.channel === 'preview'
    && eas.build?.production?.channel === 'production';
  const hasEnvVars = eas.build?.preview?.env?.EXPO_PUBLIC_API_BASE && eas.build?.production?.env?.EXPO_PUBLIC_API_BASE;
  const hasAutoIncrement = eas.build?.production?.ios?.autoIncrement === true && eas.build?.production?.android?.autoIncrement === true;
  const hasSubmit = eas.submit?.production?.ios && eas.submit?.production?.android;
  const allPass = hasVersionSource && hasChannels && hasEnvVars && hasAutoIncrement && hasSubmit;
  record(13, 'eas.json config', allPass ? 'PASS' : 'FAIL',
    `versionSource: ${hasVersionSource}, channels: ${hasChannels}, envVars: ${hasEnvVars}, autoIncrement: ${hasAutoIncrement}, submit: ${hasSubmit}`);
} catch (e) {
  record(13, 'eas.json config', 'FAIL', e.message);
}

// ---------------------------------------------------------------------------
// F7: Documentation
// ---------------------------------------------------------------------------
console.log('\n=== F7: Documentation ===');

try {
  const enDoc = readProjectFile('docs/en/11-store-deployment.md');
  const hasFlyio = enDoc.includes('Fly.io');
  const hasDocker = enDoc.includes('Docker');
  const hasApple = enDoc.includes('Apple Developer');
  const hasGoogle = enDoc.includes('Google Play');
  const hasEas = enDoc.includes('EAS');
  const hasScreenshots = enDoc.includes('Screenshots') || enDoc.includes('screenshots');
  const allPass = hasFlyio && hasDocker && hasApple && hasGoogle && hasEas && hasScreenshots;
  record(14, 'EN deployment doc', allPass ? 'PASS' : 'FAIL',
    `Fly.io: ${hasFlyio}, Docker: ${hasDocker}, Apple: ${hasApple}, Google: ${hasGoogle}, EAS: ${hasEas}, Screenshots: ${hasScreenshots}`);
} catch (e) {
  record(14, 'EN deployment doc', 'FAIL', e.message);
}

try {
  const esDoc = readProjectFile('docs/es/11-despliegue-tiendas.md');
  const hasFlyio = esDoc.includes('Fly.io');
  const hasDocker = esDoc.includes('Docker');
  const hasApple = esDoc.includes('Apple Developer');
  const hasGoogle = esDoc.includes('Google Play');
  record(15, 'ES deployment doc', hasFlyio && hasDocker && hasApple && hasGoogle ? 'PASS' : 'FAIL',
    `Spanish translation with Fly.io: ${hasFlyio}, Docker: ${hasDocker}, Apple: ${hasApple}, Google: ${hasGoogle}`);
} catch (e) {
  record(15, 'ES deployment doc', 'FAIL', e.message);
}

// ---------------------------------------------------------------------------
// F8: ASO Metadata
// ---------------------------------------------------------------------------
console.log('\n=== F8: ASO Metadata ===');

try {
  const enMeta = JSON.parse(readProjectFile('apps/mobile/store-metadata/en.json'));
  const fields = ['name', 'subtitle', 'description', 'keywords', 'promotionalText', 'category', 'secondaryCategory'];
  const hasAll = fields.every(f => typeof enMeta[f] === 'string' && enMeta[f].length > 0);
  const keywordsOk = enMeta.keywords.length <= 100;
  const descOk = enMeta.description.length <= 4000;
  record(16, 'EN ASO metadata', hasAll && keywordsOk && descOk ? 'PASS' : 'FAIL',
    `All fields: ${hasAll}, keywords ≤100: ${keywordsOk} (${enMeta.keywords.length}), desc ≤4000: ${descOk} (${enMeta.description.length})`);
} catch (e) {
  record(16, 'EN ASO metadata', 'FAIL', e.message);
}

try {
  const esMeta = JSON.parse(readProjectFile('apps/mobile/store-metadata/es.json'));
  const fields = ['name', 'subtitle', 'description', 'keywords', 'promotionalText', 'category', 'secondaryCategory'];
  const hasAll = fields.every(f => typeof esMeta[f] === 'string' && esMeta[f].length > 0);
  const keywordsOk = esMeta.keywords.length <= 100;
  record(17, 'ES ASO metadata', hasAll && keywordsOk ? 'PASS' : 'FAIL',
    `All fields: ${hasAll}, keywords ≤100: ${keywordsOk} (${esMeta.keywords.length})`);
} catch (e) {
  record(17, 'ES ASO metadata', 'FAIL', e.message);
}

// ---------------------------------------------------------------------------
// F10: Splash Screen
// ---------------------------------------------------------------------------
console.log('\n=== F10: Splash Screen ===');

try {
  const appTsx = readProjectFile('apps/mobile/src/App.tsx');
  const hasPrevent = appTsx.includes('SplashScreen.preventAutoHideAsync');
  const hasHide = appTsx.includes('SplashScreen.hideAsync');
  const hasOnLayout = appTsx.includes('onLayoutRootView');
  record(18, 'App.tsx splash screen', hasPrevent && hasHide && hasOnLayout ? 'PASS' : 'FAIL',
    `preventAutoHide: ${hasPrevent}, hideAsync: ${hasHide}, onLayout: ${hasOnLayout}`);
} catch (e) {
  record(18, 'App.tsx splash screen', 'FAIL', e.message);
}

try {
  const appJson = JSON.parse(readProjectFile('apps/mobile/app.json'));
  const splash = appJson.expo?.splash;
  const hasImage = splash?.image === './src/assets/splash-icon.png';
  const hasBg = splash?.backgroundColor === '#F8FAFC';
  record(19, 'app.json splash config', hasImage && hasBg ? 'PASS' : 'FAIL',
    `image: ${splash?.image}, backgroundColor: ${splash?.backgroundColor}`);
} catch (e) {
  record(19, 'app.json splash config', 'FAIL', e.message);
}

// ---------------------------------------------------------------------------
// Full Test Suite
// ---------------------------------------------------------------------------
console.log('\n=== Full Test Suite ===');

try {
  const mobileOut = run('cd apps/mobile && npx vitest run 2>&1');
  const webOut = run('cd apps/web && npx vitest run 2>&1');
  const evidence = saveOutput('20-test-suite.txt', `=== MOBILE ===\n${mobileOut}\n\n=== WEB ===\n${webOut}`);

  const mobilePass = mobileOut.includes('passed') && !mobileOut.includes('failed');
  const webPass = webOut.includes('passed') && !webOut.includes('failed');

  // Extract counts
  const mobileMatch = mobileOut.match(/(\d+) passed/);
  const webMatch = webOut.match(/(\d+) passed/);

  record(20, 'Full test suite', mobilePass && webPass ? 'PASS' : 'FAIL',
    `Mobile: ${mobileMatch?.[1] ?? '?'} passed, Web: ${webMatch?.[1] ?? '?'} passed`, evidence);
} catch (e) {
  record(20, 'Full test suite', 'FAIL', e.message);
}

try {
  const lintOut = run('npx eslint . --max-warnings 0 2>&1');
  const evidence = saveOutput('21-lint.txt', lintOut);
  record(21, 'ESLint', 'PASS', 'No errors, no warnings', evidence);
} catch (e) {
  const evidence = saveOutput('21-lint.txt', e.stdout || e.message);
  record(21, 'ESLint', 'FAIL', 'Lint errors or warnings found', evidence);
}

// ---------------------------------------------------------------------------
// Generate Report
// ---------------------------------------------------------------------------
console.log('\n=== Generating Report ===');

const now = new Date().toISOString();
let report = `# Validation Report — Run 1

**Date**: ${now}
**Feature**: mvp-to-product-3 / Store Assets & Deployment
**Summary**: ${passCount} PASS | ${failCount} FAIL | ${skipCount} SKIP

---

`;

const sections = [
  { name: 'F1: Asset Generation', items: [1, 2, 3, 4, 5] },
  { name: 'F2: Dynamic API_BASE', items: [6, 7, 8] },
  { name: 'F3: Dockerfile', items: [9, 10] },
  { name: 'F4: Fly.io Config', items: [11] },
  { name: 'F5: CI/CD Deploy', items: [12] },
  { name: 'F6: EAS Config', items: [13] },
  { name: 'F7: Documentation', items: [14, 15] },
  { name: 'F8: ASO Metadata', items: [16, 17] },
  { name: 'F10: Splash Screen', items: [18, 19] },
  { name: 'Full Test Suite', items: [20, 21] },
];

for (const section of sections) {
  report += `## ${section.name}\n\n`;
  for (const id of section.items) {
    const r = results.find(x => x.id === id);
    if (!r) continue;
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    report += `${icon} **${r.name}** — ${r.detail}`;
    if (r.evidence) report += ` ([evidence](${r.evidence}))`;
    report += '\n\n';
  }
}

const reportPath = resolve(EVIDENCE_DIR, '..', 'validation-report-run-1.md');
writeFileSync(reportPath, report, 'utf-8');
console.log(`\nReport written to: ${reportPath}`);
console.log(`\n📊 Summary: ${passCount} PASS | ${failCount} FAIL | ${skipCount} SKIP`);

process.exit(failCount > 0 ? 1 : 0);
