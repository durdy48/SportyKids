'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { authFetch, API_BASE } from '@/lib/api';
import { AdminMetricCard } from '@/components/admin/AdminMetricCard';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { AdminTable, type Column } from '@/components/admin/AdminTable';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsSnapshot {
  date: string;
  metric: string;
  value: Record<string, unknown>;
}

interface TopContentItem {
  contentId: string;
  title: string | null;
  sport: string | null;
  publishedAt: string | null;
  views: number;
}

type DateRange = '7' | '30' | '90';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatChartDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  to.setDate(to.getDate() - 1);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return {
    from: from.toISOString().split('T')[0]!,
    to: to.toISOString().split('T')[0]!,
  };
}

function sportBadgeVariant(sport: string | null): 'blue' | 'green' | 'yellow' | 'purple' | 'gray' {
  if (!sport) return 'gray';
  const map: Record<string, 'blue' | 'green' | 'yellow' | 'purple' | 'gray'> = {
    football: 'green',
    basketball: 'blue',
    tennis: 'yellow',
    formula1: 'red' as 'gray',
    cycling: 'purple',
  };
  return map[sport] ?? 'gray';
}

// ---------------------------------------------------------------------------
// Mini progress bar
// ---------------------------------------------------------------------------

function MiniProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-700">
      <div
        className="h-1.5 rounded-full bg-blue-500"
        style={{ width: `${Math.min(value * 100, 100)}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>('30');
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([]);
  const [topContent, setTopContent] = useState<TopContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRange(days);
      const [snapshotsRes, topContentRes] = await Promise.all([
        authFetch(`${API_BASE}/admin/analytics/snapshot?from=${from}&to=${to}`),
        authFetch(`${API_BASE}/admin/analytics/top-content?from=${from}&to=${to}&limit=10`),
      ]);

      if (!snapshotsRes.ok || !topContentRes.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const [snapshotsData, topContentData] = await Promise.all([
        snapshotsRes.json() as Promise<{ snapshots: AnalyticsSnapshot[] }>,
        topContentRes.json() as Promise<{ items: TopContentItem[] }>,
      ]);

      setSnapshots(snapshotsData.snapshots);
      setTopContent(topContentData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(parseInt(range, 10));
  }, [range, fetchData]);

  // ── Transform snapshots for charts ────────────────────────────────────────

  const dauSnapshots = snapshots.filter((s) => s.metric === 'dau');
  const mauSnapshots = snapshots.filter((s) => s.metric === 'mau');

  // Build merged DAU/MAU chart data
  const dauMauData = dauSnapshots.map((d) => {
    const mau = mauSnapshots.find((m) => m.date === d.date);
    return {
      date: formatChartDate(d.date),
      dau: (d.value as { count: number }).count,
      mau: mau ? (mau.value as { count: number }).count : 0,
    };
  });

  // Retention chart
  const d1Snapshots = snapshots.filter((s) => s.metric === 'retention_d1');
  const d7Snapshots = snapshots.filter((s) => s.metric === 'retention_d7');
  const retentionData = d1Snapshots.map((d1) => {
    const d7 = d7Snapshots.find((d) => d.date === d1.date);
    const d1val = (d1.value as { rate: number }).rate;
    const d7val = d7 ? (d7.value as { rate: number }).rate : 0;
    return {
      date: formatChartDate(d1.date),
      d1: Math.round(d1val * 100),
      d7: Math.round(d7val * 100),
    };
  });

  // Sport activity (sum across date range)
  const sportActivityMap: Record<string, number> = {};
  for (const s of snapshots.filter((s) => s.metric === 'sport_activity')) {
    const val = s.value as Record<string, number>;
    for (const [sport, count] of Object.entries(val)) {
      sportActivityMap[sport] = (sportActivityMap[sport] ?? 0) + count;
    }
  }
  const sportActivityData = Object.entries(sportActivityMap)
    .map(([sport, count]) => ({ sport, count }))
    .sort((a, b) => b.count - a.count);

  // Most recent snapshots for single-value metrics
  const latestSnapshot = (metric: string): AnalyticsSnapshot | undefined => {
    const all = snapshots.filter((s) => s.metric === metric);
    return all[all.length - 1];
  };

  const subBreakdown = latestSnapshot('subscription_breakdown')?.value as
    | { free: number; premium: number }
    | undefined;
  const parentalRate = latestSnapshot('parental_activation_rate')?.value as
    | { rate: number; withParental: number; totalParents: number }
    | undefined;
  const consentRate = latestSnapshot('consent_rate')?.value as
    | { rate: number; consented: number; total: number }
    | undefined;
  const quizEngagement = latestSnapshot('quiz_engagement')?.value as
    | { rate: number; quizAnswered: number; dau: number }
    | undefined;

  // Missions (sum across range)
  const missionsCompleted = snapshots
    .filter((s) => s.metric === 'missions_completed')
    .reduce((acc, s) => acc + (s.value as { count: number }).count, 0);
  const missionsClaimed = snapshots
    .filter((s) => s.metric === 'missions_claimed')
    .reduce((acc, s) => acc + (s.value as { count: number }).count, 0);

  // Subscription pie
  const subPieData = subBreakdown
    ? [
        { name: 'Free', value: subBreakdown.free },
        { name: 'Premium', value: subBreakdown.premium },
      ]
    : [];

  // Missions pie
  const missionsPieData =
    missionsCompleted + missionsClaimed > 0
      ? [
          { name: 'Completed', value: missionsCompleted },
          { name: 'Claimed', value: missionsClaimed },
        ]
      : [];

  // ── Top content table columns ─────────────────────────────────────────────
  const topContentColumns: Column<TopContentItem>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <span className="text-slate-200 line-clamp-2 max-w-xs">
          {row.title ?? <span className="text-slate-500 italic">Untitled</span>}
        </span>
      ),
    },
    {
      key: 'sport',
      header: 'Sport',
      render: (row) => {
        const sport = row.sport;
        return sport ? (
          <AdminBadge label={sport} variant={sportBadgeVariant(sport)} />
        ) : (
          <span className="text-slate-500">—</span>
        );
      },
    },
    {
      key: 'publishedAt',
      header: 'Published',
      render: (row) => {
        const d = row.publishedAt;
        return d ? (
          <span className="text-slate-400">{formatChartDate(d)}</span>
        ) : (
          <span className="text-slate-500">—</span>
        );
      },
    },
    {
      key: 'views',
      header: 'Views',
      render: (row) => (
        <span className="font-semibold text-slate-100">{row.views}</span>
      ),
    },
  ];

  const hasNoData = snapshots.length === 0 && !loading;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">Analytics data as of yesterday 2am UTC.</p>
        </div>

        {/* Date range selector */}
        <div className="flex gap-2" role="group" aria-label="Date range">
          {(['7', '30', '90'] as DateRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                range === r
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Last {r} days
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div role="alert" className="bg-red-900/30 border border-red-800 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-300 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => void fetchData(parseInt(range, 10))}
            className="text-xs text-red-400 hover:text-red-200 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {hasNoData && !error && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-400">No analytics data yet.</p>
          <p className="text-slate-500 text-sm mt-1">
            The compute-analytics job runs daily at 2am UTC.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-24" />
          ))}
        </div>
      )}

      {/* Main content */}
      {!loading && !hasNoData && (
        <>
          {/* Metric cards row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-sm text-slate-400 font-medium">Parental Activation</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">
                {parentalRate ? `${Math.round(parentalRate.rate * 100)}%` : '—'}
              </p>
              {parentalRate && (
                <>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {parentalRate.withParental} of {parentalRate.totalParents} parents
                  </p>
                  <MiniProgressBar value={parentalRate.rate} />
                </>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-sm text-slate-400 font-medium">Consent Rate</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">
                {consentRate ? `${Math.round(consentRate.rate * 100)}%` : '—'}
              </p>
              {consentRate && (
                <>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {consentRate.consented} of {consentRate.total} users
                  </p>
                  <MiniProgressBar value={consentRate.rate} />
                </>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-sm text-slate-400 font-medium">Quiz Engagement</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">
                {quizEngagement ? `${Math.round(quizEngagement.rate * 100)}%` : '—'}
              </p>
              {quizEngagement && (
                <>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {quizEngagement.quizAnswered} quizzes / {quizEngagement.dau} DAU
                  </p>
                  <MiniProgressBar value={quizEngagement.rate} />
                </>
              )}
            </div>
          </div>

          {/* DAU / MAU Chart */}
          {dauMauData.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">DAU / MAU</h2>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dauMauData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="mauGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#94A3B8' }}
                  />
                  <Area type="monotone" dataKey="dau" name="DAU" stroke="#2563EB" fill="url(#dauGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="mau" name="MAU" stroke="#8B5CF6" fill="url(#mauGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Charts row: Retention + Sport Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Retention */}
            {retentionData.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Retention (D1 / D7)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={retentionData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} unit="%" />
                    <YAxis type="category" dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                      formatter={(v) => `${v as number}%`}
                    />
                    <Bar dataKey="d1" name="D1" fill="#22C55E" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="d7" name="D7" fill="#F97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Sport Activity */}
            {sportActivityData.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Sport Activity</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sportActivityData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <XAxis dataKey="sport" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                    />
                    <Bar dataKey="count" name="Activity" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Pie charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subscription Breakdown */}
            {subPieData.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Subscription Breakdown</h2>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={subPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        <Cell fill="#64748B" />
                        <Cell fill="#2563EB" />
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-slate-500" />
                      <span className="text-sm text-slate-400">Free: {subBreakdown?.free ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm text-slate-400">Premium: {subBreakdown?.premium ?? 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Missions Pie */}
            {missionsPieData.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Missions</h2>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={missionsPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        <Cell fill="#22C55E" />
                        <Cell fill="#FACC15" />
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-400" />
                      <span className="text-sm text-slate-400">Completed: {missionsCompleted}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" />
                      <span className="text-sm text-slate-400">Claimed: {missionsClaimed}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top Content Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Top Content</h2>
            <AdminTable
              columns={topContentColumns}
              data={topContent}
              loading={false}
              page={1}
              totalPages={1}
              onPageChange={() => void 0}
              emptyMessage="No content views recorded in this period."
            />
          </div>

          {/* Summary metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {dauMauData.length > 0 && (
              <>
                <AdminMetricCard
                  title="Avg DAU"
                  value={
                    dauMauData.length > 0
                      ? Math.round(dauMauData.reduce((acc, d) => acc + d.dau, 0) / dauMauData.length)
                      : 0
                  }
                />
                <AdminMetricCard
                  title="Latest MAU"
                  value={dauMauData[dauMauData.length - 1]?.mau ?? 0}
                />
              </>
            )}
            <AdminMetricCard
              title="Missions Completed"
              value={missionsCompleted}
            />
            <AdminMetricCard
              title="Missions Claimed"
              value={missionsClaimed}
            />
          </div>
        </>
      )}
    </div>
  );
}
