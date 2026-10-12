import React, { useEffect, useState, useMemo } from 'react';
import { View, Animated, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { CyberColors } from '@/constants/cyber-theme';

export interface PulseDotProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function PulseDot({
  size = 8,
  color = CyberColors.green,
  style,
}: PulseDotProps) {
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [anim]);

  const scale = useMemo(
    () =>
      anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.85, 1.3],
      }),
    [anim]
  );

  const opacity = useMemo(
    () =>
      anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.65, 1],
      }),
    [anim]
  );

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Animated.View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [{ scale }],
            opacity,
            shadowColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
});
