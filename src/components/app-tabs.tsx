import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAuth } from '@/context/auth-context';
import { CyberColors } from '@/constants/cyber-theme';

export default function AppTabs() {
  const { currentUser } = useAuth();
  const isIndividual = currentUser?.accountType === 'individual';

  return (
    <NativeTabs
      backgroundColor={CyberColors.background}
      indicatorColor={CyberColors.cyanGlow}
      labelStyle={{ selected: { color: CyberColors.cyan } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>
          {isIndividual ? 'Bookmarks' : 'Apps'}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="vault">
        <NativeTabs.Trigger.Label>
          {isIndividual ? 'Vault' : 'Authenticator'}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="devices">
        <NativeTabs.Trigger.Label>Devices</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Security</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
