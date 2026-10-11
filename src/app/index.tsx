import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { useApps } from '@/context/apps-context';
import { CategoryFilterBar, AppCard, EmptyAppsState } from '@/components/apps';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { SaaSApp } from '@/models/apps.models';

export default function ApplicationsScreen() {
  const {
    isPersonalWorkspace,
    setIsPersonalWorkspace,
    selectedCategory,
    setSelectedCategory,
    activeAppsList,
    filteredApps,
    findCredentialsForDomain,
    deletePersonalApp,
    refreshApps,
    isLoading,
  } = useApps();

  const [refreshing, setRefreshing] = useState(false);

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

  const handleActionPress = () => {
    if (isPersonalWorkspace) {
      Alert.alert(
        'Add Application',
        'Quick Preset application modal will open (Ticket SCRUM-65).'
      );
    } else {
      Alert.alert(
        'Request Application Access',
        'Enterprise access request modal will open (Ticket SCRUM-66).'
      );
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
        </ScrollView>
      </SafeAreaView>
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
});
