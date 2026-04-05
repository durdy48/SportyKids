'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { API_BASE, authFetch } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrgMember {
  id: string;
  email: string | null;
  role: string;
  orgRole: string | null;
  subscriptionTier: string;
  lastLoginAt: string | null;
  joinedAt: string;
}

interface DailyActivity {
  date: string;
  count: number;
}

interface ActivitySummary {
  dailyActivity: DailyActivity[];
  totalViews: number;
}

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  sport: string;
  logoUrl: string | null;
  inviteCode: string;
  maxMembers: number;
  active: boolean;
  createdAt: string;
  createdBy: string;
}

interface AdminOrgDetail {
  organization: OrgDetail;
  members: OrgMember[];
  memberCount: number;
  activitySummary: ActivitySummary;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelative(date: string | null): string {
  if (!date) return '—';
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function roleBadgeVariant(role: string): 'blue' | 'purple' | 'red' | 'gray' {
  switch (role) {
    case 'admin': return 'red';
    case 'parent': return 'purple';
    case 'child': return 'blue';
    default: return 'gray';
  }
}

function tierBadgeVariant(tier: string): 'yellow' | 'gray' {
  return tier === 'premium' ? 'yellow' : 'gray';
}

function orgRoleBadgeVariant(role: string | null): 'purple' | 'gray' {
  return role === 'admin' ? 'purple' : 'gray';
}

// ─── CopyButton ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs text-slate-400 hover:text-white ml-2"
    >
      {copied ? '✓ Copied' : '📋 Copy'}
    </button>
  );
}

// ─── Deactivate Modal ────────────────────────────────────────────────────────

function DeactivateModal({
  orgName,
  isActive,
  onConfirm,
  onCancel,
}: {
  orgName: string;
  isActive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isActive ? 'Deactivate organization confirmation' : 'Reactivate organization confirmation'}
        className="bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-2">
          {isActive ? 'Deactivate' : 'Reactivate'} Organization
        </h3>
        {isActive ? (
          <p className="text-slate-300 text-sm mb-6">
            Deactivate <span className="font-semibold">{orgName}</span>? Members will no longer be able to use organization features.
          </p>
        ) : (
          <p className="text-slate-300 text-sm mb-6">
            Reactivate <span className="font-semibold">{orgName}</span>?
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white text-sm transition-colors ${
              isActive
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {isActive ? 'Deactivate Org' : 'Reactivate Org'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<AdminOrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  const fetchOrg = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/admin/organizations/${id}`);
      if (res.status === 404) {
        setError('Organization not found');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch organization');
      const body = await res.json() as AdminOrgDetail;
      setData(body);
      setInviteCode(body.organization.inviteCode);
    } catch {
      setError('Failed to load organization');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchOrg();
  }, [fetchOrg]);

  const handleRegenerateCode = async () => {
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/admin/organizations/${id}/regenerate-code`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to regenerate code');
      const body = await res.json() as { inviteCode: string };
      setInviteCode(body.inviteCode);
      setSuccessMsg('Invite code regenerated');
    } catch {
      setError('Failed to regenerate invite code');
    }
  };

  const handleToggleActive = async () => {
    if (!data) return;
    setShowDeactivateModal(false);
    setError(null);
    const newActive = !data.organization.active;
    try {
      const res = await authFetch(`${API_BASE}/admin/organizations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) throw new Error('Failed to update organization');
      setSuccessMsg(newActive ? 'Organization reactivated' : 'Organization deactivated');
      void fetchOrg();
    } catch {
      setError('Failed to update organization status');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-48" />
          <div className="h-48 bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8">
        <div role="alert" className="px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { organization, members, memberCount, activitySummary } = data;

  return (
    <div className="p-8">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/admin/users?tab=organizations')}
          className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
        >
          ← Back to Organizations
        </button>
        <h1 className="text-2xl font-bold text-white flex-1 min-w-0 truncate">{organization.name}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { void handleRegenerateCode(); }}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
          >
            Regenerate Invite Code
          </button>
          <button
            onClick={() => setShowDeactivateModal(true)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              organization.active
                ? 'bg-red-900/60 hover:bg-red-800 text-red-300'
                : 'bg-green-900/60 hover:bg-green-800 text-green-300'
            }`}
          >
            {organization.active ? 'Deactivate Org' : 'Reactivate Org'}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div role="status" className="mb-4 px-4 py-3 rounded-lg bg-green-900/40 border border-green-700 text-green-300 text-sm">
          {successMsg}
        </div>
      )}

      {/* Section 1: Org Info */}
      <div className="bg-slate-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Organization Info</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-400 mb-1">Name</dt>
            <dd className="text-white font-medium">{organization.name}</dd>
          </div>
          <div>
            <dt className="text-slate-400 mb-1">Slug</dt>
            <dd className="text-white font-mono">{organization.slug}</dd>
          </div>
          <div>
            <dt className="text-slate-400 mb-1">Sport</dt>
            <dd><AdminBadge label={organization.sport} variant="blue" /></dd>
          </div>
          <div>
            <dt className="text-slate-400 mb-1">Status</dt>
            <dd>
              <AdminBadge
                label={organization.active ? 'Active' : 'Inactive'}
                variant={organization.active ? 'green' : 'gray'}
              />
            </dd>
          </div>
          <div>
            <dt className="text-slate-400 mb-1">Invite Code</dt>
            <dd className="flex items-center">
              <span className="text-white font-mono font-bold">{inviteCode ?? organization.inviteCode}</span>
              <CopyButton text={inviteCode ?? organization.inviteCode} />
            </dd>
          </div>
          <div>
            <dt className="text-slate-400 mb-1">Max Members</dt>
            <dd className="text-white">{organization.maxMembers}</dd>
          </div>
          <div>
            <dt className="text-slate-400 mb-1">Member Count</dt>
            <dd className="text-white">{memberCount}</dd>
          </div>
          <div>
            <dt className="text-slate-400 mb-1">Created</dt>
            <dd className="text-white">{new Date(organization.createdAt).toLocaleDateString('en-GB')}</dd>
          </div>
          <div>
            <dt className="text-slate-400 mb-1">Creator ID</dt>
            <dd className="text-white font-mono text-xs truncate">{organization.createdBy}</dd>
          </div>
        </dl>
      </div>

      {/* Section 2: Activity Chart */}
      <div className="bg-slate-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Activity (Last 30 Days) — {activitySummary.totalViews} total events
        </h2>
        {activitySummary.dailyActivity.length === 0 ? (
          <p className="text-slate-500 text-sm py-4">No activity data in the last 30 days.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activitySummary.dailyActivity} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#93c5fd' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#2563EB"
                strokeWidth={2}
                fill="url(#activityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Section 3: Members Table */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Members ({memberCount})
          </h2>
        </div>
        {/* TODO: Paginate if maxMembers grows beyond 100 — currently acceptable at default org size */}
        {members.length === 0 ? (
          <p className="px-5 py-6 text-slate-500 text-sm">No members yet.</p>
        ) : (
          <table className="w-full text-sm text-slate-300">
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase border-b border-slate-700">
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Org Role</th>
                <th className="px-5 py-3">Tier</th>
                <th className="px-5 py-3">Last Login</th>
                <th className="px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs">{member.email ?? '—'}</td>
                  <td className="px-5 py-3">
                    <AdminBadge label={member.role} variant={roleBadgeVariant(member.role)} />
                  </td>
                  <td className="px-5 py-3">
                    <AdminBadge
                      label={member.orgRole ?? 'member'}
                      variant={orgRoleBadgeVariant(member.orgRole)}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <AdminBadge label={member.subscriptionTier} variant={tierBadgeVariant(member.subscriptionTier)} />
                  </td>
                  <td className="px-5 py-3 text-slate-400">{formatRelative(member.lastLoginAt)}</td>
                  <td className="px-5 py-3 text-slate-400">
                    {new Date(member.joinedAt).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <DeactivateModal
          orgName={organization.name}
          isActive={organization.active}
          onConfirm={() => { void handleToggleActive(); }}
          onCancel={() => setShowDeactivateModal(false)}
        />
      )}
    </div>
  );
}
