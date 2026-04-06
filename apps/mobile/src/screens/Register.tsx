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
import { t } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import { useUser } from '../lib/user-context';
import { register } from '../lib/auth';
import { WEB_BASE, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../config';

export function RegisterScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { setUser, locale, colors } = useUser();
  const styles = createStyles(colors);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [role, setRole] = useState<'parent' | 'child'>('parent');
  const [loading, setLoading] = useState(false);
  const hasGoogleClientId = !!(GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);
  const providers = { google: hasGoogleClientId, apple: false };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        ...(role === 'child' && age ? { age: parseInt(age, 10) } : {}),
      });
      setUser(result.user);
    } catch {
      Alert.alert(t('auth.register_error', locale));
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
        <Text style={styles.title}>{t('auth.register', locale)}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t('auth.name', locale)}
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            accessibilityLabel={t('a11y.auth.name_input', locale)}
          />
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
            accessibilityLabel={t('a11y.auth.password_input', locale)}
          />

          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleButton, role === 'parent' && styles.roleSelected]}
              onPress={() => setRole('parent')}
              accessible={true}
              accessibilityLabel={t('auth.role_parent', locale)}
              accessibilityRole="button"
              accessibilityState={{ selected: role === 'parent' }}
            >
              <Text style={[styles.roleText, role === 'parent' && styles.roleTextSelected]}>
                {t('auth.role_parent', locale)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleButton, role === 'child' && styles.roleSelected]}
              onPress={() => setRole('child')}
              accessible={true}
              accessibilityLabel={t('auth.role_child', locale)}
              accessibilityRole="button"
              accessibilityState={{ selected: role === 'child' }}
            >
              <Text style={[styles.roleText, role === 'child' && styles.roleTextSelected]}>
                {t('auth.role_child', locale)}
              </Text>
            </TouchableOpacity>
          </View>

          {role === 'child' && (
            <TextInput
              style={styles.input}
              placeholder={t('filters.age', locale)}
              placeholderTextColor={colors.muted}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              maxLength={2}
            />
          )}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            accessible={true}
            accessibilityLabel={t('a11y.auth.register_button', locale)}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('auth.register', locale)}</Text>
            )}
          </TouchableOpacity>

          {(providers.google || providers.apple) && (
            <>
              <View style={styles.separator}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>{t('auth.or_continue_with', locale)}</Text>
                <View style={styles.separatorLine} />
              </View>

              {/* TODO: Social OAuth requires expo-auth-session for proper mobile deep linking.
                 Linking.openURL cannot return tokens back to the app. These buttons show
                 an informational alert until deep linking is configured. */}
              {providers.google && (
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={() => Alert.alert(
                    t('auth.google_signin', locale),
                    'OAuth login requires app configuration. Use email login for now.',
                  )}
                >
                  <Text style={styles.socialButtonText}>{t('auth.google_signin', locale)}</Text>
                </TouchableOpacity>
              )}

              {providers.apple && (
                <TouchableOpacity
                  style={[styles.socialButton, styles.appleButton]}
                  onPress={() => Alert.alert(
                    t('auth.apple_signin', locale),
                    'OAuth login requires app configuration. Use email login for now.',
                  )}
                >
                  <Text style={[styles.socialButtonText, styles.appleButtonText]}>{t('auth.apple_signin', locale)}</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.linkButtonText}>{t('auth.login', locale)}</Text>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
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
  roleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  roleSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.blue + '15',
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  roleTextSelected: {
    color: colors.blue,
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
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    color: colors.blue,
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
