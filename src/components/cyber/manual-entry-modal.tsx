import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { CyberButton } from './cyber-button';
import { CyberCard } from './cyber-card';
import { Badge } from './badge';
import { ModalHeader } from './modal-header';
import { TotpAccount, TotpAlgorithm } from '@/models/vault.models';
import { isBillingLimitError } from '@/models/billing.models';
import { useOptionalBilling } from '@/context/billing-context';
import vaultService from '@/services/vault.service';
import { TotpEngine } from '@/services/totp-engine.service';

export interface ManualEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onAccountSaved?: (account: TotpAccount) => void;
  testID?: string;
}

export function ManualEntryModal({
  visible,
  onClose,
  onAccountSaved,
  testID = 'manual-entry-modal',
}: ManualEntryModalProps) {
  const billing = useOptionalBilling();
  const [accountName, setAccountName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [secret, setSecret] = useState('');
  const [algorithm, setAlgorithm] = useState<TotpAlgorithm>('SHA1');
  const [digits, setDigits] = useState<number>(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  const resetForm = () => {
    setAccountName('');
    setIssuer('');
    setSecret('');
    setAlgorithm('SHA1');
    setDigits(6);
    setErrorMessage(null);
    setPasteSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePasteKey = async () => {
    try {
      let clipText = '';
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        clipText = await navigator.clipboard.readText();
      } else {
        clipText = await Clipboard.getStringAsync();
      }

      if (!clipText || !clipText.trim()) {
        setErrorMessage('Clipboard is empty. Copy a Base32 key first.');
        return;
      }

      const cleaned = TotpEngine.cleanSecret(clipText);
      setSecret(cleaned);
      setPasteSuccess(true);
      setTimeout(() => setPasteSuccess(false), 2000);

      const validation = vaultService.validateSecret(cleaned);
      if (!validation.valid) {
        setErrorMessage(validation.error || 'Invalid Base32 secret key format');
      } else {
        setErrorMessage(null);
      }
    } catch {
      setErrorMessage('Could not read clipboard. Please paste manually.');
    }
  };

  const handleSecretChange = (text: string) => {
    setSecret(text);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSave = async () => {
    const trimmedName = accountName.trim();
    const trimmedSecret = secret.trim();

    if (!trimmedName) {
      setErrorMessage('Account Identifier is required (e.g. user@company.com)');
      return;
    }
    if (!trimmedSecret) {
      setErrorMessage('Base32 Secret Key is required');
      return;
    }

    const check = vaultService.validateSecret(trimmedSecret);
    if (!check.valid) {
      setErrorMessage(check.error || 'Invalid Base32 secret key');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const existing = await vaultService.getAccounts();
      if (billing) {
        const quota = billing.checkTotpQuota(existing.length);
        if (!quota.allowed) {
          setErrorMessage(quota.reason || 'Free tier 2FA limit reached.');
          billing.openBillingModal(quota.reason);
          return;
        }
      }

      const created = await vaultService.saveAccount({
        accountName: trimmedName,
        name: trimmedName,
        issuer: issuer.trim() || 'Authenticator',
        secret: trimmedSecret,
        algorithm,
        digits,
        period: 30,
        icon: '🔑',
      });

      resetForm();
      if (onAccountSaved) {
        onAccountSaved(created);
      }
      onClose();
    } catch (err: any) {
      if (isBillingLimitError(err)) {
        await billing?.refreshSubscription();
        billing?.openBillingModal(err.message);
        onClose();
        return;
      }
      setErrorMessage(err?.message || 'Failed to save account into vault');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalBox}>
          {/* Header */}
          <ModalHeader
            title="Manual Code Entry"
            subtitle="Enter Base32 secret key with issuer & account label"
            icon="⌨️"
            onClose={handleClose}
            testID={`${testID}-header`}
          />

          {errorMessage && (
            <CyberCard variant="danger" style={styles.errorCard}>
              <Text style={styles.errorText} testID={`${testID}-error`}>
                ⚠️ {errorMessage}
              </Text>
            </CyberCard>
          )}

          {/* Form */}
          <View style={styles.form}>
            {/* Account Identifier */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>ACCOUNT IDENTIFIER *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. admin@vanguard.security"
                placeholderTextColor={CyberColors.textMuted}
                value={accountName}
                onChangeText={(val) => {
                  setAccountName(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                testID={`${testID}-input-account`}
              />
            </View>

            {/* Issuer */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>ISSUER / SERVICE NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Vanguard Security, AWS, GitHub"
                placeholderTextColor={CyberColors.textMuted}
                value={issuer}
                onChangeText={setIssuer}
                autoCapitalize="words"
                autoCorrect={false}
                testID={`${testID}-input-issuer`}
              />
            </View>

            {/* Base32 Secret Key with Paste Button */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>BASE32 SECRET KEY *</Text>
                <TouchableOpacity
                  style={[styles.pasteBtn, pasteSuccess && styles.pasteBtnSuccess]}
                  onPress={handlePasteKey}
                  activeOpacity={0.7}
                  testID={`${testID}-paste-button`}
                >
                  <Text style={styles.pasteBtnText}>
                    {pasteSuccess ? 'PASTED! ✓' : '📋 Paste Key'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, styles.secretInput]}
                placeholder="e.g. JBSWY3DPEHPK3PXP"
                placeholderTextColor={CyberColors.textMuted}
                value={secret}
                onChangeText={handleSecretChange}
                autoCapitalize="characters"
                autoCorrect={false}
                testID={`${testID}-input-secret`}
              />
            </View>

            {/* Algorithm & Digits */}
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>ALGORITHM</Text>
                <View style={styles.chipRow}>
                  {(['SHA1', 'SHA256'] as TotpAlgorithm[]).map((alg) => (
                    <TouchableOpacity
                      key={alg}
                      style={[
                        styles.chip,
                        algorithm === alg && styles.chipActive,
                      ]}
                      onPress={() => setAlgorithm(alg)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          algorithm === alg && styles.chipTextActive,
                        ]}
                      >
                        {alg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.halfField}>
                <Text style={styles.label}>DIGITS</Text>
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

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <CyberButton
                title="Cancel"
                variant="ghost"
                size="md"
                onPress={handleClose}
                style={styles.cancelBtn}
                disabled={isSubmitting}
              />
              <CyberButton
                title={isSubmitting ? 'Securing...' : 'Save Token 🔒'}
                variant="primary"
                size="md"
                onPress={handleSave}
                loading={isSubmitting}
                style={styles.saveBtn}
                testID={`${testID}-save-button`}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: CyberColors.cardBg,
    borderRadius: CyberRadius.lg,
    borderWidth: 1,
    borderColor: CyberColors.borderSubtle,
    padding: 20,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  errorCard: {
    marginBottom: 14,
    padding: 10,
  },
  errorText: {
    color: CyberColors.red,
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    marginTop: 10,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: CyberColors.textSecondary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: CyberColors.cardBgSecondary,
    borderWidth: 1,
    borderColor: CyberColors.borderSubtle,
    borderRadius: CyberRadius.md,
    color: CyberColors.textPrimary,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secretInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1.2,
  },
  pasteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: CyberRadius.sm,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: CyberColors.cyan,
  },
  pasteBtnSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: CyberColors.green,
  },
  pasteBtnText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
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
    backgroundColor: CyberColors.cardBgSecondary,
    borderRadius: CyberRadius.sm,
    borderWidth: 1,
    borderColor: CyberColors.borderSubtle,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: CyberColors.cyan,
  },
  chipText: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: CyberColors.cyan,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 2,
  },
});

export default ManualEntryModal;
