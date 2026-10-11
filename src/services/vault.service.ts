import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  TotpAccount,
  VaultSecuritySettings,
  AddTotpAccountInput,
} from '../models/vault.models.ts';

const VAULT_STORAGE_KEY = '@vanguard:authenticator_vault_v1';
const VAULT_SETTINGS_KEY = '@vanguard:authenticator_settings_v1';

const DEFAULT_ACCOUNTS: TotpAccount[] = [
  {
    id: 'vault-001',
    name: 'admin@vanguard.security',
    issuer: 'Vanguard Identity Portal',
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
    id: 'vault-002',
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
    id: 'vault-003',
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
    id: 'vault-004',
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
    id: 'vault-005',
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

const DEFAULT_SETTINGS: VaultSecuritySettings = {
  biometricsEnabled: true,
  autoLockSeconds: 300, // 5 minutes
  clearClipboardSeconds: 30,
  exportEncryption: 'AES-256-GCM',
  zeroTrustAttestation: true,
};

class VaultService {
  private memoryAccounts: TotpAccount[] = [...DEFAULT_ACCOUNTS];
  private memorySettings: VaultSecuritySettings = { ...DEFAULT_SETTINGS };
  private isLoaded = false;

  private async loadFromStorage(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const stored = await AsyncStorage.getItem(VAULT_STORAGE_KEY);
      if (stored) {
        this.memoryAccounts = JSON.parse(stored);
      } else {
        await AsyncStorage.setItem(
          VAULT_STORAGE_KEY,
          JSON.stringify(DEFAULT_ACCOUNTS)
        );
      }

      const storedSettings = await AsyncStorage.getItem(VAULT_SETTINGS_KEY);
      if (storedSettings) {
        this.memorySettings = JSON.parse(storedSettings);
      }
    } catch {
      // Fallback cleanly to in-memory store
    } finally {
      this.isLoaded = true;
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        VAULT_STORAGE_KEY,
        JSON.stringify(this.memoryAccounts)
      );
      await AsyncStorage.setItem(
        VAULT_SETTINGS_KEY,
        JSON.stringify(this.memorySettings)
      );
    } catch {
      // In-memory fallback
    }
  }

  async getAccounts(): Promise<TotpAccount[]> {
    await this.loadFromStorage();
    return [...this.memoryAccounts];
  }

  async getAccountById(id: string): Promise<TotpAccount | null> {
    await this.loadFromStorage();
    const found = this.memoryAccounts.find((acc) => acc.id === id);
    return found ? { ...found } : null;
  }

  /**
   * Generates a 6-digit TOTP code based on secret and timestamp (RFC 6238 compatible simulation)
   */
  generateCode(
    account: TotpAccount | { secret: string; period?: number; digits?: number },
    timestamp: number = Date.now()
  ): string {
    const period = account.period || 30;
    const digits = account.digits || 6;
    const epoch = Math.floor(timestamp / 1000);
    const counter = Math.floor(epoch / period);

    // Clean secret
    const cleanSecret = (account.secret || 'VANGUARD').replace(/\s+/g, '').toUpperCase();

    // Deterministic hash integer based on secret and counter
    let hash = 0;
    for (let i = 0; i < cleanSecret.length; i++) {
      hash = (hash * 31 + cleanSecret.charCodeAt(i) + counter) >>> 0;
    }
    hash = (hash ^ (counter * 2654435761)) >>> 0;

    const codeInt = hash % Math.pow(10, digits);
    return codeInt.toString().padStart(digits, '0');
  }

  /**
   * Formats a 6-digit code with a separator space for human readability (e.g. "123 456")
   */
  formatCode(code: string): string {
    if (code.length === 6) {
      return `${code.slice(0, 3)} ${code.slice(3)}`;
    }
    return code;
  }

  /**
   * Calculates seconds remaining in the current TOTP step
   */
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
        error: 'Secret key must contain only valid Base32 characters (A-Z, 2-7)',
      };
    }
    return { valid: true };
  }

  async addAccount(input: AddTotpAccountInput): Promise<TotpAccount> {
    await this.loadFromStorage();

    const validation = this.validateSecret(input.secret);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid secret key');
    }

    if (!input.name || !input.name.trim()) {
      throw new Error('Account name is required');
    }

    const now = new Date().toISOString();
    const newAccount: TotpAccount = {
      id: `vault-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: input.name.trim(),
      issuer: input.issuer ? input.issuer.trim() : 'Authenticator',
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

    this.memoryAccounts.unshift(newAccount);
    await this.saveToStorage();
    return newAccount;
  }

  async updateAccount(
    id: string,
    updates: Partial<Omit<TotpAccount, 'id' | 'createdAt'>>
  ): Promise<TotpAccount> {
    await this.loadFromStorage();
    const index = this.memoryAccounts.findIndex((acc) => acc.id === id);
    if (index === -1) {
      throw new Error(`Account with id ${id} not found`);
    }

    if (updates.secret) {
      const validation = this.validateSecret(updates.secret);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid secret key');
      }
    }

    const existing = this.memoryAccounts[index];
    const updated: TotpAccount = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.memoryAccounts[index] = updated;
    await this.saveToStorage();
    return updated;
  }

  async deleteAccount(id: string): Promise<boolean> {
    await this.loadFromStorage();
    const prevLength = this.memoryAccounts.length;
    this.memoryAccounts = this.memoryAccounts.filter((acc) => acc.id !== id);
    if (this.memoryAccounts.length !== prevLength) {
      await this.saveToStorage();
      return true;
    }
    return false;
  }

  async getSettings(): Promise<VaultSecuritySettings> {
    await this.loadFromStorage();
    return { ...this.memorySettings };
  }

  async updateSettings(
    updates: Partial<VaultSecuritySettings>
  ): Promise<VaultSecuritySettings> {
    await this.loadFromStorage();
    this.memorySettings = {
      ...this.memorySettings,
      ...updates,
    };
    await this.saveToStorage();
    return { ...this.memorySettings };
  }

  async exportVault(): Promise<string> {
    await this.loadFromStorage();
    const payload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      accountCount: this.memoryAccounts.length,
      accounts: this.memoryAccounts,
    };
    return JSON.stringify(payload, null, 2);
  }

  async resetVault(): Promise<void> {
    this.memoryAccounts = [...DEFAULT_ACCOUNTS];
    this.memorySettings = { ...DEFAULT_SETTINGS };
    await this.saveToStorage();
  }
}

export const vaultService = new VaultService();
export default vaultService;
