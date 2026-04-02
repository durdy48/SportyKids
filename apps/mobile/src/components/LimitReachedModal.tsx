import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { t, COLORS } from '@sportykids/shared';
import { useUser } from '../lib/user-context';

export type SubscriptionLimitType = 'news' | 'reels' | 'quiz' | 'sport';

interface LimitReachedModalProps {
  visible: boolean;
  limitType: SubscriptionLimitType;
  onDismiss: () => void;
}

const EMOJIS: Record<SubscriptionLimitType, string> = {
  news: '\u{1F4F0}',
  reels: '\u{1F3AC}',
  quiz: '\u{1F9E0}',
  sport: '\u{26BD}',
};

const MESSAGE_KEYS: Record<SubscriptionLimitType, string> = {
  news: 'subscription.limit_reached_news',
  reels: 'subscription.limit_reached_reels',
  quiz: 'subscription.limit_reached_quiz',
  sport: 'subscription.limit_reached_sport',
};

export function LimitReachedModal({ visible, limitType, onDismiss }: LimitReachedModalProps) {
  const { user, locale, colors } = useUser();
  const navigation = useNavigation();
  const isChild = user?.role === 'child';

  const handleUpgrade = () => {
    onDismiss();
    if (isChild) {
      (navigation as { navigate: (s: string) => void }).navigate('Parents');
    } else {
      (navigation as { navigate: (s: string) => void }).navigate('Upgrade');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={s.overlay}>
        <View
          style={[s.card, { backgroundColor: colors.surface }]}
          accessibilityRole="alert"
          accessibilityLabel={t(MESSAGE_KEYS[limitType], locale)}
        >
          <Text style={s.emoji} accessibilityLabel={t(MESSAGE_KEYS[limitType], locale)}>
            {EMOJIS[limitType]}
          </Text>

          <Text style={[s.title, { color: colors.text }]}>
            {t(MESSAGE_KEYS[limitType], locale)}
          </Text>

          <Text style={[s.subtitle, { color: colors.muted }]}>
            {t('subscription.limit_reached_cta', locale)}
          </Text>

          <TouchableOpacity
            style={[s.upgradeButton, { backgroundColor: COLORS.blue }]}
            onPress={handleUpgrade}
            accessibilityLabel={isChild ? t('subscription.ask_parent', locale) : t('subscription.upgrade', locale)}
            accessibilityRole="button"
          >
            <Text style={s.upgradeText}>
              {isChild ? t('subscription.ask_parent', locale) : t('subscription.upgrade', locale)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.dismissButton}
            onPress={onDismiss}
            accessibilityLabel={t('subscription.maybe_later', locale)}
            accessibilityRole="button"
          >
            <Text style={[s.dismissText, { color: colors.muted }]}>
              {t('subscription.maybe_later', locale)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  upgradeButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  dismissButton: { paddingVertical: 8 },
  dismissText: { fontSize: 14 },
});
