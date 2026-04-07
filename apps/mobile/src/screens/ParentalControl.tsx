import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, Modal, Image, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewsItem, Reel, LiveScorePreferences } from '@sportykids/shared';
import { COLORS, SPORTS, SPORT_ENTITIES, t, sportToEmoji, getSportLabel, getAgeRangeLabel } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import * as Haptics from 'expo-haptics';
import {
  getParentalProfile, verifyPin, setupParentalPin,
  updateParentalProfile, fetchActivity, fetchFeedPreview,
  getDigestPreferences, updateDigestPreferences,
  getLiveScorePreferences, subscribeNotifications,
  updateUser,
} from '../lib/api';
import { API_BASE, WEB_BASE } from '../config';
import { getAccessToken } from '../lib/auth';
import { useUser } from '../lib/user-context';
import { ParentalTour } from '../components/ParentalTour';

interface ParentalProfileData {
  allowedFormats: string[];
  allowedSports: string[];
  maxDailyTimeMinutes: number;
  maxNewsMinutes: number | null;
  maxReelsMinutes: number | null;
  maxQuizMinutes: number | null;
  allowedHoursStart: number;
  allowedHoursEnd: number;
  timezone: string;
  digestEnabled: boolean;
  digestEmail: string | null;
  digestDay: number;
  [key: string]: unknown;
}

interface ActivitySummary {
  news_viewed: number;
  reels_viewed: number;
  quizzes_played: number;
  totalPoints: number;
  [key: string]: number;
}

type ScreenState = 'loading' | 'create-pin' | 'confirm-pin' | 'verify-pin' | 'panel';
type TabId = 'profile' | 'content' | 'restrictions' | 'activity' | 'pin' | 'digest';

const FORMATS = [
  { id: 'news', labelKey: 'nav.news', emoji: '📰' },
  { id: 'reels', labelKey: 'nav.reels', emoji: '🎬' },
  { id: 'quiz', labelKey: 'nav.quiz', emoji: '🧠' },
];

const TIME_PRESETS = [15, 30, 60, 90, 120, 0]; // 0 = no limit

export function ParentalControlScreen({ navigation }: { navigation: { navigate: (screen: string) => void } }) {
  const { user, setUser, setParentalProfile, locale, colors, theme, setTheme, logout } = useUser();
  const s = createStyles(colors);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [pin, setPin] = useState('');
  const [tempPin, setTempPin] = useState('');
  const [profile, setProfile] = useState<ParentalProfileData | null>(null);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  // Feed preview state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewNews, setPreviewNews] = useState<NewsItem[]>([]);
  const [previewReels, setPreviewReels] = useState<Reel[]>([]);
  const [previewQuizAvailable, setPreviewQuizAvailable] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Lockout state
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live score preferences state
  const [liveScorePrefs, setLiveScorePrefs] = useState<LiveScorePreferences>({
    enabled: false, goals: true, matchStart: true, matchEnd: true, halfTime: true, redCards: true,
  });
  const [liveScoreLoaded, setLiveScoreLoaded] = useState(false);

  // PIN change state
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');

  // Team selection state
  const [teamSelectionVisible, setTeamSelectionVisible] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);

  useEffect(() => {
    if (!user) return;
    getParentalProfile(user.id)
      .then((d) => setScreenState(d.exists ? 'verify-pin' : 'create-pin'))
      .catch(() => setScreenState('create-pin'));
  }, [user]);

  // Lockout countdown timer
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!lockedUntil) { setCountdown(0); return; }

    const update = () => {
      const remaining = Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
        setLockedUntil(null);
      }
    };
    update();
    countdownRef.current = setInterval(update, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [lockedUntil]);

  const verify = async () => {
    if (!user || pin.length !== 4) return;
    try {
      const data = await verifyPin(user.id, pin);
      if (data.verified) {
        if (data.profile) {
          setProfile(data.profile as unknown as ParentalProfileData);
          setParentalProfile(data.profile);
        }
        setLockedUntil(null);
        // eslint-disable-next-line no-console
        fetchActivity(user.id).then((data) => setActivity(data as ActivitySummary)).catch(console.error);
        setScreenState('panel');
      } else if (data.status === 423) {
        setLockedUntil(data.lockedUntil ?? null);
        setError(data.error ?? t('parental.pin_locked', locale, { minutes: '15' }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (data.status === 429) {
        setError(t('errors.rate_limited', locale));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (data.status === 401) {
        setError(data.error ?? t('errors.incorrect_pin', locale));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        setError(t('errors.incorrect_pin', locale));
      }
    } catch { setError(t('errors.connection_error', locale)); }
    setPin('');
  };

  const createPin = () => {
    if (pin.length !== 4) return;
    setTempPin(pin);
    setPin('');
    setScreenState('confirm-pin');
  };

  const confirmPin = async () => {
    if (pin !== tempPin) { setError(t('errors.pins_mismatch', locale)); setPin(''); return; }
    if (!user) return;
    try {
      const data = await setupParentalPin(user.id, pin);
      setProfile(data as unknown as ParentalProfileData);
      setParentalProfile(data);
      // eslint-disable-next-line no-console
      fetchActivity(user.id).then((data) => setActivity(data as ActivitySummary)).catch(console.error);
      setScreenState('panel');
    } catch { setError(t('errors.create_pin_failed', locale)); }
    setPin('');
  };

  const saveProfile = async (data: Record<string, unknown>) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateParentalProfile(user.id, data);
      setProfile(updated as unknown as ParentalProfileData);
      setParentalProfile(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('401') || msg.toLowerCase().includes('session')) {
        // Parental session expired — ask user to re-verify PIN
        Alert.alert(
          t('parental.session_expired', locale),
          undefined,
          [{ text: t('buttons.access', locale), onPress: () => setScreenState('verify-pin') }],
        );
      } else {
        Alert.alert(t('errors.generic', locale));
      }
    }
    setSaving(false);
  };

  const toggleSport = async (sport: string) => {
    if (!user || !profile) return;
    const current = (profile.allowedSports as string[]) ?? [...SPORTS];
    const next = current.includes(sport)
      ? current.filter((s) => s !== sport)
      : [...current, sport];
    if (next.length === 0) return; // at least one sport must be allowed
    await saveProfile({ allowedSports: next });
  };

  const toggleFormat = async (format: string) => {
    if (!user || !profile) return;
    const formats = (profile.allowedFormats as string[]).includes(format)
      ? (profile.allowedFormats as string[]).filter((f) => f !== format)
      : [...(profile.allowedFormats as string[]), format];
    if (formats.length === 0) return;
    setSaving(true);
    try {
      const updated = await updateParentalProfile(user.id, { allowedFormats: formats as ('news' | 'reels' | 'quiz')[] });
      setProfile(updated as unknown as ParentalProfileData);
      setParentalProfile(updated);
    } catch { /* */ }
    setSaving(false);
  };

  const updateTimeLimit = async (minutes: number) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateParentalProfile(user.id, {
        maxDailyTimeMinutes: minutes,
      });
      setProfile(updated as unknown as ParentalProfileData);
      setParentalProfile(updated);
    } catch { /* */ }
    setSaving(false);
  };

  const handleChangePin = async () => {
    if (!user) return;

    // Verify current PIN
    try {
      const check = await verifyPin(user.id, currentPinInput);
      if (!check.verified) {
        if (check.status === 423) {
          setPinChangeError(check.error ?? t('parental.pin_locked', locale, { minutes: '15' }));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (check.status === 429) {
          setPinChangeError(t('errors.rate_limited', locale));
        } else {
          setPinChangeError(check.error ?? t('errors.incorrect_pin', locale));
        }
        return;
      }
    } catch {
      setPinChangeError(t('errors.connection_error', locale));
      return;
    }

    if (newPinInput.length !== 4) return;
    if (newPinInput !== confirmNewPin) {
      setPinChangeError(t('errors.pins_mismatch', locale));
      return;
    }

    try {
      const updated = await setupParentalPin(user.id, newPinInput);
      setProfile(updated as unknown as ParentalProfileData);
      setParentalProfile(updated);
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmNewPin('');
      setPinChangeError('');
      Alert.alert(t('parental.pin_changed', locale));
    } catch {
      setPinChangeError(t('errors.create_pin_failed', locale));
    }
  };

  const selectTeam = async (team: string) => {
    if (!user) return;
    setSavingTeam(true);
    try {
      const updated = await updateUser(user.id, { favoriteTeam: team });
      setUser(updated);
    } catch {
      Alert.alert(t('errors.generic', locale));
    }
    setSavingTeam(false);
    setTeamSelectionVisible(false);
  };

  const openFeedPreview = async () => {
    if (!user) return;
    setPreviewLoading(true);
    try {
      const data = await fetchFeedPreview(user.id);
      setPreviewNews(data.news);
      setPreviewReels(data.reels);
      setPreviewQuizAvailable(data.quizAvailable);
      setPreviewVisible(true);
    } catch {
      Alert.alert(t('errors.connection_error', locale));
    } finally {
      setPreviewLoading(false);
    }
  };

  // Digest state
  const [digestEnabled, setDigestEnabledState] = useState(false);
  const [digestEmail, setDigestEmailState] = useState('');
  const [digestDay, setDigestDayState] = useState(1);
  const [digestLoaded, setDigestLoaded] = useState(false);

  useEffect(() => {
    if (user && activeTab === 'digest' && !digestLoaded) {
      getDigestPreferences(user.id)
        .then((prefs: { digestEnabled?: boolean; digestEmail?: string | null; digestDay?: number }) => {
          setDigestEnabledState(prefs.digestEnabled ?? false);
          setDigestEmailState(prefs.digestEmail ?? '');
          setDigestDayState(prefs.digestDay ?? 1);
          setDigestLoaded(true);
        })
        .catch(() => setDigestLoaded(true));
    }
  }, [user, activeTab, digestLoaded]);

  // Load live score preferences when content tab is active
  useEffect(() => {
    if (user && activeTab === 'content' && !liveScoreLoaded) {
      getLiveScorePreferences(user.id)
        .then((prefs) => { setLiveScorePrefs(prefs); setLiveScoreLoaded(true); })
        .catch(() => setLiveScoreLoaded(true));
    }
  }, [user, activeTab, liveScoreLoaded]);

  const toggleLiveScorePref = async (key: keyof LiveScorePreferences) => {
    if (!user) return;
    const updated = { ...liveScorePrefs, [key]: !liveScorePrefs[key] };
    setLiveScorePrefs(updated);
    try {
      // Use the subscribe endpoint which works for anonymous users too
      const currentPrefs = (user.pushPreferences ?? { sports: true, dailyQuiz: true, teamUpdates: true }) as Record<string, unknown>;
      await subscribeNotifications(user.id, {
        enabled: user.pushEnabled ?? false,
        preferences: { ...currentPrefs, liveScores: updated } as never,
      });
    } catch {
      setLiveScorePrefs(liveScorePrefs);
    }
  };

  if (!user || screenState === 'loading') return <ActivityIndicator style={{ flex: 1 }} color={colors.blue} />;

  // PIN entry screens
  if (screenState !== 'panel') {
    const heading =
      screenState === 'create-pin' ? t('parental.create_pin', locale)
      : screenState === 'confirm-pin' ? t('parental.confirm_pin', locale)
      : t('parental.enter_pin', locale);
    const action = screenState === 'create-pin' ? createPin : screenState === 'confirm-pin' ? confirmPin : verify;
    const isLocked = countdown > 0;
    const formatCountdown = (secs: number) => {
      const m = Math.floor(secs / 60);
      const sec = secs % 60;
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };
    return (
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.center}>
          <Text style={{ fontSize: 56 }}>🔒</Text>
          <Text style={s.title}>{heading}</Text>
          <TextInput
            style={[s.pinInput, isLocked && { opacity: 0.4 }]}
            value={pin}
            onChangeText={(text) => { if (!isLocked) { setPin(text.replace(/\D/g, '').slice(0, 4)); setError(''); } }}
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            placeholder="····"
            placeholderTextColor="#ccc"
            editable={!isLocked}
          />
          {isLocked ? (
            <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
              <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 14 }}>{t('parental.pin_locked_short', locale, { remaining: formatCountdown(countdown) })}</Text>
              <Text style={{ color: '#EF4444', fontSize: 28, fontWeight: '700', fontFamily: 'monospace', marginVertical: 8 }}>
                {formatCountdown(countdown)}
              </Text>
              <View style={{ width: 200, height: 6, backgroundColor: '#FCA5A5', borderRadius: 3 }}>
                <View style={{ width: Math.max(0, 1 - countdown / 900) * 200, height: 6, backgroundColor: '#EF4444', borderRadius: 3 }} />
              </View>
            </View>
          ) : error ? (
            <Text style={s.error}>{error}</Text>
          ) : null}
          <TouchableOpacity
            style={[s.button, (pin.length < 4 || isLocked) && s.buttonDisabled]}
            onPress={action}
            disabled={pin.length < 4 || isLocked}
            accessible={true}
            accessibilityLabel={screenState === 'verify-pin' ? t('a11y.parental.verify_pin', locale) : t('a11y.parental.setup_pin', locale)}
            accessibilityRole="button"
            accessibilityState={{ disabled: pin.length < 4 || isLocked }}
          >
            <Text style={s.buttonText}>
              {screenState === 'verify-pin' ? t('buttons.access', locale) : t('buttons.next', locale)}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Panel with tabs
  const currentTimeLimit = (profile?.maxDailyTimeMinutes as number) ?? 0;

  return (
    <View style={{ flex: 1 }}>
    <ParentalTour locale={locale} colors={colors} />
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>{t('parental.control', locale)}</Text>
      <Text style={s.subtitle}>{t('parental.manage_content', locale, { name: user.name })}</Text>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarScroll} contentContainerStyle={s.tabBarContent}>
        {(['profile', 'content', 'restrictions', 'activity', 'digest', 'pin'] as TabId[]).map((tab) => {
          const labels: Record<TabId, string> = {
            profile: t('parental.tab_profile', locale),
            content: t('parental.tab_content', locale),
            restrictions: t('parental.tab_restrictions', locale),
            activity: t('parental.tab_activity', locale),
            digest: t('parental.tab_digest', locale),
            pin: t('parental.tab_pin', locale),
          };
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => setActiveTab(tab)}
              accessible={true}
              accessibilityLabel={labels[tab]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab }}
            >
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{labels[tab]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('parental.child_profile', locale)}</Text>
            <View style={s.profileRow}>
              <Text style={s.profileLabel}>{t('parental.profile_name', locale)}</Text>
              <Text style={s.profileValue}>{user.name}</Text>
            </View>
            <View style={s.profileRow}>
              <Text style={s.profileLabel}>{t('parental.profile_age', locale)}</Text>
              <Text style={s.profileValue}>
                {user.age} ({getAgeRangeLabel(
                  user.age <= 8 ? '6-8' : user.age <= 11 ? '9-11' : '12-14',
                  locale,
                )})
              </Text>
            </View>
            <View style={s.profileRow}>
              <Text style={s.profileLabel}>{t('parental.profile_sports', locale)}</Text>
              <Text style={s.profileValue}>
                {(user.favoriteSports ?? []).map((sp: string) => `${sportToEmoji(sp)} ${getSportLabel(sp, locale)}`).join(', ') || '—'}
              </Text>
            </View>
            <View style={s.profileRow}>
              <Text style={s.profileLabel}>{t('parental.favorite_team', locale)}</Text>
              <Text style={s.profileValue}>{user.favoriteTeam || '—'}</Text>
            </View>
          </View>

          {/* Favorite team editor */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('parental.favorite_team', locale)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 15, color: colors.text, fontWeight: '600' }}>{user.favoriteTeam || '—'}</Text>
              <TouchableOpacity
                style={[s.button, { paddingVertical: 8, paddingHorizontal: 16 }]}
                onPress={() => setTeamSelectionVisible(!teamSelectionVisible)}
                accessible={true}
                accessibilityLabel={t('parental.change_team', locale)}
                accessibilityRole="button"
              >
                <Text style={[s.buttonText, { fontSize: 13 }]}>{t('parental.change_team', locale)}</Text>
              </TouchableOpacity>
            </View>
            {teamSelectionVisible && (
              <View style={s.sportsGrid}>
                {(user.favoriteSports?.length > 0 ? user.favoriteSports : SPORTS).flatMap((sport: string) =>
                  (SPORT_ENTITIES[sport] ?? []).map((entity) => (
                    <TouchableOpacity
                      key={entity.feedQuery}
                      style={[s.sportChip, user.favoriteTeam === entity.name ? s.sportChipActive : s.sportChipInactive, savingTeam && { opacity: 0.5 }]}
                      onPress={() => !savingTeam && selectTeam(entity.name)}
                      accessible={true}
                      accessibilityLabel={entity.name}
                      accessibilityRole="button"
                      accessibilityState={{ selected: user.favoriteTeam === entity.name }}
                    >
                      <Text style={[s.sportChipText, user.favoriteTeam === entity.name && { color: '#fff' }]}>
                        {entity.name}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        </>
      )}

      {/* Content tab */}
      {activeTab === 'content' && (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('parental.allowed_formats', locale)}</Text>
            {FORMATS.map((f) => {
              const active = (profile?.allowedFormats as string[])?.includes(f.id);
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[s.formatRow, active ? s.formatActive : s.formatInactive]}
                  onPress={() => toggleFormat(f.id)}
                  accessible={true}
                  accessibilityLabel={t('a11y.parental.toggle_format', locale, { format: t(f.labelKey, locale), state: active ? t('parental.enabled', locale) : t('parental.blocked', locale) })}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: active }}
                >
                  <Text style={s.formatText}>{f.emoji} {t(f.labelKey, locale)}</Text>
                  <Text style={[s.formatBadge, active ? s.badgeOn : s.badgeOff]}>
                    {active ? t('parental.enabled', locale) : t('parental.blocked', locale)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>{t('onboarding.step2_title', locale)}</Text>
            <View style={s.sportsGrid}>
              {SPORTS.map((sport) => {
                const allowed = (profile?.allowedSports as string[]) ?? [...SPORTS];
                const active = allowed.includes(sport);
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[s.sportChip, active ? s.sportChipActive : s.sportChipInactive]}
                    onPress={() => toggleSport(sport)}
                    accessible={true}
                    accessibilityLabel={t('a11y.parental.toggle_sport', locale, { sport: getSportLabel(sport, locale), state: active ? t('a11y.parental.sport_allowed', locale) : t('a11y.parental.sport_blocked', locale) })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[s.sportChipText, active && { color: '#fff' }]}>
                      {sportToEmoji(sport)} {getSportLabel(sport, locale)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Live Score Notifications */}
          {user.favoriteTeam ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('live_notifications.title', locale)}</Text>
              <Text style={[s.cardSubtitle, { color: colors.muted, marginBottom: 12 }]}>
                {t('live_notifications.description', locale)}
              </Text>
              {([
                { key: 'enabled' as const, label: t('live_notifications.enable', locale) },
                { key: 'goals' as const, label: t('live_notifications.goals', locale) },
                { key: 'matchStart' as const, label: t('live_notifications.match_start', locale) },
                { key: 'halfTime' as const, label: t('live_notifications.half_time', locale) },
                { key: 'matchEnd' as const, label: t('live_notifications.match_end', locale) },
                { key: 'redCards' as const, label: t('live_notifications.red_cards', locale) },
              ]).map(({ key, label }) => {
                const isSubPref = key !== 'enabled';
                const disabled = isSubPref && !liveScorePrefs.enabled;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.formatRow, liveScorePrefs[key] && !disabled ? s.formatActive : s.formatInactive, disabled && { opacity: 0.4 }]}
                    onPress={() => !disabled && toggleLiveScorePref(key)}
                    disabled={disabled}
                    accessible={true}
                    accessibilityLabel={`${label}: ${liveScorePrefs[key] ? t('parental.enabled', locale) : t('parental.blocked', locale)}`}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: liveScorePrefs[key] }}
                  >
                    <Text style={[s.formatText, isSubPref && { paddingLeft: 12 }]}>{label}</Text>
                    <Text style={[s.formatBadge, liveScorePrefs[key] && !disabled ? s.badgeOn : s.badgeOff]}>
                      {liveScorePrefs[key] ? t('parental.enabled', locale) : t('parental.blocked', locale)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {/* News Sources */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('sources.catalog_title', locale)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                {t('parental.sources_selected', locale, { count: String(user?.selectedFeeds?.length ?? 0) })}
              </Text>
              <TouchableOpacity
                style={[s.button, { paddingVertical: 8, paddingHorizontal: 16 }]}
                onPress={() => navigation.navigate('RssCatalog')}
                accessible={true}
                accessibilityLabel={t('parental.manage_sources', locale)}
                accessibilityRole="button"
              >
                <Text style={[s.buttonText, { fontSize: 13 }]}>{t('parental.manage_sources', locale)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Feed Preview button */}
          <TouchableOpacity
            style={s.previewButton}
            onPress={openFeedPreview}
            disabled={previewLoading}
            accessible={true}
            accessibilityLabel={t('a11y.parental.preview_feed', locale, { name: user.name })}
            accessibilityRole="button"
          >
            {previewLoading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={s.previewButtonText}>
                {t('preview.button', locale, { name: user.name })}
              </Text>
            )}
          </TouchableOpacity>

          {saving && <Text style={s.saving}>{t('buttons.saving', locale)}</Text>}
        </>
      )}

      {/* Restrictions tab */}
      {activeTab === 'restrictions' && (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('parental.allowed_formats', locale)}</Text>
            {FORMATS.map((f) => {
              const active = (profile?.allowedFormats as string[])?.includes(f.id);
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[s.formatRow, active ? s.formatActive : s.formatInactive]}
                  onPress={() => toggleFormat(f.id)}
                  accessible={true}
                  accessibilityLabel={t('a11y.parental.toggle_format', locale, { format: t(f.labelKey, locale), state: active ? t('parental.enabled', locale) : t('parental.blocked', locale) })}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: active }}
                >
                  <Text style={s.formatText}>{f.emoji} {t(f.labelKey, locale)}</Text>
                  <Text style={[s.formatBadge, active ? s.badgeOn : s.badgeOff]}>
                    {active ? t('parental.enabled', locale) : t('parental.blocked', locale)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>{t('parental.max_daily_time', locale)}</Text>
            <View style={s.timeLimitGrid}>
              {TIME_PRESETS.map((mins) => {
                const active = currentTimeLimit === mins;
                const label = mins === 0 ? t('onboarding.no_limit', locale) : `${mins} min`;
                return (
                  <TouchableOpacity
                    key={mins}
                    style={[s.timeLimitChip, active && s.timeLimitActive]}
                    onPress={() => updateTimeLimit(mins)}
                    accessible={true}
                    accessibilityLabel={mins === 0 ? t('a11y.parental.no_time_limit', locale) : t('a11y.parental.select_time_limit', locale, { time: label })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[s.timeLimitText, active && { color: '#fff' }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Schedule lock */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('schedule.title', locale)}</Text>

            {/* Toggle */}
            <TouchableOpacity
              style={s.scheduleToggleRow}
              onPress={() => {
                const isEnabled = ((profile?.allowedHoursStart as number) ?? 0) !== 0 || ((profile?.allowedHoursEnd as number) ?? 24) !== 24;
                if (isEnabled) {
                  saveProfile({ allowedHoursStart: 0, allowedHoursEnd: 24 });
                } else {
                  saveProfile({ allowedHoursStart: 7, allowedHoursEnd: 21 });
                }
              }}
              accessible={true}
              accessibilityLabel={t('a11y.parental.toggle_schedule', locale)}
              accessibilityRole="switch"
              accessibilityState={{ checked: ((profile?.allowedHoursStart ?? 0) !== 0 || (profile?.allowedHoursEnd ?? 24) !== 24) }}
            >
              <Text style={[s.profileLabel, { flex: 1 }]}>{t('schedule.enable', locale)}</Text>
              <View style={[s.toggleTrack, ((profile?.allowedHoursStart ?? 0) !== 0 || (profile?.allowedHoursEnd ?? 24) !== 24) && s.toggleTrackActive]}>
                <View style={[s.toggleThumb, ((profile?.allowedHoursStart ?? 0) !== 0 || (profile?.allowedHoursEnd ?? 24) !== 24) && s.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            {((profile?.allowedHoursStart ?? 0) !== 0 || (profile?.allowedHoursEnd ?? 24) !== 24) && (
              <>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.profileLabel}>{t('schedule.start_time', locale)}</Text>
                    <View style={s.scheduleInputRow}>
                      <TouchableOpacity
                        style={s.scheduleBtn}
                        onPress={() => {
                          const val = ((profile?.allowedHoursStart as number) ?? 7) - 1;
                          if (val >= 0 && val < ((profile?.allowedHoursEnd as number) ?? 21)) saveProfile({ allowedHoursStart: val });
                        }}
                        accessibilityLabel={t('a11y.parental.decrease_start', locale)}
                        accessibilityRole="button"
                      >
                        <Text style={s.scheduleBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={s.scheduleValue}>{profile?.allowedHoursStart ?? 7}:00</Text>
                      <TouchableOpacity
                        style={s.scheduleBtn}
                        onPress={() => {
                          const val = ((profile?.allowedHoursStart as number) ?? 7) + 1;
                          if (val <= 23 && val < ((profile?.allowedHoursEnd as number) ?? 21)) saveProfile({ allowedHoursStart: val });
                        }}
                        accessibilityLabel={t('a11y.parental.increase_start', locale)}
                        accessibilityRole="button"
                      >
                        <Text style={s.scheduleBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.profileLabel}>{t('schedule.end_time', locale)}</Text>
                    <View style={s.scheduleInputRow}>
                      <TouchableOpacity
                        style={s.scheduleBtn}
                        onPress={() => {
                          const val = ((profile?.allowedHoursEnd as number) ?? 21) - 1;
                          if (val >= 0 && val > ((profile?.allowedHoursStart as number) ?? 7)) saveProfile({ allowedHoursEnd: val });
                        }}
                        accessibilityLabel={t('a11y.parental.decrease_end', locale)}
                        accessibilityRole="button"
                      >
                        <Text style={s.scheduleBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={s.scheduleValue}>{profile?.allowedHoursEnd ?? 21}:00</Text>
                      <TouchableOpacity
                        style={s.scheduleBtn}
                        onPress={() => {
                          const val = ((profile?.allowedHoursEnd as number) ?? 21) + 1;
                          if (val <= 24) saveProfile({ allowedHoursEnd: val });
                        }}
                        accessibilityLabel={t('a11y.parental.increase_end', locale)}
                        accessibilityRole="button"
                      >
                        <Text style={s.scheduleBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Timezone picker */}
                <Text style={[s.profileLabel, { marginTop: 12 }]}>{t('schedule.timezone', locale)}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6, marginBottom: 8 }}>
                  {['Europe/Madrid', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Mexico_City', 'Asia/Tokyo'].map((tz) => (
                    <TouchableOpacity
                      key={tz}
                      style={[s.timeChip, (profile?.timezone ?? 'Europe/Madrid') === tz && s.timeChipActive]}
                      onPress={() => saveProfile({ timezone: tz })}
                      accessible={true}
                      accessibilityLabel={t('a11y.parental.select_timezone', locale, { tz: tz.split('/')[1]?.replace('_', ' ') ?? tz })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: (profile?.timezone ?? 'Europe/Madrid') === tz }}
                    >
                      <Text style={[s.timeChipText, (profile?.timezone ?? 'Europe/Madrid') === tz && s.timeChipTextActive]}>
                        {tz.split('/')[1]?.replace('_', ' ') ?? tz}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Dynamic description */}
                <Text style={[s.scheduleDescription, { color: colors.muted }]}>
                  {t('schedule.description', locale, {
                    start: String(profile?.allowedHoursStart ?? 7),
                    end: String(profile?.allowedHoursEnd ?? 21),
                    timezone: (profile?.timezone as string) ?? 'Europe/Madrid',
                  })}
                </Text>
              </>
            )}

            {(profile?.allowedHoursStart ?? 0) === 0 && (profile?.allowedHoursEnd ?? 24) === 24 && (
              <Text style={[s.scheduleDescription, { color: colors.muted }]}>
                {t('schedule.all_day', locale)}
              </Text>
            )}
          </View>

          {/* Per-type time limit sliders */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('restrictions.per_type', locale)}</Text>
            <Text style={[s.perTypeTip, { color: colors.muted }]}>{t('restrictions.per_type_tip', locale)}</Text>

            {/* News limit */}
            <View style={s.perTypeRow}>
              <Text style={[s.perTypeLabel, { color: colors.text }]}>{t('restrictions.news_limit', locale)}</Text>
              <Text style={[s.perTypeValue, { color: colors.blue }]}>
                {(profile?.maxNewsMinutes ?? 0) === 0
                  ? t('restrictions.no_specific_limit', locale)
                  : t('restrictions.minutes', locale, { n: String(profile?.maxNewsMinutes) })}
              </Text>
            </View>
            <View style={s.timeLimitGrid}>
              {[0, 5, 15, 30, 60, 90, 120].map((mins) => {
                const active = (profile?.maxNewsMinutes ?? 0) === mins;
                const label = mins === 0 ? t('restrictions.no_specific_limit', locale) : `${mins} min`;
                return (
                  <TouchableOpacity
                    key={`news-${mins}`}
                    style={[s.timeLimitChip, active && s.timeLimitActive]}
                    onPress={() => saveProfile({ maxNewsMinutes: mins === 0 ? null : mins })}
                    accessible={true}
                    accessibilityLabel={mins === 0 ? t('a11y.parental.no_time_limit', locale) : t('a11y.parental.news_limit', locale, { time: label })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[s.timeLimitText, active && { color: '#fff' }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Reels limit */}
            <View style={[s.perTypeRow, { marginTop: 16 }]}>
              <Text style={[s.perTypeLabel, { color: colors.text }]}>{t('restrictions.reels_limit', locale)}</Text>
              <Text style={[s.perTypeValue, { color: colors.blue }]}>
                {(profile?.maxReelsMinutes ?? 0) === 0
                  ? t('restrictions.no_specific_limit', locale)
                  : t('restrictions.minutes', locale, { n: String(profile?.maxReelsMinutes) })}
              </Text>
            </View>
            <View style={s.timeLimitGrid}>
              {[0, 5, 15, 30, 60, 90, 120].map((mins) => {
                const active = (profile?.maxReelsMinutes ?? 0) === mins;
                const label = mins === 0 ? t('restrictions.no_specific_limit', locale) : `${mins} min`;
                return (
                  <TouchableOpacity
                    key={`reels-${mins}`}
                    style={[s.timeLimitChip, active && s.timeLimitActive]}
                    onPress={() => saveProfile({ maxReelsMinutes: mins === 0 ? null : mins })}
                    accessible={true}
                    accessibilityLabel={mins === 0 ? t('a11y.parental.no_time_limit', locale) : t('a11y.parental.reels_limit', locale, { time: label })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[s.timeLimitText, active && { color: '#fff' }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quiz limit */}
            <View style={[s.perTypeRow, { marginTop: 16 }]}>
              <Text style={[s.perTypeLabel, { color: colors.text }]}>{t('restrictions.quiz_limit', locale)}</Text>
              <Text style={[s.perTypeValue, { color: colors.blue }]}>
                {(profile?.maxQuizMinutes ?? 0) === 0
                  ? t('restrictions.no_specific_limit', locale)
                  : t('restrictions.minutes', locale, { n: String(profile?.maxQuizMinutes) })}
              </Text>
            </View>
            <View style={s.timeLimitGrid}>
              {[0, 5, 15, 30, 60, 90, 120].map((mins) => {
                const active = (profile?.maxQuizMinutes ?? 0) === mins;
                const label = mins === 0 ? t('restrictions.no_specific_limit', locale) : `${mins} min`;
                return (
                  <TouchableOpacity
                    key={`quiz-${mins}`}
                    style={[s.timeLimitChip, active && s.timeLimitActive]}
                    onPress={() => saveProfile({ maxQuizMinutes: mins === 0 ? null : mins })}
                    accessible={true}
                    accessibilityLabel={mins === 0 ? t('a11y.parental.no_time_limit', locale) : t('a11y.parental.quiz_limit', locale, { time: label })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[s.timeLimitText, active && { color: '#fff' }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {saving && <Text style={s.saving}>{t('buttons.saving', locale)}</Text>}
        </>
      )}

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('parental.weekly_activity', locale)}</Text>
          {activity ? (
            <View style={s.statsGrid}>
              <View style={[s.stat, { backgroundColor: colors.blue + '15' }]}>
                <Text style={[s.statNum, { color: colors.blue }]}>{activity.news_viewed ?? 0}</Text>
                <Text style={s.statLabel}>{t('parental.news_read', locale)}</Text>
              </View>
              <View style={[s.stat, { backgroundColor: '#9333EA' + '15' }]}>
                <Text style={[s.statNum, { color: '#9333EA' }]}>{activity.reels_viewed ?? 0}</Text>
                <Text style={s.statLabel}>{t('parental.reels_viewed', locale)}</Text>
              </View>
              <View style={[s.stat, { backgroundColor: colors.green + '15' }]}>
                <Text style={[s.statNum, { color: colors.green }]}>{activity.quizzes_played ?? 0}</Text>
                <Text style={s.statLabel}>{t('parental.quizzes_played', locale)}</Text>
              </View>
              <View style={[s.stat, { backgroundColor: colors.yellow + '15' }]}>
                <Text style={[s.statNum, { color: colors.yellow }]}>{activity.totalPoints ?? 0}</Text>
                <Text style={s.statLabel}>{t('parental.total_points', locale)}</Text>
              </View>
            </View>
          ) : (
            <ActivityIndicator color={COLORS.blue} />
          )}
        </View>
      )}

      {/* Digest tab */}
      {activeTab === 'digest' && (
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <Text style={[s.cardTitle, { color: colors.text }]}>{t('digest.title', locale)}</Text>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
            onPress={() => {
              const next = !digestEnabled;
              setDigestEnabledState(next);
              if (user) updateDigestPreferences(user.id, { digestEnabled: next }).catch(() => {});
            }}
            accessible={true}
            accessibilityLabel={t('a11y.parental.toggle_digest', locale)}
            accessibilityRole="switch"
            accessibilityState={{ checked: digestEnabled }}
          >
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.blue, backgroundColor: digestEnabled ? colors.blue : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
              {digestEnabled && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>}
            </View>
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>{t('digest.enable', locale)}</Text>
          </TouchableOpacity>

          {digestEnabled && (
            <View style={{ gap: 16 }}>
              <View>
                <Text style={[s.inputLabel, { color: colors.muted }]}>{t('digest.email_label', locale)}</Text>
                <TextInput
                  style={{ fontSize: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, color: colors.text }}
                  value={digestEmail}
                  onChangeText={setDigestEmailState}
                  onBlur={() => {
                    if (user) updateDigestPreferences(user.id, { digestEmail: digestEmail.trim() || null }).catch(() => {});
                  }}
                  placeholder={t('digest.email_placeholder', locale)}
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View>
                <Text style={[s.inputLabel, { color: colors.muted }]}>{t('digest.send_on', locale)}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: digestDay === day ? colors.blue : colors.border }}
                      onPress={() => {
                        setDigestDayState(day);
                        if (user) updateDigestPreferences(user.id, { digestDay: day }).catch(() => {});
                      }}
                      accessible={true}
                      accessibilityLabel={t('a11y.parental.select_digest_day', locale, { day: t(`digest.days.${day}`, locale) })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: digestDay === day }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: digestDay === day ? '600' : '500', color: digestDay === day ? '#fff' : colors.text }}>
                        {t(`digest.days.${day}`, locale)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[s.button, { marginTop: 8 }]}
                onPress={() => {
                  if (!user) return;
                  const url = `${API_BASE}/parents/digest/${user.id}/download`;
                  Linking.openURL(url);
                }}
                accessible={true}
                accessibilityLabel={t('a11y.parental.download_pdf', locale)}
                accessibilityRole="button"
              >
                <Text style={s.buttonText}>{t('digest.download_pdf', locale)}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Theme toggle in profile tab */}
      {activeTab === 'profile' && (
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <Text style={[s.cardTitle, { color: colors.text }]}>{t('theme.toggle', locale)}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['system', 'dark', 'light'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[s.timeLimitChip, theme === mode && { backgroundColor: colors.blue }]}
                onPress={() => setTheme(mode)}
                accessible={true}
                accessibilityLabel={t('a11y.parental.select_theme', locale, { mode: t(`theme.${mode}`, locale) })}
                accessibilityRole="button"
                accessibilityState={{ selected: theme === mode }}
              >
                <Text style={[s.timeLimitText, theme === mode && { color: '#fff' }]}>
                  {mode === 'system' ? '🔄' : mode === 'dark' ? '🌙' : '☀️'} {t(`theme.${mode}`, locale)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* PIN tab */}
      {activeTab === 'pin' && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('parental.change_pin', locale)}</Text>

          <Text style={s.inputLabel}>{t('parental.current_pin', locale)}</Text>
          <TextInput
            style={s.pinInputSmall}
            value={currentPinInput}
            onChangeText={(text) => { setCurrentPinInput(text.replace(/\D/g, '').slice(0, 4)); setPinChangeError(''); }}
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            placeholder="····"
            placeholderTextColor="#ccc"
          />

          <Text style={s.inputLabel}>{t('parental.new_pin', locale)}</Text>
          <TextInput
            style={s.pinInputSmall}
            value={newPinInput}
            onChangeText={(text) => { setNewPinInput(text.replace(/\D/g, '').slice(0, 4)); setPinChangeError(''); }}
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            placeholder="····"
            placeholderTextColor="#ccc"
          />

          <Text style={s.inputLabel}>{t('parental.confirm_pin', locale)}</Text>
          <TextInput
            style={s.pinInputSmall}
            value={confirmNewPin}
            onChangeText={(text) => { setConfirmNewPin(text.replace(/\D/g, '').slice(0, 4)); setPinChangeError(''); }}
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            placeholder="····"
            placeholderTextColor="#ccc"
          />

          {pinChangeError ? <Text style={s.error}>{pinChangeError}</Text> : null}

          <TouchableOpacity
            style={[s.button, { marginTop: 16 }, (currentPinInput.length < 4 || newPinInput.length < 4 || confirmNewPin.length < 4) && s.buttonDisabled]}
            onPress={handleChangePin}
            disabled={currentPinInput.length < 4 || newPinInput.length < 4 || confirmNewPin.length < 4}
            accessible={true}
            accessibilityLabel={t('a11y.parental.change_pin_button', locale)}
            accessibilityRole="button"
            accessibilityState={{ disabled: currentPinInput.length < 4 || newPinInput.length < 4 || confirmNewPin.length < 4 }}
          >
            <Text style={s.buttonText}>{t('parental.change_pin', locale)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Legal links */}
      <View style={s.legalRow}>
        <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`${WEB_BASE}/privacy?locale=${locale}`)} accessibilityLabel={t('a11y.legal.open_privacy', locale)} accessibilityRole="link">
          <Text style={s.legalLink}>{t('legal.privacy_policy', locale)}</Text>
        </TouchableOpacity>
        <Text style={s.legalDot}> · </Text>
        <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`${WEB_BASE}/terms?locale=${locale}`)} accessibilityLabel={t('a11y.legal.open_terms', locale)} accessibilityRole="link">
          <Text style={s.legalLink}>{t('legal.terms_of_service', locale)}</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone — Delete Account */}
      <View style={s.dangerZone}>
        <Text style={s.dangerTitle}>{t('delete_account.title', locale)}</Text>
        <Text style={s.dangerDescription}>{t('delete_account.description', locale)}</Text>
        <TouchableOpacity
          style={s.dangerButton}
          accessible={true}
          accessibilityLabel={t('delete_account.button', locale)}
          accessibilityRole="button"
          onPress={() => {
            if (!user) return;
            Alert.alert(
              t('delete_account.confirm_title', locale),
              [
                t('delete_account.confirm_body', locale, { name: user.name }),
                '',
                `- ${t('delete_account.confirm_reading', locale)}`,
                `- ${t('delete_account.confirm_quiz', locale)}`,
                `- ${t('delete_account.confirm_stickers', locale)}`,
                `- ${t('delete_account.confirm_streaks', locale)}`,
                `- ${t('delete_account.confirm_parental', locale)}`,
                `- ${t('delete_account.confirm_activity', locale)}`,
                '',
                t('delete_account.confirm_warning', locale),
              ].join('\n'),
              [
                { text: t('delete_account.confirm_cancel', locale), style: 'cancel' },
                {
                  text: t('delete_account.confirm_delete', locale),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const token = await getAccessToken();
                      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                      if (token) headers['Authorization'] = `Bearer ${token}`;
                      const { getParentalSessionToken } = await import('../lib/api');
                      const sessionToken = getParentalSessionToken();
                      if (sessionToken) headers['X-Parental-Session'] = sessionToken;
                      const res = await fetch(`${API_BASE}/users/${user.id}/data`, {
                        method: 'DELETE',
                        headers,
                      });
                      if (!res.ok) throw new Error(`Error ${res.status}`);
                      await AsyncStorage.clear();
                      logout();
                    } catch {
                      Alert.alert(t('errors.connection_error', locale));
                    }
                  },
                },
              ],
            );
          }}
          testID="delete-account-button"
        >
          <Text style={s.dangerButtonText}>{t('delete_account.button', locale)}</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>

    {/* Feed Preview Modal */}
    <Modal visible={previewVisible} animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
      <View style={[s.previewOverlay, { paddingTop: 54 }]}>
        <View style={s.previewHeader}>
          <Text style={s.previewTitle} numberOfLines={1}>
            {t('preview.title', locale, { name: user.name })}
          </Text>
          <TouchableOpacity style={s.previewClose} onPress={() => setPreviewVisible(false)} accessibilityLabel={t('a11y.parental.close_preview', locale)} accessibilityRole="button">
            <Text style={s.previewCloseText}>{t('preview.close', locale)}</Text>
          </TouchableOpacity>
        </View>

        {/* Restrictions banner */}
        <View style={s.restrictionsBanner}>
          <Text style={s.restrictionsBannerTitle}>
            {profile?.allowedFormats?.length === 3 && !profile?.maxDailyTimeMinutes
              ? t('preview.no_restrictions', locale)
              : t('preview.active_restrictions', locale)}
          </Text>
          {profile && (
            <Text style={s.restrictionsBannerText}>
              {(profile.allowedFormats as string[])?.map((f: string) => t(`nav.${f}`, locale)).join(', ')}
              {profile.maxDailyTimeMinutes ? ` · ${profile.maxDailyTimeMinutes} min/day` : ''}
            </Text>
          )}
        </View>

        <ScrollView>
          {/* News Section */}
          {previewNews.length > 0 && (
            <>
              <View style={s.previewSection}>
                <Text style={s.previewSectionTitle}>{t('preview.news_section', locale)}</Text>
              </View>
              {previewNews.slice(0, 10).map((item) => (
                <View key={item.id} style={s.previewNewsItem}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={s.previewNewsImage} />
                  ) : null}
                  <View style={s.previewNewsContent}>
                    <Text style={s.previewNewsTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={s.previewNewsMeta}>{item.source} · {sportToEmoji(item.sport)} {getSportLabel(item.sport, locale)}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Reels Section */}
          {previewReels.length > 0 && (
            <>
              <View style={s.previewSection}>
                <Text style={s.previewSectionTitle}>{t('preview.reels_section', locale)}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                {previewReels.slice(0, 10).map((reel) => (
                  <View key={reel.id} style={s.previewReelItem}>
                    {reel.thumbnailUrl ? (
                      <Image source={{ uri: reel.thumbnailUrl }} style={s.previewReelImage} />
                    ) : null}
                    <View style={s.previewReelTitle}>
                      <Text style={s.previewReelTitleText} numberOfLines={2}>{reel.title}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          {/* Quiz status */}
          <View style={s.previewSection}>
            <Text style={s.previewSectionTitle}>
              {previewQuizAvailable ? t('preview.quiz_available', locale) : t('preview.quiz_blocked', locale)}
            </Text>
          </View>

          {/* Empty state */}
          {previewNews.length === 0 && previewReels.length === 0 && (
            <View style={s.previewEmpty}>
              <Text style={{ fontSize: 48 }}>📭</Text>
              <Text style={s.previewEmptyText}>{t('preview.no_content', locale)}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    title: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 12 },
    subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 20 },
    pinInput: { fontSize: 32, fontWeight: '700', textAlign: 'center', letterSpacing: 16, width: 200, paddingVertical: 16, borderBottomWidth: 3, borderBottomColor: colors.border, marginTop: 24, marginBottom: 8 },
    pinInputSmall: { fontSize: 24, fontWeight: '700', textAlign: 'center', letterSpacing: 12, width: '100%', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: colors.border, marginBottom: 12 },
    inputLabel: { fontSize: 13, color: colors.muted, marginTop: 8, marginBottom: 4 },
    error: { color: '#EF4444', fontSize: 13, marginTop: 8 },
    button: { backgroundColor: colors.blue, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, alignItems: 'center' },
    buttonDisabled: { opacity: 0.4 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    tabBar: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 12, padding: 4, marginBottom: 16 },
    tab: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
    tabActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
    tabText: { fontSize: 13, fontWeight: '500', color: colors.muted },
    tabTextActive: { color: colors.text, fontWeight: '600' },
    card: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    stat: { flex: 1, minWidth: '40%', borderRadius: 12, padding: 16, alignItems: 'center' },
    statNum: { fontSize: 28, fontWeight: '700' },
    statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
    formatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 2, marginBottom: 8 },
    formatActive: { borderColor: colors.green, backgroundColor: colors.green + '10' },
    formatInactive: { borderColor: colors.border, backgroundColor: colors.background },
    formatText: { fontSize: 14, fontWeight: '500', color: colors.text },
    formatBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, overflow: 'hidden' },
    badgeOn: { backgroundColor: colors.green, color: '#fff' },
    badgeOff: { backgroundColor: '#D1D5DB', color: '#fff' },
    timeLimitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    timeLimitChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.border, minWidth: '28%', alignItems: 'center' },
    timeLimitActive: { backgroundColor: colors.blue },
    timeLimitText: { fontSize: 13, fontWeight: '600', color: colors.muted },
    perTypeTip: { fontSize: 12, marginBottom: 12 },
    perTypeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    perTypeLabel: { fontSize: 14, fontWeight: '600' },
    perTypeValue: { fontSize: 13, fontWeight: '500' },
    saving: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 8 },
    tabBarScroll: { marginBottom: 16 },
    tabBarContent: { backgroundColor: colors.border, borderRadius: 12, padding: 4, gap: 0 },
    profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    profileLabel: { fontSize: 13, color: colors.muted, flex: 1 },
    profileValue: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'right' },
    sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    sportChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
    sportChipActive: { backgroundColor: colors.green },
    sportChipInactive: { backgroundColor: colors.border },
    sportChipText: { fontSize: 13, fontWeight: '500', color: colors.muted },
    scheduleInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 },
    scheduleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
    scheduleBtnText: { fontSize: 20, fontWeight: '600', color: colors.text },
    scheduleValue: { fontSize: 18, fontWeight: '700', color: colors.text, minWidth: 60, textAlign: 'center' },
    scheduleToggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingVertical: 4 },
    toggleTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.border, justifyContent: 'center', paddingHorizontal: 2 },
    toggleTrackActive: { backgroundColor: colors.blue },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
    toggleThumbActive: { alignSelf: 'flex-end' },
    scheduleDescription: { fontSize: 12, marginTop: 8, lineHeight: 18 },
    // Feed preview modal styles
    previewButton: { backgroundColor: colors.blue, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
    previewButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    previewOverlay: { flex: 1, backgroundColor: colors.background },
    previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    previewTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
    previewClose: { padding: 8 },
    previewCloseText: { fontSize: 16, fontWeight: '600', color: colors.blue },
    restrictionsBanner: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    restrictionsBannerTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 4 },
    restrictionsBannerText: { fontSize: 12, color: colors.muted },
    previewSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    previewSectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 },
    previewNewsItem: { backgroundColor: colors.surface, borderRadius: 12, marginHorizontal: 16, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    previewNewsImage: { width: '100%', height: 120, resizeMode: 'cover' },
    previewNewsContent: { padding: 12 },
    previewNewsTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
    previewNewsMeta: { fontSize: 12, color: colors.muted },
    previewReelItem: { width: 120, height: 170, borderRadius: 12, marginRight: 10, overflow: 'hidden', backgroundColor: '#000' },
    previewReelImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    previewReelTitle: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6 },
    previewReelTitleText: { color: '#fff', fontSize: 11, fontWeight: '500' },
    previewEmpty: { alignItems: 'center', paddingVertical: 40 },
    previewEmptyText: { fontSize: 14, color: colors.muted, marginTop: 8 },
    legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
    legalLink: { fontSize: 13, color: colors.blue, textDecorationLine: 'underline' },
    legalDot: { fontSize: 13, color: colors.muted },
    dangerZone: { backgroundColor: '#FEF2F2', borderRadius: 16, padding: 20, marginTop: 24, borderWidth: 1, borderColor: '#FECACA' },
    dangerTitle: { fontSize: 16, fontWeight: '700', color: '#DC2626', marginBottom: 8 },
    dangerDescription: { fontSize: 13, color: '#7F1D1D', lineHeight: 18, marginBottom: 16 },
    dangerButton: { backgroundColor: '#DC2626', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    dangerButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    timeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
    timeChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
    timeChipText: { fontSize: 12, color: colors.text },
    timeChipTextActive: { color: '#FFFFFF' },
  });
}
