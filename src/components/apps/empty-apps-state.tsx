import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';

interface EmptyAppsStateProps {
  isPersonalWorkspace?: boolean;
  onActionPress?: () => void;
  style?: ViewStyle;
}

export function EmptyAppsState({
  isPersonalWorkspace = false,
  onActionPress,
  style,
}: EmptyAppsStateProps) {
  const title = isPersonalWorkspace
    ? 'No personal applications saved'
    : 'No applications assigned';

  const description = isPersonalWorkspace
    ? 'Add your favorite web applications (Figma, Facebook, GitHub, AWS, etc.) for dynamic autofill via the Vanguard browser extension.'
    : 'You do not have any single sign-on applications assigned to your account. You can request access using the button below.';

  const actionLabel = isPersonalWorkspace ? '+ Add Application' : '+ Request Application';

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>📦</Text>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {onActionPress && (
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: CyberColors.cardBg,
    borderColor: CyberColors.border,
    borderWidth: 1,
    borderRadius: CyberRadius.lg,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: CyberColors.cardBgSecondary,
    borderWidth: 1,
    borderColor: CyberColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: CyberColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: CyberColors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: CyberColors.cyan,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: CyberRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionBtnText: {
    color: CyberColors.textDark,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
