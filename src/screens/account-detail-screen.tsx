import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
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
import { TotpAccount } from '@/models/vault.models';
import vaultService from '@/services/vault.service';

export interface AccountDetailScreenProps {
  account: TotpAccount;
  onBack: () => void;
  onDeleted?: (id: string) => void;
  testID?: string;
}

export function AccountDetailScreen({
  account,
  onBack,
  onDeleted,
  testID = 'account-detail-screen',
}: AccountDetailScreenProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [isCopiedCode, setIsCopiedCode] = useState(false);
  const [isCopiedSecret, setIsCopiedSecret] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const rem = vaultService.getRemainingSeconds(account.period || 30);
      setRemainingSeconds(rem);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [account]);

  const copyToClipboard = async (text: string, isSecret = false) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        await Clipboard.setStringAsync(text);
      }
      if (isSecret) {
        setIsCopiedSecret(true);
        setTimeout(() => setIsCopiedSecret(false), 2000);
      } else {
        setIsCopiedCode(true);
        setTimeout(() => setIsCopiedCode(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const currentCode = vaultService.generateCode(account);
  const formattedCode = vaultService.formatCode(currentCode);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      await vaultService.deleteAccount(account.id);
      if (onDeleted) {
        onDeleted(account.id);
      } else {
        onBack();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to remove account from vault');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.screen} testID={testID}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <ModalHeader
            title={account.issuer}
            subtitle={account.name}
            icon={account.icon}
            badgeText="TOTP"
            badgeVariant="cyan"
            onClose={onBack}
            testID="account-detail-header"
          />

          {/* Primary TOTP Code Card */}
          <CyberCard variant="glow" style={styles.codeCard}>
            <Text style={styles.codeCardLabel}>LIVE TIME-BASED ONE-TIME PASSWORD</Text>
            <Text style={styles.codeDisplay} testID="detail-totp-code">
              {formattedCode}
            </Text>

            <View style={styles.countdownRow}>
              <View style={styles.countdownPill}>
                <View
                  style={[
                    styles.countdownDot,
                    {
                      backgroundColor:
                        remainingSeconds <= 5
                          ? CyberColors.red
                          : CyberColors.cyan,
                    },
                  ]}
                />
                <Text style={styles.countdownText}>
                  Refreshes in {remainingSeconds}s
                </Text>
              </View>

              <CyberButton
                title={isCopiedCode ? 'COPIED! ✓' : 'Copy Code 📋'}
                variant="primary"
                size="sm"
                onPress={() => copyToClipboard(currentCode)}
                testID="detail-copy-code-btn"
              />
            </View>
          </CyberCard>

          {/* Secret Key Security Section */}
          <CyberCard variant="glass" style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>ENCRYPTION SECRET KEY</Text>
              <Badge label="BASE32" variant="indigo" size="sm" />
            </View>

            <View style={styles.secretBox}>
              <Text style={styles.secretText} testID="detail-secret-text">
                {showSecret ? account.secret : '•••• •••• •••• ••••'}
              </Text>
            </View>

            <View style={styles.secretActions}>
              <TouchableOpacity
                style={styles.actionPill}
                onPress={() => setShowSecret(!showSecret)}
                testID="toggle-secret-btn"
              >
                <Text style={styles.actionPillText}>
                  {showSecret ? '🙈 Hide Secret' : '👁️ Reveal Secret'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionPill}
                onPress={() => copyToClipboard(account.secret, true)}
                testID="copy-secret-btn"
              >
                <Text style={styles.actionPillText}>
                  {isCopiedSecret ? 'Copied! ✓' : 'Copy Key 📋'}
                </Text>
              </TouchableOpacity>
            </View>
          </CyberCard>

          {/* Token Parameters */}
          <CyberCard variant="glass" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>TOKEN SPECIFICATIONS</Text>
            <View style={styles.specsGrid}>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Algorithm</Text>
                <Text style={styles.specValue}>{account.algorithm}</Text>
              </View>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Digits</Text>
                <Text style={styles.specValue}>{account.digits}</Text>
              </View>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Period</Text>
                <Text style={styles.specValue}>{account.period}s</Text>
              </View>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Storage</Text>
                <Text style={styles.specValue}>Encrypted Local</Text>
              </View>
            </View>
          </CyberCard>

          {/* Recovery / Backup Codes */}
          {account.backupCodes && account.backupCodes.length > 0 ? (
            <CyberCard variant="glass" style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>EMERGENCY RECOVERY CODES</Text>
                <Badge
                  label={`${account.backupCodes.length} Available`}
                  variant="green"
                  size="sm"
                />
              </View>
              <View style={styles.backupCodesList}>
                {account.backupCodes.map((bcode, idx) => (
                  <View key={idx} style={styles.backupCodeBadge}>
                    <Text style={styles.backupCodeText}>{bcode}</Text>
                  </View>
                ))}
              </View>
            </CyberCard>
          ) : null}

          {/* Danger Zone: Delete Account */}
          <CyberCard
            variant={confirmDelete ? 'danger' : 'glass'}
            style={styles.dangerCard}
          >
            <Text style={styles.dangerTitle}>
              {confirmDelete
                ? '⚠️ ARE YOU ABSOLUTELY SURE?'
                : 'TOKEN REMOVAL'}
            </Text>
            <Text style={styles.dangerDesc}>
              {confirmDelete
                ? 'Deleting this token will permanently erase the 2FA secret from this device. Ensure you have backup access to this corporate service.'
                : 'Remove this authenticator account from your local Vanguard vault.'}
            </Text>

            <View style={styles.dangerActions}>
              {confirmDelete ? (
                <CyberButton
                  title="Cancel"
                  variant="ghost"
                  size="sm"
                  onPress={() => setConfirmDelete(false)}
                />
              ) : null}

              <CyberButton
                title={
                  confirmDelete
                    ? 'Confirm Delete Token 🗑️'
                    : 'Delete Token 🗑️'
                }
                variant="danger"
                size="sm"
                loading={isDeleting}
                onPress={handleDelete}
                testID="delete-account-button"
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
  codeCard: {
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  codeCardLabel: {
    color: CyberColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  codeDisplay: {
    color: CyberColors.cyan,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 16,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.7)',
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  countdownText: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    marginBottom: 16,
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: CyberColors.textMuted,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  secretBox: {
    backgroundColor: 'rgba(10, 14, 23, 0.8)',
    borderColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  secretText: {
    color: CyberColors.cyan,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  secretActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: CyberRadius.xs,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
  },
  actionPillText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 12,
  },
  specItem: {
    width: '46%',
    backgroundColor: 'rgba(10, 14, 23, 0.5)',
    padding: 10,
    borderRadius: CyberRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(30, 41, 59, 0.6)',
  },
  specLabel: {
    color: CyberColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  specValue: {
    color: CyberColors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  backupCodesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  backupCodeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: CyberRadius.xs,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderWidth: 1,
  },
  backupCodeText: {
    color: CyberColors.green,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  dangerCard: {
    padding: 16,
    marginBottom: 24,
  },
  dangerTitle: {
    color: CyberColors.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  dangerDesc: {
    color: CyberColors.textSecondary,
    fontSize: 12,
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
