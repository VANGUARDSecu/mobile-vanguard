export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export type AuthenticatorScreenName =
  | 'vault'
  | 'account-detail'
  | 'add-account'
  | 'security-settings'
  | 'push-harness';

export interface TotpAccount {
  id: string;
  accountName: string; // e.g. "user@company.com" (SCRUM-18)
  name: string; // backwards compatibility alias for accountName
  issuer: string; // e.g. "Vanguard Security", "GitHub", "AWS"
  secret: string; // Base32 encoded HMAC secret key
  algorithm: TotpAlgorithm; // SHA1 / SHA256 / SHA512
  digits: number; // 6 or 8 digits
  period: number; // 30 seconds default
  icon: string;
  backupCodes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultSecuritySettings {
  biometricsEnabled: boolean;
  autoLockSeconds: number; // 0 = disabled, 60 = 1 min, 300 = 5 min, 900 = 15 min
  clearClipboardSeconds: number; // 15, 30, 60
  exportEncryption: 'AES-256-GCM' | 'NONE';
  zeroTrustAttestation: boolean;
  pushMfaEnabled?: boolean;
}

export interface AddTotpAccountInput {
  accountName?: string;
  name?: string;
  issuer: string;
  secret: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
  icon?: string;
  backupCodes?: string[];
}

export interface ISecureStorageProvider {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
  isAvailableAsync?(): Promise<boolean>;
}

export interface EncryptedVaultEnvelope {
  version: string;
  cipher: 'AES-GCM-256';
  iv: string;
  ciphertext: string;
  tag: string;
  updatedAt: string;
}

