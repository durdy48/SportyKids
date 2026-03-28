import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MissionCard } from './MissionCard';

vi.mock('@sportykids/shared', () => ({
  t: (key: string) => key,
}));

const mockFetchTodayMission = vi.fn();
const mockClaimMission = vi.fn();
vi.mock('@/lib/api', () => ({
  fetchTodayMission: (...args: unknown[]) => mockFetchTodayMission(...args),
  claimMission: (...args: unknown[]) => mockClaimMission(...args),
}));

vi.mock('@/lib/celebrations', () => ({
  celebrateMissionComplete: vi.fn(),
}));

describe('MissionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders uncompleted mission', async () => {
    mockFetchTodayMission.mockResolvedValue({
      mission: {
        id: 'm1',
        type: 'read_news',
        title: 'Read 3 news',
        description: 'Read 3 news today',
        progress: 1,
        target: 3,
        completed: false,
        claimed: false,
        reward: { type: 'sticker', amount: 0, label: 'sticker' },
      },
    });

    render(<MissionCard userId="u1" locale="en" />);

    await waitFor(() => {
      expect(screen.getByText('Read 3 news')).toBeTruthy();
    });

    expect(screen.getByText('mission.today')).toBeTruthy();
    expect(screen.getByText('mission.progress')).toBeTruthy();
  });

  it('renders expired state when no mission', async () => {
    mockFetchTodayMission.mockResolvedValue({ mission: null });

    render(<MissionCard userId="u1" locale="en" />);

    await waitFor(() => {
      expect(screen.getByText('mission.no_mission')).toBeTruthy();
    });
  });

  it('renders completed unclaimed state', async () => {
    mockFetchTodayMission.mockResolvedValue({
      mission: {
        id: 'm1',
        type: 'read_news',
        title: 'Read 3 news',
        description: 'Done!',
        progress: 3,
        target: 3,
        completed: true,
        claimed: false,
        reward: { type: 'sticker', amount: 0 },
      },
    });

    render(<MissionCard userId="u1" locale="en" />);

    await waitFor(() => {
      expect(screen.getByText('mission.claim')).toBeTruthy();
    });
  });

  it('renders claimed state', async () => {
    mockFetchTodayMission.mockResolvedValue({
      mission: {
        id: 'm1',
        type: 'read_news',
        title: 'Read 3 news',
        description: 'Done!',
        progress: 3,
        target: 3,
        completed: true,
        claimed: true,
        reward: { type: 'sticker', amount: 0 },
      },
    });

    render(<MissionCard userId="u1" locale="en" />);

    await waitFor(() => {
      expect(screen.getByText('mission.completed')).toBeTruthy();
    });
  });

  it('refreshes on activity-logged event', async () => {
    mockFetchTodayMission.mockResolvedValue({
      mission: {
        id: 'm1',
        type: 'read_news',
        title: 'Read 3 news',
        description: 'Desc',
        progress: 0,
        target: 3,
        completed: false,
        claimed: false,
        reward: { type: 'sticker', amount: 0 },
      },
    });

    render(<MissionCard userId="u1" locale="en" />);

    await waitFor(() => {
      expect(mockFetchTodayMission).toHaveBeenCalledTimes(1);
    });

    // Dispatch activity-logged event
    window.dispatchEvent(new CustomEvent('sportykids:activity-logged', { detail: { type: 'news_viewed' } }));

    await waitFor(() => {
      expect(mockFetchTodayMission).toHaveBeenCalledTimes(2);
    });
  });
});
