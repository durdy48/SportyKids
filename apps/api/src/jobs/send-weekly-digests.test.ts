import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn(() => ({ stop: vi.fn() })) },
}));

// Mock logger
vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock digest-generator
const mockGenerateDigestData = vi.fn();
const mockRenderDigestHtml = vi.fn();
vi.mock('../services/digest-generator', () => ({
  generateDigestData: (...args: unknown[]) => mockGenerateDigestData(...args),
  renderDigestHtml: (...args: unknown[]) => mockRenderDigestHtml(...args),
}));

// Mock nodemailer
const mockSendMail = vi.fn();
vi.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: (...args: unknown[]) => mockSendMail(...args) }),
}));

// Mock @sportykids/shared
vi.mock('@sportykids/shared', () => ({
  t: vi.fn((key: string) => key),
}));

// Mock prisma
const mockFindManyParental = vi.fn();
const mockUpdateParental = vi.fn();
vi.mock('../config/database', () => ({
  prisma: {
    parentalProfile: {
      findMany: (...args: unknown[]) => mockFindManyParental(...args),
      update: (...args: unknown[]) => mockUpdateParental(...args),
    },
  },
}));

import { processWeeklyDigests } from './send-weekly-digests';

describe('send-weekly-digests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear SMTP env vars
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
  });

  it('should process digests for enabled users on the correct day', async () => {
    mockFindManyParental.mockResolvedValue([
      {
        userId: 'u1',
        digestEmail: 'parent@test.com',
        user: { locale: 'es' },
      },
    ]);
    mockGenerateDigestData.mockResolvedValue({ userName: 'Test Kid' });
    mockRenderDigestHtml.mockReturnValue('<html>digest</html>');
    mockUpdateParental.mockResolvedValue({});

    await processWeeklyDigests();

    expect(mockGenerateDigestData).toHaveBeenCalledWith('u1');
    // lastDigestSentAt should be updated regardless of email sending
    expect(mockUpdateParental).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
  });

  it('should skip email when SMTP is not configured', async () => {
    mockFindManyParental.mockResolvedValue([
      {
        userId: 'u1',
        digestEmail: 'parent@test.com',
        user: { locale: 'es' },
      },
    ]);
    mockGenerateDigestData.mockResolvedValue({ userName: 'Kid' });
    mockRenderDigestHtml.mockReturnValue('<html/>');
    mockUpdateParental.mockResolvedValue({});

    await processWeeklyDigests();

    // No email sent since SMTP is not configured
    expect(mockSendMail).not.toHaveBeenCalled();
    // But lastDigestSentAt is still updated
    expect(mockUpdateParental).toHaveBeenCalled();
  });

  it('should send email when SMTP is configured', async () => {
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';

    mockFindManyParental.mockResolvedValue([
      {
        userId: 'u1',
        digestEmail: 'parent@test.com',
        user: { locale: 'en' },
      },
    ]);
    mockGenerateDigestData.mockResolvedValue({ userName: 'Kid' });
    mockRenderDigestHtml.mockReturnValue('<html>digest</html>');
    mockSendMail.mockResolvedValue({});
    mockUpdateParental.mockResolvedValue({});

    await processWeeklyDigests();

    expect(mockSendMail).toHaveBeenCalled();
  });

  it('should handle errors for individual profiles without stopping', async () => {
    mockFindManyParental.mockResolvedValue([
      { userId: 'u1', digestEmail: 'a@b.com', user: { locale: 'es' } },
      { userId: 'u2', digestEmail: 'c@d.com', user: { locale: 'es' } },
    ]);
    mockGenerateDigestData
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ userName: 'Kid2' });
    mockRenderDigestHtml.mockReturnValue('<html/>');
    mockUpdateParental.mockResolvedValue({});

    await processWeeklyDigests();

    // Second profile should still be processed
    expect(mockGenerateDigestData).toHaveBeenCalledTimes(2);
    // Only second profile gets updated
    expect(mockUpdateParental).toHaveBeenCalledTimes(1);
  });

  it('should do nothing when no profiles match the current day', async () => {
    mockFindManyParental.mockResolvedValue([]);

    await processWeeklyDigests();

    expect(mockGenerateDigestData).not.toHaveBeenCalled();
  });
});
