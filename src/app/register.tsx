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
  BackHandler,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '@/context/auth-context';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { GoogleAccountPickerModal } from '@/components/cyber/google-account-picker-modal';
import { GoogleLogo } from '@/components/cyber/google-logo';
import type { GoogleAccountProfile } from '@/services/auth.service';
import {
  REGISTRATION_PAGES,
  type RegistrationPageKey,
  type RegistrationDraft,
  validateRegistrationPage,
  getNextRegistrationPage,
  getPrevRegistrationPage,
  evaluatePasswordRules,
} from '@/utils/registration-wizard';

export default function RegisterScreen() {
  const { signup, loginWithGoogle } = useAuth();

  const [currentPage, setCurrentPage] =
    useState<RegistrationPageKey>('identity');
  const [accountType, setAccountType] =
    useState<'individual' | 'company'>('individual');
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
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const draft: RegistrationDraft = {
    accountType,
    firstName,
    lastName,
    companyName,
    email,
    phone,
    password,
    confirmPassword,
    agreeTerms,
  };

  const currentPageMeta =
    REGISTRATION_PAGES.find((p) => p.key === currentPage) ||
    REGISTRATION_PAGES[0];
  const passwordRules = evaluatePasswordRules(password);

  // Support Android hardware back button across wizard pages
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const prev = getPrevRegistrationPage(currentPage);
      if (prev) {
        setErrorMessage(null);
        setCurrentPage(prev);
        return true;
      }
      return false;
    });

    return () => {
      subscription.remove();
    };
  }, [currentPage]);

  const handleNextPage = () => {
    const validationErr = validateRegistrationPage(currentPage, draft);
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    const nextPage = getNextRegistrationPage(currentPage);
    if (nextPage) {
      setErrorMessage(null);
      setCurrentPage(nextPage);
    }
  };

  const handlePrevPage = () => {
    const prevPage = getPrevRegistrationPage(currentPage);
    if (prevPage) {
      setErrorMessage(null);
      setCurrentPage(prevPage);
    }
  };

  const handleSelectStepTab = (targetKey: RegistrationPageKey) => {
    const targetIndex = REGISTRATION_PAGES.findIndex((p) => p.key === targetKey);
    const currentIndex = REGISTRATION_PAGES.findIndex(
      (p) => p.key === currentPage
    );

    if (targetIndex <= currentIndex) {
      setErrorMessage(null);
      setCurrentPage(targetKey);
      return;
    }

    // Validate intermediate pages before jumping forward
    for (let i = currentIndex; i < targetIndex; i++) {
      const err = validateRegistrationPage(REGISTRATION_PAGES[i].key, draft);
      if (err) {
        setErrorMessage(err);
        return;
      }
    }

    setErrorMessage(null);
    setCurrentPage(targetKey);
  };

  const handleGoogleAccountSelected = async (account: GoogleAccountProfile) => {
    setErrorMessage(null);
    await loginWithGoogle({
      ...account,
      accountType: account.accountType || accountType,
      companyName:
        accountType === 'company'
          ? companyName.trim() || account.companyName
          : account.companyName,
    });
    setShowGoogleModal(false);
    router.replace('/');
  };

  const handleRegister = async () => {
    for (const page of REGISTRATION_PAGES) {
      const err = validateRegistrationPage(page.key, draft);
      if (err) {
        setCurrentPage(page.key);
        setErrorMessage(err);
        return;
      }
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const result = await signup({
        email: cleanEmail,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName:
          accountType === 'company' ? companyName.trim() : undefined,
        phone: phone.trim() || undefined,
        accountType,
      });

      setSuccessMessage(
        result.message || 'Account created! Enter your verification code.'
      );

      setTimeout(() => {
        router.push({
          pathname: '/verify-otp',
          params: { email: cleanEmail, mode: 'signup' },
        });
      }, 600);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.';
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

            {/* Multi-Page Registration Card */}
            <View style={styles.card}>
              {/* Page Step Indicator */}
              <View style={styles.stepperHeader}>
                <Text style={styles.pageCounterBadge}>
                  PAGE {currentPageMeta.stepNumber} OF {REGISTRATION_PAGES.length}
                </Text>
                <View style={styles.stepTabsRow}>
                  {REGISTRATION_PAGES.map((step) => {
                    const isActive = step.key === currentPage;
                    const isCompleted =
                      step.stepNumber < currentPageMeta.stepNumber;
                    return (
                      <Pressable
                        key={step.key}
                        style={[
                          styles.stepTab,
                          isActive && styles.stepTabActive,
                          isCompleted && styles.stepTabCompleted,
                        ]}
                        onPress={() => handleSelectStepTab(step.key)}
                        testID={`register-page-tab-${step.key}`}
                      >
                        <View
                          style={[
                            styles.stepNumberCircle,
                            isActive && styles.stepNumberCircleActive,
                            isCompleted && styles.stepNumberCircleCompleted,
                          ]}
                        >
                          <Text
                            style={[
                              styles.stepNumberText,
                              (isActive || isCompleted) &&
                                styles.stepNumberTextActive,
                            ]}
                          >
                            {isCompleted ? '✓' : step.stepNumber}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.stepTabLabel,
                            isActive && styles.stepTabLabelActive,
                          ]}
                        >
                          {step.shortLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Text style={styles.cardTitle}>{currentPageMeta.title}</Text>
              <Text style={styles.cardSubtitle}>{currentPageMeta.subtitle}</Text>

              {/* Error Banner */}
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Success Banner */}
              {successMessage ? (
                <View style={styles.successBanner}>
                  <Text style={styles.successIcon}>✓</Text>
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              ) : null}

              {/* PAGE 1: ACCOUNT TYPE & IDENTITY */}
              {currentPage === 'identity' ? (
                <View testID="register-page-identity">
                  {/* Quick Sign Up with Google */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.googleBtn,
                      pressed && styles.googleBtnPressed,
                    ]}
                    onPress={() => {
                      setErrorMessage(null);
                      setShowGoogleModal(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Sign up with Google"
                    testID="google-sign-up-button"
                  >
                    <View style={styles.googleIconCircle}>
                      <GoogleLogo size={16} />
                    </View>
                    <Text style={styles.googleBtnText}>
                      Sign up with Google
                    </Text>
                  </Pressable>

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR CREATE MANUALLY</Text>
                    <View style={styles.dividerLine} />
                  </View>

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
                      accessibilityState={{
                        selected: accountType === 'individual',
                      }}
                      accessibilityLabel="Individual Personal Account"
                    >
                      <View style={styles.typeIconBadge}>
                        <Text style={styles.typeIconText}>👤</Text>
                      </View>
                      <View style={styles.typeInfo}>
                        <Text
                          style={[
                            styles.typeName,
                            accountType === 'individual' &&
                              styles.typeNameActive,
                          ]}
                        >
                          Personal
                        </Text>
                        <Text style={styles.typeDesc}>
                          Personal Vault, TOTP keys & self-managed apps
                        </Text>
                      </View>
                      {accountType === 'individual' ? (
                        <Text style={styles.checkIndicator}>✓</Text>
                      ) : null}
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
                      accessibilityState={{
                        selected: accountType === 'company',
                      }}
                      accessibilityLabel="Company Organization Account"
                    >
                      <View style={styles.typeIconBadge}>
                        <Text style={styles.typeIconText}>🏢</Text>
                      </View>
                      <View style={styles.typeInfo}>
                        <Text
                          style={[
                            styles.typeName,
                            accountType === 'company' && styles.typeNameActive,
                          ]}
                        >
                          Company Org
                        </Text>
                        <Text style={styles.typeDesc}>
                          Enterprise directory, employee SSO & IT governance
                        </Text>
                      </View>
                      {accountType === 'company' ? (
                        <Text style={styles.checkIndicator}>✓</Text>
                      ) : null}
                    </Pressable>
                  </View>

                  {/* First & Last Name */}
                  <View style={styles.rowTwoCol}>
                    <View style={[styles.fieldWrap, styles.colHalf]}>
                      <Text style={styles.fieldLabel}>FIRST NAME *</Text>
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
                        testID="register-first-name-input"
                      />
                    </View>

                    <View style={[styles.fieldWrap, styles.colHalf]}>
                      <Text style={styles.fieldLabel}>LAST NAME *</Text>
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
                        testID="register-last-name-input"
                      />
                    </View>
                  </View>

                  {/* Company Name (Company Mode Only) */}
                  {accountType === 'company' ? (
                    <View style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>
                        COMPANY / ORGANIZATION NAME *
                      </Text>
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
                        testID="register-company-name-input"
                      />
                    </View>
                  ) : null}

                  <Pressable
                    style={({ pressed }) => [
                      styles.submitBtn,
                      pressed && styles.submitBtnPressed,
                    ]}
                    onPress={handleNextPage}
                    accessibilityRole="button"
                    accessibilityLabel="Next Page: Contact Details"
                    testID="register-next-to-contact-button"
                  >
                    <Text style={styles.submitBtnText}>
                      Next: Contact Details →
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {/* PAGE 2: CONTACT & RECOVERY */}
              {currentPage === 'contact' ? (
                <View testID="register-page-contact">
                  <View style={styles.summaryPill}>
                    <Text style={styles.summaryPillText}>
                      {accountType === 'company' ? '🏢' : '👤'}{' '}
                      {firstName.trim()} {lastName.trim()}
                      {accountType === 'company' && companyName.trim()
                        ? ` • ${companyName.trim()}`
                        : ' • Personal Vault'}
                    </Text>
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>
                      {accountType === 'company'
                        ? 'WORK EMAIL ADDRESS *'
                        : 'PERSONAL EMAIL ADDRESS *'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder={
                        accountType === 'company'
                          ? 'admin@company.com'
                          : 'you@example.com'
                      }
                      placeholderTextColor={CyberColors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      testID="register-email-input"
                    />
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>
                      {accountType === 'company'
                        ? 'PHONE NUMBER (MFA / IDENTITY) *'
                        : 'PHONE NUMBER (OPTIONAL)'}
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
                      testID="register-phone-input"
                    />
                  </View>

                  <View style={styles.wizardNavRow}>
                    <Pressable
                      style={styles.secondaryNavBtn}
                      onPress={handlePrevPage}
                      accessibilityRole="button"
                      accessibilityLabel="Back to Identity Page"
                      testID="register-back-to-identity-button"
                    >
                      <Text style={styles.secondaryNavBtnText}>← Back</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.submitBtn,
                        styles.wizardPrimaryBtn,
                        pressed && styles.submitBtnPressed,
                      ]}
                      onPress={handleNextPage}
                      accessibilityRole="button"
                      accessibilityLabel="Next Page: Security Setup"
                      testID="register-next-to-security-button"
                    >
                      <Text style={styles.submitBtnText}>
                        Next: Security →
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {/* PAGE 3: MASTER PASSWORD & POLICY */}
              {currentPage === 'security' ? (
                <View testID="register-page-security">
                  <View style={styles.summaryPill}>
                    <Text style={styles.summaryPillText}>
                      {accountType === 'company' ? '🏢' : '👤'}{' '}
                      {firstName.trim()} {lastName.trim()} •{' '}
                      {email.trim().toLowerCase()}
                    </Text>
                  </View>

                  {/* Master Password */}
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>MASTER PASSWORD *</Text>
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
                        testID="register-password-input"
                      />
                      <Pressable
                        style={styles.eyeBtn}
                        onPress={() => setShowPassword(!showPassword)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                      >
                        <Text style={styles.eyeIcon}>
                          {showPassword ? '👁️' : '🔒'}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Password checklist */}
                    <View style={styles.rulesGrid}>
                      <Text
                        style={[
                          styles.ruleItem,
                          passwordRules.hasMinLength && styles.ruleItemMet,
                        ]}
                      >
                        {passwordRules.hasMinLength ? '✓' : '○'} 8+ chars
                      </Text>
                      <Text
                        style={[
                          styles.ruleItem,
                          passwordRules.hasUpper && styles.ruleItemMet,
                        ]}
                      >
                        {passwordRules.hasUpper ? '✓' : '○'} Uppercase
                      </Text>
                      <Text
                        style={[
                          styles.ruleItem,
                          passwordRules.hasLower && styles.ruleItemMet,
                        ]}
                      >
                        {passwordRules.hasLower ? '✓' : '○'} Lowercase
                      </Text>
                      <Text
                        style={[
                          styles.ruleItem,
                          passwordRules.hasSpecial && styles.ruleItemMet,
                        ]}
                      >
                        {passwordRules.hasSpecial ? '✓' : '○'} Symbol
                      </Text>
                    </View>
                  </View>

                  {/* Confirm Password */}
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>CONFIRM PASSWORD *</Text>
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
                      testID="register-confirm-password-input"
                    />
                  </View>

                  {/* Terms Agreement Checkbox */}
                  <Pressable
                    style={styles.termsWrap}
                    onPress={() => {
                      setAgreeTerms(!agreeTerms);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: agreeTerms }}
                    testID="register-agree-terms-checkbox"
                  >
                    <View
                      style={[
                        styles.checkbox,
                        agreeTerms && styles.checkboxChecked,
                      ]}
                    >
                      {agreeTerms ? (
                        <Text style={styles.checkboxCheck}>✓</Text>
                      ) : null}
                    </View>
                    <Text style={styles.termsText}>
                      I agree to the Vanguard{' '}
                      <Text style={styles.termsHighlight}>
                        Terms of Service
                      </Text>{' '}
                      and{' '}
                      <Text style={styles.termsHighlight}>Privacy Policy</Text>.
                    </Text>
                  </Pressable>

                  <View style={styles.wizardNavRow}>
                    <Pressable
                      style={styles.secondaryNavBtn}
                      onPress={handlePrevPage}
                      disabled={submitting}
                      accessibilityRole="button"
                      accessibilityLabel="Back to Contact Page"
                      testID="register-back-to-contact-button"
                    >
                      <Text style={styles.secondaryNavBtnText}>← Back</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.submitBtn,
                        styles.wizardPrimaryBtn,
                        pressed && styles.submitBtnPressed,
                        submitting && styles.submitBtnDisabled,
                      ]}
                      onPress={handleRegister}
                      disabled={submitting}
                      accessibilityRole="button"
                      accessibilityLabel="Create Account"
                      testID="register-submit-button"
                    >
                      {submitting ? (
                        <ActivityIndicator
                          size="small"
                          color={CyberColors.textDark}
                        />
                      ) : (
                        <Text style={styles.submitBtnText}>
                          {accountType === 'company'
                            ? 'Register Company'
                            : 'Create Account'}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {/* Sign In Navigation Prompt */}
              <View style={styles.signInPromptWrap}>
                <Text style={styles.signInPromptText}>
                  Already have an account?
                </Text>
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

      <GoogleAccountPickerModal
        visible={showGoogleModal}
        onClose={() => setShowGoogleModal(false)}
        onSelectAccount={handleGoogleAccountSelected}
        title="Sign up with Google"
      />
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
    marginBottom: 16,
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
  },
  shieldIcon: {
    fontSize: 26,
  },
  brandTitle: {
    color: CyberColors.cyan,
    fontSize: 21,
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
    fontSize: 12.5,
    marginTop: 5,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.lg,
    padding: 20,
  },
  stepperHeader: {
    marginBottom: 14,
  },
  pageCounterBadge: {
    color: CyberColors.cyan,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  stepTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stepTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: CyberRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  stepTabActive: {
    borderColor: CyberColors.cyan,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  stepTabCompleted: {
    borderColor: 'rgba(0, 255, 136, 0.4)',
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
  },
  stepNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CyberColors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberCircleActive: {
    borderColor: CyberColors.cyan,
    backgroundColor: CyberColors.cyan,
  },
  stepNumberCircleCompleted: {
    borderColor: CyberColors.green,
    backgroundColor: CyberColors.green,
  },
  stepNumberText: {
    color: CyberColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  stepNumberTextActive: {
    color: CyberColors.textDark,
  },
  stepTabLabel: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  stepTabLabelActive: {
    color: CyberColors.cyan,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: CyberColors.textSecondary,
    lineHeight: 17,
    marginBottom: 14,
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
    fontSize: 13.5,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  dividerText: {
    color: CyberColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  typeSelectorRow: {
    gap: 10,
    marginBottom: 16,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
    gap: 12,
  },
  typeCardActive: {
    borderColor: CyberColors.cyan,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  typeCardPressed: {
    opacity: 0.9,
  },
  typeIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconText: {
    fontSize: 18,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    color: CyberColors.textPrimary,
    fontSize: 13.5,
    fontWeight: '800',
  },
  typeNameActive: {
    color: CyberColors.cyan,
  },
  typeDesc: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    marginTop: 2,
  },
  checkIndicator: {
    color: CyberColors.cyan,
    fontSize: 16,
    fontWeight: '900',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorIcon: {
    fontSize: 14,
  },
  errorText: {
    flex: 1,
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
    borderColor: 'rgba(0, 255, 136, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 8,
  },
  successIcon: {
    color: CyberColors.green,
    fontSize: 14,
    fontWeight: '900',
  },
  successText: {
    flex: 1,
    color: CyberColors.green,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryPill: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  summaryPillText: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  rowTwoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  colHalf: {
    flex: 1,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: CyberColors.textPrimary,
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
  rulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  ruleItem: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  ruleItemMet: {
    color: CyberColors.green,
  },
  termsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 10,
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
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: CyberColors.cyan,
    borderColor: CyberColors.cyan,
  },
  checkboxCheck: {
    color: CyberColors.textDark,
    fontSize: 12,
    fontWeight: '900',
  },
  termsText: {
    flex: 1,
    color: CyberColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  termsHighlight: {
    color: CyberColors.cyan,
    fontWeight: '700',
  },
  wizardNavRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryNavBtn: {
    borderColor: 'rgba(148, 163, 184, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryNavBtnText: {
    color: CyberColors.textSecondary,
    fontSize: 13.5,
    fontWeight: '700',
  },
  wizardPrimaryBtn: {
    flex: 1,
    marginTop: 0,
  },
  submitBtn: {
    backgroundColor: CyberColors.cyan,
    borderRadius: CyberRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnPressed: {
    opacity: 0.85,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: CyberColors.textDark,
    fontSize: 14,
    fontWeight: '800',
  },
  signInPromptWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
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
