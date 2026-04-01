import { useEffect, useRef } from 'react';
import { Animated, type ViewStyle, type StyleProp, AccessibilityInfo } from 'react-native';
import { t } from '@sportykids/shared';

interface ShimmerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Shimmer({ children, style }: ShimmerProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  const isReducedMotion = useRef(false);

  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      isReducedMotion.current = enabled;
      if (enabled) {
        opacity.setValue(0.6);
        return;
      }

      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      );
      animRef.current = animation;
      animation.start();
    });

    return () => { animRef.current?.stop(); };
  }, [opacity]);

  return (
    <Animated.View style={[{ opacity }, style]} accessibilityLabel={t('a11y.common.loading', 'en')}>
      {children}
    </Animated.View>
  );
}
