import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLauncherService } from '@/services/app-launcher.service';
import { AuthService } from '@/services/auth.service';
import { SecurityActivityService } from '@/services/security-activity.service';
import { useAuth } from '@/context/auth-context';
import { useApps } from '@/context/apps-context';
import { useOptionalBilling } from '@/context/billing-context';
import { useOptionalGuide } from '@/context/guide-context';
import { resolveGuideRoleFromUser } from '@/utils/new-user-guide';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { isBillingLimitError } from '@/models/billing.models';
import LoginScreen from '@/app/login';
import {
  CategoryFilterBar,
  AppCard,
  EmptyAppsState,
  ConnectedAppsSection,
  AddPersonalAppModal,
  RequestAppModal,
  RequestAppInput,
  RequestedAppsSection,
  CompanyAdminBanner,
} from '@/components/apps';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import {
  SaaSApp,
  UserConnectedApp,
  PersonalAppInput,
  AppAccessRequest,
} from '@/models/apps.models';

export default function MyAppsScreen() {
  const { currentUser, isAuthenticated, isInitializing: authInitializing, logout } = useAuth();
  const responsive = useResponsiveLayout();
  const billing = useOptionalBilling();
  const guide = useOptionalGuide();
  const {
    isPersonalWorkspace,
    isCompanyAdmin,
    selectedCategory,
    setSelectedCategory,
    activeAppsList,
    totalIntegratedAppsCount,
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
    pendingAdminRequests,
    approveAccessRequest,
    rejectAccessRequest,
    refreshApps,
  } = useApps();

  const [refreshing, setRefreshing] = useState(false);
  const [syncingSso, setSyncingSso] = useState(false);
  const [showAddPersonalAppModal, setShowAddPersonalAppModal] = useState(false);
  const [showRequestAppModal, setShowRequestAppModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const guideUserKey = currentUser?.email || currentUser?.id || null;
  const guideRole = resolveGuideRoleFromUser({
    accountType: isPersonalWorkspace ? 'individual' : 'company',
    role: isCompanyAdmin ? 'admin' : 'user',
  });
  const autoOpenGuide = guide?.autoOpenIfFirstDashboardVisit;

  useEffect(() => {
    if (!isAuthenticated || authInitializing || !guideUserKey || !autoOpenGuide) {
      return;
    }
    void autoOpenGuide(guideUserKey, guideRole);
  }, [isAuthenticated, authInitializing, guideUserKey, guideRole, autoOpenGuide]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // Non-blocking
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (authInitializing) {
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
    void (async () => {
      const token = currentUser?.accessToken || (await AuthService.getAccessToken());
      if (token) {
        await SecurityActivityService.recordMovement(token, {
          movementType: 'APP_LAUNCH',
          action: `Launched ${app.name} from Mobile App`,
          applicationName: app.name,
          protocol: app.protocol,
        });
      }
    })();
    await AppLauncherService.launchApp(app);
  };

  const handleLaunchConnectedApp = async (app: UserConnectedApp) => {
    void (async () => {
      const token = currentUser?.accessToken || (await AuthService.getAccessToken());
      if (token) {
        await SecurityActivityService.recordMovement(token, {
          movementType: 'APP_LAUNCH',
          action: `Launched connected app ${app.clientName} from Mobile App`,
          applicationName: app.clientName,
          protocol: app.protocol,
        });
      }
    })();
    await AppLauncherService.launchConnectedApp(app);
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
      if (billing) {
        const quota = billing.checkAppQuota(totalIntegratedAppsCount);
        if (!quota.allowed) {
          billing.openBillingModal(quota.reason);
          return;
        }
      }
      setShowAddPersonalAppModal(true);
    } else {
      if (billing) {
        const quota = billing.checkAppQuota(totalIntegratedAppsCount);
        if (!quota.allowed) {
          billing.openBillingModal(quota.reason);
          return;
        }
      }
      setShowRequestAppModal(true);
    }
  };

  const handleAddPersonalApp = async (input: PersonalAppInput) => {
    try {
      await addPersonalApp(input);
    } catch (err) {
      if (isBillingLimitError(err)) {
        setShowAddPersonalAppModal(false);
        billing?.openBillingModal(err.message);
        return;
      }
      throw err;
    }
  };

  const handleRequestApp = async (input: RequestAppInput) => {
    try {
      await submitAppRequest(input);
    } catch (err) {
      if (isBillingLimitError(err)) {
        setShowRequestAppModal(false);
        billing?.openBillingModal(err.message);
        return;
      }
      throw err;
    }
  };

  const handleLaunchApprovedRequest = async (request: AppAccessRequest) => {
    await AppLauncherService.launchApprovedRequest(request, apps);
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        {/* Pinned Authenticated User Session Status Bar */}
        <View
          style={[
            styles.sessionHeaderContainer,
            { paddingHorizontal: responsive.horizontalPadding },
          ]}
        >
          <View style={[styles.userSessionBar, responsive.centeredContainerStyle]}>
            <View style={styles.userInfoWrap}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '👤'}
                </Text>
              </View>
              <View style={styles.userMetaWrap}>
                <Text style={styles.userNameText} numberOfLines={1}>
                  {currentUser?.name || currentUser?.email || 'Authenticated User'}
                </Text>
                <Text style={styles.userEmailText} numberOfLines={1}>
                  {currentUser?.email || 'Zero-Trust Session Active'}
                </Text>
              </View>
            </View>

            <View style={styles.sessionActionsRow}>
              {guide ? (
                <TouchableOpacity
                  style={styles.guideHeaderBtn}
                  onPress={() => void guide.openFromDashboard(guideUserKey, guideRole)}
                  activeOpacity={0.75}
                  hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Open Quick Start Guide"
                  testID="dashboard-guide-btn"
                >
                  <Text style={styles.guideHeaderBtnText}>
                    {responsive.isCompact ? '?' : '? Guide'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.logoutBtn,
                  isLoggingOut && styles.logoutBtnDisabled,
                ]}
                onPress={handleLogout}
                disabled={isLoggingOut}
                activeOpacity={0.7}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                accessibilityRole="button"
                accessibilityLabel="Sign Out"
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color="#f87171" />
                ) : (
                  <Text style={styles.logoutBtnText} numberOfLines={1}>
                    {responsive.isCompact ? 'Exit ⎋' : 'Sign Out ⎋'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: responsive.horizontalPadding,
              paddingBottom: responsive.scrollBottomPadding,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={CyberColors.cyan}
              colors={[CyberColors.cyan]}
            />
          }
        >
          <View style={responsive.centeredContainerStyle}>
            {/* Top Brand & Workspace Mode Bar */}
            <View style={styles.topHeader}>
              <View style={styles.brandRow}>
                <View style={styles.brandBadge}>
                  <Text style={styles.brandShield}>🛡️</Text>
                  <Text style={styles.brandTitle}>VANGUARD</Text>
                </View>

                {/* Immutable Workspace Mode Badge (SCRUM-84: Non-switchable) */}
                <View style={styles.workspaceBadge}>
                  <Text style={styles.workspaceBadgeText} numberOfLines={1}>
                    {isPersonalWorkspace ? '👤 Personal' : '🏢 Org'}
                  </Text>
                  <View style={styles.workspaceBadgeDot} />
                  <Text style={styles.workspaceBadgeOrg} numberOfLines={1} ellipsizeMode="tail">
                    {isPersonalWorkspace
                      ? 'INDIVIDUAL'
                      : (currentUser?.companyName ? currentUser.companyName.toUpperCase() : 'ENTERPRISE')}
                  </Text>
                </View>
              </View>

              {/* Title & Subtitle */}
              <View style={styles.titleWrap}>
                <Text
                  style={[
                    styles.mainTitle,
                    { fontSize: responsive.headerTitleSize },
                  ]}
                >
                  {isPersonalWorkspace
                    ? 'Personal Apps & Bookmarks'
                    : 'My Applications (SSO)'}
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    { fontSize: responsive.subtitleSize },
                  ]}
                >
                  {isPersonalWorkspace
                    ? 'Personal web app shortcuts configured for dynamic autofill via browser extension.'
                    : 'Launch your assigned enterprise SaaS apps with zero-trust credentials.'}
                </Text>
              </View>

              {/* SCRUM-185: Synced Plan Status & Quota Strip */}
              {billing ? (
                <TouchableOpacity
                  onPress={() => billing.openBillingModal()}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    flexWrap: responsive.isCompact ? 'wrap' : 'nowrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    backgroundColor: billing.isFreeTier
                      ? 'rgba(245, 158, 11, 0.12)'
                      : 'rgba(16, 185, 129, 0.12)',
                    borderColor: billing.isFreeTier
                      ? 'rgba(245, 158, 11, 0.35)'
                      : 'rgba(16, 185, 129, 0.35)',
                    borderWidth: 1,
                    borderRadius: CyberRadius.sm,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    marginBottom: 10,
                  }}
                >
                  <Text
                    numberOfLines={2}
                    style={{
                      color: billing.isFreeTier ? '#fcd34d' : '#6ee7b7',
                      fontSize: responsive.isCompact ? 11 : 11.5,
                      fontWeight: '700',
                      flex: 1,
                    }}
                  >
                    {billing.isFreeTier
                      ? billing.isTenantMember
                        ? `⏳ ${billing.subscription.planName} • ${totalIntegratedAppsCount}/1 App (Admin)`
                        : `⚡ ${billing.subscription.planName} • ${totalIntegratedAppsCount}/1 App Max`
                      : `💎 ${billing.subscription.planName} • Unlimited Apps Synced`}
                  </Text>
                  <Text style={{ color: CyberColors.cyan, fontSize: 11.5, fontWeight: '800', flexShrink: 0 }}>
                    {billing.isFreeTier && billing.canManageBilling ? 'Upgrade →' : 'View Plan →'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Action Buttons Row */}
              <View
                style={[
                  styles.actionButtonsRow,
                  {
                    flexDirection: responsive.stackActionButtons ? 'column' : 'row',
                  },
                ]}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryActionBtn,
                    !responsive.stackActionButtons && styles.splitActionBtn,
                    pressed && styles.primaryActionBtnPressed,
                  ]}
                  onPress={() => {
                    if (billing) {
                      const quota = billing.checkAppQuota(totalIntegratedAppsCount);
                      if (!quota.allowed) {
                        billing.openBillingModal(quota.reason);
                        return;
                      }
                    }
                    setShowAddPersonalAppModal(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Add Application"
                  testID="action-add-app"
                >
                  <Text style={styles.primaryActionBtnPlus}>+</Text>
                  <Text style={styles.primaryActionBtnText} numberOfLines={1}>
                    {isPersonalWorkspace || responsive.stackActionButtons ? 'Add Application' : 'Add App'}
                  </Text>
                </Pressable>

                {!isPersonalWorkspace ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryActionBtn,
                      !responsive.stackActionButtons && styles.splitActionBtn,
                      pressed && styles.secondaryActionBtnPressed,
                    ]}
                    onPress={() => {
                      if (billing) {
                        const quota = billing.checkAppQuota(totalIntegratedAppsCount);
                        if (!quota.allowed) {
                          billing.openBillingModal(quota.reason);
                          return;
                        }
                      }
                      setShowRequestAppModal(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Request Enterprise Access"
                    testID="action-request-enterprise-app"
                  >
                    <Text style={styles.secondaryActionBtnText} numberOfLines={1}>
                      {responsive.stackActionButtons ? 'Request Enterprise Access' : 'Request Access'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

          {/* Company Admin Governance Console & Review Banner (SCRUM-84) */}
          {isCompanyAdmin && (
            <CompanyAdminBanner
              companyName={currentUser?.companyName || 'Enterprise Organization'}
              adminName={currentUser?.name || 'Security Administrator'}
              pendingRequests={pendingAdminRequests}
              onApprove={approveAccessRequest}
              onReject={rejectAccessRequest}
            />
          )}

          {/* Active SSO Integrations & Connected Applications (SCRUM-64) */}
          <ConnectedAppsSection
            connectedApps={activeConnectedApps}
            onLaunch={handleLaunchConnectedApp}
            onDisconnect={handleDisconnectConnectedApp}
            onSync={handleSyncSso}
            isSyncing={syncingSso}
          />

          {/* Category Filter Bar & Applications Grid (hidden when all active apps are already shown in ConnectedAppsSection) */}
          {!(activeAppsList.length === 0 && activeConnectedApps.length > 0) && (
            <>
              <CategoryFilterBar
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                totalAppsCount={activeAppsList.length}
              />

              {/* Applications Grid / List */}
              <View
                style={[
                  styles.appsList,
                  responsive.gridColumns === 2 && {
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: responsive.cardGap,
                  },
                ]}
              >
                {filteredApps.length === 0 ? (
                  <View style={{ width: '100%' }}>
                    <EmptyAppsState
                      isPersonalWorkspace={isPersonalWorkspace}
                      onActionPress={handleActionPress}
                    />
                  </View>
                ) : (
                  filteredApps.map((app) => (
                    <View
                      key={app.id}
                      style={responsive.gridColumns === 2 ? { width: '48.8%' } : { width: '100%' }}
                    >
                      <AppCard
                        app={app}
                        isPersonalWorkspace={isPersonalWorkspace}
                        matchingVaultCredentials={findCredentialsForDomain(app.launchUrl || app.name)}
                        onLaunch={handleLaunchApp}
                        onDelete={deletePersonalApp}
                      />
                    </View>
                  ))
                )}
              </View>
            </>
          )}

          {/* Requested Applications & Zero-Trust Governance Queue (SCRUM-67) */}
          {!isPersonalWorkspace && accessRequests.length > 0 && (
            <RequestedAppsSection
              requests={accessRequests}
              pendingCount={pendingRequestsCount}
              onLaunch={handleLaunchApprovedRequest}
            />
          )}
          </View>
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
    paddingBottom: 85,
  },
  topHeader: {
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  brandShield: {
    fontSize: 18,
  },
  brandTitle: {
    color: CyberColors.cyan,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  workspaceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: CyberRadius.full,
    gap: 5,
    flexShrink: 1,
    maxWidth: '64%',
  },
  workspaceBadgeText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 0,
  },
  workspaceBadgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: CyberColors.textMuted,
    flexShrink: 0,
  },
  workspaceBadgeOrg: {
    color: CyberColors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  titleWrap: {
    marginBottom: 10,
  },
  mainTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 17,
    color: CyberColors.textSecondary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  splitActionBtn: {
    flex: 1,
    width: undefined,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CyberColors.cyan,
    borderRadius: CyberRadius.md,
    minHeight: 42,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 5,
    width: '100%',
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
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  primaryActionBtnText: {
    color: CyberColors.textDark,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    minHeight: 42,
    paddingVertical: 10,
    paddingHorizontal: 10,
    width: '100%',
  },
  secondaryActionBtnPressed: {
    opacity: 0.8,
  },
  secondaryActionBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
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
  sessionHeaderContainer: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: CyberColors.background,
    zIndex: 100,
  },
  userSessionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  userInfoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 8,
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: CyberColors.cyan,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatarText: {
    color: CyberColors.cyan,
    fontSize: 13,
    fontWeight: '800',
  },
  userMetaWrap: {
    flex: 1,
  },
  userNameText: {
    color: CyberColors.textPrimary,
    fontSize: 12.5,
    fontWeight: '700',
  },
  userEmailText: {
    color: CyberColors.textMuted,
    fontSize: 10.5,
    marginTop: 1,
  },
  sessionActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  guideHeaderBtn: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: CyberRadius.sm,
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyanMuted,
    borderWidth: 1,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
  guideHeaderBtnText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '800',
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: CyberRadius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
  logoutBtnPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  logoutBtnDisabled: {
    opacity: 0.6,
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: 11.5,
    fontWeight: '700',
  },
});
