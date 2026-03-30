import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { t } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import { useUser } from '../lib/user-context';
import { updateUser, setupParentalPin } from '../lib/api';

type AgeGateStep = 'select' | 'teen-notice' | 'child-consent' | 'child-pin';

import { WEB_BASE } from '../config';

export function AgeGateScreen({ navigation }: { navigation: { navigate: (screen: string) => void } }) {
  const { user, setUser, setParentalProfile, locale, colors } = useUser();
  const s = createStyles(colors);

  const [step, setStep] = useState<AgeGateStep>('select');
  const [teenAccepted, setTeenAccepted] = useState(false);
  const [parentConsent, setParentConsent] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(false);

  const privacyUrl = `${WEB_BASE}/privacy?locale=${locale}`;
  const termsUrl = `${WEB_BASE}/terms?locale=${locale}`;

  const openPrivacy = () => WebBrowser.openBrowserAsync(privacyUrl);
  const openTerms = () => WebBrowser.openBrowserAsync(termsUrl);

  const completeAgeGate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const updated = await updateUser(user.id, {
        ageGateCompleted: true,
        consentGiven: true,
      });
      setUser(updated);
      navigateForward();
    } catch {
      Alert.alert(t('errors.connection_error', locale));
    } finally {
      setLoading(false);
    }
  };

  const handleParentPath = async () => {
    await completeAgeGate();
  };

  const handleTeenAccept = async () => {
    await completeAgeGate();
  };

  const handleChildPinCreate = async () => {
    if (!user) return;
    if (pin.length !== 4) return;
    if (pin !== confirmPin) {
      setPinError(t('onboarding.pin_mismatch', locale));
      return;
    }

    setLoading(true);
    try {
      const profile = await setupParentalPin(user.id, pin);
      setParentalProfile(profile);
      const updated = await updateUser(user.id, {
        ageGateCompleted: true,
        consentGiven: true,
      });
      setUser(updated);
      navigateForward();
    } catch {
      Alert.alert(t('errors.connection_error', locale));
    } finally {
      setLoading(false);
    }
  };

  const navigateForward = () => {
    // If user has already gone through onboarding (has favoriteSports), go to main
    // Otherwise go to onboarding
    if (user && user.favoriteSports && user.favoriteSports.length > 0) {
      navigation.navigate('Main');
    } else {
      navigation.navigate('Onboarding');
    }
  };

  // --- Step: Age Selection ---
  if (step === 'select') {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.emoji}>👋</Text>
          <Text style={s.title}>{t('age_gate.title', locale)}</Text>

          <TouchableOpacity
            style={s.optionCard}
            onPress={handleParentPath}
            disabled={loading}
            testID="age-gate-parent"
          >
            <Text style={s.optionEmoji}>👨‍👩‍👧</Text>
            <Text style={s.optionText}>{t('age_gate.parent_option', locale)}</Text>
            {loading && <ActivityIndicator color={colors.blue} style={{ marginTop: 8 }} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.optionCard}
            onPress={() => setStep('teen-notice')}
            testID="age-gate-teen"
          >
            <Text style={s.optionEmoji}>🧑</Text>
            <Text style={s.optionText}>{t('age_gate.teen_option', locale)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.optionCard}
            onPress={() => setStep('child-consent')}
            testID="age-gate-child"
          >
            <Text style={s.optionEmoji}>👧</Text>
            <Text style={s.optionText}>{t('age_gate.child_option', locale)}</Text>
          </TouchableOpacity>

          {/* Legal links */}
          <View style={s.legalRow}>
            <TouchableOpacity onPress={openPrivacy}>
              <Text style={s.legalLink}>{t('legal.privacy_policy', locale)}</Text>
            </TouchableOpacity>
            <Text style={s.legalDot}> · </Text>
            <TouchableOpacity onPress={openTerms}>
              <Text style={s.legalLink}>{t('legal.terms_of_service', locale)}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Step: Teen Notice ---
  if (step === 'teen-notice') {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <TouchableOpacity onPress={() => setStep('select')} style={s.backButton}>
            <Text style={s.backButtonText}>{t('legal.back', locale)}</Text>
          </TouchableOpacity>

          <Text style={s.emoji}>📋</Text>
          <Text style={s.title}>{t('age_gate.teen_notice_title', locale)}</Text>
          <Text style={s.bodyText}>{t('age_gate.teen_notice_body', locale)}</Text>

          {/* Legal links inline */}
          <View style={s.legalRow}>
            <TouchableOpacity onPress={openPrivacy}>
              <Text style={s.legalLink}>{t('legal.privacy_policy', locale)}</Text>
            </TouchableOpacity>
            <Text style={s.legalDot}> · </Text>
            <TouchableOpacity onPress={openTerms}>
              <Text style={s.legalLink}>{t('legal.terms_of_service', locale)}</Text>
            </TouchableOpacity>
          </View>

          {/* Checkbox */}
          <TouchableOpacity
            style={s.checkboxRow}
            onPress={() => setTeenAccepted(!teenAccepted)}
            testID="teen-accept-checkbox"
          >
            <View style={[s.checkbox, teenAccepted && s.checkboxChecked]}>
              {teenAccepted && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.checkboxLabel}>{t('age_gate.teen_accept', locale)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.primaryButton, (!teenAccepted || loading) && s.buttonDisabled]}
            onPress={handleTeenAccept}
            disabled={!teenAccepted || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.primaryButtonText}>{t('age_gate.continue', locale)}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Step: Child Consent ---
  if (step === 'child-consent') {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <TouchableOpacity onPress={() => setStep('select')} style={s.backButton}>
            <Text style={s.backButtonText}>{t('legal.back', locale)}</Text>
          </TouchableOpacity>

          <Text style={s.emoji}>👨‍👩‍👧</Text>
          <Text style={s.title}>{t('age_gate.child_consent_title', locale)}</Text>
          <Text style={s.bodyText}>{t('age_gate.child_consent_hand_device', locale)}</Text>

          {/* Info for parents */}
          <View style={s.infoCard}>
            <Text style={s.infoTitle}>{t('age_gate.child_consent_for_parents', locale)}</Text>
            <Text style={s.infoBody}>{t('age_gate.child_consent_we_collect', locale)}</Text>
            <Text style={s.bulletItem}>• {t('age_gate.child_consent_collect_prefs', locale)}</Text>
            <Text style={s.bulletItem}>• {t('age_gate.child_consent_collect_activity', locale)}</Text>
            <Text style={s.bulletItem}>• {t('age_gate.child_consent_collect_quiz', locale)}</Text>

            <Text style={[s.infoBody, { marginTop: 12 }]}>{t('age_gate.child_consent_we_dont_collect', locale)}</Text>
            <Text style={s.bulletItemSafe}>• {t('age_gate.child_consent_no_location', locale)}</Text>
            <Text style={s.bulletItemSafe}>• {t('age_gate.child_consent_no_photos', locale)}</Text>
            <Text style={s.bulletItemSafe}>• {t('age_gate.child_consent_no_ads', locale)}</Text>
          </View>

          {/* Legal links */}
          <View style={s.legalRow}>
            <TouchableOpacity onPress={openPrivacy}>
              <Text style={s.legalLink}>{t('legal.privacy_policy', locale)}</Text>
            </TouchableOpacity>
            <Text style={s.legalDot}> · </Text>
            <TouchableOpacity onPress={openTerms}>
              <Text style={s.legalLink}>{t('legal.terms_of_service', locale)}</Text>
            </TouchableOpacity>
          </View>

          {/* Consent checkbox */}
          <TouchableOpacity
            style={s.checkboxRow}
            onPress={() => setParentConsent(!parentConsent)}
            testID="child-consent-checkbox"
          >
            <View style={[s.checkbox, parentConsent && s.checkboxChecked]}>
              {parentConsent && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.checkboxLabel}>{t('age_gate.child_consent_checkbox', locale)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.primaryButton, !parentConsent && s.buttonDisabled]}
            onPress={() => setStep('child-pin')}
            disabled={!parentConsent}
          >
            <Text style={s.primaryButtonText}>{t('age_gate.child_consent_set_pin', locale)}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Step: Child PIN Creation ---
  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity onPress={() => setStep('child-consent')} style={s.backButton}>
          <Text style={s.backButtonText}>{t('legal.back', locale)}</Text>
        </TouchableOpacity>

        <Text style={s.emoji}>🔒</Text>
        <Text style={s.title}>{t('age_gate.child_consent_set_pin', locale)}</Text>

        <Text style={s.label}>{t('onboarding.pin_create', locale)}</Text>
        <TextInput
          style={s.pinInput}
          value={pin}
          onChangeText={(text) => {
            setPin(text.replace(/\D/g, '').slice(0, 4));
            setPinError('');
          }}
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
          placeholder="····"
          placeholderTextColor={colors.muted}
          testID="age-gate-pin-input"
        />

        {pin.length === 4 && (
          <>
            <Text style={s.label}>{t('onboarding.pin_confirm', locale)}</Text>
            <TextInput
              style={s.pinInput}
              value={confirmPin}
              onChangeText={(text) => {
                setConfirmPin(text.replace(/\D/g, '').slice(0, 4));
                setPinError('');
              }}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
              placeholder="····"
              placeholderTextColor={colors.muted}
              testID="age-gate-confirm-pin-input"
            />
          </>
        )}

        {pinError ? <Text style={s.pinError}>{pinError}</Text> : null}

        <TouchableOpacity
          style={[
            s.primaryButton,
            (pin.length !== 4 || confirmPin.length !== 4 || loading) && s.buttonDisabled,
          ]}
          onPress={handleChildPinCreate}
          disabled={pin.length !== 4 || confirmPin.length !== 4 || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={s.primaryButtonText}>{t('age_gate.continue', locale)}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      padding: 24,
      paddingBottom: 40,
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
      marginBottom: 8,
    },
    backButtonText: {
      fontSize: 16,
      color: colors.blue,
      fontWeight: '500',
    },
    emoji: {
      fontSize: 48,
      textAlign: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 24,
    },
    optionCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionEmoji: {
      fontSize: 32,
      marginBottom: 8,
    },
    optionText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    bodyText: {
      fontSize: 15,
      color: colors.muted,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 20,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    infoBody: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    bulletItem: {
      fontSize: 14,
      color: colors.muted,
      paddingLeft: 8,
      marginBottom: 4,
    },
    bulletItemSafe: {
      fontSize: 14,
      color: colors.green,
      paddingLeft: 8,
      marginBottom: 4,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 20,
      marginTop: 8,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.blue,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: colors.blue,
    },
    checkmark: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    checkboxLabel: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    primaryButton: {
      backgroundColor: colors.blue,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    legalRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 16,
    },
    legalLink: {
      fontSize: 13,
      color: colors.blue,
      textDecorationLine: 'underline',
    },
    legalDot: {
      fontSize: 13,
      color: colors.muted,
    },
    label: {
      fontSize: 14,
      color: colors.muted,
      marginTop: 16,
      marginBottom: 8,
      alignSelf: 'center',
    },
    pinInput: {
      fontSize: 32,
      fontWeight: '700',
      textAlign: 'center',
      letterSpacing: 16,
      width: 200,
      paddingVertical: 14,
      borderBottomWidth: 3,
      borderBottomColor: colors.border,
      marginBottom: 4,
      color: colors.text,
      alignSelf: 'center',
    },
    pinError: {
      color: '#EF4444',
      fontSize: 13,
      marginTop: 4,
      textAlign: 'center',
    },
  });
}
