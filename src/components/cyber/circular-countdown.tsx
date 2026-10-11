import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { CyberColors } from '@/constants/cyber-theme';
import { TotpEngine } from '@/services/totp-engine.service';

export interface CircularCountdownProps {
  remainingSeconds: number;
  period?: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
  textSize?: number;
  testID?: string;
}

export function CircularCountdown({
  remainingSeconds,
  period = 30,
  size = 46,
  strokeWidth = 3.5,
  showText = true,
  textSize = 12,
  testID = 'circular-countdown',
}: CircularCountdownProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, remainingSeconds / period));
  const strokeDashoffset = circumference * (1 - progress);
  const color = TotpEngine.getWarningColor(remainingSeconds);

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: period, now: remainingSeconds }}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background Track Ring */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated Countdown Ring */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </G>
      </Svg>

      {showText && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.textWrap}>
            <Text
              style={[
                styles.numberText,
                {
                  fontSize: textSize,
                  color,
                },
              ]}
              testID={`${testID}-text`}
            >
              {remainingSeconds}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
});

export default CircularCountdown;
