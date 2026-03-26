'use client';

import { useState, useEffect } from 'react';
import type { Locale } from '@sportykids/shared';
import { t } from '@sportykids/shared';
import { fetchTodayMission, claimMission } from '@/lib/api';

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
  const [claiming, setClaiming] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetchTodayMission(userId)
      .then((data) => {
        if (data && data.mission) {
          setMission(data.mission);
        }
      })
      .catch(() => {
        // No mission available
      });
  }, [userId]);

  // Auto-collapse after claim
  useEffect(() => {
    if (mission?.claimed) {
      const timer = setTimeout(() => setCollapsed(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [mission?.claimed]);

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
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3 transition-all">
        <span className="text-2xl">&#9989;</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-700">
            {t('mission.completed', locale)}
          </p>
        </div>
      </div>
    );
  }

  // Completed unclaimed: yellow pulsing card
  if (mission.completed && !mission.claimed) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-5 space-y-3 transition-all">
        <div className="flex items-center gap-3">
          <span className="text-2xl">&#127942;</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-[var(--color-text)]">{mission.title}</p>
            <p className="text-xs text-[var(--color-muted)]">{mission.description}</p>
          </div>
        </div>
        {/* Full progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-yellow-400 h-2 rounded-full w-full" />
        </div>
        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full py-3 rounded-xl text-sm font-bold bg-yellow-400 text-yellow-900 hover:bg-yellow-500 transition-colors animate-pulse disabled:opacity-60"
        >
          {claiming ? t('buttons.loading', locale) : t('mission.claim', locale)}
        </button>
      </div>
    );
  }

  // Uncompleted: blue card with progress
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3 transition-all">
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
          <span className="text-xs font-bold text-[var(--color-yellow)] bg-yellow-100 px-2 py-1 rounded-full whitespace-nowrap">
            +{mission.reward.amount} {mission.reward.label ?? 'pts'}
          </span>
        )}
      </div>
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="w-full bg-gray-200 rounded-full h-2">
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
