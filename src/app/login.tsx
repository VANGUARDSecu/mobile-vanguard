import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import * as Linking from 'expo-linking';

import { useAuth } from '@/context/auth-context';
import { useOptionalGuide } from '@/context/guide-context';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { launchGoogleBrowserOAuthSession } from '@/components/cyber/google-account-picker-modal';
import { GoogleLogo } from '@/components/cyber/google-logo';
import type { MfaChallengeResponse } from '@/models/auth.models';
import type { GoogleAccountProfile } from '@/services/auth.service';
import {
  extractGoogleOAuthCallbackError,
  parseGoogleOAuthCallbackUrl,
} from '@/utils/registration-wizard';
import VerifyOtpScreen from '@/screens/verify-otp-screen';

const REMEMBERED_EMAIL_KEY = 'vanguard_remembered_email';

export default function LoginScreen() {
  const { login, loginWithGoogle } = useAuth();
  const guide = useOptionalGuide();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallengeResponse | null>(null);
  const isBrowserOAuthActiveRef = useRef(false);
  const handledAccessTokenRef = useRef<string | null>(null);

  // Load remembered credentials preference on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(REMEMBERED_EMAIL_KEY);
        if (isMounted && savedEmail) {
          setEmail(savedEmail);
          setRememberEmail(true);
        }
      } catch {
        // Non-blocking preference retrieval
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleGoogleOAuthVerified = useCallback(
    async (account: GoogleAccountProfile) => {
      if (account.accessToken && handledAccessTokenRef.current === account.accessToken) {
        return;
      }
      handledAccessTokenRef.current = account.accessToken || null;
      setSubmitting(true);
      setErrorMessage(null);
      try {
        const result = await loginWithGoogle(account);
        if (result.requireMfa) {
          setMfaChallenge(result.mfaChallenge);
        } else {
          router.replace('/');
        }
      } catch (err: unknown) {
        handledAccessTokenRef.current = null;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Google OAuth sign-in failed. Please try again.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [loginWithGoogle]
  );

  const handleGoogleBrowserSignIn = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    isBrowserOAuthActiveRef.current = true;
    try {
      const oauthAccount = await launchGoogleBrowserOAuthSession();
      if (oauthAccount) {
        await handleGoogleOAuthVerified(oauthAccount);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not complete Google Browser OAuth.'
      );
    } finally {
      isBrowserOAuthActiveRef.current = false;
      setSubmitting(false);
    }
  };

  // Listen for OAuth deep-link callback URLs (#access_token=...) returning from system browser
  useEffect(() => {
    let isMounted = true;

    const handleIncomingUrl = (url: string | null) => {
      if (!isMounted || isBrowserOAuthActiveRef.current || !url) return;
      const oauthError = extractGoogleOAuthCallbackError(url);
      if (oauthError) {
        setErrorMessage(oauthError);
        return;
      }
      if (!url.includes('access_token=')) return;
      const parsed = parseGoogleOAuthCallbackUrl(url);
      if (parsed) {
        void handleGoogleOAuthVerified(parsed);
      }
    };

    Linking.getInitialURL()
      .then((initialUrl) => handleIncomingUrl(initialUrl))
      .catch(() => {});

    const sub = Linking.addEventListener('url', (event) => {
      handleIncomingUrl(event.url);
    });

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, [handleGoogleOAuthVerified]);

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
            {guide ? (
              <View style={styles.guideHeaderRow}>
                <Pressable
                  onPress={() => guide.openFromLogin('company-admin')}
                  style={({ pressed }) => [
                    styles.guideTriggerBtn,
                    pressed && styles.guideTriggerBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Open Quick Start Guide"
                  testID="login-guide-btn"
                >
                  <Text style={styles.guideTriggerText}>? Guide</Text>
                </Pressable>
              </View>
            ) : null}

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

            {/* Login Card */}
            <View style={styles.card}>
              <View style={styles.modeDescriptionWrap}>
                <Text style={styles.cardTitle}>Sign In to Vanguard</Text>
                <Text style={styles.cardSubtitle}>
                  Enter your credentials to access your workplace portal or personal encrypted vault.
                </Text>
              </View>

              {/* Error Alert */}
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="name@company.com or personal@domain.com"
                  placeholderTextColor={CyberColors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
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
                  <Text style={styles.signInBtnText}>Sign In</Text>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Sign In with Google Browser OAuth Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.googleBtn,
                  pressed && styles.googleBtnPressed,
                  submitting && styles.signInBtnDisabled,
                ]}
                onPress={handleGoogleBrowserSignIn}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google"
                testID="google-sign-in-button"
              >
                <View style={styles.googleIconCircle}>
                  <GoogleLogo size={16} />
                </View>
                <Text style={styles.googleBtnText}>Sign in with Google</Text>
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
  guideHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  guideTriggerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: CyberRadius.full,
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyanMuted,
    borderWidth: 1,
    cursor: 'pointer' as any,
  },
  guideTriggerBtnPressed: {
    backgroundColor: 'rgba(0, 229, 255, 0.28)',
  },
  guideTriggerText: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '800',
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
    marginBottom: 16,
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
    marginBottom: 16,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  dividerText: {
    color: CyberColors.textMuted,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
  },
  googleBtnPressed: {
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    borderColor: '#4285F4',
  },
  googleIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconG: {
    color: '#4285F4',
    fontSize: 13,
    fontWeight: '900',
  },
  googleBtnText: {
    color: CyberColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
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
