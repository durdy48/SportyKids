'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t, SUPPORTED_COUNTRIES } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';
import { updateUser } from '@/lib/api';

export function NavBar() {
  const pathname = usePathname();
  const { user, parentalProfile, locale, resolvedTheme, setTheme, theme, setLocale, setUser } = useUser();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  if (!user) return null;

  const links = [
    { href: '/', label: t('nav.news', locale), emoji: '📰', format: 'news' },
    { href: '/reels', label: t('nav.reels', locale), emoji: '🎬', format: 'reels' },
    { href: '/quiz', label: t('nav.quiz', locale), emoji: '🧠', format: 'quiz' },
    { href: '/collection', label: t('nav.collection', locale), emoji: '🏆', format: null },
    { href: '/team', label: t('nav.my_team', locale), emoji: '⚽', format: null },
  ];

  const allowedFormats = parentalProfile?.allowedFormats ?? ['news', 'reels', 'quiz'];
  const visibleLinks = links.filter((l) => !l.format || (allowedFormats as string[]).includes(l.format));

  const cycleTheme = () => {
    const order: Array<'system' | 'dark' | 'light'> = ['system', 'dark', 'light'];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  return (
    <nav className="bg-[var(--color-surface)] border-b border-[var(--color-border)] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl">🏟️</span>
              <span className="font-[family-name:var(--font-poppins)] text-lg font-bold text-[var(--color-blue)]">
                SportyKids
              </span>
            </Link>
            <div className="flex items-center gap-1">
              {visibleLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === l.href
                      ? 'bg-[var(--color-blue)]/10 text-[var(--color-blue)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)]'
                  }`}
                >
                  {l.emoji} {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="px-2.5 py-1.5 rounded-lg text-sm transition-colors text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)]"
                aria-label={t('settings.language', locale)}
                title={t('settings.language', locale)}
              >
                {locale === 'es' ? '\u{1F1EA}\u{1F1F8}' : '\u{1F1EC}\u{1F1E7}'}
              </button>
              {showLangMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-3 z-50 w-48 space-y-3">
                  <p className="text-xs font-semibold text-[var(--color-muted)]">{t('settings.language', locale)}</p>
                  <div className="flex gap-2">
                    {[
                      { value: 'es' as Locale, flag: '\u{1F1EA}\u{1F1F8}', label: 'ES' },
                      { value: 'en' as Locale, flag: '\u{1F1EC}\u{1F1E7}', label: 'EN' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setLocale(opt.value);
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          locale === opt.value
                            ? 'bg-[var(--color-blue)] text-white'
                            : 'bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-border)]'
                        }`}
                      >
                        {opt.flag} {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-[var(--color-muted)] mt-2">{t('settings.country', locale)}</p>
                  <select
                    value={user?.country ?? 'ES'}
                    onChange={async (e) => {
                      if (!user) return;
                      const newCountry = e.target.value;
                      setSavingLocale(true);
                      try {
                        await updateUser(user.id, { country: newCountry } as Record<string, unknown>);
                        setUser({ ...user, country: newCountry });
                        setSavedMsg(true);
                        setTimeout(() => setSavedMsg(false), 2000);
                      } catch { /* ignore */ }
                      setSavingLocale(false);
                    }}
                    className="w-full px-2 py-1.5 rounded-lg text-xs bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)]"
                  >
                    {SUPPORTED_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`countries.${c}`, locale)}
                      </option>
                    ))}
                  </select>
                  {savedMsg && (
                    <p className="text-xs text-[var(--color-green)] text-center">{t('settings.saved', locale)}</p>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={cycleTheme}
              className="px-2.5 py-1.5 rounded-lg text-sm transition-colors text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)]"
              aria-label={t('theme.toggle', locale)}
              title={t(`theme.${theme}`, locale)}
            >
              {resolvedTheme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
            </button>
            <Link
              href="/parents"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/parents'
                  ? 'bg-[var(--color-blue)]/10 text-[var(--color-blue)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)]'
              }`}
            >
              🔒
            </Link>
            <span className="bg-[var(--color-green)]/10 text-[var(--color-green)] px-2.5 py-1 rounded-full font-medium text-xs">
              {user.name}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
