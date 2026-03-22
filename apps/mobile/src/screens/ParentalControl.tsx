import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, t } from '@sportykids/shared';
import { useUser } from '../lib/user-context';

const API_BASE = 'http://localhost:3001/api';

type ScreenState = 'loading' | 'create-pin' | 'confirm-pin' | 'verify-pin' | 'panel';

const FORMATS = [
  { id: 'news', labelKey: 'nav.news', emoji: '📰' },
  { id: 'reels', labelKey: 'nav.reels', emoji: '🎬' },
  { id: 'quiz', labelKey: 'nav.quiz', emoji: '🧠' },
];

export function ParentalControlScreen() {
  const { user, locale } = useUser();
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [pin, setPin] = useState('');
  const [tempPin, setTempPin] = useState('');
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [activity, setActivity] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_BASE}/parents/profile/${user.id}`)
      .then((r) => r.json())
      .then((d) => setScreenState(d.exists ? 'verify-pin' : 'create-pin'))
      .catch(() => setScreenState('create-pin'));
  }, [user]);

  const verify = async () => {
    if (!user || pin.length !== 4) return;
    try {
      const res = await fetch(`${API_BASE}/parents/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, pin }),
      });
      const data = await res.json();
      if (data.verified) {
        setProfile(data.profile);
        fetch(`${API_BASE}/parents/activity/${user.id}`).then((r) => r.json()).then(setActivity);
        setScreenState('panel');
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
      const res = await fetch(`${API_BASE}/parents/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, pin }),
      });
      const data = await res.json();
      setProfile(data);
      fetch(`${API_BASE}/parents/activity/${user.id}`).then((r) => r.json()).then(setActivity);
      setScreenState('panel');
    } catch { setError(t('errors.create_pin_failed', locale)); }
    setPin('');
  };

  const toggleFormat = async (format: string) => {
    if (!user || !profile) return;
    const formats = (profile.allowedFormats as string[]).includes(format)
      ? (profile.allowedFormats as string[]).filter((f) => f !== format)
      : [...(profile.allowedFormats as string[]), format];
    if (formats.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/parents/profile/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedFormats: formats }),
      });
      setProfile(await res.json());
    } catch { /* */ }
    setSaving(false);
  };

  if (!user || screenState === 'loading') return <ActivityIndicator style={{ flex: 1 }} color={COLORS.blue} />;

  if (screenState !== 'panel') {
    const heading =
      screenState === 'create-pin' ? t('parental.create_pin', locale)
      : screenState === 'confirm-pin' ? t('parental.confirm_pin', locale)
      : t('parental.enter_pin', locale);
    const action = screenState === 'create-pin' ? createPin : screenState === 'confirm-pin' ? confirmPin : verify;
    return (
      <View style={s.container}>
        <View style={s.center}>
          <Text style={{ fontSize: 56 }}>🔒</Text>
          <Text style={s.title}>{heading}</Text>
          <TextInput
            style={s.pinInput}
            value={pin}
            onChangeText={(text) => { setPin(text.replace(/\D/g, '').slice(0, 4)); setError(''); }}
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            placeholder="····"
            placeholderTextColor="#ccc"
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <TouchableOpacity style={[s.button, pin.length < 4 && s.buttonDisabled]} onPress={action} disabled={pin.length < 4}>
            <Text style={s.buttonText}>
              {screenState === 'verify-pin' ? t('buttons.access', locale) : t('buttons.next', locale)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>{t('parental.control', locale)}</Text>
      <Text style={s.subtitle}>{t('parental.manage_content', locale, { name: user.name })}</Text>

      {activity && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('parental.weekly_activity', locale)}</Text>
          <View style={s.statsGrid}>
            <View style={[s.stat, { backgroundColor: '#EFF6FF' }]}>
              <Text style={[s.statNum, { color: COLORS.blue }]}>{activity.news_viewed ?? 0}</Text>
              <Text style={s.statLabel}>{t('parental.news_read', locale)}</Text>
            </View>
            <View style={[s.stat, { backgroundColor: '#F3E8FF' }]}>
              <Text style={[s.statNum, { color: '#9333EA' }]}>{activity.reels_viewed ?? 0}</Text>
              <Text style={s.statLabel}>{t('nav.reels', locale)}</Text>
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
        </View>
      )}

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
        {saving && <Text style={s.saving}>{t('buttons.saving', locale)}</Text>}
      </View>
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
  error: { color: '#EF4444', fontSize: 13, marginTop: 8 },
  button: { backgroundColor: COLORS.blue, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, marginTop: 24 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
  saving: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
});
