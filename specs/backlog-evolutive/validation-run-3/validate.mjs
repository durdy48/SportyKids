#!/usr/bin/env node
/**
 * Validation script for prd.md — Video Aggregator + Multi-platform Reels
 * Run 3 (prd.md + prd2.md)
 */

import { writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, '..', 'validation-assets', 'run-3');
const API = 'http://localhost:3001/api';

const results = [];
let customSourceId = null;
let testUserId = null;
let authToken = null;

function record(section, name, status, detail = '') {
  results.push({ section, name, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} [${section}] ${name}: ${status}${detail ? ' — ' + detail : ''}`);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function saveEvidence(subdir, name, data) {
  const dir = join(ASSETS, subdir);
  writeFileSync(join(dir, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

// ─── 0. Setup: create test user + auth token ─────────────────────────

async function setup() {
  // Register a test user for auth-required endpoints
  const regRes = await fetchJson(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `validate-${Date.now()}@test.com`, password: 'Test1234', name: 'Validator', age: 12 }),
  });
  if (regRes.status === 201 && regRes.body?.user?.id) {
    testUserId = regRes.body.user.id;
    authToken = regRes.body.accessToken;
  } else {
    // Fallback: try to login or create user via /api/users
    const userRes = await fetchJson(`${API}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Validator', age: 12, favoriteSports: ['football'] }),
    });
    if (userRes.body?.id) testUserId = userRes.body.id;
  }
  console.log(`   Setup: testUserId=${testUserId}, hasAuth=${!!authToken}\n`);
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return headers;
}

// ─── 1. Schema & Seed ────────────────────────────────────────────────

async function test1_catalog() {
  const { status, body } = await fetchJson(`${API}/reels/sources/catalog`);
  saveEvidence('api', '01-sources-catalog.json', body);
  if (status !== 200 || !body) return record('Schema & Seed', 'Video sources catalog', 'FAIL', `HTTP ${status}`);
  const hasSources = Array.isArray(body.sources) && body.sources.length >= 20;
  const hasBySport = body.bySport && Object.keys(body.bySport).length >= 6;
  if (hasSources && hasBySport) {
    record('Schema & Seed', 'Video sources catalog', 'PASS', `${body.total} sources, ${Object.keys(body.bySport).length} sports`);
  } else {
    record('Schema & Seed', 'Video sources catalog', 'FAIL', `sources=${body.sources?.length}, sports=${Object.keys(body.bySport || {}).length}`);
  }
}

async function test2_seedReels() {
  const { status, body } = await fetchJson(`${API}/reels?limit=50`);
  saveEvidence('api', '02-reels-list.json', body);
  if (status !== 200 || !body) return record('Schema & Seed', 'Seed reels still work', 'FAIL', `HTTP ${status}`);
  const count = body.reels?.length || 0;
  if (count >= 5) {
    record('Schema & Seed', 'Seed reels still work', 'PASS', `${count} reels returned, total=${body.total}`);
  } else {
    record('Schema & Seed', 'Seed reels still work', 'FAIL', `Only ${count} reels`);
  }
}

// ─── 2. Video Aggregator Service ─────────────────────────────────────

async function test3_manualSync() {
  const { status, body } = await fetchJson(`${API}/reels/sync`, { method: 'POST', headers: authHeaders() });
  saveEvidence('api', '03-manual-sync.json', body);
  if (status !== 200 || !body) return record('Video Aggregator', 'Manual sync', 'FAIL', `HTTP ${status}`);
  const hasMetrics = typeof body.totalProcessed === 'number' && Array.isArray(body.sources);
  if (hasMetrics) {
    record('Video Aggregator', 'Manual sync', 'PASS', `processed=${body.totalProcessed}, created=${body.totalCreated}, approved=${body.totalApproved}`);
  } else {
    record('Video Aggregator', 'Manual sync', 'FAIL', 'Missing metrics fields');
  }
}

async function test4_newReelsAfterSync() {
  const { status, body } = await fetchJson(`${API}/reels?limit=20`);
  saveEvidence('api', '04-reels-after-sync.json', body);
  if (status !== 200 || !body) return record('Video Aggregator', 'New reels after sync', 'FAIL', `HTTP ${status}`);
  const reels = body.reels || [];
  const hasYoutubeEmbed = reels.some(r => r.videoType === 'youtube_embed');
  const allApproved = reels.every(r => r.safetyStatus === 'approved');
  if (hasYoutubeEmbed && allApproved) {
    record('Video Aggregator', 'New reels after sync', 'PASS', `${reels.length} reels, youtube_embed found, all approved`);
  } else {
    record('Video Aggregator', 'New reels after sync', 'FAIL', `youtube_embed=${hasYoutubeEmbed}, allApproved=${allApproved}`);
  }
}

async function test5_safetyFilter() {
  const { status, body } = await fetchJson(`${API}/reels?limit=50`);
  saveEvidence('api', '05-safety-filter.json', { total: body?.total, statuses: [...new Set((body?.reels || []).map(r => r.safetyStatus))] });
  if (status !== 200 || !body) return record('Video Aggregator', 'Safety filter', 'FAIL', `HTTP ${status}`);
  const statuses = [...new Set(body.reels.map(r => r.safetyStatus))];
  if (statuses.length === 1 && statuses[0] === 'approved') {
    record('Video Aggregator', 'Safety filter', 'PASS', 'Only approved reels returned');
  } else {
    record('Video Aggregator', 'Safety filter', 'FAIL', `Statuses found: ${statuses.join(', ')}`);
  }
}

// ─── 3. API Endpoints ────────────────────────────────────────────────

async function test6_sourcesList() {
  const { status, body } = await fetchJson(`${API}/reels/sources/list`);
  saveEvidence('api', '06-sources-list.json', body);
  if (status !== 200 || !body) return record('API Endpoints', 'Sources list', 'FAIL', `HTTP ${status}`);
  const count = body.sources?.length || 0;
  if (count >= 20) {
    record('API Endpoints', 'Sources list', 'PASS', `${count} active sources`);
  } else {
    record('API Endpoints', 'Sources list', 'FAIL', `Only ${count} sources`);
  }
}

async function test7_addCustomSource() {
  if (!testUserId) return record('API Endpoints', 'Add custom source', 'SKIP', 'No test user available');
  // Use instagram_account platform (no RSS validation) with unique URL
  const uniqueUrl = `https://www.instagram.com/sportykids_test_${Date.now()}`;
  const payload = {
    name: 'Validation Test Source',
    feedUrl: uniqueUrl,
    platform: 'instagram_account',
    sport: 'athletics',
    userId: testUserId,
  };
  const { status, body } = await fetchJson(`${API}/reels/sources/custom`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  saveEvidence('api', '07-add-custom-source.json', { request: payload, status, response: body });
  if (status === 201 && body?.id) {
    customSourceId = body.id;
    record('API Endpoints', 'Add custom source', 'PASS', `Created id=${body.id}`);
  } else if (status === 409) {
    // Already exists from a previous run — get the ID
    customSourceId = body?.existingId || null;
    record('API Endpoints', 'Add custom source', 'PASS', `Already exists (409), id=${customSourceId}`);
  } else {
    record('API Endpoints', 'Add custom source', 'FAIL', `HTTP ${status}: ${JSON.stringify(body)}`);
  }
}

async function test8_deleteCustomSource() {
  if (!customSourceId) {
    return record('API Endpoints', 'Delete custom source', 'SKIP', 'No source ID from previous step');
  }
  const { status, body } = await fetchJson(`${API}/reels/sources/custom/${customSourceId}?userId=${testUserId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  saveEvidence('api', '08-delete-custom-source.json', { status, response: body });
  if (status === 200) {
    record('API Endpoints', 'Delete custom source', 'PASS', `Deleted id=${customSourceId}`);
  } else {
    record('API Endpoints', 'Delete custom source', 'FAIL', `HTTP ${status}: ${JSON.stringify(body)}`);
  }
}

// ─── 4. Ordering ─────────────────────────────────────────────────────

async function test9_ordering() {
  const { status, body } = await fetchJson(`${API}/reels?limit=10`);
  saveEvidence('api', '09-ordering.json', (body?.reels || []).map(r => ({ title: r.title, publishedAt: r.publishedAt, createdAt: r.createdAt })));
  if (status !== 200 || !body) return record('Ordering', 'publishedAt desc order', 'FAIL', `HTTP ${status}`);
  const reels = body.reels || [];
  // Check that reels with publishedAt are ordered desc
  const dated = reels.filter(r => r.publishedAt);
  let ordered = true;
  for (let i = 1; i < dated.length; i++) {
    if (new Date(dated[i].publishedAt) > new Date(dated[i - 1].publishedAt)) {
      ordered = false;
      break;
    }
  }
  if (ordered) {
    record('Ordering', 'publishedAt desc order', 'PASS', `${dated.length} dated reels in correct order`);
  } else {
    record('Ordering', 'publishedAt desc order', 'FAIL', 'Reels not in publishedAt desc order');
  }
}

// ─── 5. i18n ─────────────────────────────────────────────────────────

function test10_i18n() {
  try {
    const esPath = join(__dirname, '..', '..', '..', 'packages', 'shared', 'src', 'i18n', 'es.json');
    const enPath = join(__dirname, '..', '..', '..', 'packages', 'shared', 'src', 'i18n', 'en.json');
    const esContent = execSync(`grep "sources_title" "${esPath}" 2>&1 || true`).toString();
    const enContent = execSync(`grep "sources_title" "${enPath}" 2>&1 || true`).toString();
    if (esContent.includes('sources_title') && enContent.includes('sources_title')) {
      record('i18n', 'Translation keys present', 'PASS', 'sources_title found in both es.json and en.json');
    } else {
      record('i18n', 'Translation keys present', 'FAIL', `es=${!!esContent.includes('sources_title')}, en=${!!enContent.includes('sources_title')}`);
    }
  } catch (e) {
    record('i18n', 'Translation keys present', 'FAIL', e.message);
  }
}

// ─── 6. Tests ────────────────────────────────────────────────────────

function test11_testSuite() {
  try {
    const output = execSync('npm test --prefix apps/api 2>&1', {
      cwd: join(__dirname, '..', '..', '..'),
      timeout: 60000,
    }).toString();
    saveEvidence('output', '11-test-suite.txt', output);
    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;
    if (failed === 0 && passed > 0) {
      record('Tests', 'Full test suite', 'PASS', `${passed} tests passing across ${output.match(/(\d+) passed\b/g)?.length || '?'} files, 0 failures`);
    } else {
      record('Tests', 'Full test suite', 'FAIL', `${passed} passed, ${failed} failed`);
    }
  } catch (e) {
    saveEvidence('output', '11-test-suite.txt', e.stdout?.toString() || e.message);
    record('Tests', 'Full test suite', 'FAIL', 'Test command failed');
  }
}

// ─── 7. No Spanish in API routes ─────────────────────────────────────

function test12_noSpanishRoutes() {
  try {
    const output = execSync(
      `grep -rn "fuentes\\|sincronizar\\|resumen\\|historial\\|relacionados\\|configurar\\|verificar-pin\\|/perfil/\\|/actividad/" apps/api/src/routes/ apps/web/src/lib/api.ts apps/mobile/src/lib/api.ts 2>&1 || true`,
      { cwd: join(__dirname, '..', '..', '..') }
    ).toString().trim();
    saveEvidence('output', '12-spanish-routes.txt', output || '(none found)');
    if (!output) {
      record('Code Quality', 'No Spanish in API routes', 'PASS', 'Zero Spanish route paths found');
    } else {
      const lines = output.split('\n').length;
      record('Code Quality', 'No Spanish in API routes', 'FAIL', `${lines} occurrences found`);
    }
  } catch (e) {
    record('Code Quality', 'No Spanish in API routes', 'FAIL', e.message);
  }
}

// ─── 8. No hardcoded Spanish in UI ───────────────────────────────────

function test13_noHardcodedSpanish() {
  try {
    // Check for inline locale ternaries that should use t() (excluding date formatting and AI prompts)
    const output = execSync(
      `grep -rn "locale === 'es' ?" apps/web/src/components/ apps/web/src/app/ apps/mobile/src/screens/ apps/mobile/src/components/ 2>&1 | grep -v toLocaleDateString | grep -v node_modules | grep -v inferredCountry | grep -v "flag\\|Flag\\|\\\\u{1F1" || true`,
      { cwd: join(__dirname, '..', '..', '..') }
    ).toString().trim();
    saveEvidence('output', '13-hardcoded-spanish.txt', output || '(none found)');
    if (!output) {
      record('Code Quality', 'No hardcoded Spanish in UI', 'PASS', 'Zero inline locale ternaries in UI components');
    } else {
      const lines = output.split('\n').filter(l => l.trim()).length;
      record('Code Quality', 'No hardcoded Spanish in UI', 'FAIL', `${lines} inline locale ternaries found`);
    }
  } catch (e) {
    record('Code Quality', 'No hardcoded Spanish in UI', 'FAIL', e.message);
  }
}

// ─── Appendix A: Security & Auth fixes ───────────────────────────────

async function testA1_customSourceNoAuth() {
  const { status } = await fetchJson(`${API}/reels/sources/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', feedUrl: 'https://example.com', platform: 'youtube_channel', sport: 'football', userId: 'x' }),
  });
  saveEvidence('api', 'A1-custom-source-no-auth.json', { status });
  if (status === 401) {
    record('Appendix A: Security', 'POST /sources/custom requires auth', 'PASS', 'Returns 401 without token');
  } else {
    record('Appendix A: Security', 'POST /sources/custom requires auth', 'FAIL', `Expected 401, got ${status}`);
  }
}

async function testA2_ssrfPrevention() {
  if (!authToken) return record('Appendix A: Security', 'SSRF prevention', 'SKIP', 'No auth token');
  const { status, body } = await fetchJson(`${API}/reels/sources/custom`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name: 'Evil', feedUrl: 'http://127.0.0.1/rss', platform: 'youtube_channel', sport: 'football', userId: testUserId }),
  });
  saveEvidence('api', 'A2-ssrf-prevention.json', { status, body });
  if (status === 400) {
    record('Appendix A: Security', 'SSRF prevention', 'PASS', 'Private IP rejected with 400');
  } else {
    record('Appendix A: Security', 'SSRF prevention', 'FAIL', `Expected 400, got ${status}`);
  }
}

async function testA3_invalidPlatform() {
  if (!authToken) return record('Appendix A: Security', 'Invalid platform rejected', 'SKIP', 'No auth token');
  const { status } = await fetchJson(`${API}/reels/sources/custom`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name: 'Test', feedUrl: 'https://example.com', platform: 'invalid_platform', sport: 'football', userId: testUserId }),
  });
  saveEvidence('api', 'A3-invalid-platform.json', { status });
  if (status === 400) {
    record('Appendix A: Security', 'Invalid platform rejected', 'PASS', 'Returns 400 for unknown platform');
  } else {
    record('Appendix A: Security', 'Invalid platform rejected', 'FAIL', `Expected 400, got ${status}`);
  }
}

function testA4_langAttribute() {
  try {
    const output = execSync(`grep 'lang=' apps/web/src/app/layout.tsx`, { cwd: join(__dirname, '..', '..', '..') }).toString().trim();
    saveEvidence('output', 'A4-lang-attribute.txt', output);
    if (output.includes('lang="en"')) {
      record('Appendix A: Code Quality', 'lang="en" in layout.tsx', 'PASS', 'HTML lang set to en');
    } else {
      record('Appendix A: Code Quality', 'lang="en" in layout.tsx', 'FAIL', `Found: ${output}`);
    }
  } catch (e) {
    record('Appendix A: Code Quality', 'lang="en" in layout.tsx', 'FAIL', e.message);
  }
}

// ─── PRD2: User Locale & Country ─────────────────────────────────────

async function testP2_1_createUserWithLocale() {
  const { status, body } = await fetchJson(`${API}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'LocaleTest', age: 10, favoriteSports: ['football'], locale: 'en', country: 'GB' }),
  });
  saveEvidence('api', 'P2-01-create-user-locale.json', { status, body: { id: body?.id, locale: body?.locale, country: body?.country } });
  if (status === 201 && body?.locale === 'en' && body?.country === 'GB') {
    testUserId = body.id; // reuse for next tests
    record('PRD2: Schema & API', 'Create user with locale/country', 'PASS', `locale=en, country=GB, id=${body.id}`);
  } else {
    record('PRD2: Schema & API', 'Create user with locale/country', 'FAIL', `HTTP ${status}, locale=${body?.locale}, country=${body?.country}`);
  }
}

async function testP2_2_updateLocale() {
  if (!testUserId) return record('PRD2: Schema & API', 'Update locale', 'SKIP', 'No user');
  const { status, body } = await fetchJson(`${API}/users/${testUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale: 'es', country: 'ES' }),
  });
  saveEvidence('api', 'P2-02-update-locale.json', { status, locale: body?.locale, country: body?.country });
  if (status === 200 && body?.locale === 'es' && body?.country === 'ES') {
    record('PRD2: Schema & API', 'Update locale/country', 'PASS', 'locale=es, country=ES');
  } else {
    record('PRD2: Schema & API', 'Update locale/country', 'FAIL', `HTTP ${status}`);
  }
}

async function testP2_3_rejectInvalidLocale() {
  if (!testUserId) return record('PRD2: Schema & API', 'Reject invalid locale', 'SKIP', 'No user');
  const { status } = await fetchJson(`${API}/users/${testUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale: 'xx' }),
  });
  saveEvidence('api', 'P2-03-reject-invalid-locale.json', { status });
  if (status === 400) {
    record('PRD2: Schema & API', 'Reject invalid locale', 'PASS', 'Returns 400 for locale=xx');
  } else {
    record('PRD2: Schema & API', 'Reject invalid locale', 'FAIL', `Expected 400, got ${status}`);
  }
}

async function testP2_4_rejectInvalidCountry() {
  if (!testUserId) return record('PRD2: Schema & API', 'Reject invalid country', 'SKIP', 'No user');
  const { status } = await fetchJson(`${API}/users/${testUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country: 'XX' }),
  });
  saveEvidence('api', 'P2-04-reject-invalid-country.json', { status });
  if (status === 400) {
    record('PRD2: Schema & API', 'Reject invalid country', 'PASS', 'Returns 400 for country=XX');
  } else {
    record('PRD2: Schema & API', 'Reject invalid country', 'FAIL', `Expected 400, got ${status}`);
  }
}

async function testP2_5_defaultLocaleCountry() {
  const { status, body } = await fetchJson(`${API}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'DefaultTest', age: 8, favoriteSports: ['tennis'] }),
  });
  saveEvidence('api', 'P2-05-default-locale.json', { status, locale: body?.locale, country: body?.country });
  if (status === 201 && body?.locale === 'es' && body?.country === 'ES') {
    record('PRD2: Schema & API', 'Default locale=es, country=ES', 'PASS', 'Defaults applied correctly');
  } else {
    record('PRD2: Schema & API', 'Default locale=es, country=ES', 'FAIL', `locale=${body?.locale}, country=${body?.country}`);
  }
}

function testP2_6_i18nCountryKeys() {
  try {
    const esPath = join(__dirname, '..', '..', '..', 'packages', 'shared', 'src', 'i18n', 'es.json');
    const enPath = join(__dirname, '..', '..', '..', 'packages', 'shared', 'src', 'i18n', 'en.json');
    const esHas = execSync(`grep "countries" "${esPath}" 2>&1 | head -1`).toString().includes('countries');
    const enHas = execSync(`grep "countries" "${enPath}" 2>&1 | head -1`).toString().includes('countries');
    if (esHas && enHas) {
      record('PRD2: i18n', 'Country + settings keys', 'PASS', 'countries.* keys found in both locale files');
    } else {
      record('PRD2: i18n', 'Country + settings keys', 'FAIL', `es=${esHas}, en=${enHas}`);
    }
  } catch (e) {
    record('PRD2: i18n', 'Country + settings keys', 'FAIL', e.message);
  }
}

function testP2_7_sharedTypes() {
  try {
    const output = execSync(`grep "country" packages/shared/src/types/index.ts 2>&1 | head -3`, { cwd: join(__dirname, '..', '..', '..') }).toString();
    if (output.includes('country')) {
      record('PRD2: Types', 'User type has country field', 'PASS', 'country field in shared types');
    } else {
      record('PRD2: Types', 'User type has country field', 'FAIL', 'Not found');
    }
  } catch (e) {
    record('PRD2: Types', 'User type has country field', 'FAIL', e.message);
  }
}

// ─── Generate Report ─────────────────────────────────────────────────

function generateReport() {
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  const now = new Date().toISOString();

  let md = `# Validation Report — Run 3 (prd.md + prd2.md)\n\n`;
  md += `**Date**: ${now}\n`;
  md += `**Summary**: ${pass} PASS / ${fail} FAIL / ${skip} SKIP\n\n`;
  md += `---\n\n`;

  let currentSection = '';
  for (const r of results) {
    if (r.section !== currentSection) {
      currentSection = r.section;
      md += `## ${currentSection}\n\n`;
    }
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    md += `${icon} **${r.name}**: ${r.status}`;
    if (r.detail) md += ` — ${r.detail}`;
    md += `\n\n`;
  }

  const reportPath = join(ASSETS, '..', 'validation-report-run-3.md');
  writeFileSync(reportPath, md);
  console.log(`\n📋 Report written to: ${reportPath}`);
  console.log(`\n=== SUMMARY: ${pass} PASS / ${fail} FAIL / ${skip} SKIP ===`);

  return fail;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 SportyKids Validation — Run 3 (prd.md + prd2.md)\n');

  // API checks (require running server)
  try {
    await fetch(`${API}/health`);
  } catch {
    console.error('❌ API server not reachable at ' + API);
    console.error('   Start it with: npm run dev:api');
    process.exit(1);
  }

  await setup();
  await test1_catalog();
  await test2_seedReels();
  await test3_manualSync();
  await test4_newReelsAfterSync();
  await test5_safetyFilter();
  await test6_sourcesList();
  await test7_addCustomSource();
  await test8_deleteCustomSource();
  await test9_ordering();
  test10_i18n();
  test11_testSuite();
  test12_noSpanishRoutes();
  test13_noHardcodedSpanish();

  // Appendix A: Review fixes verification
  await testA1_customSourceNoAuth();
  await testA2_ssrfPrevention();
  await testA3_invalidPlatform();
  testA4_langAttribute();

  // PRD2: User Locale & Country
  await testP2_1_createUserWithLocale();
  await testP2_2_updateLocale();
  await testP2_3_rejectInvalidLocale();
  await testP2_4_rejectInvalidCountry();
  await testP2_5_defaultLocaleCountry();
  testP2_6_i18nCountryKeys();
  testP2_7_sharedTypes();

  const failures = generateReport();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Validation script error:', e);
  process.exit(1);
});
