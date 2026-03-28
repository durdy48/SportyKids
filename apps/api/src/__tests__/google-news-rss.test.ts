import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Validate Google News RSS sources added to seed.ts.
 *
 * These tests read the seed file as text and extract the Google News entries
 * to validate naming, URL patterns, required fields, and uniqueness.
 */

const seedPath = resolve(__dirname, '../../prisma/seed.ts');
const seedContent = readFileSync(seedPath, 'utf-8');

// Extract the initialSources array block from seed content
const sourcesMatch = seedContent.match(
  /const initialSources:\s*RssSourceSeed\[\]\s*=\s*\[([\s\S]*?)\n\];/,
);
const sourcesBlock = sourcesMatch?.[1] ?? '';

// Parse individual source objects from the block
function parseSourceObjects(block: string) {
  const objects: Record<string, string>[] = [];
  const objectRegex = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = objectRegex.exec(block)) !== null) {
    const inner = match[1];
    const obj: Record<string, string> = {};
    const fieldRegex = /(\w+):\s*'([^']*)'/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRegex.exec(inner)) !== null) {
      obj[fieldMatch[1]] = fieldMatch[2];
    }
    if (obj.name) objects.push(obj);
  }
  return objects;
}

const allSources = parseSourceObjects(sourcesBlock);
const googleNewsSources = allSources.filter(
  (s) => s.category === 'google_news',
);
const teamNewsSources = allSources.filter(
  (s) => s.category === 'team_news',
);

describe('Google News RSS seed sources', () => {
  it('should have exactly 10 Google News sources', () => {
    expect(googleNewsSources).toHaveLength(10);
  });

  it('should use URLs matching the Google News RSS search pattern', () => {
    for (const source of googleNewsSources) {
      expect(source.url).toMatch(
        /^https:\/\/news\.google\.com\/rss\/search\?q=site:/,
      );
      expect(source.url).toMatch(/&hl=es&gl=ES$/);
    }
  });

  it('should follow naming convention "Google News: {Outlet} - {Sport}"', () => {
    const namePattern = /^Google News: .+ - (Football|Basketball|General)$/;
    for (const source of googleNewsSources) {
      expect(source.name).toMatch(namePattern);
    }
  });

  it('should use category "google_news" for all entries', () => {
    for (const source of googleNewsSources) {
      expect(source.category).toBe('google_news');
    }
  });

  it('should have all required fields (country, language, sport, description)', () => {
    for (const source of googleNewsSources) {
      expect(source.country).toBeTruthy();
      expect(source.language).toBeTruthy();
      expect(source.sport).toBeTruthy();
      expect(source.description).toBeTruthy();
      expect(source.url).toBeTruthy();
      expect(source.name).toBeTruthy();
    }
  });

  it('should have no duplicate URLs across all seed sources', () => {
    const urls = allSources.map((s) => s.url);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(urls.length);
  });

  it('should cover all 4 target outlets', () => {
    const outlets = new Set(
      googleNewsSources.map((s) => {
        const match = s.name.match(/^Google News: (.+) - /);
        return match?.[1];
      }),
    );
    expect(outlets).toContain('Estadio Deportivo');
    expect(outlets).toContain('Mucho Deporte');
    expect(outlets).toContain('El Desmarque');
    expect(outlets).toContain('El Correo de Andalucia');
    expect(outlets.size).toBe(4);
  });

  it('should have correct sport values (football or basketball only)', () => {
    const validSports = ['football', 'basketball'];
    for (const source of googleNewsSources) {
      expect(validSports).toContain(source.sport);
    }
  });
});

describe('Team news RSS seed sources', () => {
  it('should have 127 team/athlete news sources', () => {
    expect(teamNewsSources).toHaveLength(127);
  });

  it('should use Google News RSS URLs', () => {
    for (const source of teamNewsSources) {
      expect(source.url).toMatch(/^https:\/\/news\.google\.com\/rss\/search/);
    }
  });

  it('should follow naming convention "Google News: {Team}"', () => {
    for (const source of teamNewsSources) {
      expect(source.name).toMatch(/^Google News: .+$/);
    }
  });

  it('should use category "team_news"', () => {
    for (const source of teamNewsSources) {
      expect(source.category).toBe('team_news');
    }
  });

  it('should cover key Spanish teams', () => {
    const names = teamNewsSources.map((s) => s.name);
    expect(names).toContainEqual(expect.stringContaining('Real Madrid'));
    expect(names).toContainEqual(expect.stringContaining('Barcelona'));
    expect(names).toContainEqual(expect.stringContaining('Atletico'));
    expect(names).toContainEqual(expect.stringContaining('Sevilla'));
    expect(names).toContainEqual(expect.stringContaining('Real Betis'));
    expect(names).toContainEqual(expect.stringContaining('Valencia CF'));
    expect(names).toContainEqual(expect.stringContaining('Villarreal'));
  });

  it('should cover key international football teams', () => {
    const names = teamNewsSources.map((s) => s.name);
    expect(names).toContainEqual(expect.stringContaining('Manchester City'));
    expect(names).toContainEqual(expect.stringContaining('Liverpool'));
    expect(names).toContainEqual(expect.stringContaining('Arsenal'));
    expect(names).toContainEqual(expect.stringContaining('Bayern Munich'));
    expect(names).toContainEqual(expect.stringContaining('Juventus'));
    expect(names).toContainEqual(expect.stringContaining('PSG'));
    expect(names).toContainEqual(expect.stringContaining('Inter Milan'));
  });

  it('should cover key athletes', () => {
    const names = teamNewsSources.map((s) => s.name);
    expect(names).toContainEqual(expect.stringContaining('Carlos Alcaraz'));
    expect(names).toContainEqual(expect.stringContaining('Fernando Alonso'));
    expect(names).toContainEqual(expect.stringContaining('Max Verstappen'));
    expect(names).toContainEqual(expect.stringContaining('Tadej Pogacar'));
    expect(names).toContainEqual(expect.stringContaining('Noah Lyles'));
    expect(names).toContainEqual(expect.stringContaining('Leon Marchand'));
  });

  it('should cover all 8 sports', () => {
    const sports = new Set(teamNewsSources.map((s) => s.sport));
    expect(sports).toContain('football');
    expect(sports).toContain('basketball');
    expect(sports).toContain('tennis');
    expect(sports).toContain('formula1');
    expect(sports).toContain('cycling');
    expect(sports).toContain('swimming');
    expect(sports).toContain('athletics');
    expect(sports).toContain('padel');
    expect(sports.size).toBe(8);
  });

  it('should have required fields', () => {
    for (const source of teamNewsSources) {
      expect(source.country).toBeTruthy();
      expect(source.language).toBeTruthy();
      expect(source.sport).toBeTruthy();
      expect(source.description).toBeTruthy();
    }
  });
});
