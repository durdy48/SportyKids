'use client';

import { t } from '@sportykids/shared';
import type { OrganizationMember } from '@sportykids/shared';

interface Props {
  members: OrganizationMember[];
  total: number;
  page: number;
  sort: string;
  onPageChange: (page: number) => void;
  onSortChange: (sort: string) => void;
  onRemove: (userId: string) => void;
  locale: string;
  colors: Record<string, string>;
}

export function OrgMemberList({
  members,
  total,
  page,
  sort,
  onPageChange,
  onSortChange,
  onRemove,
  locale,
  colors,
}: Props) {
  const totalPages = Math.ceil(total / 20);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('org.member_never_active', locale);
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('org.today', locale);
    if (diffDays === 1) return t('org.yesterday', locale);
    return t('org.days_ago', locale, { days: String(diffDays) });
  };

  return (
    <div aria-label={t('a11y.org.member_list', locale)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
          {t('org.dashboard_members', locale)} ({total})
        </h2>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: colors.surface, color: colors.text, border: `1px solid ${colors.border}` }}
          aria-label={t('a11y.org.sort_selector', locale)}
        >
          <option value="name">{t('org.sort_name', locale)}</option>
          <option value="lastActive">{t('org.sort_last_active', locale)}</option>
          <option value="streak">{t('org.sort_streak', locale)}</option>
        </select>
      </div>

      {/* Member rows */}
      {members.length === 0 ? (
        <p className="text-center py-8" style={{ color: colors.muted }}>
          {t('org.no_members', locale)}
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
            >
              <div className="flex-1">
                <span className="font-medium" style={{ color: colors.text }}>
                  {member.name}, {member.age}
                </span>
                <span className="ml-3 text-sm" style={{ color: colors.muted }}>
                  {member.totalPoints} {t('org.points_label', locale)}
                </span>
              </div>
              <span className="text-sm" style={{ color: colors.muted }}>
                🔥 {member.currentStreak}
              </span>
              <span className="text-xs" style={{ color: colors.muted }}>
                {formatDate(member.lastActiveDate)}
              </span>
              <button
                onClick={() => {
                  if (confirm(t('org.member_remove_confirm', locale, { name: member.name }))) {
                    onRemove(member.id);
                  }
                }}
                className="text-xs px-2 py-1 rounded"
                style={{ color: '#EF4444' }}
                aria-label={t('a11y.org.remove_member', locale, { name: member.name })}
              >
                {t('org.member_remove', locale)}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded text-sm"
            style={{
              backgroundColor: colors.surface,
              color: page === 1 ? colors.muted : colors.text,
              border: `1px solid ${colors.border}`,
            }}
          >
            ←
          </button>
          <span className="px-3 py-1 text-sm" style={{ color: colors.text }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded text-sm"
            style={{
              backgroundColor: colors.surface,
              color: page === totalPages ? colors.muted : colors.text,
              border: `1px solid ${colors.border}`,
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
