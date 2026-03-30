import { useState, useEffect, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { t } from '@sportykids/shared';
import { useUser } from '../lib/user-context';
import { API_BASE } from '../config';

interface ScheduleLockInfo {
  locked: boolean;
  start: number;
  end: number;
}

/**
 * Checks the parental schedule lock by probing the API.
 * Re-checks every time the screen gains focus (e.g., after leaving Parental Controls).
 * If locked, renders a friendly bedtime screen instead of children.
 */
export function ScheduleLockGuard({ children }: { children: React.ReactNode }) {
  const { user, locale, colors } = useUser();
  const isFocused = useIsFocused();
  const [lockInfo, setLockInfo] = useState<ScheduleLockInfo | null>(null);
  const [checked, setChecked] = useState(false);

  const checkSchedule = useCallback(async () => {
    if (!user?.id) {
      setLockInfo(null);
      setChecked(true);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/news?userId=${user.id}&limit=1`);
      if (res.status === 403) {
        const body = await res.json();
        const details = body?.error?.details ?? body?.error ?? {};
        if (details.error === 'schedule_locked') {
          setLockInfo({
            locked: true,
            start: details.allowedHoursStart ?? 0,
            end: details.allowedHoursEnd ?? 24,
          });
          setChecked(true);
          return;
        }
      }
      setLockInfo(null);
    } catch {
      setLockInfo(null);
    } finally {
      setChecked(true);
    }
  }, [user?.id]);

  // Re-check every time the tab gains focus
  useEffect(() => {
    if (isFocused) {
      checkSchedule();
    }
  }, [isFocused, checkSchedule]);

  if (!checked) return null;

  if (lockInfo?.locked) {
    const formatHour = (h: number) => `${h}:00`;
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: colors.background }}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>&#x1F319;</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
          {t('schedule.locked_title', locale)}
        </Text>
        <Text style={{ fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 20 }}>
          {t('schedule.locked_message', locale, { start: formatHour(lockInfo.start), end: formatHour(lockInfo.end) })}
        </Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 14, color: colors.muted }}>
            {t('schedule.available_hours', locale)}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.blue, marginTop: 4 }}>
            {formatHour(lockInfo.start)} – {formatHour(lockInfo.end)}
          </Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}
