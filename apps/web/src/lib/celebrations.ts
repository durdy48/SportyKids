'use client';

import confetti from 'canvas-confetti';

/**
 * Check if the user prefers reduced motion.
 * All celebration functions respect this preference.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Confetti burst when a sticker is earned */
export function celebrateSticker() {
  if (prefersReducedMotion()) return;
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#2563EB', '#22C55E', '#FACC15', '#F59E0B'],
  });
}

/** Two-sided burst when an achievement is unlocked */
export function celebrateAchievement() {
  if (prefersReducedMotion()) return;
  confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
  confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
}

/** Fiery confetti for streak milestones (7, 14, 30+ days) */
export function celebrateStreak(days: number) {
  if (prefersReducedMotion()) return;
  if (days >= 30) {
    confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#FF6B00', '#FFD700', '#FF4500'] });
  } else if (days >= 7) {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#FF6B00', '#FACC15'] });
  }
}

/** Sustained star burst for a perfect quiz score */
export function celebratePerfectQuiz() {
  if (prefersReducedMotion()) return;
  const duration = 1500;
  const end = Date.now() + duration;
  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FACC15', '#22C55E'] });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FACC15', '#22C55E'] });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
