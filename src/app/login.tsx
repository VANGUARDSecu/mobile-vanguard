import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '@/context/auth-context';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import type { MfaChallengeResponse } from '@/models/auth.models';
import { AppsStorageService } from '@/services/apps-storage.service';
import VerifyOtpScreen from '@/screens/verify-otp-screen';

const REMEMBERED_EMAIL_KEY = 'vanguard_remembered_email';
const REMEMBERED_ACCOUNT_TYPE_KEY = 'vanguard_selected_account_type';

export default function LoginScreen() {
  const { login } = useAuth();

  const [accountType, setAccountType] = useState<'company' | 'individual'>('company');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallengeResponse | null>(null);
  const [activeServerUrl, setActiveServerUrl] = useState<string>(AppsStorageService.getBackendApiUrl());

  // Load remembered credentials preference on mount
  useEffect(() => {
    let isMounted = true;
    AppsStorageService.loadBackendApiUrlOverride().then((url) => {
      if (isMounted) setActiveServerUrl(url);
    });
    (async () => {
      try {
        const [savedEmail, savedType] = await Promise.all([
          AsyncStorage.getItem(REMEMBERED_EMAIL_KEY),
          AsyncStorage.getItem(REMEMBERED_ACCOUNT_TYPE_KEY),
        ]);
        if (isMounted) {
          if (savedEmail) {
            setEmail(savedEmail);
            setRememberEmail(true);
          }
          if (savedType === 'company' || savedType === 'individual') {
            setAccountType(savedType);
          }
        }
      } catch {
        // Non-blocking preference retrieval
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const isLocalServer =
    activeServerUrl.includes('localhost') ||
    activeServerUrl.includes('127.0.0.1') ||
    activeServerUrl.includes('10.0.2.2') ||
    activeServerUrl.includes(':3000');

  const handleToggleServerTarget = () => {
    if (isLocalServer) {
      const prodUrl = 'https://backend-vanguard.onrender.com';
      AppsStorageService.setBackendApiUrlOverride(prodUrl);
      setActiveServerUrl(prodUrl);
    } else {
      const localUrl = AppsStorageService.getLocalhostUrl(3000);
      AppsStorageService.setBackendApiUrlOverride(localUrl);
      setActiveServerUrl(localUrl);
    }
  };

  const handleSelectAccountType = (type: 'company' | 'individual') => {
    setAccountType(type);
    AsyncStorage.setItem(REMEMBERED_ACCOUNT_TYPE_KEY, type).catch(() => {});
    if (errorMessage) setErrorMessage(null);
  };

  const handleSignIn = async () => {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!cleanPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    // Persist or clear remembered email preference
    try {
      if (rememberEmail) {
        await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
      } else {
        await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
    } catch {
      // Non-blocking
    }

    try {
      const result = await login({ email: cleanEmail, password: cleanPassword });
      if (result.requireMfa) {
        setMfaChallenge(result.mfaChallenge);
      } else {
        router.replace('/');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (mfaChallenge) {
    return (
      <VerifyOtpScreen
        email={mfaChallenge.email}
        hasTotp={mfaChallenge.hasTotp}
        onSuccess={() => {
          setMfaChallenge(null);
          router.replace('/');
        }}
        onBack={() => setMfaChallenge(null)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Brand Header */}
            <View style={styles.brandContainer}>
              <View style={styles.shieldBadge}>
                <Text style={styles.shieldIcon}>🛡️</Text>
              </View>
              <Text style={styles.brandTitle}>VANGUARD</Text>
              <Text style={styles.brandSubtitle}>SECURITY IDENTITY</Text>
              <Text style={styles.heroText}>
                Zero-Trust Mobile Access
              </Text>
            </View>

            {/* Active Server Environment Bar */}
            <View style={styles.serverBar}>
              <View style={styles.serverInfoWrap}>
                <Text style={styles.serverIcon}>{isLocalServer ? '💻' : '🌐'}</Text>
                <View style={styles.serverDetailsWrap}>
                  <Text style={styles.serverLabel}>
                    {isLocalServer ? 'LOCAL BACKEND' : 'CLOUD BACKEND'}
                  </Text>
                  <Text style={styles.serverUrlText} numberOfLines={1}>
                    {activeServerUrl}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.serverToggleBtn}
                onPress={handleToggleServerTarget}
                accessibilityRole="button"
                accessibilityLabel="Switch Server Environment"
              >
                <Text style={styles.serverToggleBtnText}>
                  {isLocalServer ? 'Use Cloud' : 'Use Localhost'}
                </Text>
              </Pressable>
            </View>

            {/* Login Card */}
            <View style={styles.card}>
              {/* Account Type Segmented Selector */}
              <View style={styles.segmentContainer}>
                <Pressable
                  style={[
                    styles.segmentButton,
                    accountType === 'company' && styles.segmentButtonActive,
                  ]}
                  onPress={() => handleSelectAccountType('company')}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: accountType === 'company' }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      accountType === 'company' && styles.segmentTextActive,
                    ]}
                  >
                    🏢 Company Account
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.segmentButton,
                    accountType === 'individual' && styles.segmentButtonActive,
                  ]}
                  onPress={() => handleSelectAccountType('individual')}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: accountType === 'individual' }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      accountType === 'individual' && styles.segmentTextActive,
                    ]}
                  >
                    👤 Individual Vault
                  </Text>
                </Pressable>
              </View>

              {/* Mode Context Description */}
              <View style={styles.modeDescriptionWrap}>
                <Text style={styles.cardTitle}>
                  {accountType === 'company'
                    ? 'Sign In to Workplace Portal'
                    : 'Unlock Personal Encrypted Vault'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {accountType === 'company'
                    ? 'Access corporate Single Sign-On, workplace applications & corporate directory.'
                    : 'Access your encrypted credentials, personal 2FA authenticators & secure notes.'}
                </Text>
              </View>

              {/* Localhost / Offline Quick Test Bar */}
              {isLocalServer ? (
                <View style={styles.quickTestBox}>
                  <Text style={styles.quickTestTitle}>⚡ Localhost Quick Fill</Text>
                  <View style={styles.quickTestChipsRow}>
                    <Pressable
                      style={styles.quickTestChip}
                      onPress={() => {
                        handleSelectAccountType('company');
                        setEmail('user@company.com');
                        setPassword('Password123!');
                        setErrorMessage(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Fill Company Demo Account"
                    >
                      <Text style={styles.quickTestChipText}>🏢 Company</Text>
                    </Pressable>

                    <Pressable
                      style={styles.quickTestChip}
                      onPress={() => {
                        handleSelectAccountType('individual');
                        setEmail('personal@vanguard.local');
                        setPassword('Password123!');
                        setErrorMessage(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Fill Personal Vault Demo Account"
                    >
                      <Text style={styles.quickTestChipText}>👤 Personal</Text>
                    </Pressable>

                    <Pressable
                      style={styles.quickTestChip}
                      onPress={() => {
                        handleSelectAccountType('company');
                        setEmail('admin@vanguard.security');
                        setPassword('Password123!');
                        setErrorMessage(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Fill Admin Demo Account"
                    >
                      <Text style={styles.quickTestChipText}>🛡️ Admin</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.quickTestHint}>
                    Local test OTP code: <Text style={{ color: CyberColors.cyan, fontWeight: '800' }}>123456</Text> (works offline & localhost)
                  </Text>
                </View>
              ) : null}

              {/* Error Alert */}
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {accountType === 'company' ? 'Work Email Address' : 'Personal Email Address'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={
                    accountType === 'company' ? 'name@company.com' : 'personal@domain.com'
                  }
                  placeholderTextColor={CyberColors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {accountType === 'company' ? 'Account Password' : 'Vault Master Password'}
                </Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Enter your password"
                    placeholderTextColor={CyberColors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🔒'}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Remember Email Option */}
              <Pressable
                style={styles.rememberRow}
                onPress={() => setRememberEmail(!rememberEmail)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberEmail }}
              >
                <View style={[styles.checkbox, rememberEmail && styles.checkboxChecked]}>
                  {rememberEmail && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>Remember my email address</Text>
              </Pressable>

              {/* Sign In Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.signInBtn,
                  pressed && styles.signInBtnPressed,
                  submitting && styles.signInBtnDisabled,
                ]}
                onPress={handleSignIn}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Sign In"
              >
                {submitting ? (
                  <View style={styles.submittingRow}>
                    <ActivityIndicator size="small" color={CyberColors.textDark} />
                    <Text style={[styles.signInBtnText, { marginLeft: 8 }]}>Authenticating...</Text>
                  </View>
                ) : (
                  <Text style={styles.signInBtnText}>
                    {accountType === 'company' ? 'Sign In' : 'Sign In'}
                  </Text>
                )}
              </Pressable>

              {/* Create Account Prompt */}
              <View style={styles.signUpPromptWrap}>
                <Text style={styles.signUpPromptText}>{"Don't have an account?"}</Text>
                <Pressable
                  onPress={() => router.push('/register')}
                  accessibilityRole="link"
                  accessibilityLabel="Create Account"
                >
                  <Text style={styles.signUpLinkText}> Create Account</Text>
                </Pressable>
              </View>
            </View>

            {/* Zero-Trust Security Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerShield}>🔒</Text>
              <Text style={styles.footerText}>
                Protected by Vanguard Continuous Zero-Trust Verification
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  shieldBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.4)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  shieldIcon: {
    fontSize: 28,
  },
  brandTitle: {
    color: CyberColors.cyan,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },
  brandSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 2,
  },
  heroText: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    marginTop: 6,
    textAlign: 'center',
  },
  serverBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(0, 229, 255, 0.2)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  serverInfoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  serverIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  serverDetailsWrap: {
    flex: 1,
  },
  serverLabel: {
    color: CyberColors.cyan,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  serverUrlText: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  serverToggleBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: CyberColors.cyan,
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    cursor: 'pointer' as any,
  },
  serverToggleBtnText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '800',
  },
  card: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.lg,
    padding: 20,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 4,
    marginBottom: 18,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CyberRadius.sm,
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: CyberColors.cyan,
    borderWidth: 1,
  },
  segmentText: {
    color: CyberColors.textMuted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: CyberColors.cyan,
    fontWeight: '800',
  },
  modeDescriptionWrap: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: CyberColors.textSecondary,
    lineHeight: 17,
  },
  quickTestBox: {
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 10,
    marginBottom: 14,
  },
  quickTestTitle: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  quickTestChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  quickTestChip: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTestChipText: {
    color: CyberColors.textPrimary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  quickTestHint: {
    color: CyberColors.textMuted,
    fontSize: 10.5,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12.5,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: CyberColors.textPrimary,
    fontSize: 14,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 6,
    cursor: 'pointer' as any,
  },
  eyeIcon: {
    fontSize: 16,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 2,
    cursor: 'pointer' as any,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: CyberColors.cyan,
    borderColor: CyberColors.cyan,
  },
  checkmark: {
    color: CyberColors.textDark,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  rememberText: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
  },
  signInBtn: {
    backgroundColor: CyberColors.cyan,
    borderRadius: CyberRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
    cursor: 'pointer' as any,
  },
  signInBtnPressed: {
    opacity: 0.85,
  },
  signInBtnDisabled: {
    opacity: 0.6,
  },
  signInBtnText: {
    color: CyberColors.textDark,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpPromptWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  signUpPromptText: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
  },
  signUpLinkText: {
    color: CyberColors.cyan,
    fontSize: 12.5,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 28,
  },
  footerShield: {
    fontSize: 12,
  },
  footerText: {
    color: CyberColors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
