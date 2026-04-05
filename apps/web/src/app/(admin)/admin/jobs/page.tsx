'use client';

import { useEffect, useState, useCallback } from 'react';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { API_BASE, authFetch } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

interface JobRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  triggeredBy: string;
  output: unknown;
}

interface Job {
  name: string;
  expectedFrequencyMinutes: number;
  lastRun: JobRun | null;
  isStale: boolean;
  statusLabel: 'OK' | 'STALE' | 'ERROR' | 'RUNNING' | 'NEVER';
}

interface HistoryRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: string;
  triggeredBy: string;
  output: unknown;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDurationMs(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function statusVariant(label: string): 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'purple' {
  switch (label) {
    case 'OK':
    case 'SUCCESS': return 'green';
    case 'ERROR': return 'red';
    case 'STALE': return 'yellow';
    case 'RUNNING': return 'blue';
    default: return 'gray';
  }
}

// ─── Job History Drawer ─────────────────────────────────────────────────────

function JobHistoryDrawer({
  jobName,
  isOpen,
  onClose,
}: {
  jobName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<HistoryRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !jobName) return;
    setLoading(true);
    setError(null);
    authFetch(`${API_BASE}/admin/jobs/${jobName}/history`)
      .then(r => r.json())
      .then((data: { history?: HistoryRun[] }) => setHistory(data.history ?? []))
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false));
  }, [isOpen, jobName]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-label={jobName ? `${jobName} execution history` : undefined}
        aria-modal="true"
        aria-hidden={!isOpen}
        className={`fixed top-0 right-0 h-full w-full max-w-xl bg-gray-900 text-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold font-mono">{jobName} — History</h2>
          <button
            onClick={onClose}
            aria-label="Close history drawer"
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && <p className="text-gray-400">Loading…</p>}
          {error && <p role="alert" className="text-red-400">{error}</p>}
          {!loading && !error && history.length === 0 && (
            <p className="text-gray-400">No runs recorded yet.</p>
          )}
          {!loading && !error && history.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2 pr-4">Date (UTC)</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2 pr-4">By</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Output</th>
                </tr>
              </thead>
              <tbody>
                {history.map(run => (
                  <tr key={run.id} className="border-b border-gray-800">
                    <td className="py-2 pr-4 font-mono text-xs">
                      {new Date(run.startedAt).toLocaleString('en-GB', { timeZone: 'UTC', hour12: false })}
                    </td>
                    <td className="py-2 pr-4">
                      {formatDurationMs(run.durationMs)}
                    </td>
                    <td className="py-2 pr-4">{run.triggeredBy}</td>
                    <td className="py-2 pr-4">
                      <AdminBadge variant={statusVariant(run.status.toUpperCase())} label={run.status.toUpperCase()} />
                    </td>
                    <td className="py-2 max-w-xs">
                      <span className="font-mono text-xs text-gray-400 break-all line-clamp-2">
                        {run.output ? JSON.stringify(run.output) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Trigger Confirmation Modal ──────────────────────────────────────────────

function TriggerModal({
  jobName,
  onConfirm,
  onCancel,
}: {
  jobName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trigger job confirmation"
        className="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-2">Trigger Job</h3>
        <p className="text-gray-300 mb-4">
          You are about to manually trigger:
        </p>
        <p className="font-mono text-blue-400 text-lg mb-4">{jobName}</p>
        <p className="text-gray-400 text-sm mb-6">
          This will run immediately and may take several seconds to complete.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Confirm &amp; Run
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);
  const [confirmJob, setConfirmJob] = useState<string | null>(null);
  const [drawerJob, setDrawerJob] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const r = await authFetch(`${API_BASE}/admin/jobs`);
      if (!r.ok) throw new Error('Failed to fetch jobs');
      const data = await r.json() as { jobs?: Job[] };
      setJobs(data.jobs ?? []);
      setError(null);
    } catch {
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  // Poll every 5s while any job is running
  useEffect(() => {
    const hasRunning = jobs.some(j => j.statusLabel === 'RUNNING');
    if (!hasRunning) return;
    const interval = setInterval(() => { void fetchJobs(); }, 5000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  const staleJobs = jobs.filter(j => j.statusLabel === 'STALE');

  const handleTriggerConfirm = async () => {
    if (!confirmJob) return;
    const name = confirmJob;
    setConfirmJob(null);
    setTriggeringJob(name);

    try {
      const r = await authFetch(`${API_BASE}/admin/jobs/${name}/trigger`, { method: 'POST' });
      if (!r.ok) throw new Error('Trigger failed');
      // Refresh after short delay to show running state
      setTimeout(() => { void fetchJobs(); }, 500);
    } catch {
      setError(`Failed to trigger ${name}`);
    } finally {
      setTriggeringJob(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Operations &amp; Jobs</h1>
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Operations &amp; Jobs</h1>

      {error && (
        <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300">
          {error}
        </div>
      )}

      {/* Stale alerts */}
      {staleJobs.map(j => (
        <div
          key={j.name}
          className="mb-3 px-4 py-3 rounded-lg bg-yellow-900/40 border border-yellow-700 text-yellow-300 text-sm"
        >
          ⚠ <span className="font-mono">{j.name}</span> has not run in{' '}
          {j.lastRun?.finishedAt
            ? formatRelativeTime(j.lastRun.finishedAt)
            : 'an unknown time'}{' '}
          (expected every {j.expectedFrequencyMinutes >= 1440
            ? `${j.expectedFrequencyMinutes / 1440}d`
            : `${j.expectedFrequencyMinutes}min`}).
        </div>
      ))}

      {/* Jobs table */}
      <div className="bg-gray-800 rounded-xl overflow-hidden" aria-live="polite" aria-label="Jobs status table">
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="bg-gray-700/50 text-left text-gray-400">
              <th className="px-4 py-3 font-medium">Job Name</th>
              <th className="px-4 py-3 font-medium">Last Run</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.name} className="border-t border-gray-700 hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3">
                  <button
                    onClick={() => setDrawerJob(job.name)}
                    className="font-mono text-blue-400 hover:text-blue-300 hover:underline text-left"
                    aria-label={`View history for ${job.name}`}
                  >
                    {job.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {job.lastRun
                    ? job.lastRun.status === 'running'
                      ? 'Running…'
                      : formatRelativeTime(job.lastRun.startedAt)
                    : <span className="text-gray-500">Never</span>}
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {formatDurationMs(
                    job.lastRun?.finishedAt
                      ? new Date(job.lastRun.finishedAt).getTime() - new Date(job.lastRun.startedAt).getTime()
                      : null
                  )}
                </td>
                <td className="px-4 py-3">
                  <AdminBadge variant={statusVariant(job.statusLabel)} label={job.statusLabel} />
                </td>
                <td className="px-4 py-3">
                  {job.lastRun?.status === 'running' || triggeringJob === job.name ? (
                    <span className="text-gray-500">⟳ Running</span>
                  ) : (
                    <button
                      onClick={() => setConfirmJob(job.name)}
                      aria-label={`Trigger ${job.name}`}
                      className="px-3 py-1 rounded-md bg-blue-700 hover:bg-blue-600 text-white text-xs transition-colors"
                    >
                      ▶ Run
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trigger confirmation modal */}
      {confirmJob && (
        <TriggerModal
          jobName={confirmJob}
          onConfirm={() => { void handleTriggerConfirm(); }}
          onCancel={() => setConfirmJob(null)}
        />
      )}

      {/* History drawer */}
      <JobHistoryDrawer
        jobName={drawerJob ?? ''}
        isOpen={drawerJob !== null}
        onClose={() => setDrawerJob(null)}
      />
    </div>
  );
}
