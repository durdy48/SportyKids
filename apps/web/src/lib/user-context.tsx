'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, ParentalProfile } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { getUser, getParentalProfile } from './api';

interface UserContextType {
  user: User | null;
  parentalProfile: ParentalProfile | null;
  loading: boolean;
  locale: Locale;
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
  setUser: () => {},
  setParentalProfile: () => {},
  reloadParentalProfile: async () => {},
  setLocale: () => {},
  logout: () => {},
});

const STORAGE_KEY = 'sportykids_usuario_id';
const LOCALE_KEY = 'sportykids_locale';

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [parentalProfile, setParentalProfileState] = useState<ParentalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locale, setLocaleState] = useState<Locale>('es');

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

  useEffect(() => {
    const savedLocale = localStorage.getItem(LOCALE_KEY) as Locale | null;
    if (savedLocale === 'es' || savedLocale === 'en') {
      setLocaleState(savedLocale);
    }

    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      setLoading(false);
      return;
    }

    getUser(id)
      .then(async (u) => {
        setUserState(u);
        await loadParentalProfile(u.id);
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setLoading(false));
  }, [loadParentalProfile]);

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

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(LOCALE_KEY, l);
  };

  const logout = () => {
    setUserState(null);
    setParentalProfileState(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <UserContext.Provider value={{ user, parentalProfile, loading, locale, setUser, setParentalProfile, reloadParentalProfile, setLocale, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
