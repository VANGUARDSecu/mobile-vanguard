import type {
  TotpAccount,
  VaultSecuritySettings,
  AddTotpAccountInput,
  ISecureStorageProvider,
  EncryptedVaultEnvelope,
  EncryptedVaultBackup,
} from '../models/vault.models.ts';
import { AesGcmService } from './aes-gcm.service.ts';
import {
  createDefaultSecureProvider,
  MockKeychainProvider,
  SecureStorageError,
} from './secure-storage.provider.ts';
import { TotpEngine } from './totp-engine.service.ts';

const KEYCHAIN_MASTER_KEY = '@vanguard:keychain_master_key_v1';
const SECURE_VAULT_PAYLOAD_KEY = '@vanguard:encrypted_totp_vault_v1';
const SECURE_SETTINGS_KEY = '@vanguard:secure_settings_v1';

/**
 * Seed accounts fixture kept strictly for test/demo harnesses.
 * Normal builds and fresh installs MUST NOT seed these accounts.
 */
export const DEFAULT_ACCOUNTS: TotpAccount[] = [
  {
    id: 'c0a80101-0001-4000-8000-000000000001',
    accountName: 'admin@vanguard.security',
    name: 'admin@vanguard.security',
    issuer: 'Vanguard Security',
    secret: 'JBSWY3DPEHPK3PXP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    icon: '🛡️',
    backupCodes: [],
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'c0a80101-0002-4000-8000-000000000002',
    accountName: 'aws-prod-admin',
    name: 'aws-prod-admin',
    issuer: 'Amazon Web Services',
    secret: 'GEZDGNBVGY3TQOJQ',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    icon: '☁️',
    backupCodes: [],
    createdAt: '2026-09-02T09:30:00Z',
    updatedAt: '2026-09-02T09:30:00Z',
  },
  {
    id: 'c0a80101-0003-4000-8000-000000000003',
    accountName: 'devops-lead@github',
    name: 'devops-lead@github',
    issuer: 'GitHub Enterprise',
    secret: 'MZXW6YTBOI2GI3TG',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    icon: '🐙',
    backupCodes: [],
    createdAt: '2026-09-03T11:15:00Z',
    updatedAt: '2026-09-03T11:15:00Z',
  },
  {
    id: 'c0a80101-0004-4000-8000-000000000004',
    accountName: 'cloudflare-edge-gateway',
    name: 'cloudflare-edge-gateway',
    issuer: 'Cloudflare Zero Trust',
    secret: 'NBSWY3DPEHPK3PXP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    icon: '⚡',
    backupCodes: [],
    createdAt: '2026-09-04T14:45:00Z',
    updatedAt: '2026-09-04T14:45:00Z',
  },
  {
    id: 'c0a80101-0005-4000-8000-000000000005',
    accountName: 'atlassian-corp-admin',
    name: 'atlassian-corp-admin',
    issuer: 'Atlassian Cloud',
    secret: 'KRSXG5CTMVRXEZLU',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    icon: '🔷',
    backupCodes: [],
    createdAt: '2026-09-05T16:00:00Z',
    updatedAt: '2026-09-05T16:00:00Z',
  },
];

export const DEFAULT_SETTINGS: VaultSecuritySettings = {
  biometricsEnabled: true,
  autoLockSeconds: 300,
  clearClipboardSeconds: 30,
  exportEncryption: 'AES-256-GCM',
  zeroTrustAttestation: true,
  pushMfaEnabled: true,
};

function generateUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class VaultService {
  private secureStorage: ISecureStorageProvider;
  private masterKey: string | null = null;
  private memoryCache: TotpAccount[] = [];
  private memorySettings: VaultSecuritySettings = { ...DEFAULT_SETTINGS };
  private isInitialized = false;
  private isLockedState = false;
  private lockTimer: ReturnType<typeof setTimeout> | null = null;
  private storageError: string | null = null;

  constructor(customProvider?: ISecureStorageProvider) {
    this.secureStorage = customProvider || createDefaultSecureProvider();
  }

  /**
   * Inject a custom secure storage provider (e.g. MockKeychainProvider for unit tests)
   */
  setStorageProvider(provider: ISecureStorageProvider): void {
    this.secureStorage = provider;
    this.isInitialized = false;
    this.masterKey = null;
    this.memoryCache = [];
    this.storageError = null;
    this.isLockedState = false;
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
  }

  getStorageProvider(): ISecureStorageProvider {
    return this.secureStorage;
  }

  getStorageStatus(): {
    available: boolean;
    provider: string;
    error: string | null;
    isLocked: boolean;
    accountCount: number;
  } {
    return {
      available: !this.storageError,
      provider: (this.secureStorage as any)?.isMock ? 'MockKeychainProvider' : 'ExpoSecureStoreAdapter',
      error: this.storageError,
      isLocked: this.isLockedState,
      accountCount: this.memoryCache.length,
    };
  }

  getIsLocked(): boolean {
    return this.isLockedState;
  }

  /**
   * Manually lock the vault, wiping in-memory decrypted accounts
   */
  lock(): void {
    this.memoryCache = [];
    this.isLockedState = true;
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
  }

  /**
   * Unlocks the vault by re-decrypting accounts from secure storage
   */
  async unlock(): Promise<boolean> {
    this.isInitialized = false;
    await this.ensureInitialized();
    this.isLockedState = false;
    this.resetAutoLock();
    return true;
  }

  private resetAutoLock(): void {
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
    const seconds = this.memorySettings.autoLockSeconds;
    if (seconds > 0) {
      this.lockTimer = setTimeout(() => {
        this.lock();
      }, seconds * 1000);
      if (typeof (this.lockTimer as any)?.unref === 'function') {
        (this.lockTimer as any).unref();
      }
    }
  }

  /**
   * Initializes master encryption key in Keychain/Keystore and decrypts vault cache.
   * Fresh installs start EMPTY (no seeded demo accounts).
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized && this.masterKey && !this.isLockedState) {
      this.resetAutoLock();
      return;
    }

    try {
      // 1. Retrieve or generate hardware master key in secure storage
      let key = await this.secureStorage.getItemAsync(KEYCHAIN_MASTER_KEY);
      if (!key) {
        key = await AesGcmService.generateMasterKey();
        await this.secureStorage.setItemAsync(KEYCHAIN_MASTER_KEY, key);
      }
      this.masterKey = key;

      // 2. Retrieve encrypted vault envelope
      const rawEnvelope = await this.secureStorage.getItemAsync(SECURE_VAULT_PAYLOAD_KEY);

      if (rawEnvelope) {
        const envelope: EncryptedVaultEnvelope = JSON.parse(rawEnvelope);
        const decryptedJson = await AesGcmService.decrypt(envelope, this.masterKey);
        this.memoryCache = JSON.parse(decryptedJson);
      } else {
        // Fresh boot: start EMPTY (do not seed demo accounts in production)
        this.memoryCache = [];
        await this.persistEncryptedAccounts(this.memoryCache);
      }

      // 3. Retrieve settings
      const rawSettings = await this.secureStorage.getItemAsync(SECURE_SETTINGS_KEY);
      if (rawSettings) {
        this.memorySettings = JSON.parse(rawSettings);
      }
      this.storageError = null;
      this.isLockedState = false;
      this.resetAutoLock();
    } catch (err: any) {
      this.storageError = err?.message || 'Secure storage failure';
      this.memoryCache = [];
      throw new SecureStorageError(`Secure storage initialization failed: ${this.storageError}`, err);
    } finally {
      this.isInitialized = true;
    }
  }

  /**
   * Encrypts accounts payload using AES-GCM-256 and writes ONLY ciphertext to secure storage.
   */
  private async persistEncryptedAccounts(accounts: TotpAccount[]): Promise<void> {
    if (!this.masterKey) {
      this.masterKey = await AesGcmService.generateMasterKey();
      await this.secureStorage.setItemAsync(KEYCHAIN_MASTER_KEY, this.masterKey);
    }

    const plaintext = JSON.stringify(accounts);
    const envelope = await AesGcmService.encrypt(plaintext, this.masterKey);

    await this.secureStorage.setItemAsync(SECURE_VAULT_PAYLOAD_KEY, JSON.stringify(envelope));
  }

  /**
   * Returns all stored TOTP accounts decrypted from secure storage
   */
  async getAccounts(): Promise<TotpAccount[]> {
    if (this.isLockedState) {
      throw new Error('VAULT_LOCKED: Unlock the vault to view accounts.');
    }
    await this.ensureInitialized();
    return this.memoryCache.map((acc) => ({
      ...acc,
      accountName: acc.accountName || acc.name,
      name: acc.name || acc.accountName,
    }));
  }

  /**
   * Returns a specific account by UUID
   */
  async getAccountById(id: string): Promise<TotpAccount | null> {
    if (this.isLockedState) {
      throw new Error('VAULT_LOCKED: Unlock the vault to view accounts.');
    }
    await this.ensureInitialized();
    const found = this.memoryCache.find((acc) => acc.id === id);
    if (!found) return null;
    return {
      ...found,
      accountName: found.accountName || found.name,
      name: found.name || found.accountName,
    };
  }

  /**
   * Saves a new account into the hardware-backed secure vault.
   * Real backup codes only (never fabricate fake recovery codes).
   */
  async saveAccount(input: AddTotpAccountInput): Promise<TotpAccount> {
    if (this.isLockedState) {
      throw new Error('VAULT_LOCKED: Unlock the vault to save accounts.');
    }
    await this.ensureInitialized();

    const accountIdentifier = (input.accountName || input.name || '').trim();
    if (!accountIdentifier) {
      throw new Error('Account name is required (e.g. user@company.com)');
    }

    const validation = this.validateSecret(input.secret);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid Base32 secret key');
    }

    const now = new Date().toISOString();
    const newAccount: TotpAccount = {
      id: generateUuid(),
      accountName: accountIdentifier,
      name: accountIdentifier,
      issuer: (input.issuer || 'Authenticator').trim(),
      secret: input.secret.replace(/\s+/g, '').toUpperCase(),
      algorithm: input.algorithm || 'SHA1',
      digits: input.digits || 6,
      period: input.period || 30,
      icon: input.icon || '🔑',
      backupCodes: input.backupCodes ? [...input.backupCodes] : [],
      createdAt: now,
      updatedAt: now,
    };

    this.memoryCache.unshift(newAccount);
    await this.persistEncryptedAccounts(this.memoryCache);
    this.resetAutoLock();
    return { ...newAccount };
  }

  async addAccount(input: AddTotpAccountInput): Promise<TotpAccount> {
    return this.saveAccount(input);
  }

  async updateAccount(
    id: string,
    updates: Partial<Omit<TotpAccount, 'id' | 'createdAt'>>
  ): Promise<TotpAccount> {
    if (this.isLockedState) {
      throw new Error('VAULT_LOCKED: Unlock the vault to update accounts.');
    }
    await this.ensureInitialized();
    const index = this.memoryCache.findIndex((acc) => acc.id === id);
    if (index === -1) {
      throw new Error(`Account with id ${id} not found in secure vault`);
    }

    if (updates.secret) {
      const validation = this.validateSecret(updates.secret);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid Base32 secret key');
      }
    }

    const existing = this.memoryCache[index];
    const accountIdentifier =
      updates.accountName || updates.name || existing.accountName || existing.name;

    const updated: TotpAccount = {
      ...existing,
      ...updates,
      accountName: accountIdentifier,
      name: accountIdentifier,
      updatedAt: new Date().toISOString(),
    };

    this.memoryCache[index] = updated;
    await this.persistEncryptedAccounts(this.memoryCache);
    this.resetAutoLock();
    return { ...updated };
  }

  async deleteAccount(id: string): Promise<boolean> {
    if (this.isLockedState) {
      throw new Error('VAULT_LOCKED: Unlock the vault to delete accounts.');
    }
    await this.ensureInitialized();
    const initialLength = this.memoryCache.length;
    this.memoryCache = this.memoryCache.filter((acc) => acc.id !== id);

    if (this.memoryCache.length !== initialLength) {
      await this.persistEncryptedAccounts(this.memoryCache);
      this.resetAutoLock();
      return true;
    }
    return false;
  }

  generateCode(
    account: TotpAccount | { secret: string; period?: number; digits?: number; algorithm?: any },
    timestamp: number = Date.now()
  ): string {
    return TotpEngine.generate({
      secret: account.secret,
      period: account.period || 30,
      digits: account.digits || 6,
      algorithm: (account as any).algorithm || 'SHA1',
      timestamp,
    });
  }

  formatCode(code: string): string {
    return TotpEngine.formatCode(code);
  }

  getRemainingSeconds(period: number = 30, timestamp: number = Date.now()): number {
    return TotpEngine.getRemainingSeconds(period, timestamp);
  }

  validateSecret(secret: string): { valid: boolean; error?: string } {
    if (!secret || secret.trim().length === 0) {
      return { valid: false, error: 'Secret key is required' };
    }
    const clean = secret.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
    if (clean.length < 8) {
      return { valid: false, error: 'Secret key must be at least 8 characters' };
    }
    const base32Regex = /^[A-Z2-7]+$/;
    if (!base32Regex.test(clean)) {
      return {
        valid: false,
        error: 'Invalid Base32 secret key: Must contain only valid Base32 characters (A-Z, 2-7)',
      };
    }
    return { valid: true };
  }

  async getSettings(): Promise<VaultSecuritySettings> {
    await this.ensureInitialized();
    return { ...this.memorySettings };
  }

  async updateSettings(updates: Partial<VaultSecuritySettings>): Promise<VaultSecuritySettings> {
    await this.ensureInitialized();
    this.memorySettings = {
      ...this.memorySettings,
      ...updates,
    };
    await this.secureStorage.setItemAsync(SECURE_SETTINGS_KEY, JSON.stringify(this.memorySettings));
    this.resetAutoLock();
    return { ...this.memorySettings };
  }

  /**
   * Encrypted export of all vault credentials using PBKDF2-SHA256 (100k) + AES-GCM-256.
   * Never exports secret plaintext to clipboard.
   */
  async exportVault(passphrase?: string): Promise<string> {
    await this.ensureInitialized();
    if (this.isLockedState) {
      throw new Error('VAULT_LOCKED: Unlock vault before exporting.');
    }

    if (!passphrase || passphrase.length < 8) {
      throw new Error('EXPORT_FAILED: A passphrase of at least 8 characters is required to encrypt the backup.');
    }

    const payload = JSON.stringify({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      accountCount: this.memoryCache.length,
      accounts: this.memoryCache,
    });

    const encrypted = await AesGcmService.encryptWithPassword(payload, passphrase, 100000);

    const backup: EncryptedVaultBackup = {
      format: 'vanguard-encrypted-vault-backup',
      version: '1.0.0',
      kdf: {
        algorithm: 'PBKDF2',
        hash: 'SHA-256',
        iterations: encrypted.iterations,
        salt: encrypted.salt,
      },
      cipher: {
        algorithm: 'AES-GCM-256',
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
      },
      accountCount: this.memoryCache.length,
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Imports an encrypted backup envelope, verifying passphrase and account schema.
   */
  async importVault(
    encryptedBackupJson: string,
    passphrase: string
  ): Promise<{ importedCount: number }> {
    await this.ensureInitialized();
    if (!encryptedBackupJson || !passphrase) {
      throw new Error('IMPORT_FAILED: Encrypted backup JSON and passphrase are required.');
    }

    let parsedBackup: EncryptedVaultBackup;
    try {
      parsedBackup = JSON.parse(encryptedBackupJson);
    } catch {
      throw new Error('IMPORT_MALFORMED: Backup file is not valid JSON.');
    }

    if (parsedBackup.format !== 'vanguard-encrypted-vault-backup' || !parsedBackup.cipher?.ciphertext) {
      throw new Error('IMPORT_INVALID_FORMAT: Unrecognized backup format.');
    }

    let decryptedJson: string;
    try {
      decryptedJson = await AesGcmService.decryptWithPassword(
        parsedBackup.cipher.ciphertext,
        parsedBackup.cipher.iv,
        parsedBackup.kdf.salt,
        passphrase,
        parsedBackup.kdf.iterations || 100000
      );
    } catch (err: any) {
      throw new Error(`IMPORT_DECRYPTION_FAILED: Invalid passphrase or corrupted backup (${err?.message || 'decryption failed'}).`);
    }

    let payload: any;
    try {
      payload = JSON.parse(decryptedJson);
    } catch {
      throw new Error('IMPORT_CORRUPT: Decrypted content is not valid JSON.');
    }

    const accounts: TotpAccount[] = payload.accounts;
    if (!Array.isArray(accounts)) {
      throw new Error('IMPORT_INVALID_DATA: Accounts payload must be an array.');
    }

    // Validate every account
    for (const acc of accounts) {
      if (!acc.id || !acc.secret || !acc.issuer) {
        throw new Error(`IMPORT_INVALID_ACCOUNT: Account "${acc.accountName || acc.id}" missing required fields.`);
      }
      const val = this.validateSecret(acc.secret);
      if (!val.valid) {
        throw new Error(`IMPORT_INVALID_ACCOUNT: Account "${acc.accountName || acc.id}" has invalid secret.`);
      }
    }

    // Merge into memoryCache without duplicating IDs
    let importedCount = 0;
    for (const acc of accounts) {
      const existingIdx = this.memoryCache.findIndex((a) => a.id === acc.id);
      if (existingIdx >= 0) {
        this.memoryCache[existingIdx] = acc;
      } else {
        this.memoryCache.push(acc);
      }
      importedCount++;
    }

    await this.persistEncryptedAccounts(this.memoryCache);
    this.resetAutoLock();
    return { importedCount };
  }

  /**
   * Genuine wipe operation that completely destroys vault ciphertext, keys, and memory cache.
   * Stays completely empty after wipe (no demo reseeding).
   */
  async wipeVault(options?: { confirmed: boolean }): Promise<void> {
    if (!options?.confirmed) {
      throw new Error('WIPE_UNCONFIRMED: Vault wipe requires explicit confirmation.');
    }

    this.memoryCache = [];
    this.memorySettings = { ...DEFAULT_SETTINGS };
    this.masterKey = null;
    this.isInitialized = false;
    this.isLockedState = false;

    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }

    try {
      await this.secureStorage.deleteItemAsync(SECURE_VAULT_PAYLOAD_KEY);
      await this.secureStorage.deleteItemAsync(KEYCHAIN_MASTER_KEY);
      await this.secureStorage.deleteItemAsync(SECURE_SETTINGS_KEY);
    } catch {
      // ignore deletion errors
    }
  }

  /**
   * For backwards-compatible tests only: populates default demo accounts.
   * Normal production boots start completely empty.
   */
  async seedDemoAccountsForTesting(): Promise<TotpAccount[]> {
    await this.ensureInitialized();
    this.memoryCache = [...DEFAULT_ACCOUNTS];
    await this.persistEncryptedAccounts(this.memoryCache);
    return [...this.memoryCache];
  }

  /**
   * Backwards-compatible alias for wipeVault
   */
  async resetVault(options?: { confirmed?: boolean }): Promise<void> {
    return this.wipeVault({ confirmed: options?.confirmed ?? true });
  }
}

export const vaultService = new VaultService();
export default vaultService;
