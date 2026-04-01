import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t } from '@sportykids/shared';
import { haptic } from '../lib/haptics';
import type { Locale } from '@sportykids/shared';
import { fetchTodayMission, claimMission } from '../lib/api';
import type { ThemeColors } from '../lib/theme';

interface Mission {
  id: string;
  type: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  rewardType: string;
  rewardRarity: string | null;
  rewardPoints: number;
}

interface MissionCardProps {
  userId: string;
  locale: Locale;
  colors: ThemeColors;
}

export function MissionCard({ userId, locale, colors }: MissionCardProps) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [expired, setExpired] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const loadMission = useCallback(() => {
    fetchTodayMission(userId)
      .then((data) => {
        if (data && data.mission) {
          setMission(data.mission as unknown as Mission);
          setExpired(false);
        } else {
          setMission(null);
          setExpired((data as { expired?: boolean })?.expired ?? true);
        }
      })
      .catch((err) => {
        if (__DEV__) console.warn('Failed to load mission:', err); // eslint-disable-line no-console
      });
  }, [userId]);

  useEffect(() => {
    loadMission();
  }, [loadMission]);

  useEffect(() => {
    if (mission?.claimed) {
      const timer = setTimeout(() => setCollapsed(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [mission?.claimed]);

  // Expired state
  if (expired && !mission) {
    return (
      <View style={[s.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ fontSize: 24 }}>{'\u{1F319}'}</Text>
        <Text style={[s.expiredText, { color: colors.muted }]}>
          {t('mission.no_mission', locale)}
        </Text>
      </View>
    );
  }

  if (!mission || collapsed) return null;

  const progressPercent = Math.min(100, Math.round((mission.progress / mission.target) * 100));

  const handleClaim = async () => {
    setClaiming(true);
    haptic('success');
    try {
      await claimMission(userId);
      setMission((prev) => prev ? { ...prev, claimed: true } : prev);
    } catch (err) {
      if (__DEV__) console.warn('Failed to claim mission:', err); // eslint-disable-line no-console
    } finally {
      setClaiming(false);
    }
  };

  // Claimed
  if (mission.claimed) {
    return (
      <View style={[s.container, { backgroundColor: colors.green + '15', borderColor: colors.green + '40' }]}>
        <Text style={{ fontSize: 20 }}>{'\u2705'}</Text>
        <Text style={[s.claimedText, { color: colors.green }]}>
          {t('mission.completed', locale)}
        </Text>
      </View>
    );
  }

  // Completed unclaimed
  if (mission.completed) {
    return (
      <View style={[s.container, { backgroundColor: colors.yellow + '15', borderColor: colors.yellow + '60', borderWidth: 2 }]}>
        <View style={s.row}>
          <Text style={{ fontSize: 24 }}>{'\u{1F3C6}'}</Text>
          <View style={s.textContainer}>
            <Text style={[s.title, { color: colors.text }]}>{mission.title}</Text>
            <Text style={[s.desc, { color: colors.muted }]}>{mission.description}</Text>
          </View>
        </View>
        <View style={[s.progressBar, { backgroundColor: colors.border }]}>
          <View style={[s.progressFill, { width: '100%', backgroundColor: colors.yellow }]} />
        </View>
        <TouchableOpacity
          style={[s.claimButton, { backgroundColor: colors.yellow }]}
          onPress={handleClaim}
          disabled={claiming}
          accessible={true}
          accessibilityLabel={t('a11y.mission.claim_reward', locale)}
          accessibilityRole="button"
          accessibilityState={{ disabled: claiming }}
        >
          <Text style={s.claimButtonText}>
            {claiming ? t('buttons.loading', locale) : t('mission.claim', locale)}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Uncompleted
  return (
    <View style={[s.container, { backgroundColor: colors.blue + '10', borderColor: colors.blue + '30' }]}>
      <View style={s.row}>
        <Text style={{ fontSize: 24 }}>{'\u{1F3AF}'}</Text>
        <View style={s.textContainer}>
          <Text style={[s.label, { color: colors.blue }]}>{t('mission.today', locale)}</Text>
          <Text style={[s.title, { color: colors.text }]}>{mission.title}</Text>
          <Text style={[s.desc, { color: colors.muted }]}>{mission.description}</Text>
        </View>
        {mission.rewardPoints > 0 && (
          <View style={[s.rewardBadge, { backgroundColor: colors.yellow + '30' }]}>
            <Text style={[s.rewardText, { color: colors.yellow }]}>+{mission.rewardPoints}</Text>
          </View>
        )}
      </View>
      <View style={[s.progressBar, { backgroundColor: colors.border }]}>
        <View style={[s.progressFill, { width: `${progressPercent}%`, backgroundColor: colors.blue }]} />
      </View>
      <Text
        style={[s.progressText, { color: colors.muted }]}
        accessibilityLabel={t('a11y.mission.progress', locale, { progress: String(mission.progress), target: String(mission.target) })}
      >
        {t('mission.progress', locale, { progress: String(mission.progress), target: String(mission.target) })}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  desc: {
    fontSize: 12,
    marginTop: 2,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    textAlign: 'right',
  },
  claimButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  claimButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A', // Dark text on yellow button, constant in both themes
  },
  claimedText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  expiredText: {
    fontSize: 13,
    marginLeft: 8,
  },
  rewardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rewardText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
