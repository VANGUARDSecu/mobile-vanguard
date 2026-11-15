import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { useOptionalApps } from '@/context/apps-context';
import { useOptionalBilling } from '@/context/billing-context';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { AuthService } from '@/services/auth.service';
import pushMfaService from '@/services/push-mfa.service';
import { SecurityActivityService } from '@/services/security-activity.service';

export default function SecurityScreen() {
  const { currentUser, logout } = useAuth();
  const appsCtx = useOptionalApps();
  const billing = useOptionalBilling();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedTime, setRefreshedTime] = useState<string>('Just now');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'LOGIN' | 'APP_LAUNCH' | 'LOGOUT' | 'SECURITY'>('ALL');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const posture = appsCtx?.securityPosture ?? null;
  const auditEvents = appsCtx?.auditEvents ?? [];
  const adminSnapshot = appsCtx?.adminSnapshot ?? null;
  const isCompanyAdmin = Boolean(appsCtx?.isCompanyAdmin);

  const filteredAudit = auditEvents.filter((evt) => {
    if (activityFilter === 'ALL') return true;
    const type = (evt.movementType || evt.action || '').toUpperCase();
    const st = (evt.status || '').toUpperCase();
    if (activityFilter === 'LOGIN') return type.includes('LOGIN') || st === 'SUCCESS';
    if (activityFilter === 'LOGOUT') return type.includes('LOGOUT') || st === 'LOGOUT';
    if (activityFilter === 'APP_LAUNCH') return type.includes('APP_LAUNCH');
    return type.includes('SECURITY') || type.includes('MFA') || type.includes('REVOKE');
  });

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // Non-blocking
    } finally {
      setLoggingOut(false);
    }
  };

  const handleRefreshTokens = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        appsCtx?.refreshSecurityData?.() ?? Promise.resolve(),
        billing?.refreshSubscription?.() ?? Promise.resolve(),
      ]);
      setRefreshedTime(new Date().toLocaleTimeString());
    } finally {
      setRefreshing(false);
    }
  };

  const handleTogglePushMfa = async () => {
    if (!currentUser?.email) return;
    setBusyAction('push');
    try {
      const next = !(posture?.pushMfaEnabled ?? true);
      await pushMfaService.syncPreference(currentUser.email, next);
      await appsCtx?.refreshSecurityData?.();
      setStatusNotice(`Push MFA ${next ? 'enabled' : 'disabled'} & synced across devices.`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleAlertThreshold = async () => {
    setBusyAction('prefs');
    try {
      const token = currentUser?.accessToken || (await AuthService.getAccessToken());
      if (!token) return;
      const nextThreshold = posture?.alertThreshold === 'new_device' ? 'all' : 'new_device';
      const ok = await SecurityActivityService.updateSecurityPreferences(token, {
        alertThreshold: nextThreshold,
      });
      if (ok) {
        await appsCtx?.refreshSecurityData?.();
        setStatusNotice(
          `Alert policy updated to ${nextThreshold === 'new_device' ? 'New Devices Only' : 'All Sign-Ins'}.`,
        );
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleRegenerateRecoveryCodes = async () => {
    setBusyAction('recovery');
    try {
      const token = currentUser?.accessToken || (await AuthService.getAccessToken());
      if (!token) return;
      const codes = await SecurityActivityService.regenerateRecoveryCodes(token);
      if (codes && codes.length > 0) {
        setGeneratedCodes(codes);
        await appsCtx?.refreshSecurityData?.();
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleRevokeAllSessions = () => {
    const execRevoke = async () => {
      setBusyAction('revoke');
      try {
        const token = currentUser?.accessToken || (await AuthService.getAccessToken());
        if (!token) return;
        const ok = await SecurityActivityService.revokeAllSessions(token);
        if (ok) {
          setStatusNotice('All secondary web/extension/device sessions revoked.');
          await appsCtx?.refreshSecurityData?.();
        }
      } finally {
        setBusyAction(null);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Sign out of all other Vanguard web, extension, and device sessions?')) {
        void execRevoke();
      }
    } else {
      Alert.alert(
        'Revoke All Active Sessions',
        'Terminate all other signed-in Vanguard sessions across browsers and devices?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Revoke Sessions', style: 'destructive', onPress: () => void execRevoke() },
        ],
      );
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefreshTokens()}
              tintColor={CyberColors.cyan}
              colors={[CyberColors.cyan]}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandShield}>🛡️</Text>
              <Text style={styles.brandTitle}>VANGUARD SECURITY</Text>
            </View>
            <Text style={styles.pageTitle}>Zero-Trust Identity Posture</Text>
            <Text style={styles.pageSubtitle}>
              Continuous verification, session tokens, and identity authorization status
            </Text>
          </View>

          {/* User Session Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>
              {currentUser?.accountType === 'individual'
                ? 'ACTIVE PERSONAL IDENTITY'
                : 'ACTIVE CORPORATE IDENTITY'}
            </Text>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '👤'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>{currentUser?.name || 'Authenticated User'}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{currentUser?.email || 'N/A'}</Text>
              </View>
              <View style={styles.activeBadge}>
                <View style={styles.greenDot} />
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            </View>
          </View>

          {/* Zero-Trust Pillars */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>ZERO-TRUST VERIFICATION METRICS</Text>
            <View style={styles.metricsList}>
              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>🟢</Text>
                <View style={styles.metricDetails}>
                  <Text style={styles.metricTitle}>Device Health & Integrity</Text>
                  <Text style={styles.metricDesc}>
                    Platform {Platform.OS.toUpperCase()} • Zero-Trust Policy Verified
                  </Text>
                </View>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>🛡️</Text>
                <View style={styles.metricDetails}>
                  <Text style={styles.metricTitle}>Multi-Factor Authentication (MFA)</Text>
                  <Text style={styles.metricDesc}>
                    {posture?.totpEnrolled
                      ? `Authenticator TOTP Verified (${posture.totpFactorsCount} factor)`
                      : 'Email OTP Guard Active • Enroll TOTP for stronger posture'}
                  </Text>
                </View>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>🔒</Text>
                <View style={styles.metricDetails}>
                  <Text style={styles.metricTitle}>Continuous Token Attestation</Text>
                  <Text style={styles.metricDesc}>
                    {appsCtx?.enrolledDevices?.length ?? posture?.enrolledDevicesCount ?? 0} Paired Device(s) • Evaluated: {posture?.evaluatedAt || refreshedTime}
                  </Text>
                </View>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>🌐</Text>
                <View style={styles.metricDetails}>
                  <Text style={styles.metricTitle}>SSO Integrations Active</Text>
                  <Text style={styles.metricDesc}>
                    {appsCtx?.activeConnectedApps?.length ?? 0} Connected App(s) •{' '}
                    {currentUser?.companyName
                      ? `${currentUser.companyName} OIDC`
                      : 'Zero-Trust OIDC'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {statusNotice ? (
            <View style={styles.noticeBanner}>
              <Text style={styles.noticeText}>✓ {statusNotice}</Text>
            </View>
          ) : null}

          {/* Synchronized Security Controls & Recovery (mirrors frontend user-security) */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SECURITY CONTROLS &amp; RECOVERY</Text>
            <View style={styles.metricsList}>
              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>📲</Text>
                <View style={styles.metricDetails}>
                  <Text style={styles.metricTitle}>Out-of-Band Push MFA</Text>
                  <Text style={styles.metricDesc}>
                    {(posture?.pushMfaEnabled ?? true) ? 'Enabled for SSO logins' : 'Disabled'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.inlineChipBtn}
                  onPress={() => void handleTogglePushMfa()}
                  disabled={busyAction === 'push'}
                >
                  <Text style={styles.inlineChipText}>
                    {busyAction === 'push'
                      ? '...'
                      : (posture?.pushMfaEnabled ?? true)
                        ? 'Disable'
                        : 'Enable'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>🗝️</Text>
                <View style={styles.metricDetails}>
                  <Text style={styles.metricTitle}>Emergency Recovery Codes</Text>
                  <Text style={styles.metricDesc}>
                    {posture?.recoveryCodesRemaining ?? 0} single-use code(s) remaining
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.inlineChipBtn}
                  onPress={() => void handleRegenerateRecoveryCodes()}
                  disabled={busyAction === 'recovery'}
                >
                  <Text style={styles.inlineChipText}>
                    {busyAction === 'recovery' ? '...' : 'Regenerate'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>🔔</Text>
                <View style={styles.metricDetails}>
                  <Text style={styles.metricTitle}>Security Alert Threshold</Text>
                  <Text style={styles.metricDesc}>
                    {posture?.alertThreshold === 'new_device'
                      ? 'Notify on Unrecognized Devices Only'
                      : 'Notify on All Sign-Ins'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.inlineChipBtn}
                  onPress={() => void handleToggleAlertThreshold()}
                  disabled={busyAction === 'prefs'}
                >
                  <Text style={styles.inlineChipText}>
                    {busyAction === 'prefs' ? '...' : 'Switch'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Sign-In & Account Movement Audit Logs (mirrors frontend user-activity) */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.cardLabel, { marginBottom: 0 }]}>
                SIGN-IN &amp; MOVEMENT AUDIT ({filteredAudit.length})
              </Text>
              <Text style={{ color: CyberColors.cyan, fontSize: 10.5, fontWeight: '700' }}>
                {billing?.auditRetentionDays ?? 7}d Retention
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['ALL', 'LOGIN', 'APP_LAUNCH', 'LOGOUT', 'SECURITY'] as const).map((pill) => (
                  <TouchableOpacity
                    key={pill}
                    style={[
                      styles.filterPill,
                      activityFilter === pill && styles.filterPillActive,
                    ]}
                    onPress={() => setActivityFilter(pill)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        activityFilter === pill && styles.filterPillTextActive,
                      ]}
                    >
                      {pill === 'APP_LAUNCH' ? 'APPS' : pill}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {filteredAudit.length === 0 ? (
              <Text style={styles.metricDesc}>
                No synchronized audit movements matched this filter yet.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {filteredAudit.slice(0, 10).map((evt) => (
                  <View key={evt.id} style={styles.auditRow}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.metricTitle} numberOfLines={1}>
                        {evt.action}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color:
                            evt.status === 'FAILED'
                              ? '#f87171'
                              : evt.status === 'CHALLENGE'
                                ? '#fbbf24'
                                : CyberColors.green,
                        }}
                      >
                        {evt.status}
                      </Text>
                    </View>
                    <Text style={styles.metricDesc}>
                      {[evt.applicationName, evt.protocol, evt.device || evt.ip]
                        .filter(Boolean)
                        .join(' • ') || evt.email}
                    </Text>
                    <Text style={[styles.metricDesc, { marginTop: 2, fontSize: 10 }]}>
                      {new Date(evt.timestamp).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Company Admin Overview (mirrors Directory, Policy, and Tenant Catalog on Web) */}
          {isCompanyAdmin && adminSnapshot ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>COMPANY ADMIN OVERVIEW</Text>
              <View style={styles.metricsList}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricIcon}>👥</Text>
                  <View style={styles.metricDetails}>
                    <Text style={styles.metricTitle}>
                      Directory Members ({adminSnapshot.users.length})
                    </Text>
                    <Text style={styles.metricDesc}>
                      {adminSnapshot.users
                        .slice(0, 3)
                        .map((u) => `${u.name} (${u.status})`)
                        .join(', ') || 'No directory users yet'}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricIcon}>⚙️</Text>
                  <View style={styles.metricDetails}>
                    <Text style={styles.metricTitle}>Organization Policy &amp; Domain</Text>
                    <Text style={styles.metricDesc}>
                      MFA: {adminSnapshot.tenantSettings?.mfaEnforced ? 'Enforced' : 'Optional'} •{' '}
                      High-Risk IPs: {adminSnapshot.tenantSettings?.blockHighRiskIps ? 'Blocked' : 'Alert'} •{' '}
                      {adminSnapshot.tenantSettings?.domain || 'Default Vanguard Domain'}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricIcon}>🏢</Text>
                  <View style={styles.metricDetails}>
                    <Text style={styles.metricTitle}>
                      Enterprise App Catalog ({adminSnapshot.tenantApps.length})
                    </Text>
                    <Text style={styles.metricDesc}>
                      {adminSnapshot.tenantApps
                        .slice(0, 4)
                        .map((a) => a.name)
                        .join(', ') || 'No tenant apps provisioned yet'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {/* SCRUM-185: Synced Subscription & Plan Entitlements */}
          {billing ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>SUBSCRIPTION &amp; PLAN ENTITLEMENTS</Text>
              <View style={styles.metricsList}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricIcon}>{billing.isFreeTier ? '🔒' : '💎'}</Text>
                  <View style={styles.metricDetails}>
                    <Text style={styles.metricTitle}>
                      {billing.subscription.planName} ({billing.subscription.roleLabel})
                    </Text>
                    <Text style={styles.metricDesc}>
                      Apps: {billing.maxIntegratedApps === -1 ? 'Unlimited' : '1 Max (Free)'} • 2FA: {billing.maxTotpAccounts === -1 ? 'Unlimited' : '3 Tokens Max (Free)'} • {billing.auditRetentionDays}d Audit
                    </Text>
                    <Text style={[styles.metricDesc, { marginTop: 2, color: CyberColors.cyan }]}>
                      {billing.isTenantMember
                        ? billing.isFreeTier
                          ? 'Managed by Company Admin — limits unlock automatically when Admin upgrades'
                          : 'Organization Paid Tier active & synchronized across Web & Mobile'
                        : 'Synchronized in real time between Vanguard Web & Mobile'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={() => billing.openBillingModal()}
                  activeOpacity={0.75}
                >
                  <Text style={styles.refreshBtnText}>
                    {billing.isTenantMember
                      ? '🏢 View Organization Plan & Sync Status'
                      : billing.isFreeTier
                        ? '⚡ Upgrade Plan via PayMongo Sandbox'
                        : '⚙️ Manage Subscription & Sync Plan'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Security Actions */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SESSION GOVERNANCE</Text>
            <View style={styles.actionButtonsWrap}>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={() => void handleRefreshTokens()}
                activeOpacity={0.7}
              >
                <Text style={styles.refreshBtnText}>🔄 Refresh &amp; Sync Security Data</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.revokeBtn}
                onPress={handleRevokeAllSessions}
                disabled={busyAction === 'revoke'}
                activeOpacity={0.7}
              >
                <Text style={styles.revokeBtnText}>
                  {busyAction === 'revoke' ? 'Revoking Sessions...' : '🚫 Revoke All Other Active Sessions'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.signOutBtn, loggingOut && styles.signOutBtnDisabled]}
                onPress={handleLogout}
                disabled={loggingOut}
                activeOpacity={0.7}
              >
                {loggingOut ? (
                  <ActivityIndicator size="small" color="#f87171" />
                ) : (
                  <Text style={styles.signOutBtnText}>Sign Out & Terminate Session ⎋</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <Modal
          visible={Boolean(generatedCodes)}
          transparent
          animationType="fade"
          onRequestClose={() => setGeneratedCodes(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.metricTitle}>🗝️ New Emergency Recovery Codes</Text>
              <Text style={[styles.metricDesc, { marginBottom: 10 }]}>
                Store these single-use backup codes safely. Previous codes were invalidated.
              </Text>
              <View style={{ gap: 6, marginBottom: 14 }}>
                {(generatedCodes || []).map((c) => (
                  <Text key={c} style={styles.recoveryCodeLine}>
                    {c}
                  </Text>
                ))}
              </View>
              <TouchableOpacity style={styles.refreshBtn} onPress={() => setGeneratedCodes(null)}>
                <Text style={styles.refreshBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CyberColors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
  },
  header: {
    marginBottom: 20,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  brandShield: {
    fontSize: 18,
  },
  brandTitle: {
    color: CyberColors.cyan,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: CyberColors.textSecondary,
  },
  card: {
    backgroundColor: CyberColors.cardBg,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 16,
    marginBottom: 16,
  },
  cardLabel: {
    color: CyberColors.textMuted,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyan,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: CyberColors.cyan,
    fontSize: 18,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  userName: {
    color: CyberColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  userEmail: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CyberColors.greenGlow,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: CyberRadius.full,
    gap: 5,
    flexShrink: 0,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CyberColors.green,
  },
  activeBadgeText: {
    color: CyberColors.green,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricsList: {
    gap: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    padding: 12,
    borderRadius: CyberRadius.sm,
    gap: 12,
  },
  metricIcon: {
    fontSize: 18,
  },
  metricDetails: {
    flex: 1,
  },
  metricTitle: {
    color: CyberColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  metricDesc: {
    color: CyberColors.textMuted,
    fontSize: 11,
  },
  actionButtonsWrap: {
    gap: 10,
  },
  refreshBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
  refreshBtnText: {
    color: CyberColors.cyan,
    fontSize: 13,
    fontWeight: '700',
  },
  signOutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
  signOutBtnDisabled: {
    opacity: 0.6,
  },
  signOutBtnText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
  },
  noticeBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 16,
  },
  noticeText: {
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: CyberRadius.xs,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.4)',
    borderWidth: 1,
  },
  inlineChipText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '800',
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: CyberRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
  },
  filterPillActive: {
    borderColor: CyberColors.cyan,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
  },
  filterPillText: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: CyberColors.cyan,
  },
  auditRow: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    padding: 10,
  },
  revokeBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.42)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
  revokeBtnText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: CyberColors.cardBg,
    borderColor: CyberColors.borderHighlight,
    borderWidth: 1,
    borderRadius: CyberRadius.lg,
    padding: 18,
  },
  recoveryCodeLine: {
    color: CyberColors.cyan,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13.5,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: CyberRadius.xs,
  },
});
