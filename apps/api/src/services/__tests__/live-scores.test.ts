import { describe, it, expect } from 'vitest';
import {
  detectEvents,
  parseGoalCount,
  parseRedCardCount,
  mapStatus,
  buildNotificationPayload,
} from '../live-scores';

describe('live-scores service', () => {
  describe('parseGoalCount', () => {
    it('returns 0 for empty string', () => {
      expect(parseGoalCount('')).toBe(0);
    });

    it('counts single goal', () => {
      expect(parseGoalCount("10':Messi;")).toBe(1);
    });

    it('counts multiple goals', () => {
      expect(parseGoalCount("10':Messi;25':Vinicius;80':Bellingham;")).toBe(3);
    });

    it('handles whitespace-only string', () => {
      expect(parseGoalCount('  ')).toBe(0);
    });
  });

  describe('parseRedCardCount', () => {
    it('returns 0 for empty string', () => {
      expect(parseRedCardCount('')).toBe(0);
    });

    it('counts single red card', () => {
      expect(parseRedCardCount("45':Ramos;")).toBe(1);
    });

    it('counts multiple red cards', () => {
      expect(parseRedCardCount("45':Ramos;70':Casemiro;")).toBe(2);
    });
  });

  describe('mapStatus', () => {
    it('maps NS to not_started', () => {
      expect(mapStatus('Not Started', '0')).toBe('not_started');
    });

    it('maps FT to finished', () => {
      expect(mapStatus('Match Finished', '90')).toBe('finished');
    });

    it('maps HT to half_time', () => {
      expect(mapStatus('Halftime', 'HT')).toBe('half_time');
    });

    it('maps live match with minute progress', () => {
      expect(mapStatus('In Progress', '65')).toBe('live');
    });

    it('maps 1H/2H to live', () => {
      expect(mapStatus('1st Half', '30')).toBe('live');
    });

    it('returns not_started for unknown', () => {
      expect(mapStatus('', '')).toBe('not_started');
    });
  });

  describe('detectEvents', () => {
    const base = {
      homeTeam: 'Real Madrid',
      awayTeam: 'Barcelona',
      league: 'La Liga',
      sport: 'football',
    };

    it('detects match start', () => {
      const prev = { ...base, status: 'not_started' as const, homeScore: 0, awayScore: 0, homeGoalDetails: '', awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      const curr = { ...base, status: 'live' as const, homeScore: 0, awayScore: 0, homeGoalDetails: '', awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      const events = detectEvents(prev, curr);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('match_start');
    });

    it('detects home goal', () => {
      const prev = { ...base, status: 'live' as const, homeScore: 0, awayScore: 0, homeGoalDetails: '', awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      const curr = { ...base, status: 'live' as const, homeScore: 1, awayScore: 0, homeGoalDetails: "10':Vinicius;", awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      const events = detectEvents(prev, curr);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('goal');
      expect(events[0].team).toBe('Real Madrid');
    });

    it('detects away goal', () => {
      const prev = { ...base, status: 'live' as const, homeScore: 1, awayScore: 0, homeGoalDetails: "10':Vinicius;", awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      const curr = { ...base, status: 'live' as const, homeScore: 1, awayScore: 1, homeGoalDetails: "10':Vinicius;", awayGoalDetails: "25':Lamine Yamal;", homeRedCards: '', awayRedCards: '' };
      const events = detectEvents(prev, curr);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('goal');
      expect(events[0].team).toBe('Barcelona');
    });

    it('detects half time', () => {
      const prev = { ...base, status: 'live' as const, homeScore: 1, awayScore: 0, homeGoalDetails: '', awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      const curr = { ...base, status: 'half_time' as const, homeScore: 1, awayScore: 0, homeGoalDetails: '', awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      const events = detectEvents(prev, curr);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('half_time');
    });

    it('detects match end', () => {
      const prev = { ...base, status: 'live' as const, homeScore: 2, awayScore: 1, homeGoalDetails: '', awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      const curr = { ...base, status: 'finished' as const, homeScore: 2, awayScore: 1, homeGoalDetails: '', awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      const events = detectEvents(prev, curr);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('match_end');
    });

    it('detects red card', () => {
      const prev = { ...base, status: 'live' as const, homeScore: 1, awayScore: 0, homeGoalDetails: '', awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      const curr = { ...base, status: 'live' as const, homeScore: 1, awayScore: 0, homeGoalDetails: '', awayGoalDetails: '', homeRedCards: "60':Ramos;", awayRedCards: '' };
      const events = detectEvents(prev, curr);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('red_card');
      expect(events[0].team).toBe('Real Madrid');
    });

    it('detects multiple events at once', () => {
      const prev = { ...base, status: 'live' as const, homeScore: 0, awayScore: 0, homeGoalDetails: '', awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      const curr = { ...base, status: 'live' as const, homeScore: 1, awayScore: 0, homeGoalDetails: "10':Vinicius;", awayGoalDetails: '', homeRedCards: '', awayRedCards: "15':Gavi;" };
      const events = detectEvents(prev, curr);
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.type)).toContain('goal');
      expect(events.map((e) => e.type)).toContain('red_card');
    });

    it('returns empty for no changes', () => {
      const state = { ...base, status: 'live' as const, homeScore: 1, awayScore: 0, homeGoalDetails: "10':Vinicius;", awayGoalDetails: '', homeRedCards: '', awayRedCards: '' };
      expect(detectEvents(state, state)).toHaveLength(0);
    });
  });

  describe('buildNotificationPayload', () => {
    it('builds goal notification in Spanish', () => {
      const payload = buildNotificationPayload(
        {
          type: 'goal',
          team: 'Real Madrid',
          homeScore: 1,
          awayScore: 0,
        },
        'Real Madrid',
        'Barcelona',
        'es',
      );
      expect(payload.title).toContain('Real Madrid');
      expect(payload.body).toContain('Real Madrid');
      expect(payload.body).toContain('Barcelona');
    });

    it('builds match start notification in English', () => {
      const payload = buildNotificationPayload(
        {
          type: 'match_start',
          team: '',
          homeScore: 0,
          awayScore: 0,
        },
        'Liverpool',
        'Arsenal',
        'en',
      );
      expect(payload.title).toBeTruthy();
      expect(payload.body).toContain('Liverpool');
      expect(payload.body).toContain('Arsenal');
    });

    it('builds match end notification', () => {
      const payload = buildNotificationPayload(
        {
          type: 'match_end',
          team: '',
          homeScore: 3,
          awayScore: 2,
        },
        'Bayern Munich',
        'PSG',
        'en',
      );
      expect(payload.body).toContain('3');
      expect(payload.body).toContain('2');
    });
  });
});
