import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, ParentalProfile } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { t } from '@sportykids/shared';
import { getUser, getParentalProfile, checkIn, getStreakInfo, updateUser } from './api';
import { registerForPushNotifications, registerPushTokenWithApi } from './push-notifications';

const STORAGE_KEY = 'sportykids_user_id';
const LOCALE_KEY = 'sportykids_locale';
const CHECKIN_DATE_KEY = 'sportykids_last_checkin';

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
}

interface UserContextType {
  user: User | null;
  parentalProfile: ParentalProfile | null;
  loading: boolean;
  locale: Locale;
  streakInfo: StreakInfo | null;
  setUser: (user: User) => void;
  setParentalProfile: (profile: ParentalProfile) => void;
  reloadParentalProfile: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  parentalProfile: null,
  loading: true,
  locale: 'es',
  streakInfo: null,
  setUser: () => {},
  setParentalProfile: () => {},
  reloadParentalProfile: async () => {},
  refreshUser: async () => {},
  setLocale: () => {},
  logout: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [parentalProfile, setParentalProfileState] = useState<ParentalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locale, setLocaleState] = useState<Locale>('es');
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);

  const loadParentalProfile = useCallback(async (userId: string) => {
    try {
      const result = await getParentalProfile(userId);
      if (result.exists && result.profile) {
        setParentalProfileState(result.profile);
      }
    } catch {
      // 401 (no session) or no profile — that's fine at startup
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
        // Sync locale from server if available
        if (u.locale && (u.locale === 'es' || u.locale === 'en')) {
          setLocaleState(u.locale as Locale);
          await AsyncStorage.setItem(LOCALE_KEY, u.locale);
        }
        await loadParentalProfile(u.id);

        // Load streak info
        try {
          const streak = await getStreakInfo(u.id);
          setStreakInfo({ currentStreak: streak.currentStreak, longestStreak: streak.longestStreak });
        } catch {
          // Streak info not critical
        }

        // Daily check-in: only once per calendar day
        const today = new Date().toISOString().slice(0, 10);
        const lastCheckIn = await AsyncStorage.getItem(CHECKIN_DATE_KEY);
        if (lastCheckIn !== today) {
          try {
            const result = await checkIn(u.id);
            await AsyncStorage.setItem(CHECKIN_DATE_KEY, today);
            setStreakInfo({ currentStreak: result.currentStreak, longestStreak: result.longestStreak });
            if (result.dailyStickerAwarded) {
              Alert.alert(
                t('gamification.sticker_earned', savedLocale === 'en' ? 'en' : 'es'),
                result.dailyStickerAwarded.name,
              );
            }
            if (result.newAchievements && result.newAchievements.length > 0) {
              Alert.alert(
                t('achievement.unlocked', savedLocale === 'en' ? 'en' : 'es'),
                result.newAchievements.map((a: { key: string; nameKey: string; icon: string }) => a.icon).join(' '),
              );
            }
          } catch {
            // Check-in endpoint may not be available yet — ignore
          }
        }

        // Register for push notifications (non-blocking)
        registerForPushNotifications()
          .then((token) => {
            if (token) registerPushTokenWithApi(u.id, token);
          })
          .catch(() => {}); // Push registration not critical
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

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const u = await getUser(user.id);
      setUserState(u);
    } catch {
      // Non-critical — user data will refresh on next app load
    }
  }, [user]);

  const setLocale = async (l: Locale) => {
    setLocaleState(l);
    await AsyncStorage.setItem(LOCALE_KEY, l);
    // Sync locale preference to server if user exists
    if (user) {
      updateUser(user.id, { locale: l }).catch(() => {
        // Non-critical — locale persists locally regardless
      });
    }
  };

  const logout = () => {
    setUserState(null);
    setParentalProfileState(null);
    setStreakInfo(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  };

  return (
    <UserContext.Provider
      value={{
        user,
        parentalProfile,
        loading,
        locale,
        streakInfo,
        setUser,
        setParentalProfile,
        reloadParentalProfile,
        refreshUser,
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
