import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Static mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@sportykids/shared', () => ({
  getSportLabel: (sport: string, _locale: string) => sport,
  getAgeRangeLabel: (range: string, _locale: string) => range,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAIClientMock(returnValue: string) {
  return {
    isProviderAvailable: vi.fn().mockResolvedValue(true),
    getAIClient: vi.fn().mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue({ content: returnValue }),
    }),
  };
}

function validTimelessJSON(topic = 'ATP tennis rules') {
  return JSON.stringify({
    question: 'How many sets in a Grand Slam final?',
    options: ['3', '4', '5', '2'],
    correctAnswer: 2,
    topic,
    explanation: 'Grand Slam finals are best of 5 sets.',
  });
}

function validNewsJSON(topic = 'real madrid champions league') {
  return JSON.stringify({
    question: 'Who scored the winning goal?',
    options: ['Ronaldo', 'Benzema', 'Ramos', 'Bale'],
    correctAnswer: 1,
    points: 10,
    topic,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('quiz-generator', () => {
  beforeEach(() => {
    vi.resetModules();
    // Speed up tests: remove 1-second retry delays
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: Function) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    });
  });

  // -------------------------------------------------------------------------
  // generateTimelessQuestion — happy path
  // -------------------------------------------------------------------------
  describe('generateTimelessQuestion — happy path', () => {
    it('returns a GeneratedQuestion with isTimeless=true and a topic', async () => {
      vi.doMock('../ai-client', () =>
        makeAIClientMock(validTimelessJSON('atp tennis rules')),
      );

      const { generateTimelessQuestion } = await import('../quiz-generator');
      const result = await generateTimelessQuestion('tennis', '9-11', 'es');

      expect(result).not.toBeNull();
      expect(result!.isTimeless).toBe(true);
      expect(result!.topic).toBe('atp tennis rules');
      expect(result!.options).toHaveLength(4);
      expect(result!.correctAnswer).toBeGreaterThanOrEqual(0);
      expect(result!.correctAnswer).toBeLessThanOrEqual(3);
      expect(result!.sport).toBe('tennis');
      expect(result!.ageRange).toBe('9-11');
    });

    it('normalises topic to lowercase and trimmed', async () => {
      vi.doMock('../ai-client', () =>
        makeAIClientMock(validTimelessJSON('  FIFA World Cup HISTORY  ')),
      );

      const { generateTimelessQuestion } = await import('../quiz-generator');
      const result = await generateTimelessQuestion('football', '6-8', 'es');

      expect(result).not.toBeNull();
      expect(result!.topic).toBe('fifa world cup history');
    });

    it('truncates topic to 80 chars', async () => {
      const longTopic = 'a'.repeat(100);
      vi.doMock('../ai-client', () =>
        makeAIClientMock(validTimelessJSON(longTopic)),
      );

      const { generateTimelessQuestion } = await import('../quiz-generator');
      const result = await generateTimelessQuestion('basketball', '12-14', 'es');

      expect(result).not.toBeNull();
      expect(result!.topic.length).toBeLessThanOrEqual(80);
    });
  });

  // -------------------------------------------------------------------------
  // generateTimelessQuestion — AI failure returns null
  // -------------------------------------------------------------------------
  describe('generateTimelessQuestion — AI failure', () => {
    it('returns null when AI client throws', async () => {
      vi.doMock('../ai-client', () => ({
        isProviderAvailable: vi.fn().mockResolvedValue(true),
        getAIClient: vi.fn().mockReturnValue({
          sendMessage: vi.fn().mockRejectedValue(new Error('AI unavailable')),
        }),
      }));

      const { generateTimelessQuestion } = await import('../quiz-generator');
      const result = await generateTimelessQuestion('football', '9-11', 'es');

      expect(result).toBeNull();
    });

    it('returns null when provider is unavailable', async () => {
      vi.doMock('../ai-client', () => ({
        isProviderAvailable: vi.fn().mockResolvedValue(false),
        getAIClient: vi.fn().mockReturnValue({
          sendMessage: vi.fn(),
        }),
      }));

      const { generateTimelessQuestion } = await import('../quiz-generator');
      const result = await generateTimelessQuestion('football', '9-11', 'es');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // generateTimelessQuestion — invalid JSON returns null
  // -------------------------------------------------------------------------
  describe('generateTimelessQuestion — invalid/malformed JSON', () => {
    it('returns null when AI returns invalid JSON', async () => {
      vi.doMock('../ai-client', () =>
        makeAIClientMock('not valid json at all'),
      );

      const { generateTimelessQuestion } = await import('../quiz-generator');
      const result = await generateTimelessQuestion('tennis', '9-11', 'es');

      expect(result).toBeNull();
    });

    it('returns null when JSON fails Zod validation (missing topic)', async () => {
      const invalidJSON = JSON.stringify({
        question: 'A question',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        // topic is missing
      });
      vi.doMock('../ai-client', () => makeAIClientMock(invalidJSON));

      const { generateTimelessQuestion } = await import('../quiz-generator');
      const result = await generateTimelessQuestion('tennis', '9-11', 'es');

      expect(result).toBeNull();
    });

    it('returns null when options array has wrong length', async () => {
      const invalidJSON = JSON.stringify({
        question: 'A question?',
        options: ['A', 'B', 'C'], // only 3 options
        correctAnswer: 0,
        topic: 'some topic',
      });
      vi.doMock('../ai-client', () => makeAIClientMock(invalidJSON));

      const { generateTimelessQuestion } = await import('../quiz-generator');
      const result = await generateTimelessQuestion('swimming', '6-8', 'es');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // generateTimelessQuestion — sport field matches input
  // -------------------------------------------------------------------------
  describe('generateTimelessQuestion — sport field', () => {
    const sports = ['football', 'basketball', 'tennis', 'swimming', 'athletics', 'cycling', 'formula1', 'padel'];

    for (const sport of sports) {
      it(`returns sport="${sport}" in result`, async () => {
        vi.doMock('../ai-client', () =>
          makeAIClientMock(validTimelessJSON(`${sport} trivia`)),
        );

        const { generateTimelessQuestion } = await import('../quiz-generator');
        const result = await generateTimelessQuestion(sport, '9-11', 'es');

        expect(result).not.toBeNull();
        expect(result!.sport).toBe(sport);
      });
    }
  });

  // -------------------------------------------------------------------------
  // generateQuizFromNews — topic field returned
  // -------------------------------------------------------------------------
  describe('generateQuizFromNews — topic field', () => {
    it('returns topic field when AI includes it in response', async () => {
      vi.doMock('../ai-client', () =>
        makeAIClientMock(validNewsJSON('real madrid la liga')),
      );

      const { generateQuizFromNews } = await import('../quiz-generator');
      const result = await generateQuizFromNews(
        { title: 'Real Madrid wins', summary: 'Great match', sport: 'football' },
        '9-11',
        'es',
      );

      expect(result).not.toBeNull();
      expect(result!.topic).toBe('real madrid la liga');
    });

    it('normalises topic from news-based generator', async () => {
      vi.doMock('../ai-client', () =>
        makeAIClientMock(validNewsJSON('  REAL MADRID CHAMPIONS LEAGUE  ')),
      );

      const { generateQuizFromNews } = await import('../quiz-generator');
      const result = await generateQuizFromNews(
        { title: 'Champions League win', summary: 'Madrid won', sport: 'football' },
        '9-11',
        'es',
      );

      expect(result).not.toBeNull();
      expect(result!.topic).toBe('real madrid champions league');
    });

    it('works without topic (topic field is optional in news schema)', async () => {
      const jsonNoTopic = JSON.stringify({
        question: 'Who won the championship this year?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        points: 10,
      });
      vi.doMock('../ai-client', () => makeAIClientMock(jsonNoTopic));

      const { generateQuizFromNews } = await import('../quiz-generator');
      const result = await generateQuizFromNews(
        { title: 'Match result', summary: 'Summary', sport: 'basketball' },
        '6-8',
        'es',
      );

      expect(result).not.toBeNull();
      // topic is optional in news schema — may be undefined
      expect(result!.topic).toBeUndefined();
    });
  });
});
