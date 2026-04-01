import { describe, it, expect } from 'vitest';
import { beforeSend } from '../lib/sentry-config';

describe('Sentry beforeSend PII stripping', () => {
  it('removes event.user', () => {
    const event = {
      message: 'test crash',
      user: { id: 'child-123', email: 'kid@example.com' },
      contexts: {},
    };

    const result = beforeSend(event);

    expect(result).not.toBeNull();
    expect(result.user).toBeUndefined();
  });

  it('removes event.contexts.profile', () => {
    const event = {
      message: 'test crash',
      contexts: {
        profile: { name: 'Child User', age: 8 },
        device: { model: 'iPhone 15' },
      },
    };

    const result = beforeSend(event);

    expect(result).not.toBeNull();
    const contexts = result.contexts as Record<string, unknown>;
    expect(contexts.profile).toBeUndefined();
    // Other context fields should remain untouched
    expect(contexts.device).toEqual({ model: 'iPhone 15' });
  });

  it('removes event.request (cookies/headers with tokens)', () => {
    const event = {
      message: 'test crash',
      request: { cookies: 'session=abc', headers: { authorization: 'Bearer token123' } },
    };

    const result = beforeSend(event);

    expect(result).not.toBeNull();
    expect(result.request).toBeUndefined();
  });

  it('removes event.contexts.culture (locale)', () => {
    const event = {
      message: 'test crash',
      contexts: {
        culture: { locale: 'es-ES', timezone: 'Europe/Madrid' },
        device: { model: 'iPhone 15' },
      },
    };

    const result = beforeSend(event);

    expect(result).not.toBeNull();
    const contexts = result.contexts as Record<string, unknown>;
    expect(contexts.culture).toBeUndefined();
    expect(contexts.device).toEqual({ model: 'iPhone 15' });
  });

  it('removes event.server_name', () => {
    const event = {
      message: 'test crash',
      server_name: 'sportykids-api-01',
    };

    const result = beforeSend(event);

    expect(result).not.toBeNull();
    expect(result.server_name).toBeUndefined();
  });

  it('returns the event (not null)', () => {
    const event = {
      message: 'crash',
      exception: { values: [{ type: 'Error', value: 'Something broke' }] },
    };

    const result = beforeSend(event);

    expect(result).not.toBeNull();
    expect(result).toBe(event);
  });

  it('handles event without contexts gracefully', () => {
    const event = {
      message: 'crash without contexts',
      user: { id: 'child-456' },
    };

    const result = beforeSend(event);

    expect(result).not.toBeNull();
    expect(result.user).toBeUndefined();
  });

  it('handles event without user gracefully', () => {
    const event = {
      message: 'crash without user',
      contexts: { os: { name: 'iOS' } },
    };

    const result = beforeSend(event);

    expect(result).not.toBeNull();
    expect(result.user).toBeUndefined();
    expect((result.contexts as Record<string, unknown>).os).toEqual({ name: 'iOS' });
  });
});
