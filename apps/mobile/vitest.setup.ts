/**
 * Vitest setup for React Native mobile app.
 *
 * Mocks all React Native core modules, Expo modules, and navigation
 * so tests can run in a Node environment without a real RN runtime.
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// React Native core
// ---------------------------------------------------------------------------

vi.mock('react-native', () => {
  const RN = {
    View: 'View',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    ScrollView: 'ScrollView',
    TextInput: 'TextInput',
    FlatList: 'FlatList',
    ActivityIndicator: 'ActivityIndicator',
    Image: 'Image',
    Modal: 'Modal',
    RefreshControl: 'RefreshControl',
    Switch: 'Switch',
    SafeAreaView: 'SafeAreaView',
    KeyboardAvoidingView: 'KeyboardAvoidingView',
    Alert: {
      alert: vi.fn(),
    },
    Linking: {
      openURL: vi.fn(),
      canOpenURL: vi.fn().mockResolvedValue(true),
    },
    Platform: {
      OS: 'ios',
      select: vi.fn((obj: Record<string, unknown>) => obj.ios),
    },
    Dimensions: {
      get: vi.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
      flatten: vi.fn((s: unknown) => s),
      hairlineWidth: 1,
    },
    Animated: {
      Value: vi.fn(() => ({
        setValue: vi.fn(),
        interpolate: vi.fn(() => 0),
      })),
      timing: vi.fn(() => ({ start: vi.fn() })),
      spring: vi.fn(() => ({ start: vi.fn() })),
      sequence: vi.fn(() => ({ start: vi.fn() })),
      View: 'Animated.View',
      Text: 'Animated.Text',
      createAnimatedComponent: vi.fn((c: unknown) => c),
    },
    LayoutAnimation: {
      configureNext: vi.fn(),
      Presets: { easeInEaseOut: {}, linear: {}, spring: {} },
    },
    useColorScheme: vi.fn(() => 'light'),
    // ExpoCryptoAES is the native module used by expo-secure-store v14+ (SDK 54+).
    // Stub it so isSecureStoreSupported() returns true in tests, allowing
    // secure-storage tests to exercise the SecureStore code paths.
    NativeModules: { ExpoCryptoAES: {} },
  };
  return { ...RN, default: RN };
});

// ---------------------------------------------------------------------------
// AsyncStorage
// ---------------------------------------------------------------------------

const asyncStorageStore: Record<string, string> = {};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(asyncStorageStore[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      asyncStorageStore[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete asyncStorageStore[key];
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
      return Promise.resolve();
    }),
    getAllKeys: vi.fn(() => Promise.resolve(Object.keys(asyncStorageStore))),
    multiGet: vi.fn((keys: string[]) =>
      Promise.resolve(keys.map((k) => [k, asyncStorageStore[k] ?? null])),
    ),
    multiSet: vi.fn((pairs: [string, string][]) => {
      pairs.forEach(([k, v]) => { asyncStorageStore[k] = v; });
      return Promise.resolve();
    }),
  },
}));

// ---------------------------------------------------------------------------
// Expo modules
// ---------------------------------------------------------------------------

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  selectionAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: vi.fn().mockResolvedValue({ data: 'ExponentPushToken[mock]' }),
  setNotificationChannelAsync: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  AndroidImportance: { MAX: 5 },
}));

vi.mock('expo-device', () => ({
  isDevice: true,
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        eas: { projectId: 'mock-project-id' },
      },
    },
  },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: vi.fn(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    replace: vi.fn(),
  })),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

vi.mock('expo-web-browser', () => ({
  openBrowserAsync: vi.fn().mockResolvedValue({ type: 'cancel' }),
}));

vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: vi.fn().mockResolvedValue(true),
  hideAsync: vi.fn().mockResolvedValue(true),
}));

vi.mock('@sentry/react-native', () => ({
  init: vi.fn(),
  wrap: vi.fn((component: unknown) => component),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: vi.fn(),
}));

// ---------------------------------------------------------------------------
// React Navigation
// ---------------------------------------------------------------------------

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), goBack: vi.fn() }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: vi.fn(),
  NavigationContainer: 'NavigationContainer',
}));

vi.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: vi.fn(() => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
  })),
}));

vi.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: vi.fn(() => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
  })),
}));

// ---------------------------------------------------------------------------
// @sportykids/shared i18n
// ---------------------------------------------------------------------------

vi.mock('@sportykids/shared', () => ({
  t: vi.fn((key: string) => key),
  getSportLabel: vi.fn((sport: string) => sport),
  getAgeRangeLabel: vi.fn((range: string) => range),
  inferCountryFromLocale: vi.fn(() => 'ES'),
  sportToEmoji: vi.fn((sport: string) => `[${sport}]`),
  sportToColor: vi.fn(() => '#2563EB'),
  COLORS: {
    blue: '#2563EB',
    green: '#22C55E',
    yellow: '#FACC15',
    background: '#F8FAFC',
    text: '#1E293B',
    surface: '#FFFFFF',
    border: '#E5E7EB',
    muted: '#6B7280',
  },
  SPORTS: ['football', 'basketball', 'tennis', 'swimming', 'athletics', 'cycling', 'formula1', 'padel'],
  TEAMS: {},
  AGE_RANGES: ['6-8', '9-11', '12-14'],
  KID_FRIENDLY_ERRORS: {
    crash: { titleKey: 'kid_errors.crash_title', messageKey: 'kid_errors.crash_message', emoji: '\u{1F3DF}\uFE0F' },
    network: { titleKey: 'kid_errors.network_title', messageKey: 'kid_errors.network_message', emoji: '\uD83C\uDFC8' },
    generic: { titleKey: 'kid_errors.generic_title', messageKey: 'kid_errors.generic_message', emoji: '\u26BD' },
  },
  getErrorType: vi.fn(() => 'generic'),
  extractYouTubeVideoId: vi.fn(() => 'dQw4w9WgXcQ'),
  buildYouTubeEmbedUrl: vi.fn((id: string) => `https://www.youtube.com/embed/${id}?modestbranding=1&rel=0`),
  getYouTubePlayerVars: vi.fn(() => ({ modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1, autoplay: 1 })),
}));

// ---------------------------------------------------------------------------
// Mobile-specific mocks
// ---------------------------------------------------------------------------

vi.mock('./src/config', () => ({
  API_BASE: 'http://localhost:3001/api',
  WEB_BASE: 'http://localhost:3000',
}));

vi.mock('../config', () => ({
  API_BASE: 'http://localhost:3001/api',
  WEB_BASE: 'http://localhost:3000',
}));

// ---------------------------------------------------------------------------
// Global fetch mock (reset per test via beforeEach in individual files)
// ---------------------------------------------------------------------------

globalThis.fetch = vi.fn();

// ---------------------------------------------------------------------------
// Console noise reduction
// ---------------------------------------------------------------------------

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
