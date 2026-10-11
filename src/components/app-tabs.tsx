import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { CyberColors } from '@/constants/cyber-theme';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={CyberColors.background}
      indicatorColor={CyberColors.cyanGlow}
      labelStyle={{ selected: { color: CyberColors.cyan } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Apps</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
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
