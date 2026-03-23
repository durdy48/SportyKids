import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

const API_BASE = 'http://192.168.1.189:3001/api';
const STORAGE_KEY = 'sportykids_user_id';
const LOCALE_KEY = 'sportykids_locale';

interface UserContextType {
  user: User | null;
  loading: boolean;
  locale: Locale;
  setUser: (user: User) => void;
  setLocale: (locale: Locale) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  locale: 'es',
  setUser: () => {},
  setLocale: () => {},
  logout: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [locale, setLocaleState] = useState<Locale>('es');

  useEffect(() => {
    const init = async () => {
      // Load saved locale
      const savedLocale = await AsyncStorage.getItem(LOCALE_KEY);
      if (savedLocale === 'es' || savedLocale === 'en') {
        setLocaleState(savedLocale);
      }

      // Load user
      const id = await AsyncStorage.getItem(STORAGE_KEY);
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/users/${id}`);
        if (res.ok) {
          setUserState(await res.json());
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // API not available — keep without user
      }
      setLoading(false);
    };
    init();
  }, []);

  const setUser = (u: User) => {
    setUserState(u);
    AsyncStorage.setItem(STORAGE_KEY, u.id);
  };

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    AsyncStorage.setItem(LOCALE_KEY, l);
  };

  const logout = () => {
    setUserState(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  };

  return (
    <UserContext.Provider value={{ user, loading, locale, setUser, setLocale, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
