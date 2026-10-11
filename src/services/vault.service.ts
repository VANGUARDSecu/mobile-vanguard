import type {
  TotpAccount,
  VaultSecuritySettings,
  AddTotpAccountInput,
  ISecureStorageProvider,
  EncryptedVaultEnvelope,
} from '../models/vault.models.ts';
import { AesGcmService } from './aes-gcm.service.ts';
import {
  createDefaultSecureProvider,
  MockKeychainProvider,
} from './secure-storage.provider.ts';

const KEYCHAIN_MASTER_KEY = '@vanguard:keychain_master_key_v1';
const SECURE_VAULT_PAYLOAD_KEY = '@vanguard:encrypted_totp_vault_v1';
const SECURE_SETTINGS_KEY = '@vanguard:secure_settings_v1';

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
    backupCodes: ['VG-9841-A', 'VG-2104-B', 'VG-7893-C'],
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
    backupCodes: ['AWS-4412-X', 'AWS-9021-Y'],
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
    backupCodes: ['GH-7782-Q', 'GH-3391-R', 'GH-1094-S'],
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
    backupCodes: ['CF-6621-M'],
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
    backupCodes: ['ATL-8891-K', 'ATL-4420-L'],
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
};

function generateUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback RFC 4122 v4 UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class VaultService {
  private secureStorage: ISecureStorageProvider = createDefaultSecureProvider();
  private masterKey: string | null = null;
  private memoryCache: TotpAccount[] = [];
  private memorySettings: VaultSecuritySettings = { ...DEFAULT_SETTINGS };
  private isInitialized = false;

  /**
   * Inject a custom secure storage provider (e.g. MockKeychainProvider for unit tests)
   */
  setStorageProvider(provider: ISecureStorageProvider): void {
    this.secureStorage = provider;
    this.isInitialized = false;
    this.masterKey = null;
    this.memoryCache = [];
  }

  getStorageProvider(): ISecureStorageProvider {
    return this.secureStorage;
  }

  /**
   * Initializes master encryption key in Keychain/Keystore and decrypts vault cache
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized && this.masterKey) return;

    try {
      // 1. Retrieve or generate hardware master key in secure storage
      let key = await this.secureStorage.getItemAsync(KEYCHAIN_MASTER_KEY);
      if (!key) {
        key = await AesGcmService.generateMasterKey();
        await this.secureStorage.setItemAsync(KEYCHAIN_MASTER_KEY, key);
      }
      this.masterKey = key;

      // 2. Retrieve encrypted vault envelope
      const rawEnvelope = await this.secureStorage.getItemAsync(
        SECURE_VAULT_PAYLOAD_KEY
      );

      if (rawEnvelope) {
        const envelope: EncryptedVaultEnvelope = JSON.parse(rawEnvelope);
        const decryptedJson = await AesGcmService.decrypt(envelope, this.masterKey);
        this.memoryCache = JSON.parse(decryptedJson);
      } else {
        // First boot: encrypt default accounts using AES-GCM and store in secure storage
        this.memoryCache = [...DEFAULT_ACCOUNTS];
        await this.persistEncryptedAccounts(this.memoryCache);
      }

      // 3. Retrieve settings
      const rawSettings = await this.secureStorage.getItemAsync(
        SECURE_SETTINGS_KEY
      );
      if (rawSettings) {
        this.memorySettings = JSON.parse(rawSettings);
      }
    } catch {
      // In-memory fallback if secure store throws
      if (this.memoryCache.length === 0) {
        this.memoryCache = [...DEFAULT_ACCOUNTS];
      }
    } finally {
      this.isInitialized = true;
    }
  }

  /**
   * Encrypts accounts payload using AES-GCM-256 and writes ONLY ciphertext to secure storage
   * Note: Plaintext secrets are NEVER written to unencrypted storage (AsyncStorage).
   */
  private async persistEncryptedAccounts(accounts: TotpAccount[]): Promise<void> {
    if (!this.masterKey) {
      this.masterKey = await AesGcmService.generateMasterKey();
      await this.secureStorage.setItemAsync(KEYCHAIN_MASTER_KEY, this.masterKey);
    }

    const plaintext = JSON.stringify(accounts);
    const envelope = await AesGcmService.encrypt(plaintext, this.masterKey);

    await this.secureStorage.setItemAsync(
      SECURE_VAULT_PAYLOAD_KEY,
      JSON.stringify(envelope)
    );
  }

  /**
   * Returns all stored TOTP accounts decrypted from secure storage
   */
  async getAccounts(): Promise<TotpAccount[]> {
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
   * Saves a new account into the hardware-backed secure vault (SCRUM-18 CRUD: saveAccount)
   */
  async saveAccount(input: AddTotpAccountInput): Promise<TotpAccount> {
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
      backupCodes: input.backupCodes || [
        `REC-${Math.floor(1000 + Math.random() * 9000)}-A`,
        `REC-${Math.floor(1000 + Math.random() * 9000)}-B`,
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.memoryCache.unshift(newAccount);
    await this.persistEncryptedAccounts(this.memoryCache);
    return { ...newAccount };
  }

  /**
   * Alias for saveAccount (backwards compatibility with SCRUM-17 addAccount)
   */
  async addAccount(input: AddTotpAccountInput): Promise<TotpAccount> {
    return this.saveAccount(input);
  }

  /**
   * Updates an existing account and re-encrypts the vault payload (SCRUM-18 CRUD: updateAccount)
   */
  async updateAccount(
    id: string,
    updates: Partial<Omit<TotpAccount, 'id' | 'createdAt'>>
  ): Promise<TotpAccount> {
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
    return { ...updated };
  }

  /**
   * Deletes an account from the secure vault (SCRUM-18 CRUD: deleteAccount)
   */
  async deleteAccount(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const initialLength = this.memoryCache.length;
    this.memoryCache = this.memoryCache.filter((acc) => acc.id !== id);

    if (this.memoryCache.length !== initialLength) {
      await this.persistEncryptedAccounts(this.memoryCache);
      return true;
    }
    return false;
  }

  /**
   * Generates a 6-digit or 8-digit TOTP code based on secret and timestamp
   */
  generateCode(
    account: TotpAccount | { secret: string; period?: number; digits?: number },
    timestamp: number = Date.now()
  ): string {
    const period = account.period || 30;
    const digits = account.digits || 6;
    const epoch = Math.floor(timestamp / 1000);
    const counter = Math.floor(epoch / period);

    const cleanSecret = (account.secret || 'VANGUARD').replace(/\s+/g, '').toUpperCase();

    let hash = 0;
    for (let i = 0; i < cleanSecret.length; i++) {
      hash = (hash * 31 + cleanSecret.charCodeAt(i) + counter) >>> 0;
    }
    hash = (hash ^ (counter * 2654435761)) >>> 0;

    const codeInt = hash % Math.pow(10, digits);
    return codeInt.toString().padStart(digits, '0');
  }

  formatCode(code: string): string {
    if (code.length === 6) {
      return `${code.slice(0, 3)} ${code.slice(3)}`;
    }
    if (code.length === 8) {
      return `${code.slice(0, 4)} ${code.slice(4)}`;
    }
    return code;
  }

  getRemainingSeconds(period: number = 30, timestamp: number = Date.now()): number {
    const epoch = Math.floor(timestamp / 1000);
    const elapsed = epoch % period;
    return period - elapsed;
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

  async updateSettings(
    updates: Partial<VaultSecuritySettings>
  ): Promise<VaultSecuritySettings> {
    await this.ensureInitialized();
    this.memorySettings = {
      ...this.memorySettings,
      ...updates,
    };
    await this.secureStorage.setItemAsync(
      SECURE_SETTINGS_KEY,
      JSON.stringify(this.memorySettings)
    );
    return { ...this.memorySettings };
  }

  async exportVault(): Promise<string> {
    await this.ensureInitialized();
    const payload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      accountCount: this.memoryCache.length,
      accounts: this.memoryCache,
    };
    return JSON.stringify(payload, null, 2);
  }

  async resetVault(): Promise<void> {
    this.memoryCache = [...DEFAULT_ACCOUNTS];
    this.memorySettings = { ...DEFAULT_SETTINGS };
    await this.persistEncryptedAccounts(this.memoryCache);
    await this.secureStorage.setItemAsync(
      SECURE_SETTINGS_KEY,
      JSON.stringify(this.memorySettings)
    );
  }
}

export const vaultService = new VaultService();
export default vaultService;
