import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { Badge, BadgeVariant } from './badge';

export interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string | React.ReactNode;
  badgeText?: string;
  badgeVariant?: BadgeVariant;
  onClose?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ModalHeader({
  title,
  subtitle,
  icon,
  badgeText,
  badgeVariant = 'cyan',
  onClose,
  actionLabel,
  onAction,
  style,
  testID,
}: ModalHeaderProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.leftCol}>
        <View style={styles.titleRow}>
          {typeof icon === 'string' ? (
            <Text style={styles.iconText}>{icon}</Text>
          ) : (
            icon
          )}
          <Text style={styles.titleText}>{title}</Text>
          {badgeText ? (
            <Badge label={badgeText} variant={badgeVariant} size="sm" />
          ) : null}
        </View>
        {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
      </View>

      <View style={styles.rightActions}>
        {actionLabel && onAction ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onAction}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}

        {onClose ? (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID={testID ? `${testID}-close` : 'modal-header-close'}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.7)',
    marginBottom: 16,
  },
  leftCol: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  iconText: {
    fontSize: 18,
  },
  titleText: {
    color: CyberColors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitleText: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: CyberRadius.sm,
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyan,
    borderWidth: 1,
  },
  actionButtonText: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
  closeText: {
    color: CyberColors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
});
