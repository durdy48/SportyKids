'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';

export function NavBar() {
  const pathname = usePathname();
  const { user, parentalProfile, locale, resolvedTheme, setTheme, theme } = useUser();

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
