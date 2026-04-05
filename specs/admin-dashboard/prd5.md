# Admin Dashboard — Analytics (S3)
## Product Requirements Document

> **Prerequisite**: Implement `prd.md` (Shared Infrastructure) before this PRD. This page uses `AdminMetricCard`, `AdminTable`, `AdminBadge`, and `authFetch`.

---

## Overview

The Analytics section provides a comprehensive engagement and business metrics dashboard. Data is pre-computed nightly by a new cron job and stored in an `AnalyticsSnapshot` table, enabling fast reads without expensive real-time aggregations. Charts cover daily/monthly active users, retention curves, sport-specific engagement, subscription health, parental adoption, quiz and missions engagement, and top content.

---

## Problem Statement

There is currently no way to understand how SportyKids is performing as a product. Questions like "What is our Day-1 retention?", "Which sport drives the most engagement?", "How many parents have set up parental controls?", or "Are kids completing their daily missions?" require direct database access and ad-hoc SQL queries. The Analytics section answers these questions with pre-computed, daily-refreshed data.

---

## Goals

1. Pre-compute all engagement metrics nightly to avoid slow real-time queries.
2. Provide DAU/MAU trends over configurable date ranges (7/30/90 days).
3. Surface retention cohort data (D1, D7) as a product health signal.
4. Break down activity by sport to guide content sourcing decisions.
5. Show subscription tier distribution as a business health metric.
6. Track parental activation rate and consent rate for compliance monitoring.
7. Show quiz and mission engagement to evaluate gamification health.
8. Identify top-performing content for editorial decisions.

---

## Target Users

Internal — SportyKids team members with `role: 'admin'`.

---

## Core Features

### 1. AnalyticsSnapshot Prisma Model

**New model** to add to `apps/api/prisma/schema.prisma`:

```prisma
model AnalyticsSnapshot {
  id        String   @id @default(cuid())
  date      DateTime // Day the data represents (truncated to 00:00:00 UTC)
  metric    String   // See metric names below
  value     Json     // Structure varies per metric — see definitions below
  createdAt DateTime @default(now())

  @@unique([date, metric])
  @@index([date])
}
```

After adding: `npm run db:migrate`

### 2. Admin Stats Service

**New file**: `apps/api/src/services/admin-stats.ts`

Pure functions for each metric computation. Imported by the `compute-analytics` job and unit tested independently.

**Metric definitions and `value` shapes**:

| `metric` key | `value` shape | Description |
|---|---|---|
| `dau` | `{ count: number }` | Distinct userId in ActivityLog for the target date |
| `mau` | `{ count: number }` | Distinct userId in ActivityLog for 30 days ending on target date |
| `sport_activity` | `{ football: number, basketball: number, ... }` | Activity count by sport for target date |
| `retention_d1` | `{ rate: number, cohortSize: number }` | % of users registered on (date-1) who were active on date |
| `retention_d7` | `{ rate: number, cohortSize: number }` | % of users registered on (date-7) who were active in date-6..date |
| `subscription_breakdown` | `{ free: number, premium: number }` | Current snapshot of subscriptionTier counts |
| `parental_activation_rate` | `{ rate: number, withParental: number, totalParents: number }` | ParentalProfile count / User[role=parent] count |
| `consent_rate` | `{ rate: number, consented: number, total: number }` | consentGiven=true / total users |
| `quiz_engagement` | `{ rate: number, quizAnswered: number, dau: number }` | quiz_answered activities / DAU |
| `missions_completed` | `{ count: number }` | DailyMission where completed=true for target date |
| `missions_claimed` | `{ count: number }` | DailyMission where claimed=true for target date |

**Function signatures** in `admin-stats.ts`:

```typescript
export async function computeDau(date: Date): Promise<{ count: number }>;
export async function computeMau(date: Date): Promise<{ count: number }>;
export async function computeSportActivity(date: Date): Promise<Record<string, number>>;
export async function computeRetentionD1(date: Date): Promise<{ rate: number; cohortSize: number }>;
export async function computeRetentionD7(date: Date): Promise<{ rate: number; cohortSize: number }>;
export async function computeSubscriptionBreakdown(): Promise<{ free: number; premium: number }>;
export async function computeParentalActivationRate(): Promise<{ rate: number; withParental: number; totalParents: number }>;
export async function computeConsentRate(): Promise<{ rate: number; consented: number; total: number }>;
export async function computeQuizEngagement(date: Date): Promise<{ rate: number; quizAnswered: number; dau: number }>;
export async function computeMissionsCompleted(date: Date): Promise<{ count: number }>;
export async function computeMissionsClaimed(date: Date): Promise<{ count: number }>;
```

All functions use `prisma` from `apps/api/src/config/database.ts`.

**Retention D1 implementation**:

```typescript
export async function computeRetentionD1(date: Date): Promise<{ rate: number; cohortSize: number }> {
  const dayBefore = new Date(date);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(0, 0, 0, 0);
  const dayBeforeEnd = new Date(dayBefore);
  dayBeforeEnd.setHours(23, 59, 59, 999);

  // Users who registered on the previous day
  const cohort = await prisma.user.findMany({
    where: { createdAt: { gte: dayBefore, lte: dayBeforeEnd } },
    select: { id: true },
  });

  if (cohort.length === 0) return { rate: 0, cohortSize: 0 };

  const cohortIds = cohort.map(u => u.id);
  const dateStart = new Date(date); dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date); dateEnd.setHours(23, 59, 59, 999);

  const retained = await prisma.activityLog.findMany({
    where: { userId: { in: cohortIds }, createdAt: { gte: dateStart, lte: dateEnd } },
    select: { userId: true },
    distinct: ['userId'],
  });

  return {
    rate: Math.round((retained.length / cohort.length) * 100) / 100,
    cohortSize: cohort.length,
  };
}
```

### 3. Compute-Analytics Cron Job

**New file**: `apps/api/src/jobs/compute-analytics.ts`

Runs at `0 2 * * *` (2am UTC daily). Computes all metrics for the previous day and upserts into `AnalyticsSnapshot`.

```typescript
export async function runComputeAnalytics(
  triggeredBy: 'cron' | 'manual' = 'cron',
  triggeredId?: string
) {
  const run = await prisma.jobRun.create({
    data: { jobName: 'compute-analytics', status: 'running', triggeredBy, triggeredId },
  });
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const metrics = await Promise.all([
      computeDau(yesterday).then(v => ({ metric: 'dau', value: v })),
      computeMau(yesterday).then(v => ({ metric: 'mau', value: v })),
      computeSportActivity(yesterday).then(v => ({ metric: 'sport_activity', value: v })),
      computeRetentionD1(yesterday).then(v => ({ metric: 'retention_d1', value: v })),
      computeRetentionD7(yesterday).then(v => ({ metric: 'retention_d7', value: v })),
      computeSubscriptionBreakdown().then(v => ({ metric: 'subscription_breakdown', value: v })),
      computeParentalActivationRate().then(v => ({ metric: 'parental_activation_rate', value: v })),
      computeConsentRate().then(v => ({ metric: 'consent_rate', value: v })),
      computeQuizEngagement(yesterday).then(v => ({ metric: 'quiz_engagement', value: v })),
      computeMissionsCompleted(yesterday).then(v => ({ metric: 'missions_completed', value: v })),
      computeMissionsClaimed(yesterday).then(v => ({ metric: 'missions_claimed', value: v })),
    ]);

    for (const { metric, value } of metrics) {
      await prisma.analyticsSnapshot.upsert({
        where: { date_metric: { date: yesterday, metric } },
        update: { value },
        create: { date: yesterday, metric, value },
      });
    }

    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: 'success', finishedAt: new Date(), output: { processed: metrics.length } },
    });
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: 'error', finishedAt: new Date(), output: { error: String(e) } },
    });
    throw e;
  }
}
```

**Register** in `apps/api/src/index.ts`:
```typescript
cron.schedule('0 2 * * *', () => runComputeAnalytics('cron'));
```

Also add `'compute-analytics'` to `KNOWN_JOBS` and `JOB_FREQUENCIES` in `apps/api/src/services/job-runner.ts` (prd3.md):
```typescript
'compute-analytics': 1440, // daily at 2am UTC
```

### 4. Backend Endpoints

All in `apps/api/src/routes/admin.ts`. All require `requireAuth + requireRole('admin')`.

**`GET /api/admin/analytics/snapshot?from=&to=&metrics=`**:

```typescript
// Query params:
//   from: ISO date string (default: 30 days ago)
//   to: ISO date string (default: yesterday)
//   metrics: comma-separated list of metric names (default: all)
//
// Returns:
{
  snapshots: Array<{
    date: string;       // ISO date
    metric: string;
    value: unknown;     // JSON blob as stored
  }>;
  from: string;
  to: string;
}
```

This is a simple select with date range and optional metric filter. No caching needed (Prisma queries on indexed columns are fast).

**`GET /api/admin/analytics/top-content?from=&to=&limit=`**:

Direct query on `ActivityLog` (not pre-computed — fresh data):

```typescript
// Groups ActivityLog by contentId where type = 'news_viewed'
// Joins with NewsItem to get title, sport, publishedAt
// Returns top N by view count
//
// Use $queryRaw for GROUP BY + JOIN:
const rows = await prisma.$queryRaw`
  SELECT al."contentId", COUNT(*) as views, ni.title, ni.sport, ni."publishedAt"
  FROM "ActivityLog" al
  LEFT JOIN "NewsItem" ni ON ni.id = al."contentId"
  WHERE al.type = 'news_viewed'
    AND al."createdAt" >= ${from}
    AND al."createdAt" <= ${to}
    AND al."contentId" IS NOT NULL
  GROUP BY al."contentId", ni.title, ni.sport, ni."publishedAt"
  ORDER BY views DESC
  LIMIT ${limit}
`;

// Returns:
{
  items: Array<{
    contentId: string;
    title: string | null;
    sport: string | null;
    publishedAt: string | null;
    views: number;
  }>;
}
```

Cache for 5 minutes (data doesn't change meaningfully within a session).

### 5. Frontend — Analytics Page

**File**: `apps/web/src/app/(admin)/admin/analytics/page.tsx`

Client component.

**Date range controls**:
Three preset buttons: "Last 7 days", "Last 30 days", "Last 90 days". Default: 30 days. Controls all charts except Top Content (which always shows last 30 days).

**Chart layout** (vertical stack, or 2-column grid on large screens):

1. **DAU/MAU Area Chart** — Recharts `AreaChart`. Two series: DAU (blue, solid) and MAU (purple, dashed). X-axis: formatted dates. Data from snapshots where `metric in ['dau', 'mau']`.

2. **Retention Bar Chart** — Recharts `BarChart`. Two grouped bars per date: D1 (green) and D7 (orange). Y-axis: percentage 0–100%. Data from snapshots where `metric in ['retention_d1', 'retention_d7']`. Tooltip shows cohort size.

3. **Sport Activity Bar Chart** — Recharts `BarChart`. X-axis: sport names. Y-axis: total activity count for selected range. Sum across all days in range per sport. Horizontal layout (sport on Y-axis) for readability.

4. **Subscription Breakdown Donut** — Recharts `PieChart`. Two slices: free (slate) and premium (blue). Uses most recent snapshot for `subscription_breakdown`. Center label: total users.

5. **Parental Activation Rate** — `AdminMetricCard` with value = `${rate * 100}%`. Below: mini progress bar. Secondary text: `${withParental} of ${totalParents} parent accounts`.

6. **Consent Rate** — `AdminMetricCard` with value = `${rate * 100}%`. Secondary text: `${consented} of ${total} users`.

7. **Quiz Engagement** — `AdminMetricCard`. Value: `${rate * 100}%`. Title: "Quiz Engagement (quiz answers / DAU)".

8. **Missions Completed vs Claimed** — Recharts `PieChart`. Two slices: completed (green) and claimed (yellow). Uses sum across selected date range.

9. **Top Content Table** — `AdminTable`. Columns: Title, Sport (badge), Published Date, Views. Data from `GET /api/admin/analytics/top-content`.

**Data as of notice**:
```
"Analytics data as of yesterday 2am UTC. Last computed: <relative time>"
```
Shown below the date range controls.

---

## UI Mockups (ASCII Art)

### Analytics Page — Top Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚙ SportyKids Admin                                                          │
├────────────────┬────────────────────────────────────────────────────────────┤
│  Overview      │  Analytics                                                 │
│  Moderation    │  Data as of yesterday 2am UTC.                             │
│  Analytics ◀   │                                                            │
│  Sources       │  [Last 7 days]  [Last 30 days ●]  [Last 90 days]          │
│  Jobs          │                                                            │
│  Users & Orgs  │  DAU / MAU (last 30 days)                                 │
│                │  ┌──────────────────────────────────────────────────────┐  │
│                │  │         ....MAU....                                  │  │
│                │  │      ___....          ___                            │  │
│                │  │ DAU /    \___________/   \________                  │  │
│                │  │──────────────────────────────────                   │  │
│                │  │ Mar5  Mar10  Mar15  Mar20  Mar25  Mar30              │  │
│                │  │  ■ DAU (blue)   ■ MAU (purple)                      │  │
│                │  └──────────────────────────────────────────────────────┘  │
│                │                                                            │
│                │  Retention Rates                    Subscription Split     │
│                │  ┌───────────────────────────────┐  ┌───────────────────┐  │
│                │  │   ■D1  ■D7                    │  │       (●)         │  │
│                │  │  80%│██░░                     │  │  Free  85%        │  │
│                │  │  60%│██░░  ██░░               │  │  Premium 15%      │  │
│                │  │  40%│                         │  │  Total: 4,821     │  │
│                │  │  20%│      ██░░               │  └───────────────────┘  │
│                │  │─────┴────────────────         │                         │
│                │  │  Mar5   Mar15   Mar25          │                         │
│                │  └───────────────────────────────┘                         │
└────────────────┴────────────────────────────────────────────────────────────┘
```

### Analytics Page — Bottom Section

```
├────────────────┬────────────────────────────────────────────────────────────┤
│                │  Sport Activity (last 30 days)                             │
│                │  Football  ████████████████████ 12,421                    │
│                │  Basketball████████████         6,234                     │
│                │  Tennis    ████████             4,102                     │
│                │  Formula1  ████                 2,018                     │
│                │  Swimming  ██                   1,024                     │
│                │                                                            │
│                │  ┌──────────────────┐ ┌──────────────────┐ ┌────────────┐ │
│                │  │ Parental         │ │ Consent Rate     │ │ Quiz Eng.  │ │
│                │  │ Activation Rate  │ │                  │ │            │ │
│                │  │     68%          │ │     54%          │ │   32%      │ │
│                │  │ 204 of 300 prnts │ │ 2,602 of 4,821   │ │ quiz/DAU   │ │
│                │  │ [■■■■■■■■░░]     │ │ [■■■■■■░░░░]     │ │            │ │
│                │  └──────────────────┘ └──────────────────┘ └────────────┘ │
│                │                                                            │
│                │  Top Content (last 30 days)                                │
│                │  ┌────────────────────────────────────┬──────────┬───────┐ │
│                │  │ Title                              │ Sport    │ Views │ │
│                │  │ Real Madrid win La Liga title      │ Football │  847  │ │
│                │  │ Alcaraz beats Djokovic in final    │ Tennis   │  623  │ │
│                │  │ Verstappen takes pole at Monaco    │ Formula1 │  541  │ │
│                │  └────────────────────────────────────┴──────────┴───────┘ │
└────────────────┴────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] `AnalyticsSnapshot` model is added to `schema.prisma` and migration runs without errors.
- [ ] `@@unique([date, metric])` constraint is present (prevents duplicate entries).
- [ ] `compute-analytics` job is registered in `apps/api/src/index.ts` at cron `0 2 * * *`.
- [ ] `compute-analytics` job creates `JobRun` records (follows prd3.md instrumentation pattern).
- [ ] `compute-analytics` job is listed in `KNOWN_JOBS` and `JOB_FREQUENCIES` (prd3.md).
- [ ] `computeRetentionD1` returns `{ rate: 0, cohortSize: 0 }` when no users registered on previous day.
- [ ] `computeRetentionD7` returns `{ rate: 0, cohortSize: 0 }` when cohort is empty.
- [ ] `upsert` on `AnalyticsSnapshot` does not throw on re-run (idempotent).
- [ ] `GET /api/admin/analytics/snapshot` returns records filtered by date range.
- [ ] `GET /api/admin/analytics/snapshot?metrics=dau,mau` returns only DAU and MAU snapshots.
- [ ] `GET /api/admin/analytics/top-content` returns items ordered by views descending.
- [ ] `GET /api/admin/analytics/top-content?limit=5` returns exactly 5 items.
- [ ] Analytics page renders without errors when no snapshot data exists (empty state).
- [ ] Date range preset buttons update all charts when clicked.
- [ ] DAU/MAU area chart renders two distinct series with different colors.
- [ ] Retention chart renders D1 and D7 bars with tooltip showing cohort size.
- [ ] Sport activity chart renders horizontal bars sorted by count descending.
- [ ] Subscription donut uses most recent snapshot data.
- [ ] Parental activation metric card shows rate as percentage and progress bar.
- [ ] Top content table renders with sport badge and view count.
- [ ] "Data as of yesterday 2am UTC" notice is visible below date controls.
- [ ] All admin endpoints return 401 without auth, 403 without admin role.

---

## Technical Requirements

### New Files

| File | Description |
|------|-------------|
| `apps/api/src/services/admin-stats.ts` | Pure metric computation functions |
| `apps/api/src/jobs/compute-analytics.ts` | Nightly analytics computation job |
| `apps/web/src/app/(admin)/admin/analytics/page.tsx` | Analytics dashboard page |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `AnalyticsSnapshot` model |
| `apps/api/src/routes/admin.ts` | Add snapshot + top-content endpoints |
| `apps/api/src/index.ts` | Register `compute-analytics` cron |
| `apps/api/src/services/job-runner.ts` | Add `compute-analytics` to JOB_MAP + FREQUENCIES |

### Frontend: Data Fetch Pattern

```typescript
// Fetch all metrics for selected range in one call
const [snapshots, topContent] = await Promise.all([
  authFetch(`/api/admin/analytics/snapshot?from=${from}&to=${to}`).then(r => r.json()),
  authFetch(`/api/admin/analytics/top-content?from=${from}&to=${to}&limit=10`).then(r => r.json()),
]);

// Transform snapshots for DAU/MAU chart:
const dauData = snapshots.snapshots
  .filter(s => s.metric === 'dau')
  .map(s => ({ date: formatDate(s.date), value: s.value.count }));
```

### Progress Bar for Metric Cards

Simple inline component (no external library):

```typescript
function MiniProgressBar({ value }: { value: number }) {
  // value: 0-1
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-700">
      <div
        className="h-1.5 rounded-full bg-blue-500"
        style={{ width: `${Math.min(value * 100, 100)}%` }}
      />
    </div>
  );
}
```

### Recharts Configuration for Retention Chart

```typescript
<BarChart data={retentionData} layout="vertical">
  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
  <YAxis type="category" dataKey="date" width={60} />
  <Bar dataKey="d1" name="D1 Retention" fill="#22C55E" barSize={8} />
  <Bar dataKey="d7" name="D7 Retention" fill="#F97316" barSize={8} />
  <Tooltip formatter={(value) => [`${value}%`]} />
</BarChart>
```

---

## Implementation Decisions

**Why pre-compute instead of computing on-demand?**
ActivityLog can grow to millions of rows as the platform scales. Real-time aggregation queries (GROUP BY date, COUNT distinct userId) on large tables take seconds to minutes. Nightly pre-computation moves this cost to 2am UTC when traffic is minimal, and the analytics page loads in milliseconds. The trade-off is D-1 data staleness, which is acceptable for a metrics dashboard.

**Why 2am UTC for the cron?**
ActivityLog entries have UTC timestamps. Computing at 2am UTC ensures that the "yesterday" window (00:00–23:59 UTC) is fully closed regardless of timezone. It also avoids peak API traffic hours (Spain morning / US night).

**Why `@@unique([date, metric])` instead of just storing one row per date?**
Different metrics have different value shapes — there is no single JSON column structure that fits all of them cleanly. A separate row per metric enables independent backfill: if we add a new metric later, we can run it for historical dates without recomputing all other metrics.

**Why is `top-content` not pre-computed?**
Top content changes as users read articles during the day. Pre-computing it nightly would miss today's trending articles. Since the query is bounded (just looking at ActivityLog for a date range with a LIMIT) and cached 5 minutes, the performance cost is acceptable.

**Why no D30 retention metric?**
D30 requires users who registered exactly 30 days ago to have activity in the last 30 days — a meaningful metric but one that requires 30 days of user history to be non-trivially zero. For a new product, D1 and D7 are more actionable. D30 is marked as a future consideration.

---

## Testing Decisions

**Unit tests** in `apps/api/src/services/admin-stats.test.ts`:
- `computeRetentionD1` with empty cohort returns `{ rate: 0, cohortSize: 0 }`.
- `computeRetentionD1` with a 4-user cohort where 2 were active returns `{ rate: 0.5, cohortSize: 4 }`.
- `computeDau` counts only distinct users.
- `computeSportActivity` returns 0 for sports with no activity.
- `computeMissionsCompleted` counts only `completed: true` missions for the target date.

**Integration tests** in `apps/api/src/routes/admin.test.ts`:
- `GET /api/admin/analytics/snapshot` with date range returns only records in range.
- `GET /api/admin/analytics/snapshot?metrics=dau` returns only DAU records.
- `GET /api/admin/analytics/top-content?limit=3` returns exactly 3 items.

---

## Out of Scope

- D30 retention (future consideration).
- Real-time (sub-hourly) metrics updates.
- User cohort analysis (e.g., filter by sport or country).
- Funnel analysis (onboarding step drop-off).
- Revenue metrics (subscription revenue, LTV) — RevenueCat is the source of truth for financial data.
- CSV/PDF export of analytics data.
- Custom date range picker (only presets: 7/30/90 days).

---

## Future Considerations

- Add D30 retention metric once the platform has 30+ days of history.
- Add a "new users" trend line to the DAU/MAU chart.
- Add country-level breakdown (which countries are most active).
- Add funnel analysis: onboarding step → profile complete → first quiz → 7-day return.
- Export analytics snapshot to CSV for external analysis.
- Revenue metrics integration (RevenueCat API → monthly recurring revenue).
