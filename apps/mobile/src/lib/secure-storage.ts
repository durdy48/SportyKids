/**
 * Secure storage abstraction for JWT tokens on mobile.
 *
 * Uses expo-secure-store (encrypted keychain/keystore) with an automatic
 * fallback to AsyncStorage if SecureStore is not available (e.g. Expo Go
 * on some platforms, or web).
 *
 * On first use, migrates existing tokens from AsyncStorage to SecureStore.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Dynamic SecureStore resolution
// ---------------------------------------------------------------------------

interface SecureStoreApi {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

let secureStore: SecureStoreApi | null = null;
let secureStoreChecked = false;

// Probe runs lazily on first use. This is intentional — migrateTokensToSecureStore()
// is called at app startup which triggers the probe early anyway.
async function getSecureStore(): Promise<SecureStoreApi | null> {
  if (secureStoreChecked) return secureStore;
  secureStoreChecked = true;

  try {
    const mod = await import('expo-secure-store');
    // Verify it's usable by attempting a read
    await mod.getItemAsync('__secure_store_probe__');
    secureStore = mod;
  } catch {
    // SecureStore not available; fall back to AsyncStorage
    secureStore = null;
  }

  return secureStore;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const MIGRATION_FLAG_KEY = 'sportykids_tokens_migrated';

/**
 * Read a value from secure storage, falling back to AsyncStorage.
 */
export async function secureGetItem(key: string): Promise<string | null> {
  const store = await getSecureStore();
  if (store) {
    try {
      return await store.getItemAsync(key);
    } catch {
      // Fallback on any error
      return AsyncStorage.getItem(key);
    }
  }
  return AsyncStorage.getItem(key);
}

/**
 * Write a value to secure storage, falling back to AsyncStorage.
 */
export async function secureSetItem(key: string, value: string): Promise<void> {
  const store = await getSecureStore();
  if (store) {
    try {
      await store.setItemAsync(key, value);
      return;
    } catch {
      // Fallback on any error
    }
  }
  await AsyncStorage.setItem(key, value);
}

/**
 * Delete a value from secure storage, falling back to AsyncStorage.
 * Removes from both stores to ensure cleanup.
 */
export async function secureDeleteItem(key: string): Promise<void> {
  const store = await getSecureStore();

  // Remove from both stores to ensure no stale data
  const promises: Promise<void>[] = [AsyncStorage.removeItem(key)];
  if (store) {
    promises.push(store.deleteItemAsync(key).catch(() => {}));
  }

  await Promise.all(promises);
}

/**
 * Migrate existing JWT tokens from AsyncStorage to SecureStore.
 * Safe to call multiple times -- skips if already migrated or if SecureStore
 * is unavailable.
 */
export async function migrateTokensToSecureStore(tokenKeys: string[]): Promise<void> {
  const store = await getSecureStore();
  if (!store) return; // Nothing to do without SecureStore

  const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
  if (alreadyMigrated === 'true') return;

  for (const key of tokenKeys) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        await store.setItemAsync(key, value);
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // If migration fails for a key, skip it -- tokens will still work from AsyncStorage
    }
  }

  await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
}

/**
 * Check whether SecureStore is available on this device.
 */
export async function isSecureStoreAvailable(): Promise<boolean> {
  const store = await getSecureStore();
  return store !== null;
}

// ---------------------------------------------------------------------------
// Testing utilities
// ---------------------------------------------------------------------------

/** @internal Reset the cached SecureStore reference (for tests only). */
export function _resetSecureStoreCache(): void {
  secureStore = null;
  secureStoreChecked = false;
}
