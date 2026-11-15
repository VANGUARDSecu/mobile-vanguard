import { useMemo } from 'react';
import { Platform, useWindowDimensions, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  computeResponsiveMetrics,
  ResponsiveLayoutMetrics,
} from '@/utils/responsive-layout';

/**
 * Live responsive viewport & safe-area metrics hook.
 * Re-computes automatically on orientation change, foldable resize, font scale, or navigation bar changes.
 */
export function useResponsiveLayout(): ResponsiveLayoutMetrics & {
  topInset: number;
  bottomInset: number;
  centeredContainerStyle: ViewStyle;
} {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const metrics = computeResponsiveMetrics({
      width,
      height,
      fontScale,
      topInset: insets.top,
      bottomInset: insets.bottom,
      platformOS: Platform.OS,
    });

    const centeredContainerStyle: ViewStyle = metrics.contentMaxWidth
      ? {
          width: '100%',
          maxWidth: metrics.contentMaxWidth,
          alignSelf: 'center',
        }
      : { width: '100%' };

    return {
      ...metrics,
      topInset: insets.top,
      bottomInset: insets.bottom,
      centeredContainerStyle,
    };
  }, [width, height, fontScale, insets.top, insets.bottom]);
}
