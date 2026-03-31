import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { UserProvider, useUser } from './lib/user-context';
import { AppNavigator, navigationRef } from './navigation';
import { setupNotificationTapHandler } from './lib/push-notifications';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSecureTokenStorage } from './lib/auth';

function StatusBarManager() {
  const { resolvedTheme } = useUser();
  return <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
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
      <SafeAreaProvider>
        <UserProvider>
          <StatusBarManager />
          <AppNavigator />
        </UserProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
