import React, { useCallback, useEffect, useState } from 'react';
import {
  DarkTheme,
  ThemeProvider,
  usePathname,
  useRouter,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { AppsProvider } from '@/context/apps-context';
import { BillingProvider } from '@/context/billing-context';
import { GuideProvider } from '@/context/guide-context';
import { BillingModal } from '@/components/billing/billing-modal';
import { NewUserGuideModal } from '@/components/cyber/new-user-guide-modal';
import { SsoConsentModal } from '@/components/cyber/sso-consent-modal';
import { AuthService } from '@/services/auth.service';
import {
  buildOAuthErrorRedirect,
  buildWebPortalAuthorizeUrl,
  OAuthAuthorizeDeepLinkParams,
  parseOAuthAuthorizeDeepLink,
} from '@/utils/oauth-deeplink';
import { CyberColors } from '@/constants/cyber-theme';
import { resolveAuthRedirectPath } from '@/utils/navigation-guard';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { currentUser, isAuthenticated, isInitializing } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingOAuthRequest, setPendingOAuthRequest] = useState<OAuthAuthorizeDeepLinkParams | null>(null);
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const [isApprovingSso, setIsApprovingSso] = useState(false);
  const [ssoApprovalError, setSsoApprovalError] = useState<string | null>(null);

  const handleIncomingDeepLink = useCallback((url: string | null | undefined) => {
    if (!url) return;
    const parsed = parseOAuthAuthorizeDeepLink(url);
    if (!parsed) return;
    setSsoApprovalError(null);
    setPendingOAuthRequest(parsed);
    setConsentModalVisible(true);
  }, []);

  useEffect(() => {
    let active = true;
    Linking.getInitialURL()
      .then((initialUrl) => {
        if (active && initialUrl) {
          handleIncomingDeepLink(initialUrl);
        }
      })
      .catch(() => {});

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingDeepLink(url);
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [handleIncomingDeepLink]);

  useEffect(() => {
    if (isAuthenticated && pendingOAuthRequest) {
      setConsentModalVisible(true);
    }
  }, [isAuthenticated, pendingOAuthRequest]);

  const handleApproveSso = useCallback(async () => {
    if (!pendingOAuthRequest) return;
    setIsApprovingSso(true);
    setSsoApprovalError(null);
    try {
      const result = await AuthService.approveOAuthAuthorization(pendingOAuthRequest);
      setConsentModalVisible(false);
      setPendingOAuthRequest(null);
      await Linking.openURL(result.redirectUrl);
    } catch (error) {
      setSsoApprovalError(
        error instanceof Error ? error.message : 'Unable to approve SSO request. Please try again.',
      );
    } finally {
      setIsApprovingSso(false);
    }
  }, [pendingOAuthRequest]);

  const handleDenySso = useCallback(() => {
    if (!pendingOAuthRequest) {
      setConsentModalVisible(false);
      return;
    }
    const deniedRedirect = buildOAuthErrorRedirect(
      pendingOAuthRequest.redirect_uri,
      'access_denied',
      'User denied SSO request on Vanguard Mobile.',
      pendingOAuthRequest.state,
    );
    setConsentModalVisible(false);
    setPendingOAuthRequest(null);
    setSsoApprovalError(null);
    Linking.openURL(deniedRedirect).catch(() => {});
  }, [pendingOAuthRequest]);

  const handleOpenWebPortalSso = useCallback(() => {
    if (!pendingOAuthRequest) return;
    const webPortalUrl = buildWebPortalAuthorizeUrl(pendingOAuthRequest);
    setConsentModalVisible(false);
    setPendingOAuthRequest(null);
    setSsoApprovalError(null);
    Linking.openURL(webPortalUrl).catch(() => {});
  }, [pendingOAuthRequest]);

  const handleSignInFirstSso = useCallback(() => {
    setConsentModalVisible(false);
  }, []);

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
      <BillingModal />
      <NewUserGuideModal />
      <SsoConsentModal
        visible={consentModalVisible && pendingOAuthRequest !== null}
        request={pendingOAuthRequest}
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        isSubmitting={isApprovingSso}
        errorMessage={ssoApprovalError}
        onApprove={handleApproveSso}
        onDeny={handleDenySso}
        onSignInFirst={handleSignInFirstSso}
        onOpenWebPortal={handleOpenWebPortalSso}
      />
      {isInitializing ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={CyberColors.cyan} />
          <Text style={styles.loadingText}>INITIALIZING VANGUARD SESSION...</Text>
        </View>
      ) : null}
    </View>
  );
}

const VanguardDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: CyberColors.background,
    card: CyberColors.cardBg,
    border: CyberColors.border,
    text: CyberColors.textPrimary,
    primary: CyberColors.cyan,
  },
};

export default function TabLayout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(CyberColors.background).catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={VanguardDarkTheme}>
        <StatusBar style="light" />
        <AuthProvider>
          <BillingProvider>
            <GuideProvider>
              <AppsProvider>
                <RootNavigator />
              </AppsProvider>
            </GuideProvider>
          </BillingProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
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
