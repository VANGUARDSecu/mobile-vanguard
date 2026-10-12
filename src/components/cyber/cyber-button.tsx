import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from 'react-native';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';

export type CyberButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'ghost'
  | 'outline';

export type CyberButtonSize = 'sm' | 'md' | 'lg';

export interface CyberButtonProps {
  title: string;
  variant?: CyberButtonVariant;
  size?: CyberButtonSize;
  icon?: string | React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export function CyberButton({
  title,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  onPress,
  style,
  textStyle,
  testID,
}: CyberButtonProps) {
  const isInteractive = !disabled && !loading;

  const getContainerStyle = (): StyleProp<ViewStyle> => {
    const base: ViewStyle[] = [styles.base];

    if (fullWidth) base.push(styles.fullWidth);

    // Size
    switch (size) {
      case 'sm':
        base.push(styles.sizeSm);
        break;
      case 'lg':
        base.push(styles.sizeLg);
        break;
      case 'md':
      default:
        base.push(styles.sizeMd);
        break;
    }

    // Variant
    switch (variant) {
      case 'secondary':
        base.push(styles.variantSecondary);
        break;
      case 'success':
        base.push(styles.variantSuccess);
        break;
      case 'danger':
        base.push(styles.variantDanger);
        break;
      case 'ghost':
        base.push(styles.variantGhost);
        break;
      case 'outline':
        base.push(styles.variantOutline);
        break;
      case 'primary':
      default:
        base.push(styles.variantPrimary);
        break;
    }

    if (disabled) base.push(styles.disabled);

    return [base, style];
  };

  const getLabelStyle = (): StyleProp<TextStyle> => {
    const base: TextStyle[] = [styles.label];

    switch (size) {
      case 'sm':
        base.push(styles.labelSm);
        break;
      case 'lg':
        base.push(styles.labelLg);
        break;
      case 'md':
      default:
        base.push(styles.labelMd);
        break;
    }

    switch (variant) {
      case 'primary':
        base.push(styles.labelPrimary);
        break;
      case 'secondary':
        base.push(styles.labelSecondary);
        break;
      case 'success':
        base.push(styles.labelSuccess);
        break;
      case 'danger':
        base.push(styles.labelDanger);
        break;
      case 'ghost':
        base.push(styles.labelGhost);
        break;
      case 'outline':
        base.push(styles.labelOutline);
        break;
    }

    if (disabled) base.push(styles.labelDisabled);

    return [base, textStyle];
  };

  const getIndicatorColor = () => {
    switch (variant) {
      case 'primary':
        return CyberColors.textDark;
      case 'success':
        return CyberColors.textDark;
      case 'danger':
        return CyberColors.red;
      case 'secondary':
        return CyberColors.indigo;
      default:
        return CyberColors.cyan;
    }
  };

  return (
    <TouchableOpacity
      style={getContainerStyle()}
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      activeOpacity={0.8}
      testID={testID}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={getIndicatorColor()} />
      ) : (
        <View style={styles.contentRow}>
          {typeof icon === 'string' ? (
            <Text style={styles.iconText}>{icon}</Text>
          ) : (
            icon
          )}
          <Text style={getLabelStyle()}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CyberRadius.md,
    borderWidth: 1,
    cursor: 'pointer' as any,
  },
  fullWidth: {
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconText: {
    fontSize: 14,
  },

  // Sizes
  sizeSm: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: CyberRadius.sm,
  },
  sizeMd: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: CyberRadius.md,
  },
  sizeLg: {
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: CyberRadius.lg,
  },

  // Variants
  variantPrimary: {
    backgroundColor: CyberColors.cyan,
    borderColor: CyberColors.cyan,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  variantSecondary: {
    backgroundColor: CyberColors.indigoGlow,
    borderColor: CyberColors.indigo,
  },
  variantSuccess: {
    backgroundColor: CyberColors.green,
    borderColor: CyberColors.green,
    shadowColor: CyberColors.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  variantDanger: {
    backgroundColor: CyberColors.redGlow,
    borderColor: CyberColors.red,
  },
  variantGhost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  variantOutline: {
    backgroundColor: 'transparent',
    borderColor: CyberColors.cyan,
  },

  // Disabled
  disabled: {
    opacity: 0.45,
    cursor: 'not-allowed' as any,
  },

  // Labels
  label: {
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  labelSm: {
    fontSize: 12,
  },
  labelMd: {
    fontSize: 14,
  },
  labelLg: {
    fontSize: 16,
  },

  labelPrimary: {
    color: CyberColors.textDark,
  },
  labelSecondary: {
    color: '#a5b4fc',
  },
  labelSuccess: {
    color: CyberColors.textDark,
  },
  labelDanger: {
    color: CyberColors.red,
  },
  labelGhost: {
    color: CyberColors.cyan,
  },
  labelOutline: {
    color: CyberColors.cyan,
  },
  labelDisabled: {
    color: CyberColors.textMuted,
  },
});
