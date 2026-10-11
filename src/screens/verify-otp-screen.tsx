import React, { useState, useEffect, useRef } from 'react';
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

export interface VerifyOtpScreenProps {
  email?: string;
  hasTotp?: boolean;
  onSuccess?: () => void;
  onBack?: () => void;
}

export default function VerifyOtpScreen({
  email: initialEmail = '',
  hasTotp: initialHasTotp = false,
  onSuccess,
  onBack,
}: VerifyOtpScreenProps) {
  const { verifyOtp, verifyTotp, resendOtp, isLoading } = useAuth();

  const [email] = useState<string>(initialEmail || 'ellen.ripley@weyland.corp');
  const [method, setMethod] = useState<'email_otp' | 'totp'>(initialHasTotp ? 'totp' : 'email_otp');
  const [hasTotp] = useState<boolean>(initialHasTotp);

  // Dynamic code length: 6 digits for TOTP/SSO, 8 digits for direct Email OTP (also accepts 6 digits)
  const codeLength = method === 'totp' ? 6 : 8;
  const [digits, setDigits] = useState<string[]>(new Array(codeLength).fill(''));

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number>(45);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleSwitchMethod = (newMethod: 'email_otp' | 'totp') => {
    setMethod(newMethod);
    setDigits(new Array(newMethod === 'totp' ? 6 : 8).fill(''));
    setErrorMessage(null);
  };

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleDigitChange = (val: string, index: number) => {
    // Handle paste or multi-digit input
    const cleanDigits = val.replace(/\D/g, '');
    if (cleanDigits.length > 1) {
      const newDigits = [...digits];
      for (let i = 0; i < cleanDigits.length && index + i < codeLength; i++) {
        newDigits[index + i] = cleanDigits[i];
      }
      setDigits(newDigits);
      const nextIdx = Math.min(index + cleanDigits.length, codeLength - 1);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanDigits.slice(-1);
    setDigits(newDigits);
    setErrorMessage(null);

    // Auto-advance to next input
    if (cleanDigits && index < codeLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < 6) {
      setErrorMessage(`Please enter the complete verification code.`);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (method === 'totp') {
        await verifyTotp({ email, code });
      } else {
        await verifyOtp({ email, token: code, type: 'email' });
      }

      setSuccessMessage('Identity verified! Access authorized.');
      if (onSuccess) {
        onSuccess();
      } else {
        router.replace('/');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Verification failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await resendOtp({ email, type: 'email' });
      setCountdown(res.cooldown || 45);
      setSuccessMessage(res.message);
      setDigits(new Array(codeLength).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend code.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const fillQuickTestCode = (code: string) => {
    const chars = code.split('');
    const newDigits = new Array(codeLength).fill('');
    for (let i = 0; i < chars.length && i < codeLength; i++) {
      newDigits[i] = chars[i];
    }
    setDigits(newDigits);
    setErrorMessage(null);
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
            </View>

            {/* Verification Card */}
            <View style={styles.card}>
              <View style={styles.badgeWrapper}>
                <Text style={styles.cardBadgeIcon}>{method === 'totp' ? '📱' : '🔒'}</Text>
              </View>

              <Text style={styles.cardTitle}>
                {method === 'totp' ? 'Authenticator 2-Step Verification' : '2-Step Verification'}
              </Text>

              <Text style={styles.cardSubtitle}>
                {method === 'totp'
                  ? 'Enter the 6-digit dynamic code from Google Authenticator, JumpCloud Protect, or Microsoft Authenticator.'
                  : `Enter the verification code sent to `}
                {method !== 'totp' && <Text style={styles.highlightEmail}>{email}</Text>}
              </Text>

              {/* Status & Error Alerts */}
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                </View>
              ) : null}

              {successMessage ? (
                <View style={styles.successBanner}>
                  <Text style={styles.successText}>✓ {successMessage}</Text>
                </View>
              ) : null}

              {/* OTP Digits Input Boxes */}
              <View style={styles.digitsRow}>
                {digits.map((digit, index) => {
                  const isSeparator = method !== 'totp' && index === 3;
                  return (
                    <React.Fragment key={index}>
                      <TextInput
                        ref={(el) => {
                          inputRefs.current[index] = el;
                        }}
                        style={[
                          styles.digitBox,
                          digit ? styles.digitBoxFilled : null,
                          index === 0 && !digit ? styles.digitBoxActive : null,
                        ]}
                        value={digit}
                        onChangeText={(val) => handleDigitChange(val, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                        textAlign="center"
                        accessibilityLabel={`Verification digit ${index + 1}`}
                      />
                      {isSeparator && (
                        <View style={styles.separatorWrap}>
                          <Text style={styles.separatorText}>–</Text>
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
              </View>

              {/* Resend Row (for Email OTP) */}
              {method === 'email_otp' && (
                <View style={styles.resendRow}>
                  {countdown > 0 ? (
                    <Text style={styles.timerText}>
                      Resend code in <Text style={styles.timerSecs}>{countdown}s</Text>
                    </Text>
                  ) : (
                    <Pressable
                      onPress={handleResend}
                      disabled={submitting}
                      accessibilityRole="button"
                    >
                      <Text style={styles.resendBtnText}>Resend verification code</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Verify Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.verifyBtn,
                  pressed && styles.verifyBtnPressed,
                  (submitting || isLoading || digits.filter(Boolean).length < 6) &&
                    styles.verifyBtnDisabled,
                ]}
                onPress={handleVerify}
                disabled={submitting || isLoading || digits.filter(Boolean).length < 6}
                accessibilityRole="button"
                accessibilityLabel="Verify and Continue"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={CyberColors.textDark} />
                ) : (
                  <Text style={styles.verifyBtnText}>Verify & Continue</Text>
                )}
              </Pressable>

              {/* Switch Verification Method (if hasTotp) */}
              {hasTotp && (
                <View style={styles.switchMethodRow}>
                  <Pressable
                    style={styles.switchMethodBtn}
                    onPress={() =>
                      handleSwitchMethod(method === 'email_otp' ? 'totp' : 'email_otp')
                    }
                  >
                    <Text style={styles.switchMethodText}>
                      {method === 'email_otp'
                        ? '📱 Use Authenticator App instead'
                        : '✉️ Send code to email instead'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Dev Test Quick Fill Helper */}
              <View style={styles.testCodesWrap}>
                <Text style={styles.testCodeLabel}>DEV BYPASS CODES:</Text>
                <View style={styles.testPillsRow}>
                  <Pressable
                    style={styles.testPill}
                    onPress={() => fillQuickTestCode('12345678')}
                  >
                    <Text style={styles.testPillText}>Auto-Fill 12345678</Text>
                  </Pressable>
                  <Pressable
                    style={styles.testPill}
                    onPress={() => fillQuickTestCode('123456')}
                  >
                    <Text style={styles.testPillText}>Auto-Fill 123456</Text>
                  </Pressable>
                </View>
              </View>

              {/* Back to Sign In Link */}
              <Pressable
                style={styles.backBtn}
                onPress={() => {
                  if (onBack) {
                    onBack();
                  } else {
                    router.replace('/login');
                  }
                }}
              >
                <Text style={styles.backBtnText}>← Back to Sign In</Text>
              </Pressable>
            </View>

            {/* Zero-Trust Security Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerShield}>🔒</Text>
              <Text style={styles.footerText}>
                Secured by Vanguard Continuous Zero-Trust Authentication
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  shieldBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderColor: CyberColors.cyan,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
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
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderWidth: 1,
    borderRadius: CyberRadius.lg,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  badgeWrapper: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardBadgeIcon: {
    fontSize: 22,
  },
  cardTitle: {
    color: CyberColors.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  cardSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  highlightEmail: {
    color: CyberColors.cyan,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: CyberColors.red,
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: CyberColors.red,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: CyberColors.green,
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 10,
    marginBottom: 16,
  },
  successText: {
    color: CyberColors.green,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  digitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginVertical: 14,
    flexWrap: 'wrap',
  },
  digitBox: {
    width: 36,
    height: 46,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderWidth: 1.5,
    borderRadius: CyberRadius.sm,
    color: CyberColors.cyan,
    fontSize: 20,
    fontWeight: '800',
  },
  digitBoxFilled: {
    borderColor: CyberColors.cyan,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  digitBoxActive: {
    borderColor: CyberColors.cyan,
  },
  separatorWrap: {
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  separatorText: {
    color: CyberColors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  resendRow: {
    alignItems: 'center',
    marginVertical: 10,
  },
  timerText: {
    color: CyberColors.textMuted,
    fontSize: 12.5,
  },
  timerSecs: {
    color: CyberColors.cyan,
    fontWeight: '700',
  },
  resendBtnText: {
    color: CyberColors.cyan,
    fontSize: 12.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  verifyBtn: {
    backgroundColor: CyberColors.cyan,
    borderRadius: CyberRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  verifyBtnPressed: {
    opacity: 0.85,
  },
  verifyBtnDisabled: {
    opacity: 0.5,
  },
  verifyBtnText: {
    color: CyberColors.textDark,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  switchMethodRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchMethodBtn: {
    padding: 8,
  },
  switchMethodText: {
    color: '#a5b4fc',
    fontSize: 12.5,
    fontWeight: '600',
  },
  testCodesWrap: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
  },
  testCodeLabel: {
    color: CyberColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  testPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  testPill: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: CyberRadius.sm,
  },
  testPillText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '600',
  },
  backBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 6,
  },
  backBtnText: {
    color: CyberColors.textMuted,
    fontSize: 12.5,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 6,
  },
  footerShield: {
    fontSize: 12,
  },
  footerText: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
});
