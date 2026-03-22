'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';

export function NavBar() {
  const pathname = usePathname();
  const { user, parentalProfile, locale } = useUser();

  if (!user) return null;

  const links = [
    { href: '/', label: t('nav.news', locale), emoji: '📰', format: 'news' },
    { href: '/reels', label: t('nav.reels', locale), emoji: '🎬', format: 'reels' },
    { href: '/quiz', label: t('nav.quiz', locale), emoji: '🧠', format: 'quiz' },
    { href: '/team', label: t('nav.my_team', locale), emoji: '⚽', format: null },
  ];

  const allowedFormats = parentalProfile?.allowedFormats ?? ['news', 'reels', 'quiz'];
  const visibleLinks = links.filter((l) => !l.format || (allowedFormats as string[]).includes(l.format));

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
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
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {l.emoji} {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/parents"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/parents'
                  ? 'bg-[var(--color-blue)]/10 text-[var(--color-blue)]'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
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
