import { describe, it, expect, vi, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock expo-secure-store
const mockSecureStore = {
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
};

vi.mock('expo-secure-store', () => mockSecureStore);

import {
  secureGetItem,
  secureSetItem,
  secureDeleteItem,
  migrateTokensToSecureStore,
  isSecureStoreAvailable,
  _resetSecureStoreCache,
} from '../secure-storage';

describe('secure-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSecureStoreCache();
    // Reset the AsyncStorage mock store
    vi.mocked(AsyncStorage.getItem).mockReset().mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockReset().mockResolvedValue(undefined);
    vi.mocked(AsyncStorage.removeItem).mockReset().mockResolvedValue(undefined);
    // Re-enable SecureStore
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // secureGetItem
  // ---------------------------------------------------------------------------

  describe('secureGetItem', () => {
    it('reads from SecureStore when available', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null); // probe
      mockSecureStore.getItemAsync.mockResolvedValueOnce('my-token');

      const value = await secureGetItem('key');
      expect(value).toBe('my-token');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('key');
    });

    it('falls back to AsyncStorage when SecureStore throws', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null); // probe
      mockSecureStore.getItemAsync.mockRejectedValueOnce(new Error('fail'));
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce('fallback-token');

      const value = await secureGetItem('key');
      expect(value).toBe('fallback-token');
    });

    it('falls back to AsyncStorage when SecureStore is unavailable', async () => {
      // Make SecureStore probe fail
      mockSecureStore.getItemAsync.mockRejectedValueOnce(new Error('unavailable'));
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce('async-token');

      const value = await secureGetItem('key');
      expect(value).toBe('async-token');
    });
  });

  // ---------------------------------------------------------------------------
  // secureSetItem
  // ---------------------------------------------------------------------------

  describe('secureSetItem', () => {
    it('writes to SecureStore when available', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null); // probe

      await secureSetItem('key', 'value');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('key', 'value');
    });

    it('falls back to AsyncStorage when SecureStore throws on write', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null); // probe
      mockSecureStore.setItemAsync.mockRejectedValueOnce(new Error('write fail'));

      await secureSetItem('key', 'value');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('key', 'value');
    });

    it('writes to AsyncStorage when SecureStore is unavailable', async () => {
      mockSecureStore.getItemAsync.mockRejectedValueOnce(new Error('unavailable'));

      await secureSetItem('key', 'value');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('key', 'value');
    });
  });

  // ---------------------------------------------------------------------------
  // secureDeleteItem
  // ---------------------------------------------------------------------------

  describe('secureDeleteItem', () => {
    it('deletes from both SecureStore and AsyncStorage', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null); // probe

      await secureDeleteItem('key');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('key');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('key');
    });

    it('only deletes from AsyncStorage when SecureStore is unavailable', async () => {
      mockSecureStore.getItemAsync.mockRejectedValueOnce(new Error('unavailable'));

      await secureDeleteItem('key');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('key');
      expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // migrateTokensToSecureStore
  // ---------------------------------------------------------------------------

  describe('migrateTokensToSecureStore', () => {
    it('migrates tokens from AsyncStorage to SecureStore', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null); // probe
      vi.mocked(AsyncStorage.getItem)
        .mockResolvedValueOnce(null) // migration flag check
        .mockResolvedValueOnce('access-tok') // first key
        .mockResolvedValueOnce('refresh-tok'); // second key

      await migrateTokensToSecureStore(['key_a', 'key_b']);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('key_a', 'access-tok');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('key_b', 'refresh-tok');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('key_a');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('key_b');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('sportykids_tokens_migrated', 'true');
    });

    it('skips migration if already done', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null); // probe
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce('true'); // already migrated

      await migrateTokensToSecureStore(['key_a']);

      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('skips migration when SecureStore is unavailable', async () => {
      mockSecureStore.getItemAsync.mockRejectedValueOnce(new Error('unavailable'));

      await migrateTokensToSecureStore(['key_a']);

      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
      // Should not even check the flag
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });

    it('continues migrating other keys if one fails', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null); // probe
      vi.mocked(AsyncStorage.getItem)
        .mockResolvedValueOnce(null) // migration flag check
        .mockResolvedValueOnce('tok1') // first key
        .mockResolvedValueOnce('tok2'); // second key

      // First setItemAsync succeeds, second fails
      mockSecureStore.setItemAsync
        .mockRejectedValueOnce(new Error('write fail'))
        .mockResolvedValueOnce(undefined);

      await migrateTokensToSecureStore(['key_a', 'key_b']);

      // key_b should still be migrated
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('key_b', 'tok2');
      // Migration flag should still be set
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('sportykids_tokens_migrated', 'true');
    });
  });

  // ---------------------------------------------------------------------------
  // isSecureStoreAvailable
  // ---------------------------------------------------------------------------

  describe('isSecureStoreAvailable', () => {
    it('returns true when SecureStore is available', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null); // probe
      expect(await isSecureStoreAvailable()).toBe(true);
    });

    it('returns false when SecureStore probe fails', async () => {
      mockSecureStore.getItemAsync.mockRejectedValueOnce(new Error('nope'));
      expect(await isSecureStoreAvailable()).toBe(false);
    });
  });
});
