import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { useAuth } from '@/context/auth-context';
import { useApps } from '@/context/apps-context';
import LoginScreen from './login';
import {
  CategoryFilterBar,
  AppCard,
  EmptyAppsState,
  ConnectedAppsSection,
  AddPersonalAppModal,
  RequestAppModal,
  RequestAppInput,
  RequestedAppsSection,
} from '@/components/apps';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import {
  SaaSApp,
  UserConnectedApp,
  PersonalAppInput,
  AppAccessRequest,
} from '@/models/apps.models';

export default function ApplicationsScreen() {
  const { currentUser, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const {
    isPersonalWorkspace,
    setIsPersonalWorkspace,
    selectedCategory,
    setSelectedCategory,
    activeAppsList,
    filteredApps,
    activeConnectedApps,
    findCredentialsForDomain,
    addPersonalApp,
    deletePersonalApp,
    disconnectConnectedApp,
    syncConnectedApps,
    submitAppRequest,
    apps,
    accessRequests,
    pendingRequestsCount,
    refreshApps,
    isLoading,
  } = useApps();

  const [refreshing, setRefreshing] = useState(false);
  const [syncingSso, setSyncingSso] = useState(false);
  const [showAddPersonalAppModal, setShowAddPersonalAppModal] = useState(false);
  const [showRequestAppModal, setShowRequestAppModal] = useState(false);

  if (authLoading) {
    return (
      <View style={[styles.screen, styles.loadingScreen]}>
        <ActivityIndicator size="large" color={CyberColors.cyan} />
        <Text style={styles.loadingText}>INITIALIZING VANGUARD SESSION...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshApps();
    setRefreshing(false);
  };

  const handleLaunchApp = async (app: SaaSApp) => {
    if (!app.launchUrl) {
      Alert.alert('Unable to Launch', 'No launch URL configured for this application.');
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(app.launchUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: CyberColors.background,
      });
    } catch {
      Linking.openURL(app.launchUrl).catch(() => {
        Alert.alert('Error', `Could not open ${app.launchUrl}`);
      });
    }
  };

  const handleLaunchConnectedApp = async (app: UserConnectedApp) => {
    if (!app.originUrl) {
      Alert.alert('Unable to Launch', 'No target origin URL configured for this connected client.');
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(app.originUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: CyberColors.background,
      });
    } catch {
      Linking.openURL(app.originUrl).catch(() => {
        Alert.alert('Error', `Could not open ${app.originUrl}`);
      });
    }
  };

  const handleDisconnectConnectedApp = (clientId: string, clientName: string) => {
    const confirmationMessage = `This will revoke active Single Sign-On session access and OAuth authorization for ${clientName} (${clientId}).`;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      const confirmed = window.confirm(`Disconnect ${clientName}?\n\n${confirmationMessage}`);
      if (confirmed) {
        disconnectConnectedApp(clientId);
      }
      return;
    }

    Alert.alert(
      `Disconnect ${clientName}?`,
      confirmationMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnectConnectedApp(clientId);
          },
        },
      ]
    );
  };

  const handleSyncSso = async () => {
    setSyncingSso(true);
    await syncConnectedApps();
    setSyncingSso(false);
  };

  const handleActionPress = () => {
    if (isPersonalWorkspace) {
      setShowAddPersonalAppModal(true);
    } else {
      setShowRequestAppModal(true);
    }
  };

  const handleAddPersonalApp = async (input: PersonalAppInput) => {
    await addPersonalApp(input);
  };

  const handleRequestApp = async (input: RequestAppInput) => {
    await submitAppRequest(input);
  };

  const handleLaunchApprovedRequest = async (request: AppAccessRequest) => {
    const matchingApp = apps.find(
      (a) => a.name.toLowerCase() === request.appName.toLowerCase()
    );
    const targetUrl = matchingApp?.launchUrl || request.launchUrl || 'https://vanguard.security';

    try {
      await WebBrowser.openBrowserAsync(targetUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: CyberColors.background,
      });
    } catch {
      Linking.openURL(targetUrl).catch(() => {
        Alert.alert('Error', `Could not open ${targetUrl}`);
      });
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isLoading}
              onRefresh={onRefresh}
              tintColor={CyberColors.cyan}
              colors={[CyberColors.cyan]}
            />
          }
        >
          {/* Top Brand & Workspace Mode Bar */}
          <View style={styles.topHeader}>
            {/* Authenticated User Session Status Bar */}
            <View style={styles.userSessionBar}>
              <View style={styles.userInfoWrap}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '👤'}
                  </Text>
                </View>
                <View style={styles.userMetaWrap}>
                  <Text style={styles.userNameText} numberOfLines={1}>
                    {currentUser?.name || currentUser?.email}
                  </Text>
                  <Text style={styles.userEmailText} numberOfLines={1}>
                    {currentUser?.email}
                  </Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.logoutBtn,
                  pressed && styles.logoutBtnPressed,
                ]}
                onPress={() => logout()}
                accessibilityRole="button"
                accessibilityLabel="Sign Out"
              >
                <Text style={styles.logoutBtnText}>Sign Out ⎋</Text>
              </Pressable>
            </View>

            <View style={styles.brandRow}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandShield}>🛡️</Text>
                <Text style={styles.brandTitle}>VANGUARD</Text>
              </View>

              {/* Workspace Switcher Pill Toggle */}
              <Pressable
                style={({ pressed }) => [
                  styles.workspaceToggle,
                  pressed && styles.workspaceTogglePressed,
                ]}
                onPress={() => setIsPersonalWorkspace(!isPersonalWorkspace)}
                accessibilityRole="button"
                accessibilityLabel="Switch Workspace Mode"
              >
                <Text style={styles.workspaceToggleText}>
                  {isPersonalWorkspace ? '👤 Personal Mode' : '🏢 Company Org'}
                </Text>
                <Text style={styles.workspaceSwitchHint}>⇄</Text>
              </Pressable>
            </View>

            {/* Title & Subtitle */}
            <View style={styles.titleWrap}>
              <Text style={styles.mainTitle}>
                {isPersonalWorkspace
                  ? 'Personal Applications'
                  : 'My Applications'}
              </Text>
              <Text style={styles.subtitle}>
                {isPersonalWorkspace
                  ? 'Personal web app shortcuts configured for dynamic autofill via browser extension.'
                  : 'Launch your assigned enterprise SaaS apps with zero-trust credentials.'}
              </Text>
            </View>

            {/* Quick Action Button */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryActionBtn,
                pressed && styles.primaryActionBtnPressed,
              ]}
              onPress={handleActionPress}
              accessibilityRole="button"
            >
              <Text style={styles.primaryActionBtnPlus}>+</Text>
              <Text style={styles.primaryActionBtnText}>
                {isPersonalWorkspace ? 'Add Application' : 'Request Application'}
              </Text>
            </Pressable>
          </View>

          {/* Active SSO Integrations & Connected Applications (SCRUM-64) */}
          <ConnectedAppsSection
            connectedApps={activeConnectedApps}
            onLaunch={handleLaunchConnectedApp}
            onDisconnect={handleDisconnectConnectedApp}
            onSync={handleSyncSso}
            isSyncing={syncingSso}
          />

          {/* Category Filter Bar */}
          <CategoryFilterBar
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            totalAppsCount={activeAppsList.length}
          />

          {/* Applications Grid / List */}
          <View style={styles.appsList}>
            {filteredApps.length === 0 ? (
              <EmptyAppsState
                isPersonalWorkspace={isPersonalWorkspace}
                onActionPress={handleActionPress}
              />
            ) : (
              filteredApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  isPersonalWorkspace={isPersonalWorkspace}
                  matchingVaultCredentials={findCredentialsForDomain(app.launchUrl || app.name)}
                  onLaunch={handleLaunchApp}
                  onDelete={deletePersonalApp}
                />
              ))
            )}
          </View>

          {/* Requested Applications & Zero-Trust Governance Queue (SCRUM-67) */}
          {!isPersonalWorkspace && accessRequests.length > 0 && (
            <RequestedAppsSection
              requests={accessRequests}
              pendingCount={pendingRequestsCount}
              onLaunch={handleLaunchApprovedRequest}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Add Personal Application Modal (SCRUM-65) */}
      <AddPersonalAppModal
        visible={showAddPersonalAppModal}
        onClose={() => setShowAddPersonalAppModal(false)}
        onAdd={handleAddPersonalApp}
      />

      {/* Request Enterprise Application Modal (SCRUM-66) */}
      <RequestAppModal
        visible={showRequestAppModal}
        onClose={() => setShowRequestAppModal(false)}
        onSubmit={handleRequestApp}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CyberColors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  topHeader: {
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandShield: {
    fontSize: 20,
  },
  brandTitle: {
    color: CyberColors.cyan,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  workspaceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CyberColors.cardBgSecondary,
    borderColor: CyberColors.cyan,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: CyberRadius.full,
    gap: 6,
  },
  workspaceTogglePressed: {
    opacity: 0.75,
  },
  workspaceToggleText: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  workspaceSwitchHint: {
    color: CyberColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  titleWrap: {
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: CyberColors.textSecondary,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CyberColors.cyan,
    borderRadius: CyberRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionBtnPressed: {
    opacity: 0.85,
  },
  primaryActionBtnPlus: {
    color: CyberColors.textDark,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 18,
  },
  primaryActionBtnText: {
    color: CyberColors.textDark,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  appsList: {
    marginTop: 4,
  },
  loadingScreen: {
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
  userSessionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  userInfoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: CyberColors.cyan,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: CyberColors.cyan,
    fontSize: 14,
    fontWeight: '800',
  },
  userMetaWrap: {
    flex: 1,
  },
  userNameText: {
    color: CyberColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  userEmailText: {
    color: CyberColors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: CyberRadius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
  },
  logoutBtnPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: 11.5,
    fontWeight: '700',
  },
});
