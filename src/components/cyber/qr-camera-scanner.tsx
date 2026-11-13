import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from 'expo-camera';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { CyberButton } from './cyber-button';

export interface QrCameraScannerProps {
  title?: string;
  subtitle?: string;
  onScan: (data: string) => void;
  onCancel?: () => void;
  testID?: string;
}

/**
 * Reusable live camera QR code scanner built on expo-camera.
 * Handles permission prompting, settings deep-linking when permanently denied,
 * and single-shot scan debouncing with a reset control.
 */
export function QrCameraScanner({
  title = 'ALIGN QR CODE WITHIN FRAME',
  subtitle = 'Point your camera at the QR code to scan automatically.',
  onScan,
  onCancel,
  testID = 'qr-camera-scanner',
}: QrCameraScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const scanLockRef = useRef(false);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanLockRef.current) {
      return;
    }

    const payload = result?.data?.trim();
    if (!payload) {
      return;
    }

    scanLockRef.current = true;
    setScanned(true);
    onScan(payload);
  };

  const handleResetScan = () => {
    scanLockRef.current = false;
    setScanned(false);
  };

  if (!permission) {
    return (
      <View style={styles.stateContainer} testID={testID}>
        <ActivityIndicator size="large" color={CyberColors.cyan} />
        <Text style={styles.stateTitle}>INITIALIZING CAMERA...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    const blocked = permission.canAskAgain === false;
    return (
      <View style={styles.stateContainer} testID={testID}>
        <Text style={styles.stateIcon}>📷</Text>
        <Text style={styles.stateTitle}>CAMERA ACCESS REQUIRED</Text>
        <Text style={styles.stateSubtitle}>
          {blocked
            ? 'Camera permission is disabled for Vanguard. Enable it in your device settings to scan QR codes.'
            : 'Vanguard needs camera access to scan authenticator and device pairing QR codes.'}
        </Text>
        <View style={styles.actionsColumn}>
          {blocked ? (
            <CyberButton
              title="Open Device Settings"
              variant="primary"
              size="md"
              onPress={() => {
                Linking.openSettings().catch(() => {});
              }}
              testID="qr-open-settings-button"
            />
          ) : (
            <CyberButton
              title="Allow Camera Access"
              variant="primary"
              size="md"
              onPress={() => {
                requestPermission().catch(() => {});
              }}
              testID="qr-request-permission-button"
            />
          )}
          {onCancel ? (
            <CyberButton
              title="Cancel"
              variant="ghost"
              size="sm"
              onPress={onCancel}
              testID="qr-cancel-button"
            />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper} testID={testID}>
      <View style={styles.cameraFrame}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>
      </View>

      <Text style={styles.captionTitle}>{title}</Text>
      <Text style={styles.captionSubtitle}>{subtitle}</Text>

      <View style={styles.controlsRow}>
        {scanned ? (
          <CyberButton
            title="Scan Again"
            variant="primary"
            size="md"
            onPress={handleResetScan}
            style={styles.controlButton}
            testID="qr-rescan-button"
          />
        ) : null}
        {onCancel ? (
          <CyberButton
            title="Cancel"
            variant="ghost"
            size="md"
            onPress={onCancel}
            style={styles.controlButton}
            testID="qr-cancel-button"
          />
        ) : null}
      </View>
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  cameraFrame: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 320,
    borderRadius: CyberRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CyberColors.borderHighlight,
    backgroundColor: CyberColors.background,
    position: 'relative',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 14, 26, 0.25)',
  },
  reticle: {
    width: 196,
    height: 196,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CyberColors.cyan,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 6,
  },
  captionTitle: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  captionSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  controlButton: {
    flex: 1,
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 12,
  },
  stateIcon: {
    fontSize: 38,
  },
  stateTitle: {
    color: CyberColors.cyan,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  stateSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionsColumn: {
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
});
