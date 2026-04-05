'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { API_BASE, authFetch } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  email: string | null;
  role: string;
  subscriptionTier: string;
  authProvider: string;
  country: string;
  locale: string;
  createdAt: string;
  lastLoginAt: string | null;
  organizationId: string | null;
  organizationRole: string | null;
}

interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  sport: string;
  logoUrl: string | null;
  inviteCode: string;
  maxMembers: number;
  memberCount: number;
  active: boolean;
  createdAt: string;
  createdBy: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

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

function sportBadgeVariant(sport: string): 'blue' | 'green' | 'yellow' | 'red' | 'gray' {
  switch (sport) {
    case 'football': return 'green';
    case 'basketball': return 'blue';
    case 'tennis': return 'yellow';
    case 'formula1': return 'red';
    default: return 'gray';
  }
}

// ─── Users Tab ──────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (roleFilter) params.set('role', roleFilter);
      if (tierFilter) params.set('tier', tierFilter);
      params.set('page', String(page));
      params.set('limit', '25');

      const res = await authFetch(`${API_BASE}/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json() as { users: AdminUser[]; total: number; page: number; totalPages: number };
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, roleFilter, tierFilter, page]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, tierFilter]);

  const columns: Column<AdminUser>[] = [
    {
      key: 'email',
      header: 'Email',
      render: (row) => (
        <span className="font-mono text-xs">{row.email ?? <span className="text-slate-500">—</span>}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <AdminBadge label={row.role} variant={roleBadgeVariant(row.role)} />
      ),
    },
    {
      key: 'subscriptionTier',
      header: 'Tier',
      render: (row) => (
        <AdminBadge label={row.subscriptionTier} variant={tierBadgeVariant(row.subscriptionTier)} />
      ),
    },
    {
      key: 'authProvider',
      header: 'Auth Provider',
      render: (row) => (
        <AdminBadge label={row.authProvider} variant={authProviderVariant(row.authProvider)} />
      ),
    },
    {
      key: 'country',
      header: 'Country',
      render: (row) => <span>{row.country}</span>,
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      render: (row) => (
        <span className="text-slate-400 text-xs">{formatRelative(row.lastLoginAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Link
          href={`/admin/users/${row.id}`}
          className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white transition-colors"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by email or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-64"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All Roles</option>
          <option value="child">Child</option>
          <option value="parent">Parent</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All Tiers</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
        <span className="text-slate-500 text-sm self-center">{total} total</span>
      </div>

      {error && (
        <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}

      <AdminTable<AdminUser>
        columns={columns}
        data={users}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyMessage="No users found. Try a different search term."
      />
    </div>
  );
}

// ─── Organizations Tab ───────────────────────────────────────────────────────

function OrganizationsTab() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sportFilter, setSportFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sportFilter) params.set('sport', sportFilter);
      if (statusFilter) params.set('active', statusFilter);
      params.set('page', String(page));
      params.set('limit', '25');

      const res = await authFetch(`${API_BASE}/admin/organizations?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch organizations');
      const data = await res.json() as { organizations: AdminOrg[]; total: number; page: number; totalPages: number };
      setOrgs(data.organizations);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, [sportFilter, statusFilter, page]);

  useEffect(() => {
    void fetchOrgs();
  }, [fetchOrgs]);

  useEffect(() => {
    setPage(1);
  }, [sportFilter, statusFilter]);

  const columns: Column<AdminOrg>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium text-white">{row.name}</span>,
    },
    {
      key: 'sport',
      header: 'Sport',
      render: (row) => (
        <AdminBadge label={row.sport} variant={sportBadgeVariant(row.sport)} />
      ),
    },
    {
      key: 'memberCount',
      header: 'Members/Max',
      render: (row) => (
        <span className="font-mono text-sm">{row.memberCount}/{row.maxMembers}</span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <AdminBadge
          label={row.active ? 'Active' : 'Inactive'}
          variant={row.active ? 'green' : 'gray'}
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="text-slate-400 text-xs">
          {new Date(row.createdAt).toLocaleDateString('en-GB')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Link
          href={`/admin/users/organizations/${row.id}`}
          className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white transition-colors"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All Sports</option>
          <option value="football">Football</option>
          <option value="basketball">Basketball</option>
          <option value="tennis">Tennis</option>
          <option value="swimming">Swimming</option>
          <option value="athletics">Athletics</option>
          <option value="cycling">Cycling</option>
          <option value="formula1">Formula 1</option>
          <option value="padel">Padel</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <span className="text-slate-500 text-sm self-center">{total} total</span>
      </div>

      {error && (
        <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}

      <AdminTable<AdminOrg>
        columns={columns}
        data={orgs}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyMessage="No organizations found."
      />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type TabId = 'users' | 'organizations';

export default function UsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(tabParam === 'organizations' ? 'organizations' : 'users');

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'users') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.push(`/admin/users?${params.toString()}`);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Users &amp; Organizations</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800">
        {(['users', 'organizations'] as TabId[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab === 'users' ? 'Users' : 'Organizations'}
          </button>
        ))}
      </div>

      {activeTab === 'users' ? <UsersTab /> : <OrganizationsTab />}
    </div>
  );
}
