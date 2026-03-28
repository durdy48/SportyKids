import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-cron
const mockSchedule = vi.fn(() => ({ stop: vi.fn() }));
vi.mock('node-cron', () => ({
  default: { schedule: (...args: unknown[]) => mockSchedule(...args) },
}));

// Mock logger
const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();
vi.mock('../services/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock team-stats-sync
const mockSyncAllTeamStats = vi.fn();
vi.mock('../services/team-stats-sync', () => ({
  syncAllTeamStats: (...args: unknown[]) => mockSyncAllTeamStats(...args),
}));

describe('sync-team-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should schedule cron job at 04:00 UTC and call syncAllTeamStats', async () => {
    mockSyncAllTeamStats.mockResolvedValue({ synced: 15, failed: 0 });

    const { startTeamStatsSyncJob } = await import('./sync-team-stats');
    startTeamStatsSyncJob();

    expect(mockSchedule).toHaveBeenCalledWith(
      '0 4 * * *',
      expect.any(Function),
    );

    // Extract and run the cron handler
    const handler = mockSchedule.mock.calls[0]![1] as () => Promise<void>;
    await handler();

    expect(mockSyncAllTeamStats).toHaveBeenCalledOnce();
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      { synced: 15, failed: 0 },
      'Team stats sync completed',
    );
  });

  it('should log errors when syncAllTeamStats throws', async () => {
    const error = new Error('API down');
    mockSyncAllTeamStats.mockRejectedValue(error);

    const { startTeamStatsSyncJob } = await import('./sync-team-stats');
    startTeamStatsSyncJob();

    const handler = mockSchedule.mock.calls[0]![1] as () => Promise<void>;
    await handler();

    expect(mockLoggerError).toHaveBeenCalledWith(
      { err: error },
      'Team stats sync error',
    );
  });

  it('should not schedule twice if already active', async () => {
    const { startTeamStatsSyncJob } = await import('./sync-team-stats');
    startTeamStatsSyncJob();
    startTeamStatsSyncJob();

    // Only scheduled once
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });
});
