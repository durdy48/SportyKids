/**
 * Type augmentation to fix FlatList/SectionList props missing from RN 0.81 types
 * when used with React 19.2.x. The VirtualizedList and ScrollView props
 * (contentContainerStyle, refreshControl, showsHorizontalScrollIndicator, etc.)
 * are not properly inherited in the type definitions.
 *
 * This augmentation adds the missing props to FlatListProps and SectionListProps.
 * Safe to remove once @types/react or react-native types fix the issue upstream.
 */
import type { StyleProp, ViewStyle } from 'react-native';
import type { ReactElement } from 'react';

declare module 'react-native' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface FlatListProps<ItemT> {
    contentContainerStyle?: StyleProp<ViewStyle>;
    refreshControl?: ReactElement;
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null;
    onEndReachedThreshold?: number | null;
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    removeClippedSubviews?: boolean;
    maxToRenderPerBatch?: number;
    windowSize?: number;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SectionListProps<ItemT, SectionT> {
    contentContainerStyle?: StyleProp<ViewStyle>;
    stickySectionHeadersEnabled?: boolean;
  }
}
