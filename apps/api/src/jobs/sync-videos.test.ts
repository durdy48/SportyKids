import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn(() => ({ stop: vi.fn() })) },
}));

// Mock logger
vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock video-aggregator
const mockSyncAllVideoSources = vi.fn();
vi.mock('../services/video-aggregator', () => ({
  syncAllVideoSources: (...args: unknown[]) => mockSyncAllVideoSources(...args),
}));

import { runManualVideoSync, startVideoSyncJob } from './sync-videos';

describe('sync-videos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runManualVideoSync', () => {
    it('should call syncAllVideoSources and return result', async () => {
      const result = {
        totalProcessed: 5,
        totalCreated: 2,
        totalApproved: 2,
        totalRejected: 0,
        totalErrors: 0,
        sources: [],
      };
      mockSyncAllVideoSources.mockResolvedValue(result);

      const actual = await runManualVideoSync();
      expect(actual).toEqual(result);
      expect(mockSyncAllVideoSources).toHaveBeenCalledOnce();
    });

    it('should propagate errors from syncAllVideoSources', async () => {
      mockSyncAllVideoSources.mockRejectedValue(new Error('Video sync failed'));

      await expect(runManualVideoSync()).rejects.toThrow('Video sync failed');
    });
  });

  describe('startVideoSyncJob', () => {
    it('should schedule cron job every 6 hours', async () => {
      const cron = await import('node-cron');

      startVideoSyncJob();

      expect(cron.default.schedule).toHaveBeenCalledWith(
        '0 */6 * * *',
        expect.any(Function),
      );
    });
  });
});
