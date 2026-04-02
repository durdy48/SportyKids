'use client';

import { useEffect, useRef, useState } from 'react';
import { t } from '@sportykids/shared';
import { joinOrganization } from '../lib/api';

interface Props {
  onClose: () => void;
  onJoined: () => void;
  locale: string;
  colors: Record<string, string>;
}

export function JoinOrgModal({ onClose, onJoined, locale, colors }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  const handleJoin = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);

    try {
      const result = await joinOrganization(code);
      setSuccess(t('org.join_success', locale, { name: result.organizationName }));
      setTimeout(() => {
        onJoined();
        onClose();
      }, 1500);
    } catch (err) {
      const status = (err as Record<string, unknown>).status as number | undefined;
      if (status === 404) setError(t('org.join_error_not_found', locale));
      else if (status === 409) setError(t('org.join_error_already_member', locale));
      else if (status === 403) setError(t('org.join_error_inactive', locale));
      else if (status === 400) setError(t('org.join_error_full', locale));
      else setError(t('org.join_error_invalid', locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={t('org.join_title', locale)}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        className="w-full max-w-sm mx-4 p-6 rounded-2xl"
        style={{ backgroundColor: colors.surface }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
            {t('org.join_title', locale)}
          </h2>
          <button onClick={onClose} className="text-xl" aria-label={t('a11y.common.close', locale)}>
            ✕
          </button>
        </div>

        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          {t('org.join_subtitle', locale)}
        </p>

        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
            setError(null);
          }}
          maxLength={6}
          className="w-full px-4 py-3 rounded-xl text-center font-mono text-xl font-bold tracking-[0.3em]"
          style={{
            backgroundColor: colors.background,
            color: colors.text,
            border: `2px solid ${code.length === 6 ? colors.blue : colors.border}`,
          }}
          placeholder="______"
          autoFocus
          aria-label={t('a11y.org.code_input', locale, { position: '1' })}
        />

        {error && (
          <p className="text-sm mt-2 text-center" style={{ color: '#EF4444' }} role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm mt-2 text-center" style={{ color: '#22C55E' }} role="alert">
            {success}
          </p>
        )}

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm"
            style={{ color: colors.text, border: `1px solid ${colors.border}` }}
          >
            {t('delete_account.confirm_cancel', locale)}
          </button>
          <button
            onClick={handleJoin}
            disabled={code.length !== 6 || loading || !!success}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-medium"
            style={{
              backgroundColor: code.length === 6 && !loading ? colors.blue : colors.border,
            }}
          >
            {loading ? '...' : t('org.join_button', locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
