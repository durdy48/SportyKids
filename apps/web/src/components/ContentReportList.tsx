'use client';

import { useState, useEffect } from 'react';
import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { fetchReports, updateReportStatus } from '@/lib/api';

interface ContentReportListProps {
  userId: string;
  locale: Locale;
}

interface Report {
  id: string;
  contentType: 'news' | 'reel';
  contentId: string;
  reason: string;
  comment?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: string;
  contentTitle?: string;
}

const REASON_EMOJIS: Record<string, string> = {
  inappropriate: '\uD83D\uDE20',
  scary: '\uD83D\uDE28',
  confusing: '\uD83E\uDD14',
  other: '\u2753',
};

export function ContentReportList({ userId, locale }: ContentReportListProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReports(userId)
      .then((data) => setReports(data as Report[]))
      // eslint-disable-next-line no-console
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  const handleUpdateStatus = async (reportId: string, status: 'reviewed' | 'dismissed') => {
    setUpdatingId(reportId);
    try {
      await updateReportStatus(reportId, status);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reviewed':
        return (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            {t('report.reviewed', locale)}
          </span>
        );
      case 'dismissed':
        return (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-background)] text-[var(--color-muted)]">
            {t('report.dismissed', locale)}
          </span>
        );
      default:
        return (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
            {'\u23F3'}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-[var(--color-border)] rounded w-40" />
        <div className="h-20 bg-[var(--color-background)] rounded-xl" />
        <div className="h-20 bg-[var(--color-background)] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-[var(--color-text)] text-sm">
          {'\uD83D\uDEA9'} {t('report.title', locale)}
        </h4>
        {pendingCount > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
            {t('report.pending_count', locale, { count: String(pendingCount) })}
          </span>
        )}
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)] text-center py-4">
          {'\u2705'} {t('report.no_reports', locale)}
        </p>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-[var(--color-background)] rounded-xl p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">
                    {report.contentTitle || `${report.contentType === 'news' ? '\uD83D\uDCF0' : '\uD83C\uDFAC'} ${report.contentId.slice(0, 8)}...`}
                  </p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">
                    {REASON_EMOJIS[report.reason] || ''} {t(`report.${report.reason}`, locale)} {'\u00B7'} {formatDate(report.createdAt)}
                  </p>
                </div>
                {getStatusBadge(report.status)}
              </div>

              {report.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(report.id, 'reviewed')}
                    disabled={updatingId === report.id}
                    className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors disabled:opacity-50"
                  >
                    {t('report.mark_reviewed', locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                    disabled={updatingId === report.id}
                    className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-[var(--color-background)] text-[var(--color-muted)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
                  >
                    {t('report.dismiss', locale)}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
