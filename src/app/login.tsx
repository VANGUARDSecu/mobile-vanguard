import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '@/context/auth-context';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import type { MfaChallengeResponse } from '@/models/auth.models';
import VerifyOtpScreen from '@/screens/verify-otp-screen';

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallengeResponse | null>(null);

  const handleSignIn = async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await login({ email: email.trim(), password: password.trim() });
      if (result.requireMfa) {
        setMfaChallenge(result.mfaChallenge);
      } else {
        router.replace('/');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.';
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
                Zero-Trust Mobile Access & Single Sign-On Portal
              </Text>
            </View>

            {/* Login Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sign In to Your Account</Text>
              <Text style={styles.cardSubtitle}>
                Access your zero-trust SaaS apps and active SSO integrations
              </Text>

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
                  placeholder="name@company.com"
                  placeholderTextColor={CyberColors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Master Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Enter password"
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
                  <ActivityIndicator size="small" color={CyberColors.textDark} />
                ) : (
                  <Text style={styles.signInBtnText}>Sign In</Text>
                )}
              </Pressable>

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
    marginBottom: 24,
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
    marginTop: 8,
    textAlign: 'center',
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
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: CyberColors.textSecondary,
    lineHeight: 17,
    marginBottom: 18,
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
    padding: 4,
    cursor: 'pointer' as any,
  },
  eyeIcon: {
    fontSize: 16,
  },
  signInBtn: {
    backgroundColor: CyberColors.cyan,
    borderRadius: CyberRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
