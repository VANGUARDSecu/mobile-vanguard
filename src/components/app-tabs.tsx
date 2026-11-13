import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/auth-context';
import { CyberColors } from '@/constants/cyber-theme';

export default function AppTabs() {
  const { currentUser } = useAuth();
  const isIndividual = currentUser?.accountType === 'individual';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: CyberColors.cyan,
        tabBarInactiveTintColor: CyberColors.textSecondary,
        tabBarStyle: {
          backgroundColor: CyberColors.cardBg,
          borderTopColor: CyberColors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: isIndividual ? 'Bookmarks' : 'Apps',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'apps' : 'apps-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="vault"
        options={{
          title: isIndividual ? 'Vault' : 'Authenticator',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'key' : 'key-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="devices"
        options={{
          title: 'Devices',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'phone-portrait' : 'phone-portrait-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Security',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen name="login" options={{ href: null }} />
      <Tabs.Screen name="register" options={{ href: null }} />
      <Tabs.Screen name="verify-otp" options={{ href: null }} />
    </Tabs>
  );
}
