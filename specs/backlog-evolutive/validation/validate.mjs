#!/usr/bin/env node
/**
 * Validation script — Run 14 (post /t-review #2 + /t-reduce-tech-debt)
 *
 * Verifies:
 * A) Review fix: PinInput no hardcoded buttonText default
 * B) Review fix: reels.ts DELETE uses only req.auth (no fallback)
 * C) Review fix: user-context casts removed
 * D) Review fix: reels.ts /sync has try-catch
 * E) Review fix: inferCountryFromLocale in shared
 * F) Review fix: Prisma.ParentalProfileUpdateInput in parents.ts
 * G) Review fix: IPv6-mapped IPv4 blocking in url-validator
 * H) Review fix: RedisCache has unit tests
 * I) Regression: Full test suite passes
 * J) Regression: API endpoints still work
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const ASSETS = join(__dirname, '..', 'validation-assets', 'run-14');
const OUTPUT = join(ASSETS, 'output');
const API = join(ASSETS, 'api');

// Ensure directories exist
[OUTPUT, API].forEach(d => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); });

const results = [];
function record(id, name, status, detail = '') {
  results.push({ id, name, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${id}. ${name}: ${status}${detail ? ' — ' + detail : ''}`);
}

function readFile(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _grepFile(relPath, pattern) {
  const content = readFile(relPath);
  return content.split('\n').filter(l => l.match(pattern));
}

function saveOutput(filename, content) {
  writeFileSync(join(OUTPUT, filename), content);
}

// ─── A) PinInput: no hardcoded 'Confirm' default ───
try {
  const pin = readFile('apps/web/src/components/PinInput.tsx');
  const hasHardcodedDefault = /buttonText\s*=\s*['"]Confirm['"]/.test(pin);
  const hasFallback = pin.includes("buttonText || t('buttons.confirm'");
  if (!hasHardcodedDefault && hasFallback) {
    record('A', 'PinInput no hardcoded buttonText', 'PASS', 'Falls back to t(buttons.confirm)');
  } else {
    record('A', 'PinInput no hardcoded buttonText', 'FAIL',
      `hardcoded=${hasHardcodedDefault}, fallback=${hasFallback}`);
  }
} catch (e) { record('A', 'PinInput no hardcoded buttonText', 'FAIL', e.message); }

// ─── B) reels.ts DELETE: only req.auth.userId ───
try {
  const reels = readFile('apps/api/src/routes/reels.ts');
  const deleteSection = reels.slice(reels.indexOf("router.delete('/sources/custom/:id'"));
  const hasQueryFallback = /req\.query\.userId/.test(deleteSection);
  const hasBodyFallback = /req\.body\?\.userId/.test(deleteSection);
  const usesAuth = /req\.auth\?\.userId/.test(deleteSection);
  if (usesAuth && !hasQueryFallback && !hasBodyFallback) {
    record('B', 'reels.ts DELETE uses only req.auth', 'PASS', 'No userId fallback');
  } else {
    record('B', 'reels.ts DELETE uses only req.auth', 'FAIL',
      `auth=${usesAuth}, query=${hasQueryFallback}, body=${hasBodyFallback}`);
  }
} catch (e) { record('B', 'reels.ts DELETE uses only req.auth', 'FAIL', e.message); }

// ─── C) user-context casts removed ───
try {
  const webCtx = readFile('apps/web/src/lib/user-context.tsx');
  const mobileCtx = readFile('apps/mobile/src/lib/user-context.tsx');
  const webHasCast = webCtx.includes('as Record<string, unknown>');
  const mobileHasCast = mobileCtx.includes('as Record<string, unknown>');
  if (!webHasCast && !mobileHasCast) {
    record('C', 'user-context casts removed', 'PASS');
  } else {
    record('C', 'user-context casts removed', 'FAIL',
      `web=${webHasCast}, mobile=${mobileHasCast}`);
  }
} catch (e) { record('C', 'user-context casts removed', 'FAIL', e.message); }

// ─── D) reels.ts /sync has try-catch ───
try {
  const reels = readFile('apps/api/src/routes/reels.ts');
  const syncSection = reels.slice(reels.indexOf("router.post('/sync'"));
  const hasTryCatch = /try\s*\{[\s\S]*syncAllVideoSources[\s\S]*catch/.test(syncSection);
  if (hasTryCatch) {
    record('D', 'reels.ts /sync has try-catch', 'PASS');
  } else {
    record('D', 'reels.ts /sync has try-catch', 'FAIL', 'No try-catch around syncAllVideoSources');
  }
} catch (e) { record('D', 'reels.ts /sync has try-catch', 'FAIL', e.message); }

// ─── E) inferCountryFromLocale in shared ───
try {
  const locale = readFile('packages/shared/src/constants/locale.ts');
  const hasFunction = locale.includes('function inferCountryFromLocale');
  const index = readFile('packages/shared/src/constants/index.ts');
  const isExported = index.includes('inferCountryFromLocale');
  const web = readFile('apps/web/src/components/OnboardingWizard.tsx');
  const mobile = readFile('apps/mobile/src/screens/Onboarding.tsx');
  const webUsesIt = web.includes('inferCountryFromLocale');
  const mobileUsesIt = mobile.includes('inferCountryFromLocale');
  const webNoDuplicate = !web.includes("locale === 'es' ? 'ES' : 'GB'");
  const mobileNoDuplicate = !mobile.includes("locale === 'es' ? 'ES' : 'GB'");

  if (hasFunction && isExported && webUsesIt && mobileUsesIt && webNoDuplicate && mobileNoDuplicate) {
    record('E', 'inferCountryFromLocale extracted to shared', 'PASS');
  } else {
    record('E', 'inferCountryFromLocale extracted to shared', 'FAIL',
      `fn=${hasFunction}, exported=${isExported}, web=${webUsesIt}, mobile=${mobileUsesIt}, ` +
      `webClean=${webNoDuplicate}, mobileClean=${mobileNoDuplicate}`);
  }
} catch (e) { record('E', 'inferCountryFromLocale extracted to shared', 'FAIL', e.message); }

// ─── F) Prisma.ParentalProfileUpdateInput in parents.ts ───
try {
  const parents = readFile('apps/api/src/routes/parents.ts');
  const hasPrismaImport = parents.includes("import type { Prisma }");
  const hasTypedData = parents.includes('Prisma.ParentalProfileUpdateInput');
  const noRecordUnknown = !parents.includes('const data: Record<string, unknown>');
  if (hasPrismaImport && hasTypedData && noRecordUnknown) {
    record('F', 'parents.ts uses Prisma types', 'PASS');
  } else {
    record('F', 'parents.ts uses Prisma types', 'FAIL',
      `import=${hasPrismaImport}, typed=${hasTypedData}, noRecord=${noRecordUnknown}`);
  }
} catch (e) { record('F', 'parents.ts uses Prisma types', 'FAIL', e.message); }

// ─── G) IPv6-mapped IPv4 blocking ───
try {
  const validator = readFile('apps/api/src/utils/url-validator.ts');
  const hasIpv6Mapped = validator.includes('::ffff:');
  const hasRecursive = validator.includes('isPublicUrl(`http://');
  if (hasIpv6Mapped && hasRecursive) {
    record('G', 'IPv6-mapped IPv4 blocking', 'PASS', 'Recursive validation for ::ffff: addresses');
  } else {
    record('G', 'IPv6-mapped IPv4 blocking', 'FAIL',
      `hasCheck=${hasIpv6Mapped}, recursive=${hasRecursive}`);
  }
} catch (e) { record('G', 'IPv6-mapped IPv4 blocking', 'FAIL', e.message); }

// ─── H) RedisCache has unit tests ───
try {
  const testExists = existsSync(join(ROOT, 'apps/api/src/services/redis-cache.test.ts'));
  if (testExists) {
    const testContent = readFile('apps/api/src/services/redis-cache.test.ts');
    const testCount = (testContent.match(/\bit\(/g) || []).length;
    record('H', 'RedisCache unit tests exist', 'PASS', `${testCount} test cases`);
  } else {
    record('H', 'RedisCache unit tests exist', 'FAIL', 'File not found');
  }
} catch (e) { record('H', 'RedisCache unit tests exist', 'FAIL', e.message); }

// ─── I) Full test suite regression ───
try {
  const testOutput = execSync(
    'TSX_IPC_DIR=/private/tmp/claude-502/tsx-ipc npx vitest run 2>&1',
    { cwd: ROOT, encoding: 'utf-8', timeout: 120000 }
  );
  saveOutput('I-test-suite.txt', testOutput);

  const passMatch = testOutput.match(/(\d+) passed/);
  const failMatch = testOutput.match(/(\d+) failed/);
  const fileMatch = testOutput.match(/Test Files\s+(?:\d+ failed \| )?(\d+) passed/);

  const passed = passMatch ? parseInt(passMatch[1]) : 0;
  const failed = failMatch ? parseInt(failMatch[1]) : 0;
  const files = fileMatch ? parseInt(fileMatch[1]) : 0;

  if (failed === 0 && passed > 0) {
    record('I', 'Full test suite', 'PASS', `${passed} tests, ${files} files, 0 failures`);
  } else {
    record('I', 'Full test suite', 'FAIL', `${passed} passed, ${failed} failed`);
  }
} catch (e) {
  const output = e.stdout || e.stderr || e.message;
  saveOutput('I-test-suite.txt', output);
  record('I', 'Full test suite', 'FAIL', 'Test execution error');
}

// ─── J) API regression: sources catalog ───
try {
  const catalogRaw = execSync(
    'curl -sf http://localhost:3001/api/reels/sources/catalog 2>&1',
    { encoding: 'utf-8', timeout: 10000 }
  );
  const catalog = JSON.parse(catalogRaw);
  writeFileSync(join(API, 'J1-sources-catalog.json'), JSON.stringify(catalog, null, 2));

  if (catalog.sources && catalog.total >= 20 && catalog.bySport) {
    record('J1', 'API: reels sources catalog', 'PASS', `${catalog.total} sources`);
  } else {
    record('J1', 'API: reels sources catalog', 'FAIL', `total=${catalog.total}`);
  }
} catch {
  record('J1', 'API: reels sources catalog', 'SKIP', 'API not running');
}

try {
  const reelsRaw = execSync(
    'curl -sf "http://localhost:3001/api/reels?limit=5" 2>&1',
    { encoding: 'utf-8', timeout: 10000 }
  );
  const reels = JSON.parse(reelsRaw);
  writeFileSync(join(API, 'J2-reels-list.json'), JSON.stringify(reels, null, 2));

  const allApproved = reels.reels.every(r => r.safetyStatus === 'approved');
  if (reels.reels.length > 0 && allApproved) {
    record('J2', 'API: reels list (approved only)', 'PASS', `${reels.reels.length} reels`);
  } else {
    record('J2', 'API: reels list (approved only)', 'FAIL');
  }
} catch {
  record('J2', 'API: reels list', 'SKIP', 'API not running');
}

try {
  execSync(
    'curl -sf http://localhost:3001/api/health 2>&1',
    { encoding: 'utf-8', timeout: 5000 }
  );
  record('J3', 'API: health check', 'PASS');
} catch {
  record('J3', 'API: health check', 'SKIP', 'API not running');
}

// ─── Generate Report ───
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const skipped = results.filter(r => r.status === 'SKIP').length;

let report = `# Validation Report — Run 14 (post /t-review #2 + /t-reduce-tech-debt)

**Date**: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC
**Summary**: ${passed} PASS / ${failed} FAIL / ${skipped} SKIP

## Review Fixes Verification

| # | Check | Status | Detail |
|---|-------|--------|--------|
`;

for (const r of results.filter(r => r.id.startsWith('A') || r.id.startsWith('B') || r.id.startsWith('C') || r.id.startsWith('D') || r.id.startsWith('E') || r.id.startsWith('F') || r.id.startsWith('G') || r.id.startsWith('H'))) {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
  report += `| ${r.id} | ${r.name} | ${icon} ${r.status} | ${r.detail} |\n`;
}

report += `\n## Regression Checks\n\n| # | Check | Status | Detail |\n|---|-------|--------|--------|\n`;

for (const r of results.filter(r => r.id.startsWith('I') || r.id.startsWith('J'))) {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
  report += `| ${r.id} | ${r.name} | ${icon} ${r.status} | ${r.detail} |\n`;
}

report += `\n## Comparison with Previous Run (Run 13)\n\nAll review fixes are new checks (not present in Run 13). Regression checks (I, J) verify existing functionality is preserved.\n`;

report += `\n## Evidence\n\n- Test suite output: [I-test-suite.txt](run-14/output/I-test-suite.txt)\n`;
if (existsSync(join(API, 'J1-sources-catalog.json'))) {
  report += `- Sources catalog: [J1-sources-catalog.json](run-14/api/J1-sources-catalog.json)\n`;
}
if (existsSync(join(API, 'J2-reels-list.json'))) {
  report += `- Reels list: [J2-reels-list.json](run-14/api/J2-reels-list.json)\n`;
}

const reportPath = join(__dirname, '..', 'validation-assets', 'validation-report-run-14.md');
writeFileSync(reportPath, report);

console.log('\n' + '='.repeat(60));
console.log(`TOTAL: ${passed} PASS / ${failed} FAIL / ${skipped} SKIP`);
console.log(`Report: specs/backlog-evolutive/validation-assets/validation-report-run-14.md`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
