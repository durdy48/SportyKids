import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

const { prisma } = await import('../../config/database');
const { requireOrgAdmin } = await import('../require-org-admin');

function createReq(auth?: { userId: string; role: string }, params?: Record<string, string>) {
  return { auth, params: params ?? {} } as never;
}

function createRes() {
  return {} as never;
}

describe('requireOrgAdmin middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws AuthenticationError if no auth', async () => {
    const next = vi.fn();
    await expect(requireOrgAdmin(createReq(undefined, { id: 'org1' }), createRes(), next)).rejects.toThrow('Authentication required');
    expect(next).not.toHaveBeenCalled();
  });

  it('throws AuthorizationError if no org ID in params', async () => {
    const next = vi.fn();
    await expect(
      requireOrgAdmin(createReq({ userId: 'u1', role: 'parent' }, {}), createRes(), next),
    ).rejects.toThrow('Organization ID required');
  });

  it('throws AuthorizationError if user not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const next = vi.fn();
    await expect(
      requireOrgAdmin(createReq({ userId: 'u1', role: 'parent' }, { id: 'org1' }), createRes(), next),
    ).rejects.toThrow('Insufficient permissions');
  });

  it('throws AuthorizationError if user belongs to different org', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      organizationId: 'org2',
      organizationRole: 'admin',
    } as never);
    const next = vi.fn();
    await expect(
      requireOrgAdmin(createReq({ userId: 'u1', role: 'parent' }, { id: 'org1' }), createRes(), next),
    ).rejects.toThrow('Insufficient permissions');
  });

  it('throws AuthorizationError if user is member not admin', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      organizationId: 'org1',
      organizationRole: 'member',
    } as never);
    const next = vi.fn();
    await expect(
      requireOrgAdmin(createReq({ userId: 'u1', role: 'parent' }, { id: 'org1' }), createRes(), next),
    ).rejects.toThrow('Insufficient permissions');
  });

  it('calls next() if user is org admin of the correct org', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      organizationId: 'org1',
      organizationRole: 'admin',
    } as never);
    const next = vi.fn();
    await requireOrgAdmin(createReq({ userId: 'u1', role: 'parent' }, { id: 'org1' }), createRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
