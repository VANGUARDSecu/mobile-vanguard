import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { CyberButton, CyberCard, Badge } from '@/components/cyber';
import type { BiometricType } from '@/services/biometric-auth.service';

export interface VaultLockScreenProps {
  onUnlock: () => void;
  onPasscodeFallback?: () => void;
  biometricType?: BiometricType;
  isAuthenticating?: boolean;
  errorMessage?: string | null;
  testID?: string;
}

export function VaultLockScreen({
  onUnlock,
  onPasscodeFallback,
  biometricType = 'FaceID',
  isAuthenticating = false,
  errorMessage = null,
  testID = 'vault-lock-screen',
}: VaultLockScreenProps) {
  const getBiometricLabel = () => {
    switch (biometricType) {
      case 'FaceID':
        return 'Unlock with Face ID';
      case 'Fingerprint':
        return 'Unlock with Fingerprint';
      case 'Iris':
        return 'Unlock with Iris Recognition';
      default:
        return 'Unlock with Biometrics';
    }
  };

  const getBiometricIcon = () => {
    switch (biometricType) {
      case 'FaceID':
        return '👤';
      case 'Fingerprint':
        return '👆';
      case 'Iris':
        return '👁️';
      default:
        return '🔒';
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Glowing Shield Emblem */}
          <View style={styles.emblemWrapper}>
            <View style={styles.emblemOuterGlow}>
              <View style={styles.emblemCircle}>
                <Text style={styles.emblemIcon}>🛡️</Text>
              </View>
            </View>
          </View>

          {/* Zero-Trust Badge */}
          <Badge
            label="ZERO-TRUST HARDWARE LOCK"
            variant="cyan"
            size="md"
            testID={`${testID}-badge`}
          />

          <Text style={styles.title}>VANGUARD VAULT LOCKED</Text>
          <Text style={styles.subtitle}>
            Biometric identity verification is required to inspect sensitive 2FA authenticator tokens and security keys.
          </Text>

          {errorMessage && (
            <CyberCard variant="danger" style={styles.errorCard}>
              <Text style={styles.errorText} testID={`${testID}-error`}>
                ⚠️ {errorMessage}
              </Text>
            </CyberCard>
          )}

          {/* Action Triggers */}
          <View style={styles.actionsBox}>
            <CyberButton
              title={
                isAuthenticating
                  ? 'Verifying Biometrics...'
                  : `${getBiometricIcon()} ${getBiometricLabel()}`
              }
              variant="primary"
              size="lg"
              onPress={onUnlock}
              loading={isAuthenticating}
              style={styles.primaryButton}
              testID="vault-unlock-button"
            />

            {onPasscodeFallback && (
              <CyberButton
                title="🔢 Use Device Passcode"
                variant="outline"
                size="md"
                onPress={onPasscodeFallback}
                disabled={isAuthenticating}
                style={styles.fallbackButton}
                testID="vault-passcode-fallback-button"
              />
            )}
          </View>

          {/* Hygiene Footer */}
          <View style={styles.footerNote}>
            <Text style={styles.footerText}>
              Screen obscuration active • Hardware enclave attestation enforced
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: CyberColors.background,
    zIndex: 99999,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emblemWrapper: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemOuterGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  emblemCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: CyberColors.cardBg,
    borderWidth: 1.5,
    borderColor: CyberColors.cyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emblemIcon: {
    fontSize: 34,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: CyberColors.textPrimary,
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: CyberColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 22,
    paddingHorizontal: 12,
  },
  errorCard: {
    width: '100%',
    marginBottom: 16,
    padding: 12,
  },
  errorText: {
    color: CyberColors.red,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionsBox: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    width: '100%',
  },
  fallbackButton: {
    width: '100%',
  },
  footerNote: {
    marginTop: 12,
  },
  footerText: {
    fontSize: 11,
    color: CyberColors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

export default VaultLockScreen;
