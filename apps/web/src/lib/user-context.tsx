'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User, ParentalProfile } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { getUser, getParentalProfile, checkIn, updateUser } from './api';
import { celebrateSticker, celebrateAchievement, celebrateStreak } from './celebrations';
import { initAnalytics } from './analytics';

type Theme = 'system' | 'light' | 'dark';

interface UserContextType {
  user: User | null;
  parentalProfile: ParentalProfile | null;
  loading: boolean;
  locale: Locale;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  setUser: (user: User) => void;
  setParentalProfile: (profile: ParentalProfile) => void;
  reloadParentalProfile: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  parentalProfile: null,
  loading: true,
  locale: 'es',
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
  setUser: () => {},
  setParentalProfile: () => {},
  reloadParentalProfile: async () => {},
  setLocale: () => {},
  logout: () => {},
});

const STORAGE_KEY = 'sportykids_usuario_id';
const LOCALE_KEY = 'sportykids_locale';
const CHECKIN_DATE_KEY = 'sportykids_last_checkin';
const THEME_KEY = 'sportykids-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

const AGE_GATE_EXEMPT_PATHS = ['/age-gate', '/privacy', '/terms', '/login', '/register'];

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [parentalProfile, setParentalProfileState] = useState<ParentalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locale, setLocaleState] = useState<Locale>('es');
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const pathname = usePathname();
  const router = useRouter();

  const loadParentalProfile = useCallback(async (userId: string) => {
    try {
      const result = await getParentalProfile(userId);
      if (result.exists && result.profile) {
        setParentalProfileState(result.profile);
      }
    } catch {
      // No parental profile — that's fine
    }
  }, []);

  // Theme initialization and system preference listener
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    const currentTheme = savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system'
      ? savedTheme
      : 'system';
    setThemeState(currentTheme);

    const resolved = currentTheme === 'system' ? getSystemTheme() : currentTheme;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const stored = localStorage.getItem(THEME_KEY) as Theme | null;
      if (!stored || stored === 'system') {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        applyThemeClass(newResolved);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const savedLocale = localStorage.getItem(LOCALE_KEY) as Locale | null;
    if (savedLocale === 'es' || savedLocale === 'en') {
      setLocaleState(savedLocale);
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const accessToken = localStorage.getItem('sportykids_access_token');
    const id = localStorage.getItem(STORAGE_KEY);

    const applyUser = async (u: User) => {
      setUserState(u);
      if (u.id) localStorage.setItem(STORAGE_KEY, u.id);
      if (u.locale && (u.locale === 'es' || u.locale === 'en')) {
        setLocaleState(u.locale as Locale);
        localStorage.setItem(LOCALE_KEY, u.locale);
      }
      await loadParentalProfile(u.id);
      const today = new Date().toISOString().slice(0, 10);
      const lastCheckIn = localStorage.getItem(CHECKIN_DATE_KEY);
      if (lastCheckIn !== today) {
        try {
          const checkInResult = await checkIn(u.id);
          localStorage.setItem(CHECKIN_DATE_KEY, today);
          if (checkInResult.dailyStickerAwarded) celebrateSticker();
          if (checkInResult.newAchievements.length > 0) celebrateAchievement();
          if ([7, 14, 30].includes(checkInResult.currentStreak)) celebrateStreak(checkInResult.currentStreak);
        } catch { /* non-critical */ }
      }
    };

    const tryFetchMe = async (token: string): Promise<User | null> => {
      const res = await fetch(`${apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) return res.json();
      return null;
    };

    if (accessToken) {
      // JWT auth flow — load user via /auth/me, refresh if needed
      (async () => {
        try {
          let u = await tryFetchMe(accessToken);
          if (!u) {
            const { refreshToken } = await import('./auth');
            const newToken = await refreshToken();
            if (newToken) u = await tryFetchMe(newToken);
          }
          if (u) {
            await applyUser(u);
          } else {
            // Both tokens expired — clear everything
            localStorage.removeItem('sportykids_access_token');
            localStorage.removeItem('sportykids_refresh_token');
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        } finally {
          setLoading(false);
        }
      })();
    } else if (id) {
      // Anonymous user flow — load by stored ID (no JWT needed)
      getUser(id)
        .then(async (u) => { await applyUser(u); })
        .catch(() => localStorage.removeItem(STORAGE_KEY))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadParentalProfile]);

  // Redirect logic:
  // - No user + had a previous session (token in storage) → send to /login (returning user)
  // - No user + no previous session → send to /onboarding (first-time visitor)
  // - /login, /register, /onboarding are exempt from redirect
  // - User exists but ageGateCompleted === false → send to /age-gate
  // - Authenticated user on /login or /register → send to /
  useEffect(() => {
    if (loading) return;
    const exempt = [...AGE_GATE_EXEMPT_PATHS, '/onboarding'];
    if (!user) {
      if (!exempt.includes(pathname)) {
        const hadSession =
          typeof window !== 'undefined' &&
          (localStorage.getItem('sportykids_access_token') ||
            localStorage.getItem('sportykids_refresh_token') ||
            localStorage.getItem(STORAGE_KEY));
        router.replace(hadSession ? '/login' : '/onboarding');
      }
      return;
    }
    if (user.ageGateCompleted === false && !AGE_GATE_EXEMPT_PATHS.includes(pathname)) {
      router.replace('/age-gate');
      return;
    }
    if (pathname === '/login' || pathname === '/register') {
      router.replace('/');
    }
  }, [loading, user, pathname, router]);

  // Initialize analytics gated on consent
  useEffect(() => {
    if (loading) return;
    if (user) {
      initAnalytics(user.consentGiven === true);
    }
  }, [loading, user]);

  const setUser = (u: User) => {
    setUserState(u);
    localStorage.setItem(STORAGE_KEY, u.id);
  };

  const setParentalProfile = (profile: ParentalProfile) => {
    setParentalProfileState(profile);
  };

  const reloadParentalProfile = async () => {
    if (user) await loadParentalProfile(user.id);
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
    const resolved = t === 'system' ? getSystemTheme() : t;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  };

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(LOCALE_KEY, l);
    // Sync locale preference to server if user exists
    if (user) {
      updateUser(user.id, { locale: l }).catch(() => {
        // Non-critical — locale persists locally regardless
      });
    }
  };

  const logout = () => {
    // Revoke refresh token on server (best-effort, fire-and-forget)
    import('./auth').then(({ logout: revokeTokens }) => revokeTokens()).catch(() => {});
    setUserState(null);
    setParentalProfileState(null);
    localStorage.removeItem(STORAGE_KEY);
    router.replace('/login');
  };

  return (
    <UserContext.Provider value={{ user, parentalProfile, loading, locale, theme, setTheme, resolvedTheme, setUser, setParentalProfile, reloadParentalProfile, setLocale, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
