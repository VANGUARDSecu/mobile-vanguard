import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import type { AuthUser } from '@/models/auth.models';
import type { OAuthAuthorizeDeepLinkParams } from '@/utils/oauth-deeplink';
import { CyberButton } from './cyber-button';
import { CyberCard } from './cyber-card';

export interface SsoConsentModalProps {
  visible: boolean;
  request: OAuthAuthorizeDeepLinkParams | null;
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onApprove: () => void;
  onDeny: () => void;
  onSignInFirst: () => void;
  onOpenWebPortal: () => void;
}

export function SsoConsentModal({
  visible,
  request,
  currentUser,
  isAuthenticated,
  isSubmitting = false,
  errorMessage = null,
  onApprove,
  onDeny,
  onSignInFirst,
  onOpenWebPortal,
}: SsoConsentModalProps) {
  if (!visible || !request) {
    return null;
  }

  const displayAppName = request.client_name || request.client_id;
  const requestedScopes = request.scope
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDeny}
    >
      <SafeAreaView style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <CyberCard variant="glow" style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>VANGUARD OIDC HANDOFF</Text>
              <Text style={styles.title}>Authorize {displayAppName}</Text>
              <Text style={styles.subtitle}>
                An installed application is requesting your Vanguard Single Sign-On identity.
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>APPLICATION</Text>
              <Text style={styles.infoValue}>{displayAppName}</Text>

              <Text style={[styles.infoLabel, styles.spacingTop]}>CLIENT ID</Text>
              <Text style={styles.monoValue}>{request.client_id}</Text>

              <Text style={[styles.infoLabel, styles.spacingTop]}>CALLBACK URI</Text>
              <Text style={styles.monoValue}>{request.redirect_uri}</Text>

              <Text style={[styles.infoLabel, styles.spacingTop]}>REQUESTED SCOPES</Text>
              <View style={styles.scopeRow}>
                {requestedScopes.map((scope) => (
                  <View key={scope} style={styles.scopeChip}>
                    <Text style={styles.scopeText}>{scope}</Text>
                  </View>
                ))}
              </View>
            </View>

            {isAuthenticated && currentUser ? (
              <View style={styles.identityBox}>
                <Text style={styles.identityLabel}>SIGNED IN IDENTITY</Text>
                <Text style={styles.identityName}>{currentUser.name || currentUser.email}</Text>
                <Text style={styles.identityEmail}>{currentUser.email}</Text>
                <Text style={styles.identityRole}>
                  Role: {String(currentUser.role || 'user').toUpperCase()}
                </Text>
              </View>
            ) : (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>Authentication Required</Text>
                <Text style={styles.warningText}>
                  Sign in to Vanguard Mobile first to approve this request natively, or continue in the Vanguard Web Portal (vanguard-security.pages.dev).
                </Text>
              </View>
            )}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              {isAuthenticated ? (
                <CyberButton
                  title="Approve & Sign In"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  onPress={onApprove}
                  testID="sso-consent-approve-btn"
                />
              ) : (
                <CyberButton
                  title="Sign In on Mobile First"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={onSignInFirst}
                  testID="sso-consent-signin-first-btn"
                />
              )}

              <CyberButton
                title="Continue in Browser Portal"
                variant="secondary"
                size="md"
                fullWidth
                disabled={isSubmitting}
                onPress={onOpenWebPortal}
                testID="sso-consent-web-btn"
              />

              <CyberButton
                title="Deny Request"
                variant="danger"
                size="md"
                fullWidth
                disabled={isSubmitting}
                onPress={onDeny}
                testID="sso-consent-deny-btn"
              />
            </View>
          </CyberCard>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: CyberColors.modalBackdrop,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    padding: 20,
    gap: 16,
  },
  header: {
    gap: 6,
  },
  eyebrow: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: CyberColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: CyberColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  infoBox: {
    backgroundColor: CyberColors.cardBgSecondary,
    borderColor: CyberColors.border,
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 14,
  },
  infoLabel: {
    color: CyberColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  infoValue: {
    color: CyberColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  monoValue: {
    color: CyberColors.cyanLight,
    fontSize: 12,
    marginTop: 2,
  },
  spacingTop: {
    marginTop: 10,
  },
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  scopeChip: {
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyanMuted,
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scopeText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
  identityBox: {
    backgroundColor: CyberColors.greenGlow,
    borderColor: CyberColors.borderGreen,
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
    gap: 2,
  },
  identityLabel: {
    color: CyberColors.green,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  identityName: {
    color: CyberColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  identityEmail: {
    color: CyberColors.textSecondary,
    fontSize: 12,
  },
  identityRole: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  warningBox: {
    backgroundColor: CyberColors.amberGlow,
    borderColor: CyberColors.borderAmber,
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
    gap: 4,
  },
  warningTitle: {
    color: CyberColors.amber,
    fontSize: 12,
    fontWeight: '800',
  },
  warningText: {
    color: CyberColors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: CyberColors.redGlow,
    borderColor: CyberColors.borderDanger,
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
  },
  errorText: {
    color: CyberColors.red,
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    gap: 10,
  },
});
