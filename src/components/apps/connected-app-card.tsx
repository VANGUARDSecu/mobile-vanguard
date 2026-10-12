import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { UserConnectedApp } from '@/models/apps.models';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { PulseDot } from './pulse-dot';

export interface ConnectedAppCardProps {
  app: UserConnectedApp;
  onLaunch: (app: UserConnectedApp) => void;
  onDisconnect: (clientId: string, clientName: string) => void;
}

export function ConnectedAppCard({
  app,
  onLaunch,
  onDisconnect,
}: ConnectedAppCardProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyClientId = async () => {
    try {
      await Clipboard.setStringAsync(app.clientId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Non-blocking clipboard fallback
    }
  };

  const handleTargetUrlPress = () => {
    onLaunch(app);
  };

  return (
    <View style={styles.card} testID={`connected-app-card-${app.clientId}`}>
      {/* Top Bar: Icon Box and Badges */}
      <View style={styles.topBar}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>{app.icon || '🌐'}</Text>
        </View>

        <View style={styles.badgesWrap}>
          {/* Currently Connected Live Status Pill */}
          <View style={styles.statusLivePill}>
            <PulseDot size={6} color={CyberColors.green} />
            <Text style={styles.statusLiveText}>Currently Connected</Text>
          </View>

          {/* Protocol Tag */}
          <View style={styles.protoTag}>
            <Text style={styles.protoTagText}>{app.protocol || 'OIDC 1.0 PKCE'}</Text>
          </View>
        </View>
      </View>

      {/* Body: Title, Target URL & Description */}
      <View style={styles.cardBody}>
        <Text style={styles.title}>{app.clientName}</Text>

        {/* Target URL Pill */}
        {app.originUrl ? (
          <Pressable
            style={({ pressed }) => [
              styles.targetUrlPill,
              pressed && styles.targetUrlPillPressed,
            ]}
            onPress={handleTargetUrlPress}
            accessibilityRole="link"
            accessibilityLabel={`Target URL: ${app.originUrl}`}
          >
            <Text style={styles.targetUrlLabel}>Target URL:</Text>
            <Text style={styles.targetUrlText} numberOfLines={1}>
              {app.originUrl}
            </Text>
            <Text style={styles.targetUrlArrow}>↗</Text>
          </Pressable>
        ) : null}

        {app.description ? (
          <Text style={styles.description}>{app.description}</Text>
        ) : null}

        {/* Metadata Inspection Table */}
        <View style={styles.metaTable}>
          {/* Client ID Row */}
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Client ID:</Text>
            <View style={styles.metaValueWrap}>
              <View style={styles.codePill}>
                <Text style={styles.codeText} numberOfLines={1}>
                  {app.clientId}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.copyBtn,
                  copied && styles.copyBtnSuccess,
                  pressed && styles.copyBtnPressed,
                ]}
                onPress={handleCopyClientId}
                accessibilityRole="button"
                accessibilityLabel="Copy Client ID"
              >
                <Text style={[styles.copyBtnText, copied && styles.copyBtnTextSuccess]}>
                  {copied ? '✓ Copied' : '📋 Copy'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Redirect URI Row */}
          {app.redirectUri ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Redirect URI:</Text>
              <Text style={styles.metaValueMono} numberOfLines={1}>
                {app.redirectUri}
              </Text>
            </View>
          ) : null}

          {/* Authorized Scopes Row */}
          <View style={styles.metaRowVertical}>
            <Text style={styles.metaKey}>Authorized Scopes:</Text>
            <View style={styles.scopesWrap}>
              {app.scopes && app.scopes.length > 0 ? (
                app.scopes.map((scope) => (
                  <View key={scope} style={styles.scopeChip}>
                    <Text style={styles.scopeChipText}>{scope}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.metaValueMono}>None specified</Text>
              )}
            </View>
          </View>

          {/* Connection Status Row */}
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Connection Status:</Text>
            <Text style={styles.metaValueActive}>
              Active Session • {app.lastActiveAt || 'Just now'}
            </Text>
          </View>
        </View>
      </View>

      {/* Card Actions */}
      <View style={styles.cardActions}>
        <Pressable
          style={({ pressed }) => [
            styles.btnLaunch,
            pressed && styles.btnLaunchPressed,
          ]}
          onPress={() => onLaunch(app)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${app.clientName}`}
        >
          <Text style={styles.btnLaunchText}>Open {app.clientName}</Text>
          <Text style={styles.btnLaunchIcon}>↗</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.btnDisconnect,
            pressed && styles.btnDisconnectPressed,
          ]}
          onPress={() => onDisconnect(app.clientId, app.clientName)}
          accessibilityRole="button"
          accessibilityLabel={`Disconnect ${app.clientName}`}
        >
          <Text style={styles.btnDisconnectText}>Disconnect</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0d1542',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.lg,
    padding: 16,
    marginBottom: 16,
    shadowColor: CyberColors.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  badgesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  statusLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusLiveText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  protoTag: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderColor: 'rgba(129, 140, 248, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  protoTagText: {
    color: '#818cf8',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardBody: {
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: CyberColors.textPrimary,
    marginBottom: 6,
  },
  targetUrlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  targetUrlPillPressed: {
    opacity: 0.7,
  },
  targetUrlLabel: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  targetUrlText: {
    color: '#60a5fa',
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    flexShrink: 1,
  },
  targetUrlArrow: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700',
  },
  description: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#cbd5e1',
    marginBottom: 12,
  },
  metaTable: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaRowVertical: {
    flexDirection: 'column',
    gap: 5,
  },
  metaKey: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  metaValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  codePill: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 150,
  },
  codeText: {
    color: '#e2e8f0',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
  },
  copyBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  copyBtnSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  copyBtnPressed: {
    opacity: 0.7,
  },
  copyBtnText: {
    color: '#60a5fa',
    fontSize: 10.5,
    fontWeight: '600',
  },
  copyBtnTextSuccess: {
    color: '#34d399',
    fontWeight: '700',
  },
  metaValueMono: {
    color: '#e2e8f0',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    flexShrink: 1,
  },
  metaValueActive: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  scopesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  scopeChip: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  scopeChipText: {
    color: '#93c5fd',
    fontSize: 10,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnLaunch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderColor: '#059669',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 6,
    shadowColor: CyberColors.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  btnLaunchPressed: {
    backgroundColor: '#059669',
    opacity: 0.9,
  },
  btnLaunchText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnLaunchIcon: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  btnDisconnect: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisconnectPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderColor: '#ef4444',
  },
  btnDisconnectText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
