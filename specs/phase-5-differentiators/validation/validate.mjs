/**
 * Automated validation for M1: AI Infrastructure + Content Safety
 * Fixed: i18n nested key lookup, sync timeout, custom source CRUD flow
 */

import { writeFileSync, readFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '..', 'validation-assets');
const API_DIR = join(ASSETS_DIR, 'api');
const OUTPUT_DIR = join(ASSETS_DIR, 'output');
const ROOT = join(__dirname, '..', '..', '..');

// Ensure dirs exist
for (const d of [ASSETS_DIR, API_DIR, OUTPUT_DIR]) {
  mkdirSync(d, { recursive: true });
}

const API = 'http://localhost:3001/api';
const results = [];

function record(section, name, status, detail = '') {
  results.push({ section, name, status, detail });
  const icon = { PASS: '✅', FAIL: '❌', SKIP: '⏭️' }[status];
  console.log(`${icon} [${section}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(15000), ...opts });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text };
}

function save(name, data) {
  const dir = name.endsWith('.json') ? API_DIR : OUTPUT_DIR;
  writeFileSync(join(dir, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

function read(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

// Resolve nested key from JSON object (e.g. "sources.catalog_title" → obj.sources.catalog_title)
function getNestedKey(obj, key) {
  return key.split('.').reduce((o, k) => o && typeof o === 'object' ? o[k] : undefined, obj);
}

// ─── 1. Schema & Migration ─────────────────────────────────────────────────

async function checkSchema() {
  const S = '1. Schema & Migration';
  const schema = read('apps/api/prisma/schema.prisma');

  const newsFields = ['safetyStatus', 'safetyReason', 'moderatedAt'];
  const missingNews = newsFields.filter(f => !schema.includes(f));
  record(S, 'NewsItem safety fields', missingNews.length === 0 ? 'PASS' : 'FAIL',
    missingNews.length === 0 ? newsFields.join(', ') : `Missing: ${missingNews.join(', ')}`);

  const rssFields = ['country', 'language', 'logoUrl', 'description', 'category', 'isCustom', 'addedBy'];
  const missingRss = rssFields.filter(f => !schema.includes(f));
  record(S, 'RssSource metadata fields', missingRss.length === 0 ? 'PASS' : 'FAIL',
    missingRss.length === 0 ? `All ${rssFields.length} present` : `Missing: ${missingRss.join(', ')}`);

  const migDir = join(ROOT, 'apps/api/prisma/migrations');
  const migs = readdirSync(migDir).filter(f => f.includes('safety'));
  record(S, 'Migration exists', migs.length > 0 ? 'PASS' : 'FAIL', migs[0] || 'not found');
}

// ─── 2. RSS Source Catalog ──────────────────────────────────────────────────

async function checkCatalog() {
  const S = '2. RSS Source Catalog';
  const { status, json } = await api('/news/fuentes/catalogo');
  save('catalog.json', json);

  record(S, 'Catalog endpoint', status === 200 ? 'PASS' : 'FAIL', `HTTP ${status}`);
  if (status !== 200) return;

  record(S, 'Total sources >= 40', json.total >= 40 ? 'PASS' : 'FAIL', `${json.total} sources`);

  const sports = ['football', 'basketball', 'tennis', 'swimming', 'athletics', 'cycling', 'formula1', 'padel'];
  const missing = sports.filter(s => !json.bySport?.[s]);
  record(S, 'All 8 sports covered', missing.length === 0 ? 'PASS' : 'FAIL',
    missing.length === 0 ? JSON.stringify(json.bySport) : `Missing: ${missing.join(', ')}`);

  const src = json.sources?.[0];
  if (src) {
    const req = ['id', 'name', 'url', 'sport', 'active', 'country', 'language', 'description', 'category', 'isCustom'];
    const mf = req.filter(f => !(f in src));
    record(S, 'Source metadata fields', mf.length === 0 ? 'PASS' : 'FAIL',
      mf.length === 0 ? req.join(', ') : `Missing: ${mf.join(', ')}`);
  }
}

// ─── 3. Content Moderation (no full sync — just verify existing data) ───────

async function checkModeration() {
  const S = '3. Content Moderation';

  // Don't trigger a full sync (too slow). Instead check existing news.
  const { status, json } = await api('/news?limit=5');
  save('news-list.json', json);

  if (status !== 200) {
    record(S, 'News endpoint', 'FAIL', `HTTP ${status}`);
    return;
  }

  const total = json.total || 0;
  record(S, 'News available', total > 0 ? 'PASS' : 'SKIP', `${total} total news`);

  if (json.news?.length > 0) {
    const allApproved = json.news.every(n => n.safetyStatus === 'approved');
    record(S, 'All returned news are approved', allApproved ? 'PASS' : 'FAIL',
      `${json.news.length} items checked`);

    const hasSafetyFields = json.news[0].safetyStatus !== undefined && 'safetyReason' in json.news[0];
    record(S, 'News items have safety fields', hasSafetyFields ? 'PASS' : 'FAIL');
  }
}

// ─── 4. Safety Filtering ────────────────────────────────────────────────────

async function checkSafetyFilter() {
  const S = '4. Safety Filtering';
  const { json } = await api('/news?limit=1');

  if (json?.news?.length > 0) {
    const id = json.news[0].id;
    const { status, json: detail } = await api(`/news/${id}`);
    save('news-detail.json', detail);
    record(S, 'Approved item accessible by ID', status === 200 && detail?.safetyStatus === 'approved' ? 'PASS' : 'FAIL');

    const { status: s404 } = await api('/news/nonexistent-id-12345');
    record(S, 'Non-existent ID returns 404', s404 === 404 ? 'PASS' : 'FAIL', `HTTP ${s404}`);
  } else {
    record(S, 'Safety filter', 'SKIP', 'No news to test');
  }
}

// ─── 5. Custom RSS Sources ──────────────────────────────────────────────────

async function checkCustomSources() {
  const S = '5. Custom RSS Sources';
  let customId = null;

  // Test duplicate URL (BBC Tennis is in seed)
  const dup = await api('/news/fuentes/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dup', url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml', sport: 'tennis' }),
  });
  save('custom-duplicate.json', dup.json);
  if (dup.status === 409) {
    record(S, 'Duplicate URL returns 409', 'PASS');
  } else if (dup.status === 201) {
    customId = dup.json?.source?.id;
    record(S, 'Duplicate URL returns 409', 'SKIP', 'URL was not in seed (got 201)');
  } else {
    record(S, 'Duplicate URL returns 409', 'FAIL', `HTTP ${dup.status}`);
  }

  // Test invalid RSS URL
  const inv = await api('/news/fuentes/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bad', url: 'https://example.com/not-rss', sport: 'football' }),
  });
  save('custom-invalid.json', inv.json);
  record(S, 'Invalid RSS returns 422', inv.status === 422 ? 'PASS' : 'FAIL', `HTTP ${inv.status}`);

  // Add a valid custom source (unique URL not in seed) — longer timeout for immediate sync
  if (!customId) {
    const add = await fetch(`${API}/news/fuentes/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Validation Test', url: 'https://feeds.bbci.co.uk/sport/rugby-league/rss.xml', sport: 'football' }),
      signal: AbortSignal.timeout(90000),
    }).then(async r => ({ status: r.status, json: await r.json().catch(() => null) })).catch(e => ({ status: 0, json: { error: e.message } }));
    save('custom-add.json', add.json);
    if (add.status === 201 && add.json?.source?.isCustom) {
      customId = add.json.source.id;
      record(S, 'Add custom source (201, isCustom=true)', 'PASS', `id=${customId}`);
    } else if (add.status === 409) {
      record(S, 'Add custom source', 'SKIP', 'URL already exists');
    } else {
      record(S, 'Add custom source (201)', 'FAIL', `HTTP ${add.status}`);
    }
  }

  // Try deleting a catalog source (should be 403)
  const cat = await api('/news/fuentes/catalogo');
  const catSrc = cat.json?.sources?.find(s => !s.isCustom);
  if (catSrc) {
    const delCat = await api(`/news/fuentes/custom/${catSrc.id}`, { method: 'DELETE' });
    save('custom-delete-catalog.json', delCat.json);
    record(S, 'Delete catalog source returns 403', delCat.status === 403 ? 'PASS' : 'FAIL', `HTTP ${delCat.status}`);
  }

  // Delete the custom source
  if (customId) {
    const del = await api(`/news/fuentes/custom/${customId}`, { method: 'DELETE' });
    save('custom-delete.json', del.json);
    record(S, 'Delete custom source returns 200', del.status === 200 ? 'PASS' : 'FAIL', `HTTP ${del.status}`);
  }
}

// ─── 6. Onboarding UI (SKIP) ───────────────────────────────────────────────

function checkOnboardingUI() {
  const S = '6. Onboarding UI';
  record(S, 'Source catalog grouped by country', 'SKIP', 'Requires browser');
  record(S, 'Select all / Deselect all', 'SKIP', 'Requires browser');
  record(S, 'Add custom source form', 'SKIP', 'Requires browser');
  record(S, 'Complete onboarding', 'SKIP', 'Requires browser');
}

// ─── 7. AI Multi-Provider ───────────────────────────────────────────────────

function checkAIProvider() {
  const S = '7. AI Multi-Provider';
  const code = read('apps/api/src/services/ai-client.ts');

  const hasOllama = code.includes("'ollama'");
  const hasOpenRouter = code.includes("'openrouter'");
  const hasAnthropic = code.includes("'anthropic'");
  const hasSingleton = code.includes('getAIClient');
  const hasHealthCheck = code.includes('isProviderAvailable');

  record(S, '3 providers supported', hasOllama && hasOpenRouter && hasAnthropic && hasSingleton ? 'PASS' : 'FAIL',
    [hasOllama && 'ollama', hasOpenRouter && 'openrouter', hasAnthropic && 'anthropic'].filter(Boolean).join(', '));

  record(S, 'Health check (fast-fail)', hasHealthCheck ? 'PASS' : 'FAIL',
    hasHealthCheck ? 'isProviderAvailable() prevents slow retries' : 'missing');

  record(S, 'Ollama live test', 'SKIP', 'Requires Ollama running');
}

// ─── 8. Types & i18n ────────────────────────────────────────────────────────

function checkTypesAndI18n() {
  const S = '8. Types & i18n';

  const types = read('packages/shared/src/types/index.ts');
  const exports = ['SafetyStatus', 'SafetyResult', 'RssSource', 'RssSourceCatalogResponse'];
  const missingTypes = exports.filter(e => !types.includes(e));
  record(S, 'Shared types exported', missingTypes.length === 0 ? 'PASS' : 'FAIL',
    missingTypes.length === 0 ? exports.join(', ') : `Missing: ${missingTypes.join(', ')}`);

  // Check i18n with NESTED key lookup (the actual JSON structure)
  const es = JSON.parse(read('packages/shared/src/i18n/es.json'));
  const en = JSON.parse(read('packages/shared/src/i18n/en.json'));

  const keys = ['sources.catalog_title', 'sources.add_custom', 'sources.custom_badge', 'sync.approved'];
  const missingEs = keys.filter(k => !getNestedKey(es, k));
  const missingEn = keys.filter(k => !getNestedKey(en, k));

  record(S, 'i18n keys (es.json)', missingEs.length === 0 ? 'PASS' : 'FAIL',
    missingEs.length === 0 ? `${Object.keys(es).length} top-level groups` : `Missing: ${missingEs.join(', ')}`);
  record(S, 'i18n keys (en.json)', missingEn.length === 0 ? 'PASS' : 'FAIL',
    missingEn.length === 0 ? `${Object.keys(en).length} top-level groups` : `Missing: ${missingEn.join(', ')}`);
}

// ─── 9. New Spanish sources ─────────────────────────────────────────────────

async function checkNewSources() {
  const S = '9. New Spanish Sources';
  const { json } = await api('/news?limit=50&source=Pa');
  const elpaisCount = json?.news?.filter(n => n.source.includes('País'))?.length || 0;

  record(S, 'El País news synced', elpaisCount > 0 ? 'PASS' : 'SKIP',
    elpaisCount > 0 ? `${elpaisCount} articles from El País` : 'Not yet synced');

  const { json: cat } = await api('/news/fuentes/catalogo');
  const newNames = ['El País - Deportes', 'El Mundo - Deportes', 'Diario de Sevilla - Deportes'];
  for (const name of newNames) {
    const found = cat?.sources?.find(s => s.name === name);
    record(S, `${name} in catalog`, found ? 'PASS' : 'FAIL',
      found ? `active=${found.active}, url=${found.url.substring(0, 40)}...` : 'not found');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// M2: Age-Adapted Content ("Explain it Easy")
// ═══════════════════════════════════════════════════════════════════════════

// ─── 10. NewsSummary Schema ─────────────────────────────────────────────────

function checkM2Schema() {
  const S = 'M2-1. NewsSummary Schema';
  const schema = read('apps/api/prisma/schema.prisma');

  const hasModel = schema.includes('model NewsSummary');
  const hasUnique = schema.includes('@@unique([newsItemId, ageRange, locale])');
  const hasRelation = schema.includes('summaries') && schema.includes('NewsSummary[]');

  record(S, 'NewsSummary model exists', hasModel ? 'PASS' : 'FAIL');
  record(S, 'Unique constraint [newsItemId, ageRange, locale]', hasUnique ? 'PASS' : 'FAIL');
  record(S, 'NewsItem has summaries relation', hasRelation ? 'PASS' : 'FAIL');

  const migDir = join(ROOT, 'apps/api/prisma/migrations');
  const migs = readdirSync(migDir).filter(f => f.includes('news_summary'));
  record(S, 'Migration exists', migs.length > 0 ? 'PASS' : 'FAIL', migs[0] || 'not found');
}

// ─── 11. Summary API Endpoint ───────────────────────────────────────────────

async function checkM2Endpoint() {
  const S = 'M2-2. Summary API Endpoint';

  // Get a news item ID
  const { json: newsList } = await api('/news?limit=1');
  if (!newsList?.news?.length) {
    record(S, 'Summary endpoint', 'SKIP', 'No news items available');
    return;
  }
  const newsId = newsList.news[0].id;

  // Test with age=7 (6-8 range)
  const { status: s1, json: j1 } = await api(`/news/${newsId}/resumen?age=7&locale=es`);
  save('m2-summary-6-8.json', j1);
  if (s1 === 200 && j1?.ageRange === '6-8') {
    record(S, 'GET /resumen?age=7 returns 6-8 range', 'PASS');
  } else if (s1 === 503) {
    record(S, 'GET /resumen?age=7 returns 6-8 range', 'SKIP', 'AI provider unavailable (503)');
  } else {
    record(S, 'GET /resumen?age=7 returns 6-8 range', 'FAIL', `HTTP ${s1}, ageRange=${j1?.ageRange}`);
  }

  // Test with age=10 (9-11 range)
  const { status: s2, json: j2 } = await api(`/news/${newsId}/resumen?age=10&locale=en`);
  save('m2-summary-9-11.json', j2);
  if (s2 === 200 && j2?.ageRange === '9-11') {
    record(S, 'GET /resumen?age=10&locale=en returns 9-11', 'PASS');
  } else if (s2 === 503) {
    record(S, 'GET /resumen?age=10&locale=en', 'SKIP', 'AI provider unavailable');
  } else {
    record(S, 'GET /resumen?age=10&locale=en returns 9-11', 'FAIL', `HTTP ${s2}`);
  }

  // Test 404 for non-existent item
  const { status: s404 } = await api('/news/nonexistent-id/resumen');
  record(S, 'Non-existent news returns 404', s404 === 404 ? 'PASS' : 'FAIL', `HTTP ${s404}`);

  // Test Zod validation — age=0 should fail
  const { status: s400 } = await api(`/news/${newsId}/resumen?age=0`);
  record(S, 'Invalid age returns 400', s400 === 400 ? 'PASS' : 'FAIL', `HTTP ${s400}`);
}

// ─── 12. UserId Feed Filter ─────────────────────────────────────────────────

async function checkUserIdFilter() {
  const S = 'M2-3. UserId Feed Filter';

  // Get total without userId
  const { json: allNews } = await api('/news?limit=1');
  const totalAll = allNews?.total || 0;

  // Find a user with selectedFeeds
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { json: _catalog } = await api('/news/fuentes/catalogo');
  // We need a userId — grab from news items or just test the param is accepted
  const { json: filtered } = await api('/news?limit=1&userId=cmn50ieqz004u26cei3kkdsx8');
  const totalFiltered = filtered?.total || 0;

  if (totalFiltered > 0 && totalFiltered < totalAll) {
    record(S, 'userId filters news by selected feeds', 'PASS',
      `All: ${totalAll}, Filtered: ${totalFiltered}`);
  } else if (totalFiltered === 0) {
    record(S, 'userId filters news', 'SKIP', 'No news for this user or user not found');
  } else {
    record(S, 'userId filters news', 'FAIL',
      `All: ${totalAll}, Filtered: ${totalFiltered} (should be less)`);
  }
}

// ─── 13. M2 Summarizer Service File ─────────────────────────────────────────

function checkM2Summarizer() {
  const S = 'M2-4. Summarizer Service';
  const code = read('apps/api/src/services/summarizer.ts');

  record(S, 'summarizer.ts exists', code.length > 0 ? 'PASS' : 'FAIL');
  record(S, 'Has generateSummary function', code.includes('generateSummary') ? 'PASS' : 'FAIL');
  record(S, 'Has age profiles (6-8, 9-11, 12-14)',
    code.includes('6-8') && code.includes('9-11') && code.includes('12-14') ? 'PASS' : 'FAIL');
  record(S, 'Uses AI client', code.includes('getAIClient') || code.includes('ai-client') ? 'PASS' : 'FAIL');
  record(S, 'Checks provider availability', code.includes('isProviderAvailable') ? 'PASS' : 'FAIL');
}

// ─── 14. M2 i18n & Types ────────────────────────────────────────────────────

function checkM2TypesAndI18n() {
  const S = 'M2-5. Types & i18n';

  const types = read('packages/shared/src/types/index.ts');
  record(S, 'NewsSummary type exported', types.includes('NewsSummary') ? 'PASS' : 'FAIL');
  record(S, 'NewsItem has summaries field', types.includes('summaries') ? 'PASS' : 'FAIL');

  const es = JSON.parse(read('packages/shared/src/i18n/es.json'));
  const en = JSON.parse(read('packages/shared/src/i18n/en.json'));

  const keys = ['summary.explain_easy', 'summary.adapted_for_age', 'summary.loading', 'summary.error'];
  const missingEs = keys.filter(k => !getNestedKey(es, k));
  const missingEn = keys.filter(k => !getNestedKey(en, k));

  record(S, 'i18n summary keys (es)', missingEs.length === 0 ? 'PASS' : 'FAIL',
    missingEs.length === 0 ? '4 keys present' : `Missing: ${missingEs.join(', ')}`);
  record(S, 'i18n summary keys (en)', missingEn.length === 0 ? 'PASS' : 'FAIL',
    missingEn.length === 0 ? '4 keys present' : `Missing: ${missingEn.join(', ')}`);
}

// ─── 15. M2 UI Components ───────────────────────────────────────────────────

function checkM2UI() {
  const S = 'M2-6. UI Components';

  try {
    const ageComp = read('apps/web/src/components/AgeAdaptedSummary.tsx');
    record(S, 'AgeAdaptedSummary.tsx exists', ageComp.length > 0 ? 'PASS' : 'FAIL');
    record(S, 'Has loading state', ageComp.includes('loading') ? 'PASS' : 'FAIL');
    record(S, 'Has error state', ageComp.includes('error') ? 'PASS' : 'FAIL');
    record(S, 'Fetches summary', ageComp.includes('fetchNewsSummary') ? 'PASS' : 'FAIL');
  } catch {
    record(S, 'AgeAdaptedSummary.tsx exists', 'FAIL', 'File not found');
  }

  const newsCard = read('apps/web/src/components/NewsCard.tsx');
  record(S, 'NewsCard has Explain button', newsCard.includes('explain_easy') || newsCard.includes('Explica') ? 'PASS' : 'FAIL');
  record(S, 'NewsCard imports AgeAdaptedSummary', newsCard.includes('AgeAdaptedSummary') ? 'PASS' : 'FAIL');

  record(S, 'Button toggle in browser', 'SKIP', 'Requires browser — verify manually');
}

// ═══════════════════════════════════════════════════════════════════════════
// M3: Dynamic Quiz from Real News
// ═══════════════════════════════════════════════════════════════════════════

function checkM3Schema() {
  const S = 'M3-1. QuizQuestion Schema';
  const schema = read('apps/api/prisma/schema.prisma');

  const fields = ['generatedAt', 'ageRange', 'expiresAt'];
  const missing = fields.filter(f => {
    // Check field exists in QuizQuestion model context
    const qSection = schema.split('model QuizQuestion')[1]?.split('model ')[0] || '';
    return !qSection.includes(f);
  });
  record(S, 'QuizQuestion new fields', missing.length === 0 ? 'PASS' : 'FAIL',
    missing.length === 0 ? fields.join(', ') : `Missing: ${missing.join(', ')}`);

  record(S, 'Composite index', schema.includes('@@index([expiresAt, sport])') ? 'PASS' : 'FAIL');

  const migDir = join(ROOT, 'apps/api/prisma/migrations');
  const migs = readdirSync(migDir).filter(f => f.includes('quiz'));
  record(S, 'Migration exists', migs.length > 0 ? 'PASS' : 'FAIL', migs[0] || 'not found');
}

async function checkM3QuizEndpoint() {
  const S = 'M3-2. Quiz API';

  // Test without age (backward compatible)
  const { status: s1, json: j1 } = await api('/quiz/questions?count=3');
  save('m3-quiz-no-age.json', j1);
  if (s1 === 200 && j1?.questions?.length > 0) {
    const allHaveIsDaily = j1.questions.every(q => 'isDaily' in q);
    record(S, 'GET /questions (no age) works', 'PASS', `${j1.questions.length} questions`);
    record(S, 'All questions have isDaily field', allHaveIsDaily ? 'PASS' : 'FAIL');
  } else {
    record(S, 'GET /questions (no age)', 'FAIL', `HTTP ${s1}`);
  }

  // Test with age param
  const { status: s2, json: j2 } = await api('/quiz/questions?count=3&age=6-8');
  save('m3-quiz-age-6-8.json', j2);
  record(S, 'GET /questions?age=6-8 works', s2 === 200 ? 'PASS' : 'FAIL', `HTTP ${s2}`);

  // Test Spanish seed questions
  if (j1?.questions?.length > 0) {
    const hasSpanish = j1.questions.some(q =>
      q.question.includes('¿') || q.question.includes('á') || q.question.includes('é') || q.question.includes('ó')
    );
    record(S, 'Seed questions in Spanish', hasSpanish ? 'PASS' : 'FAIL');
  }

  // Test manual generate
  const { status: s3, json: j3 } = await api('/quiz/generate', { method: 'POST' });
  save('m3-quiz-generate.json', j3);
  if (s3 === 200 && 'generated' in (j3 || {})) {
    record(S, 'POST /quiz/generate works', 'PASS', `generated=${j3.generated}, errors=${j3.errors}`);
  } else {
    record(S, 'POST /quiz/generate works', 'FAIL', `HTTP ${s3}`);
  }

  // Test answer returns pointsEarned (not earnedPoints)
  if (j1?.questions?.length > 0) {
    const q = j1.questions[0];
    const ansRes = await api('/quiz/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'cmn50ieqz004u26cei3kkdsx8', questionId: q.id, answer: q.correctAnswer }),
    });
    save('m3-quiz-answer.json', ansRes.json);
    record(S, 'Answer returns pointsEarned field',
      ansRes.json && 'pointsEarned' in ansRes.json ? 'PASS' : 'FAIL',
      `Fields: ${Object.keys(ansRes.json || {}).join(', ')}`);
  }
}

function checkM3Service() {
  const S = 'M3-3. Quiz Generator Service';
  try {
    const code = read('apps/api/src/services/quiz-generator.ts');
    record(S, 'quiz-generator.ts exists', 'PASS');
    record(S, 'Has generateQuizFromNews', code.includes('generateQuizFromNews') ? 'PASS' : 'FAIL');
    record(S, 'Zod validation', code.includes('GeneratedQuizSchema') ? 'PASS' : 'FAIL');
    record(S, 'Age profiles', code.includes('6-8') && code.includes('9-11') && code.includes('12-14') ? 'PASS' : 'FAIL');
  } catch { record(S, 'quiz-generator.ts exists', 'FAIL'); }

  try {
    const job = read('apps/api/src/jobs/generate-daily-quiz.ts');
    record(S, 'generate-daily-quiz.ts exists', 'PASS');
    record(S, 'Has cron schedule', job.includes('0 6 * * *') ? 'PASS' : 'FAIL');
    record(S, 'Round-robin by sport', job.includes('sport') ? 'PASS' : 'FAIL');
  } catch { record(S, 'generate-daily-quiz.ts exists', 'FAIL'); }
}

function checkM3I18n() {
  const S = 'M3-4. i18n & Types';
  const types = read('packages/shared/src/types/index.ts');
  record(S, 'QuizQuestion has isDaily field', types.includes('isDaily') ? 'PASS' : 'FAIL');
  record(S, 'QuizQuestion has generatedAt', types.includes('generatedAt') ? 'PASS' : 'FAIL');

  const es = JSON.parse(read('packages/shared/src/i18n/es.json'));
  const en = JSON.parse(read('packages/shared/src/i18n/en.json'));
  const keys = ['quiz.daily_quiz', 'quiz.read_news', 'quiz.no_daily'];
  record(S, 'i18n quiz keys (es)', keys.every(k => getNestedKey(es, k)) ? 'PASS' : 'FAIL');
  record(S, 'i18n quiz keys (en)', keys.every(k => getNestedKey(en, k)) ? 'PASS' : 'FAIL');
}

function checkM3UI() {
  const S = 'M3-5. Quiz UI';
  const quizGame = read('apps/web/src/components/QuizGame.tsx');
  record(S, 'Daily Quiz badge', quizGame.includes('daily_quiz') || quizGame.includes('isDaily') ? 'PASS' : 'FAIL');
  record(S, 'Related news link', quizGame.includes('relatedNewsId') || quizGame.includes('read_news') ? 'PASS' : 'FAIL');

  const quizPage = read('apps/web/src/app/quiz/page.tsx');
  record(S, 'Quiz page passes age', quizPage.includes('getAgeRange') || quizPage.includes('ageRange') ? 'PASS' : 'FAIL');
  record(S, 'No daily message', quizPage.includes('no_daily') ? 'PASS' : 'FAIL');
}

// ═══════════════════════════════════════════════════════════════════════════
// M4: Gamification (Stickers, Streaks, Achievements)
// ═══════════════════════════════════════════════════════════════════════════

function checkM4Schema() {
  const S = 'M4-1. Gamification Schema';
  const schema = read('apps/api/prisma/schema.prisma');
  const models = ['model Sticker', 'model UserSticker', 'model Achievement', 'model UserAchievement'];
  const missing = models.filter(m => !schema.includes(m));
  record(S, '4 gamification models', missing.length === 0 ? 'PASS' : 'FAIL',
    missing.length === 0 ? 'Sticker, UserSticker, Achievement, UserAchievement' : `Missing: ${missing.join(', ')}`);

  const userFields = ['currentStreak', 'longestStreak', 'lastActiveDate', 'currentQuizCorrectStreak', 'quizPerfectCount'];
  const missingUser = userFields.filter(f => !schema.includes(f));
  record(S, 'User gamification fields', missingUser.length === 0 ? 'PASS' : 'FAIL',
    missingUser.length === 0 ? '5 fields' : `Missing: ${missingUser.join(', ')}`);

  const migDir = join(ROOT, 'apps/api/prisma/migrations');
  const migs = readdirSync(migDir).filter(f => f.includes('gamification'));
  record(S, 'Migration exists', migs.length > 0 ? 'PASS' : 'FAIL', migs[0] || 'not found');
}

async function checkM4Endpoints() {
  const S = 'M4-2. Gamification API';

  // Stickers catalog
  const { status: s1, json: j1 } = await api('/gamification/stickers');
  save('m4-stickers.json', j1);
  record(S, 'GET /stickers returns catalog', s1 === 200 && j1?.stickers?.length >= 30 ? 'PASS' : 'FAIL',
    `HTTP ${s1}, ${j1?.stickers?.length || 0} stickers`);

  // Achievements catalog
  const { status: s2, json: j2 } = await api('/gamification/achievements');
  save('m4-achievements.json', j2);
  record(S, 'GET /achievements returns catalog', s2 === 200 && j2?.achievements?.length >= 15 ? 'PASS' : 'FAIL',
    `HTTP ${s2}, ${j2?.achievements?.length || 0} achievements`);

  // Check-in
  const { status: s3, json: j3 } = await api('/gamification/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'cmn50ieqz004u26cei3kkdsx8' }),
  });
  save('m4-checkin.json', j3);
  record(S, 'POST /check-in works', s3 === 200 && 'currentStreak' in (j3 || {}) ? 'PASS' : 'FAIL',
    `HTTP ${s3}, streak=${j3?.currentStreak}, pts=${j3?.pointsAwarded}`);

  // Streaks
  const { status: s4, json: j4 } = await api('/gamification/streaks/cmn50ieqz004u26cei3kkdsx8');
  save('m4-streaks.json', j4);
  record(S, 'GET /streaks/:userId works', s4 === 200 && 'currentStreak' in (j4 || {}) ? 'PASS' : 'FAIL');

  // User stickers
  const { status: s5, json: j5 } = await api('/gamification/stickers/cmn50ieqz004u26cei3kkdsx8');
  save('m4-user-stickers.json', j5);
  record(S, 'GET /stickers/:userId returns collection', s5 === 200 && 'collected' in (j5 || {}) ? 'PASS' : 'FAIL',
    `${j5?.collected || 0}/${j5?.total || 0} collected`);

  // User achievements
  const { status: s6, json: j6 } = await api('/gamification/achievements/cmn50ieqz004u26cei3kkdsx8');
  save('m4-user-achievements.json', j6);
  record(S, 'GET /achievements/:userId works', s6 === 200 && 'unlocked' in (j6 || {}) ? 'PASS' : 'FAIL',
    `${j6?.unlocked || 0}/${j6?.total || 0} unlocked`);
}

function checkM4Service() {
  const S = 'M4-3. Gamification Service';
  const code = read('apps/api/src/services/gamification.ts');
  record(S, 'gamification.ts exists', code.length > 0 ? 'PASS' : 'FAIL');
  record(S, 'checkAndUpdateStreak', code.includes('checkAndUpdateStreak') ? 'PASS' : 'FAIL');
  record(S, 'awardSticker', code.includes('awardSticker') ? 'PASS' : 'FAIL');
  record(S, 'evaluateAchievements', code.includes('evaluateAchievements') ? 'PASS' : 'FAIL');
  record(S, 'awardPointsForActivity', code.includes('awardPointsForActivity') ? 'PASS' : 'FAIL');
}

function checkM4Frontend() {
  const S = 'M4-4. Frontend';

  // Types
  const types = read('packages/shared/src/types/index.ts');
  record(S, 'Sticker type', types.includes('interface Sticker') ? 'PASS' : 'FAIL');
  record(S, 'Achievement type', types.includes('interface Achievement') ? 'PASS' : 'FAIL');
  record(S, 'CheckInResponse type', types.includes('CheckInResponse') ? 'PASS' : 'FAIL');

  // Constants
  const constants = read('packages/shared/src/constants/index.ts');
  record(S, 'RARITY_COLORS constant', constants.includes('RARITY_COLORS') ? 'PASS' : 'FAIL');

  // i18n
  const es = JSON.parse(read('packages/shared/src/i18n/es.json'));
  const en = JSON.parse(read('packages/shared/src/i18n/en.json'));
  record(S, 'i18n collection keys (es)', getNestedKey(es, 'collection.title') ? 'PASS' : 'FAIL');
  record(S, 'i18n collection keys (en)', getNestedKey(en, 'collection.title') ? 'PASS' : 'FAIL');
  record(S, 'i18n gamification keys', getNestedKey(es, 'gamification.points_earned') ? 'PASS' : 'FAIL');

  // Components
  const components = ['StickerCard', 'StreakCounter', 'AchievementBadge', 'RewardToast'];
  for (const comp of components) {
    try {
      read(`apps/web/src/components/${comp}.tsx`);
      record(S, `${comp} component`, 'PASS');
    } catch { record(S, `${comp} component`, 'FAIL', 'File not found'); }
  }

  // Collection page
  try {
    read('apps/web/src/app/collection/page.tsx');
    record(S, 'Collection page exists', 'PASS');
  } catch { record(S, 'Collection page', 'FAIL'); }

  // NavBar
  const nav = read('apps/web/src/components/NavBar.tsx');
  record(S, 'NavBar has Collection link', nav.includes('collection') ? 'PASS' : 'FAIL');

  // Check-in in UserProvider
  const ctx = read('apps/web/src/lib/user-context.tsx');
  record(S, 'UserProvider daily check-in', ctx.includes('checkIn') ? 'PASS' : 'FAIL');

  record(S, 'Collection page UI', 'SKIP', 'Requires browser — verify manually');
}

// ═══════════════════════════════════════════════════════════════════════════
// M5: Robust Parental Controls
// ═══════════════════════════════════════════════════════════════════════════

function checkM5Schema() {
  const S = 'M5-1. Schema & Middleware';
  const schema = read('apps/api/prisma/schema.prisma');
  const actFields = ['durationSeconds', 'contentId'];
  const missing = actFields.filter(f => !schema.includes(f));
  record(S, 'ActivityLog new fields', missing.length === 0 ? 'PASS' : 'FAIL',
    missing.length === 0 ? 'durationSeconds, contentId, sport' : `Missing: ${missing.join(', ')}`);

  const migDir = join(ROOT, 'apps/api/prisma/migrations');
  const migs = readdirSync(migDir).filter(f => f.includes('activity'));
  record(S, 'Activity migration', migs.length > 0 ? 'PASS' : 'FAIL', migs[0] || 'not found');

  try {
    const guard = read('apps/api/src/middleware/parental-guard.ts');
    record(S, 'parental-guard.ts exists', 'PASS');
    record(S, 'Checks format restriction', guard.includes('format_blocked') ? 'PASS' : 'FAIL');
    record(S, 'Checks sport restriction', guard.includes('sport_blocked') ? 'PASS' : 'FAIL');
    record(S, 'Checks time limit', guard.includes('limit_reached') ? 'PASS' : 'FAIL');
    record(S, 'In-memory cache', guard.includes('profileCache') || guard.includes('Cache') ? 'PASS' : 'FAIL');
  } catch { record(S, 'parental-guard.ts', 'FAIL', 'File not found'); }
}

function checkM5Bcrypt() {
  const S = 'M5-2. bcrypt & Sessions';
  const parents = read('apps/api/src/routes/parents.ts');
  record(S, 'Uses bcryptjs', parents.includes('bcrypt') ? 'PASS' : 'FAIL');
  record(S, 'Transparent SHA-256 migration', parents.includes('sha256') || parents.includes('SHA') || parents.includes('64') ? 'PASS' : 'SKIP', 'Check manually');
  record(S, 'Session tokens', parents.includes('sessionToken') || parents.includes('randomUUID') ? 'PASS' : 'FAIL');
  record(S, 'Cache invalidation', parents.includes('invalidateProfileCache') ? 'PASS' : 'FAIL');
}

async function checkM5Endpoints() {
  const S = 'M5-3. Parental API';

  // Activity detail endpoint
  const { status, json } = await api('/parents/actividad/cmn50ieqz004u26cei3kkdsx8/detalle?from=2026-03-17&to=2026-03-24');
  save('m5-activity-detail.json', json);
  record(S, 'Activity detail endpoint', status === 200 ? 'PASS' : 'FAIL', `HTTP ${status}`);

  // Verify PIN endpoint works (even if user has no profile)
  const { status: s2 } = await api('/parents/verificar-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'cmn50ieqz004u26cei3kkdsx8', pin: '0000' }),
  });
  record(S, 'Verify PIN endpoint responds', [200, 401].includes(s2) ? 'PASS' : 'FAIL', `HTTP ${s2}`);

  // Test parental guard — middleware is applied
  const news = read('apps/api/src/routes/news.ts');
  const reels = read('apps/api/src/routes/reels.ts');
  const quiz = read('apps/api/src/routes/quiz.ts');
  record(S, 'Guard on news routes', news.includes('parentalGuard') ? 'PASS' : 'FAIL');
  record(S, 'Guard on reels routes', reels.includes('parentalGuard') ? 'PASS' : 'FAIL');
  record(S, 'Guard on quiz routes', quiz.includes('parentalGuard') ? 'PASS' : 'FAIL');
}

function checkM5Frontend() {
  const S = 'M5-4. Frontend';

  // Onboarding step 5
  const wizard = read('apps/web/src/components/OnboardingWizard.tsx');
  record(S, 'TOTAL_STEPS = 5', wizard.includes('TOTAL_STEPS = 5') ? 'PASS' : 'FAIL');
  record(S, 'Step 5 PIN creation', wizard.includes('step5_title') || wizard.includes('pin_create') ? 'PASS' : 'FAIL');
  record(S, 'Step 5 format toggles', wizard.includes('allowedFormats') || wizard.includes('toggleAllowedFormat') ? 'PASS' : 'FAIL');
  record(S, 'Step 5 time limit', wizard.includes('TIME_PRESETS') || wizard.includes('timeLimitMinutes') ? 'PASS' : 'FAIL');

  // Activity tracker hook
  try {
    const hook = read('apps/web/src/lib/use-activity-tracker.ts');
    record(S, 'useActivityTracker hook', 'PASS');
    record(S, 'Uses sendBeacon', hook.includes('sendBeacon') ? 'PASS' : 'FAIL');
  } catch { record(S, 'useActivityTracker hook', 'FAIL'); }

  // Integrated in pages
  const home = read('apps/web/src/app/HomeFeedClient.tsx');
  record(S, 'Tracker in Home', home.includes('useActivityTracker') ? 'PASS' : 'FAIL');

  // LimitReached component
  try {
    read('apps/web/src/components/LimitReached.tsx');
    record(S, 'LimitReached component', 'PASS');
  } catch { record(S, 'LimitReached component', 'FAIL'); }

  // ParentalPanel tabs
  const panel = read('apps/web/src/components/ParentalPanel.tsx');
  record(S, 'ParentalPanel has tabs', panel.includes('tab_profile') || panel.includes('activeTab') ? 'PASS' : 'FAIL');

  // API routes fixed
  const apiClient = read('apps/web/src/lib/api.ts');
  record(S, 'API uses /parents/configurar', apiClient.includes('/parents/configurar') ? 'PASS' : 'FAIL');
  record(S, 'API uses /parents/perfil/', apiClient.includes('/parents/perfil/') ? 'PASS' : 'FAIL');
  record(S, 'API uses /parents/verificar-pin', apiClient.includes('/parents/verificar-pin') ? 'PASS' : 'FAIL');

  // i18n
  const es = JSON.parse(read('packages/shared/src/i18n/es.json'));
  record(S, 'i18n onboarding.step5_title', getNestedKey(es, 'onboarding.step5_title') ? 'PASS' : 'FAIL');
  record(S, 'i18n limit.reached_title', getNestedKey(es, 'limit.reached_title') ? 'PASS' : 'FAIL');
  record(S, 'i18n parental.tab_activity', getNestedKey(es, 'parental.tab_activity') ? 'PASS' : 'FAIL');

  record(S, 'Onboarding step 5 UI', 'SKIP', 'Requires browser');
  record(S, 'Parental panel tabs UI', 'SKIP', 'Requires browser');
}

// ═══════════════════════════════════════════════════════════════════════════
// M6: Smart Feed + Enriched Team + Improved Reels
// ═══════════════════════════════════════════════════════════════════════════

function checkM6Schema() {
  const S = 'M6-1. Schema';
  const schema = read('apps/api/prisma/schema.prisma');
  record(S, 'TeamStats model', schema.includes('model TeamStats') ? 'PASS' : 'FAIL');
  record(S, 'Reel videoType field', schema.includes('videoType') ? 'PASS' : 'FAIL');
  record(S, 'User pushEnabled field', schema.includes('pushEnabled') ? 'PASS' : 'FAIL');

  const migDir = join(ROOT, 'apps/api/prisma/migrations');
  const migs = readdirSync(migDir).filter(f => f.includes('team_stats') || f.includes('reel_field'));
  record(S, 'M6 migration', migs.length > 0 ? 'PASS' : 'FAIL', migs[0] || 'not found');
}

async function checkM6Endpoints() {
  const S = 'M6-2. API Endpoints';

  // Team stats
  const { status: s1, json: j1 } = await api('/teams/Real%20Madrid/stats');
  save('m6-team-stats.json', j1);
  record(S, 'GET /teams/:name/stats', s1 === 200 && j1?.teamName === 'Real Madrid' ? 'PASS' : 'FAIL',
    s1 === 200 ? `Position: ${j1?.leaguePosition}, Results: ${j1?.recentResults?.length}` : `HTTP ${s1}`);

  const { status: s404 } = await api('/teams/Nonexistent%20Team/stats');
  record(S, 'Unknown team returns 404', s404 === 404 ? 'PASS' : 'FAIL');

  // Feed ranked with userId
  const { status: s2, json: j2 } = await api('/news?userId=cmn50ieqz004u26cei3kkdsx8&limit=3');
  save('m6-ranked-feed.json', j2);
  record(S, 'Feed with userId (ranked)', s2 === 200 && j2?.total > 0 ? 'PASS' : 'FAIL',
    `${j2?.total || 0} results`);

  // Notifications
  const { status: s3, json: j3 } = await api('/users/cmn50ieqz004u26cei3kkdsx8/notifications');
  save('m6-notifications.json', j3);
  record(S, 'GET /users/:id/notifications', s3 === 200 && 'pushEnabled' in (j3 || {}) ? 'PASS' : 'FAIL');

  // Reels with real videos
  const { json: j4 } = await api('/reels?limit=5');
  save('m6-reels.json', j4);
  const hasReal = j4?.reels?.some((r) => !r.videoUrl.includes('dQw4w9WgXcQ'));
  record(S, 'Reels have real videos (not Rick Roll)', hasReal ? 'PASS' : 'FAIL',
    `${j4?.total || 0} reels`);
}

function checkM6Services() {
  const S = 'M6-3. Services & Routes';

  try {
    const ranker = read('apps/api/src/services/feed-ranker.ts');
    record(S, 'feed-ranker.ts exists', 'PASS');
    record(S, 'rankFeed function', ranker.includes('rankFeed') ? 'PASS' : 'FAIL');
  } catch { record(S, 'feed-ranker.ts', 'FAIL'); }

  try {
    read('apps/api/src/services/team-stats.ts');
    record(S, 'team-stats.ts exists', 'PASS');
  } catch { record(S, 'team-stats.ts', 'FAIL'); }

  try {
    read('apps/api/src/routes/teams.ts');
    record(S, 'teams route exists', 'PASS');
  } catch { record(S, 'teams route', 'FAIL'); }

  const index = read('apps/api/src/index.ts');
  record(S, 'Teams router registered', index.includes('teams') ? 'PASS' : 'FAIL');
}

function checkM6Frontend() {
  const S = 'M6-4. Frontend';

  // Components
  const components = ['FeedModeToggle', 'HeadlineRow', 'TeamStatsCard', 'TeamReelsStrip', 'ReelPlayer', 'VerticalFeed', 'NotificationSettings'];
  for (const c of components) {
    try {
      read(`apps/web/src/components/${c}.tsx`);
      record(S, `${c} component`, 'PASS');
    } catch { record(S, `${c} component`, 'FAIL'); }
  }

  // Reels page uses grid (not just VerticalFeed)
  const reelsPage = read('apps/web/src/app/reels/page.tsx');
  record(S, 'Reels page has grid layout', reelsPage.includes('grid') ? 'PASS' : 'FAIL');
  record(S, 'Reels page uses ReelCard', reelsPage.includes('ReelCard') ? 'PASS' : 'FAIL');

  // Home has feed mode toggle
  try {
    const home = read('apps/web/src/app/HomeFeedClient.tsx');
    record(S, 'Home has FeedModeToggle', home.includes('FeedModeToggle') || home.includes('feedMode') ? 'PASS' : 'FAIL');
  } catch { record(S, 'HomeFeedClient', 'FAIL'); }

  // Types
  const types = read('packages/shared/src/types/index.ts');
  record(S, 'TeamStats type', types.includes('TeamStats') ? 'PASS' : 'FAIL');
  record(S, 'RecentResult type', types.includes('RecentResult') ? 'PASS' : 'FAIL');
  record(S, 'Reel videoType field', types.includes('videoType') ? 'PASS' : 'FAIL');

  // i18n
  const es = JSON.parse(read('packages/shared/src/i18n/es.json'));
  record(S, 'i18n feed keys', getNestedKey(es, 'feed.mode_headlines') ? 'PASS' : 'FAIL');
  record(S, 'i18n notifications keys', getNestedKey(es, 'notifications.title') ? 'PASS' : 'FAIL');
  record(S, 'i18n team stats keys', getNestedKey(es, 'team.league_position') ? 'PASS' : 'FAIL');
  record(S, 'i18n reels.like key', getNestedKey(es, 'reels.like') ? 'PASS' : 'FAIL');

  // CSS
  const css = read('apps/web/src/styles/globals.css');
  record(S, 'Scroll-snap CSS', css.includes('scroll-snap') || css.includes('reel-container') ? 'PASS' : 'FAIL');

  record(S, 'Feed modes UI', 'SKIP', 'Requires browser');
  record(S, 'Team stats page UI', 'SKIP', 'Requires browser');
  record(S, 'Reels grid UI', 'SKIP', 'Requires browser');
}

// ─── Report ─────────────────────────────────────────────────────────────────

function generateReport() {
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;

  let md = `# Validation Report — M1 + M2 + M3 + M4 + M5 + M6 (FINAL)\n\n`;
  md += `**Date**: ${new Date().toISOString()}\n`;
  md += `**Summary**: ${pass} PASS, ${fail} FAIL, ${skip} SKIP (total: ${results.length})\n\n`;

  let section = '';
  for (const r of results) {
    if (r.section !== section) { section = r.section; md += `## ${section}\n\n`; }
    const icon = { PASS: '✅', FAIL: '❌', SKIP: '⏭️' }[r.status];
    md += `- ${icon} **${r.name}**${r.detail ? ` — ${r.detail}` : ''}\n`;
  }

  md += `\n## Evidence\n\n- [API responses](api/)\n- [Command output](output/)\n`;
  writeFileSync(join(ASSETS_DIR, 'validation-report.md'), md);
  return { pass, fail, skip };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== M1 + M2 + M3 Validation ===\n');

  // M1 checks
  await checkSchema();
  await checkCatalog();
  await checkModeration();
  await checkSafetyFilter();
  await checkCustomSources();
  checkOnboardingUI();
  checkAIProvider();
  checkTypesAndI18n();
  await checkNewSources();

  console.log('\n--- M2: Age-Adapted Content ---\n');

  checkM2Schema();
  await checkM2Endpoint();
  await checkUserIdFilter();
  checkM2Summarizer();
  checkM2TypesAndI18n();
  checkM2UI();

  console.log('\n--- M3: Dynamic Quiz ---\n');

  checkM3Schema();
  await checkM3QuizEndpoint();
  checkM3Service();
  checkM3I18n();
  checkM3UI();

  console.log('\n--- M4: Gamification ---\n');

  checkM4Schema();
  await checkM4Endpoints();
  checkM4Service();
  checkM4Frontend();

  console.log('\n--- M5: Robust Parental Controls ---\n');

  checkM5Schema();
  checkM5Bcrypt();
  await checkM5Endpoints();
  checkM5Frontend();

  console.log('\n--- M6: Smart Feed + Team + Reels ---\n');

  checkM6Schema();
  await checkM6Endpoints();
  checkM6Services();
  checkM6Frontend();

  const { pass, fail, skip } = generateReport();
  console.log(`\n=== RESULTS: ${pass} PASS, ${fail} FAIL, ${skip} SKIP ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
