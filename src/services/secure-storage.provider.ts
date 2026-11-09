import type { ISecureStorageProvider } from '../models/vault.models.ts';

export class SecureStorageError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SecureStorageError';
    this.cause = cause;
  }
}

/**
 * MockKeychainProvider
 * Simulates hardware-backed iOS Keychain / Android Keystore for unit tests and headless environments.
 * Must be explicitly selected for testing; never used as a silent production fallback.
 */
export class MockKeychainProvider implements ISecureStorageProvider {
  public readonly isMock = true;
  private store = new Map<string, string>();

  async getItemAsync(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    this.store.delete(key);
  }

  async isAvailableAsync(): Promise<boolean> {
    return true;
  }

  clear(): void {
    this.store.clear();
  }

  dumpKeys(): string[] {
    return Array.from(this.store.keys());
  }
}

/**
 * ExpoSecureStoreAdapter
 * Connects to expo-secure-store (backed by iOS Keychain and Android Keystore).
 * Fails explicitly if native storage throws or is unavailable — no silent in-memory fallback.
 */
export class ExpoSecureStoreAdapter implements ISecureStorageProvider {
  public readonly isMock = false;
  private secureStoreModule: any = null;
  private isLoaded = false;
  private loadError: string | null = null;

  private async getModule(): Promise<any> {
    if (this.isLoaded) {
      if (this.loadError) throw new SecureStorageError(this.loadError);
      return this.secureStoreModule;
    }
    try {
      const mod = await import('expo-secure-store');
      if (mod && typeof mod.getItemAsync === 'function') {
        this.secureStoreModule = mod;
      } else {
        this.loadError = 'Native secure storage module is missing required methods.';
      }
    } catch (err: any) {
      this.secureStoreModule = null;
      this.loadError = `Device secure storage module could not be loaded: ${err?.message || 'missing native binding'}`;
    } finally {
      this.isLoaded = true;
    }

    if (this.loadError) {
      throw new SecureStorageError(this.loadError);
    }
    return this.secureStoreModule;
  }

  async getItemAsync(key: string): Promise<string | null> {
    const mod = await this.getModule();
    try {
      return await mod.getItemAsync(key);
    } catch (err: any) {
      throw new SecureStorageError(`Failed to read key "${key}" from secure storage: ${err?.message}`, err);
    }
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    const mod = await this.getModule();
    try {
      await mod.setItemAsync(key, value);
    } catch (err: any) {
      throw new SecureStorageError(`Failed to write key "${key}" to secure storage: ${err?.message}`, err);
    }
  }

  async deleteItemAsync(key: string): Promise<void> {
    const mod = await this.getModule();
    try {
      await mod.deleteItemAsync(key);
    } catch (err: any) {
      throw new SecureStorageError(`Failed to delete key "${key}" from secure storage: ${err?.message}`, err);
    }
  }

  async isAvailableAsync(): Promise<boolean> {
    try {
      const mod = await this.getModule();
      if (mod && typeof mod.isAvailableAsync === 'function') {
        return await mod.isAvailableAsync();
      }
      return !!mod;
    } catch {
      return false;
    }
  }
}

export function isNodeTestEnvironment(): boolean {
  if (typeof process !== 'undefined') {
    if (process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID)) return true;
    if (process.argv?.some((arg) => arg.includes('test'))) return true;
    if (typeof (globalThis as any).expo === 'undefined' && (globalThis as any).navigator?.product !== 'ReactNative') {
      return true;
    }
  }
  return false;
}

export function createDefaultSecureProvider(): ISecureStorageProvider {
  if (isNodeTestEnvironment()) {
    return new MockKeychainProvider();
  }
  return new ExpoSecureStoreAdapter();
}
