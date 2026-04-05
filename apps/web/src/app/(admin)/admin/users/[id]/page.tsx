'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { API_BASE, authFetch } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string;
  type: string;
  sport: string | null;
  contentId: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

interface ParentalProfileSummary {
  hasPin: boolean;
  allowedSports: string[];
  allowedFormats: string[];
  maxNewsMinutes: number | null;
  scheduleLocked: boolean;
}

interface UserStats {
  stickerCount: number;
  achievementCount: number;
  totalQuizAnswers: number;
  totalNewsViewed: number;
}

interface AdminUserDetail {
  id: string;
  name: string;
  email: string | null;
  age: number;
  role: string;
  authProvider: string;
  country: string;
  locale: string;
  subscriptionTier: string;
  subscriptionExpiry: string | null;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  createdAt: string;
  lastLoginAt: string | null;
  organizationId: string | null;
  organizationRole: string | null;
  ageGateCompleted: boolean;
  consentGiven: boolean;
  consentDate: string | null;
  parentalProfile: ParentalProfileSummary | null;
  recentActivity: ActivityEntry[];
  stats: UserStats;
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

function authProviderVariant(provider: string): 'green' | 'blue' | 'gray' {
  switch (provider) {
    case 'google': return 'blue';
    case 'email': return 'green';
    default: return 'gray';
  }
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function ChangeTierModal({
  user,
  onConfirm,
  onCancel,
}: {
  user: AdminUserDetail;
  onConfirm: (tier: 'free' | 'premium') => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<'free' | 'premium'>(
    user.subscriptionTier === 'premium' ? 'premium' : 'free',
  );

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
        aria-label="Change subscription tier"
        className="bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-1">Change Subscription Tier</h3>
        <p className="text-slate-400 text-sm mb-4">{user.email ?? user.id}</p>
        <p className="text-slate-400 text-sm mb-2">
          Current: <AdminBadge label={user.subscriptionTier} variant={tierBadgeVariant(user.subscriptionTier)} />
        </p>
        <div className="flex gap-3 mb-4">
          {(['free', 'premium'] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setSelected(tier)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
                selected === tier
                  ? 'border-blue-500 bg-blue-600 text-white'
                  : 'border-slate-600 text-slate-300 hover:border-slate-400'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
        <p className="text-yellow-400 text-xs mb-4">
          This overrides RevenueCat data until the next webhook sync.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-sm transition-colors"
          >
            Confirm Change
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeRoleModal({
  user,
  onConfirm,
  onCancel,
}: {
  user: AdminUserDetail;
  onConfirm: (role: 'child' | 'parent' | 'admin') => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<'child' | 'parent' | 'admin'>(
    (user.role as 'child' | 'parent' | 'admin') ?? 'child',
  );

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
        aria-label="Change user role"
        className="bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-1">Change Role</h3>
        <p className="text-slate-400 text-sm mb-4">{user.email ?? user.id}</p>
        <p className="text-slate-400 text-sm mb-2">
          Current: <AdminBadge label={user.role} variant={roleBadgeVariant(user.role)} />
        </p>
        <div className="flex gap-2 mb-3">
          {(['child', 'parent', 'admin'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setSelected(role)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
                selected === role
                  ? 'border-blue-500 bg-blue-600 text-white'
                  : 'border-slate-600 text-slate-300 hover:border-slate-400'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
        {selected === 'admin' && (
          <p className="text-red-400 text-xs mb-4">
            Admin role grants full dashboard access.
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
            onClick={() => onConfirm(selected)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-sm transition-colors"
          >
            Confirm Change
          </button>
        </div>
      </div>
    </div>
  );
}

function RevokeTokensModal({
  user,
  onConfirm,
  onCancel,
}: {
  user: AdminUserDetail;
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
        aria-label="Revoke sessions confirmation"
        className="bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-2">Revoke All Sessions</h3>
        <p className="text-slate-300 text-sm mb-6">
          This will immediately log out <span className="font-semibold">{user.email ?? user.id}</span> from all devices.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 text-sm transition-colors"
          >
            Revoke Sessions
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showTierModal, setShowTierModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${id}`);
      if (res.status === 404) {
        setError('User not found');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch user');
      const data = await res.json() as AdminUserDetail;
      setUser(data);
    } catch {
      setError('Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const handleTierChange = async (tier: 'free' | 'premium') => {
    setShowTierModal(false);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${id}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) throw new Error('Failed to update tier');
      setSuccessMsg(`Subscription tier changed to ${tier}`);
      void fetchUser();
    } catch {
      setError('Failed to update subscription tier');
    }
  };

  const handleRoleChange = async (role: 'child' | 'parent' | 'admin') => {
    setShowRoleModal(false);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.status === 403) {
        const data = await res.json() as { error: string };
        setError(data.error);
        return;
      }
      if (!res.ok) throw new Error('Failed to update role');
      setSuccessMsg(`Role changed to ${role}`);
      void fetchUser();
    } catch {
      setError('Failed to update role');
    }
  };

  const handleRevokeTokens = async () => {
    setShowRevokeModal(false);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${id}/revoke-tokens`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to revoke tokens');
      const data = await res.json() as { revoked: number };
      setSuccessMsg(`Revoked ${data.revoked} session(s)`);
    } catch {
      setError('Failed to revoke sessions');
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

  if (error && !user) {
    return (
      <div className="p-8">
        <div role="alert" className="px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="p-8">
      {/* Breadcrumb + Action Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white flex-1 min-w-0 truncate">
          {user.email ?? user.id}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTierModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
          >
            Change Tier
          </button>
          <button
            onClick={() => setShowRoleModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
          >
            Change Role
          </button>
          <button
            onClick={() => setShowRevokeModal(true)}
            className="px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-300 text-sm transition-colors"
          >
            Revoke Sessions
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

      {/* Section 1: Profile + Subscription */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Account Info */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Account</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Email</dt>
              <dd className="text-white font-mono">{user.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-slate-400">Role</dt>
              <dd><AdminBadge label={user.role} variant={roleBadgeVariant(user.role)} /></dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-slate-400">Auth Provider</dt>
              <dd><AdminBadge label={user.authProvider} variant={authProviderVariant(user.authProvider)} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Country</dt>
              <dd className="text-white">{user.country}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Locale</dt>
              <dd className="text-white">{user.locale}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Created</dt>
              <dd className="text-white">{new Date(user.createdAt).toLocaleDateString('en-GB')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Last Login</dt>
              <dd className="text-white">{formatRelative(user.lastLoginAt)}</dd>
            </div>
            {user.organizationId && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Organization</dt>
                <dd>
                  <Link
                    href={`/admin/users/organizations/${user.organizationId}`}
                    className="text-blue-400 hover:text-blue-300 font-mono text-xs underline underline-offset-2"
                  >
                    {user.organizationId}
                  </Link>
                  {user.organizationRole && (
                    <span className="ml-1 text-slate-400 text-xs">({user.organizationRole})</span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Subscription + Gamification */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Subscription &amp; Stats</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <dt className="text-slate-400">Tier</dt>
              <dd><AdminBadge label={user.subscriptionTier} variant={tierBadgeVariant(user.subscriptionTier)} /></dd>
            </div>
            {user.subscriptionExpiry && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Expiry</dt>
                <dd className="text-white">{new Date(user.subscriptionExpiry).toLocaleDateString('en-GB')}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-400">Current Streak</dt>
              <dd className="text-white">{user.currentStreak} days</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Longest Streak</dt>
              <dd className="text-white">{user.longestStreak} days</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Stickers</dt>
              <dd className="text-white">{user.stats.stickerCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Achievements</dt>
              <dd className="text-white">{user.stats.achievementCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Quiz Answers</dt>
              <dd className="text-white">{user.stats.totalQuizAnswers}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">News Viewed</dt>
              <dd className="text-white">{user.stats.totalNewsViewed}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Section 2: Parental Profile */}
      {user.parentalProfile && (
        <div className="bg-slate-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Parental Profile</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-400 mb-1">PIN Set</dt>
              <dd>
                <AdminBadge
                  label={user.parentalProfile.hasPin ? 'Yes' : 'No'}
                  variant={user.parentalProfile.hasPin ? 'green' : 'gray'}
                />
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 mb-1">Schedule Locked</dt>
              <dd>
                <AdminBadge
                  label={user.parentalProfile.scheduleLocked ? 'Yes' : 'No'}
                  variant={user.parentalProfile.scheduleLocked ? 'yellow' : 'gray'}
                />
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 mb-1">Max News (min)</dt>
              <dd className="text-white">{user.parentalProfile.maxNewsMinutes ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400 mb-1">Allowed Sports</dt>
              <dd className="text-white">{user.parentalProfile.allowedSports.join(', ') || 'All'}</dd>
            </div>
            <div>
              <dt className="text-slate-400 mb-1">Allowed Formats</dt>
              <dd className="text-white">{user.parentalProfile.allowedFormats.join(', ') || 'All'}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Section 3: Recent Activity */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Recent Activity</h2>
        </div>
        {user.recentActivity.length === 0 ? (
          <p className="px-5 py-6 text-slate-500 text-sm">No recent activity.</p>
        ) : (
          <table className="w-full text-sm text-slate-300">
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase border-b border-slate-700">
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Sport</th>
                <th className="px-5 py-3">Content ID</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {user.recentActivity.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-5 py-3">
                    <AdminBadge label={entry.type} variant="gray" />
                  </td>
                  <td className="px-5 py-3 text-slate-400">{entry.sport ?? '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400 max-w-xs truncate">{entry.contentId ?? '—'}</td>
                  <td className="px-5 py-3">{entry.durationSeconds != null ? `${entry.durationSeconds}s` : '—'}</td>
                  <td className="px-5 py-3 text-slate-400">{formatRelative(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showTierModal && (
        <ChangeTierModal
          user={user}
          onConfirm={(tier) => { void handleTierChange(tier); }}
          onCancel={() => setShowTierModal(false)}
        />
      )}
      {showRoleModal && (
        <ChangeRoleModal
          user={user}
          onConfirm={(role) => { void handleRoleChange(role); }}
          onCancel={() => setShowRoleModal(false)}
        />
      )}
      {showRevokeModal && (
        <RevokeTokensModal
          user={user}
          onConfirm={() => { void handleRevokeTokens(); }}
          onCancel={() => setShowRevokeModal(false)}
        />
      )}
    </div>
  );
}
