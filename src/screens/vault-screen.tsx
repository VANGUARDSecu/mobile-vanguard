import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import {
  CyberButton,
  CyberCard,
  Badge,
  StatusIndicator,
} from '@/components/cyber';
import { TotpAccount } from '@/models/vault.models';
import vaultService from '@/services/vault.service';

export interface VaultScreenProps {
  onSelectAccount?: (account: TotpAccount) => void;
  onAddAccount?: () => void;
  onOpenSettings?: () => void;
  testID?: string;
}

export function VaultScreen({
  onSelectAccount,
  onAddAccount,
  onOpenSettings,
  testID = 'vault-screen',
}: VaultScreenProps) {
  const [accounts, setAccounts] = useState<TotpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await vaultService.getAccounts();
      setAccounts(data);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Dynamic TOTP countdown timer tick
  useEffect(() => {
    const updateCountdown = () => {
      const rem = vaultService.getRemainingSeconds(30);
      setRemainingSeconds(rem);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyCode = async (account: TotpAccount) => {
    const rawCode = vaultService.generateCode(account);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(rawCode);
      } else {
        await Clipboard.setStringAsync(rawCode);
      }
      setCopiedAccountId(account.id);
      setTimeout(() => {
        setCopiedAccountId((prev) => (prev === account.id ? null : prev));
      }, 2500);
    } catch {
      // Fallback
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      acc.name.toLowerCase().includes(query) ||
      acc.issuer.toLowerCase().includes(query)
    );
  });

  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / 30) * 100));

  return (
    <View style={styles.screen} testID={testID}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandIcon}>🛡️</Text>
                <Text style={styles.brandTitle}>VANGUARD VAULT</Text>
              </View>
              <StatusIndicator
                status="synced"
                label="LOCAL ZERO-TRUST"
                pulse
                size="sm"
                testID="vault-status"
              />
            </View>
            <Text style={styles.pageTitle}>Authenticator Tokens</Text>
            <Text style={styles.pageSubtitle}>
              Air-gapped 2FA TOTP codes with local hardware attestation
            </Text>
          </View>

          {/* Countdown & Action Bar */}
          <CyberCard variant="glass" style={styles.timerCard}>
            <View style={styles.timerRow}>
              <View style={styles.timerLeft}>
                <Text style={styles.timerLabel}>TOKEN ROTATION CYCLE</Text>
                <Text style={styles.timerValue}>
                  {remainingSeconds}s{' '}
                  <Text style={styles.timerUnit}>remaining</Text>
                </Text>
              </View>
              <View style={styles.actionButtons}>
                {onOpenSettings ? (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={onOpenSettings}
                    activeOpacity={0.7}
                    testID="vault-settings-button"
                    accessibilityLabel="Settings"
                  >
                    <Text style={styles.iconBtnText}>⚙️</Text>
                  </TouchableOpacity>
                ) : null}

                {onAddAccount ? (
                  <CyberButton
                    title="+ Add Token"
                    variant="primary"
                    size="sm"
                    onPress={onAddAccount}
                    testID="vault-add-button"
                  />
                ) : null}
              </View>
            </View>

            {/* Countdown Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${progressPercent}%`,
                    backgroundColor:
                      remainingSeconds <= 5
                        ? CyberColors.red
                        : remainingSeconds <= 10
                        ? CyberColors.amber
                        : CyberColors.cyan,
                  },
                ]}
              />
            </View>
          </CyberCard>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search accounts or issuers..."
              placeholderTextColor={CyberColors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              testID="vault-search-input"
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchBtn}
              >
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Account List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={CyberColors.cyan} />
              <Text style={styles.loadingText}>DECRYPTING LOCAL VAULT TOKENS...</Text>
            </View>
          ) : filteredAccounts.length === 0 ? (
            <CyberCard variant="glass" style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🔒</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No matching accounts' : 'No accounts in vault'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Try searching with a different issuer or username keyword.'
                  : 'Add your first 2FA authenticator token to begin securing your accounts.'}
              </Text>
              {onAddAccount ? (
                <CyberButton
                  title="+ Add First Token"
                  variant="primary"
                  size="md"
                  onPress={onAddAccount}
                  style={styles.emptyAddBtn}
                />
              ) : null}
            </CyberCard>
          ) : (
            <View style={styles.accountsList}>
              {filteredAccounts.map((account) => {
                const code = vaultService.generateCode(account);
                const formattedCode = vaultService.formatCode(code);
                const isCopied = copiedAccountId === account.id;

                return (
                  <CyberCard
                    key={account.id}
                    variant="glass"
                    style={styles.accountCard}
                    onPress={
                      onSelectAccount ? () => onSelectAccount(account) : undefined
                    }
                    testID={`account-card-${account.id}`}
                  >
                    <View style={styles.accountHeader}>
                      <View style={styles.issuerRow}>
                        <View style={styles.accountIconBox}>
                          <Text style={styles.accountIconText}>{account.icon}</Text>
                        </View>
                        <View style={styles.accountInfo}>
                          <Text style={styles.issuerName}>{account.issuer}</Text>
                          <Text style={styles.accountName} numberOfLines={1}>
                            {account.name}
                          </Text>
                        </View>
                      </View>
                      <Badge
                        label={account.algorithm}
                        variant="indigo"
                        size="sm"
                      />
                    </View>

                    {/* TOTP Code Display */}
                    <View style={styles.codeRow}>
                      <View style={styles.codeWrap}>
                        <Text style={styles.totpCode} testID={`totp-code-${account.id}`}>
                          {formattedCode}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.copyButton,
                          isCopied && styles.copyButtonActive,
                        ]}
                        onPress={() => handleCopyCode(account)}
                        activeOpacity={0.7}
                        testID={`copy-button-${account.id}`}
                      >
                        <Text style={styles.copyButtonText}>
                          {isCopied ? 'COPIED! ✓' : 'COPY 📋'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </CyberCard>
                );
              })}
            </View>
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
    paddingBottom: 95,
  },
  header: {
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandIcon: {
    fontSize: 18,
  },
  brandTitle: {
    color: CyberColors.cyan,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 12.5,
    color: CyberColors.textSecondary,
    lineHeight: 17,
  },
  timerCard: {
    marginBottom: 16,
    padding: 14,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timerLeft: {
    flex: 1,
  },
  timerLabel: {
    color: CyberColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  timerValue: {
    color: CyberColors.cyan,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  timerUnit: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: CyberRadius.sm,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 15,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CyberColors.cardBg,
    borderColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    color: CyberColors.textPrimary,
    fontSize: 13,
    padding: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: CyberColors.textMuted,
    fontSize: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    color: CyberColors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyAddBtn: {
    marginTop: 6,
  },
  accountsList: {
    gap: 12,
  },
  accountCard: {
    padding: 14,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  issuerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  accountIconBox: {
    width: 38,
    height: 38,
    borderRadius: CyberRadius.sm,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIconText: {
    fontSize: 18,
  },
  accountInfo: {
    flex: 1,
  },
  issuerName: {
    color: CyberColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  accountName: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    marginTop: 1,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(10, 14, 23, 0.65)',
    borderRadius: CyberRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeWrap: {
    flex: 1,
  },
  totpCode: {
    color: CyberColors.cyan,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: CyberRadius.xs,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.4)',
    borderWidth: 1,
  },
  copyButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: CyberColors.green,
  },
  copyButtonText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
