import React, { useEffect } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  Stack,
  usePathname,
  useRouter,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View, Text, ActivityIndicator, StyleSheet } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { AppsProvider } from '@/context/apps-context';
import { CyberColors } from '@/constants/cyber-theme';
import { resolveAuthRedirectPath } from '@/utils/navigation-guard';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { isAuthenticated, isInitializing } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Ensure native splash screen hides once session initialization resolves,
    // with a failsafe timeout to prevent permanent screen freezing in Expo Go.
    const failsafe = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 2500);

    if (!isInitializing) {
      SplashScreen.hideAsync().catch(() => {});
    }

    return () => clearTimeout(failsafe);
  }, [isInitializing]);

  useEffect(() => {
    if (isInitializing) {
      return;
    }

    const redirectTarget = resolveAuthRedirectPath(isAuthenticated, pathname);
    if (redirectTarget) {
      router.replace(redirectTarget);
    }
  }, [isInitializing, isAuthenticated, pathname, router]);

  if (isInitializing) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={CyberColors.cyan} />
        <Text style={styles.loadingText}>INITIALIZING VANGUARD SESSION...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: CyberColors.background },
        }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verify-otp" />
      </Stack>
    );
  }

  return <AppTabs />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AppsProvider>
          <RootNavigator />
        </AppsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: CyberColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
