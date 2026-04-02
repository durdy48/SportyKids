import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock dependencies
vi.mock('../../config/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    activityLog: {
      count: vi.fn(),
    },
  },
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { prisma } = await import('../../config/database');
const { subscriptionGuard } = await import('../subscription-guard');

function createMockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    query: {},
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response {
  return {} as Response;
}

describe('subscriptionGuard', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  it('passes through when no userId is provided', async () => {
    const middleware = subscriptionGuard('news');
    await middleware(createMockReq(), createMockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes through when user is not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const middleware = subscriptionGuard('news');
    await middleware(createMockReq({ query: { userId: 'u1' } }), createMockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes through for premium user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      subscriptionTier: 'premium',
      subscriptionExpiry: new Date(Date.now() + 86400000),
      parentUserId: null,
      favoriteSports: ['football'],
    } as never);

    const middleware = subscriptionGuard('news');
    await middleware(createMockReq({ query: { userId: 'u1' } }), createMockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('throws 403 when free user exceeds news limit', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      subscriptionTier: 'free',
      subscriptionExpiry: null,
      parentUserId: null,
      favoriteSports: ['football'],
    } as never);
    vi.mocked(prisma.activityLog.count).mockResolvedValue(5);

    const middleware = subscriptionGuard('news');
    await expect(
      middleware(createMockReq({ query: { userId: 'u1' } }), createMockRes(), next),
    ).rejects.toThrow('Daily limit reached');
    expect(next).not.toHaveBeenCalled();
  });

  it('throws 403 when free user exceeds reels limit', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      subscriptionTier: 'free',
      subscriptionExpiry: null,
      parentUserId: null,
      favoriteSports: ['tennis'],
    } as never);
    vi.mocked(prisma.activityLog.count).mockResolvedValue(5);

    const middleware = subscriptionGuard('reels');
    await expect(
      middleware(createMockReq({ query: { userId: 'u1' } }), createMockRes(), next),
    ).rejects.toThrow('Daily limit reached');
  });

  it('throws 403 when free user exceeds quiz limit', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      subscriptionTier: 'free',
      subscriptionExpiry: null,
      parentUserId: null,
      favoriteSports: ['football'],
    } as never);
    vi.mocked(prisma.activityLog.count).mockResolvedValue(3);

    const middleware = subscriptionGuard('quiz');
    await expect(
      middleware(createMockReq({ query: { userId: 'u1' } }), createMockRes(), next),
    ).rejects.toThrow('Daily limit reached');
  });

  it('passes through when free user is under limit', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      subscriptionTier: 'free',
      subscriptionExpiry: null,
      parentUserId: null,
      favoriteSports: ['football'],
    } as never);
    vi.mocked(prisma.activityLog.count).mockResolvedValue(2);

    const middleware = subscriptionGuard('news');
    await middleware(createMockReq({ query: { userId: 'u1' } }), createMockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('throws 403 when free user tries to access restricted sport', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      subscriptionTier: 'free',
      subscriptionExpiry: null,
      parentUserId: null,
      favoriteSports: ['football'],
    } as never);
    vi.mocked(prisma.activityLog.count).mockResolvedValue(0);

    const middleware = subscriptionGuard('news');
    await expect(
      middleware(
        createMockReq({ query: { userId: 'u1', sport: 'tennis' } }),
        createMockRes(),
        next,
      ),
    ).rejects.toThrow('Sport not available on free plan');
  });

  it('allows free user to access their favorite sport', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      subscriptionTier: 'free',
      subscriptionExpiry: null,
      parentUserId: null,
      favoriteSports: ['football'],
    } as never);
    vi.mocked(prisma.activityLog.count).mockResolvedValue(0);

    const middleware = subscriptionGuard('news');
    await middleware(
      createMockReq({ query: { userId: 'u1', sport: 'football' } }),
      createMockRes(),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not check sport restriction for quiz format', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      subscriptionTier: 'free',
      subscriptionExpiry: null,
      parentUserId: null,
      favoriteSports: ['football'],
    } as never);
    vi.mocked(prisma.activityLog.count).mockResolvedValue(0);

    const middleware = subscriptionGuard('quiz');
    await middleware(
      createMockReq({ query: { userId: 'u1', sport: 'tennis' } }),
      createMockRes(),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reads userId from x-user-id header if not in query', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      subscriptionTier: 'free',
      subscriptionExpiry: null,
      parentUserId: null,
      favoriteSports: ['football'],
    } as never);
    vi.mocked(prisma.activityLog.count).mockResolvedValue(0);

    const middleware = subscriptionGuard('news');
    await middleware(
      createMockReq({ headers: { 'x-user-id': 'u1' } }),
      createMockRes(),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });
});
