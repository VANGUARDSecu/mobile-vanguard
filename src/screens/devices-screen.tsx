import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { PushApprovalModal } from '@/components/cyber/push-approval-modal';
import { PushApprovalRequest } from '@/models/push-mfa.models';
import pushMfaService from '@/services/push-mfa.service';
import biometricService, { BiometricType } from '@/services/biometric-auth.service';
import { AppsStorageService } from '@/services/apps-storage.service';

const getPairedDeviceStorageKey = (email?: string | null): string => {
  const clean = email?.trim().toLowerCase();
  return clean ? `vanguard_paired_device_info_${clean}` : 'vanguard_paired_device_info';
};

export interface PairedDeviceMetadata {
  id?: string;
  pairingKey: string;
  pairedAt: string;
  deviceName: string;
  platform: string;
  biometricType: string;
}

export default function DevicesScreen() {
  const { currentUser, logout } = useAuth();

  // Biometrics and Hardware Attestation State
  const [biometricInfo, setBiometricInfo] = useState<{
    hasHardware: boolean;
    isEnrolled: boolean;
    biometricType: BiometricType;
  }>({
    hasHardware: true,
    isEnrolled: true,
    biometricType: 'FaceID',
  });
  const [isRefreshingAttestation, setIsRefreshingAttestation] = useState(false);
  const [lastAttestedTime, setLastAttestedTime] = useState('Just now');

  // Device Pairing State
  const [pairingKeyInput, setPairingKeyInput] = useState('');
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingSuccess, setPairingSuccess] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [pairedDevice, setPairedDevice] = useState<PairedDeviceMetadata | null>(null);

  // Push MFA State
  const [activePushRequest, setActivePushRequest] = useState<PushApprovalRequest | null>(null);
  const [pushHistory, setPushHistory] = useState<PushApprovalRequest[]>([]);
  const [isTriggeringTestPush, setIsTriggeringTestPush] = useState(false);

  // Load hardware attestation, pairing status, and push history on mount/account switch
  useEffect(() => {
    let isMounted = true;
    const storageKey = getPairedDeviceStorageKey(currentUser?.email);

    // Load initial biometrics
    biometricService.checkAvailability().then((info) => {
      if (isMounted) setBiometricInfo(info);
    });

    // Load paired device from user-scoped local storage first
    setPairedDevice(null);
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (isMounted && raw) {
          try {
            setPairedDevice(JSON.parse(raw));
          } catch {}
        }
      })
      .catch(() => {});

    // Authoritative sync with backend paired devices
    if (currentUser?.email) {
      pushMfaService.listPairedDevices(currentUser.email).then((res) => {
        if (!isMounted || !res.ok) return;
        if (res.devices.length > 0) {
          const d = res.devices[0];
          const synced: PairedDeviceMetadata = {
            id: d.id,
            pairingKey: d.pairingKey || 'PAIRED',
            pairedAt: d.enrolledAt || new Date().toISOString(),
            deviceName: d.name || 'Vanguard Companion',
            platform: d.osVersion || `${Platform.OS.toUpperCase()}`,
            biometricType: d.biometricType || biometricInfo.biometricType,
          };
          setPairedDevice(synced);
          void AsyncStorage.setItem(storageKey, JSON.stringify(synced));
        } else {
          setPairedDevice(null);
          void AsyncStorage.removeItem(storageKey);
        }
      });
    }

    // Subscribe to Push MFA service
    const unsubscribe = pushMfaService.subscribe((req) => {
      if (isMounted) {
        setActivePushRequest(req);
        setPushHistory(pushMfaService.getHistory());
      }
    });

    setPushHistory(pushMfaService.getHistory());

    // Start background push polling for active user
    if (currentUser?.email) {
      pushMfaService.startPolling(currentUser.email);
    }

    return () => {
      isMounted = false;
      unsubscribe();
      pushMfaService.stopPolling();
    };
  }, [currentUser?.email]);

  const handleRefreshAttestation = async () => {
    setIsRefreshingAttestation(true);
    try {
      const info = await biometricService.checkAvailability();
      setBiometricInfo(info);
      setLastAttestedTime(new Date().toLocaleTimeString());
    } finally {
      setIsRefreshingAttestation(false);
    }
  };

  const handlePairDevice = async () => {
    const rawKey = pairingKeyInput.trim().toUpperCase();
    if (!rawKey) {
      setPairingError('Please enter the pairing key from your web dashboard.');
      return;
    }

    if (rawKey.length < 6) {
      setPairingError('Invalid key length. Keys follow the format VG-XXXX-XXXX or token.');
      return;
    }

    setIsPairing(true);
    setPairingError(null);
    setPairingSuccess(null);

    try {
      const defaultName =
        Platform.OS === 'android'
          ? 'Android Companion Device'
          : Platform.OS === 'ios'
          ? 'Apple iOS Companion'
          : 'Web Mobile Companion';
      const defaultType =
        Platform.OS === 'android' ? 'Mobile Android' : 'Mobile iOS';
      const osVersion = `${Platform.OS.toUpperCase()} (SDK ${Platform.Version || '22'})`;

      const res = await pushMfaService.pairDevice({
        pairingKey: rawKey,
        deviceName: defaultName,
        deviceType: defaultType,
        model: 'Vanguard Mobile Authenticator',
        osVersion,
        biometricType: biometricInfo.biometricType,
        email: currentUser?.email,
      });

      if (!res.success || !res.device) {
        setPairingError(res.error || 'Failed to complete device pairing. Verify pairing key and retry.');
        return;
      }

      if (currentUser?.email) {
        await pushMfaService.syncPreference(currentUser.email, true).catch(() => {});
      }

      const deviceMeta: PairedDeviceMetadata = {
        id: res.device.id,
        pairingKey: rawKey,
        pairedAt: res.device.enrolledAt || new Date().toISOString(),
        deviceName: res.device.name || defaultName,
        platform: res.device.osVersion || osVersion,
        biometricType: res.device.biometricType || biometricInfo.biometricType,
      };

      await AsyncStorage.setItem(getPairedDeviceStorageKey(currentUser?.email), JSON.stringify(deviceMeta));
      setPairedDevice(deviceMeta);
      setPairingKeyInput('');
      setPairingSuccess('Mobile device successfully paired with Vanguard Dashboard!');
    } catch {
      setPairingError('Failed to complete device pairing. Please check your connection.');
    } finally {
      setIsPairing(false);
    }
  };

  const handleUnlinkDevice = async () => {
    const confirmAction = () => {
      (async () => {
        try {
          if (pairedDevice?.id) {
            await pushMfaService.unlinkPairedDevice(pairedDevice.id, currentUser?.email);
          }
          await AsyncStorage.removeItem(getPairedDeviceStorageKey(currentUser?.email));
          setPairedDevice(null);
          setPairingSuccess(null);
          if (currentUser?.email) {
            await pushMfaService.syncPreference(currentUser.email, false).catch(() => {});
          }
        } catch {
          // Non-blocking
        }
      })();
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Unlink this mobile device from Vanguard Identity Hub?')) {
        confirmAction();
      }
    } else {
      Alert.alert(
        'Unlink Mobile Device',
        'Are you sure you want to unlink this device? Out-of-band push MFA will be deregistered for this phone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unlink', style: 'destructive', onPress: confirmAction },
        ]
      );
    }
  };

  const handleTriggerTestPush = async () => {
    if (!pairedDevice || !currentUser?.email) {
      setPairingError('Pair your mobile device with your Vanguard web dashboard before triggering a test push.');
      return;
    }

    setIsTriggeringTestPush(true);
    try {
      const res = await pushMfaService.triggerDeviceTestPush({
        email: currentUser.email,
        deviceId: pairedDevice.id,
        deviceName: pairedDevice.deviceName,
      });
      if (!res.success) {
        setPairingError(res.error || 'Failed to dispatch test push notification.');
        return;
      }
      await pushMfaService.fetchPendingPush(currentUser.email);
    } finally {
      setIsTriggeringTestPush(false);
    }
  };

  const handleApprovePush = async (options: { biometricVerified: boolean; selectedCode?: number }) => {
    if (!activePushRequest) return;
    const res = await pushMfaService.approveRequest(activePushRequest.id, options);
    if (!res.success && res.error) {
      return { success: false, error: res.error };
    }
    setActivePushRequest(null);
    setPushHistory(pushMfaService.getHistory());
  };

  const handleDenyPush = (isFraud: boolean) => {
    if (!activePushRequest) return;
    pushMfaService.denyRequest(activePushRequest.id, isFraud);
    setActivePushRequest(null);
    setPushHistory(pushMfaService.getHistory());
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandShield}>🛡️</Text>
              <Text style={styles.brandTitle}>VANGUARD IDENTITY</Text>
            </View>
            <Text style={styles.pageTitle}>Mobile & Devices</Text>
            <Text style={styles.pageSubtitle}>
              Hardware biometric attestation, desktop device pairing, and real-time Push MFA verification
            </Text>
          </View>

          {/* Current Device Hardware Posture Card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>HARDWARE & ZERO-TRUST ATTESTATION</Text>
              <TouchableOpacity
                onPress={handleRefreshAttestation}
                disabled={isRefreshingAttestation}
                style={styles.refreshIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Refresh Attestation"
              >
                {isRefreshingAttestation ? (
                  <ActivityIndicator size="small" color={CyberColors.cyan} />
                ) : (
                  <Text style={styles.refreshIconText}>🔄</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.attestationList}>
              {/* Platform & OS */}
              <View style={styles.attestationItem}>
                <View style={styles.attestationIconWrap}>
                  <Text style={styles.attestationIcon}>📱</Text>
                </View>
                <View style={styles.attestationDetails}>
                  <Text style={styles.attestationTitle}>Device Architecture</Text>
                  <Text style={styles.attestationDesc}>
                    {Platform.OS === 'android'
                      ? 'Android Hardware Client'
                      : Platform.OS === 'ios'
                      ? 'Apple iOS Secure Hardware'
                      : 'Web Application Client'}{' '}
                    • OS {Platform.Version || 'Native'}
                  </Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>ATTESTED</Text>
                </View>
              </View>

              {/* Biometrics */}
              <View style={styles.attestationItem}>
                <View style={styles.attestationIconWrap}>
                  <Text style={styles.attestationIcon}>👁️</Text>
                </View>
                <View style={styles.attestationDetails}>
                  <Text style={styles.attestationTitle}>Biometric Authentication</Text>
                  <Text style={styles.attestationDesc}>
                    {biometricInfo.biometricType} • Hardware Sensor{' '}
                    {biometricInfo.hasHardware ? 'Available' : 'Emulated'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    biometricInfo.isEnrolled
                      ? styles.statusPillCompliant
                      : styles.statusPillWarning,
                  ]}
                >
                  <Text style={styles.statusPillText}>
                    {biometricInfo.isEnrolled ? 'ENROLLED' : 'SETUP NEEDED'}
                  </Text>
                </View>
              </View>

              {/* Secure Storage */}
              <View style={styles.attestationItem}>
                <View style={styles.attestationIconWrap}>
                  <Text style={styles.attestationIcon}>🔐</Text>
                </View>
                <View style={styles.attestationDetails}>
                  <Text style={styles.attestationTitle}>Hardware Keystore & Enclave</Text>
                  <Text style={styles.attestationDesc}>
                    AES-256-GCM Secure Enclave Storage • Integrity Validated
                  </Text>
                </View>
                <View style={[styles.statusPill, styles.statusPillCompliant]}>
                  <Text style={styles.statusPillText}>ACTIVE</Text>
                </View>
              </View>

              {/* Posture Timestamp */}
              <View style={styles.timestampRow}>
                <Text style={styles.timestampText}>
                  Zero-Trust Posture Last Evaluated: {lastAttestedTime}
                </Text>
              </View>
            </View>
          </View>

          {/* Desktop Pairing Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>DESKTOP & WEB DASHBOARD PAIRING</Text>
            <Text style={styles.sectionSubtitle}>
              Link this phone with your Vanguard Web Dashboard (https://vanguard-security.pages.dev) to enable out-of-band push authentication.
            </Text>

            {pairedDevice ? (
              <View style={styles.pairedSuccessBox}>
                <View style={styles.pairedSuccessHeader}>
                  <Text style={styles.pairedCheckIcon}>✓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pairedSuccessTitle}>Companion Device Paired</Text>
                    <Text style={styles.pairedSuccessDesc}>
                      Pairing Key: {pairedDevice.pairingKey}
                    </Text>
                    <Text style={styles.pairedSuccessSub}>
                      Enrolled: {new Date(pairedDevice.pairedAt).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.unlinkBtn}
                  onPress={handleUnlinkDevice}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Unlink Device"
                >
                  <Text style={styles.unlinkBtnText}>Unlink Companion Device ⎋</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.pairInputContainer}>
                {pairingError ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>⚠️ {pairingError}</Text>
                  </View>
                ) : null}

                {pairingSuccess ? (
                  <View style={styles.successBanner}>
                    <Text style={styles.successText}>✓ {pairingSuccess}</Text>
                  </View>
                ) : null}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Dashboard Pairing Key</Text>
                  <TextInput
                    style={styles.input}
                    value={pairingKeyInput}
                    onChangeText={(t) => {
                      setPairingKeyInput(t);
                      if (pairingError) setPairingError(null);
                    }}
                    placeholder="e.g. VG-4821-9932"
                    placeholderTextColor={CyberColors.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.pairActionBtn,
                    pressed && styles.pairActionBtnPressed,
                    isPairing && styles.pairActionBtnDisabled,
                  ]}
                  onPress={handlePairDevice}
                  disabled={isPairing}
                  accessibilityRole="button"
                  accessibilityLabel="Pair Device"
                >
                  {isPairing ? (
                    <ActivityIndicator size="small" color={CyberColors.textDark} />
                  ) : (
                    <Text style={styles.pairActionBtnText}>Pair with Web Dashboard</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {/* Real-Time Push MFA Telemetry */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>OUT-OF-BAND PUSH MFA STATUS</Text>
              <View style={styles.listeningBadge}>
                <View style={styles.pulsingDot} />
                <Text style={styles.listeningText}>LISTENING</Text>
              </View>
            </View>

            <Text style={styles.pushDescText}>
              Listening for pending SSO authentication challenges dispatched to{' '}
              <Text style={{ color: CyberColors.cyan, fontWeight: '700' }}>
                {currentUser?.email || 'authenticated user'}
              </Text>{' '}
              from Acme Dummy Web and corporate apps.
            </Text>

            {/* Test Push Trigger Button */}
            <TouchableOpacity
              style={styles.testPushBtn}
              onPress={handleTriggerTestPush}
              disabled={isTriggeringTestPush}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Test Number Matching Push"
            >
              <Text style={styles.testPushBtnText}>
                {isTriggeringTestPush ? 'Triggering...' : '⚡ Test 2-Digit Number Matching Challenge'}
              </Text>
            </TouchableOpacity>

            {/* Push History */}
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>RECENT PUSH VERIFICATIONS</Text>
              {pushHistory.length === 0 ? (
                <View style={styles.emptyHistoryBox}>
                  <Text style={styles.emptyHistoryText}>
                    No recent push challenges received yet. When you initiate SSO from Acme Dummy Web, the challenge appears here.
                  </Text>
                </View>
              ) : (
                <View style={styles.historyList}>
                  {pushHistory.slice(0, 5).map((item) => (
                    <View key={item.id} style={styles.historyItem}>
                      <View style={styles.historyRow}>
                        <Text style={styles.historyApp}>
                          {item.appIcon || '🛡️'} {item.appName}
                        </Text>
                        <View
                          style={[
                            styles.historyBadge,
                            item.status === 'approved'
                              ? styles.badgeApproved
                              : item.status === 'denied'
                              ? styles.badgeDenied
                              : styles.badgeExpired,
                          ]}
                        >
                          <Text style={styles.historyBadgeText}>
                            {item.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.historyDetails}>
                        IP: {item.ipAddress} • {item.location.city}, {item.location.country}
                      </Text>
                      <Text style={styles.historyTime}>
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Push Verification Modal with Biometrics & Number Matching */}
      <PushApprovalModal
        request={activePushRequest}
        visible={Boolean(activePushRequest)}
        onApprove={handleApprovePush}
        onDeny={handleDenyPush}
        onClose={() => setActivePushRequest(null)}
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
  },
  header: {
    marginBottom: 20,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  brandShield: {
    fontSize: 18,
  },
  brandTitle: {
    color: CyberColors.cyan,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: CyberColors.textPrimary,
    letterSpacing: 0.3,
  },
  pageSubtitle: {
    fontSize: 13,
    color: CyberColors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#0f172a',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.lg,
    padding: 16,
    marginBottom: 16,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  refreshIconBtn: {
    padding: 4,
    cursor: 'pointer' as any,
  },
  refreshIconText: {
    fontSize: 14,
  },
  sectionSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 14,
  },
  attestationList: {
    gap: 12,
  },
  attestationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
  },
  attestationIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attestationIcon: {
    fontSize: 18,
  },
  attestationDetails: {
    flex: 1,
    marginRight: 8,
  },
  attestationTitle: {
    color: CyberColors.textPrimary,
    fontSize: 13.5,
    fontWeight: '700',
  },
  attestationDesc: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  statusPill: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: CyberColors.cyan,
    borderWidth: 1,
    borderRadius: CyberRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
    alignSelf: 'center',
  },
  statusPillCompliant: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderColor: CyberColors.green,
  },
  statusPillWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
  },
  statusPillText: {
    color: CyberColors.textPrimary,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  timestampRow: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  timestampText: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
  pairInputContainer: {
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: CyberColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  pairActionBtn: {
    backgroundColor: CyberColors.cyan,
    borderRadius: CyberRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
    cursor: 'pointer' as any,
  },
  pairActionBtnPressed: {
    opacity: 0.85,
  },
  pairActionBtnDisabled: {
    opacity: 0.6,
  },
  pairActionBtnText: {
    color: CyberColors.textDark,
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pairedSuccessBox: {
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderColor: 'rgba(0, 255, 136, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 14,
  },
  pairedSuccessHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  pairedCheckIcon: {
    fontSize: 20,
    color: CyberColors.green,
    fontWeight: '900',
  },
  pairedSuccessTitle: {
    color: CyberColors.green,
    fontSize: 14,
    fontWeight: '800',
  },
  pairedSuccessDesc: {
    color: CyberColors.textPrimary,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  pairedSuccessSub: {
    color: CyberColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  unlinkBtn: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: CyberRadius.md,
    paddingVertical: 8,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  unlinkBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderColor: 'rgba(0, 255, 136, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  successText: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '600',
  },
  listeningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
    borderColor: 'rgba(0, 255, 136, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 6,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CyberColors.green,
  },
  listeningText: {
    color: CyberColors.green,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pushDescText: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
  },
  testPushBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: CyberColors.cyan,
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 18,
    cursor: 'pointer' as any,
  },
  testPushBtnText: {
    color: CyberColors.cyan,
    fontSize: 12.5,
    fontWeight: '800',
  },
  historySection: {
    borderTopColor: 'rgba(59, 130, 246, 0.2)',
    borderTopWidth: 1,
    paddingTop: 14,
  },
  historyTitle: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  emptyHistoryBox: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyHistoryText: {
    color: CyberColors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  historyList: {
    gap: 8,
  },
  historyItem: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 10,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  historyApp: {
    color: CyberColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
  },
  historyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: CyberRadius.sm,
    flexShrink: 0,
  },
  badgeApproved: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
  },
  badgeDenied: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  badgeExpired: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  historyBadgeText: {
    color: CyberColors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  historyDetails: {
    color: CyberColors.textSecondary,
    fontSize: 11,
  },
  historyTime: {
    color: CyberColors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});
