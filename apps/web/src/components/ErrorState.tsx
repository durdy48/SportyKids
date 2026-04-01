'use client';

import { t } from '@sportykids/shared';
import { KID_FRIENDLY_ERRORS, getErrorType } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';

interface ErrorStateProps {
  error: string | number;
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const { locale } = useUser();
  const errorType = getErrorType(error);
  const errorInfo = KID_FRIENDLY_ERRORS[errorType] ?? KID_FRIENDLY_ERRORS.generic;

  return (
    <div className="min-h-[40vh] flex items-center justify-center p-4" role="alert">
      <div className="max-w-sm text-center">
        <span className="text-6xl block mb-4">{errorInfo.emoji}</span>
        <h2 className="font-[family-name:var(--font-poppins)] text-xl font-bold text-[var(--color-text)] mb-2">
          {t(errorInfo.titleKey, locale)}
        </h2>
        <p className="text-[var(--color-muted)] mb-6">
          {t(errorInfo.messageKey, locale)}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            aria-label="Retry"
            className="px-6 py-2.5 bg-[var(--color-blue)] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {t('kid_errors.retry', locale)}
          </button>
        )}
      </div>
    </div>
  );
}
