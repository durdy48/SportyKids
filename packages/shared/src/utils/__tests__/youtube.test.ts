import { describe, it, expect } from 'vitest';
import {
  extractYouTubeVideoId,
  buildYouTubeEmbedUrl,
  getYouTubePlayerVars,
} from '../youtube';

describe('extractYouTubeVideoId', () => {
  it('extracts ID from watch URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from short URL', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from embed URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from shorts URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID with extra query params', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for empty string', () => {
    expect(extractYouTubeVideoId('')).toBeNull();
  });

  it('returns null for non-YouTube URL', () => {
    expect(extractYouTubeVideoId('https://vimeo.com/123456')).toBeNull();
  });

  it('returns null for malformed URL', () => {
    expect(extractYouTubeVideoId('not-a-url')).toBeNull();
  });
});

describe('buildYouTubeEmbedUrl', () => {
  const VIDEO_ID = 'dQw4w9WgXcQ';

  it('builds URL with child-safe params from video ID', () => {
    const url = buildYouTubeEmbedUrl(VIDEO_ID, 'web');
    expect(url).toContain(`/embed/${VIDEO_ID}`);
    expect(url).toContain('modestbranding=1');
    expect(url).toContain('rel=0');
    expect(url).toContain('iv_load_policy=3');
    expect(url).toContain('playsinline=1');
  });

  it('includes disablekb=1 to disable keyboard controls', () => {
    const url = buildYouTubeEmbedUrl(VIDEO_ID, 'web');
    expect(url).toContain('disablekb=1');
  });

  it('includes fs=0 on web platform', () => {
    const url = buildYouTubeEmbedUrl(VIDEO_ID, 'web');
    expect(url).toContain('fs=0');
  });

  it('excludes fs=0 on mobile platform', () => {
    const url = buildYouTubeEmbedUrl(VIDEO_ID, 'mobile');
    expect(url).not.toContain('fs=0');
  });

  it('accepts a full YouTube URL instead of just ID', () => {
    const url = buildYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'web');
    expect(url).toContain(`/embed/${VIDEO_ID}`);
  });

  it('applies overrides', () => {
    const url = buildYouTubeEmbedUrl(VIDEO_ID, 'web', { autoplay: 1 });
    expect(url).toContain('autoplay=1');
  });

  it('overrides default params', () => {
    const url = buildYouTubeEmbedUrl(VIDEO_ID, 'web', { rel: '1' });
    expect(url).toContain('rel=1');
  });

  it('returns original URL if video ID cannot be extracted', () => {
    const badUrl = 'https://vimeo.com/123';
    expect(buildYouTubeEmbedUrl(badUrl, 'web')).toBe(badUrl);
  });

  it('defaults to web platform', () => {
    const url = buildYouTubeEmbedUrl(VIDEO_ID);
    expect(url).toContain('fs=0');
  });
});

describe('getYouTubePlayerVars', () => {
  it('returns base child-safe player vars', () => {
    const vars = getYouTubePlayerVars();
    expect(vars.modestbranding).toBe(1);
    expect(vars.rel).toBe(0);
    expect(vars.iv_load_policy).toBe(3);
    expect(vars.disablekb).toBe(1);
    expect(vars.playsinline).toBe(1);
  });

  it('applies overrides', () => {
    const vars = getYouTubePlayerVars({ autoplay: 1 });
    expect(vars.autoplay).toBe(1);
    expect(vars.rel).toBe(0); // base params still present
  });

  it('allows overriding base params', () => {
    const vars = getYouTubePlayerVars({ rel: 1 });
    expect(vars.rel).toBe(1);
  });
});
