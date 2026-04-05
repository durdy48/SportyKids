'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { authFetch, API_BASE } from '@/lib/api';
import { SPORTS, type Sport } from '@sportykids/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isValidUrl = (u: string): boolean => { try { new URL(u); return true; } catch { return false; } };

// ─── Types ────────────────────────────────────────────────────────────────────

interface RssSource {
  id: string;
  name: string;
  url: string;
  sport: string;
  country: string | null;
  active: boolean;
  isCustom: boolean;
  lastSyncedAt: string | null;
  newsCount: number;
  isStale: boolean;
}

interface VideoSource {
  id: string;
  name: string;
  feedUrl: string;
  platform: string;
  sport: string;
  active: boolean;
  isCustom: boolean;
  lastSyncedAt: string | null;
  reelCount: number;
  isStale: boolean;
}

type Tab = 'rss' | 'video';
type ActiveFilter = 'all' | 'active' | 'inactive';

// ─── Sport badge color helper ─────────────────────────────────────────────────

function sportBadgeVariant(sport: string): 'blue' | 'green' | 'yellow' | 'purple' | 'gray' {
  switch (sport) {
    case 'football': return 'blue';
    case 'basketball': return 'green';
    case 'tennis': return 'yellow';
    case 'formula1': return 'purple';
    default: return 'gray';
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SourcesPage() {
  const [tab, setTab] = useState<Tab>('rss');

  // ── RSS state ──────────────────────────────────────────────────────────────

  const [rssSources, setRssSources] = useState<RssSource[]>([]);
  const [rssTotal, setRssTotal] = useState(0);
  const [rssTotalPages, setRssTotalPages] = useState(1);
  const [rssPage, setRssPage] = useState(1);
  const [rssSportFilter, setRssSportFilter] = useState('');
  const [rssCountryFilter, setRssCountryFilter] = useState('');
  const [rssActiveFilter, setRssActiveFilter] = useState<ActiveFilter>('all');
  const [rssLoading, setRssLoading] = useState(false);
  const [rssSyncing, setRssSyncing] = useState<string | null>(null);

  // ── Video state ────────────────────────────────────────────────────────────

  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [videoTotal, setVideoTotal] = useState(0);
  const [videoTotalPages, setVideoTotalPages] = useState(1);
  const [videoPage, setVideoPage] = useState(1);
  const [videoSportFilter, setVideoSportFilter] = useState('');
  const [videoActiveFilter, setVideoActiveFilter] = useState<ActiveFilter>('all');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoSyncing, setVideoSyncing] = useState<string | null>(null);

  // ── Add form state ─────────────────────────────────────────────────────────

  const [showAddRss, setShowAddRss] = useState(false);
  const [addRssForm, setAddRssForm] = useState({ name: '', url: '', sport: 'football' as Sport, country: '' });
  const [addRssLoading, setAddRssLoading] = useState(false);
  const [addRssError, setAddRssError] = useState('');

  const [showAddVideo, setShowAddVideo] = useState(false);
  const [addVideoForm, setAddVideoForm] = useState({ name: '', feedUrl: '', sport: 'football' as Sport, platform: 'youtube_channel' as 'youtube_channel' | 'youtube_playlist' });
  const [addVideoLoading, setAddVideoLoading] = useState(false);
  const [addVideoError, setAddVideoError] = useState('');

  // ── Delete confirm modal ───────────────────────────────────────────────────

  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string; type: 'rss' | 'video' } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Error banner ───────────────────────────────────────────────────────────

  const [error, setError] = useState('');

  // ─── Fetch RSS Sources ─────────────────────────────────────────────────────

  const fetchRss = useCallback(async () => {
    setRssLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(rssPage), limit: '20' });
      if (rssSportFilter) params.set('sport', rssSportFilter);
      if (rssCountryFilter) params.set('country', rssCountryFilter.toUpperCase());
      if (rssActiveFilter !== 'all') params.set('active', String(rssActiveFilter === 'active'));

      const res = await authFetch(`${API_BASE}/admin/sources/rss?${params}`);
      if (!res.ok) throw new Error('Failed to fetch RSS sources');
      const data = await res.json() as { sources: RssSource[]; total: number; totalPages: number };
      setRssSources(data.sources);
      setRssTotal(data.total);
      setRssTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch RSS sources');
    } finally {
      setRssLoading(false);
    }
  }, [rssPage, rssSportFilter, rssCountryFilter, rssActiveFilter]);

  // ─── Fetch Video Sources ───────────────────────────────────────────────────

  const fetchVideo = useCallback(async () => {
    setVideoLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(videoPage), limit: '20' });
      if (videoSportFilter) params.set('sport', videoSportFilter);
      if (videoActiveFilter !== 'all') params.set('active', String(videoActiveFilter === 'active'));

      const res = await authFetch(`${API_BASE}/admin/sources/video?${params}`);
      if (!res.ok) throw new Error('Failed to fetch video sources');
      const data = await res.json() as { sources: VideoSource[]; total: number; totalPages: number };
      setVideoSources(data.sources);
      setVideoTotal(data.total);
      setVideoTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch video sources');
    } finally {
      setVideoLoading(false);
    }
  }, [videoPage, videoSportFilter, videoActiveFilter]);

  useEffect(() => { if (tab === 'rss') fetchRss(); }, [tab, fetchRss]);
  useEffect(() => { if (tab === 'video') fetchVideo(); }, [tab, fetchVideo]);

  // ─── Toggle Active (RSS) ───────────────────────────────────────────────────

  const toggleRssActive = async (src: RssSource) => {
    // Optimistic update
    setRssSources((prev) => prev.map((s) => s.id === src.id ? { ...s, active: !s.active } : s));
    try {
      const res = await authFetch(`${API_BASE}/admin/sources/rss/${src.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !src.active }),
      });
      if (!res.ok) throw new Error('Update failed');
    } catch {
      // Revert on failure
      setRssSources((prev) => prev.map((s) => s.id === src.id ? { ...s, active: src.active } : s));
      setError('Failed to update source');
    }
  };

  // ─── Toggle Active (Video) ─────────────────────────────────────────────────

  const toggleVideoActive = async (src: VideoSource) => {
    setVideoSources((prev) => prev.map((s) => s.id === src.id ? { ...s, active: !s.active } : s));
    try {
      const res = await authFetch(`${API_BASE}/admin/sources/video/${src.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !src.active }),
      });
      if (!res.ok) throw new Error('Update failed');
    } catch {
      setVideoSources((prev) => prev.map((s) => s.id === src.id ? { ...s, active: src.active } : s));
      setError('Failed to update source');
    }
  };

  // ─── Sync single source ────────────────────────────────────────────────────

  const syncRssSource = async (sourceId: string) => {
    setRssSyncing(sourceId);
    setError('');
    try {
      const res = await authFetch(`${API_BASE}/admin/sources/rss/${sourceId}/sync`, { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      setRssSources(prev => prev.map(s => s.id === sourceId ? { ...s, lastSyncedAt: new Date().toISOString(), isStale: false } : s));
    } catch {
      setError('Failed to sync source');
    } finally {
      setRssSyncing(null);
    }
  };

  const syncVideoSource = async (sourceId: string) => {
    setVideoSyncing(sourceId);
    setError('');
    try {
      const res = await authFetch(`${API_BASE}/admin/sources/video/${sourceId}/sync`, { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      setVideoSources(prev => prev.map(s => s.id === sourceId ? { ...s, lastSyncedAt: new Date().toISOString(), isStale: false } : s));
    } catch {
      setError('Failed to sync source');
    } finally {
      setVideoSyncing(null);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    setError('');
    try {
      const endpoint = deleteModal.type === 'rss'
        ? `${API_BASE}/admin/sources/rss/${deleteModal.id}`
        : `${API_BASE}/admin/sources/video/${deleteModal.id}`;
      const res = await authFetch(endpoint, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDeleteModal(null);
      if (deleteModal.type === 'rss') await fetchRss();
      else await fetchVideo();
    } catch {
      setError('Failed to delete source');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Add RSS Source ────────────────────────────────────────────────────────

  const submitAddRss = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddRssLoading(true);
    setAddRssError('');
    try {
      const res = await authFetch(`${API_BASE}/admin/sources/rss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addRssForm.name,
          url: addRssForm.url,
          sport: addRssForm.sport,
          country: addRssForm.country.toUpperCase(),
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to add source');
      }
      setShowAddRss(false);
      setAddRssForm({ name: '', url: '', sport: 'football', country: '' });
      await fetchRss();
    } catch (err) {
      setAddRssError(err instanceof Error ? err.message : 'Failed to add source');
    } finally {
      setAddRssLoading(false);
    }
  };

  // ─── Add Video Source ──────────────────────────────────────────────────────

  const submitAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddVideoLoading(true);
    setAddVideoError('');
    try {
      const res = await authFetch(`${API_BASE}/admin/sources/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addVideoForm),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to add source');
      }
      setShowAddVideo(false);
      setAddVideoForm({ name: '', feedUrl: '', sport: 'football', platform: 'youtube_channel' });
      await fetchVideo();
    } catch (err) {
      setAddVideoError(err instanceof Error ? err.message : 'Failed to add source');
    } finally {
      setAddVideoLoading(false);
    }
  };

  // ─── Table columns ─────────────────────────────────────────────────────────

  const rssColumns: Column<RssSource>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-100">{row.name}</span>
          {row.isStale && (
            <span className="ml-2 text-red-400 text-xs" title="Source has not synced in over 2 hours">
              ⚠ Stale
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'sport',
      header: 'Sport',
      render: (row) => <AdminBadge label={row.sport} variant={sportBadgeVariant(row.sport)} />,
    },
    {
      key: 'country',
      header: 'Country',
      render: (row) => <span>{row.country ?? '—'}</span>,
    },
    {
      key: 'newsCount',
      header: 'Articles',
      render: (row) => <span className="text-slate-400">{row.newsCount}</span>,
    },
    {
      key: 'lastSyncedAt',
      header: 'Last Sync',
      render: (row) => (
        <span className={row.isStale ? 'text-red-400' : 'text-slate-400'}>
          {row.lastSyncedAt ? new Date(row.lastSyncedAt).toLocaleString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      render: (row) => (
        <input
          type="checkbox"
          checked={row.active}
          onChange={() => toggleRssActive(row)}
          className="w-4 h-4 accent-blue-500 cursor-pointer"
          aria-label={`Toggle ${row.name} active`}
        />
      ),
    },
    {
      key: 'isCustom',
      header: 'Type',
      render: (row) => <AdminBadge label={row.isCustom ? 'Custom' : 'Built-in'} variant={row.isCustom ? 'blue' : 'gray'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={rssSyncing === row.id}
            onClick={() => syncRssSource(row.id)}
            className="px-2 py-1 text-xs rounded border border-slate-600 hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {rssSyncing === row.id ? '…' : 'Sync'}
          </button>
          {row.isCustom && (
            <button
              type="button"
              onClick={() => setDeleteModal({ id: row.id, name: row.name, type: 'rss' })}
              className="px-2 py-1 text-xs rounded border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ];

  const videoColumns: Column<VideoSource>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-100">{row.name}</span>
          {row.isStale && (
            <span className="ml-2 text-red-400 text-xs" title="Source has not synced in over 8 hours">
              ⚠ Stale
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'sport',
      header: 'Sport',
      render: (row) => <AdminBadge label={row.sport} variant={sportBadgeVariant(row.sport)} />,
    },
    {
      key: 'platform',
      header: 'Platform',
      render: (row) => <AdminBadge label={row.platform.replace('_', ' ')} variant="purple" />,
    },
    {
      key: 'reelCount',
      header: 'Reels',
      render: (row) => <span className="text-slate-400">{row.reelCount}</span>,
    },
    {
      key: 'lastSyncedAt',
      header: 'Last Sync',
      render: (row) => (
        <span className={row.isStale ? 'text-red-400' : 'text-slate-400'}>
          {row.lastSyncedAt ? new Date(row.lastSyncedAt).toLocaleString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      render: (row) => (
        <input
          type="checkbox"
          checked={row.active}
          onChange={() => toggleVideoActive(row)}
          className="w-4 h-4 accent-blue-500 cursor-pointer"
          aria-label={`Toggle ${row.name} active`}
        />
      ),
    },
    {
      key: 'isCustom',
      header: 'Type',
      render: (row) => <AdminBadge label={row.isCustom ? 'Custom' : 'Built-in'} variant={row.isCustom ? 'blue' : 'gray'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={videoSyncing === row.id}
            onClick={() => syncVideoSource(row.id)}
            className="px-2 py-1 text-xs rounded border border-slate-600 hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {videoSyncing === row.id ? '…' : 'Sync'}
          </button>
          {row.isCustom && (
            <button
              type="button"
              onClick={() => setDeleteModal({ id: row.id, name: row.name, type: 'video' })}
              className="px-2 py-1 text-xs rounded border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Content Sources</h1>
      </div>

      {error && (
        <div role="alert" className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 bg-slate-800/50 p-1 rounded-lg w-fit">
        {(['rss', 'video'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'rss' ? 'RSS Sources' : 'Video Sources'}
          </button>
        ))}
      </div>

      {/* ── RSS Tab ── */}
      {tab === 'rss' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sport</label>
              <select
                value={rssSportFilter}
                onChange={(e) => { setRssSportFilter(e.target.value); setRssPage(1); }}
                className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">All sports</option>
                {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Country</label>
              <input
                type="text"
                maxLength={2}
                placeholder="e.g. ES"
                value={rssCountryFilter}
                onChange={(e) => { setRssCountryFilter(e.target.value); setRssPage(1); }}
                className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm w-20"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select
                value={rssActiveFilter}
                onChange={(e) => { setRssActiveFilter(e.target.value as ActiveFilter); setRssPage(1); }}
                className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="ml-auto">
              <span className="text-sm text-slate-400">{rssTotal} sources</span>
            </div>
          </div>

          <AdminTable<RssSource>
            columns={rssColumns}
            data={rssSources}
            loading={rssLoading}
            page={rssPage}
            totalPages={rssTotalPages}
            onPageChange={setRssPage}
            emptyMessage="No RSS sources found."
          />

          {/* Add RSS Source form */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAddRss((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 text-slate-300 hover:text-white text-sm font-medium transition-colors"
            >
              <span>Add Custom RSS Source</span>
              <span>{showAddRss ? '▲' : '▼'}</span>
            </button>
            {showAddRss && (
              <form onSubmit={submitAddRss} className="px-4 py-4 space-y-3 bg-slate-900">
                {addRssError && (
                  <p className="text-red-400 text-sm">{addRssError}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Name *</label>
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={addRssForm.name}
                      onChange={(e) => setAddRssForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Source name"
                      className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Feed URL *</label>
                    <input
                      required
                      type="url"
                      value={addRssForm.url}
                      onChange={(e) => setAddRssForm((f) => ({ ...f, url: e.target.value }))}
                      placeholder="https://example.com/rss"
                      className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Sport *</label>
                    <select
                      value={addRssForm.sport}
                      onChange={(e) => setAddRssForm((f) => ({ ...f, sport: e.target.value as Sport }))}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Country (2-letter ISO) *</label>
                    <input
                      required
                      minLength={2}
                      maxLength={2}
                      value={addRssForm.country}
                      onChange={(e) => setAddRssForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))}
                      placeholder="ES"
                      className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowAddRss(false); setAddRssError(''); }}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addRssLoading || !addRssForm.name || !addRssForm.url || !addRssForm.sport || !addRssForm.country || !isValidUrl(addRssForm.url)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    {addRssLoading ? 'Validating…' : 'Add Source'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Video Tab ── */}
      {tab === 'video' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sport</label>
              <select
                value={videoSportFilter}
                onChange={(e) => { setVideoSportFilter(e.target.value); setVideoPage(1); }}
                className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">All sports</option>
                {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select
                value={videoActiveFilter}
                onChange={(e) => { setVideoActiveFilter(e.target.value as ActiveFilter); setVideoPage(1); }}
                className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="ml-auto">
              <span className="text-sm text-slate-400">{videoTotal} sources</span>
            </div>
          </div>

          <AdminTable<VideoSource>
            columns={videoColumns}
            data={videoSources}
            loading={videoLoading}
            page={videoPage}
            totalPages={videoTotalPages}
            onPageChange={setVideoPage}
            emptyMessage="No video sources found."
          />

          {/* Add Video Source form */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAddVideo((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 text-slate-300 hover:text-white text-sm font-medium transition-colors"
            >
              <span>Add Custom Video Source</span>
              <span>{showAddVideo ? '▲' : '▼'}</span>
            </button>
            {showAddVideo && (
              <form onSubmit={submitAddVideo} className="px-4 py-4 space-y-3 bg-slate-900">
                {addVideoError && (
                  <p className="text-red-400 text-sm">{addVideoError}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Name *</label>
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={addVideoForm.name}
                      onChange={(e) => setAddVideoForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Channel name"
                      className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">YouTube Feed URL *</label>
                    <input
                      required
                      type="url"
                      value={addVideoForm.feedUrl}
                      onChange={(e) => setAddVideoForm((f) => ({ ...f, feedUrl: e.target.value }))}
                      placeholder="https://www.youtube.com/feeds/videos.xml?..."
                      className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Sport *</label>
                    <select
                      value={addVideoForm.sport}
                      onChange={(e) => setAddVideoForm((f) => ({ ...f, sport: e.target.value as Sport }))}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Platform *</label>
                    <select
                      value={addVideoForm.platform}
                      onChange={(e) => setAddVideoForm((f) => ({ ...f, platform: e.target.value as 'youtube_channel' | 'youtube_playlist' }))}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="youtube_channel">YouTube Channel</option>
                      <option value="youtube_playlist">YouTube Playlist</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowAddVideo(false); setAddVideoError(''); }}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addVideoLoading || !addVideoForm.name || !addVideoForm.feedUrl || !addVideoForm.sport || !isValidUrl(addVideoForm.feedUrl)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    {addVideoLoading ? 'Adding…' : 'Add Source'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">Delete Source</h2>
            <p className="text-slate-400 text-sm">
              Are you sure you want to delete <strong className="text-slate-200">{deleteModal.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
