import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';

// Unmock the modules that vitest.setup.ts mocks globally
vi.unmock('../config');
vi.unmock('expo-constants');

// Controllable mock for expo-constants
let mockExpoConfig: Record<string, unknown> | undefined = {
  extra: { eas: { channel: undefined } },
  updates: { channel: undefined },
  hostUri: undefined,
};

vi.mock('expo-constants', () => ({
  default: {
    get expoConfig() {
      return mockExpoConfig;
    },
  },
}));

describe('resolveApiBase', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_API_BASE;
    mockExpoConfig = {
      extra: { eas: { channel: undefined } },
      updates: { channel: undefined },
      hostUri: undefined,
    };
    vi.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  async function getResolveApiBase() {
    const mod = await import('../config');
    return mod.resolveApiBase;
  }

  it('uses EXPO_PUBLIC_API_BASE env var when set', async () => {
    process.env.EXPO_PUBLIC_API_BASE = 'https://custom.api.example.com/api';
    const resolveApiBase = await getResolveApiBase();
    expect(resolveApiBase()).toBe('https://custom.api.example.com/api');
  });

  it('uses production URL when EAS channel is production', async () => {
    mockExpoConfig = { extra: { eas: { channel: 'production' } } };
    const resolveApiBase = await getResolveApiBase();
    expect(resolveApiBase()).toBe('https://sportykids-api.fly.dev/api');
  });

  it('uses preview URL when EAS channel is preview', async () => {
    mockExpoConfig = { extra: { eas: { channel: 'preview' } } };
    const resolveApiBase = await getResolveApiBase();
    expect(resolveApiBase()).toBe('https://sportykids-api.fly.dev/api');
  });

  it('falls back to updates.channel when extra.eas.channel is missing', async () => {
    mockExpoConfig = {
      extra: { eas: { channel: undefined } },
      updates: { channel: 'production' },
    };
    const resolveApiBase = await getResolveApiBase();
    expect(resolveApiBase()).toBe('https://sportykids-api.fly.dev/api');
  });

  it('uses debugger host IP from hostUri', async () => {
    mockExpoConfig = { hostUri: '192.168.1.189:8081' };
    const resolveApiBase = await getResolveApiBase();
    expect(resolveApiBase()).toBe('http://192.168.1.189:3001/api');
  });

  it('falls back to localhost when no signal available', async () => {
    mockExpoConfig = {};
    const resolveApiBase = await getResolveApiBase();
    expect(resolveApiBase()).toBe('http://localhost:3001/api');
  });

  it('env var takes priority over EAS channel', async () => {
    process.env.EXPO_PUBLIC_API_BASE = 'https://override.example.com/api';
    mockExpoConfig = { extra: { eas: { channel: 'production' } } };
    const resolveApiBase = await getResolveApiBase();
    expect(resolveApiBase()).toBe('https://override.example.com/api');
  });

  it('EAS channel takes priority over debugger host', async () => {
    mockExpoConfig = {
      extra: { eas: { channel: 'preview' } },
      hostUri: '192.168.1.100:8081',
    };
    const resolveApiBase = await getResolveApiBase();
    expect(resolveApiBase()).toBe('https://sportykids-api.fly.dev/api');
  });

  it('exports API_BASE as a string constant', async () => {
    const mod = await import('../config');
    expect(typeof mod.API_BASE).toBe('string');
    expect(mod.API_BASE.length).toBeGreaterThan(0);
  });
});
