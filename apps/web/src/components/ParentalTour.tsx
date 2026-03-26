'use client';

import { useState, useEffect } from 'react';
import { t } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';

const TOUR_STORAGE_KEY = 'sportykids_parental_tour_done';

interface TourStep {
  titleKey: string;
  messageKey: string;
}

const TOUR_STEPS: TourStep[] = [
  { titleKey: 'tour.step1_title', messageKey: 'tour.step1_message' },
  { titleKey: 'tour.step2_title', messageKey: 'tour.step2_message' },
  { titleKey: 'tour.step3_title', messageKey: 'tour.step3_message' },
];

interface ParentalTourProps {
  onComplete?: () => void;
}

export function ParentalTour({ onComplete }: ParentalTourProps) {
  const { locale } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!done) {
      setVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDone();
    }
  };

  const handleDone = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setVisible(false);
    onComplete?.();
  };

  if (!visible) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-md w-full shadow-xl">
        <div className="flex gap-1 mb-4 justify-center">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= currentStep ? 'bg-[var(--color-blue)]' : 'bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>

        <h3 className="font-[family-name:var(--font-poppins)] text-xl font-bold text-[var(--color-text)] mb-2 text-center">
          {t(step.titleKey, locale)}
        </h3>
        <p className="text-[var(--color-muted)] text-center mb-6">
          {t(step.messageKey, locale)}
        </p>

        <div className="flex justify-between">
          <button
            onClick={handleDone}
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            {t('tour.skip', locale)}
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-[var(--color-blue)] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {currentStep < TOUR_STEPS.length - 1 ? t('tour.next', locale) : t('tour.done', locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
