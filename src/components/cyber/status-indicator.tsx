import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { CyberColors } from '@/constants/cyber-theme';

export type StatusType =
  | 'active'
  | 'synced'
  | 'pending'
  | 'offline'
  | 'error'
  | 'warning';

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function StatusIndicator({
  status = 'active',
  label,
  pulse = false,
  size = 'md',
  style,
  testID,
}: StatusIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse, pulseAnim]);

  const getColor = (): string => {
    switch (status) {
      case 'active':
        return CyberColors.green;
      case 'synced':
        return CyberColors.cyan;
      case 'pending':
      case 'warning':
        return CyberColors.amber;
      case 'error':
        return CyberColors.red;
      case 'offline':
      default:
        return CyberColors.textMuted;
    }
  };

  const getDotSize = (): number => {
    switch (size) {
      case 'sm':
        return 6;
      case 'lg':
        return 12;
      case 'md':
      default:
        return 8;
    }
  };

  const dotSize = getDotSize();
  const color = getColor();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Animated.View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            shadowColor: color,
            shadowOpacity: pulse ? 0.8 : 0.4,
            shadowRadius: pulse ? 6 : 3,
            opacity: pulse ? pulseAnim : 1,
          },
        ]}
      />
      {label ? (
        <Text style={[styles.label, { color }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
