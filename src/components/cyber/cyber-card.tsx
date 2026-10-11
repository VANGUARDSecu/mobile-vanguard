import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { CyberColors, CyberRadius, CyberGlass, CyberShadows } from '@/constants/cyber-theme';

export type CyberCardVariant = 'glass' | 'default' | 'glow' | 'accent' | 'danger';

export interface CyberCardProps {
  children?: React.ReactNode;
  variant?: CyberCardVariant;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  onPress?: () => void;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function CyberCard({
  children,
  variant = 'glass',
  header,
  footer,
  onPress,
  interactive,
  style,
  testID,
}: CyberCardProps) {
  const isClickable = interactive ?? Boolean(onPress);

  const getCardStyle = (): StyleProp<ViewStyle> => {
    const list: ViewStyle[] = [styles.base];

    switch (variant) {
      case 'default':
        list.push(styles.variantDefault);
        break;
      case 'glow':
        list.push(styles.variantGlow);
        break;
      case 'accent':
        list.push(styles.variantAccent);
        break;
      case 'danger':
        list.push(styles.variantDanger);
        break;
      case 'glass':
      default:
        list.push(styles.variantGlass);
        break;
    }

    if (isClickable) {
      list.push(styles.interactive);
    }

    return [list, style];
  };

  const content = (
    <>
      {header ? <View style={styles.headerContainer}>{header}</View> : null}
      <View style={styles.bodyContainer}>{children}</View>
      {footer ? <View style={styles.footerContainer}>{footer}</View> : null}
    </>
  );

  if (isClickable) {
    return (
      <TouchableOpacity
        style={getCardStyle()}
        onPress={onPress}
        activeOpacity={0.8}
        testID={testID}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={getCardStyle()} testID={testID}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: CyberRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
  },
  variantGlass: {
    ...CyberGlass.card,
  },
  variantDefault: {
    backgroundColor: CyberColors.cardBg,
    borderColor: CyberColors.border,
  },
  variantGlow: {
    backgroundColor: CyberColors.cardBgSecondary,
    borderColor: CyberColors.cyan,
    ...CyberShadows.cyanGlow,
  },
  variantAccent: {
    backgroundColor: CyberColors.cardBgSecondary,
    borderColor: CyberColors.indigo,
    ...CyberShadows.indigoGlow,
  },
  variantDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  interactive: {
    cursor: 'pointer' as any,
  },
  headerContainer: {
    marginBottom: 12,
  },
  bodyContainer: {
    width: '100%',
  },
  footerContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.6)',
  },
});
