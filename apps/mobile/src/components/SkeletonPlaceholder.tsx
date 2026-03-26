import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { Shimmer } from './Shimmer';

interface SkeletonPlaceholderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A generic skeleton placeholder block — use for quick ad-hoc loading states.
 */
export function SkeletonPlaceholder({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonPlaceholderProps) {
  return (
    <Shimmer>
      <View
        style={[
          styles.block,
          { width: width as number, height: height as number, borderRadius },
          style,
        ]}
      />
    </Shimmer>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#e2e8f0',
  },
});
