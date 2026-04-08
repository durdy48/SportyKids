import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
import { subscribeNotifications } from './api';

// Configure how notifications are presented when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and return the Expo push token.
 * Returns null if running on simulator or permissions denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    // eslint-disable-next-line no-console
    console.log('[Push] Must use physical device for push notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    // eslint-disable-next-line no-console
    console.log('[Push] Permission not granted');
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
  }

  try {
    // Use projectId from app config for standalone builds
    const Constants = await import('expo-constants').then(m => m.default);
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenResponse.data;
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[Push] Could not get push token');
    return null;
  }
}

/**
 * Register push token with the API for a given user.
 */
export async function registerPushTokenWithApi(
  userId: string,
  pushToken: string,
): Promise<void> {
  try {
    await subscribeNotifications(userId, {
      enabled: true,
      preferences: { sports: true, dailyQuiz: true, teamUpdates: true },
      pushToken,
      platform: 'expo',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Push] Error registering token with API:', error);
  }
}

/**
 * Set up notification tap handler that navigates to the correct screen.
 * Returns an unsubscribe function.
 */
export function setupNotificationTapHandler(
  navigate: (screen: string, params?: Record<string, unknown>) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.url) {
        Linking.openURL(data.url).catch(() => {
          // Fallback to screen navigation if URL fails to open
          if (data.screen) navigate(data.screen, data);
        });
      } else if (data?.screen) {
        navigate(data.screen, data);
      }
    },
  );

  return () => subscription.remove();
}
