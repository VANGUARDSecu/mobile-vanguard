import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import {
  AuthService,
  type GoogleAccountProfile,
} from '@/services/auth.service';
import { parseGoogleOAuthCallbackUrl } from '@/utils/registration-wizard';
import { GoogleLogo } from './google-logo';

export interface GoogleAccountPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAccount: (account: GoogleAccountProfile) => Promise<void> | void;
  title?: string;
}

/**
 * Google Account Chooser popup modal for mobile authentication.
 * Contains zero hardcoded accounts: lists only the user's own previously used Gmail accounts
 * on this device, lets the user enter their Gmail account, or launches Google Browser OAuth.
 */
export function GoogleAccountPickerModal({
  visible,
  onClose,
  onSelectAccount,
  title = 'Choose an account',
}: GoogleAccountPickerModalProps) {
  const [accounts, setAccounts] = useState<GoogleAccountProfile[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [customAccountType, setCustomAccountType] =
    useState<'individual' | 'company'>('individual');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let isMounted = true;
    AuthService.getSavedGoogleAccounts()
      .then((list) => {
        if (isMounted) {
          setAccounts(list);
          setErrorText(null);
          setShowAddAccount(list.length === 0);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [visible]);

  const handleChooseAccount = async (account: GoogleAccountProfile) => {
    setIsBusy(true);
    setErrorText(null);
    try {
      await onSelectAccount(account);
    } catch (err: unknown) {
      setErrorText(
        err instanceof Error ? err.message : 'Unable to sign in with Google.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveSavedAccount = async (emailToRemove: string) => {
    await AuthService.removeSavedGoogleAccount(emailToRemove);
    const updated = await AuthService.getSavedGoogleAccounts();
    setAccounts(updated);
    if (updated.length === 0) {
      setShowAddAccount(true);
    }
  };

  const handleSubmitCustomAccount = async () => {
    const cleanEmail = customEmail.trim().toLowerCase();
    const isGmail =
      cleanEmail.endsWith('@gmail.com') || cleanEmail.endsWith('@googlemail.com');

    if (!cleanEmail || !isGmail) {
      setErrorText('Please enter your valid Gmail address (@gmail.com).');
      return;
    }

    const resolvedName =
      customName.trim() ||
      cleanEmail
        .split('@')[0]
        .split(/[._-]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    const parts = resolvedName.split(' ');
    await handleChooseAccount({
      email: cleanEmail,
      name: resolvedName,
      firstName: parts[0] || cleanEmail.split('@')[0],
      lastName: parts.slice(1).join(' '),
      accountType: customAccountType,
    });
  };

  const handleLaunchBrowserOAuth = async () => {
    setIsBusy(true);
    setErrorText(null);
    try {
      const redirectUri = Linking.createURL('login');
      const oauthUrl = await AuthService.getGoogleOAuthUrl(redirectUri);
      if (!oauthUrl) {
        setErrorText(
          'Browser OAuth redirect is unavailable. Enter your Gmail address below to continue.'
        );
        setShowAddAccount(true);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUri);
      if (result.type === 'success' && result.url) {
        const parsed = parseGoogleOAuthCallbackUrl(result.url);
        if (parsed) {
          await onSelectAccount(parsed);
          return;
        }
      }
      setErrorText(
        'Browser OAuth did not complete. Enter your Gmail address below to continue.'
      );
      setShowAddAccount(true);
    } catch {
      setErrorText(
        'Could not complete browser OAuth. Enter your Gmail address below to continue.'
      );
      setShowAddAccount(true);
    } finally {
      setIsBusy(false);
    }
  };

  const getInitials = (account: GoogleAccountProfile): string => {
    const parts = (account.name || account.email).trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }
    return (account.email[0] || 'G').toUpperCase();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="google-account-picker-modal">
          {/* Official 4-Color Google Header */}
          <View style={styles.header}>
            <View style={styles.googleLogoBadge}>
              <GoogleLogo size={24} />
            </View>
            <Text style={styles.headerBrand}>Sign in with Google</Text>
            <Text style={styles.headerTitle}>
              {showAddAccount && accounts.length === 0
                ? 'Use your Google Account'
                : title}
            </Text>
            <Text style={styles.headerSubtitle}>
              to continue to <Text style={styles.brandHighlight}>Vanguard Security</Text>
            </Text>
          </View>

          {errorText ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {errorText}</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.accountsScroll}
            keyboardShouldPersistTaps="handled"
          >
            {!showAddAccount && accounts.length > 0 ? (
              <>
                {accounts.map((acc) => (
                  <View key={acc.email} style={styles.accountRowContainer}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.accountRow,
                        pressed && styles.accountRowPressed,
                      ]}
                      disabled={isBusy}
                      onPress={() => handleChooseAccount(acc)}
                      testID={`google-account-${acc.email}`}
                    >
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitials}>
                          {getInitials(acc)}
                        </Text>
                      </View>
                      <View style={styles.accountDetails}>
                        <View style={styles.accountNameRow}>
                          <Text style={styles.accountName}>{acc.name}</Text>
                          <View style={styles.typePill}>
                            <Text style={styles.typePillText}>
                              {acc.accountType === 'company' ? 'ORG' : 'PERSONAL'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.accountEmail}>{acc.email}</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      style={styles.removeAccountBtn}
                      onPress={() => handleRemoveSavedAccount(acc.email)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${acc.email}`}
                    >
                      <Text style={styles.removeAccountText}>✕</Text>
                    </Pressable>
                  </View>
                ))}

                {/* Use Another Gmail Account */}
                <Pressable
                  style={({ pressed }) => [
                    styles.accountRow,
                    pressed && styles.accountRowPressed,
                  ]}
                  disabled={isBusy}
                  onPress={() => {
                    setErrorText(null);
                    setShowAddAccount(true);
                  }}
                  testID="google-use-another-account"
                >
                  <View style={[styles.avatarCircle, styles.addAvatarCircle]}>
                    <Text style={styles.addAvatarIcon}>👤+</Text>
                  </View>
                  <View style={styles.accountDetails}>
                    <Text style={styles.accountName}>Use another Gmail account</Text>
                    <Text style={styles.accountEmail}>
                      Sign in with your @gmail.com address
                    </Text>
                  </View>
                </Pressable>
              </>
            ) : (
              <View style={styles.addAccountForm}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Your Gmail Address *</Text>
                  <TextInput
                    style={styles.input}
                    value={customEmail}
                    onChangeText={(val) => {
                      setCustomEmail(val);
                      if (errorText) setErrorText(null);
                    }}
                    placeholder="email@gmail.com"
                    placeholderTextColor={CyberColors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID="google-custom-email-input"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Display Name (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={customName}
                    onChangeText={setCustomName}
                    placeholder="Your name"
                    placeholderTextColor={CyberColors.textMuted}
                    autoCapitalize="words"
                    testID="google-custom-name-input"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Workspace Mode</Text>
                  <View style={styles.modeSwitchRow}>
                    <Pressable
                      style={[
                        styles.modeChip,
                        customAccountType === 'individual' && styles.modeChipActive,
                      ]}
                      onPress={() => setCustomAccountType('individual')}
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          customAccountType === 'individual' &&
                            styles.modeChipTextActive,
                        ]}
                      >
                        👤 Personal Vault
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.modeChip,
                        customAccountType === 'company' && styles.modeChipActive,
                      ]}
                      onPress={() => setCustomAccountType('company')}
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          customAccountType === 'company' &&
                            styles.modeChipTextActive,
                        ]}
                      >
                        🏢 Company Org
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.formButtonsRow}>
                  {accounts.length > 0 ? (
                    <Pressable
                      style={styles.backToListBtn}
                      onPress={() => {
                        setErrorText(null);
                        setShowAddAccount(false);
                      }}
                      disabled={isBusy}
                    >
                      <Text style={styles.backToListBtnText}>← Saved</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={styles.continueCustomBtn}
                    onPress={handleSubmitCustomAccount}
                    disabled={isBusy}
                    testID="google-custom-submit-button"
                  >
                    <Text style={styles.continueCustomBtnText}>
                      Continue with Gmail
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* System Browser Google OAuth */}
            <Pressable
              style={({ pressed }) => [
                styles.browserOAuthBtn,
                pressed && styles.accountRowPressed,
              ]}
              disabled={isBusy}
              onPress={handleLaunchBrowserOAuth}
              testID="google-browser-oauth-button"
            >
              <GoogleLogo size={15} />
              <Text style={styles.browserOAuthText}>
                Continue via Google Browser OAuth ↗
              </Text>
            </Pressable>
          </ScrollView>

          {isBusy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator size="small" color={CyberColors.cyan} />
              <Text style={styles.busyText}>Authenticating Google session...</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.privacyNotice}>
              Google will share your name, email address, and profile picture with
              Vanguard Security.
            </Text>
            <Pressable
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isBusy}
              testID="google-picker-close-button"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 22, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    backgroundColor: '#0f172a',
    borderRadius: CyberRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.45)',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.2)',
    paddingBottom: 14,
    marginBottom: 12,
  },
  googleLogoBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerBrand: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerTitle: {
    color: CyberColors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    marginTop: 2,
  },
  brandHighlight: {
    color: CyberColors.cyan,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
  },
  accountsScroll: {
    maxHeight: 340,
  },
  accountRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.15)',
  },
  accountRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: CyberRadius.md,
    gap: 12,
  },
  accountRowPressed: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  removeAccountBtn: {
    padding: 10,
  },
  removeAccountText: {
    color: CyberColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 133, 244, 0.25)',
    borderWidth: 1,
    borderColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '800',
  },
  addAvatarCircle: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: CyberColors.cyan,
  },
  addAvatarIcon: {
    fontSize: 14,
  },
  accountDetails: {
    flex: 1,
  },
  accountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountName: {
    color: CyberColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  typePill: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  typePillText: {
    color: CyberColors.cyan,
    fontSize: 9,
    fontWeight: '800',
  },
  accountEmail: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  browserOAuthBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: CyberRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  browserOAuthText: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  addAccountForm: {
    paddingVertical: 4,
    gap: 12,
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: CyberColors.textPrimary,
    fontSize: 13.5,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: CyberRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
  },
  modeChipActive: {
    borderColor: CyberColors.cyan,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  modeChipText: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: CyberColors.cyan,
  },
  formButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  backToListBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: CyberRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToListBtnText: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    fontWeight: '700',
  },
  continueCustomBtn: {
    flex: 1,
    backgroundColor: CyberColors.cyan,
    borderRadius: CyberRadius.md,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueCustomBtnText: {
    color: CyberColors.textDark,
    fontSize: 13,
    fontWeight: '800',
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  busyText: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.2)',
    gap: 10,
  },
  privacyNotice: {
    color: CyberColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  cancelBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 18,
  },
  cancelBtnText: {
    color: CyberColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
});
