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
  RefreshControl,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import {
  CyberButton,
  CyberCard,
  Badge,
  StatusIndicator,
  CircularCountdown,
  ManualEntryModal,
} from '@/components/cyber';
import { TotpAccount } from '@/models/vault.models';
import { PersonalVaultItem } from '@/models/apps.models';
import { useOptionalApps } from '@/context/apps-context';
import { useOptionalBilling } from '@/context/billing-context';
import vaultService from '@/services/vault.service';
import { TotpEngine } from '@/services/totp-engine.service';
import { AuthService } from '@/services/auth.service';
import { credentialVaultSyncService } from '@/services/credential-vault-sync.service';
import { syncCoordinatorService } from '@/services/sync-coordinator.service';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

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
  const responsive = useResponsiveLayout();
  const billing = useOptionalBilling();
  const appsCtx = useOptionalApps();
  const [activeSegment, setActiveSegment] = useState<'totp' | 'passwords'>('totp');
  const [accounts, setAccounts] = useState<TotpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Zero-Knowledge Passwords & Logins state (/vault)
  const [vaultPassInput, setVaultPassInput] = useState('');
  const [vaultUnlockError, setVaultUnlockError] = useState<string | null>(null);
  const [unlockingVault, setUnlockingVault] = useState(false);
  const [revealedPasswordIds, setRevealedPasswordIds] = useState<Record<string, boolean>>({});
  const [showAddCredModal, setShowAddCredModal] = useState(false);
  const [newCredTitle, setNewCredTitle] = useState('');
  const [newCredUser, setNewCredUser] = useState('');
  const [newCredPass, setNewCredPass] = useState('');
  const [newCredUrl, setNewCredUrl] = useState('');
  const [savingCred, setSavingCred] = useState(false);
  const [credCategoryFilter, setCredCategoryFilter] = useState<'all' | 'Login' | 'Favorites'>('all');

  const readLocalVault = useCallback(async () => {
    try {
      const data = await vaultService.getAccounts();
      setAccounts(data);
    } catch {
      // Keep existing
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const user = await AuthService.getCurrentUser();
      if (user?.email) {
        vaultService.setCurrentUserEmail(user.email);
      }
      vaultService.setAuthTokenProvider(async () =>
        user?.accessToken || (await AuthService.getAccessToken()),
      );
      await readLocalVault();
      const updatedFromBackend = await vaultService.syncWithBackend(
        user?.accessToken || undefined,
      );
      if (updatedFromBackend) {
        await readLocalVault();
      }
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }, [readLocalVault]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const user = await AuthService.getCurrentUser();
      await Promise.all([
        vaultService.syncWithBackend(user?.accessToken || undefined),
        credentialVaultSyncService.syncIfUnlocked(user?.accessToken || undefined),
        syncCoordinatorService.checkOnce(true),
        billing?.refreshSubscription ? billing.refreshSubscription() : Promise.resolve(),
      ]);
      await readLocalVault();
    } catch {
      // Non-fatal
    } finally {
      setRefreshing(false);
    }
  }, [billing, readLocalVault]);

  const showTimedToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  const handleCopyPlaintext = async (value: string, label: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      } else {
        await Clipboard.setStringAsync(value);
      }
      showTimedToast(`${label} copied`);
    } catch {
      // Ignore
    }
  };

  const handleUnlockPasswordVault = async () => {
    if (!vaultPassInput.trim()) {
      setVaultUnlockError('Enter your Vanguard Vault password to decrypt saved logins.');
      return;
    }
    setUnlockingVault(true);
    setVaultUnlockError(null);
    try {
      if (appsCtx) {
        await appsCtx.unlockCredentialVault(vaultPassInput);
      } else {
        const tok = await AuthService.getAccessToken();
        await credentialVaultSyncService.unlockWithPassword(vaultPassInput, tok);
      }
      setVaultPassInput('');
      showTimedToast('Password Vault unlocked');
    } catch (err: any) {
      setVaultUnlockError(err?.message || 'Unable to decrypt Password Vault.');
    } finally {
      setUnlockingVault(false);
    }
  };

  const handleSaveCredential = async () => {
    if (!newCredTitle.trim() || !newCredUser.trim()) return;
    setSavingCred(true);
    try {
      const payload = {
        title: newCredTitle.trim(),
        category: 'Login' as const,
        username: newCredUser.trim(),
        password: newCredPass,
        url: newCredUrl.trim() || undefined,
      };
      if (appsCtx) {
        await appsCtx.upsertCredential(payload);
      } else {
        const tok = await AuthService.getAccessToken();
        await credentialVaultSyncService.upsertItem(payload, tok);
      }
      setNewCredTitle('');
      setNewCredUser('');
      setNewCredPass('');
      setNewCredUrl('');
      setShowAddCredModal(false);
      showTimedToast('Saved to encrypted cloud vault');
    } catch (err: any) {
      setVaultUnlockError(err?.message || 'Failed to save credential.');
    } finally {
      setSavingCred(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
    const unsub = vaultService.subscribe(() => {
      void readLocalVault();
    });
    return () => {
      unsub();
    };
  }, [loadAccounts, readLocalVault]);

  // Dynamic offline TOTP countdown timer tick with instant cycle rollover
  useEffect(() => {
    const updateCountdown = () => {
      const rem = TotpEngine.getRemainingSeconds(30);
      setRemainingSeconds(rem);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 250);
    return () => clearInterval(interval);
  }, []);

  const handleCopyCode = async (account: TotpAccount) => {
    const rawCode = vaultService.generateCode(account);
    const formattedCode = vaultService.formatCode(rawCode);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(rawCode);
      } else {
        await Clipboard.setStringAsync(rawCode);
      }
      setCopiedAccountId(account.id);
      setToastMessage('Copied to clipboard');
      setTimeout(() => {
        setCopiedAccountId((prev) => (prev === account.id ? null : prev));
      }, 2500);
      setTimeout(() => {
        setToastMessage((prev) => (prev === 'Copied to clipboard' ? null : prev));
      }, 2500);
    } catch {
      // Fallback
    }
  };

  const vaultItemsList: PersonalVaultItem[] = appsCtx
    ? appsCtx.vaultCredentials
    : credentialVaultSyncService.getSnapshot().items;
  const isPasswordVaultUnlocked = appsCtx
    ? appsCtx.vaultUnlocked
    : credentialVaultSyncService.getSnapshot().unlocked;
  const hasRemoteEncryptedVault = appsCtx
    ? appsCtx.hasRemoteVault
    : credentialVaultSyncService.getSnapshot().hasRemoteEnvelope;

  const filteredVaultCredentials = vaultItemsList.filter((item) => {
    if (credCategoryFilter === 'Favorites' && !item.favorite) return false;
    if (credCategoryFilter === 'Login' && item.category !== 'Login') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.username.toLowerCase().includes(q) ||
      (item.url && item.url.toLowerCase().includes(q))
    );
  });

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
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: responsive.horizontalPadding,
              paddingTop: responsive.verticalPadding,
              paddingBottom: responsive.scrollBottomPadding,
            },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={CyberColors.cyan}
              colors={[CyberColors.cyan]}
            />
          }
        >
          <View style={responsive.centeredContainerStyle}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.brandRow, { flexWrap: 'wrap', gap: 8 }]}>
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
            <Text style={[styles.pageTitle, { fontSize: responsive.headerTitleSize }]}>
              {activeSegment === 'totp' ? 'Authenticator Tokens' : 'Zero-Knowledge Passwords'}
            </Text>
            <Text style={styles.pageSubtitle}>
              {activeSegment === 'totp'
                ? 'Air-gapped 2FA TOTP codes synchronized with Web & Browser Extension'
                : 'End-to-end AES-GCM encrypted logins synced across Web, Extension & Mobile'}
            </Text>

            {/* Segmented Vault Switcher */}
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentPill, activeSegment === 'totp' && styles.segmentPillActive]}
                onPress={() => setActiveSegment('totp')}
                activeOpacity={0.8}
                testID="vault-segment-totp"
              >
                <Text style={[styles.segmentText, activeSegment === 'totp' && styles.segmentTextActive]}>
                  🔐 2FA Codes ({accounts.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentPill, activeSegment === 'passwords' && styles.segmentPillActive]}
                onPress={() => setActiveSegment('passwords')}
                activeOpacity={0.8}
                testID="vault-segment-passwords"
              >
                <Text
                  style={[
                    styles.segmentText,
                    activeSegment === 'passwords' && styles.segmentTextActive,
                  ]}
                >
                  🗝️ Passwords ({isPasswordVaultUnlocked ? vaultItemsList.length : 'Locked'})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {activeSegment === 'totp' ? (
            <>
              {/* Countdown & Action Bar */}
          <CyberCard variant="glass" style={styles.timerCard}>
            <View style={styles.timerRow}>
              <View style={styles.timerLeft}>
                <CircularCountdown
                  remainingSeconds={remainingSeconds}
                  size={46}
                  strokeWidth={3.5}
                  testID="vault-main-countdown"
                />
                <View style={styles.timerTextWrap}>
                  <Text style={styles.timerLabel}>TOKEN ROTATION CYCLE</Text>
                  <Text style={styles.timerValue}>
                    {remainingSeconds}s{' '}
                    <Text style={styles.timerUnit}>remaining</Text>
                  </Text>
                </View>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => {
                    if (billing) {
                      const quota = billing.checkTotpQuota(accounts.length);
                      if (!quota.allowed) {
                        billing.openBillingModal(quota.reason);
                        return;
                      }
                    }
                    setShowManualModal(true);
                  }}
                  activeOpacity={0.7}
                  testID="vault-manual-entry-button"
                  accessibilityLabel="Manual Code Entry"
                >
                  <Text style={styles.iconBtnText}>⌨️</Text>
                </TouchableOpacity>

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

            {/* SCRUM-185: 2FA Authenticator Plan Quota Strip */}
            {billing ? (
              <TouchableOpacity
                onPress={() => billing.openBillingModal()}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: CyberRadius.sm,
                  backgroundColor: billing.isFreeTier
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'rgba(16, 185, 129, 0.1)',
                  borderColor: billing.isFreeTier
                    ? 'rgba(245, 158, 11, 0.35)'
                    : 'rgba(16, 185, 129, 0.35)',
                  borderWidth: 1,
                }}
              >
                <Text style={{ color: billing.isFreeTier ? '#fcd34d' : '#6ee7b7', fontSize: 11.5, fontWeight: '700' }}>
                  🔐 {accounts.length}/{billing.maxTotpAccounts === -1 ? '∞' : billing.maxTotpAccounts} 2FA Tokens • {billing.subscription.planName}
                </Text>
                <Text style={{ color: CyberColors.cyan, fontSize: 11, fontWeight: '800' }}>
                  {billing.isFreeTier && billing.canManageBilling ? 'Upgrade →' : 'Plan →'}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Prominent Responsive Add Token Button */}
            {onAddAccount ? (
              <View style={styles.addTokenRow}>
                <CyberButton
                  title="+ Add Authenticator Token"
                  variant="primary"
                  size="md"
                  onPress={() => {
                    if (billing) {
                      const quota = billing.checkTotpQuota(accounts.length);
                      if (!quota.allowed) {
                        billing.openBillingModal(quota.reason);
                        return;
                      }
                    }
                    onAddAccount();
                  }}
                  testID="vault-add-button"
                />
              </View>
            ) : null}
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
              <View style={styles.emptyActionsRow}>
                <CyberButton
                  title="+ Quick Manual Entry ⌨️"
                  variant="outline"
                  size="md"
                  onPress={() => setShowManualModal(true)}
                  style={styles.emptyActionBtn}
                  testID="vault-empty-manual-entry-button"
                />
                {onAddAccount ? (
                  <CyberButton
                    title="+ Add Authenticator Token"
                    variant="primary"
                    size="md"
                    onPress={onAddAccount}
                    style={styles.emptyActionBtn}
                    testID="vault-empty-add-button"
                  />
                ) : null}
              </View>
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

                    {/* TOTP Code Display, Circular Countdown & Tap-to-Copy */}
                    <View style={styles.codeRow}>
                      <TouchableOpacity
                        style={styles.codeWrap}
                        onPress={() => handleCopyCode(account)}
                        activeOpacity={0.7}
                        testID={`totp-code-touchable-${account.id}`}
                        accessibilityLabel={`Copy TOTP code for ${account.issuer}`}
                      >
                        <Text style={styles.totpCode} testID={`totp-code-${account.id}`}>
                          {formattedCode}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.codeActions}>
                        <CircularCountdown
                          remainingSeconds={remainingSeconds}
                          period={account.period || 30}
                          size={34}
                          strokeWidth={3}
                          textSize={9}
                          testID={`countdown-ring-${account.id}`}
                        />

                        <TouchableOpacity
                          style={[
                            styles.copyButton,
                            isCopied && styles.copyButtonActive,
                          ]}
                          onPress={() => handleCopyCode(account)}
                          activeOpacity={0.7}
                          testID={`copy-button-${account.id}`}
                          accessibilityLabel="Copy code to clipboard"
                        >
                          <Text style={styles.copyButtonText}>
                            {isCopied ? 'COPIED! ✓' : 'COPY 📋'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </CyberCard>
                );
              })}
            </View>
          )}
            </>
          ) : (
            <View style={{ gap: 12 }}>
              {!isPasswordVaultUnlocked ? (
                <CyberCard variant="glass" style={{ padding: 16 }}>
                  <Text style={styles.vaultCardHeading}>🔒 Unlock Zero-Knowledge Password Vault</Text>
                  <Text style={styles.vaultCardDesc}>
                    {hasRemoteEncryptedVault
                      ? 'An encrypted vault synced from Vanguard Web / Extension was found. Enter your Vanguard master password to decrypt it in RAM.'
                      : 'Enter your Vanguard password to initialize or unlock your cloud-synced Password Vault.'}
                  </Text>
                  {vaultUnlockError ? (
                    <Text style={styles.vaultErrorText}>⚠️ {vaultUnlockError}</Text>
                  ) : null}
                  <TextInput
                    style={styles.vaultInput}
                    value={vaultPassInput}
                    onChangeText={(t) => {
                      setVaultPassInput(t);
                      if (vaultUnlockError) setVaultUnlockError(null);
                    }}
                    placeholder="Enter Vault / Account Password"
                    placeholderTextColor={CyberColors.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <CyberButton
                    title={unlockingVault ? 'Decrypting PBKDF2-SHA256...' : 'Unlock Password Vault'}
                    variant="primary"
                    size="md"
                    disabled={unlockingVault}
                    onPress={() => void handleUnlockPasswordVault()}
                  />
                </CyberCard>
              ) : (
                <>
                  <CyberCard variant="glass" style={{ padding: 12 }}>
                    <View style={styles.credToolbarRow}>
                      <View style={styles.filterPillsRow}>
                        {(['all', 'Login', 'Favorites'] as const).map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            style={[
                              styles.filterPill,
                              credCategoryFilter === cat && styles.filterPillActive,
                            ]}
                            onPress={() => setCredCategoryFilter(cat)}
                          >
                            <Text
                              style={[
                                styles.filterPillText,
                                credCategoryFilter === cat && styles.filterPillTextActive,
                              ]}
                            >
                              {cat === 'all' ? 'All' : cat}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={styles.smallActionBtn}
                          onPress={() => setShowAddCredModal(true)}
                        >
                          <Text style={styles.smallActionBtnText}>+ Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.smallActionBtn, styles.lockSmallBtn]}
                          onPress={() =>
                            appsCtx ? appsCtx.lockCredentialVault() : credentialVaultSyncService.lock()
                          }
                        >
                          <Text style={[styles.smallActionBtnText, { color: '#fca5a5' }]}>🔒 Lock</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </CyberCard>

                  {filteredVaultCredentials.length === 0 ? (
                    <CyberCard variant="glass" style={{ padding: 24, alignItems: 'center' }}>
                      <Text style={{ fontSize: 28, marginBottom: 8 }}>🗝️</Text>
                      <Text style={styles.vaultCardHeading}>No Saved Logins Yet</Text>
                      <Text style={[styles.vaultCardDesc, { textAlign: 'center', marginBottom: 12 }]}>
                        Passwords saved via Vanguard Web Dashboard, Chrome Extension, or Mobile appear here automatically.
                      </Text>
                      <CyberButton
                        title="+ Save Login Credential"
                        variant="primary"
                        size="sm"
                        onPress={() => setShowAddCredModal(true)}
                      />
                    </CyberCard>
                  ) : (
                    filteredVaultCredentials.map((cred) => {
                      const revealed = Boolean(revealedPasswordIds[cred.id]);
                      return (
                        <CyberCard key={cred.id} variant="default" style={{ padding: 14 }}>
                          <View style={styles.credHeaderRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.credTitle}>{cred.title}</Text>
                              <Text style={styles.credUser}>{cred.username || 'No username'}</Text>
                              {cred.url ? (
                                <Text style={styles.credUrl} numberOfLines={1}>
                                  {cred.url}
                                </Text>
                              ) : null}
                            </View>
                            <Badge label={cred.category} variant="cyan" size="sm" />
                          </View>

                          {cred.password ? (
                            <View style={styles.credSecretRow}>
                              <Text style={styles.credSecretText}>
                                {revealed ? cred.password : '••••••••••••'}
                              </Text>
                              <TouchableOpacity
                                onPress={() =>
                                  setRevealedPasswordIds((prev) => ({
                                    ...prev,
                                    [cred.id]: !prev[cred.id],
                                  }))
                                }
                              >
                                <Text style={styles.credLinkBtn}>{revealed ? 'Hide' : 'Reveal'}</Text>
                              </TouchableOpacity>
                            </View>
                          ) : null}

                          <View style={styles.credActionsRow}>
                            <TouchableOpacity
                              style={styles.copyButton}
                              onPress={() => void handleCopyPlaintext(cred.username, 'Username')}
                            >
                              <Text style={styles.copyButtonText}>Copy User</Text>
                            </TouchableOpacity>
                            {cred.password ? (
                              <TouchableOpacity
                                style={styles.copyButton}
                                onPress={() => void handleCopyPlaintext(cred.password!, 'Password')}
                              >
                                <Text style={styles.copyButtonText}>Copy Pass</Text>
                              </TouchableOpacity>
                            ) : null}
                            {appsCtx ? (
                              <TouchableOpacity
                                style={styles.copyButton}
                                onPress={() => {
                                  void appsCtx
                                    .pinVaultCredentialToApps(cred)
                                    .then(() => showTimedToast('Pinned to Apps launcher'))
                                    .catch((e) => showTimedToast(e?.message || 'Unable to pin app'));
                                }}
                              >
                                <Text style={styles.copyButtonText}>📌 Pin</Text>
                              </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                              style={[styles.copyButton, { borderColor: 'rgba(239,68,68,0.4)' }]}
                              onPress={() => {
                                void (appsCtx
                                  ? appsCtx.deleteCredential(cred.id)
                                  : credentialVaultSyncService.deleteItem(cred.id)
                                ).then(() => showTimedToast('Credential removed'));
                              }}
                            >
                              <Text style={[styles.copyButtonText, { color: '#f87171' }]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </CyberCard>
                      );
                    })
                  )}
                </>
              )}
            </View>
          )}
          </View>
        </ScrollView>

        {/* Manual Code Entry Modal */}
        <Modal
          visible={showAddCredModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddCredModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.vaultCardHeading}>Add Zero-Knowledge Login</Text>
              <TextInput
                style={styles.vaultInput}
                value={newCredTitle}
                onChangeText={setNewCredTitle}
                placeholder="Application / Site Title (e.g. GitHub)"
                placeholderTextColor={CyberColors.textMuted}
              />
              <TextInput
                style={styles.vaultInput}
                value={newCredUser}
                onChangeText={setNewCredUser}
                placeholder="Username or Email"
                placeholderTextColor={CyberColors.textMuted}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.vaultInput}
                value={newCredPass}
                onChangeText={setNewCredPass}
                placeholder="Password"
                placeholderTextColor={CyberColors.textMuted}
                secureTextEntry
                autoCapitalize="none"
              />
              <TextInput
                style={styles.vaultInput}
                value={newCredUrl}
                onChangeText={setNewCredUrl}
                placeholder="URL (https://example.com)"
                placeholderTextColor={CyberColors.textMuted}
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
                <CyberButton
                  title="Cancel"
                  variant="ghost"
                  size="sm"
                  onPress={() => setShowAddCredModal(false)}
                />
                <CyberButton
                  title={savingCred ? 'Encrypting...' : 'Save to Cloud Vault'}
                  variant="primary"
                  size="sm"
                  disabled={savingCred}
                  onPress={() => void handleSaveCredential()}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <View style={styles.toastContainer} testID="vault-toast-notification">
            <View style={styles.toastContent}>
              <Text style={styles.toastIcon}>📋</Text>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </View>
        )}

        {/* Manual Code Entry Modal */}
        <ManualEntryModal
          visible={showManualModal}
          onClose={() => setShowManualModal(false)}
          onAccountSaved={() => {
            loadAccounts();
            setShowManualModal(false);
          }}
          testID="vault-manual-entry-modal"
        />
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
    gap: 8,
  },
  timerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  timerTextWrap: {
    flex: 1,
    flexShrink: 1,
  },
  timerLabel: {
    color: CyberColors.textMuted,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timerValue: {
    color: CyberColors.cyan,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  timerUnit: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
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
  addTokenRow: {
    marginTop: 12,
    width: '100%',
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
  codeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyActionsRow: {
    flexDirection: 'column',
    width: '100%',
    gap: 10,
    marginTop: 14,
  },
  emptyActionBtn: {
    width: '100%',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderWidth: 1,
    borderColor: CyberColors.cyan,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: CyberRadius.full,
    gap: 8,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  toastIcon: {
    fontSize: 14,
  },
  toastText: {
    color: CyberColors.cyan,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: CyberRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
  },
  segmentPillActive: {
    borderColor: CyberColors.cyan,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
  },
  segmentText: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: CyberColors.cyan,
  },
  vaultCardHeading: {
    color: CyberColors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  vaultCardDesc: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 12,
  },
  vaultErrorText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  vaultInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: CyberColors.textPrimary,
    fontSize: 13.5,
    marginBottom: 10,
  },
  credToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: CyberRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  filterPillActive: {
    borderColor: CyberColors.cyan,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
  },
  filterPillText: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: CyberColors.cyan,
  },
  smallActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: CyberRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.45)',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  lockSmallBtn: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  smallActionBtnText: {
    color: CyberColors.cyan,
    fontSize: 11.5,
    fontWeight: '800',
  },
  credHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  credTitle: {
    color: CyberColors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  credUser: {
    color: CyberColors.cyan,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  credUrl: {
    color: CyberColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  credSecretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: CyberRadius.xs,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  credSecretText: {
    color: CyberColors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
  },
  credLinkBtn: {
    color: CyberColors.cyan,
    fontSize: 11.5,
    fontWeight: '700',
  },
  credActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: CyberColors.cardBg,
    borderColor: CyberColors.borderHighlight,
    borderWidth: 1,
    borderRadius: CyberRadius.lg,
    padding: 18,
  },
});
