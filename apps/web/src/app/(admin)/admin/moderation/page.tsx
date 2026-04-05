'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { authFetch, API_BASE } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingItem {
  id: string;
  type: 'news' | 'reel';
  title: string;
  sport: string;
  source: string;
  safetyReason: string | null;
  pendingSinceMinutes: number;
  url: string;
  imageUrl?: string;
}

interface AdminReport {
  id: string;
  contentType: 'news' | 'reel';
  contentId: string;
  contentTitle: string | null;
  reason: string;
  details: string | null;
  status: string;
  user: { id: string; email: string | null };
  createdAt: string;
}

type ActiveTab = 'pending' | 'reports';

/** Discriminated union for the reject modal state. */
type ModalState =
  | { mode: 'single'; id: string; type: 'news' | 'reel' }
  | { mode: 'batch' }
  | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusVariant(status: string): 'yellow' | 'green' | 'gray' | 'red' {
  switch (status) {
    case 'pending': return 'yellow';
    case 'reviewed': return 'green';
    case 'actioned': return 'red';
    default: return 'gray';
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending');

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Content Moderation</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        {(['pending', 'reports'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab === 'pending' ? 'Pending Content' : 'User Reports'}
          </button>
        ))}
      </div>

      {activeTab === 'pending' && <PendingContentTab />}
      {activeTab === 'reports' && <UserReportsTab />}
    </div>
  );
}

// ─── Pending Content Tab ─────────────────────────────────────────────────────

function PendingContentTab() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [modalState, setModalState] = useState<ModalState>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (typeFilter) params.set('type', typeFilter);
      if (sportFilter) params.set('sport', sportFilter);
      const res = await authFetch(`${API_BASE}/admin/moderation/pending?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setTotalPages(data.totalPages ?? 1);
      } else {
        setError('Failed to load pending items. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, sportFilter]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const approveItem = async (item: PendingItem) => {
    setActionLoading(true);
    try {
      await authFetch(`${API_BASE}/admin/content/${item.type}/${item.id}/approve`, { method: 'PATCH' });
      await fetchItems();
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (state: ModalState) => {
    setModalState(state);
    setRejectReason('');
  };

  const submitReject = async () => {
    if (!rejectReason.trim() || rejectReason.length < 3) return;
    setActionLoading(true);
    try {
      if (modalState?.mode === 'batch') {
        // Separate news and reels to avoid the batch endpoint's single-type constraint
        const selectedItems = items.filter((i) => selectedIds.has(i.id));
        const newsIds = selectedItems.filter((i) => i.type === 'news').map((i) => i.id);
        const reelIds = selectedItems.filter((i) => i.type === 'reel').map((i) => i.id);
        await Promise.all([
          newsIds.length
            ? authFetch(`${API_BASE}/admin/content/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: newsIds, type: 'news', action: 'reject', reason: rejectReason }),
              })
            : Promise.resolve(),
          reelIds.length
            ? authFetch(`${API_BASE}/admin/content/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: reelIds, type: 'reel', action: 'reject', reason: rejectReason }),
              })
            : Promise.resolve(),
        ]);
        setSelectedIds(new Set());
      } else if (modalState?.mode === 'single') {
        await authFetch(`${API_BASE}/admin/content/${modalState.type}/${modalState.id}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectReason }),
        });
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(modalState.id); return n; });
      }
      setModalState(null);
      await fetchItems();
    } finally {
      setActionLoading(false);
    }
  };

  const approveSelected = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      const selectedItems = items.filter((i) => selectedIds.has(i.id));
      const newsIds = selectedItems.filter((i) => i.type === 'news').map((i) => i.id);
      const reelIds = selectedItems.filter((i) => i.type === 'reel').map((i) => i.id);
      await Promise.all([
        newsIds.length
          ? authFetch(`${API_BASE}/admin/content/batch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: newsIds, type: 'news', action: 'approve' }),
            })
          : Promise.resolve(),
        reelIds.length
          ? authFetch(`${API_BASE}/admin/content/batch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: reelIds, type: 'reel', action: 'approve' }),
            })
          : Promise.resolve(),
      ]);
      setSelectedIds(new Set());
      await fetchItems();
    } finally {
      setActionLoading(false);
    }
  };

  const columns: Column<PendingItem>[] = [
    {
      key: 'checkbox',
      header: '',
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelect(row.id)}
          className="w-4 h-4 accent-blue-500"
          aria-label={`Select ${row.title}`}
        />
      ),
    },
    {
      key: 'type',
      header: 'TYPE',
      render: (row) => (
        <AdminBadge label={row.type.toUpperCase()} variant={row.type === 'news' ? 'blue' : 'purple'} />
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-200 hover:text-white line-clamp-2 max-w-xs"
          title={row.title}
        >
          {row.title}
        </a>
      ),
    },
    { key: 'sport', header: 'Sport', sortable: true },
    {
      key: 'pendingSinceMinutes',
      header: 'Pending',
      sortable: true,
      render: (row) => {
        const mins = row.pendingSinceMinutes;
        const label = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
        return <span className={mins > 120 ? 'text-yellow-400' : 'text-slate-400'}>{label}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void approveItem(row)}
            disabled={actionLoading}
            className="px-2 py-1 rounded bg-green-800 text-green-300 hover:bg-green-700 text-xs font-medium"
            title="Approve"
            aria-label="Approve"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => openRejectModal({ mode: 'single', id: row.id, type: row.type })}
            disabled={actionLoading}
            className="px-2 py-1 rounded bg-red-900 text-red-300 hover:bg-red-800 text-xs font-medium"
            title="Reject"
            aria-label="Reject"
          >
            ✗
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5"
          aria-label="Filter by type"
        >
          <option value="">All Types</option>
          <option value="news">News</option>
          <option value="reel">Reel</option>
        </select>
        <input
          type="text"
          placeholder="Filter by sport..."
          value={sportFilter}
          onChange={(e) => { setSportFilter(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 w-44"
          aria-label="Filter by sport"
        />
        <label className="flex items-center gap-2 text-sm text-slate-400 ml-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedIds.size === items.length && items.length > 0}
            onChange={toggleAll}
            className="w-4 h-4 accent-blue-500"
            aria-label="Select all"
          />
          Select all
        </label>
        {selectedIds.size > 0 && (
          <>
            <button
              type="button"
              onClick={() => void approveSelected()}
              disabled={actionLoading}
              className="px-3 py-1.5 text-sm rounded-lg bg-green-800 text-green-300 hover:bg-green-700 font-medium"
            >
              Approve Selected ({selectedIds.size})
            </button>
            <button
              type="button"
              onClick={() => openRejectModal({ mode: 'batch' })}
              disabled={actionLoading}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-900 text-red-300 hover:bg-red-800 font-medium"
            >
              Reject Selected ({selectedIds.size})
            </button>
          </>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div role="alert" className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <AdminTable
        columns={columns}
        data={items}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyMessage="No pending items."
      />

      {/* Reject Modal */}
      {modalState !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Reject content">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Reject Content</h2>
            <label className="block text-sm text-slate-400 mb-2">
              Reason for rejection <span className="text-red-400">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this content is rejected..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Rejection reason"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setModalState(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-700 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitReject()}
                disabled={rejectReason.length < 3 || actionLoading}
                className="px-4 py-2 text-sm rounded-lg bg-red-700 text-white hover:bg-red-600 disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── User Reports Tab ─────────────────────────────────────────────────────────

function UserReportsTab() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (contentTypeFilter) params.set('contentType', contentTypeFilter);
      const res = await authFetch(`${API_BASE}/admin/reports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.items ?? []);
        setTotalPages(data.totalPages ?? 1);
      } else {
        setError('Failed to load reports. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, contentTypeFilter]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const handleAction = async (reportId: string, status: string, action?: string) => {
    setActionLoading(true);
    try {
      await authFetch(`${API_BASE}/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(action ? { action } : {}) }),
      });
      await fetchReports();
    } finally {
      setActionLoading(false);
    }
  };

  const columns: Column<AdminReport>[] = [
    {
      key: 'contentType',
      header: 'Type',
      render: (row) => (
        <AdminBadge label={row.contentType.toUpperCase()} variant={row.contentType === 'news' ? 'blue' : 'purple'} />
      ),
    },
    {
      key: 'contentTitle',
      header: 'Content',
      render: (row) => (
        <span className="text-slate-300 max-w-xs line-clamp-1" title={row.contentTitle ?? row.contentId}>
          {row.contentTitle ?? row.contentId}
        </span>
      ),
    },
    { key: 'reason', header: 'Reason' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <AdminBadge label={row.status} variant={statusVariant(row.status)} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        row.status === 'pending' ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleAction(row.id, 'actioned', 'reject_content')}
              disabled={actionLoading}
              className="px-2 py-1 text-xs rounded bg-red-900 text-red-300 hover:bg-red-800 font-medium"
              title="Reject content"
            >
              Reject Content
            </button>
            <button
              type="button"
              onClick={() => void handleAction(row.id, 'dismissed')}
              disabled={actionLoading}
              className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-300 hover:bg-slate-600 font-medium"
              title="Dismiss report"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <span className="text-slate-600 text-xs">—</span>
        )
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
          <option value="actioned">Actioned</option>
        </select>
        <select
          value={contentTypeFilter}
          onChange={(e) => { setContentTypeFilter(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5"
          aria-label="Filter by content type"
        >
          <option value="">All Content Types</option>
          <option value="news">News</option>
          <option value="reel">Reel</option>
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div role="alert" className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <AdminTable
        columns={columns}
        data={reports}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyMessage="No reports found."
      />
    </div>
  );
}
