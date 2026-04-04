import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { t } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import { useUser } from '../lib/user-context';
import { login, fetchAuthProviders, loginWithSocialToken } from '../lib/auth';
import { WEB_BASE, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../config';

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen({ navigation }: { navigation: { navigate: (screen: string) => void } }) {
  const { setUser, locale, colors } = useUser();
  const styles = createStyles(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [providers, setProviders] = useState<{ google: boolean; apple: boolean }>({ google: true, apple: false });

  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    fetchAuthProviders().then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.authentication?.idToken;
      if (idToken) {
        setGoogleLoading(true);
        loginWithSocialToken('google', idToken)
          .then((result) => setUser(result.user))
          .catch(() => Alert.alert(t('auth.social_error', locale)))
          .finally(() => setGoogleLoading(false));
      }
    }
  }, [googleResponse, locale, setUser]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const result = await login({ email: email.trim(), password });
      setUser(result.user);
    } catch {
      Alert.alert(t('auth.login_error', locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>{'\u26BD'}</Text>
        <Text style={styles.title}>SportyKids</Text>
        <Text style={styles.subtitle}>{t('auth.login', locale)}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t('auth.email', locale)}
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel={t('a11y.auth.email_input', locale)}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.password', locale)}
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            accessibilityLabel={t('a11y.auth.password_input', locale)}
          />

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessible={true}
            accessibilityLabel={t('a11y.auth.login_button', locale)}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('auth.login', locale)}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Register')}
            accessible={true}
            accessibilityLabel={t('a11y.auth.register_button', locale)}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>{t('auth.register', locale)}</Text>
          </TouchableOpacity>

          {(providers.google || providers.apple) && (
            <>
              <View style={styles.separator}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>{t('auth.or_continue_with', locale)}</Text>
                <View style={styles.separatorLine} />
              </View>

              {providers.google && (
                <TouchableOpacity
                  style={[styles.socialButton, (googleLoading) && styles.buttonDisabled]}
                  onPress={() => promptGoogleAsync()}
                  disabled={googleLoading}
                  accessible={true}
                  accessibilityLabel={t('a11y.auth.google_signin', locale)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: googleLoading }}
                >
                  {googleLoading ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Text style={styles.socialButtonText}>{t('auth.google_signin', locale)}</Text>
                  )}
                </TouchableOpacity>
              )}

              {providers.apple && (
                <TouchableOpacity
                  style={[styles.socialButton, styles.appleButton]}
                  onPress={() => Alert.alert(
                    t('auth.apple_signin', locale),
                    'Apple Sign In not configured yet.',
                  )}
                  accessible={true}
                  accessibilityLabel={t('a11y.auth.apple_signin', locale)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.socialButtonText, styles.appleButtonText]}>{t('auth.apple_signin', locale)}</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity
            style={styles.anonymousButton}
            onPress={() => navigation.navigate('Onboarding')}
            accessible={true}
            accessibilityLabel={t('a11y.auth.anonymous_continue', locale)}
            accessibilityRole="button"
          >
            <Text style={styles.anonymousButtonText}>{t('auth.continue_anonymous', locale)}</Text>
          </TouchableOpacity>

          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`${WEB_BASE}/privacy?locale=${locale}`)}>
              <Text style={styles.legalLink}>{t('legal.privacy_policy', locale)}</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}> · </Text>
            <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`${WEB_BASE}/terms?locale=${locale}`)}>
              <Text style={styles.legalLink}>{t('legal.terms_of_service', locale)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logo: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 32,
  },
  form: {
    gap: 14,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.blue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.blue,
  },
  secondaryButtonText: {
    color: colors.blue,
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separatorText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: colors.muted,
  },
  socialButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  appleButton: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  appleButtonText: {
    color: colors.surface,
  },
  anonymousButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  anonymousButtonText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
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
  });
}
