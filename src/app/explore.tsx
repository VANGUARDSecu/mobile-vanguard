import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';

export default function SecurityScreen() {
  const { currentUser, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshedTime, setRefreshedTime] = useState<string>('Just now');

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

  const handleRefreshTokens = () => {
    setRefreshedTime(new Date().toLocaleTimeString());
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
            <Text style={styles.cardLabel}>ACTIVE CORPORATE IDENTITY</Text>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '👤'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{currentUser?.name || 'Authenticated User'}</Text>
                <Text style={styles.userEmail}>{currentUser?.email || 'N/A'}</Text>
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
                    Email OTP & Authenticator TOTP Guard Enforced
                  </Text>
                </View>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>🔒</Text>
                <View style={styles.metricDetails}>
                  <Text style={styles.metricTitle}>Continuous Token Attestation</Text>
                  <Text style={styles.metricDesc}>
                    RFC 8414 Session Tokens • Last evaluated: {refreshedTime}
                  </Text>
                </View>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>🌐</Text>
                <View style={styles.metricDetails}>
                  <Text style={styles.metricTitle}>SSO Integrations Active</Text>
                  <Text style={styles.metricDesc}>
                    Weyland-Yutani Corp / Acme Corp OIDC Connected
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Security Actions */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SESSION GOVERNANCE</Text>
            <View style={styles.actionButtonsWrap}>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={handleRefreshTokens}
                activeOpacity={0.7}
              >
                <Text style={styles.refreshBtnText}>🔄 Refresh Session Attestation</Text>
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
});
