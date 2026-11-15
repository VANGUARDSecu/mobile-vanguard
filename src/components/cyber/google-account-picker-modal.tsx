import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import {
  AuthService,
  type GoogleAccountProfile,
} from '@/services/auth.service';
import { parseGoogleOAuthCallbackUrl } from '@/utils/registration-wizard';
import { GoogleLogo } from './google-logo';

export interface GoogleAccountPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAccount: (account: GoogleAccountProfile) => Promise<void> | void;
  title?: string;
}

/**
 * Launches Google Browser OAuth via expo-web-browser and returns the verified
 * GoogleAccountProfile extracted from the OAuth callback token (#access_token=...).
 * Never permits unverified manual email entry.
 */
export async function launchGoogleBrowserOAuthSession(): Promise<GoogleAccountProfile | null> {
  const redirectUri = Linking.createURL('login');
  const oauthUrl = await AuthService.getGoogleOAuthUrl(redirectUri);
  const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUri);

  if (result.type === 'success' && result.url) {
    const parsed = parseGoogleOAuthCallbackUrl(result.url);
    if (!parsed || !parsed.accessToken) {
      throw new Error(
        'Google OAuth callback did not include a valid access token.'
      );
    }
    return parsed;
  }

  return null;
}

/**
 * Strict Google Browser OAuth modal with zero local bypass.
 */
export function GoogleAccountPickerModal({
  visible,
  onClose,
  onSelectAccount,
  title = 'Continue with Google',
}: GoogleAccountPickerModalProps) {
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleLaunchBrowserOAuth = async () => {
    setIsBusy(true);
    setErrorText(null);
    try {
      const parsed = await launchGoogleBrowserOAuthSession();
      if (parsed) {
        await onSelectAccount(parsed);
      }
    } catch (err: unknown) {
      setErrorText(
        err instanceof Error
          ? err.message
          : 'Could not complete Google Browser OAuth.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="google-account-picker-modal">
          <View style={styles.header}>
            <View style={styles.googleLogoBadge}>
              <GoogleLogo size={24} />
            </View>
            <Text style={styles.headerBrand}>Google OAuth 2.0</Text>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSubtitle}>
              Authenticate in your browser to continue to{' '}
              <Text style={styles.brandHighlight}>Vanguard Security</Text>
            </Text>
          </View>

          {errorText ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {errorText}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.browserOAuthBtn,
              pressed && styles.browserOAuthBtnPressed,
            ]}
            disabled={isBusy}
            onPress={handleLaunchBrowserOAuth}
            testID="google-browser-oauth-button"
          >
            <View style={styles.googleLogoSmallWrap}>
              <GoogleLogo size={16} />
            </View>
            <Text style={styles.browserOAuthText}>
              Continue via Google Browser OAuth ↗
            </Text>
          </Pressable>

          {isBusy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator size="small" color={CyberColors.cyan} />
              <Text style={styles.busyText}>
                Waiting for Google Browser OAuth...
              </Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.privacyNotice}>
              You will be redirected to Google to select your Google account and
              complete Vanguard 2-Step Verification.
            </Text>
            <Pressable
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isBusy}
              testID="google-picker-close-button"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 22, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0f172a',
    borderRadius: CyberRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.45)',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.2)',
    paddingBottom: 14,
    marginBottom: 14,
  },
  googleLogoBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerBrand: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerTitle: {
    color: CyberColors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    marginTop: 4,
    textAlign: 'center',
  },
  brandHighlight: {
    color: CyberColors.cyan,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
  },
  browserOAuthBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: CyberRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  browserOAuthBtnPressed: {
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    borderColor: '#4285F4',
  },
  googleLogoSmallWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  browserOAuthText: {
    color: CyberColors.textPrimary,
    fontSize: 13.5,
    fontWeight: '700',
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  busyText: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.2)',
    gap: 10,
  },
  privacyNotice: {
    color: CyberColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  cancelBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 18,
  },
  cancelBtnText: {
    color: CyberColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
});
