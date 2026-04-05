# Admin Dashboard — Overview Home (S1)
## Product Requirements Document

> **Prerequisite**: Implement `prd.md` (Shared Infrastructure) before this PRD. This page depends on `AdminMetricCard`, `AdminSidebar`, the `(admin)` layout, and the `authFetch` client.

---

## Overview

The Overview page is the landing screen at `/admin`. It provides a real-time health snapshot of the SportyKids platform: user counts, engagement activity, content pipeline status, subscription distribution, and job health. It is the first thing an admin sees when they open the dashboard.

---

## Problem Statement

There is no single place to answer the question "is the platform healthy right now?". Admins must query the database directly, check cron logs manually, and review the moderation queue separately. The Overview page aggregates these signals into one screen, enabling fast triage.

---

## Goals

1. Surface critical system alerts (content backlog, stale RSS) so admins can act immediately.
2. Show platform health KPIs without requiring database access.
3. Provide a 30-day activity trend to spot engagement regressions.
4. Surface subscription distribution as a business health indicator.
5. Show job status at a glance with a link to the full Jobs section.

---

## Target Users

Internal — SportyKids team members with `role: 'admin'`.

---

## Core Features

### 1. KPI Cards

Four metric cards displayed in a 2×2 or 4×1 grid using `AdminMetricCard`:

| Card | Data source | Severity rule |
|------|------------|---------------|
| Total Users | `SELECT COUNT(*) FROM "User"` | Normal always |
| DAU (yesterday) | `ActivityLog` distinct userId for yesterday | Warning if 0 |
| Pending Content | `NewsItem` + `Reel` where `safetyStatus = 'pending'` | Warning if > 0 for > 30 min, Error if > 50 |
| Active RSS Sources | `RssSource` where `active = true` | Normal always |

### 2. Activity Area Chart

30-day activity breakdown using Recharts `AreaChart`. Three stacked areas: News Viewed, Reels Viewed, Quizzes Played. Data sourced from `ActivityLog` grouped by day and type.

Chart configuration:
- `XAxis`: formatted date labels (e.g., "Mar 15")
- `YAxis`: auto-scaled
- `Tooltip`: custom tooltip showing all 3 series values for hovered day
- Colors: blue (`#2563EB`) for news, green (`#22C55E`) for reels, yellow (`#FACC15`) for quizzes
- `fillOpacity: 0.2` for area fill, full opacity for strokes

### 3. Subscription Donut Chart

Recharts `PieChart` (donut style via `innerRadius`) showing free vs premium user distribution. Two slices: gray for free, blue for premium. Center label shows total users. Below the chart: two metric rows (`free: N | premium: N`).

### 4. Alerts Section

Rule-based alerts displayed as callout banners. Rendered above the charts. Each alert has:
- Severity icon: ⚠ for warning, ✗ for error
- Message: human-readable description
- Action link (optional): e.g., "Review now →" linking to `/admin/moderation`

Alert rules (evaluated server-side, returned in `/api/admin/overview` response):

```typescript
alerts: [
  // pendingContent > 0: check if oldest pending item is > 30 min old
  { type: 'pending_content', message: 'N items pending moderation for over 30 minutes', severity: 'warning', actionUrl: '/admin/moderation' },
  // pendingContent > 50
  { type: 'pending_content_critical', message: '51 items pending — queue is growing faster than it is cleared', severity: 'error', actionUrl: '/admin/moderation' },
  // Any RssSource with active=true and lastSyncedAt < now - 6h
  { type: 'stale_rss', message: 'Marca RSS source has not synced in 8 hours', severity: 'warning', actionUrl: '/admin/sources' },
]
```

If no alerts: show a green "All systems operational" banner.

### 5. Jobs Status Table (Read-Only)

A compact table showing the last run status of each cron job. This is a read-only preview — the full management interface is at `/admin/jobs` (prd3.md).

Columns: Job Name | Last Run | Time Since | Status Badge | —

Status badge logic (uses `AdminBadge`):
- `green "OK"` — last run was `success` and within expected frequency
- `yellow "STALE"` — last run was `success` but exceeded expected frequency
- `red "ERROR"` — last run status is `error`
- `gray "NEVER"` — no JobRun records for this job yet

> **Note**: The jobs status data comes from `GET /api/admin/jobs` which is defined in `prd3.md`. If `prd3.md` has not been implemented yet, replace this section with a placeholder: `<p className="text-slate-400 text-sm">Jobs panel available after implementing prd3.</p>`

---

## UI Mockups (ASCII Art)

### Overview Page — Full Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚙ SportyKids Admin                                                          │
├────────────────┬────────────────────────────────────────────────────────────┤
│  Overview  ◀   │  Overview                         Last updated: 2 min ago  │
│  Moderation    │                                                            │
│  Analytics     │  ⚠ 12 items pending moderation for over 30 minutes        │
│  Sources       │     Review now →                                           │
│  Jobs          │  ⚠ Marca RSS has not synced in 8 hours                    │
│  Users & Orgs  │     View sources →                                         │
│                │                                                            │
│                │  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌───────┐│
│                │  │ Total Users  │ │   DAU        │ │ Pending  │ │Active ││
│                │  │    4,821     │ │    287       │ │   12     │ │  RSS  ││
│                │  │              │ │ +14 vs prev  │ │ ⚠ warn   │ │  47   ││
│                │  └──────────────┘ └──────────────┘ └──────────┘ └───────┘│
│                │                                                            │
│                │  Activity (last 30 days)          Free vs Premium          │
│                │  ┌────────────────────────────┐   ┌─────────────┐         │
│                │  │                     /\     │   │    (●)      │         │
│                │  │               /\   /  \    │   │  free  85%  │         │
│                │  │          /\  /  \_/    \   │   │  prem  15%  │         │
│                │  │_________/  \/          \__ │   └─────────────┘         │
│                │  │ Mar5  Mar10  Mar15  Mar20   │                           │
│                │  │  ■ News  ■ Reels  ■ Quiz   │                           │
│                │  └────────────────────────────┘                           │
│                │                                                            │
│                │  Jobs Status                                               │
│                │  ┌────────────────────┬────────────┬────────┬────────────┐│
│                │  │ Job                │ Last Run   │ Since  │ Status     ││
│                │  │ sync-feeds         │ 14:30 UTC  │ 28 min │ [OK]       ││
│                │  │ sync-videos        │ 12:00 UTC  │ 3h     │ [OK]       ││
│                │  │ generate-daily-quiz│ 06:00 UTC  │ 9h     │ [OK]       ││
│                │  │ send-weekly-digest │ 3 days ago │ 3d     │ [STALE]    ││
│                │  │ live-scores        │ Never      │ —      │ [NEVER]    ││
│                │  └────────────────────┴────────────┴────────┴────────────┘│
│                │  View all jobs →                                           │
└────────────────┴────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] `GET /api/admin/overview` returns `kpis`, `alerts`, and `subscriptionBreakdown` within 500ms.
- [ ] `GET /api/admin/overview` response is cached for 5 minutes server-side.
- [ ] `GET /api/admin/analytics/activity-chart` returns 30 days of data with `newsViewed`, `reelsViewed`, `quizzesPlayed` keys.
- [ ] `GET /api/admin/analytics/activity-chart` is cached until midnight UTC.
- [ ] Overview page displays all 4 KPI cards with correct values.
- [ ] `pendingContent > 0` triggers a warning alert rendered above the KPI cards.
- [ ] `pendingContent > 50` triggers an error-severity alert.
- [ ] Stale RSS source (no sync in > 6h) appears as a warning alert.
- [ ] Zero alerts renders a green "All systems operational" banner.
- [ ] Area chart renders 3 series with correct colors (blue/green/yellow).
- [ ] Area chart x-axis labels are formatted as month+day (e.g., "Mar 15").
- [ ] Donut chart shows free vs premium split with correct counts.
- [ ] Jobs status table renders (or placeholder if prd3 not yet implemented).
- [ ] "Last updated" timestamp shows how long ago the overview data was fetched.
- [ ] Page does not crash if `alerts` array is empty.
- [ ] Page does not crash if `activity-chart` returns empty array (new system).

---

## Technical Requirements

### New File

| File | Description |
|------|-------------|
| `apps/web/src/app/(admin)/admin/page.tsx` | Overview page (client component) |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/routes/admin.ts` | Add `GET /api/admin/overview` and `GET /api/admin/analytics/activity-chart` |

### Backend: `GET /api/admin/overview`

```typescript
router.get('/overview', requireAuth, requireRole('admin'), async (req, res) => {
  // Cached 5 min via withCache middleware or manual InMemoryCache.get/set
  const [totalUsers, pendingNews, pendingReels, activeSources, subscriptions, oldestPending, staleRss] =
    await Promise.all([
      prisma.user.count(),
      prisma.newsItem.count({ where: { safetyStatus: 'pending' } }),
      prisma.reel.count({ where: { safetyStatus: 'pending' } }),
      prisma.rssSource.count({ where: { active: true } }),
      prisma.user.groupBy({ by: ['subscriptionTier'], _count: true }),
      prisma.newsItem.findFirst({ where: { safetyStatus: 'pending' }, orderBy: { createdAt: 'asc' } }),
      prisma.rssSource.findMany({
        where: { active: true, lastSyncedAt: { lt: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
        select: { name: true, lastSyncedAt: true },
      }),
    ]);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dau = await prisma.activityLog.findMany({
    where: { createdAt: { gte: yesterday, lt: today } },
    select: { userId: true },
    distinct: ['userId'],
  });

  const pendingTotal = pendingNews + pendingReels;
  const alerts = buildAlerts(pendingTotal, oldestPending, staleRss);

  res.json({
    kpis: {
      totalUsers,
      dau: dau.length,
      pendingContent: pendingTotal,
      activeRssSources: activeSources,
    },
    alerts,
    subscriptionBreakdown: {
      free: subscriptions.find(s => s.subscriptionTier === 'free')?._count ?? 0,
      premium: subscriptions.find(s => s.subscriptionTier === 'premium')?._count ?? 0,
    },
  });
});
```

### Backend: `GET /api/admin/analytics/activity-chart`

Query `ActivityLog` grouped by day and type for the last 30 days:

```typescript
// Use raw SQL or Prisma groupBy with date truncation
// Prisma does not natively support date truncation groupBy — use $queryRaw:
const rows = await prisma.$queryRaw<Array<{
  date: string;
  type: string;
  count: bigint;
}>>`
  SELECT DATE_TRUNC('day', "createdAt") AS date, type, COUNT(*) AS count
  FROM "ActivityLog"
  WHERE "createdAt" >= NOW() - INTERVAL '30 days'
  GROUP BY DATE_TRUNC('day', "createdAt"), type
  ORDER BY date ASC
`;

// Transform into: Array<{ date, newsViewed, reelsViewed, quizzesPlayed }>
```

Cache until midnight UTC: compute `ttl = msUntilMidnightUTC()` and pass to the cache provider.

### Frontend: Data Fetching Pattern

```typescript
'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/api';
import { AdminMetricCard } from '@/components/admin/AdminMetricCard';
import { AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState(null);
  const [chart, setChart] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authFetch('/api/admin/overview').then(r => r.json()),
      authFetch('/api/admin/analytics/activity-chart').then(r => r.json()),
    ]).then(([overviewData, chartData]) => {
      setOverview(overviewData);
      setChart(chartData);
      setLoading(false);
    });
  }, []);

  // ... render
}
```

### Chart Color Constants

Define at top of the overview page or in a shared `admin/theme.ts`:

```typescript
export const ADMIN_CHART_COLORS = {
  news: '#2563EB',
  reels: '#22C55E',
  quiz: '#FACC15',
  free: '#475569',
  premium: '#2563EB',
};
```

---

## Implementation Decisions

**Why two separate endpoints (overview + activity-chart) instead of one?**
Cache lifetimes differ: KPI data is cached for 5 minutes (it changes frequently — new users, new pending content). Chart data is cached until midnight (historical data does not change intra-day). Combining them would force both to share the shorter TTL, adding unnecessary database load.

**Why use `$queryRaw` for the activity chart?**
Prisma's `groupBy` does not support date-truncation expressions like `DATE_TRUNC('day', createdAt)`. The alternatives are: (1) fetch all 30 days of raw activity records and group in JavaScript — scales poorly; (2) use `$queryRaw` — precise, uses the database's native date functions. Option 2 is chosen.

**Why show "Time since last run" instead of absolute timestamps in the jobs table?**
Relative time ("28 min ago") is faster to parse at a glance than absolute ISO timestamps. The full history with absolute times is available in the Jobs section (prd3.md).

---

## Testing Decisions

**Unit tests** in `apps/api/src/routes/admin.test.ts`:
- `GET /api/admin/overview` returns correct shape with 0 pending content (no alerts).
- `GET /api/admin/overview` returns `pending_content` alert when items exist for > 30 min.
- `GET /api/admin/analytics/activity-chart` returns array with date + 3 count fields.
- Both endpoints return 401 without auth, 403 without admin role.

**No component tests** for chart rendering — Recharts SVG output is not meaningful to unit test. Manual visual QA is sufficient.

---

## Out of Scope

- Clicking a KPI card to drill down (e.g., clicking "Pending Content" does not navigate to moderation).
- Date range selector on the KPI cards.
- Export to CSV / PDF.
- Email digest of the overview stats.
- Real-time WebSocket updates (polling on-demand is sufficient for an admin tool).

---

## Future Considerations

- Add `MAU` card alongside `DAU`.
- Add "Retention D1/D7" mini-metrics below the activity chart (full retention charts are in prd5.md/Analytics).
- Click-through on alert banners to jump directly to the affected source or content item.
- Configurable alert thresholds (e.g., change the 30-min pending threshold via admin settings).
