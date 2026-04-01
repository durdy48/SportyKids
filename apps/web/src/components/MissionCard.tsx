'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Locale } from '@sportykids/shared';
import { t } from '@sportykids/shared';
import { fetchTodayMission, claimMission } from '@/lib/api';
import { celebrateMissionComplete } from '@/lib/celebrations';

interface MissionCardProps {
  userId: string;
  locale: Locale;
}

interface Mission {
  id: string;
  type: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  reward: {
    type: string;
    amount: number;
    label?: string;
  };
}

export function MissionCard({ userId, locale }: MissionCardProps) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [expired, setExpired] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const prevCompletedRef = useRef(false);

  const loadMission = useCallback(() => {
    fetchTodayMission(userId)
      .then((data: { mission: Mission | null; expired?: boolean }) => {
        if (data && data.mission) {
          setMission(data.mission);
          setExpired(false);
        } else {
          setMission(null);
          setExpired(data?.expired ?? true);
        }
      })
      .catch(() => {
        // No mission available
      });
  }, [userId]);

  useEffect(() => {
    loadMission();
  }, [loadMission]);

  // Listen for activity-logged events to refresh mission progress
  useEffect(() => {
    const handler = () => loadMission();
    window.addEventListener('sportykids:activity-logged', handler);
    return () => window.removeEventListener('sportykids:activity-logged', handler);
  }, [loadMission]);

  // Trigger confetti when mission transitions to completed
  useEffect(() => {
    if (mission?.completed && !prevCompletedRef.current) {
      celebrateMissionComplete();
    }
    prevCompletedRef.current = mission?.completed ?? false;
  }, [mission?.completed]);

  // Auto-collapse after claim
  useEffect(() => {
    if (mission?.claimed) {
      const timer = setTimeout(() => setCollapsed(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [mission?.claimed]);

  // Expired state
  if (expired && !mission) {
    return (
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center gap-3">
        <span className="text-2xl">{'\u{1F319}'}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-muted)]">
            {t('mission.no_mission', locale)}
          </p>
        </div>
      </div>
    );
  }

  if (!mission || collapsed) return null;

  const progressPercent = Math.min(100, Math.round((mission.progress / mission.target) * 100));

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const result = await claimMission(userId);
      setMission((prev) => prev ? { ...prev, claimed: true, ...result.mission } : prev);
    } catch {
      // Ignore claim errors
    } finally {
      setClaiming(false);
    }
  };

  // Claimed state: compact green card
  if (mission.claimed) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-2xl p-4 flex items-center gap-3 transition-all">
        <span className="text-2xl">&#9989;</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            {t('mission.completed', locale)}
          </p>
        </div>
      </div>
    );
  }

  // Completed unclaimed: yellow pulsing card
  if (mission.completed && !mission.claimed) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-600 rounded-2xl p-5 space-y-3 transition-all">
        <div className="flex items-center gap-3">
          <span className="text-2xl">&#127942;</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-[var(--color-text)]">{mission.title}</p>
            <p className="text-xs text-[var(--color-muted)]">{mission.description}</p>
          </div>
        </div>
        {/* Full progress bar */}
        <div className="w-full bg-[var(--color-border)] rounded-full h-2">
          <div className="bg-yellow-400 h-2 rounded-full w-full" />
        </div>
        <button
          onClick={handleClaim}
          disabled={claiming}
          aria-label="Claim mission reward"
          className="w-full py-3 rounded-xl text-sm font-bold bg-yellow-400 text-yellow-900 hover:bg-yellow-500 transition-colors animate-pulse disabled:opacity-60"
        >
          {claiming ? t('buttons.loading', locale) : t('mission.claim', locale)}
        </button>
      </div>
    );
  }

  // Uncompleted: blue card with progress
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-5 space-y-3 transition-all">
      <div className="flex items-center gap-3">
        <span className="text-2xl">&#127919;</span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-[var(--color-blue)] uppercase tracking-wide">
            {t('mission.today', locale)}
          </p>
          <p className="text-sm font-bold text-[var(--color-text)]">{mission.title}</p>
          <p className="text-xs text-[var(--color-muted)]">{mission.description}</p>
        </div>
        {mission.reward && (
          <span className="text-xs font-bold text-[var(--color-yellow)] bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full whitespace-nowrap">
            +{mission.reward.amount} {mission.reward.label ?? 'pts'}
          </span>
        )}
      </div>
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="w-full bg-[var(--color-border)] rounded-full h-2" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Mission progress">
          <div
            className="bg-[var(--color-blue)] h-2 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-[var(--color-muted)] text-right">
          {t('mission.progress', locale, { progress: String(mission.progress), target: String(mission.target) })}
        </p>
      </div>
    </div>
  );
}
