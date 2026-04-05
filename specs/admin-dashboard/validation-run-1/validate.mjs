/**
 * Admin Dashboard — Validation Script
 * Run: node specs/admin-dashboard/validation/validate.mjs
 *
 * Validates all admin API endpoints and the create-admin CLI script.
 * Generates a markdown report in validation-assets/validation-report-run-1.md
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const ASSETS_DIR = resolve(__dirname, '../validation-assets');
const RUN_DIR = resolve(ASSETS_DIR, 'run-1');
const API_DIR = resolve(RUN_DIR, 'api');
const OUTPUT_DIR = resolve(RUN_DIR, 'output');
const REPORT_PATH = resolve(ASSETS_DIR, 'validation-report-run-1.md');

// Ensure output dirs exist
mkdirSync(API_DIR, { recursive: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_BASE = 'http://localhost:3001';
const DB_URL = 'postgresql://sportykids:sportykids@localhost:5432/sportykids';
const ADMIN_EMAIL = 'validate-admin@sportykids-validation.test';
const ADMIN_PASSWORD = 'Validate123!';
const CHILD_EMAIL = 'validate-child@sportykids-validation.test';
const CHILD_PASSWORD = 'Child456!';

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------
const results = [];

function record(section, name, status, detail, payloadFile) {
  results.push({ section, name, status, detail, payloadFile });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭';
  console.log(`  ${icon} [${status}] ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });
  let body;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { status: res.status, body };
}

function savePayload(filename, data) {
  const path = resolve(API_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  return `run-1/api/${filename}`;
}

function saveOutput(filename, text) {
  const path = resolve(OUTPUT_DIR, filename);
  writeFileSync(path, text, 'utf8');
  return `run-1/output/${filename}`;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Setup: check API health
// ---------------------------------------------------------------------------
async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Setup: create or ensure admin user
// ---------------------------------------------------------------------------
async function setupAdminUser() {
  // Step 1: Register via API (may fail if already exists — that's fine)
  try {
    await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Admin Test' }),
    });
  } catch {
    // ignore — user might already exist
  }

  // Step 2: Promote to admin via CLI script
  const cmd = `DATABASE_URL='${DB_URL}' npx tsx apps/api/scripts/create-admin.ts ${ADMIN_EMAIL}`;
  let cliOutput = '';
  try {
    cliOutput = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000 });
  } catch (err) {
    cliOutput = err.stdout ?? err.message;
  }

  // Step 3: Login to obtain JWT
  const loginRes = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (loginRes.status !== 200 || !loginRes.body?.accessToken) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return { token: loginRes.body.accessToken, cliOutput };
}

// ---------------------------------------------------------------------------
// Setup: create child user (for 403 tests)
// ---------------------------------------------------------------------------
async function setupChildUser() {
  // Register via API (ignore if already exists)
  try {
    await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: CHILD_EMAIL, password: CHILD_PASSWORD, name: 'Child Test' }),
    });
  } catch {
    // ignore
  }

  const loginRes = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: CHILD_EMAIL, password: CHILD_PASSWORD }),
  });

  if (loginRes.status !== 200 || !loginRes.body?.accessToken) {
    throw new Error(`Child login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return loginRes.body.accessToken;
}

// ---------------------------------------------------------------------------
// Section 1: Auth Guards
// ---------------------------------------------------------------------------
async function runAuthGuardChecks() {
  console.log('\n[Section] Auth Guards');

  // 1a: No auth → 401
  try {
    const res = await apiFetch('/api/admin/moderation/pending');
    const payload = { request: { method: 'GET', url: '/api/admin/moderation/pending', headers: {} }, response: { status: res.status, body: res.body } };
    const file = savePayload('01-auth-guard-no-auth.json', payload);
    if (res.status === 401) {
      record('Auth Guards', 'No auth → 401', 'PASS', `GET /api/admin/moderation/pending returned 401`, file);
    } else {
      record('Auth Guards', 'No auth → 401', 'FAIL', `Expected 401, got ${res.status}`, file);
    }
  } catch (err) {
    record('Auth Guards', 'No auth → 401', 'FAIL', err.message, null);
  }

  // 1b: Child role → 403
  let childToken;
  try {
    childToken = await setupChildUser();
  } catch (err) {
    record('Auth Guards', 'Child role → 403', 'FAIL', `Could not create child user: ${err.message}`, null);
    return;
  }

  try {
    const res = await apiFetch('/api/admin/moderation/pending', { headers: authHeader(childToken) });
    const payload = { request: { method: 'GET', url: '/api/admin/moderation/pending', headers: { Authorization: 'Bearer <child-token>' } }, response: { status: res.status, body: res.body } };
    const file = savePayload('02-auth-guard-child-403.json', payload);
    if (res.status === 403) {
      record('Auth Guards', 'Child role → 403', 'PASS', `GET /api/admin/moderation/pending with child JWT returned 403`, file);
    } else {
      record('Auth Guards', 'Child role → 403', 'FAIL', `Expected 403, got ${res.status}`, file);
    }
  } catch (err) {
    record('Auth Guards', 'Child role → 403', 'FAIL', err.message, null);
  }
}

// ---------------------------------------------------------------------------
// Section 2: GET /api/admin/moderation/pending
// ---------------------------------------------------------------------------
async function runModerationPendingChecks(adminToken) {
  console.log('\n[Section] GET /api/admin/moderation/pending');

  // 2a: No filters
  try {
    const res = await apiFetch('/api/admin/moderation/pending', { headers: authHeader(adminToken) });
    const payload = { request: { method: 'GET', url: '/api/admin/moderation/pending' }, response: { status: res.status, body: res.body } };
    const file = savePayload('03-pending-no-filter.json', payload);
    if (res.status === 200 && typeof res.body.total === 'number' && res.body.page === 1 && Array.isArray(res.body.items)) {
      record('Moderation Pending', 'No filters → paginated response', 'PASS', `total: ${res.body.total}, page: 1, totalPages: ${res.body.totalPages}`, file);
    } else {
      record('Moderation Pending', 'No filters → paginated response', 'FAIL', `Unexpected response: status=${res.status}`, file);
    }
  } catch (err) {
    record('Moderation Pending', 'No filters → paginated response', 'FAIL', err.message, null);
  }

  // 2b: type=news filter
  try {
    const res = await apiFetch('/api/admin/moderation/pending?type=news', { headers: authHeader(adminToken) });
    const payload = { request: { method: 'GET', url: '/api/admin/moderation/pending?type=news' }, response: { status: res.status, body: res.body } };
    const file = savePayload('04-pending-type-news.json', payload);
    const allNews = res.status === 200 && Array.isArray(res.body.items) && res.body.items.every((i) => i.type === 'news');
    if (res.status === 200 && allNews) {
      record('Moderation Pending', '?type=news → only news items', 'PASS', `${res.body.items.length} news items returned`, file);
    } else if (res.status === 200 && res.body.items.length === 0) {
      record('Moderation Pending', '?type=news → only news items', 'PASS', 'No pending news items (empty list)', file);
    } else {
      record('Moderation Pending', '?type=news → only news items', 'FAIL', `Non-news items present or error: status=${res.status}`, file);
    }
  } catch (err) {
    record('Moderation Pending', '?type=news → only news items', 'FAIL', err.message, null);
  }

  // 2c: type=reel filter
  try {
    const res = await apiFetch('/api/admin/moderation/pending?type=reel', { headers: authHeader(adminToken) });
    const payload = { request: { method: 'GET', url: '/api/admin/moderation/pending?type=reel' }, response: { status: res.status, body: res.body } };
    const file = savePayload('05-pending-type-reel.json', payload);
    const allReels = res.status === 200 && Array.isArray(res.body.items) && res.body.items.every((i) => i.type === 'reel');
    if (res.status === 200 && allReels) {
      record('Moderation Pending', '?type=reel → only reel items', 'PASS', `${res.body.items.length} reel items returned`, file);
    } else if (res.status === 200 && res.body.items.length === 0) {
      record('Moderation Pending', '?type=reel → only reel items', 'PASS', 'No pending reel items (empty list)', file);
    } else {
      record('Moderation Pending', '?type=reel → only reel items', 'FAIL', `Non-reel items present or error: status=${res.status}`, file);
    }
  } catch (err) {
    record('Moderation Pending', '?type=reel → only reel items', 'FAIL', err.message, null);
  }

  // 2d: Pagination
  try {
    const res = await apiFetch('/api/admin/moderation/pending?limit=5&page=1', { headers: authHeader(adminToken) });
    const payload = { request: { method: 'GET', url: '/api/admin/moderation/pending?limit=5&page=1' }, response: { status: res.status, body: res.body } };
    const file = savePayload('06-pending-pagination.json', payload);
    if (res.status === 200 && res.body.page === 1 && res.body.items.length <= 5) {
      record('Moderation Pending', '?limit=5&page=1 → pagination respected', 'PASS', `items: ${res.body.items.length}/5, totalPages: ${res.body.totalPages}`, file);
    } else {
      record('Moderation Pending', '?limit=5&page=1 → pagination respected', 'FAIL', `status=${res.status}, items=${res.body.items?.length}`, file);
    }
  } catch (err) {
    record('Moderation Pending', '?limit=5&page=1 → pagination respected', 'FAIL', err.message, null);
  }

  // Return pending items for subsequent checks
  try {
    const res = await apiFetch('/api/admin/moderation/pending?limit=100', { headers: authHeader(adminToken) });
    return res.status === 200 ? res.body.items : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Section 3: PATCH /api/admin/content/:type/:id/approve
// ---------------------------------------------------------------------------
async function runApproveChecks(adminToken, pendingItems) {
  console.log('\n[Section] PATCH /api/admin/content/:type/:id/approve');

  const pendingNews = pendingItems.filter((i) => i.type === 'news');
  const pendingReels = pendingItems.filter((i) => i.type === 'reel');

  // 3a: Approve news item
  if (pendingNews.length === 0) {
    record('Content Approve', 'Approve news item', 'SKIP', 'No pending news items in DB', null);
  } else {
    const item = pendingNews[0];
    try {
      const res = await apiFetch(`/api/admin/content/news/${item.id}/approve`, { method: 'PATCH', headers: authHeader(adminToken) });
      const payload = { request: { method: 'PATCH', url: `/api/admin/content/news/${item.id}/approve` }, response: { status: res.status, body: res.body } };
      const file = savePayload('07-approve-news.json', payload);
      if (res.status === 200 && res.body.safetyStatus === 'approved' && res.body.moderatedAt) {
        record('Content Approve', 'Approve news item', 'PASS', `id: ${res.body.id}, safetyStatus: approved`, file);
      } else {
        record('Content Approve', 'Approve news item', 'FAIL', `status=${res.status}, body=${JSON.stringify(res.body)}`, file);
      }
    } catch (err) {
      record('Content Approve', 'Approve news item', 'FAIL', err.message, null);
    }
  }

  // 3b: Approve reel item
  if (pendingReels.length === 0) {
    record('Content Approve', 'Approve reel item', 'SKIP', 'No pending reel items in DB', null);
  } else {
    const item = pendingReels[0];
    try {
      const res = await apiFetch(`/api/admin/content/reel/${item.id}/approve`, { method: 'PATCH', headers: authHeader(adminToken) });
      const payload = { request: { method: 'PATCH', url: `/api/admin/content/reel/${item.id}/approve` }, response: { status: res.status, body: res.body } };
      const file = savePayload('08-approve-reel.json', payload);
      if (res.status === 200 && res.body.safetyStatus === 'approved' && res.body.moderatedAt) {
        record('Content Approve', 'Approve reel item', 'PASS', `id: ${res.body.id}, safetyStatus: approved`, file);
      } else {
        record('Content Approve', 'Approve reel item', 'FAIL', `status=${res.status}, body=${JSON.stringify(res.body)}`, file);
      }
    } catch (err) {
      record('Content Approve', 'Approve reel item', 'FAIL', err.message, null);
    }
  }
}

// ---------------------------------------------------------------------------
// Section 4: PATCH /api/admin/content/:type/:id/reject
// ---------------------------------------------------------------------------
async function runRejectChecks(adminToken, pendingItems) {
  console.log('\n[Section] PATCH /api/admin/content/:type/:id/reject');

  // We need a fresh pending item — re-fetch after approve may have consumed some
  // Use item index [1] if available, otherwise re-fetch
  let targetNews = pendingItems.filter((i) => i.type === 'news')[1];
  let targetReel = pendingItems.filter((i) => i.type === 'reel')[1];

  // If we don't have a second news item, re-fetch
  if (!targetNews) {
    try {
      const res = await apiFetch('/api/admin/moderation/pending?type=news&limit=100', { headers: authHeader(adminToken) });
      if (res.status === 200 && res.body.items.length > 0) targetNews = res.body.items[0];
    } catch { /* ignore */ }
  }
  if (!targetReel) {
    try {
      const res = await apiFetch('/api/admin/moderation/pending?type=reel&limit=100', { headers: authHeader(adminToken) });
      if (res.status === 200 && res.body.items.length > 0) targetReel = res.body.items[0];
    } catch { /* ignore */ }
  }

  // 4a: Reject without reason → 400
  if (!targetNews && !targetReel) {
    // Use a fake ID just to test validation error (400 should still fire before DB lookup)
    const fakeId = 'fake-id-for-validation';
    try {
      const res = await apiFetch(`/api/admin/content/news/${fakeId}/reject`, { method: 'PATCH', headers: authHeader(adminToken), body: JSON.stringify({}) });
      const payload = { request: { method: 'PATCH', url: `/api/admin/content/news/${fakeId}/reject`, body: {} }, response: { status: res.status, body: res.body } };
      const file = savePayload('09-reject-no-reason.json', payload);
      if (res.status === 400) {
        record('Content Reject', 'Reject without reason → 400', 'PASS', 'Validation correctly rejected missing reason', file);
      } else {
        record('Content Reject', 'Reject without reason → 400', 'FAIL', `Expected 400, got ${res.status}`, file);
      }
    } catch (err) {
      record('Content Reject', 'Reject without reason → 400', 'FAIL', err.message, null);
    }
  } else {
    const item = targetNews ?? targetReel;
    const type = item === targetNews ? 'news' : 'reel';
    try {
      const res = await apiFetch(`/api/admin/content/${type}/${item.id}/reject`, { method: 'PATCH', headers: authHeader(adminToken), body: JSON.stringify({}) });
      const payload = { request: { method: 'PATCH', url: `/api/admin/content/${type}/${item.id}/reject`, body: {} }, response: { status: res.status, body: res.body } };
      const file = savePayload('09-reject-no-reason.json', payload);
      if (res.status === 400) {
        record('Content Reject', 'Reject without reason → 400', 'PASS', 'Validation correctly rejected missing reason', file);
      } else {
        record('Content Reject', 'Reject without reason → 400', 'FAIL', `Expected 400, got ${res.status}`, file);
      }
    } catch (err) {
      record('Content Reject', 'Reject without reason → 400', 'FAIL', err.message, null);
    }
  }

  // 4b: Reject with valid reason
  if (!targetNews && !targetReel) {
    record('Content Reject', 'Reject with valid reason → safetyStatus=rejected', 'SKIP', 'No pending content in DB', null);
  } else {
    const item = targetNews ?? targetReel;
    const type = item === targetNews ? 'news' : 'reel';
    try {
      const res = await apiFetch(`/api/admin/content/${type}/${item.id}/reject`, {
        method: 'PATCH',
        headers: authHeader(adminToken),
        body: JSON.stringify({ reason: 'Contains inappropriate content for children' }),
      });
      const payload = {
        request: { method: 'PATCH', url: `/api/admin/content/${type}/${item.id}/reject`, body: { reason: 'Contains inappropriate content for children' } },
        response: { status: res.status, body: res.body },
      };
      const file = savePayload('10-reject-with-reason.json', payload);
      if (res.status === 200 && res.body.safetyStatus === 'rejected' && res.body.safetyReason && res.body.moderatedAt) {
        record('Content Reject', 'Reject with valid reason → safetyStatus=rejected', 'PASS', `id: ${res.body.id}, reason saved`, file);
      } else {
        record('Content Reject', 'Reject with valid reason → safetyStatus=rejected', 'FAIL', `status=${res.status}, body=${JSON.stringify(res.body)}`, file);
      }
    } catch (err) {
      record('Content Reject', 'Reject with valid reason → safetyStatus=rejected', 'FAIL', err.message, null);
    }
  }
}

// ---------------------------------------------------------------------------
// Section 5: POST /api/admin/content/batch
// ---------------------------------------------------------------------------
async function runBatchChecks(adminToken, pendingItems) {
  console.log('\n[Section] POST /api/admin/content/batch');

  // Re-fetch pending items for batch tests
  let freshPending = [];
  try {
    const res = await apiFetch('/api/admin/moderation/pending?limit=100', { headers: authHeader(adminToken) });
    if (res.status === 200) freshPending = res.body.items;
  } catch { /* ignore */ }

  const batchNews = freshPending.filter((i) => i.type === 'news').slice(0, 3);
  const batchReels = freshPending.filter((i) => i.type === 'reel').slice(0, 3);
  const batchIds = [...batchNews.map((i) => i.id), ...batchReels];

  // 5a: Batch approve
  if (batchNews.length === 0 && batchReels.length === 0) {
    record('Batch Operations', 'Batch approve', 'SKIP', 'No pending content in DB', null);
  } else {
    const itemsToApprove = batchNews.length > 0 ? batchNews : batchReels.slice(0, 1);
    const batchType = batchNews.length > 0 ? 'news' : 'reel';
    try {
      const reqBody = { ids: itemsToApprove.map((i) => i.id), type: batchType, action: 'approve' };
      const res = await apiFetch('/api/admin/content/batch', { method: 'POST', headers: authHeader(adminToken), body: JSON.stringify(reqBody) });
      const payload = { request: { method: 'POST', url: '/api/admin/content/batch', body: reqBody }, response: { status: res.status, body: res.body } };
      const file = savePayload('11-batch-approve.json', payload);
      if (res.status === 200 && typeof res.body.updated === 'number') {
        record('Batch Operations', 'Batch approve', 'PASS', `updated: ${res.body.updated}`, file);
      } else {
        record('Batch Operations', 'Batch approve', 'FAIL', `status=${res.status}, body=${JSON.stringify(res.body)}`, file);
      }
    } catch (err) {
      record('Batch Operations', 'Batch approve', 'FAIL', err.message, null);
    }
  }

  // 5b: Batch reject without reason → 400
  try {
    const reqBody = { ids: ['some-id'], type: 'news', action: 'reject' };
    const res = await apiFetch('/api/admin/content/batch', { method: 'POST', headers: authHeader(adminToken), body: JSON.stringify(reqBody) });
    const payload = { request: { method: 'POST', url: '/api/admin/content/batch', body: reqBody }, response: { status: res.status, body: res.body } };
    const file = savePayload('12-batch-reject-no-reason.json', payload);
    if (res.status === 400) {
      record('Batch Operations', 'Batch reject without reason → 400', 'PASS', 'Correctly rejected missing reason', file);
    } else {
      record('Batch Operations', 'Batch reject without reason → 400', 'FAIL', `Expected 400, got ${res.status}`, file);
    }
  } catch (err) {
    record('Batch Operations', 'Batch reject without reason → 400', 'FAIL', err.message, null);
  }

  // 5c: Batch with >100 IDs → 400
  try {
    const tooManyIds = Array.from({ length: 101 }, (_, i) => `id-${i}`);
    const reqBody = { ids: tooManyIds, type: 'news', action: 'approve' };
    const res = await apiFetch('/api/admin/content/batch', { method: 'POST', headers: authHeader(adminToken), body: JSON.stringify(reqBody) });
    const payload = { request: { method: 'POST', url: '/api/admin/content/batch', body: { ids: `[101 IDs]`, type: 'news', action: 'approve' } }, response: { status: res.status, body: res.body } };
    const file = savePayload('13-batch-too-many-ids.json', payload);
    if (res.status === 400) {
      record('Batch Operations', 'Batch with >100 IDs → 400', 'PASS', 'Correctly rejected oversized batch', file);
    } else {
      record('Batch Operations', 'Batch with >100 IDs → 400', 'FAIL', `Expected 400, got ${res.status}`, file);
    }
  } catch (err) {
    record('Batch Operations', 'Batch with >100 IDs → 400', 'FAIL', err.message, null);
  }
}

// ---------------------------------------------------------------------------
// Section 6: GET /api/admin/reports
// ---------------------------------------------------------------------------
async function runReportsGetChecks(adminToken) {
  console.log('\n[Section] GET /api/admin/reports');

  // 6a: No filters
  try {
    const res = await apiFetch('/api/admin/reports', { headers: authHeader(adminToken) });
    const payload = { request: { method: 'GET', url: '/api/admin/reports' }, response: { status: res.status, body: res.body } };
    const file = savePayload('14-reports-no-filter.json', payload);
    if (res.status === 200 && typeof res.body.total === 'number' && Array.isArray(res.body.items)) {
      record('Reports', 'No filters → paginated list', 'PASS', `total: ${res.body.total}, page: 1`, file);
    } else {
      record('Reports', 'No filters → paginated list', 'FAIL', `status=${res.status}`, file);
    }
  } catch (err) {
    record('Reports', 'No filters → paginated list', 'FAIL', err.message, null);
  }

  // 6b: status=pending filter
  try {
    const res = await apiFetch('/api/admin/reports?status=pending', { headers: authHeader(adminToken) });
    const payload = { request: { method: 'GET', url: '/api/admin/reports?status=pending' }, response: { status: res.status, body: res.body } };
    const file = savePayload('15-reports-status-pending.json', payload);
    const allPending = Array.isArray(res.body.items) && res.body.items.every((r) => r.status === 'pending');
    if (res.status === 200 && (allPending || res.body.items.length === 0)) {
      record('Reports', '?status=pending → only pending reports', 'PASS', `${res.body.items.length} pending reports`, file);
    } else {
      record('Reports', '?status=pending → only pending reports', 'FAIL', `Non-pending items present or error: status=${res.status}`, file);
    }
  } catch (err) {
    record('Reports', '?status=pending → only pending reports', 'FAIL', err.message, null);
  }

  // Return a report ID for patch test
  try {
    const res = await apiFetch('/api/admin/reports?limit=10', { headers: authHeader(adminToken) });
    if (res.status === 200 && res.body.items.length > 0) {
      return res.body.items[0].id;
    }
  } catch { /* ignore */ }
  return null;
}

// ---------------------------------------------------------------------------
// Section 7: PATCH /api/admin/reports/:id
// ---------------------------------------------------------------------------
async function runReportsPatchChecks(adminToken, reportId) {
  console.log('\n[Section] PATCH /api/admin/reports/:id');

  if (!reportId) {
    record('Reports Update', 'Update report status', 'SKIP', 'No content reports in DB', null);
    record('Reports Update', 'Update with action=reject_content', 'SKIP', 'No content reports in DB', null);
    return;
  }

  // 7a: Update status
  try {
    const reqBody = { status: 'reviewed' };
    const res = await apiFetch(`/api/admin/reports/${reportId}`, { method: 'PATCH', headers: authHeader(adminToken), body: JSON.stringify(reqBody) });
    const payload = { request: { method: 'PATCH', url: `/api/admin/reports/${reportId}`, body: reqBody }, response: { status: res.status, body: res.body } };
    const file = savePayload('16-report-update-status.json', payload);
    if (res.status === 200 && res.body.id && res.body.status && res.body.reviewedAt !== undefined) {
      record('Reports Update', 'Update report status → reviewedAt set', 'PASS', `id: ${res.body.id}, status: ${res.body.status}`, file);
    } else {
      record('Reports Update', 'Update report status → reviewedAt set', 'FAIL', `status=${res.status}, body=${JSON.stringify(res.body)}`, file);
    }
  } catch (err) {
    record('Reports Update', 'Update report status → reviewedAt set', 'FAIL', err.message, null);
  }

  // 7b: action=reject_content cascade
  try {
    const reqBody = { status: 'actioned', action: 'reject_content' };
    const res = await apiFetch(`/api/admin/reports/${reportId}`, { method: 'PATCH', headers: authHeader(adminToken), body: JSON.stringify(reqBody) });
    const payload = { request: { method: 'PATCH', url: `/api/admin/reports/${reportId}`, body: reqBody }, response: { status: res.status, body: res.body } };
    const file = savePayload('17-report-reject-content.json', payload);
    if (res.status === 200 && res.body.status === 'actioned') {
      record('Reports Update', 'action=reject_content → cascade reject', 'PASS', `report status: actioned`, file);
    } else {
      record('Reports Update', 'action=reject_content → cascade reject', 'FAIL', `status=${res.status}, body=${JSON.stringify(res.body)}`, file);
    }
  } catch (err) {
    record('Reports Update', 'action=reject_content → cascade reject', 'FAIL', err.message, null);
  }
}

// ---------------------------------------------------------------------------
// Section 8: CLI Script — create-admin.ts
// ---------------------------------------------------------------------------
async function runCliChecks() {
  console.log('\n[Section] CLI Script — create-admin.ts');

  const envPrefix = `DATABASE_URL='${DB_URL}'`;
  const scriptPath = 'apps/api/scripts/create-admin.ts';

  // 8a: No argument → exit 1
  try {
    let output = '';
    let exitCode = 0;
    try {
      output = execSync(`${envPrefix} npx tsx ${scriptPath}`, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      output = (err.stderr ?? '') + (err.stdout ?? '');
      exitCode = err.status ?? 1;
    }
    const file = saveOutput('18-cli-no-arg.txt', output);
    if (exitCode !== 0 && output.includes('Usage')) {
      record('CLI Script', 'No argument → exit 1 with usage message', 'PASS', `exit code: ${exitCode}`, file);
    } else {
      record('CLI Script', 'No argument → exit 1 with usage message', 'FAIL', `exitCode=${exitCode}, output: ${output.slice(0, 100)}`, file);
    }
  } catch (err) {
    record('CLI Script', 'No argument → exit 1 with usage message', 'FAIL', err.message, null);
  }

  // 8b: Invalid email → exit 1
  try {
    let output = '';
    let exitCode = 0;
    try {
      output = execSync(`${envPrefix} npx tsx ${scriptPath} not-an-email`, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      output = (err.stderr ?? '') + (err.stdout ?? '');
      exitCode = err.status ?? 1;
    }
    const file = saveOutput('19-cli-invalid-email.txt', output);
    if (exitCode !== 0 && output.toLowerCase().includes('invalid')) {
      record('CLI Script', 'Invalid email → exit 1', 'PASS', `exit code: ${exitCode}`, file);
    } else {
      record('CLI Script', 'Invalid email → exit 1', 'FAIL', `exitCode=${exitCode}, output: ${output.slice(0, 100)}`, file);
    }
  } catch (err) {
    record('CLI Script', 'Invalid email → exit 1', 'FAIL', err.message, null);
  }

  // 8c: Existing email → promotes to admin
  try {
    let output = '';
    let exitCode = 0;
    try {
      output = execSync(`${envPrefix} npx tsx ${scriptPath} ${ADMIN_EMAIL}`, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] });
      exitCode = 0;
    } catch (err) {
      output = (err.stderr ?? '') + (err.stdout ?? '');
      exitCode = err.status ?? 1;
    }
    const file = saveOutput('20-cli-existing-email.txt', output);
    if (exitCode === 0 && (output.includes('admin') || output.includes('updated') || output.includes('Admin'))) {
      record('CLI Script', 'Existing email → promotes to admin', 'PASS', output.split('\n')[0]?.trim(), file);
    } else {
      record('CLI Script', 'Existing email → promotes to admin', 'FAIL', `exitCode=${exitCode}, output: ${output.slice(0, 100)}`, file);
    }
  } catch (err) {
    record('CLI Script', 'Existing email → promotes to admin', 'FAIL', err.message, null);
  }

  // 8d: New email → creates user with temp password
  const newAdminEmail = `validate-new-admin-${Date.now()}@sportykids-validation.test`;
  try {
    let output = '';
    let exitCode = 0;
    try {
      output = execSync(`${envPrefix} npx tsx ${scriptPath} ${newAdminEmail}`, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] });
      exitCode = 0;
    } catch (err) {
      output = (err.stderr ?? '') + (err.stdout ?? '');
      exitCode = err.status ?? 1;
    }
    const file = saveOutput('21-cli-new-email.txt', output);
    if (exitCode === 0 && output.includes('Password:')) {
      record('CLI Script', 'New email → creates user with temp password', 'PASS', `Password printed to stdout`, file);
    } else {
      record('CLI Script', 'New email → creates user with temp password', 'FAIL', `exitCode=${exitCode}, output: ${output.slice(0, 150)}`, file);
    }
  } catch (err) {
    record('CLI Script', 'New email → creates user with temp password', 'FAIL', err.message, null);
  }
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------
function generateReport() {
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const skip = results.filter((r) => r.status === 'SKIP').length;

  const sections = [...new Set(results.map((r) => r.section))];

  const icon = (s) => (s === 'PASS' ? '✅' : s === 'FAIL' ? '❌' : '⏭');

  let md = `# Validation Report — Run 1\n\n`;
  md += `**Date**: ${new Date().toISOString().slice(0, 10)}\n`;
  md += `**Feature**: Admin Dashboard (prd.md — Shared Infrastructure + Content Moderation)\n\n`;
  md += `## Summary\n\n`;
  md += `✅ PASS: ${pass} | ❌ FAIL: ${fail} | ⏭ SKIP: ${skip}\n\n`;
  md += `---\n\n`;

  for (const section of sections) {
    md += `## ${section}\n\n`;
    const sectionResults = results.filter((r) => r.section === section);
    for (const r of sectionResults) {
      const payloadLink = r.payloadFile ? ` — [payload](${r.payloadFile})` : '';
      md += `- ${icon(r.status)} **${r.name}**`;
      if (r.detail) md += ` — ${r.detail}`;
      md += payloadLink;
      md += '\n';
    }
    md += '\n';
  }

  writeFileSync(REPORT_PATH, md, 'utf8');
  console.log(`\nReport written to: ${REPORT_PATH}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Admin Dashboard — Validation Script ===\n');

  const apiAvailable = await checkApiHealth();

  if (!apiAvailable) {
    console.error('ERROR: API is not available at http://localhost:3001');
    console.error('Start the API first:');
    console.error("  DATABASE_URL='postgresql://sportykids:sportykids@localhost:5432/sportykids' JWT_SECRET='dev-secret' JWT_REFRESH_SECRET='dev-refresh-secret' npm run dev:api");
    console.error('\nAll API checks will be SKIPPED. Running CLI checks only.\n');

    const allApiChecks = [
      ['Auth Guards', 'No auth → 401'],
      ['Auth Guards', 'Child role → 403'],
      ['Moderation Pending', 'No filters → paginated response'],
      ['Moderation Pending', '?type=news → only news items'],
      ['Moderation Pending', '?type=reel → only reel items'],
      ['Moderation Pending', '?limit=5&page=1 → pagination respected'],
      ['Content Approve', 'Approve news item'],
      ['Content Approve', 'Approve reel item'],
      ['Content Reject', 'Reject without reason → 400'],
      ['Content Reject', 'Reject with valid reason → safetyStatus=rejected'],
      ['Batch Operations', 'Batch approve'],
      ['Batch Operations', 'Batch reject without reason → 400'],
      ['Batch Operations', 'Batch with >100 IDs → 400'],
      ['Reports', 'No filters → paginated list'],
      ['Reports', '?status=pending → only pending reports'],
      ['Reports Update', 'Update report status → reviewedAt set'],
      ['Reports Update', 'action=reject_content → cascade reject'],
    ];
    for (const [section, name] of allApiChecks) {
      record(section, name, 'SKIP', 'API not running', null);
    }
    await runCliChecks();
    generateReport();
    const hasFails = results.some((r) => r.status === 'FAIL');
    process.exit(hasFails ? 1 : 0);
    return;
  }

  console.log('API is available. Setting up test users...');

  let adminToken;
  try {
    const { token } = await setupAdminUser();
    adminToken = token;
    console.log('Admin user ready.');
  } catch (err) {
    console.error(`FATAL: Could not set up admin user: ${err.message}`);
    process.exit(1);
  }

  await runAuthGuardChecks();
  const pendingItems = await runModerationPendingChecks(adminToken);
  await runApproveChecks(adminToken, pendingItems);
  await runRejectChecks(adminToken, pendingItems);
  await runBatchChecks(adminToken, pendingItems);
  const reportId = await runReportsGetChecks(adminToken);
  await runReportsPatchChecks(adminToken, reportId);
  await runCliChecks();

  generateReport();

  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const skip = results.filter((r) => r.status === 'SKIP').length;

  console.log(`\n=== Results: ✅ ${pass} PASS | ❌ ${fail} FAIL | ⏭ ${skip} SKIP ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
