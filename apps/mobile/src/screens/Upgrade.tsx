import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { t, COLORS } from '@sportykids/shared';
import { useUser } from '../lib/user-context';
import { WEB_BASE } from '../config';

const FALLBACK_WEB_BASE = 'https://sportykids.app';

interface FeatureRow {
  label: string;
  free: string;
  premium: string;
}

export function UpgradeScreen() {
  const { user, locale, colors } = useUser();
  const navigation = useNavigation();
  const isPremium = user?.subscriptionTier === 'premium';
  const isChild = user?.role === 'child';
  const isAnonymous = user?.authProvider === 'anonymous';

  const features: FeatureRow[] = [
    { label: t('subscription.feature_unlimited_news', locale), free: t('subscription.feature_news_limit', locale), premium: t('subscription.feature_unlimited_news', locale) },
    { label: t('subscription.feature_unlimited_quiz', locale), free: t('subscription.feature_quiz_limit', locale), premium: t('subscription.feature_unlimited_quiz', locale) },
    { label: t('subscription.feature_unlimited_reels', locale), free: t('subscription.feature_reels_limit', locale), premium: t('subscription.feature_unlimited_reels', locale) },
    { label: t('subscription.feature_all_sports', locale), free: t('subscription.feature_one_sport', locale), premium: t('subscription.feature_all_sports', locale) },
    { label: t('subscription.feature_digest', locale), free: t('subscription.feature_no_digest', locale), premium: t('subscription.feature_digest', locale) },
  ];

  const handleMonthly = () => {
    // RevenueCat purchase — placeholder for SDK integration
  };

  const handleYearly = () => {
    // RevenueCat purchase — placeholder for SDK integration
  };

  const handleRestore = () => {
    // RevenueCat restore — placeholder for SDK integration
  };

  if (isPremium) {
    return (
      <ScrollView style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.content}>
          <Text style={s.icon} accessibilityLabel={t('subscription.premium', locale)}>🏆</Text>
          <Text style={[s.title, { color: colors.text }]}>{t('subscription.premium', locale)}</Text>
          <Text style={[s.subtitle, { color: colors.muted }]}>
            {user?.subscriptionExpiry
              ? t('subscription.active_until', locale, { date: new Date(user.subscriptionExpiry).toLocaleDateString() })
              : t('subscription.premium_tier_label', locale)}
          </Text>
          <TouchableOpacity
            style={[s.manageButton, { borderColor: colors.border }]}
            onPress={() => Linking.openURL(
              Platform.OS === 'ios'
                ? 'https://apps.apple.com/account/subscriptions'
                : 'https://play.google.com/store/account/subscriptions',
            )}
            accessibilityLabel={t('subscription.manage', locale)}
            accessibilityRole="button"
          >
            <Text style={[s.manageText, { color: colors.text }]}>{t('subscription.manage', locale)}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (isAnonymous) {
    return (
      <ScrollView style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.content}>
          <Text style={s.icon} accessibilityLabel={t('subscription.upgrade', locale)}>🔒</Text>
          <Text style={[s.title, { color: colors.text }]}>{t('subscription.create_account_first', locale)}</Text>
          <TouchableOpacity
            style={[s.primaryButton, { backgroundColor: COLORS.blue }]}
            onPress={() => (navigation as { navigate: (s: string) => void }).navigate('Register')}
            accessibilityLabel={t('auth.register', locale)}
            accessibilityRole="button"
          >
            <Text style={s.primaryButtonText}>{t('auth.register', locale)}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (isChild) {
    return (
      <ScrollView style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.content}>
          <Text style={s.icon} accessibilityLabel={t('subscription.upgrade', locale)}>🏆</Text>
          <Text style={[s.title, { color: colors.text }]}>{t('subscription.upgrade', locale)}</Text>
          <Text style={[s.subtitle, { color: colors.muted }]}>{t('subscription.child_message', locale)}</Text>
          <TouchableOpacity
            style={[s.primaryButton, { backgroundColor: COLORS.blue }]}
            onPress={() => (navigation as { navigate: (s: string) => void }).navigate('Parents')}
            accessibilityLabel={t('subscription.ask_parent', locale)}
            accessibilityRole="button"
          >
            <Text style={s.primaryButtonText}>{t('subscription.ask_parent', locale)}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Parent view — full upgrade screen
  return (
    <ScrollView style={[s.container, { backgroundColor: colors.background }]}>
      <View style={s.content}>
        <Text style={s.icon} accessibilityLabel={t('subscription.premium', locale)}>🏆</Text>
        <Text style={[s.title, { color: colors.text }]}>{t('subscription.upgrade', locale)}</Text>

        {/* Feature comparison table */}
        <View style={[s.table, { borderColor: colors.border }]}>
          <View style={[s.tableHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.headerCell, { flex: 1 }]} />
            <Text style={[s.headerCell, { color: colors.muted }]}>{t('subscription.free', locale)}</Text>
            <Text style={[s.headerCell, { color: COLORS.blue }]}>{t('subscription.premium', locale)}</Text>
          </View>
          {features.map((f, i) => (
            <View key={i} style={[s.tableRow, { borderBottomColor: colors.border }]}>
              <Text style={[s.featureLabel, { color: colors.text }]}>{f.label}</Text>
              <Text style={[s.featureValue, { color: colors.muted }]}>{f.free}</Text>
              <Text style={[s.featureValue, { color: COLORS.green }]}>{f.premium}</Text>
            </View>
          ))}
        </View>

        {/* Purchase buttons */}
        <TouchableOpacity
          style={[s.primaryButton, { backgroundColor: COLORS.blue }]}
          onPress={handleMonthly}
          accessibilityLabel={`${t('subscription.monthly', locale)} - ${t('subscription.monthly_price', locale)}`}
          accessibilityRole="button"
        >
          <Text style={s.primaryButtonText}>
            {t('subscription.monthly', locale)} — {t('subscription.monthly_price', locale)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.secondaryButton, { backgroundColor: COLORS.green }]}
          onPress={handleYearly}
          accessibilityLabel={`${t('subscription.yearly', locale)} - ${t('subscription.yearly_price', locale)} - ${t('subscription.yearly_savings', locale)}`}
          accessibilityRole="button"
        >
          <Text style={s.primaryButtonText}>
            {t('subscription.yearly', locale)} — {t('subscription.yearly_price', locale)} ({t('subscription.yearly_savings', locale)})
          </Text>
        </TouchableOpacity>

        <Text style={[s.familyNote, { color: colors.muted }]}>{t('subscription.family_plan', locale)}</Text>

        <TouchableOpacity
          style={s.restoreButton}
          onPress={handleRestore}
          accessibilityLabel={t('subscription.restore', locale)}
          accessibilityRole="button"
        >
          <Text style={[s.restoreText, { color: colors.muted }]}>{t('subscription.restore', locale)}</Text>
        </TouchableOpacity>

        <View style={s.legalRow}>
          <TouchableOpacity
            onPress={() => Linking.openURL(`${WEB_BASE || FALLBACK_WEB_BASE}/terms?locale=${locale}`)}
            accessibilityLabel={t('legal.terms_of_service', locale)}
            accessibilityRole="link"
          >
            <Text style={[s.legalLink, { color: colors.muted }]}>{t('legal.terms_of_service', locale)}</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.muted }}> | </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(`${WEB_BASE || FALLBACK_WEB_BASE}/privacy?locale=${locale}`)}
            accessibilityLabel={t('legal.privacy_policy', locale)}
            accessibilityRole="link"
          >
            <Text style={[s.legalLink, { color: colors.muted }]}>{t('legal.privacy_policy', locale)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, alignItems: 'center' },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  table: { width: '100%', borderWidth: 1, borderRadius: 12, marginBottom: 24, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1 },
  headerCell: { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 0.5 },
  featureLabel: { flex: 1, fontSize: 12 },
  featureValue: { flex: 1, fontSize: 12, textAlign: 'center' },
  primaryButton: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  secondaryButton: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  familyNote: { fontSize: 13, marginBottom: 16, textAlign: 'center' },
  restoreButton: { paddingVertical: 12 },
  restoreText: { fontSize: 14, textDecorationLine: 'underline' },
  manageButton: { paddingVertical: 14, paddingHorizontal: 24, borderWidth: 1, borderRadius: 12, marginTop: 16 },
  manageText: { fontSize: 16, fontWeight: '500' },
  legalRow: { flexDirection: 'row', marginTop: 16, alignItems: 'center' },
  legalLink: { fontSize: 12, textDecorationLine: 'underline' },
});
