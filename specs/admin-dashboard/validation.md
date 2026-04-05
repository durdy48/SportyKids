# Admin Dashboard — Validation Steps (prd.md / S1+S2)

Manual validation checklist for QA / human review after deploying to staging or running locally.

---

## Prerequisites

1. API running at `http://localhost:3001`
2. Web running at `http://localhost:3000`
3. PostgreSQL running with seed data applied
4. Admin user created:
   ```bash
   npx tsx apps/api/scripts/create-admin.ts admin@sportykids.com
   ```

---

## Part A — Infrastructure

### Route Groups
- [ ] `http://localhost:3000/` loads correctly with NavBar and home feed
- [ ] `http://localhost:3000/reels` loads correctly
- [ ] `http://localhost:3000/quiz` loads correctly
- [ ] `http://localhost:3000/parents` loads correctly
- [ ] `http://localhost:3000/organizations` loads correctly
- [ ] `http://localhost:3000/privacy` and `/terms` load correctly
- [ ] Login at `http://localhost:3000/login` works
- [ ] Dark mode toggle works

### NavBar Admin Link
- [ ] Log in as a **non-admin** user → no Admin link in navbar
- [ ] Log in as an **admin** user → "⚙ Admin" link appears in navbar
- [ ] Clicking "⚙ Admin" navigates to `/admin`

### Admin Layout
- [ ] Navigate to `http://localhost:3000/admin` as **non-admin** → redirected to `/`
- [ ] Navigate as **admin** → admin layout with dark sidebar appears
- [ ] Sidebar shows: Overview, Moderation, Analytics, Sources, Jobs, Users & Orgs
- [ ] Active link is highlighted in `bg-slate-800`
- [ ] "Analytics", "Sources", "Jobs", "Users & Orgs" links navigate (404 or placeholder, not crash)

### Admin Overview Page
- [ ] `http://localhost:3000/admin` shows "Admin Overview — Coming soon (prd2.md)" message

---

## Part B — Content Moderation

### Pending Content Tab
1. Navigate to `http://localhost:3000/admin/moderation`
2. [ ] "Pending Content" tab is active by default
3. [ ] Pending news/reel items are listed with TYPE badge, title, sport, pending time
4. [ ] Filtering by Type (news/reel) updates the list
5. [ ] Filtering by sport (e.g. "football") filters results
6. [ ] Approve a single item via [✓] button → item disappears from list
7. [ ] Reject a single item via [✗] button → modal opens for reason
   - [ ] Submit without reason → button disabled
   - [ ] Submit with reason < 3 chars → button disabled
   - [ ] Submit with valid reason → item disappears from list
8. [ ] Select multiple items via checkboxes → "Approve Selected" and "Reject Selected" buttons appear
9. [ ] "Select all" checkbox selects/deselects all visible items
10. [ ] "Approve Selected" bulk-approves all selected items
11. [ ] "Reject Selected" opens modal → confirm → all selected items rejected
12. [ ] Pagination shows when more than 20 items exist

### User Reports Tab
1. Click "User Reports" tab
2. [ ] Reports are listed with Type, Content title, Reason, Status badges
3. [ ] Filter by Status works
4. [ ] Filter by Content Type works
5. [ ] "Reject Content" button on a pending report:
   - [ ] Updates report status to "actioned"
   - [ ] Associated content (news/reel) safetyStatus becomes "rejected"
6. [ ] "Dismiss" button updates report to "dismissed"
7. [ ] Already-actioned/dismissed reports show "—" in Actions column

---

## API Endpoints (curl tests)

Replace `<ADMIN_JWT>` with a valid admin JWT.

```bash
# Get pending items
curl -H "Authorization: Bearer <ADMIN_JWT>" \
  "http://localhost:3001/api/admin/moderation/pending?type=news&limit=5"

# Approve a news item
curl -X PATCH -H "Authorization: Bearer <ADMIN_JWT>" \
  "http://localhost:3001/api/admin/content/news/<NEWS_ID>/approve"

# Reject a reel
curl -X PATCH -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Inappropriate content"}' \
  "http://localhost:3001/api/admin/content/reel/<REEL_ID>/reject"

# Batch approve
curl -X POST -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"ids":["id1","id2"],"type":"news","action":"approve"}' \
  "http://localhost:3001/api/admin/content/batch"

# Get reports
curl -H "Authorization: Bearer <ADMIN_JWT>" \
  "http://localhost:3001/api/admin/reports?status=pending"

# Action a report (reject content)
curl -X PATCH -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"status":"actioned","action":"reject_content"}' \
  "http://localhost:3001/api/admin/reports/<REPORT_ID>"
```

### Auth Guards
```bash
# No auth → 401
curl "http://localhost:3001/api/admin/moderation/pending"

# Non-admin JWT → 403
curl -H "Authorization: Bearer <CHILD_JWT>" \
  "http://localhost:3001/api/admin/moderation/pending"
```

---

## Admin User Creation Script
```bash
# Create new admin user
npx tsx apps/api/scripts/create-admin.ts newadmin@test.com
# Expected: prints email + temporary password

# Promote existing user
npx tsx apps/api/scripts/create-admin.ts existing@test.com
# Expected: "User existing@test.com (id: ...) updated to role='admin'"

# Invalid email
npx tsx apps/api/scripts/create-admin.ts notanemail
# Expected: error + exit code 1

# No argument
npx tsx apps/api/scripts/create-admin.ts
# Expected: usage message + exit code 1
```

---

# Human Validation — prd2.md (Admin Overview Page)

## Prerequisites

1. API running at `http://localhost:3001`
2. Web running at `http://localhost:3000`
3. Admin user logged in at `http://localhost:3000/login`

## Part C — Overview Page

### KPI Cards

1. **Action**: Navigate to `http://localhost:3000/admin`
   **Expected**: 4 cards visible: Total Users, DAU (yesterday), Pending Content, Active RSS Sources — all with numeric values.

2. **Action**: With items in `pending` state (run `UPDATE "NewsItem" SET "safetyStatus"='pending' LIMIT 5`), reload `/admin`.
   **Expected**: "Pending Content" card shows warning border (yellow). Value matches the pending count.

3. **Action**: Set more than 50 items to pending, reload.
   **Expected**: "Pending Content" card shows error border (red).

### Alerts

4. **Action**: With 0 pending items and all RSS sources recently synced, visit `/admin`.
   **Expected**: Green "✓ All systems operational" banner visible above the KPI cards.

5. **Action**: With pending items older than 30 min, visit `/admin`.
   **Expected**: Yellow warning banner: "N items pending moderation for over 30 minutes" with a "View" link to `/admin/moderation`.

6. **Action**: Click the "View" link in an alert banner.
   **Expected**: Navigates to the correct admin section.

### Activity Chart

7. **Action**: Visit `/admin` with some activity data in the DB.
   **Expected**: Area chart renders with 3 colored areas (blue=News, green=Reels, yellow=Quiz). X-axis shows dates formatted as "Mar 15" style.

8. **Action**: Hover over the chart.
   **Expected**: Tooltip appears showing the 3 series values for that day.

9. **Action**: Visit `/admin` on a fresh DB (no activity logs).
   **Expected**: "No activity data yet" message shown instead of chart — no crash.

### Subscription Donut Chart

10. **Action**: Visit `/admin`.
    **Expected**: Donut chart renders with free (gray) and premium (blue) slices. Below shows "free: N | premium: N" counts.

### Last Updated

11. **Action**: Visit `/admin`.
    **Expected**: "Last updated: just now" appears top-right of the page header.

### API Endpoints (curl)

```bash
# Overview
curl -H "Authorization: Bearer <ADMIN_JWT>" http://localhost:3001/api/admin/overview | jq '{kpis,alerts}'

# Activity chart
curl -H "Authorization: Bearer <ADMIN_JWT>" http://localhost:3001/api/admin/analytics/activity-chart | jq 'length'

# Auth guards
curl http://localhost:3001/api/admin/overview                             # → 401
curl -H "Authorization: Bearer <CHILD_JWT>" http://localhost:3001/api/admin/overview  # → 403
```

---

## Appendix A: Re-validation after /t-review #1

*Added after tech debt reduction (2026-04-05). Verifies all review fixes are correct and no regressions exist.*

### C1 — quiz/generate try/catch

1. **Action**: `curl -X POST -H "Authorization: Bearer <ADMIN_JWT>" http://localhost:3001/api/admin/quiz/generate`
   **Expected**: Returns `{"ok":true,"generated":N,"errors":[]}` with status 200. No unhandled exception even if AI is unavailable.

### C2 — Batch reject mixed types

2. **Action**: In the moderation page, select a mix of News and Reel items, then click "Reject Selected" and confirm with a reason.
   **Expected**: Both news and reel items disappear from the list. No items are silently skipped.

### C3 — Pagination shows all pending items

3. **Action**: `curl -H "Authorization: Bearer <ADMIN_JWT>" "http://localhost:3001/api/admin/moderation/pending?limit=5&page=1"`
   **Expected**: `total` reflects the actual count from the database (not capped at 200). `totalPages` is `ceil(total/5)`.

### W1 — API_BASE not duplicated

4. **Action**: Check `apps/web/src/app/(admin)/admin/moderation/page.tsx` — no local `API_BASE` constant.
   **Expected**: File imports `API_BASE` from `@/lib/api` or uses it transitively. Only one definition exists.

### W2 — AdminTable key stability

5. **Action**: In the moderation page, filter by type, then remove the filter.
   **Expected**: Table rows re-render correctly without flickering or duplicating content.

### W4 — create-admin age value

6. **Action**: `DATABASE_URL='...' npx tsx apps/api/scripts/create-admin.ts newtest-$(date +%s)@admin.com`
   **Expected**: User created successfully. Check in DB: `age = 18`.

### W5 — aria-current on sidebar

7. **Action**: Inspect the active sidebar link in DevTools or a screen reader.
   **Expected**: Active link has `aria-current="page"` attribute.

### S2 — Cryptographic temp password

8. **Action**: Create a new admin user and inspect the printed password.
   **Expected**: Password is base64url-encoded (alphanumeric + `-_` chars only), 16 chars. No `\!@#$%` special chars (old Math.random charset).

### S5 — Error state in moderation page

9. **Action**: Stop the API server, then navigate to `/admin/moderation`.
   **Expected**: An error message is shown (e.g., "Failed to load items") instead of an empty table with no feedback.

### Regression check

10. **Action**: Re-run all original validation steps from the main checklist (Part A + Part B + API Endpoints).
    **Expected**: All previously passing checks still pass. No regressions introduced by the tech debt fixes.

---

## Appendix B: Re-validation after /t-review #2 (prd2.md)

*Added after tech debt reduction (2026-04-05). Verifies prd2.md review fixes are correct and no regressions exist.*

### W1 — pending_content alert fires immediately (no 30-min gate)

11. **Action**: `curl -H "Authorization: Bearer <ADMIN_JWT>" http://localhost:3001/api/admin/overview` with at least 1 news item in `pending` status (even if just created).
    **Expected**: `alerts` array contains an item with `type: "pending_content"` and `severity: "warning"`. The message says either `"(newest just arrived)"` (if < 30 min old) or `"for over 30 minutes"` (if > 30 min old). Alert fires regardless of age.

### W2 — stale_rss alert covered by test

12. **Action**: Check `apps/api/src/routes/admin.test.ts` for a test named "includes stale_rss alert when a source has not synced in > 6 hours".
    **Expected**: Test exists and passes. Confirms the `stale_rss` alert fires when `lastSyncedAt` is older than 6 hours.

### W3 — authFetch URL pattern documented

13. **Action**: Open `apps/web/src/app/(admin)/admin/page.tsx` lines 104-107.
    **Expected**: A comment explains why full URLs (with `API_BASE`) are used rather than relative paths.

### W4 — Never-synced RSS sources appear as stale alerts

14. **Action**: `curl -H "Authorization: Bearer <ADMIN_JWT>" http://localhost:3001/api/admin/overview | jq '.alerts | map(select(.type == "stale_rss")) | length'`
    **Expected**: Returns a number > 0 (sources with `lastSyncedAt=null` OR > 6h since last sync now appear as stale alerts).

### S1 — Alert key stability

15. **Action**: Open `apps/web/src/app/(admin)/admin/page.tsx` and find the alerts `.map()`.
    **Expected**: `key` prop is `` `${alert.type}-${alert.message}` `` (not index-based).

### S3 — Donut chart shows with partial data

16. **Action**: In a DB with users only in `free` tier (0 premium), visit `/admin`.
    **Expected**: Donut chart renders (not hidden). "No subscription data" only appears when `totalUsers === 0`.

### Regression check

17. **Action**: Re-run all original validation steps (Part A + Part B + Part C + Appendix A).
    **Expected**: All previously passing checks still pass. No regressions.

---

# Human Validation — prd3.md (Operations & Jobs)

## Prerequisites

Start the test environment:

```bash
bash specs/admin-dashboard/create-environment.sh
```

## Validation Steps

### 1. Jobs page navigation

1. **Action**: Log in as admin and navigate to `http://localhost:3000/admin/jobs`.
   **Expected**: Page loads with a table of 10 jobs. All jobs show `NEVER` status (fresh DB) or real status if cron has run.

2. **Action**: Click on any job name in the table.
   **Expected**: A slide-in drawer appears from the right showing the execution history. If no runs, shows "No runs recorded yet."

3. **Action**: Click the backdrop or press Escape.
   **Expected**: Drawer closes.

### 2. Manual trigger with confirmation

4. **Action**: Click `▶ Run` next to `sync-feeds`.
   **Expected**: A confirmation modal appears with the job name and a "Confirm & Run" button.

5. **Action**: Click `Cancel`.
   **Expected**: Modal closes without triggering the job.

6. **Action**: Click `▶ Run` again, then click `Confirm & Run`.
   **Expected**: Modal closes, the job row briefly shows `⟳ Running` (if the trigger succeeds), and after ~5s the table refreshes with a new run entry.

### 3. History drawer (after trigger)

7. **Action**: After triggering `sync-feeds`, click on its name in the table.
   **Expected**: Drawer shows at least one entry with `cron` or `manual` in the By column, a duration like `4.2s`, and status `SUCCESS` or `ERROR`.

### 4. Stale job alert (manual test)

8. **Action**: In the DB, insert a `JobRun` record for `sync-feeds` with `finishedAt` set to 2 hours ago and `status = 'success'`. Refresh `/admin/jobs`.
   **Expected**: A yellow alert banner appears above the table for `sync-feeds` (expected every 30min, last run 2h ago).

### 5. Status badge variants

9. **Action**: Insert a `JobRun` with `status = 'running'` (no `finishedAt`) for `live-scores`. Refresh.
   **Expected**: `live-scores` row shows a blue `RUNNING` badge. The `▶ Run` button is replaced by `⟳ Running`.

10. **Action**: Insert a `JobRun` with `status = 'error'` for `sync-videos`. Refresh.
    **Expected**: `sync-videos` row shows a red `ERROR` badge.

### 6. Overview page jobs panel

11. **Action**: Navigate to `http://localhost:3000/admin`.
    **Expected**: The Jobs Status section (below KPIs and charts) shows a compact table with all 10 jobs. Each row has a name, status badge, and relative time. A "View all jobs →" link points to `/admin/jobs`.

### 7. API endpoints (curl tests)

12. **Action**: `curl -H "Authorization: Bearer <admin-token>" http://localhost:3001/api/admin/jobs`
    **Expected**: JSON with `{ jobs: [...] }` array of 10 items, each with `name`, `expectedFrequencyMinutes`, `lastRun`, `isStale`, `statusLabel`.

13. **Action**: `curl -X POST -H "Authorization: Bearer <admin-token>" http://localhost:3001/api/admin/jobs/sync-feeds/trigger`
    **Expected**: HTTP 202 with `{ jobRunId: "..." }` or `{ jobRunId: "pending" }`.

14. **Action**: `curl -X POST -H "Authorization: Bearer <admin-token>" http://localhost:3001/api/admin/jobs/fake-job/trigger`
    **Expected**: HTTP 404 with `{ error: "Unknown job: fake-job" }`.

15. **Action**: `curl -H "Authorization: Bearer <admin-token>" http://localhost:3001/api/admin/jobs/sync-feeds/history?limit=5`
    **Expected**: JSON with `{ jobName: "sync-feeds", history: [...] }`, at most 5 items.

### 8. Auth guard

16. **Action**: Call `GET /api/admin/jobs` without Authorization header.
    **Expected**: HTTP 401.

17. **Action**: Call `GET /api/admin/jobs` with a child-role token.
    **Expected**: HTTP 403.

### 9. Regression check

18. **Action**: Re-run all original validation steps (Parts A, B, C, D and previous appendices).
    **Expected**: All previously passing checks still pass. No regressions.

---

## Appendix C: Re-validation after /t-review #3 (prd3.md)

*Added after tech debt reduction (2026-04-05). Verifies all review fixes from prd3.md review are correct and no regressions exist.*

### C1 — GET /jobs query limited (review critical: admin.ts:705)

19. **Action**: `curl -H "Authorization: Bearer <ADMIN_JWT>" http://localhost:3001/api/admin/jobs`
    **Expected**: Returns `{ jobs: [...] }` array of 10 items without hanging or timing out. No unbounded scan.

### C2 — Drawer aria-label valid when closed (review critical: jobs/page.tsx:327)

20. **Action**: Open `apps/web/src/app/(admin)/admin/jobs/page.tsx` and find the `JobHistoryDrawer` component's `aria-label` attribute.
    **Expected**: `aria-label={jobName ? \`${jobName} execution history\` : undefined}` — the label is undefined (not an empty string) when `jobName` is empty. Also confirm `aria-hidden={!isOpen}` is present.

### C3 — Static imports in job-runner (review warning: job-runner.ts:27-49)

21. **Action**: Open `apps/api/src/services/job-runner.ts` and check the import section.
    **Expected**: All 10 job functions are imported statically at module level (`import { runSyncFeeds } from '../jobs/sync-feeds'`, etc.). No `import()` dynamic calls inside `triggerJob`.

### C4 — triggerJob returns deterministic jobRunId (review warning: job-runner.ts:59)

22. **Action**: `curl -X POST -H "Authorization: Bearer <ADMIN_JWT>" http://localhost:3001/api/admin/jobs/sync-feeds/trigger`
    **Expected**: Returns `{ jobRunId: "<real-cuid>" }` — never `{ jobRunId: "pending" }`. No `setTimeout` in the implementation.

### C5 — No (prisma as any) casts remain (review warning: 12 files)

23. **Action**: `grep -r "(prisma as any)" apps/api/src/routes/admin.ts apps/api/src/services/job-runner.ts apps/api/src/jobs/`
    **Expected**: Zero matches. All JobRun operations use `prisma.jobRun` with proper typing.

### C6 — statusLabel ERROR test exists (review warning: admin.test.ts)

24. **Action**: Check `apps/api/src/routes/admin.test.ts` for a test with `statusLabel === 'ERROR'`.
    **Expected**: Test exists and passes. Confirms `GET /jobs` returns `statusLabel: 'ERROR'` and `isStale: false` when the last run has `status: 'error'`.

### C7 — Trigger endpoint rate-limited (review warning: admin.ts:772)

25. **Action**: Open `apps/api/src/routes/admin.ts` and find the `POST /jobs/:name/trigger` route definition.
    **Expected**: `syncLimiter` is imported and appears as middleware in the route: `router.post('/jobs/:name/trigger', requireAuth, requireRole('admin'), syncLimiter, ...)`.

### C8 — JOB_MAP/JOB_FREQUENCIES sync assertion (review suggestion: job-runner.ts:19)

26. **Action**: Open `apps/api/src/services/job-runner.ts` and find the startup assertion after `JOB_MAP`.
    **Expected**: An assertion comparing `Object.keys(JOB_MAP).sort()` with `KNOWN_JOBS.sort()` is present and throws if they diverge (skipped in test env).

### C9 — Polling uses statusLabel (review suggestion: jobs/page.tsx:269)

27. **Action**: Open `apps/web/src/app/(admin)/admin/jobs/page.tsx` and find the polling `useEffect`.
    **Expected**: Condition is `jobs.some(j => j.statusLabel === 'RUNNING')` — not `j.lastRun?.status === 'running'`.

### C10 — aria-live on jobs table (review suggestion: jobs/page.tsx)

28. **Action**: Open `apps/web/src/app/(admin)/admin/jobs/page.tsx` and find the jobs table container div.
    **Expected**: The container has `aria-live="polite"` attribute to announce polling updates to screen readers.

### Regression check

29. **Action**: Re-run all original validation steps (Parts A, B, C, D and Appendices A and B).
    **Expected**: All previously passing checks still pass. No regressions introduced by the tech debt fixes.

---

# Human Validation — prd4.md (Source Management)

## Prerequisites

Start the test environment:

```bash
bash specs/admin-dashboard/create-environment.sh
```

## Validation Steps

### RSS Sources — List & Filters

30. **Action**: Navigate to `/admin/sources` (Sources page in admin sidebar).
    **Expected**: Page loads with two tabs: "RSS Sources" and "Video Sources". RSS tab is active by default. A table shows sources with columns: Name, Sport, Country, Type, Active, Last Sync, News Count, Actions.

31. **Action**: Use the Sport dropdown to filter by "Football".
    **Expected**: Table updates to show only football sources.

32. **Action**: Use the Active filter and select "Active".
    **Expected**: Table shows only sources with `active: true`.

33. **Action**: Use the Active filter and select "Inactive".
    **Expected**: Table shows only sources with `active: false` (or empty if all are active).

34. **Action**: Check the Type column for any predefined source.
    **Expected**: Shows a gray "PREDEFINED" badge. Custom sources show a blue "CUSTOM" badge.

### RSS Sources — Inline Toggle

35. **Action**: Find any active source and uncheck its Active checkbox.
    **Expected**: Checkbox changes to unchecked immediately (optimistic update). Network request to `PATCH /api/admin/sources/rss/:id` with `{active: false}` is made. Source remains unchecked after request completes.

36. **Action**: Re-check the same source's Active checkbox.
    **Expected**: Source becomes active again (optimistic update + PATCH request).

### RSS Sources — Single Sync

37. **Action**: Click the "Sync" button on any RSS source row.
    **Expected**: Button shows a spinner while the sync runs. On completion, the "Last Sync" cell updates to "just now". Button returns to normal state.

### RSS Sources — Add Custom Source

38. **Action**: Click the "+ Add RSS Source" button (or expand the collapsible form).
    **Expected**: A form expands below the table with fields: Name, URL, Sport, Country.

39. **Action**: Fill in a non-RSS URL (e.g., `https://google.com`) and submit.
    **Expected**: Error message appears: "Feed URL is not a valid or reachable RSS feed".

40. **Action**: Fill in valid details with a real RSS URL (e.g., `https://www.marca.com/rss/portada.xml`) and submit.
    **Expected**: New source appears in the table with `CUSTOM` badge and `active: true`.

### RSS Sources — Delete Custom Source

41. **Action**: Find a custom source (CUSTOM badge) and click its "Delete" button.
    **Expected**: A confirmation dialog opens showing "Delete [source name]?" with Cancel and Delete Source buttons.

42. **Action**: Click "Cancel" in the confirmation dialog.
    **Expected**: Dialog closes. Source remains in the table.

43. **Action**: Repeat step 41, then click "Delete Source".
    **Expected**: Dialog closes. Source disappears from the table.

44. **Action**: Find a predefined source (PREDEFINED badge) — verify it has no Delete button.
    **Expected**: No Delete button is shown for predefined sources (only Sync button).

### RSS Sources — Stale Indicator

45. **Action**: Check if any source shows a stale indicator (sources not synced in >2h).
    **Expected**: Stale sources show red text with "⚠" prefix in the Last Sync column.

### Video Sources Tab

46. **Action**: Click the "Video Sources" tab.
    **Expected**: Table switches to video sources with columns: Name, Platform, Sport, Type, Active, Last Sync, Reel Count, Actions.

47. **Action**: Attempt to delete a predefined video source.
    **Expected**: No Delete button visible for predefined sources. If API is called directly, returns 403.

48. **Action**: Click the Active toggle on a video source.
    **Expected**: Active state updates inline (optimistic update + PATCH /api/admin/sources/video/:id).

### Auth Protection

49. **Action**: In a private/incognito window, try accessing `/admin/sources` directly.
    **Expected**: Redirected to login page (or shows 401 if API is called directly without token).

---

## Appendix D: Re-validation after /t-review #4 (prd4.md)

These steps verify the fixes applied after the prd4.md code review. Run these in addition to the original validation steps 30–49.

### D1 — Inactive source guard (review critical: aggregator.ts:285)

50. **Action**: Call `POST /api/admin/sources/rss/:id/sync` with the ID of an **inactive** RSS source (set `active: false` via PATCH first).
    **Expected**: API returns 500 with an error message (source is inactive — sync is blocked).

### D2 — Inactive source guard for video (review critical: video-aggregator.ts:252)

51. **Action**: Call `POST /api/admin/sources/video/:id/sync` with the ID of an **inactive** video source.
    **Expected**: API returns 500 with an error message (source is inactive).

### D3 — Response key is `sources` (review warning: admin.ts:926)

52. **Action**: Call `GET /api/admin/sources/rss` with an admin token.
    **Expected**: Response JSON has key `sources` (array), not `items`. Also verify `GET /api/admin/sources/video` uses `sources`.

### D4 — errors field in sync response (review warning: aggregator.ts:289)

53. **Action**: Trigger a single-source sync via `POST /api/admin/sources/rss/:id/sync`.
    **Expected**: Response contains `{ processed: N, errors: M }` where `errors` reflects actual moderation failures (not always 0).

### D5 — PATCH returns 404 for missing source (review warning: admin.ts:950)

54. **Action**: Call `PATCH /api/admin/sources/rss/nonexistent-id` with `{ active: false }` and an admin token.
    **Expected**: Returns 404 (not 500). Same for `PATCH /api/admin/sources/video/nonexistent-id`.

### D6 — No alert() on sync (review warning: sources/page.tsx:198)

55. **Action**: Click the [Sync] button on any source in the Sources page.
    **Expected**: No browser `alert()` dialog appears. Instead, the "Last Sync" cell updates inline to show the new timestamp.

### D7 — URL validation disables submit button (review suggestion: sources/page.tsx:630)

56. **Action**: Open the "Add RSS Source" form. Enter text in the Name field but leave URL empty or enter an invalid URL (e.g. `not-a-url`).
    **Expected**: The submit button is disabled. Only when a syntactically valid URL (e.g. `https://example.com/rss`) is entered does the button become enabled.

### D8 — Regression check

57. **Action**: Re-run all original validation steps 30–49 for prd4.md Source Management.
    **Expected**: All steps still pass. No regressions introduced by the review fixes.

---

# Human Validation — prd5.md (Analytics Dashboard S3)

## Prerequisites

Start the test environment:

```bash
bash specs/admin-dashboard/create-environment.sh
```

Then navigate to `http://localhost:3000/admin/analytics` (requires admin login).

---

## Validation Steps

### Analytics Sidebar Link

58. **Action**: Log in as admin and look at the AdminSidebar.
    **Expected**: "Analytics" link appears in the sidebar and navigates to `/admin/analytics`.

### Date Range Controls

59. **Action**: Navigate to `/admin/analytics`. Observe the date range buttons.
    **Expected**: Three buttons shown: "Last 7 days", "Last 30 days" (selected by default), "Last 90 days".

60. **Action**: Click "Last 7 days".
    **Expected**: All charts update to show data for the last 7 days. The selected button appears highlighted.

61. **Action**: Click "Last 90 days".
    **Expected**: All charts update to show data for the last 90 days.

### Data Notice

62. **Action**: Observe the text below the date range controls.
    **Expected**: Text reads "Analytics data as of yesterday 2am UTC." is visible.

### Empty State

63. **Action**: If no analytics data exists yet (compute-analytics job has never run), observe the page.
    **Expected**: A friendly empty state message appears: "No analytics data yet. The compute-analytics job runs daily at 2am UTC."

### DAU/MAU Area Chart

64. **Action**: If data exists, observe the DAU/MAU chart.
    **Expected**: Two area series visible — DAU (blue) and MAU (purple). X-axis shows dates, Y-axis shows user counts.

### Retention Bar Chart

65. **Action**: Observe the Retention chart.
    **Expected**: Two grouped bars per date — D1 (green) and D7 (orange). Y-axis shows percentages 0–100%.

### Sport Activity Chart

66. **Action**: Observe the Sport Activity chart.
    **Expected**: Horizontal bars for each sport, sorted by activity count descending.

### Subscription Donut

67. **Action**: Observe the Subscription Breakdown donut chart.
    **Expected**: Two slices — free (slate/gray) and premium (blue). Donut hole visible (innerRadius set).

### Missions Pie

68. **Action**: Observe the Missions chart.
    **Expected**: Two slices — completed (green) and claimed (yellow).

### Metric Cards

69. **Action**: Observe the Parental Activation Rate card.
    **Expected**: Shows a percentage value, a mini progress bar, and secondary text like "X of Y parent accounts".

70. **Action**: Observe the Consent Rate card.
    **Expected**: Shows a percentage value and secondary text like "X of Y users".

71. **Action**: Observe the Quiz Engagement card.
    **Expected**: Shows a percentage value with title "Quiz Engagement (quiz answers / DAU)".

### Top Content Table

72. **Action**: Observe the Top Content table at the bottom.
    **Expected**: AdminTable with columns: Title, Sport (shown as AdminBadge), Published, Views. Sorted by Views descending.

### API Auth Guards

73. **Action**: Call `GET /api/admin/analytics/snapshot` without Authorization header.
    **Expected**: Returns 401.

74. **Action**: Call `GET /api/admin/analytics/snapshot` with a child user's JWT.
    **Expected**: Returns 403.

75. **Action**: Call `GET /api/admin/analytics/top-content` without Authorization header.
    **Expected**: Returns 401.

### compute-analytics Job in Jobs Page

76. **Action**: Navigate to `/admin/jobs`.
    **Expected**: "compute-analytics" job appears in the jobs table with status NEVER (if not yet run) or OK/STALE.

### Error State

77. **Action**: Disconnect the API and navigate to `/admin/analytics` (or reload).
    **Expected**: An error state appears with `role="alert"` and a retry button. No unhandled JavaScript errors in console.

---

## Appendix E: Re-validation after /t-review #5 (prd5.md + /t-reduce-tech-debt)

These additional checks verify the fixes applied during the latest tech debt reduction round. Run them **after** completing the original validation steps (1–77).

### AdminBadge label prop fix (review Critical 1)

78. **Action**: Navigate to `/admin` (Overview page). Look at the subscription breakdown Pie chart legend and the jobs status panel — any items that show a badge/label.
    **Expected**: All status labels are visible (e.g., "OK", "STALE", "NEVER", "Free", "Premium"). No empty/blank badge text.

79. **Action**: Navigate to `/admin/jobs`. Look at the "Status" column in the jobs table.
    **Expected**: Each row shows a non-empty status label ("OK", "STALE", "ERROR", "NEVER", or "RUNNING").

80. **Action**: Open the job history drawer for any job. Look at the status badges in the history list.
    **Expected**: All history entries show a non-empty status badge ("success", "error", or "running").

### sync-feeds STALE threshold fix (review Critical 2)

81. **Action**: Call `GET /api/admin/jobs` and inspect the `sync-feeds` entry's `statusLabel` and `frequency` fields.
    **Expected**: `frequency` is `30` (not `60`). If `sync-feeds` ran more than 60 minutes ago, `statusLabel` is "STALE".

### AdminSidebar "Users & Orgs" link (review Warning 3)

82. **Action**: Navigate to any admin page (e.g., `/admin`). Look at the sidebar navigation.
    **Expected**: Sidebar shows 6 nav items: Overview, Moderation, Analytics, Sources, Jobs, and "Users & Orgs" (displayed with a visual indicator like "(soon)" or reduced opacity since prd6.md is not yet implemented).

### P2025 → 404 on approve/reject (review Warning 4)

83. **Action**: Call `PATCH /api/admin/content/news/nonexistent-id/approve` with an admin JWT.
    **Expected**: Returns 404 (not 500).

84. **Action**: Call `PATCH /api/admin/content/reel/nonexistent-id/reject` with `{ "reason": "test reason" }` and an admin JWT.
    **Expected**: Returns 404 (not 500).

### Cache key consistency (review Warning 6)

85. **Action**: Call `GET /api/admin/overview` twice in quick succession. Check server logs or response headers.
    **Expected**: Second call is served from cache. No functional change, but the cache key should now be `admin:overview` (without trailing colon).

### Refresh button on Overview (review Suggestion 13)

86. **Action**: Navigate to `/admin`. Find the "Refresh" button near the "Last updated" timestamp.
    **Expected**: A "↺ Refresh" button is present. Clicking it re-fetches the overview data without a full page reload.

### Regression check

87. **Action**: Re-run all original validation steps 1–77 (or a representative sample: at least one step from each section).
    **Expected**: All previously passing steps still pass. No regressions introduced by the review fixes.

---

# Human Validation — prd6.md (Users & Organizations)

Prerequisites: API at `http://localhost:3001`, web at `http://localhost:3000`, logged in as admin.

---

## Users & Organizations nav link

1. **Action**: Look at the admin sidebar.
   **Expected**: "Users & Orgs" link is fully opaque (no `opacity-60`), no "(soon)" badge. Clicking it navigates to `/admin/users`.

---

## Users Tab

2. **Action**: Navigate to `/admin/users`. Verify the "Users" tab is active by default.
   **Expected**: Users table is visible. Columns: Email, Role, Tier, Auth Provider, Country, Last Login, Actions.

3. **Action**: Type a partial email in the search input and wait 300ms.
   **Expected**: Table filters to matching users without a page reload. Search is debounced.

4. **Action**: Select "Parent" from the Role dropdown.
   **Expected**: Table shows only users with `role = parent`.

5. **Action**: Select "Premium" from the Tier dropdown.
   **Expected**: Table shows only premium subscribers.

6. **Action**: Observe an empty result (search for a non-existent email).
   **Expected**: Empty state message: "No users found. Try a different search term."

7. **Action**: Click "View" on any user row.
   **Expected**: Navigates to `/admin/users/:id`.

---

## User Detail Page

8. **Action**: On the user detail page, verify the layout.
   **Expected**: Two-column grid with "Account" card (email, role badge, auth provider badge, country, locale, created, last login) and "Subscription & Stats" card (tier badge, streak, stickers, achievements, quiz answers, news viewed).

9. **Action**: If the user has a parental profile, verify Section 2.
   **Expected**: Parental profile card shows hasPin (green/gray badge), scheduleLocked is NOT shown (field not in DB), maxNewsMinutes, allowedSports, allowedFormats.

10. **Action**: Verify the Recent Activity table at the bottom.
    **Expected**: Up to 10 entries with columns: Type, Sport, Content ID, Duration, Date.

11. **Action**: Click "Change Tier" button.
    **Expected**: Modal opens showing user's email, current tier badge, two buttons (free/premium). Warning text: "This overrides RevenueCat data until the next webhook sync."

12. **Action**: Select a different tier in the Change Tier modal and click "Confirm Change".
    **Expected**: Modal closes. Success message appears. Page refreshes with new tier badge.

13. **Action**: Click "Change Role" button.
    **Expected**: Modal opens showing three role options (child/parent/admin). Selecting "admin" shows warning: "Admin role grants full dashboard access."

14. **Action**: Try to change your own role (navigate to your own user detail page, click "Change Role").
    **Expected**: API returns 403. Error message "Cannot change your own role" is shown inline.

15. **Action**: Click "Revoke Sessions" button.
    **Expected**: Confirmation modal: "This will immediately log out [email] from all devices." Has Cancel and "Revoke Sessions" buttons.

16. **Action**: Confirm "Revoke Sessions".
    **Expected**: Modal closes. Success message shows "Revoked N session(s)".

---

## Organizations Tab

17. **Action**: Click the "Organizations" tab on `/admin/users`.
    **Expected**: URL changes to `/admin/users?tab=organizations`. Organizations table shows: Name, Sport badge, Members/Max (e.g., "47/100"), Status badge, Created, Actions.

18. **Action**: Filter by a sport (e.g., "Football").
    **Expected**: Only football organizations are shown.

19. **Action**: Filter by "Inactive" status.
    **Expected**: Only organizations with `active = false` are shown.

20. **Action**: Click "View" on an organization.
    **Expected**: Navigates to `/admin/users/organizations/:id`.

---

## Organization Detail Page

21. **Action**: On the org detail page, verify Section 1 (Org Info).
    **Expected**: Card shows Name, Slug, Sport badge, Status badge, Invite Code with a "📋 Copy" button, Max Members, Member Count, Created date, Creator ID.

22. **Action**: Click the "📋 Copy" button next to the invite code.
    **Expected**: Button text changes to "✓ Copied" for 2 seconds, then reverts. Clipboard contains the invite code.

23. **Action**: Verify Section 2 (Activity chart).
    **Expected**: If there is activity in the last 30 days, an AreaChart is displayed showing daily counts. If no data, shows "No activity data in the last 30 days."

24. **Action**: Verify Section 3 (Members table).
    **Expected**: Table shows: Email, Role badge, Org Role badge, Tier badge, Last Login, Joined date.

25. **Action**: Click "← Back to Organizations".
    **Expected**: Navigates to `/admin/users?tab=organizations` (Organizations tab active).

26. **Action**: Click "Regenerate Invite Code".
    **Expected**: Success message appears. Invite code in the info card updates to the new code immediately without a page reload.

27. **Action**: Click "Deactivate Org" (if active).
    **Expected**: Confirmation modal: "Deactivate [orgName]? Members will no longer be able to use organization features." Has "Cancel" and "Deactivate Org" buttons.

28. **Action**: Confirm deactivation.
    **Expected**: Modal closes. Success message "Organization deactivated". Status badge changes to "Inactive". Button changes to "Reactivate Org".

29. **Action**: Click "Reactivate Org" (if inactive).
    **Expected**: Confirmation modal with reactivation text. On confirm, status returns to "Active".

---

## API Validation

30. **Action**: `GET /api/admin/users` without Bearer token.
    **Expected**: 401.

31. **Action**: `GET /api/admin/users` with child role token.
    **Expected**: 403.

32. **Action**: `PATCH /api/admin/users/:id/tier` with `{ tier: "gold" }`.
    **Expected**: 400 validation error.

33. **Action**: `PATCH /api/admin/organizations/:id` with `{ maxMembers: 1 }` when org has 50 members.
    **Expected**: 400 error "cannot be less than current member count".

34. **Action**: `GET /api/admin/users/nonexistent-id` with admin token.
    **Expected**: 404 "User not found".

35. **Action**: `GET /api/admin/organizations/nonexistent-id` with admin token.
    **Expected**: 404 "Organization not found".

---

## Appendix F: Re-validation after /t-review #6 (prd6.md — Users & Organizations)

36. **Action**: `GET /api/admin/users/:id` with admin token. Check the `parentalProfile` field in the response.
    **Expected**: Response includes `parentalProfile.scheduleLocked` (boolean). For a user with `allowedHoursStart=0` and `allowedHoursEnd=24`, value must be `false`. For restricted hours, value must be `true`.

37. **Action**: `GET /api/admin/users/:id` with admin token. Inspect the raw HTTP response for `passwordHash`.
    **Expected**: The string `passwordHash` does NOT appear anywhere in the response body. Verified by running `curl ... | grep passwordHash` and getting no match.

38. **Action**: As admin (not org member), call `POST /api/admin/organizations/:id/regenerate-code`.
    **Expected**: 200 with `{ inviteCode: "XXXXXX" }` — the admin endpoint works regardless of org membership.

39. **Action**: On the User Detail page (`/admin/users/:id`), look at the Organization field in the Account card.
    **Expected**: The org field renders as a clickable link (not a raw UUID), navigating to `/admin/users/organizations/:orgId`.

40. **Action**: Navigate to `/admin/users/organizations/:id`. Click "Regenerate Invite Code".
    **Expected**: Success message appears and the displayed code updates immediately. Previously this would fail (403) if the admin was not an org member — it should now always succeed.

41. **Action**: On the Organizations tab (`/admin/users?tab=organizations`), check that Sport badges render correctly for all sports including `formula1`.
    **Expected**: All sport badges show without TypeScript errors; `formula1` renders with a red badge (not gray).

42. **Action**: Re-run all original prd6.md validation steps (steps 1–35).
    **Expected**: All steps that passed before still pass. No regressions from the review fixes.
