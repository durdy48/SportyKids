import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, ParentalProfile } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { getUser, getParentalProfile, checkIn } from './api';

const STORAGE_KEY = 'sportykids_user_id';
const LOCALE_KEY = 'sportykids_locale';
const CHECKIN_DATE_KEY = 'sportykids_last_checkin';

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
        const u = await getUser(id);
        setUserState(u);
        await loadParentalProfile(u.id);

        // Daily check-in: only once per calendar day
        const today = new Date().toISOString().slice(0, 10);
        const lastCheckIn = await AsyncStorage.getItem(CHECKIN_DATE_KEY);
        if (lastCheckIn !== today) {
          try {
            await checkIn(u.id);
            await AsyncStorage.setItem(CHECKIN_DATE_KEY, today);
          } catch {
            // Check-in endpoint may not be available yet — ignore
          }
        }
      } catch {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
      setLoading(false);
    };
    init();
  }, [loadParentalProfile]);

  const setUser = (u: User) => {
    setUserState(u);
    AsyncStorage.setItem(STORAGE_KEY, u.id);
  };

  const setParentalProfile = (profile: ParentalProfile) => {
    setParentalProfileState(profile);
  };

  const reloadParentalProfile = async () => {
    if (user) await loadParentalProfile(user.id);
  };

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    AsyncStorage.setItem(LOCALE_KEY, l);
  };

  const logout = () => {
    setUserState(null);
    setParentalProfileState(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  };

  return (
    <UserContext.Provider
      value={{
        user,
        parentalProfile,
        loading,
        locale,
        setUser,
        setParentalProfile,
        reloadParentalProfile,
        setLocale,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
