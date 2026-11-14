import type { TotpAccount } from '../models/vault.models.ts';
import { AppsStorageService } from './apps-storage.service.ts';

export interface RemoteTotpListResponse {
  accounts: TotpAccount[];
  deletedIds: string[];
  updatedAt: string | null;
}

export function isLiveBackendToken(token?: string | null): token is string {
  if (!token || typeof token !== 'string') return false;
  return (
    !token.startsWith('mock_jwt_') &&
    !token.startsWith('mock-') &&
    !token.startsWith('test-')
  );
}

function normalizeRemoteTotp(raw: any): TotpAccount {
  const accountName = raw.accountName || raw.account_name || raw.name || '';
  return {
    id: raw.id,
    issuer: raw.issuer || 'Authenticator',
    accountName,
    name: accountName,
    secret: raw.secret || '',
    algorithm: raw.algorithm || 'SHA1',
    digits: raw.digits === 8 ? 8 : 6,
    period: raw.period === 60 ? 60 : 30,
    icon: raw.icon || '🛡️',
    backupCodes: Array.isArray(raw.backupCodes) ? raw.backupCodes : [],
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
  };
}

export class TotpSyncService {
  static async fetchTotpAccounts(token: string): Promise<RemoteTotpListResponse | null> {
    if (!isLiveBackendToken(token)) return null;
    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(`${baseUrl}/totp-accounts`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const body = await response.json();
      if (!body || !Array.isArray(body.accounts)) return null;
      return {
        accounts: body.accounts.map(normalizeRemoteTotp),
        deletedIds: Array.isArray(body.deletedIds) ? body.deletedIds : [],
        updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : null,
      };
    } catch {
      return null;
    }
  }

  static async pushUpsertTotp(account: TotpAccount, token: string): Promise<TotpAccount | null> {
    if (!isLiveBackendToken(token)) return null;
    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(`${baseUrl}/totp-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: account.id,
          issuer: account.issuer,
          accountName: account.accountName || account.name,
          secret: account.secret,
          digits: account.digits || 6,
          period: account.period || 30,
          algorithm: account.algorithm || 'SHA1',
          icon: account.icon || '🛡️',
          ...(account.backupCodes?.length ? { backupCodes: account.backupCodes } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const body = await response.json();
      return body?.account ? normalizeRemoteTotp(body.account) : null;
    } catch {
      return null;
    }
  }

  static async pushUpdateTotp(
    id: string,
    updates: Partial<Omit<TotpAccount, 'id' | 'createdAt'>>,
    token: string,
  ): Promise<TotpAccount | null> {
    if (!isLiveBackendToken(token)) return null;
    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const accountName = updates.accountName ?? updates.name;
      const response = await fetch(`${baseUrl}/totp-accounts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(updates.issuer !== undefined ? { issuer: updates.issuer } : {}),
          ...(accountName !== undefined ? { accountName } : {}),
          ...(updates.secret !== undefined ? { secret: updates.secret } : {}),
          ...(updates.digits !== undefined ? { digits: updates.digits } : {}),
          ...(updates.period !== undefined ? { period: updates.period } : {}),
          ...(updates.algorithm !== undefined ? { algorithm: updates.algorithm } : {}),
          ...(updates.icon !== undefined ? { icon: updates.icon } : {}),
          ...(updates.backupCodes !== undefined ? { backupCodes: updates.backupCodes } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const body = await response.json();
      return body?.account ? normalizeRemoteTotp(body.account) : null;
    } catch {
      return null;
    }
  }

  static async pushDeleteTotp(id: string, token: string): Promise<boolean> {
    if (!isLiveBackendToken(token)) return false;
    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(`${baseUrl}/totp-accounts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}
