import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import {
  CyberButton,
  CyberCard,
  Badge,
  ModalHeader,
  StatusIndicator,
} from '@/components/cyber';
import {
  PushApprovalRequest,
  PushHarnessPreset,
} from '@/models/push-mfa.models';
import pushMfaService, { PUSH_HARNESS_PRESETS } from '@/services/push-mfa.service';
import biometricService, { BiometricType } from '@/services/biometric-auth.service';

export interface PushTestHarnessScreenProps {
  onClose: () => void;
  testID?: string;
}

export function PushTestHarnessScreen({
  onClose,
  testID = 'push-test-harness-screen',
}: PushTestHarnessScreenProps) {
  const [history, setHistory] = useState<PushApprovalRequest[]>([]);
  const [biometricType, setBiometricType] = useState<BiometricType>('FaceID');

  // Custom request builder form state
  const [customAppName, setCustomAppName] = useState('Production Kubernetes Cluster');
  const [customCity, setCustomCity] = useState('New York, NY, USA');
  const [customIp, setCustomIp] = useState('198.51.100.89');
  const [enableNumberMatching, setEnableNumberMatching] = useState(false);
  const [customCode, setCustomCode] = useState('88');
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);

  useEffect(() => {
    // Initial fetch of history & biometric capability
    setHistory(pushMfaService.getHistory());
    biometricService.checkAvailability().then((info) => {
      setBiometricType(info.biometricType);
    });

    // Subscribe to updates so when a challenge resolves, the history refreshes
    const unsubscribe = pushMfaService.subscribe(() => {
      setHistory(pushMfaService.getHistory());
    });

    return () => unsubscribe();
  }, []);

  const handleTriggerPreset = (preset: PushHarnessPreset) => {
    pushMfaService.triggerPreset(preset.id);
  };

  const handleTriggerCustom = () => {
    const codeNum = parseInt(customCode, 10) || 55;
    const option1 = Math.max(10, (codeNum - 14) % 99);
    const option2 = codeNum;
    const option3 = Math.max(10, (codeNum + 23) % 99);
    // Shuffle options deterministically
    const options = [option1, option2, option3].sort(() => Math.random() - 0.5);

    pushMfaService.triggerMockPush({
      appName: customAppName.trim() || 'Custom Enterprise App',
      appIcon: '💻',
      category: 'Developer Sandbox',
      ipAddress: customIp.trim() || '127.0.0.1',
      location: {
        city: customCity.trim() || 'Localhost',
        country: 'Global Network',
        flagEmoji: '🌐',
      },
      device: 'Chrome Browser (Developer Sandbox)',
      validitySeconds: 60,
      numberMatchingChallenge: enableNumberMatching
        ? {
            enabled: true,
            correctCode: codeNum,
            options,
          }
        : {
            enabled: false,
            correctCode: 0,
            options: [],
          },
    });
  };

  const handleClearHistory = () => {
    pushMfaService.clearHistory();
    setHistory([]);
  };

  const getStatusBadge = (status: PushApprovalRequest['status']) => {
    switch (status) {
      case 'approved':
        return <Badge label="APPROVED ✓" variant="green" size="sm" />;
      case 'fraud_reported':
        return <Badge label="FRAUD REPORTED 🚨" variant="red" size="sm" />;
      case 'denied':
        return <Badge label="DENIED" variant="amber" size="sm" />;
      case 'expired':
        return <Badge label="EXPIRED" variant="muted" size="sm" />;
      default:
        return <Badge label="PENDING" variant="cyan" size="sm" />;
    }
  };

  return (
    <View style={styles.screen} testID={testID}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <ModalHeader
            title="Push MFA Test Sandbox"
            subtitle="Phase 1 Local Out-of-Band Push Verification Harness"
            badgeText="LOCAL SIMULATOR"
            badgeVariant="cyan"
            onClose={onClose}
          />

          {/* Diagnostic Info Banner */}
          <CyberCard variant="glass" style={styles.bannerCard}>
            <View style={styles.bannerRow}>
              <StatusIndicator status="active" size="sm" pulse />
              <View style={styles.bannerInfo}>
                <Text style={styles.bannerTitle}>AIR-GAPPED TEST HARNESS ACTIVE</Text>
                <Text style={styles.bannerSubtitle}>
                  Zero-trust local attestation active. Prompts trigger high-priority verification
                  modals with hardware-backed {biometricType} challenges.
                </Text>
              </View>
            </View>
          </CyberCard>

          {/* Preset Prompts Section */}
          <Text style={styles.sectionHeader}>PRESET VERIFICATION PROMPTS</Text>
          <View style={styles.presetsList}>
            {PUSH_HARNESS_PRESETS.map((preset) => (
              <CyberCard
                key={preset.id}
                variant="default"
                style={styles.presetCard}
                testID={`preset-card-${preset.id}`}
              >
                <View style={styles.presetHeader}>
                  <View style={styles.presetTitleRow}>
                    <Text style={styles.presetIcon}>{preset.request.appIcon}</Text>
                    <View style={styles.presetTextContainer}>
                      <Text style={styles.presetTitle}>{preset.title}</Text>
                      <Text style={styles.presetLocation}>
                        {preset.request.location.flagEmoji} {preset.request.location.city},{' '}
                        {preset.request.location.country} • {preset.request.ipAddress}
                      </Text>
                    </View>
                  </View>
                  <Badge
                    label={preset.badge}
                    variant={
                      preset.badge === 'BIOMETRIC'
                        ? 'green'
                        : preset.badge === 'NUMBER MATCH'
                        ? 'cyan'
                        : preset.badge === 'SUSPICIOUS'
                        ? 'red'
                        : 'amber'
                    }
                    size="sm"
                  />
                </View>

                <Text style={styles.presetDescription}>{preset.description}</Text>

                <CyberButton
                  title={`Trigger Challenge 🚀`}
                  variant={preset.badge === 'SUSPICIOUS' ? 'outline' : 'primary'}
                  size="sm"
                  onPress={() => handleTriggerPreset(preset)}
                  style={styles.triggerButton}
                  testID={`trigger-btn-${preset.id}`}
                />
              </CyberCard>
            ))}
          </View>

          {/* Custom Push Request Builder */}
          <Text style={styles.sectionHeader}>CUSTOM PUSH CHALLENGE BUILDER</Text>
          <CyberCard variant="default" style={styles.customCard}>
            <TouchableOpacity
              style={styles.customToggleHeader}
              onPress={() => setShowCustomBuilder(!showCustomBuilder)}
              testID="custom-builder-toggle"
            >
              <Text style={styles.customToggleTitle}>
                {showCustomBuilder ? '▼ Hide Custom Parameters' : '▶ Configure Custom Request'}
              </Text>
              <Badge label="CONFIGURABLE" variant="indigo" size="sm" />
            </TouchableOpacity>

            {showCustomBuilder && (
              <View style={styles.customForm} testID="custom-builder-form">
                <Text style={styles.fieldLabel}>APPLICATION NAME</Text>
                <TextInput
                  style={styles.input}
                  value={customAppName}
                  onChangeText={setCustomAppName}
                  placeholder="e.g. Acme Internal VPN"
                  placeholderTextColor={CyberColors.textMuted}
                  testID="input-app-name"
                />

                <Text style={styles.fieldLabel}>LOCATION & CITY</Text>
                <TextInput
                  style={styles.input}
                  value={customCity}
                  onChangeText={setCustomCity}
                  placeholder="e.g. Chicago, IL, USA"
                  placeholderTextColor={CyberColors.textMuted}
                  testID="input-city"
                />

                <Text style={styles.fieldLabel}>ORIGINATING IP ADDRESS</Text>
                <TextInput
                  style={styles.input}
                  value={customIp}
                  onChangeText={setCustomIp}
                  placeholder="e.g. 192.168.1.100"
                  placeholderTextColor={CyberColors.textMuted}
                  testID="input-ip"
                />

                <View style={styles.switchRow}>
                  <View style={styles.switchTextContainer}>
                    <Text style={styles.switchLabel}>Require Number Matching Challenge</Text>
                    <Text style={styles.switchSublabel}>
                      Prevents MFA push fatigue attacks with 2-digit verification
                    </Text>
                  </View>
                  <Switch
                    value={enableNumberMatching}
                    onValueChange={setEnableNumberMatching}
                    trackColor={{ false: '#1e293b', true: CyberColors.cyan }}
                    thumbColor={Platform.OS === 'android' ? CyberColors.textPrimary : undefined}
                    testID="toggle-number-matching"
                  />
                </View>

                {enableNumberMatching && (
                  <View style={styles.codeRow}>
                    <Text style={styles.fieldLabel}>CORRECT 2-DIGIT CODE</Text>
                    <TextInput
                      style={[styles.input, styles.codeInput]}
                      value={customCode}
                      onChangeText={setCustomCode}
                      maxLength={2}
                      keyboardType="number-pad"
                      placeholder="88"
                      placeholderTextColor={CyberColors.textMuted}
                      testID="input-correct-code"
                    />
                  </View>
                )}

                <CyberButton
                  title="Dispatch Custom Push Challenge 🚀"
                  variant="primary"
                  size="md"
                  onPress={handleTriggerCustom}
                  style={styles.customSubmitButton}
                  testID="btn-dispatch-custom"
                />
              </View>
            )}
          </CyberCard>

          {/* Audit Trail & History Log */}
          <View style={styles.historyHeaderRow}>
            <Text style={styles.sectionHeader}>SIMULATION AUDIT TRAIL</Text>
            {history.length > 0 && (
              <TouchableOpacity onPress={handleClearHistory} testID="btn-clear-history">
                <Text style={styles.clearHistoryText}>Clear Log ✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {history.length === 0 ? (
            <CyberCard variant="glass" style={styles.emptyCard} testID="audit-empty-state">
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No Recorded Challenges</Text>
              <Text style={styles.emptySubtitle}>
                Trigger any preset challenge above to inspect biometric approvals and fraud report
                logging in real time.
              </Text>
            </CyberCard>
          ) : (
            <View style={styles.historyList} testID="audit-history-list">
              {history.map((item, idx) => (
                <CyberCard
                  key={`${item.id}-${idx}`}
                  variant="glass"
                  style={styles.historyCard}
                  testID={`history-item-${item.id}`}
                >
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyAppName}>
                      {item.appIcon} {item.appName}
                    </Text>
                    {getStatusBadge(item.status)}
                  </View>

                  <Text style={styles.historyDetail}>
                    📍 {item.location.city}, {item.location.country} • IP: {item.ipAddress}
                  </Text>
                  <Text style={styles.historyResolution}>
                    {item.resolutionReason || 'Pending Resolution'}
                  </Text>
                  <Text style={styles.historyTimestamp}>
                    Resolved: {item.resolvedAt ? new Date(item.resolvedAt).toLocaleTimeString() : 'N/A'}
                  </Text>
                </CyberCard>
              ))}
            </View>
          )}

          {/* Return Button */}
          <CyberButton
            title="← Back to Security Settings"
            variant="outline"
            size="md"
            onPress={onClose}
            style={styles.backButton}
            testID="btn-back-settings"
          />
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
    padding: 16,
    paddingBottom: 40,
  },
  bannerCard: {
    marginBottom: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bannerSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  sectionHeader: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 10,
  },
  presetsList: {
    gap: 12,
    marginBottom: 16,
  },
  presetCard: {
    padding: 14,
    backgroundColor: '#0f172a',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  presetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  presetIcon: {
    fontSize: 22,
  },
  presetTextContainer: {
    flex: 1,
  },
  presetTitle: {
    color: CyberColors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  presetLocation: {
    color: CyberColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  presetDescription: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  triggerButton: {
    width: '100%',
  },
  customCard: {
    padding: 14,
    backgroundColor: '#0f172a',
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginBottom: 16,
  },
  customToggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customToggleTitle: {
    color: CyberColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  customForm: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  fieldLabel: {
    color: CyberColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#070b12',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: CyberRadius.sm,
    color: CyberColors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  codeInput: {
    width: 80,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 2,
    color: CyberColors.cyan,
  },
  codeRow: {
    marginTop: 6,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  switchTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  switchLabel: {
    color: CyberColors.textPrimary,
    fontSize: 12.5,
    fontWeight: '700',
  },
  switchSublabel: {
    color: CyberColors.textMuted,
    fontSize: 10.5,
    marginTop: 2,
  },
  customSubmitButton: {
    marginTop: 16,
    width: '100%',
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  clearHistoryText: {
    color: CyberColors.red,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyTitle: {
    color: CyberColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: CyberColors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  historyList: {
    gap: 10,
    marginBottom: 20,
  },
  historyCard: {
    padding: 12,
    backgroundColor: '#0f172a',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyAppName: {
    color: CyberColors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  historyDetail: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    marginBottom: 4,
  },
  historyResolution: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '600',
  },
  historyTimestamp: {
    color: CyberColors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  backButton: {
    width: '100%',
    marginTop: 10,
  },
});
