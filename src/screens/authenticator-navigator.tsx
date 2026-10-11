import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { TotpAccount, AuthenticatorScreenName } from '@/models/vault.models';
import { VaultScreen } from './vault-screen';
import { AccountDetailScreen } from './account-detail-screen';
import { AddAccountScreen } from './add-account-screen';
import { SecuritySettingsScreen } from './security-settings-screen';
import { CyberColors } from '@/constants/cyber-theme';

export type { AuthenticatorScreenName };

export interface AuthenticatorNavigatorProps {
  initialScreen?: AuthenticatorScreenName;
  initialAccount?: TotpAccount | null;
  testID?: string;
}

export function AuthenticatorNavigator({
  initialScreen = 'vault',
  initialAccount = null,
  testID = 'authenticator-navigator',
}: AuthenticatorNavigatorProps) {
  const [currentScreen, setCurrentScreen] =
    useState<AuthenticatorScreenName>(initialScreen);
  const [selectedAccount, setSelectedAccount] =
    useState<TotpAccount | null>(initialAccount);

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
