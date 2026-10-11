import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BiometricAuthService,
  MockBiometricProvider,
} from '../services/biometric-auth.service.ts';
import vaultService from '../services/vault.service.ts';
import { MockKeychainProvider } from '../services/secure-storage.provider.ts';

test('Biometric Authentication (FaceID / Fingerprint) for App Lock (SCRUM-20)', async (t) => {
  const mockStorage = new MockKeychainProvider();
  vaultService.setStorageProvider(mockStorage);

  await t.test('1. Sensor availability & biometric hardware type resolution', async () => {
    const mockProvider = new MockBiometricProvider();
    const service = new BiometricAuthService(mockProvider);

    // Test Face ID detection (type 2)
    mockProvider.hasHardware = true;
    mockProvider.isEnrolled = true;
    mockProvider.supportedTypes = [2];

    const faceIdInfo = await service.checkAvailability();
    assert.equal(faceIdInfo.hasHardware, true);
    assert.equal(faceIdInfo.isEnrolled, true);
    assert.equal(faceIdInfo.biometricType, 'FaceID');

    // Test Fingerprint / Touch ID detection (type 1)
    mockProvider.supportedTypes = [1];
    const fpInfo = await service.checkAvailability();
    assert.equal(fpInfo.biometricType, 'Fingerprint');

    // Test Unenrolled sensor
    mockProvider.isEnrolled = false;
    const unenrolledInfo = await service.checkAvailability();
    assert.equal(unenrolledInfo.biometricType, 'None');

    // Test Hardware not available
    mockProvider.hasHardware = false;
    const noHwInfo = await service.checkAvailability();
    assert.equal(noHwInfo.biometricType, 'None');
  });

  await t.test('2. Successful biometric authentication unlocks access', async () => {
    const mockProvider = new MockBiometricProvider();
    mockProvider.shouldSucceed = true;
    const service = new BiometricAuthService(mockProvider);

    const result = await service.authenticate({
      promptMessage: 'Unlock Vanguard Authenticator Vault',
    });

    assert.equal(result.success, true);
    assert.equal(mockProvider.authenticateCallCount, 1);
    assert.equal(result.error, undefined);
  });

  await t.test('3. Failed or canceled biometric challenge denies access and preserves lock', async () => {
    const mockProvider = new MockBiometricProvider();
    mockProvider.shouldSucceed = false;
    mockProvider.simulatedError = 'User cancelled biometric recognition prompt';
    const service = new BiometricAuthService(mockProvider);

    const result = await service.authenticate();

    assert.equal(result.success, false);
    assert.equal(mockProvider.authenticateCallCount, 1);
    assert.equal(result.error, 'User cancelled biometric recognition prompt');
  });

  await t.test('4. Passcode fallback mechanism allows device passcode', async () => {
    const mockProvider = new MockBiometricProvider();
    mockProvider.shouldSucceed = true;
    const service = new BiometricAuthService(mockProvider);

    const result = await service.authenticate({
      promptMessage: 'Enter Device Passcode',
      disableDeviceFallback: false,
    });

    assert.equal(result.success, true);
    assert.equal(mockProvider.authenticateCallCount, 1);
  });

  await t.test('5. Settings toggle: Require Biometrics on Launch updates policy instantly', async () => {
    const mockProvider = new MockBiometricProvider();
    const service = new BiometricAuthService(mockProvider);

    // Default policy check
    const initial = await service.isBiometricsRequiredOnLaunch();
    assert.equal(typeof initial, 'boolean');

    // Toggle OFF
    const offResult = await service.setBiometricsRequiredOnLaunch(false);
    assert.equal(offResult, false);
    assert.equal(await service.isBiometricsRequiredOnLaunch(), false);

    // Toggle ON
    const onResult = await service.setBiometricsRequiredOnLaunch(true);
    assert.equal(onResult, true);
    assert.equal(await service.isBiometricsRequiredOnLaunch(), true);
  });

  await t.test('6. AppState lifecycle lock simulation preserves Zero-Trust security', async () => {
    const mockProvider = new MockBiometricProvider();
    const service = new BiometricAuthService(mockProvider);

    // Ensure biometrics required
    await service.setBiometricsRequiredOnLaunch(true);

    let isLocked = false;
    let authPromptedOnResume = false;

    // Simulate AppState event handler
    const simulateAppStateTransition = async (nextState: 'active' | 'background' | 'inactive') => {
      const required = await service.isBiometricsRequiredOnLaunch();
      if (nextState === 'background' || nextState === 'inactive') {
        if (required) {
          isLocked = true;
        }
      } else if (nextState === 'active') {
        if (required && isLocked) {
          authPromptedOnResume = true;
          const authRes = await service.authenticate();
          if (authRes.success) {
            isLocked = false;
          }
        }
      }
    };

    // Transition to background
    await simulateAppStateTransition('background');
    assert.equal(isLocked, true, 'Vault must lock when app moves to background');

    // Transition back to active -> triggers biometric challenge and unlocks on success
    await simulateAppStateTransition('active');
    assert.equal(authPromptedOnResume, true, 'Biometric challenge must prompt on resume');
    assert.equal(isLocked, false, 'Successful biometric authentication unlocks the vault');

    // If biometrics is toggled OFF, backgrounding must not trigger lock
    await service.setBiometricsRequiredOnLaunch(false);
    isLocked = false;
    await simulateAppStateTransition('background');
    assert.equal(isLocked, false, 'Vault remains unlocked if biometrics policy is disabled');
  });
});
