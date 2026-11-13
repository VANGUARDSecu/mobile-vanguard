import React, { useEffect } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
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

  return (
    <View style={styles.rootContainer}>
      <AppTabs />
      {isInitializing ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={CyberColors.cyan} />
          <Text style={styles.loadingText}>INITIALIZING VANGUARD SESSION...</Text>
        </View>
      ) : null}
    </View>
  );
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
  rootContainer: {
    flex: 1,
    backgroundColor: CyberColors.background,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: CyberColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 999,
  },
  loadingText: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
