export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export type AuthenticatorScreenName =
  | 'vault'
  | 'account-detail'
  | 'add-account'
  | 'security-settings';

export interface TotpAccount {
  id: string;
  name: string;
  issuer: string;
  secret: string;
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
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
}

export interface AddTotpAccountInput {
  name: string;
  issuer: string;
  secret: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
  icon?: string;
  backupCodes?: string[];
}
