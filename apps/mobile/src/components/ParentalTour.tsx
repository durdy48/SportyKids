import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, t, type Locale } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';

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
  locale: Locale;
  onComplete?: () => void;
  colors?: ThemeColors;
}

export function ParentalTour({ locale, onComplete, colors }: ParentalTourProps) {
  const styles = createStyles(colors);
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TOUR_STORAGE_KEY).then((done) => {
      if (!done) setVisible(true);
    });
  }, []);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDone();
    }
  };

  const handleDone = () => {
    AsyncStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setVisible(false);
    onComplete?.();
  };

  if (!visible) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.dots}>
            {TOUR_STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i <= currentStep ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>

          <Text style={styles.title}>{t(step.titleKey, locale)}</Text>
          <Text style={styles.message}>{t(step.messageKey, locale)}</Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              onPress={handleDone}
              accessible={true}
              accessibilityLabel={t('a11y.onboarding.skip', locale)}
              accessibilityRole="button"
            >
              <Text style={styles.skipText}>{t('tour.skip', locale)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              accessible={true}
              accessibilityLabel={currentStep < TOUR_STEPS.length - 1 ? t('a11y.common.next', locale) : t('a11y.common.close', locale)}
              accessibilityRole="button"
            >
              <Text style={styles.nextText}>
                {currentStep < TOUR_STEPS.length - 1
                  ? t('tour.next', locale)
                  : t('tour.done', locale)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors?: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: colors?.surface ?? '#FFFFFF',
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 340,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 4,
      marginBottom: 16,
    },
    dot: {
      height: 6,
      width: 32,
      borderRadius: 3,
    },
    dotActive: {
      backgroundColor: colors?.blue ?? COLORS.blue,
    },
    dotInactive: {
      backgroundColor: colors?.border ?? '#E5E7EB',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      color: colors?.text ?? '#1E293B',
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      textAlign: 'center',
      color: colors?.muted ?? '#6B7280',
      marginBottom: 24,
      lineHeight: 20,
    },
    buttons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    skipText: {
      fontSize: 14,
      color: colors?.muted ?? '#6B7280',
    },
    nextButton: {
      backgroundColor: colors?.blue ?? COLORS.blue,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 12,
    },
    nextText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
    },
  });
}
