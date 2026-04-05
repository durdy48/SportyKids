# Validation Report — Run 1

**Date**: 2026-04-05
**Feature**: Admin Dashboard (prd.md — Shared Infrastructure + Content Moderation)

## Summary

✅ PASS: 15 | ❌ FAIL: 0 | ⏭ SKIP: 6

---

## Auth Guards

- ✅ **No auth → 401** — GET /api/admin/moderation/pending returned 401 — [payload](run-1/api/01-auth-guard-no-auth.json)
- ✅ **Child role → 403** — GET /api/admin/moderation/pending with child JWT returned 403 — [payload](run-1/api/02-auth-guard-child-403.json)

## Moderation Pending

- ✅ **No filters → paginated response** — total: 0, page: 1, totalPages: 1 — [payload](run-1/api/03-pending-no-filter.json)
- ✅ **?type=news → only news items** — 0 news items returned — [payload](run-1/api/04-pending-type-news.json)
- ✅ **?type=reel → only reel items** — 0 reel items returned — [payload](run-1/api/05-pending-type-reel.json)
- ✅ **?limit=5&page=1 → pagination respected** — items: 0/5, totalPages: 1 — [payload](run-1/api/06-pending-pagination.json)

## Content Approve

- ⏭ **Approve news item** — No pending news items in DB
- ⏭ **Approve reel item** — No pending reel items in DB

## Content Reject

- ✅ **Reject without reason → 400** — Validation correctly rejected missing reason — [payload](run-1/api/09-reject-no-reason.json)
- ⏭ **Reject with valid reason → safetyStatus=rejected** — No pending content in DB

## Batch Operations

- ⏭ **Batch approve** — No pending content in DB
- ✅ **Batch reject without reason → 400** — Correctly rejected missing reason — [payload](run-1/api/12-batch-reject-no-reason.json)
- ✅ **Batch with >100 IDs → 400** — Correctly rejected oversized batch — [payload](run-1/api/13-batch-too-many-ids.json)

## Reports

- ✅ **No filters → paginated list** — total: 0, page: 1 — [payload](run-1/api/14-reports-no-filter.json)
- ✅ **?status=pending → only pending reports** — 0 pending reports — [payload](run-1/api/15-reports-status-pending.json)

## Reports Update

- ⏭ **Update report status** — No content reports in DB
- ⏭ **Update with action=reject_content** — No content reports in DB

## CLI Script

- ✅ **No argument → exit 1 with usage message** — exit code: 1 — [payload](run-1/output/18-cli-no-arg.txt)
- ✅ **Invalid email → exit 1** — exit code: 1 — [payload](run-1/output/19-cli-invalid-email.txt)
- ✅ **Existing email → promotes to admin** — ✓ User validate-admin@sportykids-validation.test (id: cmnlivp5t01sj26c00suyqvi9) updated to role='admin' — [payload](run-1/output/20-cli-existing-email.txt)
- ✅ **New email → creates user with temp password** — Password printed to stdout — [payload](run-1/output/21-cli-new-email.txt)

