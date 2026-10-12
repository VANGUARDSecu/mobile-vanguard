import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { UserConnectedApp } from '@/models/apps.models';
import { CyberColors } from '@/constants/cyber-theme';
import { PulseDot } from './pulse-dot';
import { ConnectedAppCard } from './connected-app-card';

export interface ConnectedAppsSectionProps {
  connectedApps: UserConnectedApp[];
  onLaunch: (app: UserConnectedApp) => void;
  onDisconnect: (clientId: string, clientName: string) => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function ConnectedAppsSection({
  connectedApps,
  onLaunch,
  onDisconnect,
  onSync,
  isSyncing = false,
}: ConnectedAppsSectionProps) {
  if (!connectedApps || connectedApps.length === 0) {
    return null;
  }

  const countText = `${connectedApps.length} Active Connection${
    connectedApps.length === 1 ? '' : 's'
  }`;

  return (
    <View style={styles.container} testID="connected-apps-section">
      {/* Sub-Section Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>
              Active SSO Integrations & Connected Applications
            </Text>

            {/* Active Pulse Badge */}
            <View style={styles.activePulseBadge}>
              <PulseDot size={6} color={CyberColors.green} />
              <Text style={styles.activePulseText}>{countText}</Text>
            </View>
          </View>

          {/* Optional Live Sync Trigger */}
          {onSync ? (
            <Pressable
              style={({ pressed }) => [
                styles.syncBtn,
                pressed && styles.syncBtnPressed,
              ]}
              onPress={onSync}
              disabled={isSyncing}
              accessibilityRole="button"
              accessibilityLabel="Sync SSO Connections from Identity Provider"
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={CyberColors.cyan} />
              ) : (
                <>
                  <Text style={styles.syncIcon}>↻</Text>
                  <Text style={styles.syncText}>Sync SSO</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.subtitle}>
          External client applications actively connected to your Vanguard Security identity via Single Sign-On.
        </Text>
      </View>

      {/* Connected Cards List */}
      <View style={styles.cardsList}>
        {connectedApps.map((app) => (
          <ConnectedAppCard
            key={app.clientId || app.id}
            app={app}
            onLaunch={onLaunch}
            onDisconnect={onDisconnect}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.2)',
  },
  header: {
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  titleWrap: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    letterSpacing: 0.3,
  },
  activePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activePulseText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  syncBtnPressed: {
    opacity: 0.7,
  },
  syncIcon: {
    color: CyberColors.cyan,
    fontSize: 14,
    fontWeight: '900',
  },
  syncText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    color: CyberColors.textSecondary,
  },
  cardsList: {
    marginTop: 6,
  },
});
