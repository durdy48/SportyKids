'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLink {
  href: string;
  label: string;
  exact: boolean;
  comingSoon?: boolean;
}

const navLinks: NavLink[] = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/moderation', label: 'Moderation', exact: false },
  { href: '/admin/analytics', label: 'Analytics', exact: false },
  { href: '/admin/sources', label: 'Sources', exact: false },
  { href: '/admin/jobs', label: 'Jobs', exact: false },
  { href: '/admin/users', label: 'Users & Orgs', exact: false },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="px-4 py-5 border-b border-slate-800">
        <span className="font-semibold text-slate-100 text-sm">
          ⚙ SportyKids Admin
        </span>
      </div>
      <nav className="flex-1 py-4 px-2 space-y-0.5" aria-label="Admin navigation">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link.href, link.exact) ? 'page' : undefined}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              link.comingSoon
                ? 'opacity-60 cursor-default text-slate-400'
                : isActive(link.href, link.exact)
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <span>{link.label}</span>
            {link.comingSoon && (
              <span className="text-xs text-slate-500 ml-1">(soon)</span>
            )}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
