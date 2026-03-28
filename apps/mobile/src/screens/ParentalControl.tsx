import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { COLORS, SPORTS, t, sportToEmoji, getSportLabel, getAgeRangeLabel } from '@sportykids/shared';
import * as Haptics from 'expo-haptics';
import type { AgeRange } from '@sportykids/shared';
import {
  getParentalProfile, verifyPin, setupParentalPin,
  updateParentalProfile, fetchActivity,
} from '../lib/api';
import { useUser } from '../lib/user-context';

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
type TabId = 'profile' | 'content' | 'restrictions' | 'activity' | 'pin';

const FORMATS = [
  { id: 'news', labelKey: 'nav.news', emoji: '📰' },
  { id: 'reels', labelKey: 'nav.reels', emoji: '🎬' },
  { id: 'quiz', labelKey: 'nav.quiz', emoji: '🧠' },
];

const TIME_PRESETS = [15, 30, 60, 90, 120, 0]; // 0 = no limit

export function ParentalControlScreen() {
  const { user, parentalProfile, setParentalProfile, locale } = useUser();
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [pin, setPin] = useState('');
  const [tempPin, setTempPin] = useState('');
  const [profile, setProfile] = useState<ParentalProfileData | null>(null);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  // Lockout state
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // PIN change state
  const [changingPin, setChangingPin] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');

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
          setProfile(data.profile as ParentalProfileData);
          setParentalProfile(data.profile);
        }
        setLockedUntil(null);
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
      setProfile(data as ParentalProfileData);
      setParentalProfile(data);
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
      setProfile(updated as ParentalProfileData);
      setParentalProfile(updated);
    } catch { /* */ }
    setSaving(false);
  };

  const toggleFormat = async (format: string) => {
    if (!user || !profile) return;
    const formats = (profile.allowedFormats as string[]).includes(format)
      ? (profile.allowedFormats as string[]).filter((f) => f !== format)
      : [...(profile.allowedFormats as string[]), format];
    if (formats.length === 0) return;
    setSaving(true);
    try {
      const updated = await updateParentalProfile(user.id, { allowedFormats: formats });
      setProfile(updated as ParentalProfileData);
      setParentalProfile(updated);
    } catch { /* */ }
    setSaving(false);
  };

  const updateTimeLimit = async (minutes: number) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateParentalProfile(user.id, {
        maxDailyTimeMinutes: minutes > 0 ? minutes : undefined,
      });
      setProfile(updated as ParentalProfileData);
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
      setProfile(updated as ParentalProfileData);
      setParentalProfile(updated);
      setChangingPin(false);
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmNewPin('');
      setPinChangeError('');
      Alert.alert(t('parental.pin_changed', locale));
    } catch {
      setPinChangeError(t('errors.create_pin_failed', locale));
    }
  };

  if (!user || screenState === 'loading') return <ActivityIndicator style={{ flex: 1 }} color={COLORS.blue} />;

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
      <View style={s.container}>
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
                <View style={{ width: `${Math.max(0, 1 - countdown / 900) * 100}%`, height: 6, backgroundColor: '#EF4444', borderRadius: 3 } as any} />
              </View>
            </View>
          ) : error ? (
            <Text style={s.error}>{error}</Text>
          ) : null}
          <TouchableOpacity
            style={[s.button, (pin.length < 4 || isLocked) && s.buttonDisabled]}
            onPress={action}
            disabled={pin.length < 4 || isLocked}
          >
            <Text style={s.buttonText}>
              {screenState === 'verify-pin' ? t('buttons.access', locale) : t('buttons.next', locale)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Panel with tabs
  const currentTimeLimit = (profile?.maxDailyTimeMinutes as number) ?? 0;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>{t('parental.control', locale)}</Text>
      <Text style={s.subtitle}>{t('parental.manage_content', locale, { name: user.name })}</Text>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarScroll} contentContainerStyle={s.tabBarContent}>
        {(['profile', 'content', 'restrictions', 'activity', 'pin'] as TabId[]).map((tab) => {
          const labels: Record<TabId, string> = {
            profile: t('parental.tab_profile', locale),
            content: t('parental.tab_content', locale),
            restrictions: t('parental.tab_restrictions', locale),
            activity: t('parental.tab_activity', locale),
            pin: t('parental.tab_pin', locale),
          };
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{labels[tab]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('onboarding.step1_title', locale).replace(/[!?¡¿]/g, '')}</Text>
          <View style={s.profileRow}>
            <Text style={s.profileLabel}>{t('onboarding.step1_title', locale).replace(/[!?¡¿]/g, '')}</Text>
            <Text style={s.profileValue}>{user.name}</Text>
          </View>
          <View style={s.profileRow}>
            <Text style={s.profileLabel}>{t('onboarding.age_question', locale).replace(/[!?¡¿]/g, '')}</Text>
            <Text style={s.profileValue}>
              {user.age} ({getAgeRangeLabel(
                user.age <= 8 ? '6-8' : user.age <= 11 ? '9-11' : '12-14',
                locale,
              )})
            </Text>
          </View>
          <View style={s.profileRow}>
            <Text style={s.profileLabel}>{t('onboarding.step2_title', locale).replace(/[!?¡¿]/g, '')}</Text>
            <Text style={s.profileValue}>
              {(user.favoriteSports ?? []).map((sp: string) => `${sportToEmoji(sp)} ${getSportLabel(sp, locale)}`).join(', ') || '—'}
            </Text>
          </View>
          <View style={s.profileRow}>
            <Text style={s.profileLabel}>{t('onboarding.step3_title', locale).replace(/[!?¡¿]/g, '')}</Text>
            <Text style={s.profileValue}>{user.favoriteTeam || '—'}</Text>
          </View>
        </View>
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
                const active = (user.favoriteSports ?? []).includes(sport);
                return (
                  <View
                    key={sport}
                    style={[s.sportChip, active ? s.sportChipActive : s.sportChipInactive]}
                  >
                    <Text style={[s.sportChipText, active && { color: '#fff' }]}>
                      {sportToEmoji(sport)} {getSportLabel(sport, locale)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

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
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.profileLabel}>{t('schedule.start_time', locale)}</Text>
                <View style={s.scheduleInputRow}>
                  <TouchableOpacity
                    style={s.scheduleBtn}
                    onPress={() => {
                      const val = ((profile?.allowedHoursStart as number) ?? 7) - 1;
                      if (val >= 0 && val < ((profile?.allowedHoursEnd as number) ?? 21)) saveProfile({ allowedHoursStart: val });
                    }}
                  >
                    <Text style={s.scheduleBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.scheduleValue}>{profile?.allowedHoursStart ?? 7}:00</Text>
                  <TouchableOpacity
                    style={s.scheduleBtn}
                    onPress={() => {
                      const val = ((profile?.allowedHoursStart as number) ?? 7) + 1;
                      if (val <= 23 && val < ((profile?.allowedHoursEnd as number) ?? 21)) saveProfile({ allowedHoursStart: val });
                    }}
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
                  >
                    <Text style={s.scheduleBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.scheduleValue}>{profile?.allowedHoursEnd ?? 21}:00</Text>
                  <TouchableOpacity
                    style={s.scheduleBtn}
                    onPress={() => {
                      const val = ((profile?.allowedHoursEnd as number) ?? 21) + 1;
                      if (val <= 24) saveProfile({ allowedHoursEnd: val });
                    }}
                  >
                    <Text style={s.scheduleBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
              <View style={[s.stat, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[s.statNum, { color: COLORS.blue }]}>{activity.news_viewed ?? 0}</Text>
                <Text style={s.statLabel}>{t('parental.news_read', locale)}</Text>
              </View>
              <View style={[s.stat, { backgroundColor: '#F3E8FF' }]}>
                <Text style={[s.statNum, { color: '#9333EA' }]}>{activity.reels_viewed ?? 0}</Text>
                <Text style={s.statLabel}>{t('parental.reels_viewed', locale)}</Text>
              </View>
              <View style={[s.stat, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[s.statNum, { color: COLORS.green }]}>{activity.quizzes_played ?? 0}</Text>
                <Text style={s.statLabel}>{t('parental.quizzes_played', locale)}</Text>
              </View>
              <View style={[s.stat, { backgroundColor: '#FEF9C3' }]}>
                <Text style={[s.statNum, { color: COLORS.yellow }]}>{activity.totalPoints ?? 0}</Text>
                <Text style={s.statLabel}>{t('parental.total_points', locale)}</Text>
              </View>
            </View>
          ) : (
            <ActivityIndicator color={COLORS.blue} />
          )}
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
          >
            <Text style={s.buttonText}>{t('parental.change_pin', locale)}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.darkText, marginTop: 12 },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 4, marginBottom: 20 },
  pinInput: { fontSize: 32, fontWeight: '700', textAlign: 'center', letterSpacing: 16, width: 200, paddingVertical: 16, borderBottomWidth: 3, borderBottomColor: '#E5E7EB', marginTop: 24, marginBottom: 8 },
  pinInputSmall: { fontSize: 24, fontWeight: '700', textAlign: 'center', letterSpacing: 12, width: '100%', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: '#E5E7EB', marginBottom: 12 },
  inputLabel: { fontSize: 13, color: '#6B7280', marginTop: 8, marginBottom: 4 },
  error: { color: '#EF4444', fontSize: 13, marginTop: 8 },
  button: { backgroundColor: COLORS.blue, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tabBar: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },
  tabTextActive: { color: COLORS.darkText, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.darkText, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flex: 1, minWidth: '40%', borderRadius: 12, padding: 16, alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  formatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 2, marginBottom: 8 },
  formatActive: { borderColor: COLORS.green, backgroundColor: '#F0FDF4' },
  formatInactive: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  formatText: { fontSize: 14, fontWeight: '500', color: COLORS.darkText },
  formatBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, overflow: 'hidden' },
  badgeOn: { backgroundColor: COLORS.green, color: '#fff' },
  badgeOff: { backgroundColor: '#D1D5DB', color: '#fff' },
  timeLimitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeLimitChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', minWidth: '28%', alignItems: 'center' },
  timeLimitActive: { backgroundColor: COLORS.blue },
  timeLimitText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  saving: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  tabBarScroll: { marginBottom: 16 },
  tabBarContent: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, gap: 0 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  profileLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  profileValue: { fontSize: 14, fontWeight: '600', color: COLORS.darkText, flex: 1, textAlign: 'right' },
  sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sportChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  sportChipActive: { backgroundColor: COLORS.green },
  sportChipInactive: { backgroundColor: '#F3F4F6' },
  sportChipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  scheduleInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 },
  scheduleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  scheduleBtnText: { fontSize: 20, fontWeight: '600', color: COLORS.darkText },
  scheduleValue: { fontSize: 18, fontWeight: '700', color: COLORS.darkText, minWidth: 60, textAlign: 'center' },
});
