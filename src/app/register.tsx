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

export default function RegisterScreen() {
  const { signup } = useAuth();

  const [accountType, setAccountType] = useState<'individual' | 'company'>('individual');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!firstName.trim()) return 'Please enter your first name.';
    if (!lastName.trim()) return 'Please enter your last name.';
    if (accountType === 'company' && !companyName.trim()) {
      return 'Please enter your company or organization name.';
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return 'Please enter a valid email address.';
    }
    if (accountType === 'company' && !phone.trim()) {
      return 'Please enter a company contact phone number.';
    }
    if (!password || password.length < 6) {
      return 'Password must be at least 6 characters long.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match. Please verify both fields.';
    }
    if (!agreeTerms) {
      return 'Please accept the Terms of Service and Privacy Policy to continue.';
    }
    return null;
  };

  const handleRegister = async () => {
    const error = validate();
    if (error) {
      setErrorMessage(error);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await signup({
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: accountType === 'company' ? companyName.trim() : undefined,
        phone: phone.trim() || undefined,
        accountType,
      });

      setSuccessMessage(result.message || 'Account created! Enter your verification code.');

      setTimeout(() => {
        router.push({
          pathname: '/verify-otp',
          params: { email: email.trim().toLowerCase(), mode: 'signup' },
        });
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
                Create Your Zero-Trust Account
              </Text>
            </View>

            {/* Registration Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Choose Account Type</Text>
              <Text style={styles.cardSubtitle}>
                Select whether you are setting up a Personal Vault or Company Directory
              </Text>

              {/* Account Type Selector Cards */}
              <View style={styles.typeSelectorRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.typeCard,
                    accountType === 'individual' && styles.typeCardActive,
                    pressed && styles.typeCardPressed,
                  ]}
                  onPress={() => {
                    setAccountType('individual');
                    setErrorMessage(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: accountType === 'individual' }}
                  accessibilityLabel="Individual Personal Account"
                >
                  <View style={styles.typeIconBadge}>
                    <Text style={styles.typeIconText}>👤</Text>
                  </View>
                  <View style={styles.typeInfo}>
                    <Text style={[styles.typeName, accountType === 'individual' && styles.typeNameActive]}>
                      Personal
                    </Text>
                    <Text style={styles.typeDesc}>
                      Personal Vault, TOTP keys & self-managed apps
                    </Text>
                  </View>
                  {accountType === 'individual' && (
                    <Text style={styles.checkIndicator}>✓</Text>
                  )}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.typeCard,
                    accountType === 'company' && styles.typeCardActive,
                    pressed && styles.typeCardPressed,
                  ]}
                  onPress={() => {
                    setAccountType('company');
                    setErrorMessage(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: accountType === 'company' }}
                  accessibilityLabel="Company Organization Account"
                >
                  <View style={styles.typeIconBadge}>
                    <Text style={styles.typeIconText}>🏢</Text>
                  </View>
                  <View style={styles.typeInfo}>
                    <Text style={[styles.typeName, accountType === 'company' && styles.typeNameActive]}>
                      Company Org
                    </Text>
                    <Text style={styles.typeDesc}>
                      Enterprise directory, employee SSO & IT governance
                    </Text>
                  </View>
                  {accountType === 'company' && (
                    <Text style={styles.checkIndicator}>✓</Text>
                  )}
                </Pressable>
              </View>

              {/* Error Banner */}
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Success Banner */}
              {successMessage && (
                <View style={styles.successBanner}>
                  <Text style={styles.successIcon}>✓</Text>
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              )}

              {/* Name Fields */}
              <View style={styles.rowTwoCol}>
                <View style={[styles.fieldWrap, styles.colHalf]}>
                  <Text style={styles.fieldLabel}>FIRST NAME</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={(t) => {
                      setFirstName(t);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. John"
                    placeholderTextColor={CyberColors.textMuted}
                    autoCapitalize="words"
                  />
                </View>

                <View style={[styles.fieldWrap, styles.colHalf]}>
                  <Text style={styles.fieldLabel}>LAST NAME</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={(t) => {
                      setLastName(t);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. Doe"
                    placeholderTextColor={CyberColors.textMuted}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Company Name (Company Mode Only) */}
              {accountType === 'company' && (
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>COMPANY / ORGANIZATION NAME</Text>
                  <TextInput
                    style={styles.input}
                    value={companyName}
                    onChangeText={(t) => {
                      setCompanyName(t);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. Acme Security Corp"
                    placeholderTextColor={CyberColors.textMuted}
                    autoCapitalize="words"
                  />
                </View>
              )}

              {/* Email Address */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>
                  {accountType === 'company' ? 'WORK EMAIL ADDRESS' : 'PERSONAL EMAIL ADDRESS'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={accountType === 'company' ? 'admin@company.com' : 'you@example.com'}
                  placeholderTextColor={CyberColors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              {/* Phone Number */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>
                  {accountType === 'company' ? 'PHONE NUMBER (MFA / IDENTITY)' : 'PHONE NUMBER (OPTIONAL)'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={CyberColors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Master Password */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>MASTER PASSWORD</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Minimum 6 characters"
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

              {/* Confirm Password */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Re-enter master password"
                  placeholderTextColor={CyberColors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>

              {/* Terms Agreement Checkbox */}
              <Pressable
                style={styles.termsWrap}
                onPress={() => setAgreeTerms(!agreeTerms)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreeTerms }}
              >
                <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                  {agreeTerms && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <Text style={styles.termsText}>
                  I agree to the Vanguard <Text style={styles.termsHighlight}>Terms of Service</Text> and{' '}
                  <Text style={styles.termsHighlight}>Privacy Policy</Text>.
                </Text>
              </Pressable>

              {/* Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && styles.submitBtnPressed,
                  submitting && styles.submitBtnDisabled,
                ]}
                onPress={handleRegister}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Create Account"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={CyberColors.textDark} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {accountType === 'company' ? 'Register Company Account' : 'Create Personal Account'}
                  </Text>
                )}
              </Pressable>

              {/* Sign In Navigation Prompt */}
              <View style={styles.signInPromptWrap}>
                <Text style={styles.signInPromptText}>Already have an account?</Text>
                <Pressable
                  onPress={() => router.replace('/login')}
                  accessibilityRole="link"
                  accessibilityLabel="Sign In"
                >
                  <Text style={styles.signInLinkText}> Sign In</Text>
                </Pressable>
              </View>
            </View>

            {/* Zero-Trust Security Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerShield}>🔒</Text>
              <Text style={styles.footerText}>
                Continuous Zero-Trust Encryption & Biometric Attestation
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.4)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  shieldIcon: {
    fontSize: 26,
  },
  brandTitle: {
    color: CyberColors.cyan,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },
  brandSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 2,
  },
  heroText: {
    color: CyberColors.textSecondary,
    fontSize: 13,
    marginTop: 6,
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
    fontSize: 18,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: CyberColors.textSecondary,
    lineHeight: 16,
    marginBottom: 16,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderColor: 'rgba(100, 116, 139, 0.4)',
    borderWidth: 1.5,
    borderRadius: CyberRadius.md,
    padding: 10,
    alignItems: 'center',
    position: 'relative',
  },
  typeCardActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderColor: CyberColors.cyan,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  typeCardPressed: {
    opacity: 0.85,
  },
  typeIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  typeIconText: {
    fontSize: 18,
  },
  typeInfo: {
    alignItems: 'center',
  },
  typeName: {
    fontSize: 13,
    fontWeight: '800',
    color: CyberColors.textSecondary,
    marginBottom: 2,
  },
  typeNameActive: {
    color: CyberColors.cyan,
  },
  typeDesc: {
    fontSize: 9.5,
    color: CyberColors.textMuted,
    textAlign: 'center',
    lineHeight: 12,
  },
  checkIndicator: {
    position: 'absolute',
    top: 6,
    right: 8,
    color: CyberColors.cyan,
    fontWeight: '900',
    fontSize: 12,
  },
  rowTwoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  colHalf: {
    flex: 1,
  },
  fieldWrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: CyberColors.textSecondary,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#1e293b',
    borderColor: 'rgba(100, 116, 139, 0.5)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    color: CyberColors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
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
  },
  eyeIcon: {
    fontSize: 16,
  },
  termsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: CyberColors.textSecondary,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: CyberColors.cyan,
    borderColor: CyberColors.cyan,
  },
  checkboxCheck: {
    color: '#0a0e17',
    fontSize: 12,
    fontWeight: '900',
  },
  termsText: {
    flex: 1,
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
  },
  termsHighlight: {
    color: CyberColors.cyan,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: CyberColors.cyan,
    borderRadius: CyberRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#0a0e17',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  signInPromptWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signInPromptText: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
  },
  signInLinkText: {
    color: CyberColors.cyan,
    fontSize: 12.5,
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorIcon: {
    fontSize: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  successIcon: {
    color: '#10b981',
    fontWeight: '900',
    fontSize: 14,
  },
  successText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  footerShield: {
    fontSize: 12,
  },
  footerText: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
});
