import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { t } from '@sportykids/shared';
import { useUser } from '../lib/user-context';
import { joinOrganization } from '../lib/api';
import { haptic } from '../lib/haptics';

interface Props {
  navigation: {
    goBack: () => void;
    navigate: (screen: string) => void;
  };
  route?: {
    params?: {
      onJoined?: () => void;
      showSkip?: boolean;
    };
  };
}

const CODE_LENGTH = 6;

export function JoinOrganizationScreen({ navigation, route }: Props) {
  const { locale, colors, refreshUser } = useUser();
  const showSkip = route?.params?.showSkip ?? true;
  const onJoined = route?.params?.onJoined;

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const fullCode = code.join('');
  const isComplete = fullCode.length === CODE_LENGTH;

  const handleChange = (text: string, index: number) => {
    const char = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!char) {
      // Handle backspace
      const newCode = [...code];
      newCode[index] = '';
      setCode(newCode);
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = char[0];
    setCode(newCode);
    setError(null);

    // Auto-advance to next input
    if (index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleJoin = async () => {
    if (!isComplete) return;

    setLoading(true);
    setError(null);
    haptic('light');

    try {
      const result = await joinOrganization(fullCode);
      haptic('success');

      Alert.alert(
        t('org.join_success', locale, { name: result.organizationName }),
        '',
        [
          {
            text: 'OK',
            onPress: () => {
              refreshUser?.();
              if (onJoined) {
                onJoined();
              } else {
                navigation.goBack();
              }
            },
          },
        ],
      );
    } catch (err) {
      haptic('error');
      const status = (err as Record<string, unknown>).status as number | undefined;
      if (status === 404) {
        setError(t('org.join_error_not_found', locale));
      } else if (status === 409) {
        setError(t('org.join_error_already_member', locale));
      } else if (status === 403) {
        setError(t('org.join_error_inactive', locale));
      } else if (status === 400) {
        setError(t('org.join_error_full', locale));
      } else {
        setError(t('org.join_error_invalid', locale));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.emoji} accessibilityElementsHidden>
          🏟️
        </Text>
        <Text
          style={[styles.title, { color: colors.text }]}
          accessibilityRole="header"
        >
          {t('org.join_title', locale)}
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {t('org.join_subtitle', locale)}
        </Text>

        <View style={styles.codeRow} accessibilityRole="none">
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <TextInput
              key={i}
              ref={(ref) => {
                inputRefs.current[i] = ref;
              }}
              style={[
                styles.codeInput,
                {
                  borderColor: code[i] ? colors.blue : colors.border,
                  color: colors.text,
                  backgroundColor: colors.surface,
                },
              ]}
              value={code[i]}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              maxLength={1}
              autoCapitalize="characters"
              keyboardType="default"
              textAlign="center"
              accessibilityLabel={t('a11y.org.code_input', locale, { position: String(i + 1) })}
            />
          ))}
        </View>

        {error && (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.joinButton,
            { backgroundColor: isComplete ? colors.blue : colors.border },
          ]}
          onPress={handleJoin}
          disabled={!isComplete || loading}
          accessibilityRole="button"
          accessibilityLabel={t('org.join_button', locale)}
          accessibilityState={{ disabled: !isComplete || loading }}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.joinButtonText}>
              {t('org.join_button', locale)}
            </Text>
          )}
        </TouchableOpacity>

        {showSkip && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('org.join_skip', locale)}
          >
            <Text style={[styles.skipText, { color: colors.muted }]}>
              {t('org.join_skip', locale)}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  codeInput: {
    width: 44,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  joinButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  joinButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 20,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
  },
});
