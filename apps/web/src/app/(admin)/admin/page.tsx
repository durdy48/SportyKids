'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { authFetch, API_BASE } from '@/lib/api';
import { AdminMetricCard } from '@/components/admin/AdminMetricCard';
import { AdminBadge } from '@/components/admin/AdminBadge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewAlert {
  type: string;
  severity: 'warning' | 'error';
  message: string;
  actionUrl: string;
}

interface OverviewData {
  kpis: {
    totalUsers: number;
    dau: number;
    pendingContent: number;
    activeRssSources: number;
  };
  alerts: OverviewAlert[];
  subscriptionBreakdown: {
    free: number;
    premium: number;
  };
}

interface ChartRow {
  date: string;
  newsViewed: number;
  reelsViewed: number;
  quizzesPlayed: number;
}

interface JobSummary {
  name: string;
  expectedFrequencyMinutes: number;
  lastRun: {
    startedAt: string;
    finishedAt: string | null;
    status: string;
  } | null;
  isStale: boolean;
  statusLabel: 'OK' | 'STALE' | 'ERROR' | 'RUNNING' | 'NEVER';
}

// ---------------------------------------------------------------------------
// Chart tooltip
// ---------------------------------------------------------------------------

function ActivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm shadow-lg">
      <p className="text-slate-300 font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Format date for XAxis: "Mar 15"
// ---------------------------------------------------------------------------

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function jobStatusVariant(label: string): 'green' | 'red' | 'yellow' | 'gray' | 'blue' {
  switch (label) {
    case 'OK': return 'green';
    case 'ERROR': return 'red';
    case 'STALE': return 'yellow';
    case 'RUNNING': return 'blue';
    default: return 'gray';
  }
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // authFetch passes the URL as-is (no internal base-URL prepending),
      // so we must always provide the full URL via API_BASE here.
      const [overviewRes, chartRes, jobsRes] = await Promise.all([
        authFetch(`${API_BASE}/admin/overview`),
        authFetch(`${API_BASE}/admin/analytics/activity-chart`),
        authFetch(`${API_BASE}/admin/jobs`),
      ]);

      if (!overviewRes.ok) throw new Error(`Overview fetch failed: ${overviewRes.status}`);
      if (!chartRes.ok) throw new Error(`Chart fetch failed: ${chartRes.status}`);

      const [overviewData, chartRows] = await Promise.all([
        overviewRes.json() as Promise<OverviewData>,
        chartRes.json() as Promise<ChartRow[]>,
      ]);

      setOverview(overviewData);
      setChartData(chartRows);

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json() as { jobs?: JobSummary[] };
        setJobs(jobsData.jobs ?? []);
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-slate-400 text-sm">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
        {error}
      </div>
    );
  }

  if (!overview) return null;

  const { kpis, alerts, subscriptionBreakdown } = overview;

  const PIE_COLORS: Record<string, string> = { Free: '#22c55e', Premium: '#2563EB' };
  const pieData = [
    { name: 'Free', value: subscriptionBreakdown.free },
    { name: 'Premium', value: subscriptionBreakdown.premium },
  ];
  const totalPieUsers = subscriptionBreakdown.free + subscriptionBreakdown.premium;

  const pendingSeverity: 'normal' | 'warning' | 'error' =
    kpis.pendingContent > 50
      ? 'error'
      : kpis.pendingContent > 0
        ? 'warning'
        : 'normal';

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Overview</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <p className="text-xs text-slate-500">
              Last updated:{' '}
              {Math.floor((Date.now() - lastUpdated.getTime()) / 1000) < 5
                ? 'just now'
                : lastUpdated.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={() => void fetchData()}
            disabled={loading}
            aria-label="Refresh dashboard data"
            className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors disabled:opacity-50"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────── */}
      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 bg-green-900/20 border border-green-800 rounded-xl px-4 py-3 text-green-400 text-sm">
          <span>&#10003;</span>
          <span>All systems operational</span>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const isError = alert.severity === 'error';
            return (
              <div
                key={`${alert.type}-${alert.message}`}
                className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
                  isError
                    ? 'bg-red-900/20 border border-red-800 text-red-300'
                    : 'bg-yellow-900/20 border border-yellow-800 text-yellow-300'
                }`}
              >
                <span className="mt-0.5 flex-shrink-0">{isError ? '&#10007;' : '&#9888;'}</span>
                <span className="flex-1">{alert.message}</span>
                <Link
                  href={alert.actionUrl}
                  className={`flex-shrink-0 underline text-xs ${isError ? 'text-red-400' : 'text-yellow-400'}`}
                >
                  View
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <AdminMetricCard title="Total Users" value={kpis.totalUsers} />
        <AdminMetricCard title="DAU (yesterday)" value={kpis.dau} />
        <AdminMetricCard
          title="Pending Content"
          value={kpis.pendingContent}
          severity={pendingSeverity}
        />
        <AdminMetricCard title="Active RSS Sources" value={kpis.activeRssSources} />
      </div>

      {/* ── Charts row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Activity area chart (takes 2/3 width on large screens) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Activity — last 30 days</h2>
          {chartData.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No activity data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatChartDate}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ActivityTooltip />} />
                <Area
                  type="monotone"
                  dataKey="newsViewed"
                  name="News"
                  stroke="#2563EB"
                  fill="#2563EB"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="reelsViewed"
                  name="Reels"
                  stroke="#22C55E"
                  fill="#22C55E"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="quizzesPlayed"
                  name="Quiz"
                  stroke="#FACC15"
                  fill="#FACC15"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Subscription donut chart (takes 1/3 width) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Subscriptions</h2>
          {totalPieUsers === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No subscription data</p>
          ) : (
            <>
              <div style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={62}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={PIE_COLORS[entry.name] ?? '#475569'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: PIE_COLORS['Free'] }} />
                  Free ({subscriptionBreakdown.free})
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: PIE_COLORS['Premium'] }} />
                  Premium ({subscriptionBreakdown.premium})
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Jobs Status ─────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300">Jobs Status</h2>
          <Link href="/admin/jobs" className="text-xs text-blue-400 hover:text-blue-300 underline">
            View all →
          </Link>
        </div>
        {jobs.length === 0 ? (
          <p className="text-slate-500 text-sm">No job data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-300">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800">
                  <th className="pb-2 pr-4 font-medium">Job</th>
                  <th className="pb-2 pr-4 font-medium">Last Run</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.name} className="border-b border-slate-800/50">
                    <td className="py-1.5 pr-4 font-mono">{job.name}</td>
                    <td className="py-1.5 pr-4 text-slate-400">
                      {job.lastRun
                        ? job.lastRun.status === 'running'
                          ? 'Running…'
                          : (() => {
                              const diffMs = Date.now() - new Date(job.lastRun.startedAt).getTime();
                              const diffMin = Math.floor(diffMs / 60_000);
                              if (diffMin < 1) return 'just now';
                              if (diffMin < 60) return `${diffMin}m ago`;
                              const diffH = Math.floor(diffMin / 60);
                              if (diffH < 24) return `${diffH}h ago`;
                              return `${Math.floor(diffH / 24)}d ago`;
                            })()
                        : 'Never'}
                    </td>
                    <td className="py-1.5">
                      <AdminBadge variant={jobStatusVariant(job.statusLabel)} label={job.statusLabel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
