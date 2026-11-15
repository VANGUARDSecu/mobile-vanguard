import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  AppState,
  AppStateStatus,
  Linking,
  BackHandler,
} from 'react-native';

import { TotpAccount, AuthenticatorScreenName } from '@/models/vault.models';
import { VaultScreen } from './vault-screen';
import { AccountDetailScreen } from './account-detail-screen';
import { AddAccountScreen } from './add-account-screen';
import { SecuritySettingsScreen } from './security-settings-screen';
import { VaultLockScreen } from '@/components/cyber/vault-lock-screen';
import { PushApprovalModal } from '@/components/cyber/push-approval-modal';
import { PushTestHarnessScreen } from './push-test-harness-screen';
import pushMfaService from '@/services/push-mfa.service';
import { PushApprovalRequest } from '@/models/push-mfa.models';
import biometricService, { BiometricType } from '@/services/biometric-auth.service';
import vaultService from '@/services/vault.service';
import { AuthService } from '@/services/auth.service';
import { CyberColors } from '@/constants/cyber-theme';
import { getAuthenticatorBackScreen } from '@/utils/navigation-guard';

export type { AuthenticatorScreenName };

const ALLOWED_MOBILE_SSO_RETURN_SCHEMES = ['vanguard-dummy://', 'exp://'];

function isCustomMobileSsoCallbackUrl(url: string | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return ALLOWED_MOBILE_SSO_RETURN_SCHEMES.some((prefix) => trimmed.startsWith(prefix));
}

export interface AuthenticatorNavigatorProps {
  initialScreen?: AuthenticatorScreenName;
  initialAccount?: TotpAccount | null;
  forceLocked?: boolean;
  autoPromptBiometrics?: boolean;
  testID?: string;
}

export function AuthenticatorNavigator({
  initialScreen = 'vault',
  initialAccount = null,
  forceLocked,
  autoPromptBiometrics = true,
  testID = 'authenticator-navigator',
}: AuthenticatorNavigatorProps) {
  const [currentScreen, setCurrentScreen] =
    useState<AuthenticatorScreenName>(initialScreen);
  const [selectedAccount, setSelectedAccount] =
    useState<TotpAccount | null>(initialAccount);

  const [isLocked, setIsLocked] = useState<boolean>(forceLocked ?? false);
  const [biometricType, setBiometricType] = useState<BiometricType>('FaceID');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activePushRequest, setActivePushRequest] =
    useState<PushApprovalRequest | null>(null);

  // Subscribe to Out-of-Band Push MFA requests and background polling (SCRUM-21 & SCRUM-85)
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = pushMfaService.subscribe((req) => {
      setActivePushRequest(req);
    });

    // Auto-discover user session and start polling backend for pending SSO pushes & TOTP sync (SCRUM-85/178)
    vaultService.setAuthTokenProvider(() => AuthService.getAccessToken());
    AuthService.getCurrentUser().then((user) => {
      if (isMounted && user?.email) {
        vaultService.setCurrentUserEmail(user.email);
        pushMfaService.startPolling(user.email);
        void vaultService.syncWithBackend(user.accessToken || undefined);
      }
    }).catch(() => {});

    // Deep link listener for vanguard-auth://mfa/challenge?id=... (SCRUM-85)
    const handleUrl = (url: string | null) => {
      if (!url) return;
      if (url.includes('mfa/challenge') || url.includes('challenge')) {
        AuthService.getCurrentUser().then((user) => {
          pushMfaService.fetchPendingPush(user?.email);
        }).catch(() => {});
      }
    };

    if (Linking && Linking.getInitialURL) {
      Linking.getInitialURL().then(handleUrl).catch(() => {});
    }

    let urlSub: { remove?: () => void } | undefined;
    if (Linking && Linking.addEventListener) {
      urlSub = Linking.addEventListener('url', (e: { url: string }) => handleUrl(e.url));
    }

    return () => {
      isMounted = false;
      unsubscribe();
      urlSub?.remove?.();
      pushMfaService.stopPolling();
    };
  }, []);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isAuthenticatingRef = useRef<boolean>(false);
  const lastUnlockTimestampRef = useRef<number>(0);
  const isLockedRef = useRef<boolean>(forceLocked ?? false);

  // Sync forced lock state if prop changes
  useEffect(() => {
    if (forceLocked !== undefined) {
      isLockedRef.current = forceLocked;
      setIsLocked(forceLocked);
    }
  }, [forceLocked]);

  const triggerUnlock = useCallback(async (disableFallback = false) => {
    if (
      isAuthenticatingRef.current ||
      biometricService.isAuthenticationInFlight() ||
      Date.now() - biometricService.getLastAuthenticationTimestamp() < 2500
    ) {
      return;
    }
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const res = await biometricService.authenticate({
        promptMessage: 'Unlock Vanguard Authenticator Vault',
        fallbackLabel: 'Use Device Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: disableFallback,
      });

      if (res.success) {
        lastUnlockTimestampRef.current = Date.now();
        isLockedRef.current = false;
        setIsLocked(false);
        setAuthError(null);
      } else {
        setAuthError(res.error || 'Biometric identity challenge unconfirmed');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Biometric authentication failed');
    } finally {
      setIsAuthenticating(false);
      // Give the OS 800ms to settle its native active/inactive AppState transition
      setTimeout(() => {
        isAuthenticatingRef.current = false;
      }, 800);
    }
  }, []);

  const triggerPasscodeFallback = useCallback(() => {
    triggerUnlock(false);
  }, [triggerUnlock]);

  // Initial biometric capability & launch lock policy check
  useEffect(() => {
    let isMounted = true;

    const initializeSecurityLock = async () => {
      const availability = await biometricService.checkAvailability();
      if (isMounted) {
        setBiometricType(availability.biometricType);
      }

      if (forceLocked !== undefined) {
        return;
      }

      const required = await biometricService.isBiometricsRequiredOnLaunch();
      if (required && isMounted) {
        // If user already authenticated very recently (e.g. push approval), stay unlocked
        if (Date.now() - biometricService.getLastAuthenticationTimestamp() < 5000) {
          isLockedRef.current = false;
          setIsLocked(false);
          return;
        }
        isLockedRef.current = true;
        setIsLocked(true);
        if (autoPromptBiometrics) {
          triggerUnlock();
        }
      }
    };

    initializeSecurityLock();

    return () => {
      isMounted = false;
    };
  }, [autoPromptBiometrics, forceLocked, triggerUnlock]);

  // AppState lifecycle listener: Obscure screen on background, challenge on resume (SCRUM-20)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Ignore transient inactive/active transitions triggered by native biometric modal dialogs
      if (
        isAuthenticatingRef.current ||
        biometricService.isAuthenticationInFlight() ||
        Date.now() - biometricService.getLastAuthenticationTimestamp() < 3000 ||
        Date.now() - lastUnlockTimestampRef.current < 3000
      ) {
        return;
      }

      // When app moves to background (user switches apps or minimizes to homescreen)
      if (nextAppState === 'background') {
        const required = await biometricService.isBiometricsRequiredOnLaunch();
        if (required) {
          isLockedRef.current = true;
          setIsLocked(true);
        }
      } else if (
        previousState === 'background' &&
        nextAppState === 'active'
      ) {
        // When app returns to foreground from true background, prompt biometric challenge
        const required = await biometricService.isBiometricsRequiredOnLaunch();
        if (required && isLockedRef.current) {
          if (autoPromptBiometrics) {
            triggerUnlock();
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [autoPromptBiometrics, triggerUnlock]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isLocked) {
        return false;
      }

      const previousScreen = getAuthenticatorBackScreen(currentScreen);
      if (!previousScreen) {
        return false;
      }

      setCurrentScreen(previousScreen);
      if (previousScreen === 'vault') {
        setSelectedAccount(null);
      }
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [currentScreen, isLocked]);

  const navigateToVault = () => {
    setCurrentScreen('vault');
    setSelectedAccount(null);
  };

  const navigateToDetail = (account: TotpAccount) => {
    setSelectedAccount(account);
    setCurrentScreen('account-detail');
  };

  const navigateToAdd = () => {
    setCurrentScreen('add-account');
  };

  const navigateToSettings = () => {
    setCurrentScreen('security-settings');
  };

  const navigateToPushHarness = () => {
    setCurrentScreen('push-harness');
  };

  return (
    <View style={styles.container} testID={testID}>
      {/* Obscuring Lock Overlay whenever Vault is locked (SCRUM-20) */}
      {isLocked ? (
        <VaultLockScreen
          onUnlock={() => triggerUnlock(false)}
          onPasscodeFallback={triggerPasscodeFallback}
          biometricType={biometricType}
          isAuthenticating={isAuthenticating}
          errorMessage={authError}
          testID="vault-lock-screen"
        />
      ) : (
        <>
          {currentScreen === 'vault' && (
            <VaultScreen
              onSelectAccount={navigateToDetail}
              onAddAccount={navigateToAdd}
              onOpenSettings={navigateToSettings}
            />
          )}

          {currentScreen === 'account-detail' && selectedAccount && (
            <AccountDetailScreen
              account={selectedAccount}
              onBack={navigateToVault}
              onDeleted={navigateToVault}
            />
          )}

          {currentScreen === 'add-account' && (
            <AddAccountScreen
              onClose={navigateToVault}
              onSaved={() => navigateToVault()}
            />
          )}

          {currentScreen === 'security-settings' && (
            <SecuritySettingsScreen
              onClose={navigateToVault}
              onResetVault={navigateToVault}
              onOpenPushHarness={navigateToPushHarness}
            />
          )}

          {currentScreen === 'push-harness' && (
            <PushTestHarnessScreen onClose={navigateToSettings} />
          )}
        </>
      )}

      {/* High-Priority Out-of-Band Push Notification MFA Approval Modal (SCRUM-21) */}
      <PushApprovalModal
        visible={Boolean(activePushRequest)}
        request={activePushRequest}
        onApprove={async (opts) => {
          if (!activePushRequest) return undefined;
          const result = await pushMfaService.approveRequest(activePushRequest.id, opts);
          if (!result.success) {
            // Keep the request on screen so the user can retry. Do not record a success.
            return { success: false, error: result.error };
          }
          // User successfully verified identity via native biometric/passcode challenge
          biometricService.recordAuthenticationSuccess();
          lastUnlockTimestampRef.current = Date.now();
          isLockedRef.current = false;
          setIsLocked(false);
          setAuthError(null);
          if (
            !result.awaitingAdminApproval &&
            isCustomMobileSsoCallbackUrl(result.redirectUrl)
          ) {
            void Linking.openURL(result.redirectUrl).catch(() => undefined);
          }
          return { success: true };
        }}
        onDeny={(isFraud) => {
          if (activePushRequest) {
            pushMfaService.denyRequest(activePushRequest.id, isFraud);
          }
        }}
        onClose={() => {
          if (activePushRequest) {
            pushMfaService.dismissRequest(activePushRequest.id);
          }
        }}
        testID="global-push-approval-modal"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CyberColors.background,
  },
});

export default AuthenticatorNavigator;
