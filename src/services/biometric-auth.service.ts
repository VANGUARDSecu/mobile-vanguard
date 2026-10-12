import vaultService from './vault.service.ts';

const isWebRuntime = (): boolean => {
  return (
    (typeof window !== 'undefined' && typeof document !== 'undefined') ||
    (typeof process !== 'undefined' && process.env?.EXPO_OS === 'web')
  );
};

export type BiometricType = 'FaceID' | 'Fingerprint' | 'Iris' | 'Biometrics' | 'None';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  warning?: string;
}

export interface BiometricPromptOptions {
  promptMessage?: string;
  cancelLabel?: string;
  fallbackLabel?: string;
  disableDeviceFallback?: boolean;
}

export interface IBiometricAuthProvider {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  supportedAuthenticationTypesAsync(): Promise<number[]>;
  authenticateAsync(options?: BiometricPromptOptions): Promise<BiometricAuthResult>;
}

/**
 * Native runtime adapter leveraging expo-local-authentication
 */
export class ExpoBiometricAdapter implements IBiometricAuthProvider {
  private localAuthModule: any = null;

  private async getModule(): Promise<any> {
    if (!this.localAuthModule) {
      try {
        this.localAuthModule = await import('expo-local-authentication');
      } catch {
        this.localAuthModule = null;
      }
    }
    return this.localAuthModule;
  }

  async hasHardwareAsync(): Promise<boolean> {
    if (isWebRuntime()) return true;
    const mod = await this.getModule();
    if (!mod || typeof mod.hasHardwareAsync !== 'function') return false;
    try {
      return await mod.hasHardwareAsync();
    } catch {
      return false;
    }
  }

  async isEnrolledAsync(): Promise<boolean> {
    if (isWebRuntime()) return true;
    const mod = await this.getModule();
    if (!mod || typeof mod.isEnrolledAsync !== 'function') return false;
    try {
      return await mod.isEnrolledAsync();
    } catch {
      return false;
    }
  }

  async supportedAuthenticationTypesAsync(): Promise<number[]> {
    if (isWebRuntime()) return [2]; // FaceID / WebAuthn simulation
    const mod = await this.getModule();
    if (!mod || typeof mod.supportedAuthenticationTypesAsync !== 'function') return [];
    try {
      return await mod.supportedAuthenticationTypesAsync();
    } catch {
      return [];
    }
  }

  async authenticateAsync(options?: BiometricPromptOptions): Promise<BiometricAuthResult> {
    if (isWebRuntime()) {
      // Web preview runtime: simulated Zero-Trust WebAuthn / Face ID attestation
      return { success: true };
    }

    const mod = await this.getModule();
    if (!mod || typeof mod.authenticateAsync !== 'function') {
      return { success: false, error: 'Local authentication native module not available' };
    }

    try {
      const res = await mod.authenticateAsync({
        promptMessage: options?.promptMessage || 'Unlock Vanguard Authenticator Vault',
        cancelLabel: options?.cancelLabel || 'Cancel',
        fallbackLabel: options?.fallbackLabel || 'Use Device Passcode',
        disableDeviceFallback: options?.disableDeviceFallback ?? false,
      });

      return {
        success: !!res.success,
        error: res.error,
        warning: res.warning,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Biometric authentication error',
      };
    }
  }
}

/**
 * Mock biometric provider for headless CI and automated unit testing
 */
export class MockBiometricProvider implements IBiometricAuthProvider {
  public hasHardware: boolean = true;
  public isEnrolled: boolean = true;
  public supportedTypes: number[] = [2]; // Default to Face ID (2)
  public shouldSucceed: boolean = true;
  public simulatedError: string = 'User cancelled biometric challenge';
  public authenticateCallCount: number = 0;

  async hasHardwareAsync(): Promise<boolean> {
    return this.hasHardware;
  }

  async isEnrolledAsync(): Promise<boolean> {
    return this.isEnrolled;
  }

  async supportedAuthenticationTypesAsync(): Promise<number[]> {
    return [...this.supportedTypes];
  }

  async authenticateAsync(_options?: BiometricPromptOptions): Promise<BiometricAuthResult> {
    this.authenticateCallCount++;
    if (this.shouldSucceed) {
      return { success: true };
    }
    return {
      success: false,
      error: this.simulatedError,
    };
  }
}

/**
 * Biometric authentication service managing Face ID / Fingerprint / Passcode access control (SCRUM-20)
 */
export class BiometricAuthService {
  private provider: IBiometricAuthProvider;
  private promptActive: boolean = false;
  private isSettling: boolean = false;
  private settlingTimer: any = null;
  private lastAuthenticationTimestamp: number = 0;

  constructor(provider?: IBiometricAuthProvider) {
    this.provider = provider || new ExpoBiometricAdapter();
  }

  setProvider(provider: IBiometricAuthProvider): void {
    this.provider = provider;
  }

  getProvider(): IBiometricAuthProvider {
    return this.provider;
  }

  /**
   * Indicates whether a native biometric prompt is actively presented on screen,
   * or within the post-dismissal OS AppState transition settling grace period.
   */
  isAuthenticationInFlight(): boolean {
    return this.promptActive || this.isSettling;
  }

  /**
   * Returns epoch timestamp (ms) of the most recent successful biometric/passcode challenge.
   */
  getLastAuthenticationTimestamp(): number {
    return this.lastAuthenticationTimestamp;
  }

  /**
   * Records a verified authentication occurrence to debounce redundant challenges.
   */
  recordAuthenticationSuccess(): void {
    this.lastAuthenticationTimestamp = Date.now();
  }

  /**
   * Evaluates biometric sensor capabilities and resolves user-friendly biometric badge
   */
  async checkAvailability(): Promise<{
    hasHardware: boolean;
    isEnrolled: boolean;
    biometricType: BiometricType;
  }> {
    try {
      const hasHardware = await this.provider.hasHardwareAsync();
      const isEnrolled = await this.provider.isEnrolledAsync();
      const supportedTypes = await this.provider.supportedAuthenticationTypesAsync();

      let biometricType: BiometricType = 'None';
      if (hasHardware && isEnrolled) {
        if (supportedTypes.includes(2)) {
          biometricType = 'FaceID';
        } else if (supportedTypes.includes(1)) {
          biometricType = 'Fingerprint';
        } else if (supportedTypes.includes(3)) {
          biometricType = 'Iris';
        } else if (supportedTypes.length > 0) {
          biometricType = 'Biometrics';
        }
      }

      return { hasHardware, isEnrolled, biometricType };
    } catch {
      return { hasHardware: false, isEnrolled: false, biometricType: 'None' };
    }
  }

  /**
   * Prompts native biometric challenge with automatic passcode fallback
   */
  async authenticate(options?: BiometricPromptOptions): Promise<BiometricAuthResult> {
    if (this.promptActive) {
      return { success: false, error: 'Authentication challenge already in progress' };
    }

    if (this.settlingTimer) {
      clearTimeout(this.settlingTimer);
      this.settlingTimer = null;
    }

    this.promptActive = true;
    this.isSettling = true;

    try {
      const promptMessage = options?.promptMessage || 'Unlock Vanguard Authenticator Vault';
      const res = await this.provider.authenticateAsync({
        promptMessage,
        cancelLabel: options?.cancelLabel || 'Cancel',
        fallbackLabel: options?.fallbackLabel || 'Use Device Passcode',
        disableDeviceFallback: options?.disableDeviceFallback ?? false,
      });

      if (res.success) {
        this.lastAuthenticationTimestamp = Date.now();
      }

      return res;
    } finally {
      this.promptActive = false;
      // Keep isSettling active for 1500ms after the native modal is dismissed to prevent
      // OS AppState changes (inactive -> active) from triggering secondary lock challenges.
      this.settlingTimer = setTimeout(() => {
        this.isSettling = false;
        this.settlingTimer = null;
      }, 1500);
    }
  }

  /**
   * Checks whether the user policy requires biometric unlock on app launch/resume
   */
  async isBiometricsRequiredOnLaunch(): Promise<boolean> {
    try {
      const settings = await vaultService.getSettings();
      return !!settings.biometricsEnabled;
    } catch {
      return true; // Zero-Trust default
    }
  }

  /**
   * Settings toggle: "Require Biometrics on Launch" with instant state update (SCRUM-20)
   */
  async setBiometricsRequiredOnLaunch(enabled: boolean): Promise<boolean> {
    const updated = await vaultService.updateSettings({
      biometricsEnabled: enabled,
    });
    return !!updated.biometricsEnabled;
  }
}

export const biometricService = new BiometricAuthService();
export default biometricService;
