import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

vi.mock('../../config', () => ({
  API_BASE: 'http://localhost:3001/api',
}));

// Mock api.subscribeNotifications used by push-notifications
vi.mock('../api', () => ({
  subscribeNotifications: vi.fn().mockResolvedValue(undefined),
}));

import {
  registerForPushNotifications,
  registerPushTokenWithApi,
  setupNotificationTapHandler,
} from '../push-notifications';
import { subscribeNotifications } from '../api';

describe('push-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // registerForPushNotifications
  // -------------------------------------------------------------------------

  describe('registerForPushNotifications', () => {
    it('returns token when permissions are granted', async () => {
      const token = await registerForPushNotifications();
      expect(token).toBe('ExponentPushToken[mock]');
    });

    it('returns null when not on physical device', async () => {
      // Override isDevice to false
      const originalIsDevice = Device.isDevice;
      Object.defineProperty(Device, 'isDevice', { value: false, writable: true });

      const token = await registerForPushNotifications();
      expect(token).toBeNull();

      Object.defineProperty(Device, 'isDevice', { value: originalIsDevice, writable: true });
    });

    it('returns null when permission denied', async () => {
      vi.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce(
        { status: 'denied' } as any,
      );
      vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce(
        { status: 'denied' } as any,
      );

      const token = await registerForPushNotifications();
      expect(token).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // registerPushTokenWithApi
  // -------------------------------------------------------------------------

  describe('registerPushTokenWithApi', () => {
    it('calls subscribeNotifications with correct params', async () => {
      await registerPushTokenWithApi('user-1', 'ExponentPushToken[abc]');

      expect(subscribeNotifications).toHaveBeenCalledWith('user-1', {
        enabled: true,
        preferences: { sports: true, dailyQuiz: true, teamUpdates: true },
        pushToken: 'ExponentPushToken[abc]',
        platform: 'expo',
      });
    });

    it('does not throw on API error', async () => {
      vi.mocked(subscribeNotifications).mockRejectedValueOnce(new Error('API down'));

      // Should not throw
      await expect(registerPushTokenWithApi('u1', 'token')).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // setupNotificationTapHandler
  // -------------------------------------------------------------------------

  describe('setupNotificationTapHandler', () => {
    it('returns an unsubscribe function', () => {
      const navigate = vi.fn();
      const unsubscribe = setupNotificationTapHandler(navigate);
      expect(typeof unsubscribe).toBe('function');
    });

    it('registers a listener with expo-notifications', () => {
      const navigate = vi.fn();
      setupNotificationTapHandler(navigate);
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
    });
  });
});
