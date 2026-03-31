import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('../ai-client', () => ({
  getAIClient: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { moderateContent, moderateContentBatch, shouldFailOpen } from '../content-moderator';
import { getAIClient } from '../ai-client';

const mockSendMessage = vi.fn();

describe('content-moderator', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAIClient).mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as ReturnType<typeof getAIClient>);
    // Reset env vars
    delete process.env.MODERATION_FAIL_OPEN;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ---------------------------------------------------------------------------
  // shouldFailOpen
  // ---------------------------------------------------------------------------

  describe('shouldFailOpen', () => {
    it('returns true in development (NODE_ENV !== production)', () => {
      process.env.NODE_ENV = 'development';
      expect(shouldFailOpen()).toBe(true);
    });

    it('returns true in test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(shouldFailOpen()).toBe(true);
    });

    it('returns false in production by default', () => {
      process.env.NODE_ENV = 'production';
      expect(shouldFailOpen()).toBe(false);
    });

    it('returns true in production when MODERATION_FAIL_OPEN=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.MODERATION_FAIL_OPEN = 'true';
      expect(shouldFailOpen()).toBe(true);
    });

    it('returns false in production when MODERATION_FAIL_OPEN=false', () => {
      process.env.NODE_ENV = 'production';
      process.env.MODERATION_FAIL_OPEN = 'false';
      expect(shouldFailOpen()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // moderateContent — successful AI responses
  // ---------------------------------------------------------------------------

  describe('moderateContent — AI responds', () => {
    it('returns approved for safe content', async () => {
      mockSendMessage.mockResolvedValueOnce({
        content: '{"status": "approved"}',
        model: 'test',
        provider: 'ollama',
      });

      const result = await moderateContent('Good sports news', 'A fun match today');
      expect(result.status).toBe('approved');
    });

    it('returns rejected for unsafe content', async () => {
      mockSendMessage.mockResolvedValueOnce({
        content: '{"status": "rejected", "reason": "gambling references"}',
        model: 'test',
        provider: 'ollama',
      });

      const result = await moderateContent('Betting odds for today', 'Best odds...');
      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('gambling references');
    });

    it('handles JSON wrapped in markdown code blocks', async () => {
      mockSendMessage.mockResolvedValueOnce({
        content: '```json\n{"status": "approved"}\n```',
        model: 'test',
        provider: 'ollama',
      });

      const result = await moderateContent('Title', 'Summary');
      expect(result.status).toBe('approved');
    });
  });

  // ---------------------------------------------------------------------------
  // moderateContent — AI failure in development (fail-open)
  // ---------------------------------------------------------------------------

  describe('moderateContent — AI failure in dev (fail-open)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('auto-approves when AI throws', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('AI unavailable'));

      const result = await moderateContent('Title', 'Summary');
      expect(result.status).toBe('approved');
      expect(result.reason).toContain('AI unavailable');
    });

    it('auto-approves when response is unparseable', async () => {
      mockSendMessage.mockResolvedValueOnce({
        content: 'not json at all',
        model: 'test',
        provider: 'ollama',
      });

      const result = await moderateContent('Title', 'Summary');
      expect(result.status).toBe('approved');
      expect(result.reason).toContain('unparseable');
    });

    it('auto-approves when response has unknown status', async () => {
      mockSendMessage.mockResolvedValueOnce({
        content: '{"status": "unknown_value"}',
        model: 'test',
        provider: 'ollama',
      });

      const result = await moderateContent('Title', 'Summary');
      expect(result.status).toBe('approved');
    });
  });

  // ---------------------------------------------------------------------------
  // moderateContent — AI failure in production (fail-closed)
  // ---------------------------------------------------------------------------

  describe('moderateContent — AI failure in production (fail-closed)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('returns pending when AI throws', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('AI down'));

      const result = await moderateContent('Title', 'Summary');
      expect(result.status).toBe('pending');
      expect(result.reason).toBe('moderation-unavailable');
    });

    it('returns pending when response is unparseable', async () => {
      mockSendMessage.mockResolvedValueOnce({
        content: 'garbage',
        model: 'test',
        provider: 'ollama',
      });

      const result = await moderateContent('Title', 'Summary');
      expect(result.status).toBe('pending');
    });

    it('returns pending for unknown status values', async () => {
      mockSendMessage.mockResolvedValueOnce({
        content: '{"status": "maybe"}',
        model: 'test',
        provider: 'ollama',
      });

      const result = await moderateContent('Title', 'Summary');
      expect(result.status).toBe('pending');
    });
  });

  // ---------------------------------------------------------------------------
  // moderateContent — MODERATION_FAIL_OPEN override in production
  // ---------------------------------------------------------------------------

  describe('moderateContent — MODERATION_FAIL_OPEN override', () => {
    it('auto-approves in production when override is set', async () => {
      process.env.NODE_ENV = 'production';
      process.env.MODERATION_FAIL_OPEN = 'true';

      mockSendMessage.mockRejectedValueOnce(new Error('AI down'));

      const result = await moderateContent('Title', 'Summary');
      expect(result.status).toBe('approved');
      expect(result.reason).toContain('AI unavailable');
    });
  });

  // ---------------------------------------------------------------------------
  // moderateContentBatch
  // ---------------------------------------------------------------------------

  describe('moderateContentBatch', () => {
    it('returns results for all items', async () => {
      mockSendMessage
        .mockResolvedValueOnce({ content: '{"status": "approved"}', model: 't', provider: 'ollama' })
        .mockResolvedValueOnce({ content: '{"status": "rejected", "reason": "violence"}', model: 't', provider: 'ollama' });

      const results = await moderateContentBatch([
        { id: '1', title: 'Good news', summary: 'ok' },
        { id: '2', title: 'Bad news', summary: 'violent' },
      ]);

      expect(results.get('1')?.status).toBe('approved');
      expect(results.get('2')?.status).toBe('rejected');
      expect(results.size).toBe(2);
    });

    it('handles mixed results with pending in production', async () => {
      process.env.NODE_ENV = 'production';
      mockSendMessage
        .mockResolvedValueOnce({ content: '{"status": "approved"}', model: 't', provider: 'ollama' })
        .mockRejectedValueOnce(new Error('AI down'));

      const results = await moderateContentBatch([
        { id: '1', title: 'ok', summary: 'ok' },
        { id: '2', title: 'fail', summary: 'fail' },
      ]);

      expect(results.get('1')?.status).toBe('approved');
      expect(results.get('2')?.status).toBe('pending');
    });
  });
});
