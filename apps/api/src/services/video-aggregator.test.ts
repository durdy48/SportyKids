import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies (must be before imports)
// ---------------------------------------------------------------------------

const { mockParseURL } = vi.hoisted(() => {
  const mockParseURL = vi.fn();
  return { mockParseURL };
});

vi.mock('rss-parser', () => {
  class MockParser {
    parseURL = mockParseURL;
  }
  return { default: MockParser };
});

vi.mock('../config/database', () => ({
  prisma: {
    reel: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    videoSource: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('./content-moderator', () => ({
  moderateContent: vi.fn().mockResolvedValue({ status: 'approved' }),
}));

vi.mock('./classifier', () => ({
  classifyNews: vi.fn().mockReturnValue({ team: null, minAge: 6, maxAge: 14 }),
}));

import {
  buildFeedUrl,
  extractYouTubeVideoId,
  buildEmbedUrl,
  buildThumbnailUrl,
  syncVideoSource,
  syncAllVideoSources,
} from './video-aggregator';
import { prisma } from '../config/database';
import { moderateContent } from './content-moderator';
import { classifyNews } from './classifier';

// ---------------------------------------------------------------------------
// Helper function tests
// ---------------------------------------------------------------------------

describe('buildFeedUrl', () => {
  it('builds a YouTube channel feed URL', () => {
    const url = buildFeedUrl('youtube_channel', 'UC1234');
    expect(url).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UC1234');
  });

  it('builds a YouTube playlist feed URL', () => {
    const url = buildFeedUrl('youtube_playlist', undefined, 'PL5678');
    expect(url).toBe('https://www.youtube.com/feeds/videos.xml?playlist_id=PL5678');
  });

  it('returns empty string for unsupported platform', () => {
    expect(buildFeedUrl('instagram', 'some_id')).toBe('');
  });

  it('returns empty string when channelId is missing for youtube_channel', () => {
    expect(buildFeedUrl('youtube_channel')).toBe('');
  });

  it('returns empty string when playlistId is missing for youtube_playlist', () => {
    expect(buildFeedUrl('youtube_playlist')).toBe('');
  });
});

describe('extractYouTubeVideoId', () => {
  it('extracts from yt:video: atom ID format', () => {
    expect(extractYouTubeVideoId('yt:video:dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from standard YouTube URL with v= parameter', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from YouTube embed URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from youtu.be short URL', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube input', () => {
    expect(extractYouTubeVideoId('not-a-youtube-id')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractYouTubeVideoId('')).toBeNull();
  });
});

describe('buildEmbedUrl', () => {
  it('builds the correct embed URL', () => {
    expect(buildEmbedUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });
});

describe('buildThumbnailUrl', () => {
  it('builds the correct thumbnail URL', () => {
    expect(buildThumbnailUrl('dQw4w9WgXcQ')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  });
});

// ---------------------------------------------------------------------------
// syncVideoSource tests
// ---------------------------------------------------------------------------

describe('syncVideoSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncs new videos from a YouTube channel feed', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        {
          id: 'yt:video:abc123def45',
          title: 'Great Football Goal',
          link: 'https://www.youtube.com/watch?v=abc123def45',
          isoDate: '2026-03-25T10:00:00Z',
        },
      ],
    });

    vi.mocked(prisma.reel.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reel.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.reel.upsert).mockResolvedValue({ id: 'reel-1' } as never);
    vi.mocked(prisma.videoSource.update).mockResolvedValue({} as never);
    vi.mocked(moderateContent).mockResolvedValue({ status: 'approved' });
    vi.mocked(classifyNews).mockReturnValue({ team: 'Real Madrid', minAge: 6, maxAge: 14 });

    const result = await syncVideoSource(
      'source-1',
      'La Liga YouTube',
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC1234',
      'football',
    );

    expect(result.itemsProcessed).toBe(1);
    expect(result.itemsCreated).toBe(1);
    expect(result.moderationApproved).toBe(1);
  });

  it('skips items that already exist and are not pending', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        {
          id: 'yt:video:existing12345',
          title: 'Existing Video',
          link: 'https://www.youtube.com/watch?v=existing12345',
          isoDate: '2026-03-25T10:00:00Z',
        },
      ],
    });

    vi.mocked(prisma.reel.findMany).mockResolvedValue([
      { rssGuid: 'yt:video:existing12345', safetyStatus: 'approved' },
    ] as never);
    vi.mocked(prisma.reel.findUnique).mockResolvedValue({
      id: 'reel-existing',
      safetyStatus: 'approved',
    } as never);
    vi.mocked(prisma.videoSource.update).mockResolvedValue({} as never);

    const result = await syncVideoSource(
      'source-1',
      'Test Channel',
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC1234',
      'football',
    );

    expect(result.itemsSkipped).toBe(1);
    expect(result.itemsCreated).toBe(0);
  });

  it('handles moderation rejection', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        {
          id: 'yt:video:rejected12345',
          title: 'Video with betting content',
          link: 'https://www.youtube.com/watch?v=rejected12345',
          isoDate: '2026-03-25T10:00:00Z',
        },
      ],
    });

    vi.mocked(prisma.reel.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reel.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.reel.upsert).mockResolvedValue({ id: 'reel-rejected' } as never);
    vi.mocked(prisma.videoSource.update).mockResolvedValue({} as never);
    vi.mocked(moderateContent).mockResolvedValue({ status: 'rejected', reason: 'Gambling content' });

    const result = await syncVideoSource(
      'source-1',
      'Test Channel',
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC1234',
      'football',
    );

    expect(result.moderationRejected).toBe(1);
    expect(result.itemsCreated).toBe(1);
  });

  it('skips items without valid YouTube video ID', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        {
          id: 'not-a-youtube-id',
          title: 'Invalid Video',
          link: 'https://example.com/video',
        },
      ],
    });

    vi.mocked(prisma.reel.findMany).mockResolvedValue([]);
    vi.mocked(prisma.videoSource.update).mockResolvedValue({} as never);

    const result = await syncVideoSource(
      'source-1',
      'Test Channel',
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC1234',
      'football',
    );

    expect(result.itemsProcessed).toBe(0);
    expect(result.itemsCreated).toBe(0);
  });

  it('handles feed parse errors gracefully', async () => {
    mockParseURL.mockRejectedValue(new Error('Network timeout'));

    const result = await syncVideoSource(
      'source-1',
      'Broken Channel',
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC_BROKEN',
      'football',
    );

    expect(result.itemsProcessed).toBe(0);
    expect(result.itemsCreated).toBe(0);
  });

  it('handles moderation errors with fail-open', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        {
          id: 'yt:video:moderr12345',
          title: 'Moderation Error Video',
          link: 'https://www.youtube.com/watch?v=moderr12345',
          isoDate: '2026-03-25T10:00:00Z',
        },
      ],
    });

    vi.mocked(prisma.reel.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reel.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.reel.upsert).mockResolvedValue({ id: 'reel-moderr' } as never);
    vi.mocked(prisma.videoSource.update).mockResolvedValue({} as never);
    vi.mocked(moderateContent).mockRejectedValue(new Error('AI unavailable'));

    const result = await syncVideoSource(
      'source-1',
      'Test Channel',
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC1234',
      'football',
    );

    expect(result.moderationErrors).toBe(1);
    expect(result.moderationApproved).toBe(1);
    expect(result.itemsCreated).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// syncAllVideoSources tests
// ---------------------------------------------------------------------------

describe('syncAllVideoSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('only syncs YouTube platform sources', async () => {
    vi.mocked(prisma.videoSource.findMany).mockResolvedValue([
      { id: 's1', name: 'YouTube Channel', platform: 'youtube_channel', feedUrl: 'https://yt.com/feed1', sport: 'football', active: true },
      { id: 's2', name: 'Instagram (unsupported)', platform: 'instagram', feedUrl: 'https://ig.com/feed1', sport: 'football', active: true },
    ] as never);

    mockParseURL.mockResolvedValue({ items: [] });
    vi.mocked(prisma.reel.findMany).mockResolvedValue([]);
    vi.mocked(prisma.videoSource.update).mockResolvedValue({} as never);

    const result = await syncAllVideoSources();

    expect(result.sources.length).toBe(1);
    expect(result.sources[0].sourceName).toBe('YouTube Channel');
  });

  it('returns empty result when no active sources', async () => {
    vi.mocked(prisma.videoSource.findMany).mockResolvedValue([]);

    const result = await syncAllVideoSources();

    expect(result.totalCreated).toBe(0);
    expect(result.sources.length).toBe(0);
  });

  it('aggregates results from multiple sources', async () => {
    vi.mocked(prisma.videoSource.findMany).mockResolvedValue([
      { id: 's1', name: 'Channel A', platform: 'youtube_channel', feedUrl: 'https://yt.com/feedA', sport: 'football', active: true },
      { id: 's2', name: 'Channel B', platform: 'youtube_playlist', feedUrl: 'https://yt.com/feedB', sport: 'basketball', active: true },
    ] as never);

    mockParseURL.mockResolvedValue({
      items: [
        {
          id: 'yt:video:video1234567',
          title: 'Test Video',
          link: 'https://www.youtube.com/watch?v=video1234567',
          isoDate: '2026-03-25T10:00:00Z',
        },
      ],
    });

    vi.mocked(prisma.reel.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reel.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.reel.upsert).mockResolvedValue({ id: 'reel-new' } as never);
    vi.mocked(prisma.videoSource.update).mockResolvedValue({} as never);
    vi.mocked(moderateContent).mockResolvedValue({ status: 'approved' });

    const result = await syncAllVideoSources();

    expect(result.sources.length).toBe(2);
    expect(result.totalCreated).toBe(2);
  });
});
