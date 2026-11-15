import React from 'react';
import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/auth-context';
import { CyberColors } from '@/constants/cyber-theme';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { shouldHideAppTabBar } from '@/utils/navigation-guard';

const HIDDEN_TAB_STYLE = { display: 'none' as const };

export default function AppTabs() {
  const { currentUser, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const responsive = useResponsiveLayout();
  const isIndividual = currentUser?.accountType === 'individual';
  const hideTabBar = shouldHideAppTabBar(isAuthenticated, pathname);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: CyberColors.background },
        tabBarActiveTintColor: CyberColors.cyan,
        tabBarInactiveTintColor: CyberColors.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarAllowFontScaling: false,
        tabBarStyle: hideTabBar
          ? HIDDEN_TAB_STYLE
          : {
              backgroundColor: CyberColors.cardBg,
              borderTopColor: CyberColors.border,
              borderTopWidth: 1,
              height: responsive.tabBar.height,
              paddingBottom: responsive.tabBar.paddingBottom,
              paddingTop: responsive.tabBar.paddingTop,
              elevation: 8,
            },
        tabBarItemStyle: {
          paddingHorizontal: 2,
          justifyContent: 'center',
        },
        tabBarLabelStyle: {
          fontSize: responsive.tabBar.labelFontSize,
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: isIndividual ? 'Bookmarks' : 'Apps',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'apps' : 'apps-outline'}
              size={responsive.tabBar.iconSize}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="vault"
        options={{
          title: isIndividual ? 'Vault' : responsive.tabBar.authenticatorLabel,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'key' : 'key-outline'}
              size={responsive.tabBar.iconSize}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="devices"
        options={{
          title: 'Devices',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'phone-portrait' : 'phone-portrait-outline'}
              size={responsive.tabBar.iconSize}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Security',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'}
              size={responsive.tabBar.iconSize}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="login"
        options={{ href: null, tabBarStyle: HIDDEN_TAB_STYLE }}
      />
      <Tabs.Screen
        name="register"
        options={{ href: null, tabBarStyle: HIDDEN_TAB_STYLE }}
      />
      <Tabs.Screen
        name="verify-otp"
        options={{ href: null, tabBarStyle: HIDDEN_TAB_STYLE }}
      />
    </Tabs>
  );
}
