import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { UserProvider, useUser } from './lib/user-context';
import { AppNavigator, navigationRef } from './navigation';
import { setupNotificationTapHandler } from './lib/push-notifications';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSecureTokenStorage } from './lib/auth';
import { beforeSend } from './lib/sentry-config';

// Initialize Sentry crash reporting — always active (no consent gate)
// because only technical crash data is collected, with ALL PII stripped.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN && !__DEV__,
  tracesSampleRate: 0.1,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beforeSend: beforeSend as any,
});

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

function StatusBarManager() {
  const { resolvedTheme } = useUser();
  return <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />;
}

// Hides the splash screen once the user context has finished loading.
// Must live inside UserProvider so it can access the loading state.
function SplashHider() {
  const { loading } = useUser();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);

  return null;
}

function App() {
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Migrate JWT tokens from AsyncStorage to SecureStore on startup
    initSecureTokenStorage().catch(() => {});
  }, []);

  useEffect(() => {
    unsubscribeRef.current = setupNotificationTapHandler((screen, params) => {
      if (navigationRef.isReady()) {
        (navigationRef.navigate as (screen: string, params?: Record<string, unknown>) => void)(screen, params);
      }
    });

    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <SafeAreaProvider>
          <UserProvider>
            <SplashHider />
            <StatusBarManager />
            <AppNavigator />
          </UserProvider>
        </SafeAreaProvider>
      </View>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(App);
