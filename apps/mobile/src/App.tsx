import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { UserProvider } from './lib/user-context';
import { AppNavigator, navigationRef } from './navigation';
import { setupNotificationTapHandler } from './lib/push-notifications';

export default function App() {
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubscribeRef.current = setupNotificationTapHandler((screen, params) => {
      if (navigationRef.isReady()) {
        navigationRef.navigate(screen as never, params as never);
      }
    });

    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <UserProvider>
        <AppNavigator />
      </UserProvider>
    </SafeAreaProvider>
  );
}
