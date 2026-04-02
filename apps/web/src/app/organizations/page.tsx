'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '../../lib/user-context';
import { t, getSportLabel } from '@sportykids/shared';
import type { Organization, OrganizationMember, OrganizationActivity } from '@sportykids/shared';
import {
  getOrganization,
  getOrgMembers,
  getOrgActivity,
  updateOrganization,
  regenerateOrgCode,
  removeOrgMember,
} from '../../lib/api';
import { OrgActivitySummary } from '../../components/OrgActivitySummary';
import { OrgActivityChart } from '../../components/OrgActivityChart';
import { OrgMemberList } from '../../components/OrgMemberList';
import { OrgSettings } from '../../components/OrgSettings';

type Period = '7d' | '30d' | 'all';

const THEME_COLORS: Record<'light' | 'dark', Record<string, string>> = {
  light: { text: '#1E293B', muted: '#6B7280', surface: '#FFFFFF', border: '#E5E7EB', background: '#F8FAFC', blue: '#2563EB' },
  dark:  { text: '#F1F5F9', muted: '#94A3B8', surface: '#1E293B', border: '#334155', background: '#0F172A', blue: '#2563EB' },
};

export default function OrganizationDashboard() {
  const { user, locale, resolvedTheme } = useUser();
  const colors = THEME_COLORS[resolvedTheme];
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [activity, setActivity] = useState<OrganizationActivity | null>(null);
  const [period, setPeriod] = useState<Period>('7d');
  const [memberPage, setMemberPage] = useState(1);
  const [memberSort, setMemberSort] = useState('name');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const orgId = user?.organizationId;
  const isAdmin = user?.organizationRole === 'admin';

  const loadData = useCallback(async () => {
    if (!orgId || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const [orgData, membersData, activityData] = await Promise.all([
        getOrganization(orgId),
        getOrgMembers(orgId, { page: memberPage, limit: 20, sort: memberSort }),
        getOrgActivity(orgId, period),
      ]);
      setOrg(orgData);
      setMembers(membersData.members);
      setMemberTotal(membersData.total);
      setActivity(activityData);
    } catch {
      setError(t('kid_errors.generic_message', locale));
    } finally {
      setLoading(false);
    }
  }, [orgId, isAdmin, period, memberPage, memberSort, locale]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyCode = async () => {
    if (!org?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(org.inviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Clipboard API not available — silent fallback is acceptable
    }
  };

  const handleRegenerateCode = async () => {
    if (!orgId || !confirm(t('org.settings_regenerate_confirm', locale))) return;
    try {
      const result = await regenerateOrgCode(orgId);
      setOrg((prev) => (prev ? { ...prev, inviteCode: result.inviteCode } : null));
    } catch {
      setError(t('kid_errors.generic_message', locale));
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!orgId) return;
    try {
      await removeOrgMember(orgId, memberId);
      await loadData();
    } catch {
      setError(t('kid_errors.generic_message', locale));
    }
  };

  const handleUpdateOrg = async (data: Parameters<typeof updateOrganization>[1]) => {
    if (!orgId) return;
    try {
      const updated = await updateOrganization(orgId, data);
      setOrg(updated);
      setShowSettings(false);
    } catch {
      setError(t('kid_errors.generic_message', locale));
    }
  };

  if (!user || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: colors?.muted }}>{t('kid_errors.forbidden_message', locale)}</p>
      </div>
    );
  }

  if (loading && !org) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: colors?.blue }} />
      </div>
    );
  }

  if (!org) return null;

  const periods: Period[] = ['7d', '30d', 'all'];
  const periodLabels: Record<Period, string> = {
    '7d': t('org.dashboard_period_7d', locale),
    '30d': t('org.dashboard_period_30d', locale),
    all: t('org.dashboard_period_all', locale),
  };

  return (
    <div
      className="max-w-4xl mx-auto p-4 sm:p-6"
      role="main"
      aria-label={t('a11y.org.dashboard', locale)}
    >
      {/* Error banner */}
      {error && (
        <div
          className="mb-4 p-3 rounded-lg text-sm flex items-center justify-between"
          role="alert"
          style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 font-bold"
            aria-label={t('a11y.common.close', locale)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: colors?.text }}>
            {org.logoUrl && (
              <img
                src={org.logoUrl}
                alt=""
                className="inline w-8 h-8 rounded mr-2"
              />
            )}
            {org.name}
          </h1>
          <p className="text-sm mt-1" style={{ color: colors?.muted }}>
            {getSportLabel(org.sport, locale)} · {org.memberCount ?? 0} {t('org.dashboard_members', locale).toLowerCase()} · {t('org.settings_invite_code', locale)}: {' '}
            <code className="font-mono font-bold tracking-wider">{org.inviteCode}</code>{' '}
            <button
              onClick={handleCopyCode}
              className="text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: colors?.border, color: colors?.text }}
              aria-label={t('a11y.org.copy_code', locale)}
            >
              {codeCopied ? t('org.code_copied', locale) : '📋'}
            </button>
          </p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: colors?.border, color: colors?.text }}
          aria-label={t('a11y.org.settings_button', locale)}
        >
          ⚙️ {t('org.settings_title', locale)}
        </button>
      </div>

      {/* Period selector */}
      <div
        className="flex gap-2 mb-6"
        role="tablist"
        aria-label={t('a11y.org.period_selector', locale)}
      >
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            role="tab"
            aria-selected={period === p}
            className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
            style={{
              backgroundColor: period === p ? colors?.blue : colors?.surface,
              color: period === p ? '#FFF' : colors?.text,
              border: `1px solid ${period === p ? colors?.blue : colors?.border}`,
            }}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Activity Summary */}
      {activity && <OrgActivitySummary summary={activity.summary} locale={locale} colors={colors} />}

      {/* Activity Chart */}
      {activity && activity.daily.length > 0 && (
        <OrgActivityChart daily={activity.daily} locale={locale} colors={colors} />
      )}

      {/* Top Members */}
      {activity && activity.topMembers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3" style={{ color: colors?.text }}>
            {t('org.dashboard_top_members', locale)}
          </h2>
          <div className="space-y-2">
            {activity.topMembers.map((m, i) => (
              <div
                key={m.name}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ backgroundColor: colors?.surface }}
              >
                <span className="text-lg">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span className="font-medium flex-1" style={{ color: colors?.text }}>
                  {m.name}
                </span>
                <span className="text-sm" style={{ color: colors?.muted }}>
                  {m.points} {t('org.points_label', locale)}
                </span>
                <span className="text-sm" style={{ color: colors?.muted }}>
                  🔥 {m.streak} {t('org.streak_label', locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member List */}
      <OrgMemberList
        members={members}
        total={memberTotal}
        page={memberPage}
        sort={memberSort}
        onPageChange={setMemberPage}
        onSortChange={setMemberSort}
        onRemove={handleRemoveMember}
        locale={locale}
        colors={colors}
      />

      {/* Settings Modal */}
      {showSettings && (
        <OrgSettings
          org={org}
          onSave={handleUpdateOrg}
          onRegenerateCode={handleRegenerateCode}
          onClose={() => setShowSettings(false)}
          locale={locale}
          colors={colors}
        />
      )}
    </div>
  );
}
