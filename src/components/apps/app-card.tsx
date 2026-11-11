import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { SaaSApp, PersonalVaultItem } from '@/models/apps.models';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';

interface AppCardProps {
  app: SaaSApp;
  isPersonalWorkspace?: boolean;
  matchingVaultCredentials?: PersonalVaultItem[];
  onLaunch?: (app: SaaSApp) => void;
  onDelete?: (id: string) => void;
  style?: ViewStyle;
}

export function AppCard({
  app,
  isPersonalWorkspace = false,
  matchingVaultCredentials = [],
  onLaunch,
  onDelete,
  style,
}: AppCardProps) {
  const isAutoFillReady = Boolean(app.assignedUsername) || (matchingVaultCredentials.length > 0);
  const isCurrentlyConnected = app.isIntegrated || app.connectionStatus === 'Currently Connected';
  const linkedAccount = app.assignedUsername || matchingVaultCredentials[0]?.username || matchingVaultCredentials[0]?.title;

  return (
    <View style={[styles.card, style]}>
      {/* Top Section: App Icon & Badges */}
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>{app.icon || '🌐'}</Text>
        </View>

        <View style={styles.badgeWrap}>
          {app.inheritedViaGroup && (
            <View style={styles.groupBadge}>
              <Text style={styles.groupBadgeText}>👥 {app.inheritedViaGroup}</Text>
            </View>
          )}

          {app.status === 'Approved' && (
            <View style={styles.approvedBadge}>
              <Text style={styles.approvedBadgeText}>✓ Approved</Text>
            </View>
          )}

          {isAutoFillReady && (
            <View style={styles.autofillBadge}>
              <Text style={styles.autofillBadgeText}>⚡ Auto-fill Ready</Text>
            </View>
          )}

          {isCurrentlyConnected && (
            <View style={styles.connectedBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.connectedBadgeText}>Currently Connected</Text>
            </View>
          )}

          <View style={styles.protocolBadge}>
            <Text style={styles.protocolBadgeText}>{app.protocol || 'SAML 2.0'}</Text>
          </View>

          {onDelete && (
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
              onPress={() => onDelete(app.id)}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              accessibilityRole="button"
              accessibilityLabel={`Remove shortcut for ${app.name}`}
            >
              <Text style={styles.deleteBtnText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Main Content: Title & Description */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {app.name}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {app.description}
        </Text>
      </View>

      {/* Linked Vault Credential Preview */}
      {linkedAccount ? (
        <View style={styles.vaultMetaRow}>
          <Text style={styles.vaultMetaText} numberOfLines={1}>
            🔑 Account: {linkedAccount}
          </Text>
        </View>
      ) : null}

      {/* Launch Action Button */}
      <Pressable
        style={({ pressed }) => [styles.launchBtn, pressed && styles.launchBtnPressed]}
        onPress={() => onLaunch?.(app)}
        accessibilityRole="button"
        accessibilityLabel={`Launch ${app.name}`}
      >
        <Text style={styles.launchBtnText}>Launch & Auto-fill</Text>
        <Text style={styles.launchBtnIcon}>↗</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CyberColors.cardBg,
    borderColor: CyberColors.border,
    borderWidth: 1,
    borderRadius: CyberRadius.lg,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: CyberRadius.md,
    backgroundColor: CyberColors.cardBgSecondary,
    borderWidth: 1,
    borderColor: CyberColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconText: {
    fontSize: 24,
  },
  badgeWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    alignItems: 'center',
  },
  groupBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: CyberColors.indigo,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: CyberRadius.full,
  },
  groupBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a5b4fc',
  },
  approvedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: CyberRadius.full,
  },
  approvedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34d399',
  },
  autofillBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: CyberColors.green,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: CyberRadius.full,
  },
  autofillBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34d399',
  },
  connectedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: CyberRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CyberColors.green,
  },
  connectedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: CyberColors.green,
  },
  protocolBadge: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderColor: CyberColors.border,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: CyberRadius.full,
  },
  protocolBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: CyberColors.textSecondary,
    letterSpacing: 0.5,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  deleteBtnText: {
    color: CyberColors.red,
    fontSize: 11,
    fontWeight: 'bold',
  },
  body: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: CyberColors.textPrimary,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: CyberColors.textSecondary,
  },
  vaultMetaRow: {
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderColor: 'rgba(0, 229, 255, 0.2)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  vaultMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: CyberColors.cyan,
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyan,
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  launchBtnPressed: {
    opacity: 0.75,
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
  },
  launchBtnText: {
    color: CyberColors.cyan,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  launchBtnIcon: {
    color: CyberColors.cyan,
    fontSize: 15,
    fontWeight: '700',
  },
});
