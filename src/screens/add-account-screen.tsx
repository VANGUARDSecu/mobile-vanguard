import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
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
import { TotpAccount, TotpAlgorithm } from '@/models/vault.models';
import vaultService from '@/services/vault.service';
import { TotpEngine } from '@/services/totp-engine.service';
import { OtpAuthParser } from '@/services/otpauth-parser.service';

export interface AddAccountScreenProps {
  onClose: () => void;
  onSaved?: (account: TotpAccount) => void;
  testID?: string;
}

const ICON_PRESETS = ['🛡️', '☁️', '🐙', '⚡', '🔷', '🔒', '🌐', '🚀'];

export function AddAccountScreen({
  onClose,
  onSaved,
  testID = 'add-account-screen',
}: AddAccountScreenProps) {
  const [mode, setMode] = useState<'manual' | 'qr'>('manual');
  const [accountName, setAccountName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [secret, setSecret] = useState('');
  const [algorithm, setAlgorithm] = useState<TotpAlgorithm>('SHA1');
  const [digits, setDigits] = useState<number>(6);
  const [period, setPeriod] = useState<number>(30);
  const [selectedIcon, setSelectedIcon] = useState('🛡️');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  const handlePasteKey = async () => {
    try {
      let clipText = '';
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        clipText = await navigator.clipboard.readText();
      } else {
        clipText = await Clipboard.getStringAsync();
      }

      if (!clipText || !clipText.trim()) {
        setValidationError('Clipboard is empty. Copy a Base32 secret key or otpauth:// URI first.');
        return;
      }

      // SCRUM-166: Auto-parse otpauth:// URI when pasted from clipboard
      if (clipText.trim().toLowerCase().startsWith('otpauth://')) {
        handleQrDecoded(clipText.trim());
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
        return;
      }

      const cleaned = TotpEngine.cleanSecret(clipText);
      setSecret(cleaned);
      setPasteSuccess(true);
      setTimeout(() => setPasteSuccess(false), 2000);

      const check = vaultService.validateSecret(cleaned);
      if (!check.valid) {
        setValidationError(check.error || 'Invalid Base32 secret key');
      } else {
        setValidationError(null);
      }
    } catch {
      setValidationError('Unable to read clipboard. Please paste manually.');
    }
  };

  const handleSecretChange = (text: string) => {
    if (text.trim().toLowerCase().startsWith('otpauth://')) {
      handleQrDecoded(text.trim());
      return;
    }
    setSecret(text);
    if (validationError) setValidationError(null);
  };

  const handleSave = async () => {
    if (!accountName.trim()) {
      setValidationError('Account Name is required (e.g. user@domain.com)');
      return;
    }
    if (!secret.trim()) {
      setValidationError('Secret Key is required');
      return;
    }

    const check = vaultService.validateSecret(secret);
    if (!check.valid) {
      setValidationError(check.error || 'Invalid Base32 secret key');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      const created = await vaultService.addAccount({
        name: accountName.trim(),
        issuer: issuer.trim() || 'Authenticator',
        secret: secret.trim(),
        algorithm,
        digits,
        period,
        icon: selectedIcon,
      });

      if (onSaved) {
        onSaved(created);
      } else {
        onClose();
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Failed to save account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQrDecoded = (uri: string) => {
    try {
      setValidationError(null);
      const parsed = OtpAuthParser.parse(uri);
      setAccountName(parsed.accountName);
      setIssuer(parsed.issuer);
      setSecret(parsed.secret);
      setAlgorithm(parsed.algorithm);
      setDigits(parsed.digits);
      setPeriod(parsed.period);
      setMode('manual');
      Alert.alert(
        'QR Code Decoded',
        `Successfully extracted credentials for ${parsed.issuer} (${parsed.accountName}).`
      );
    } catch (err: any) {
      setValidationError(err?.message || 'Invalid QR code otpauth payload.');
    }
  };

  const handleSimulatedQrScan = (rawUri?: string) => {
    // Real standard otpauth:// decoding using OtpAuthParser
    const uriToDecode =
      typeof rawUri === 'string' && rawUri.trim()
        ? rawUri.trim()
        : 'otpauth://totp/Vanguard%20Security:admin%40vanguard.security?secret=JBSWY3DPEHPK3PXP&issuer=Vanguard%20Security&algorithm=SHA1&digits=6&period=30';
    handleQrDecoded(uriToDecode);
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
            title="Add Authenticator Token"
            subtitle="Enroll a new two-factor TOTP identity credential"
            icon="➕"
            onClose={onClose}
            testID="add-account-header"
          />

          {/* Mode Switcher */}
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                mode === 'manual' && styles.tabButtonActive,
              ]}
              onPress={() => setMode('manual')}
              activeOpacity={0.8}
              testID="tab-manual-entry"
            >
              <Text
                style={[
                  styles.tabButtonText,
                  mode === 'manual' && styles.tabButtonTextActive,
                ]}
              >
                ⌨️ Manual Entry
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                mode === 'qr' && styles.tabButtonActive,
              ]}
              onPress={() => setMode('qr')}
              activeOpacity={0.8}
              testID="tab-scan-qr"
            >
              <Text
                style={[
                  styles.tabButtonText,
                  mode === 'qr' && styles.tabButtonTextActive,
                ]}
              >
                📷 Scan QR Code
              </Text>
            </TouchableOpacity>
          </View>

          {/* Validation Error Banner */}
          {validationError ? (
            <CyberCard variant="danger" style={styles.errorCard}>
              <Text style={styles.errorText} testID="add-account-error">
                ⚠️ {validationError}
              </Text>
            </CyberCard>
          ) : null}

          {mode === 'qr' ? (
            /* QR Scanner Simulator View */
            <CyberCard variant="glass" style={styles.qrCard}>
              <View style={styles.viewfinderBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <Text style={styles.viewfinderIcon}>📷</Text>
                <Text style={styles.viewfinderText}>
                  Align QR Code within the viewfinder frame
                </Text>
              </View>

              <CyberButton
                title="Simulate Camera QR Scan ⚡"
                variant="primary"
                size="md"
                onPress={handleSimulatedQrScan}
                style={styles.simulateBtn}
                testID="simulate-qr-button"
              />
            </CyberCard>
          ) : (
            /* Manual Form */
            <CyberCard variant="glass" style={styles.formCard}>
              {/* Account Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ACCOUNT IDENTIFIER *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. user@company.com or username"
                  placeholderTextColor={CyberColors.textMuted}
                  value={accountName}
                  onChangeText={(val) => {
                    setAccountName(val);
                    if (validationError) setValidationError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="input-account-name"
                />
              </View>

              {/* Issuer */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ISSUER / SERVICE NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. GitHub, AWS, GitLab, Vanguard"
                  placeholderTextColor={CyberColors.textMuted}
                  value={issuer}
                  onChangeText={setIssuer}
                  autoCapitalize="words"
                  autoCorrect={false}
                  testID="input-issuer"
                />
              </View>

              {/* Secret Key */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>BASE32 SECRET KEY *</Text>
                  <View style={styles.labelActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.pasteKeyBtn,
                        pasteSuccess && styles.pasteKeyBtnSuccess,
                      ]}
                      onPress={handlePasteKey}
                      activeOpacity={0.7}
                      testID="paste-secret-key-button"
                    >
                      <Text style={styles.pasteKeyBtnText}>
                        {pasteSuccess ? 'PASTED! ✓' : '📋 Paste Key'}
                      </Text>
                    </TouchableOpacity>
                    <Badge label="A-Z, 2-7" variant="indigo" size="sm" />
                  </View>
                </View>
                <TextInput
                  style={[styles.input, styles.secretInput]}
                  placeholder="e.g. JBSWY3DPEHPK3PXP"
                  placeholderTextColor={CyberColors.textMuted}
                  value={secret}
                  onChangeText={handleSecretChange}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  testID="input-secret-key"
                />
                <Text style={styles.inputHint}>
                  Spaces are automatically ignored. Standard RFC 4648 Base32 alphabet.
                </Text>
              </View>

              {/* Icon Picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>SELECT ICON</Text>
                <View style={styles.iconPickerRow}>
                  {ICON_PRESETS.map((ic) => (
                    <TouchableOpacity
                      key={ic}
                      style={[
                        styles.iconOption,
                        selectedIcon === ic && styles.iconOptionSelected,
                      ]}
                      onPress={() => setSelectedIcon(ic)}
                    >
                      <Text style={styles.iconOptionText}>{ic}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Advanced Parameters: Algorithm & Digits */}
              <View style={styles.advancedRow}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>ALGORITHM</Text>
                  <View style={styles.chipRow}>
                    {(['SHA1', 'SHA256'] as TotpAlgorithm[]).map((algo) => (
                      <TouchableOpacity
                        key={algo}
                        style={[
                          styles.chip,
                          algorithm === algo && styles.chipActive,
                        ]}
                        onPress={() => setAlgorithm(algo)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            algorithm === algo && styles.chipTextActive,
                          ]}
                        >
                          {algo}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>DIGITS</Text>
                  <View style={styles.chipRow}>
                    {[6, 8].map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.chip, digits === d && styles.chipActive]}
                        onPress={() => setDigits(d)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            digits === d && styles.chipTextActive,
                          ]}
                        >
                          {d} Digits
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Submit Buttons */}
              <View style={styles.submitActions}>
                <CyberButton
                  title="Cancel"
                  variant="ghost"
                  size="md"
                  onPress={onClose}
                />
                <CyberButton
                  title="Save Authenticator Token ✓"
                  variant="primary"
                  size="md"
                  loading={isSubmitting}
                  onPress={handleSave}
                  testID="submit-add-account"
                />
              </View>
            </CyberCard>
          )}
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
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: CyberColors.cardBg,
    borderColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: CyberRadius.sm,
  },
  tabButtonActive: {
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyan,
    borderWidth: 1,
  },
  tabButtonText: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: CyberColors.cyan,
    fontWeight: '800',
  },
  errorCard: {
    marginBottom: 16,
    padding: 12,
  },
  errorText: {
    color: CyberColors.red,
    fontSize: 12,
    fontWeight: '700',
  },
  formCard: {
    padding: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    color: CyberColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(10, 14, 23, 0.7)',
    borderColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: CyberColors.textPrimary,
    fontSize: 13,
  },
  secretInput: {
    letterSpacing: 1.5,
    color: CyberColors.cyan,
  },
  inputHint: {
    color: CyberColors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  iconPickerRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: CyberRadius.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: {
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyan,
  },
  iconOptionText: {
    fontSize: 18,
  },
  advancedRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  halfField: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: CyberRadius.xs,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyan,
  },
  chipText: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  chipTextActive: {
    color: CyberColors.cyan,
    fontWeight: '800',
  },
  submitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  qrCard: {
    alignItems: 'center',
    padding: 24,
  },
  viewfinderBox: {
    width: 200,
    height: 200,
    backgroundColor: 'rgba(10, 14, 23, 0.8)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 20,
    padding: 16,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: CyberColors.cyan,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  viewfinderIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  viewfinderText: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  simulateBtn: {
    marginTop: 8,
  },
  labelActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pasteKeyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: CyberRadius.sm,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: CyberColors.cyan,
  },
  pasteKeyBtnSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: CyberColors.green,
  },
  pasteKeyBtnText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
});
