# Admin Dashboard — Operations & Jobs (S5)
## Product Requirements Document

> **Prerequisite**: Implement `prd.md` (Shared Infrastructure) before this PRD. The jobs table on the Overview page (prd2.md) also depends on `GET /api/admin/jobs` defined here.

---

## Overview

The Jobs section gives admins visibility into all scheduled cron jobs, the ability to trigger them manually, and a full execution history per job. It also introduces persistent job run tracking via a new `JobRun` Prisma model — a capability the Overview page (prd2.md) also consumes for its read-only status panel.

---

## Problem Statement

SportyKids has 10 cron jobs running on various schedules. Currently, there is no way to know:
- When a job last ran successfully.
- Whether a job silently failed.
- How long jobs take to execute.
- Who triggered a manual sync and when.

Debugging requires SSH access to the Fly.io machine and reading Pino logs. The Jobs section replaces this with a persistent audit trail and a manual trigger UI.

---

## Goals

1. Persist execution records for all 10 cron jobs (start time, end time, status, output).
2. Allow admins to trigger any job manually from the UI.
3. Provide per-job execution history (last 20 runs).
4. Surface stale jobs (not run within 2× their expected frequency) as alerts.
5. Enable the Overview page to display job status without this page being open.

---

## Target Users

Internal — SportyKids team members with `role: 'admin'`.

---

## Core Features

### 1. JobRun Prisma Model

**New model** to add to `apps/api/prisma/schema.prisma`:

```prisma
model JobRun {
  id          String    @id @default(cuid())
  jobName     String
  startedAt   DateTime  @default(now())
  finishedAt  DateTime?
  status      String    // 'running' | 'success' | 'error'
  output      Json?     // { processed: number, errors: number, details: string }
  triggeredBy String    @default("cron") // 'cron' | 'manual'
  triggeredId String?   // userId of the admin if triggeredBy === 'manual'

  @@index([jobName, startedAt])
}
```

After adding the model, run:
```bash
npm run db:migrate
```

### 2. Job Instrumentation

**All 10 existing job files** in `apps/api/src/jobs/` must be wrapped with JobRun tracking. The standard pattern:

```typescript
// apps/api/src/jobs/sync-feeds.ts (example)
import { prisma } from '../config/database';

export async function runSyncFeeds(triggeredBy: 'cron' | 'manual' = 'cron', triggeredId?: string) {
  const run = await prisma.jobRun.create({
    data: { jobName: 'sync-feeds', status: 'running', triggeredBy, triggeredId },
  });
  try {
    // existing job logic — extract to a pure function if not already
    const processed = await doSyncFeeds();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: 'success', finishedAt: new Date(), output: { processed, errors: 0 } },
    });
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: 'error', finishedAt: new Date(), output: { error: String(e) } },
    });
    throw e; // re-throw so cron scheduler logs the failure
  }
}
```

**Jobs to instrument** (file → job name string):

| File | `jobName` string |
|------|------------------|
| `apps/api/src/jobs/sync-feeds.ts` | `sync-feeds` |
| `apps/api/src/jobs/sync-videos.ts` | `sync-videos` |
| `apps/api/src/jobs/sync-team-stats.ts` | `sync-team-stats` |
| `apps/api/src/jobs/generate-daily-quiz.ts` | `generate-daily-quiz` |
| `apps/api/src/jobs/generate-daily-missions.ts` | `generate-daily-missions` |
| `apps/api/src/jobs/streak-reminder.ts` | `streak-reminder` |
| `apps/api/src/jobs/mission-reminder.ts` | `mission-reminder` |
| `apps/api/src/jobs/send-weekly-digests.ts` | `send-weekly-digests` |
| `apps/api/src/jobs/live-scores.ts` | `live-scores` |
| `apps/api/src/jobs/generate-timeless-quiz.ts` | `generate-timeless-quiz` |

**Refactoring rule**: If a job file currently runs logic at the module level (via `cron.schedule(...)` directly), extract the job logic into an exported `run*` function. The cron schedule setup calls the exported function. This makes the function importable by the `job-runner.ts` service without starting new cron processes.

### 3. Job Runner Service

**New file**: `apps/api/src/services/job-runner.ts`

Maps job name strings to their exported functions and runs them with `triggeredBy: 'manual'`:

```typescript
import { runSyncFeeds } from '../jobs/sync-feeds';
import { runSyncVideos } from '../jobs/sync-videos';
// ... all 10 imports

const JOB_MAP: Record<string, (triggeredBy: 'cron' | 'manual', triggeredId?: string) => Promise<void>> = {
  'sync-feeds': runSyncFeeds,
  'sync-videos': runSyncVideos,
  'sync-team-stats': runSyncTeamStats,
  'generate-daily-quiz': runGenerateDailyQuiz,
  'generate-daily-missions': runGenerateDailyMissions,
  'streak-reminder': runStreakReminder,
  'mission-reminder': runMissionReminder,
  'send-weekly-digests': runSendWeeklyDigests,
  'live-scores': runLiveScores,
  'generate-timeless-quiz': runGenerateTimelessQuiz,
};

export const KNOWN_JOBS = Object.keys(JOB_MAP);

export async function triggerJob(jobName: string, adminUserId: string): Promise<{ jobRunId: string }> {
  const fn = JOB_MAP[jobName];
  if (!fn) throw new Error(`Unknown job: ${jobName}`);

  // Run async — do not await. JobRun record is created inside the job function.
  fn('manual', adminUserId).catch(err => {
    // Error is already recorded in JobRun by the job's catch block
    logger.error({ jobName, err }, 'Manual job trigger failed');
  });

  // The jobRunId is created inside the job function. For the immediate response,
  // find the most recent 'running' JobRun for this job (created within the last 5s).
  await new Promise(resolve => setTimeout(resolve, 100)); // small delay for DB write
  const run = await prisma.jobRun.findFirst({
    where: { jobName, status: 'running' },
    orderBy: { startedAt: 'desc' },
  });

  return { jobRunId: run?.id ?? 'pending' };
}
```

### 4. Expected Frequencies

Define expected frequency per job (used for STALE detection):

```typescript
// apps/api/src/services/job-runner.ts
export const JOB_FREQUENCIES: Record<string, number> = {
  'sync-feeds': 30,              // every 30 min
  'sync-videos': 360,            // every 6h
  'sync-team-stats': 1440,       // every 24h (4am UTC)
  'generate-daily-quiz': 1440,   // daily 6am UTC
  'generate-timeless-quiz': 1440,// daily
  'generate-daily-missions': 1440,// daily 5am UTC
  'streak-reminder': 1440,       // daily 8pm UTC
  'mission-reminder': 1440,      // daily 6pm UTC
  'send-weekly-digests': 10080,  // weekly (7 days)
  'live-scores': 5,              // every 5 min
};
```

A job is `STALE` when: `now - lastRun.finishedAt > 2 * frequencyMinutes * 60000`.

### 5. Backend Endpoints

All in `apps/api/src/routes/admin.ts`, all require `requireAuth + requireRole('admin')`.

**`GET /api/admin/jobs`**:

Returns status of all 10 known jobs:
```typescript
// For each job in KNOWN_JOBS:
// - Find the most recent JobRun (any status)
// - Compute isStale based on JOB_FREQUENCIES
{
  jobs: Array<{
    name: string;
    expectedFrequencyMinutes: number;
    lastRun: {
      id: string;
      startedAt: string;
      finishedAt: string | null;
      status: 'running' | 'success' | 'error';
      triggeredBy: 'cron' | 'manual';
      output: unknown;
    } | null;
    isStale: boolean;
    statusLabel: 'OK' | 'STALE' | 'ERROR' | 'RUNNING' | 'NEVER';
  }>
}
```

Implementation: one `prisma.jobRun.findMany` with `orderBy: { startedAt: 'desc' }` and `where: { jobName: { in: KNOWN_JOBS } }`, then group by `jobName` and take the first of each group. More efficient than 10 separate queries.

**`POST /api/admin/jobs/:name/trigger`**:

```typescript
// Validates :name is in KNOWN_JOBS (else 404)
// Calls triggerJob(name, req.userId)
// Returns: { jobRunId: string }
// Status 202 Accepted (job runs async)
```

Rate limit: max 2 triggers per minute per admin user to prevent accidental spam.

**`GET /api/admin/jobs/:name/history?limit=20`**:

```typescript
// Validates :name is in KNOWN_JOBS (else 404)
// Returns last N JobRun records for this job, ordered by startedAt desc
// limit: max 50, default 20
{
  jobName: string;
  history: Array<{
    id: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;    // finishedAt - startedAt in ms
    status: string;
    triggeredBy: string;
    output: unknown;
  }>
}
```

---

## UI Mockups (ASCII Art)

### Jobs Page — Main Table

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚙ SportyKids Admin                                                          │
├────────────────┬────────────────────────────────────────────────────────────┤
│  Overview      │  Operations & Jobs                                         │
│  Moderation    │                                                            │
│  Analytics     │  ⚠ send-weekly-digests has not run in 3 days (expected:   │
│  Sources       │     7 days). Last successful run: Mar 28, 2026.           │
│  Jobs      ◀   │                                                            │
│  Users & Orgs  ├────────────────────────────────────────────────────────────┤
│                │ Job Name             │ Last Run    │ Duration │ Status     │
│                │──────────────────────┼─────────────┼──────────┼────────────│
│                │ sync-feeds           │ 2 min ago   │ 4.2s     │ [OK]       │
│                │ sync-videos          │ 3h ago      │ 12.1s    │ [OK]       │
│                │ sync-team-stats      │ 9h ago      │ 8.7s     │ [OK]       │
│                │ generate-daily-quiz  │ 9h ago      │ 3.1s     │ [OK]       │
│                │ generate-timeless-.. │ 9h ago      │ 2.8s     │ [OK]       │
│                │ generate-daily-miss. │ 10h ago     │ 1.9s     │ [OK]       │
│                │ streak-reminder      │ 6h ago      │ 0.5s     │ [OK]       │
│                │ mission-reminder     │ 4h ago      │ 0.6s     │ [OK]       │
│                │ send-weekly-digests  │ 3 days ago  │ 22.4s    │ [STALE]    │
│                │ live-scores          │ 4 min ago   │ 1.2s     │ [OK]       │
│                │──────────────────────┼─────────────┼──────────┼────────────│
│                │                      │             │          │            │
│                │ [▶ Trigger] button is in Actions column (rightmost)        │
└────────────────┴────────────────────────────────────────────────────────────┘
```

### Jobs Table — With Actions Column

```
│ Job Name            │ Last Run   │ Duration │ Status    │ Actions    │
│─────────────────────┼────────────┼──────────┼───────────┼────────────│
│ sync-feeds          │ 2 min ago  │ 4.2s     │ [OK]      │ [▶ Run]   │
│ sync-videos         │ 3h ago     │ 12.1s    │ [OK]      │ [▶ Run]   │
│ live-scores         │ Running... │ —        │ [RUNNING] │ [⟳]       │
│ send-weekly-digests │ 3 days ago │ 22.4s    │ [STALE]   │ [▶ Run]   │
```

### Trigger Confirmation Modal

```
┌─────────────────────────────────────┐
│  Trigger Job                        │
│─────────────────────────────────────│
│  You are about to manually trigger: │
│                                     │
│  sync-feeds                         │
│                                     │
│  This will run immediately and may  │
│  take several seconds to complete.  │
│                                     │
│         [Cancel]  [Confirm & Run]   │
└─────────────────────────────────────┘
```

### Job History Drawer (slide-in from right)

```
┌───────────────────────────────────────────────────────┐
│  sync-feeds — Execution History              [✕ Close] │
│───────────────────────────────────────────────────────│
│ Date              │ Duration │ By    │ Status │ Output  │
│───────────────────┼──────────┼───────┼────────┼─────────│
│ Apr 4 14:30 UTC   │ 4.2s     │ cron  │ [OK]   │ 163 ✓  │
│ Apr 4 14:00 UTC   │ 3.9s     │ cron  │ [OK]   │ 158 ✓  │
│ Apr 4 13:30 UTC   │ 14.2s    │ admin │ [OK]   │ 201 ✓  │
│ Apr 4 13:00 UTC   │ —        │ cron  │ [ERR]  │ ▼ show │
│ Apr 4 12:30 UTC   │ 4.1s     │ cron  │ [OK]   │ 159 ✓  │
│ ...               │          │       │        │        │
│ (showing 20 most recent)                               │
└───────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] `JobRun` model is added to `schema.prisma` and migration runs without errors.
- [ ] All 10 job files export a named `run*` function that accepts `triggeredBy` and optional `triggeredId`.
- [ ] All 10 job files create a `JobRun` record with `status: 'running'` at start.
- [ ] All 10 job files update `JobRun` to `status: 'success'` and `finishedAt` on completion.
- [ ] All 10 job files update `JobRun` to `status: 'error'` and include error message in `output` on failure.
- [ ] `GET /api/admin/jobs` returns exactly 10 entries (one per known job).
- [ ] `GET /api/admin/jobs` returns `statusLabel: 'NEVER'` for a job with no JobRun records.
- [ ] `GET /api/admin/jobs` returns `statusLabel: 'STALE'` when last run is older than 2× frequency.
- [ ] `POST /api/admin/jobs/sync-feeds/trigger` returns 202 with `{ jobRunId }`.
- [ ] `POST /api/admin/jobs/unknown-job/trigger` returns 404.
- [ ] `GET /api/admin/jobs/sync-feeds/history` returns last 20 runs ordered by `startedAt desc`.
- [ ] `GET /api/admin/jobs/sync-feeds/history?limit=5` returns exactly 5 records.
- [ ] Jobs page table renders all 10 jobs with correct status badges.
- [ ] "Trigger" button opens confirmation modal.
- [ ] Confirming trigger shows loading state and updates table on success.
- [ ] While a job is `RUNNING`, its status badge shows `RUNNING` and table polls every 5s.
- [ ] Clicking job name opens history drawer with last 20 executions.
- [ ] `STALE` jobs trigger an alert banner above the table.
- [ ] All endpoints return 401 without auth, 403 without admin role.

---

## Technical Requirements

### New Files

| File | Description |
|------|-------------|
| `apps/api/src/services/job-runner.ts` | Job map, triggerJob(), JOB_FREQUENCIES |
| `apps/web/src/app/(admin)/admin/jobs/page.tsx` | Jobs management page |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `JobRun` model |
| `apps/api/src/routes/admin.ts` | Add jobs endpoints |
| `apps/api/src/jobs/*.ts` | All 10 files: export named function, add JobRun tracking |

### Frontend: Polling Pattern

```typescript
// Poll every 5s while any job is in 'running' status
useEffect(() => {
  let interval: NodeJS.Timeout | null = null;
  const hasRunning = jobs.some(j => j.lastRun?.status === 'running');
  if (hasRunning) {
    interval = setInterval(fetchJobs, 5000);
  }
  return () => { if (interval) clearInterval(interval); };
}, [jobs]);
```

### Frontend: Drawer Component

A slide-in right drawer for job history. Can be implemented as a fixed-position panel with `translate-x-full` → `translate-x-0` CSS transition. No external library needed. Close on Escape key or backdrop click.

```typescript
// Usage
<JobHistoryDrawer
  jobName="sync-feeds"
  isOpen={drawerOpen}
  onClose={() => setDrawerOpen(false)}
/>
```

The drawer fetches `GET /api/admin/jobs/:name/history` when `isOpen` becomes true.

### Duration Computation (Frontend)

```typescript
function formatDuration(run: JobRun): string {
  if (!run.finishedAt) return '—';
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
```

---

## Implementation Decisions

**Why track JobRun in PostgreSQL instead of reading Pino logs?**
Pino logs are ephemeral on Fly.io (lost on machine restart or scale-down). PostgreSQL records persist across deployments. The `JobRun` table also enables querying history (last N runs, error rates) that would be impossible from flat log files.

**Why re-throw the error in the job's catch block?**
The cron scheduler (node-cron) logs job errors via Pino. If we swallow the error in the catch block, the cron scheduler considers the job successful. Re-throwing preserves the existing error logging behaviour while also recording it in the database.

**Why `setTimeout(100ms)` before looking up the jobRunId in `triggerJob`?**
The job function creates the `JobRun` record asynchronously. Without a small delay, the API response races the DB write. 100ms is sufficient for a local DB write. If the race still occurs (edge case), the API returns `{ jobRunId: 'pending' }` and the frontend can look up the actual ID on its next poll.

**Why async trigger with 202 Accepted instead of waiting for the job to finish?**
Jobs like `sync-feeds` can take 30+ seconds. An HTTP request holding the connection that long is fragile (timeouts, network drops). The 202 pattern is the correct REST semantic for "accepted for processing". The admin can observe progress via the polling table.

---

## Testing Decisions

**Unit tests** in `apps/api/src/routes/admin.test.ts`:
- Mock `triggerJob` to test the trigger endpoint without running actual jobs.
- Test `GET /api/admin/jobs` returns correct `statusLabel` values for NEVER/OK/STALE/ERROR states.
- Test `GET /api/admin/jobs/:name/history` respects `limit` param.
- Test unknown job name returns 404 on trigger and history.
- Test 401/403 on all endpoints.

**Integration note**: Do not run actual job logic in tests. The `job-runner.ts` service should be mockable via dependency injection or module mocking (Vitest `vi.mock`).

---

## Out of Scope

- Job scheduling configuration from the UI (cron expressions cannot be changed without redeployment).
- Email alerts when a job fails (logging to Pino + Sentry is sufficient for now).
- Per-job output detail view (the drawer shows `output` as a compact JSON summary).
- Canceling a running job (node-cron does not support mid-run cancellation).

---

## Future Considerations

- Add `errorRate` computed metric per job (errors/total over last 7 days).
- Add Sentry alert integration: if a job fails 3 times in a row, trigger a Sentry issue.
- Add job dependency graph (e.g., `generate-daily-quiz` depends on `sync-feeds`).
- Allow configuring cron schedules from the admin UI (requires a job scheduler abstraction layer).
