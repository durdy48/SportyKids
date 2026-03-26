/**
 * Haptic feedback utility for React Native (B-UX8).
 *
 * Uses expo-haptics when available, silently degrades on unsupported platforms.
 * Import this module instead of expo-haptics directly to get safe fallbacks.
 */

let Haptics: typeof import('expo-haptics') | null = null;

try {
  // Dynamic import to avoid crashes if expo-haptics is not installed
  Haptics = require('expo-haptics');
} catch {
  // expo-haptics not available — haptics disabled
}

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

/**
 * Trigger haptic feedback.
 *
 * Usage:
 *   haptic('light')     // light impact
 *   haptic('success')   // notification success
 *   haptic('selection') // selection change
 */
export function haptic(style: HapticStyle = 'light'): void {
  if (!Haptics) return;

  try {
    switch (style) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'selection':
        Haptics.selectionAsync();
        break;
    }
  } catch {
    // Silently ignore haptic failures (e.g., simulator)
  }
}
