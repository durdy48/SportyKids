'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { register, getGoogleLoginUrl, getAppleLoginUrl } from '@/lib/auth';
import { useUser } from '@/lib/user-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, locale: ctxLocale } = useUser();
  const locale: Locale = ctxLocale ?? 'es';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({ google: false, apple: false });

  useEffect(() => {
    fetch(`${API_BASE}/auth/providers`)
      .then((r) => r.json())
      .then((d) => setProviders(d))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await register({ name: name.trim(), email: email.trim(), password });
      setUser(result.user);
      router.replace('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || t('auth.register_error', locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-3xl">🏟️</span>
            <span className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-blue)]">
              SportyKids
            </span>
          </Link>
          <h1 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)]">
            {t('auth.join_sporty', locale)}
          </h1>
          <p className="text-[var(--color-muted)] text-sm mt-1">{t('auth.create_account_cta', locale)}</p>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-8 space-y-5">
          {/* OAuth buttons */}
          {(providers.google || providers.apple) && (
            <>
              <div className="space-y-3">
                {providers.google && (
                  <a
                    href={getGoogleLoginUrl()}
                    className="flex items-center justify-center gap-3 w-full py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] font-medium text-sm hover:bg-[var(--color-background)] transition-colors"
                    aria-label={t('auth.google_signin', locale)}
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    {t('auth.google_signin', locale)}
                  </a>
                )}
                {providers.apple && (
                  <a
                    href={getAppleLoginUrl()}
                    className="flex items-center justify-center gap-3 w-full py-3 rounded-xl bg-black text-white font-medium text-sm hover:bg-gray-900 transition-colors"
                    aria-label={t('auth.apple_signin', locale)}
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    {t('auth.apple_signin', locale)}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-xs text-[var(--color-muted)]">{t('auth.or_continue_with', locale)}</span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>
            </>
          )}

          {/* Registration form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3"
              >
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="name" className="block text-sm font-medium text-[var(--color-text)]">
                {t('auth.name', locale)}
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent text-sm"
                placeholder="Juan García"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text)]">
                {t('auth.email', locale)}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent text-sm"
                placeholder="nombre@email.com"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text)]">
                {t('auth.password', locale)}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent text-sm"
                placeholder="••••••••"
              />
              <p className="text-xs text-[var(--color-muted)] pt-1">
                {locale === 'es' ? 'Mínimo 6 caracteres' : 'At least 6 characters'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim() || !email || password.length < 6}
              className="w-full py-3 rounded-xl bg-[var(--color-blue)] text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-busy={loading}
            >
              {loading ? t('auth.creating_account', locale) : t('auth.register', locale)}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center space-y-2 pt-1">
            <p className="text-sm text-[var(--color-muted)]">
              {t('auth.have_account', locale)}{' '}
              <Link href="/login" className="text-[var(--color-blue)] font-medium hover:underline">
                {t('auth.login', locale)}
              </Link>
            </p>
            <p className="text-sm">
              <Link href="/onboarding" className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-xs">
                {t('auth.continue_anonymous', locale)}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
