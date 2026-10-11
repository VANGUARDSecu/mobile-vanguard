import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';

import { TotpAccount, AuthenticatorScreenName } from '@/models/vault.models';
import { VaultScreen } from './vault-screen';
import { AccountDetailScreen } from './account-detail-screen';
import { AddAccountScreen } from './add-account-screen';
import { SecuritySettingsScreen } from './security-settings-screen';
import { VaultLockScreen } from '@/components/cyber/vault-lock-screen';
import biometricService, { BiometricType } from '@/services/biometric-auth.service';
import { CyberColors } from '@/constants/cyber-theme';

export type { AuthenticatorScreenName };

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

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Sync forced lock state if prop changes
  useEffect(() => {
    if (forceLocked !== undefined) {
      setIsLocked(forceLocked);
    }
  }, [forceLocked]);

  const triggerUnlock = useCallback(async (disableFallback = false) => {
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
        setIsLocked(false);
        setAuthError(null);
      } else {
        setAuthError(res.error || 'Biometric identity challenge unconfirmed');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Biometric authentication failed');
    } finally {
      setIsAuthenticating(false);
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

      // When app moves to background or inactive, immediately lock and obscure vault
      if (
        nextAppState === 'background' ||
        nextAppState === 'inactive'
      ) {
        const required = await biometricService.isBiometricsRequiredOnLaunch();
        if (required) {
          setIsLocked(true);
        }
      } else if (
        (previousState === 'background' || previousState === 'inactive') &&
        nextAppState === 'active'
      ) {
        // When app returns to foreground, prompt biometric challenge
        const required = await biometricService.isBiometricsRequiredOnLaunch();
        if (required) {
          setIsLocked(true);
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
            />
          )}
        </>
      )}
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
