import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import {
  CyberButton,
  CyberCard,
  Badge,
  ModalHeader,
} from '@/components/cyber';
import { VaultSecuritySettings } from '@/models/vault.models';
import vaultService from '@/services/vault.service';
import biometricService, { BiometricType } from '@/services/biometric-auth.service';

export interface SecuritySettingsScreenProps {
  onClose: () => void;
  onResetVault?: () => void;
  onOpenPushHarness?: () => void;
  testID?: string;
}

export function SecuritySettingsScreen({
  onClose,
  onResetVault,
  onOpenPushHarness,
  testID = 'security-settings-screen',
}: SecuritySettingsScreenProps) {
  const [settings, setSettings] = useState<VaultSecuritySettings>({
    biometricsEnabled: true,
    autoLockSeconds: 300,
    clearClipboardSeconds: 30,
    exportEncryption: 'AES-256-GCM',
    zeroTrustAttestation: true,
  });
  const [biometricInfo, setBiometricInfo] = useState<{
    hasHardware: boolean;
    isEnrolled: boolean;
    biometricType: BiometricType;
  }>({ hasHardware: true, isEnrolled: true, biometricType: 'FaceID' });
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const data = await vaultService.getSettings();
      setSettings(data);
    };
    fetchSettings();
    biometricService.checkAvailability().then(setBiometricInfo);
  }, []);

  const handleToggleBiometrics = async (value: boolean) => {
    const enabled = await biometricService.setBiometricsRequiredOnLaunch(value);
    setSettings((prev) => ({ ...prev, biometricsEnabled: enabled }));
  };

  const handleSetAutoLock = async (seconds: number) => {
    const updated = await vaultService.updateSettings({ autoLockSeconds: seconds });
    setSettings(updated);
  };

  const handleSetClipboardTimeout = async (seconds: number) => {
    const updated = await vaultService.updateSettings({
      clearClipboardSeconds: seconds,
    });
    setSettings(updated);
  };

  const handleExportBackup = async () => {
    try {
      const backupJson = await vaultService.exportVault();
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(backupJson);
      } else {
        await Clipboard.setStringAsync(backupJson);
      }
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2500);
      Alert.alert(
        'Vault Backup Exported',
        'Encrypted JSON vault backup copied to clipboard successfully!'
      );
    } catch {
      Alert.alert('Export Failed', 'Could not export vault tokens');
    }
  };

  const handleWipeVault = async () => {
    if (!confirmWipe) {
      setConfirmWipe(true);
      return;
    }

    try {
      await vaultService.resetVault();
      Alert.alert('Vault Reset', 'Vault has been reset to baseline enterprise defaults.');
      if (onResetVault) {
        onResetVault();
      } else {
        onClose();
      }
    } catch {
      Alert.alert('Error', 'Failed to reset vault');
    }
  };

  return (
    <View style={styles.screen} testID={testID}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <ModalHeader
            title="Vault Security Settings"
            subtitle="Zero-Trust policy, biometric locks, and local hygiene"
            icon="⚙️"
            onClose={onClose}
            testID="security-settings-header"
          />

          {/* Zero-Trust Device Attestation Banner */}
          <CyberCard variant="glow" style={styles.bannerCard}>
            <View style={styles.bannerHeader}>
              <Text style={styles.bannerIcon}>🛡️</Text>
              <View style={styles.bannerTextCol}>
                <Text style={styles.bannerTitle}>DEVICE HARDWARE ENCLAVE</Text>
                <Text style={styles.bannerSubtitle}>
                  Zero-Trust Hardware Attestation Verified
                </Text>
              </View>
              <Badge label="ENFORCED" variant="green" size="sm" />
            </View>
            <View style={styles.bannerDetails}>
              <Text style={styles.bannerDetailText}>
                • Cryptographic storage: AES-256 local encrypted sandbox
              </Text>
              <Text style={styles.bannerDetailText}>
                • Air-gapped: Zero third-party telemetry or cloud key leakage
              </Text>
            </View>
          </CyberCard>

          {/* Biometrics Protection */}
          <CyberCard variant="glass" style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>BIOMETRIC AUTHENTICATION</Text>
              <Badge
                label={biometricInfo.biometricType.toUpperCase()}
                variant={biometricInfo.hasHardware ? 'green' : 'amber'}
                size="sm"
                testID="settings-biometric-badge"
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>
                  Require {biometricInfo.biometricType === 'FaceID' ? 'Face ID' : biometricInfo.biometricType === 'Fingerprint' ? 'Fingerprint' : 'Biometrics'} on Launch
                </Text>
                <Text style={styles.settingDesc}>
                  Prompt for biometric authentication before unlocking secrets
                </Text>
              </View>
              <Switch
                value={settings.biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{
                  false: '#1e293b',
                  true: 'rgba(0, 229, 255, 0.4)',
                }}
                thumbColor={
                  settings.biometricsEnabled ? CyberColors.cyan : '#64748b'
                }
                testID="switch-biometrics"
              />
            </View>
          </CyberCard>

          {/* Auto-Lock Timeout */}
          <CyberCard variant="glass" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>AUTO-LOCK INACTIVITY TIMEOUT</Text>
            <Text style={styles.settingDesc}>
              Automatically lock vault when the application goes to background
            </Text>
            <View style={styles.optionRow}>
              {[
                { label: 'Instant', value: 0 },
                { label: '1 min', value: 60 },
                { label: '5 min', value: 300 },
                { label: '15 min', value: 900 },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionPill,
                    settings.autoLockSeconds === opt.value &&
                      styles.optionPillActive,
                  ]}
                  onPress={() => handleSetAutoLock(opt.value)}
                  testID={`autolock-${opt.value}`}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      settings.autoLockSeconds === opt.value &&
                        styles.optionPillTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </CyberCard>

          {/* Clipboard Sanitization */}
          <CyberCard variant="glass" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>CLIPBOARD AUTO-CLEAR TIMEOUT</Text>
            <Text style={styles.settingDesc}>
              Erase copied TOTP codes from device clipboard after expiration
            </Text>
            <View style={styles.optionRow}>
              {[
                { label: '15s', value: 15 },
                { label: '30s', value: 30 },
                { label: '60s', value: 60 },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionPill,
                    settings.clearClipboardSeconds === opt.value &&
                      styles.optionPillActive,
                  ]}
                  onPress={() => handleSetClipboardTimeout(opt.value)}
                  testID={`clipboard-${opt.value}`}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      settings.clearClipboardSeconds === opt.value &&
                        styles.optionPillTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </CyberCard>

          {/* Push MFA Sandbox (SCRUM-21) */}
          <CyberCard variant="glass" style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>PUSH MFA VERIFICATION SANDBOX</Text>
              <Badge label="LOCAL HARNESS" variant="cyan" size="sm" />
            </View>
            <Text style={styles.settingDesc}>
              Test out-of-band push authorization prompts, contextual metadata cards, number matching, and biometric approvals offline.
            </Text>
            <CyberButton
              title="Open Push Sandbox 🚀"
              variant="outline"
              size="md"
              onPress={onOpenPushHarness}
              style={styles.exportBtn}
              testID="open-push-sandbox-btn"
            />
          </CyberCard>

          {/* Vault Backup Export */}
          <CyberCard variant="glass" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>BACKUP & RESTORE</Text>
            <Text style={styles.settingDesc}>
              Export an encrypted snapshot of all enrolled TOTP credentials
            </Text>
            <CyberButton
              title={
                copiedBackup ? 'Backup Copied! ✓' : 'Export Vault Backup (JSON) 💾'
              }
              variant="outline"
              size="md"
              onPress={handleExportBackup}
              style={styles.exportBtn}
              testID="export-backup-btn"
            />
          </CyberCard>

          {/* Danger Zone: Emergency Wipe */}
          <CyberCard
            variant={confirmWipe ? 'danger' : 'glass'}
            style={styles.dangerCard}
          >
            <Text style={styles.dangerTitle}>
              {confirmWipe ? '⚠️ CONFIRM FACTORY WIPE' : 'EMERGENCY VAULT WIPE'}
            </Text>
            <Text style={styles.dangerDesc}>
              {confirmWipe
                ? 'Warning: This will purge all user tokens and restore the baseline corporate seed accounts.'
                : 'Reset vault contents and security configurations to initial factory state.'}
            </Text>

            <View style={styles.dangerActions}>
              {confirmWipe ? (
                <CyberButton
                  title="Cancel"
                  variant="ghost"
                  size="sm"
                  onPress={() => setConfirmWipe(false)}
                />
              ) : null}

              <CyberButton
                title={confirmWipe ? 'Confirm Wipe Vault 🔥' : 'Wipe Vault 🔥'}
                variant="danger"
                size="sm"
                onPress={handleWipeVault}
                testID="wipe-vault-button"
              />
            </View>
          </CyberCard>
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
  bannerCard: {
    padding: 16,
    marginBottom: 16,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  bannerIcon: {
    fontSize: 20,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bannerSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  bannerDetails: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.8)',
    gap: 4,
  },
  bannerDetailText: {
    color: CyberColors.textMuted,
    fontSize: 11,
  },
  sectionCard: {
    padding: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: CyberColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingTextCol: {
    flex: 1,
  },
  settingLabel: {
    color: CyberColors.textPrimary,
    fontSize: 13.5,
    fontWeight: '700',
  },
  settingDesc: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: CyberRadius.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
  },
  optionPillActive: {
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyan,
  },
  optionPillText: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  optionPillTextActive: {
    color: CyberColors.cyan,
    fontWeight: '800',
  },
  exportBtn: {
    marginTop: 4,
  },
  dangerCard: {
    padding: 16,
    marginBottom: 24,
  },
  dangerTitle: {
    color: CyberColors.red,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  dangerDesc: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12,
  },
  dangerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
