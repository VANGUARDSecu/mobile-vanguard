import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { CyberButton } from './cyber-button';
import { CyberCard } from './cyber-card';
import { Badge } from './badge';
import { StatusIndicator } from './status-indicator';
import { PushApprovalRequest } from '@/models/push-mfa.models';
import biometricService from '@/services/biometric-auth.service';

export interface PushApprovalModalProps {
  request: PushApprovalRequest | null;
  visible: boolean;
  onApprove: (options: { biometricVerified: boolean; selectedCode?: number }) => Promise<void> | void;
  onDeny: (isFraud: boolean) => void;
  onClose: () => void;
  testID?: string;
}

export function PushApprovalModal({
  request,
  visible,
  onApprove,
  onDeny,
  onClose,
  testID = 'push-approval-modal',
}: PushApprovalModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [selectedCode, setSelectedCode] = useState<number | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize and synchronize countdown timer with request expiresAt
  useEffect(() => {
    if (!request || !visible) {
      setSecondsRemaining(60);
      setSelectedCode(null);
      setErrorMessage(null);
      return;
    }

    const calculateRemaining = () => {
      const expiresTime = new Date(request.expiresAt).getTime();
      const diff = Math.max(0, Math.ceil((expiresTime - Date.now()) / 1000));
      return diff;
    };

    setSecondsRemaining(calculateRemaining());
    setSelectedCode(null);
    setErrorMessage(null);

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [request, visible]);

  if (!visible || !request) {
    return null;
  }

  const isExpired = secondsRemaining <= 0;
  const isNumberMatchingRequired = Boolean(request.numberMatchingChallenge?.enabled);

  const getTimerColor = () => {
    if (isExpired) return CyberColors.red;
    if (secondsRemaining <= 15) return CyberColors.red;
    if (secondsRemaining <= 30) return CyberColors.amber;
    return CyberColors.cyan;
  };

  const handleApprove = async () => {
    if (isExpired) {
      setErrorMessage('Verification request has expired');
      return;
    }

    // Number matching guard
    if (isNumberMatchingRequired) {
      if (selectedCode === null) {
        setErrorMessage('Please select the 2-digit number shown on your screen');
        return;
      }
      if (selectedCode !== request.numberMatchingChallenge?.correctCode) {
        setErrorMessage(
          `Number mismatch: ${selectedCode} does not match the prompt on your screen`
        );
        return;
      }
    }

    setErrorMessage(null);
    setIsAuthenticating(true);

    try {
      const authRes = await biometricService.authenticate({
        promptMessage: `Approve Sign-in to ${request.appName}`,
        fallbackLabel: 'Use Device Passcode',
        cancelLabel: 'Cancel',
      });

      if (authRes.success) {
        await onApprove({
          biometricVerified: true,
          selectedCode: selectedCode ?? undefined,
        });
      } else {
        setErrorMessage(authRes.error || 'Biometric authentication challenge unconfirmed');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Biometric verification failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDeny = (isFraud: boolean) => {
    onDeny(isFraud);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Modal Card */}
            <View style={styles.modalCard} testID={`${testID}-container`}>
              {/* Header Bar */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <StatusIndicator status={isExpired ? 'error' : 'warning'} size="sm" pulse />
                  <Text style={styles.headerTitle}>OUT-OF-BAND PUSH VERIFICATION</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  accessibilityLabel="Close modal"
                  accessibilityRole="button"
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Urgency Alert & Timer */}
              <View style={[styles.timerBanner, { borderColor: getTimerColor() }]}>
                <View style={styles.timerLeft}>
                  <Text style={styles.timerIcon}>{isExpired ? '⌛' : '⏳'}</Text>
                  <Text style={styles.timerLabel}>
                    {isExpired ? 'REQUEST EXPIRED' : 'VALIDITY WINDOW'}
                  </Text>
                </View>
                <View style={[styles.timerPill, { backgroundColor: `${getTimerColor()}1A` }]}>
                  <Text style={[styles.timerCountdown, { color: getTimerColor() }]}>
                    {isExpired ? 'EXPIRED' : `${secondsRemaining}s remaining`}
                  </Text>
                </View>
              </View>

              {/* Target Application Card */}
              <CyberCard variant="glow" style={styles.appCard}>
                <View style={styles.appRow}>
                  <View style={styles.appIconContainer}>
                    <Text style={styles.appIconText}>{request.appIcon || '🔒'}</Text>
                  </View>
                  <View style={styles.appDetails}>
                    <Text style={styles.appName} numberOfLines={1}>
                      {request.appName}
                    </Text>
                    <View style={styles.categoryRow}>
                      <Badge
                        label={request.category || 'Enterprise Application'}
                        variant="cyan"
                        size="sm"
                      />
                      <Badge label="Zero-Trust MFA" variant="green" size="sm" />
                    </View>
                  </View>
                </View>
              </CyberCard>

              {/* Contextual Login Metadata Grid */}
              <View style={styles.metadataGrid}>
                {/* Geolocation */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaIcon}>📍</Text>
                  <View style={styles.metaContent}>
                    <Text style={styles.metaLabel}>APPROXIMATE LOCATION</Text>
                    <Text style={styles.metaValue}>
                      {request.location.flagEmoji ? `${request.location.flagEmoji} ` : ''}
                      {request.location.city}
                      {request.location.region ? `, ${request.location.region}` : ''},{' '}
                      {request.location.country}
                    </Text>
                  </View>
                </View>

                {/* IP Address */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaIcon}>🌐</Text>
                  <View style={styles.metaContent}>
                    <Text style={styles.metaLabel}>ORIGINATING IP ADDRESS</Text>
                    <Text style={[styles.metaValue, styles.monospace]}>
                      {request.ipAddress}
                    </Text>
                  </View>
                </View>

                {/* Device & Browser */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaIcon}>💻</Text>
                  <View style={styles.metaContent}>
                    <Text style={styles.metaLabel}>CLIENT DEVICE & ENVIRONMENT</Text>
                    <Text style={styles.metaValue}>{request.device}</Text>
                  </View>
                </View>

                {/* Timestamp */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaIcon}>🕒</Text>
                  <View style={styles.metaContent}>
                    <Text style={styles.metaLabel}>TIMESTAMP</Text>
                    <Text style={styles.metaValue}>
                      {new Date(request.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Number Matching Challenge (MFA Fatigue Prevention) */}
              {isNumberMatchingRequired && request.numberMatchingChallenge && (
                <View style={styles.numberMatchSection} testID={`${testID}-number-matching`}>
                  <View style={styles.numberMatchHeader}>
                    <Text style={styles.numberMatchIcon}>🔢</Text>
                    <View style={styles.numberMatchHeaderText}>
                      <Text style={styles.numberMatchTitle}>NUMBER MATCHING VERIFICATION</Text>
                      <Text style={styles.numberMatchSubtitle}>
                        Select the 2-digit number shown on your sign-in browser:
                      </Text>
                    </View>
                  </View>

                  <View style={styles.numberOptionsRow}>
                    {request.numberMatchingChallenge.options.map((code) => {
                      const isSelected = selectedCode === code;
                      return (
                        <TouchableOpacity
                          key={code}
                          style={[
                            styles.numberOptionButton,
                            isSelected && styles.numberOptionSelected,
                          ]}
                          onPress={() => {
                            setSelectedCode(code);
                            setErrorMessage(null);
                          }}
                          testID={`${testID}-code-${code}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Select number ${code}`}
                        >
                          <Text
                            style={[
                              styles.numberOptionText,
                              isSelected && styles.numberOptionTextSelected,
                            ]}
                          >
                            {code}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Error Message Alert */}
              {errorMessage && (
                <View style={styles.errorBanner} testID={`${testID}-error`}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Interactive Actions */}
              <View style={styles.actionsContainer}>
                {/* Approve Button */}
                <CyberButton
                  title={
                    isAuthenticating
                      ? 'Verifying Biometrics...'
                      : isExpired
                      ? 'Challenge Expired'
                      : 'APPROVE LOGIN ✓'
                  }
                  variant="success"
                  size="lg"
                  disabled={isExpired || isAuthenticating}
                  loading={isAuthenticating}
                  onPress={handleApprove}
                  style={styles.actionButton}
                  testID={`${testID}-approve-btn`}
                />

                {/* Deny & Fraud Report Button */}
                <CyberButton
                  title="DENY & REPORT FRAUD 🚨"
                  variant="danger"
                  size="md"
                  disabled={isAuthenticating}
                  onPress={() => handleDeny(true)}
                  style={styles.actionButton}
                  testID={`${testID}-deny-fraud-btn`}
                />

                {/* Standard Refuse Action */}
                <TouchableOpacity
                  onPress={() => handleDeny(false)}
                  disabled={isAuthenticating}
                  style={styles.cancelLink}
                  testID={`${testID}-cancel-link`}
                >
                  <Text style={styles.cancelLinkText}>Deny without reporting</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#0c1322',
    borderRadius: CyberRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    padding: 20,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: CyberColors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  closeButton: {
    padding: 6,
    borderRadius: CyberRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeButtonText: {
    color: CyberColors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: CyberRadius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  timerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerIcon: {
    fontSize: 14,
  },
  timerLabel: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  timerPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  timerCountdown: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  appCard: {
    marginTop: 14,
    padding: 14,
    backgroundColor: '#111b2e',
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appIconContainer: {
    width: 46,
    height: 46,
    borderRadius: CyberRadius.md,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appIconText: {
    fontSize: 22,
  },
  appDetails: {
    flex: 1,
  },
  appName: {
    color: CyberColors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  metadataGrid: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: CyberRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    marginTop: 14,
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  metaIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  metaContent: {
    flex: 1,
  },
  metaLabel: {
    color: CyberColors.textMuted,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  metaValue: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 1,
  },
  monospace: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: CyberColors.cyan,
  },
  numberMatchSection: {
    marginTop: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: CyberRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    padding: 12,
  },
  numberMatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  numberMatchIcon: {
    fontSize: 18,
  },
  numberMatchHeaderText: {
    flex: 1,
  },
  numberMatchTitle: {
    color: CyberColors.amber,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  numberMatchSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  numberOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
    marginTop: 6,
  },
  numberOptionButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#0a0f1d',
    borderRadius: CyberRadius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberOptionSelected: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: CyberColors.cyan,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  numberOptionText: {
    color: CyberColors.textSecondary,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  numberOptionTextSelected: {
    color: CyberColors.cyan,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: CyberRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    padding: 10,
    marginTop: 12,
  },
  errorIcon: {
    fontSize: 14,
  },
  errorText: {
    color: CyberColors.red,
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  actionsContainer: {
    marginTop: 18,
    gap: 10,
  },
  actionButton: {
    width: '100%',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancelLinkText: {
    color: CyberColors.textMuted,
    fontSize: 11.5,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
