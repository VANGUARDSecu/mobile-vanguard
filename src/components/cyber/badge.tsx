import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';

export type BadgeVariant = 'cyan' | 'green' | 'indigo' | 'amber' | 'red' | 'muted';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: string | React.ReactNode;
  pill?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export function Badge({
  label,
  variant = 'cyan',
  size = 'sm',
  icon,
  pill = true,
  style,
  textStyle,
  testID,
}: BadgeProps) {
  const getContainerStyle = (): StyleProp<ViewStyle> => {
    const list: ViewStyle[] = [styles.base];

    if (pill) {
      list.push(styles.pill);
    } else {
      list.push(styles.rounded);
    }

    if (size === 'md') {
      list.push(styles.sizeMd);
    } else {
      list.push(styles.sizeSm);
    }

    switch (variant) {
      case 'green':
        list.push(styles.variantGreen);
        break;
      case 'indigo':
        list.push(styles.variantIndigo);
        break;
      case 'amber':
        list.push(styles.variantAmber);
        break;
      case 'red':
        list.push(styles.variantRed);
        break;
      case 'muted':
        list.push(styles.variantMuted);
        break;
      case 'cyan':
      default:
        list.push(styles.variantCyan);
        break;
    }

    return [list, style];
  };

  const getTextStyle = (): StyleProp<TextStyle> => {
    const list: TextStyle[] = [styles.text];

    if (size === 'md') {
      list.push(styles.textMd);
    } else {
      list.push(styles.textSm);
    }

    switch (variant) {
      case 'green':
        list.push(styles.textGreen);
        break;
      case 'indigo':
        list.push(styles.textIndigo);
        break;
      case 'amber':
        list.push(styles.textAmber);
        break;
      case 'red':
        list.push(styles.textRed);
        break;
      case 'muted':
        list.push(styles.textMuted);
        break;
      case 'cyan':
      default:
        list.push(styles.textCyan);
        break;
    }

    return [list, textStyle];
  };

  return (
    <View style={getContainerStyle()} testID={testID}>
      {typeof icon === 'string' ? (
        <Text style={styles.iconText}>{icon}</Text>
      ) : (
        icon
      )}
      <Text style={getTextStyle()}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    gap: 4,
  },
  pill: {
    borderRadius: CyberRadius.full,
  },
  rounded: {
    borderRadius: CyberRadius.xs,
  },
  sizeSm: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  sizeMd: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
  },
  iconText: {
    fontSize: 10,
  },

  // Variants
  variantCyan: {
    backgroundColor: CyberColors.cyanGlow,
    borderColor: 'rgba(0, 229, 255, 0.45)',
  },
  variantGreen: {
    backgroundColor: CyberColors.greenGlow,
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  variantIndigo: {
    backgroundColor: CyberColors.indigoGlow,
    borderColor: 'rgba(99, 102, 241, 0.45)',
  },
  variantAmber: {
    backgroundColor: CyberColors.amberGlow,
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  variantRed: {
    backgroundColor: CyberColors.redGlow,
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  variantMuted: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    borderColor: 'rgba(100, 116, 139, 0.4)',
  },

  // Text
  text: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textSm: {
    fontSize: 9.5,
  },
  textMd: {
    fontSize: 11.5,
  },
  textCyan: {
    color: CyberColors.cyan,
  },
  textGreen: {
    color: CyberColors.green,
  },
  textIndigo: {
    color: '#818cf8',
  },
  textAmber: {
    color: CyberColors.amber,
  },
  textRed: {
    color: CyberColors.red,
  },
  textMuted: {
    color: CyberColors.textSecondary,
  },
});
