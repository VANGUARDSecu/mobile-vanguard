import type { ISecureStorageProvider } from '../models/vault.models.ts';

/**
 * MockKeychainProvider
 * Simulates hardware-backed iOS Keychain / Android Keystore for unit tests and headless environments.
 */
export class MockKeychainProvider implements ISecureStorageProvider {
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
 * Connects to expo-secure-store (backed by iOS Keychain and Android Keystore) on mobile devices.
 * Gracefully falls back if native module is not linked in non-native environments.
 */
export class ExpoSecureStoreAdapter implements ISecureStorageProvider {
  private secureStoreModule: any = null;
  private isLoaded = false;
  private fallbackStore: MockKeychainProvider = new MockKeychainProvider();

  private async getModule(): Promise<any> {
    if (this.isLoaded) return this.secureStoreModule;
    try {
      // Dynamic import to prevent bundler failure in test environments lacking native bindings
      const mod = await import('expo-secure-store');
      if (mod && typeof mod.getItemAsync === 'function') {
        this.secureStoreModule = mod;
      }
    } catch {
      this.secureStoreModule = null;
    } finally {
      this.isLoaded = true;
    }
    return this.secureStoreModule;
  }

  async getItemAsync(key: string): Promise<string | null> {
    const mod = await this.getModule();
    if (mod) {
      try {
        return await mod.getItemAsync(key);
      } catch {
        return this.fallbackStore.getItemAsync(key);
      }
    }
    return this.fallbackStore.getItemAsync(key);
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    const mod = await this.getModule();
    if (mod) {
      try {
        await mod.setItemAsync(key, value);
        return;
      } catch {
        await this.fallbackStore.setItemAsync(key, value);
        return;
      }
    }
    await this.fallbackStore.setItemAsync(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    const mod = await this.getModule();
    if (mod) {
      try {
        await mod.deleteItemAsync(key);
        return;
      } catch {
        await this.fallbackStore.deleteItemAsync(key);
        return;
      }
    }
    await this.fallbackStore.deleteItemAsync(key);
  }

  async isAvailableAsync(): Promise<boolean> {
    const mod = await this.getModule();
    if (mod && typeof mod.isAvailableAsync === 'function') {
      try {
        return await mod.isAvailableAsync();
      } catch {
        return true;
      }
    }
    return true;
  }
}

export function createDefaultSecureProvider(): ISecureStorageProvider {
  return new ExpoSecureStoreAdapter();
}
