import { AppsStorageService } from './apps-storage.service.ts';
import { isLiveBackendToken } from './totp-sync.service.ts';

export interface SyncWatermarks {
  totpUpdatedAt: string | null;
  vaultUpdatedAt?: string | null;
  vaultRevision?: number;
  personalAppsUpdatedAt: string | null;
  enterpriseAppsUpdatedAt: string | null;
  connectedAppsUpdatedAt: string | null;
  accessRequestsUpdatedAt: string | null;
  billingUpdatedAt?: string | null;
  devicesUpdatedAt?: string | null;
}

export type SyncDomainKey =
  | 'totp'
  | 'vault'
  | 'personalApps'
  | 'enterpriseApps'
  | 'connectedApps'
  | 'accessRequests'
  | 'billing'
  | 'devices';

export interface SyncCoordinatorCallbacks {
  getToken: () => Promise<string | null>;
  refreshToken?: () => Promise<string | null>;
  onUnauthorized?: () => void;
  onDomainsChanged: (domains: SyncDomainKey[]) => Promise<void> | void;
}

export class SyncCoordinatorService {
  private lastWatermarks: SyncWatermarks | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  private callbacks: SyncCoordinatorCallbacks | null = null;

  configure(callbacks: SyncCoordinatorCallbacks): void {
    this.callbacks = callbacks;
  }

  resetWatermarks(): void {
    this.lastWatermarks = null;
  }

  start(intervalMs = 5000): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.checkOnce();
    }, intervalMs);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.inFlight = false;
  }

  private async fetchSyncStateStatus(
    token: string,
  ): Promise<{ status: number; data: SyncWatermarks | null }> {
    if (!isLiveBackendToken(token)) return { status: 0, data: null };
    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${baseUrl}/sync/state`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) return { status: response.status, data: null };
      return {
        status: response.status,
        data: (await response.json()) as SyncWatermarks,
      };
    } catch {
      return { status: 0, data: null };
    }
  }

  async fetchSyncState(token: string): Promise<SyncWatermarks | null> {
    const res = await this.fetchSyncStateStatus(token);
    return res.data;
  }

  async checkOnce(forceAll = false): Promise<SyncDomainKey[]> {
    if (this.inFlight || !this.callbacks) return [];
    this.inFlight = true;
    try {
      const token = await this.callbacks.getToken();
      if (!isLiveBackendToken(token)) return [];

      let res = await this.fetchSyncStateStatus(token);
      if (res.status === 401) {
        const refreshed = await this.callbacks.refreshToken?.();
        if (refreshed && isLiveBackendToken(refreshed)) {
          res = await this.fetchSyncStateStatus(refreshed);
        }
        if (res.status === 401 || !refreshed) {
          this.stop();
          this.callbacks.onUnauthorized?.();
          return [];
        }
      }

      const next = res.data;
      if (!next) return [];

      const prev = this.lastWatermarks;
      this.lastWatermarks = next;

      if (!prev) {
        if (!forceAll) {
          return [];
        }
        const all: SyncDomainKey[] = [
          'totp',
          'vault',
          'personalApps',
          'enterpriseApps',
          'connectedApps',
          'accessRequests',
          'billing',
          'devices',
        ];
        await this.callbacks.onDomainsChanged(all);
        return all;
      }

      const changed: SyncDomainKey[] = [];
      if (next.totpUpdatedAt !== prev.totpUpdatedAt) changed.push('totp');
      if (
        (next.vaultUpdatedAt ?? null) !== (prev.vaultUpdatedAt ?? null) ||
        (next.vaultRevision ?? 0) !== (prev.vaultRevision ?? 0)
      ) {
        changed.push('vault');
      }
      if (next.personalAppsUpdatedAt !== prev.personalAppsUpdatedAt) changed.push('personalApps');
      if (next.enterpriseAppsUpdatedAt !== prev.enterpriseAppsUpdatedAt) changed.push('enterpriseApps');
      if (next.connectedAppsUpdatedAt !== prev.connectedAppsUpdatedAt) changed.push('connectedApps');
      if (next.accessRequestsUpdatedAt !== prev.accessRequestsUpdatedAt) changed.push('accessRequests');
      if ((next.billingUpdatedAt ?? null) !== (prev.billingUpdatedAt ?? null)) changed.push('billing');
      if ((next.devicesUpdatedAt ?? null) !== (prev.devicesUpdatedAt ?? null)) changed.push('devices');

      if (changed.length > 0) {
        await this.callbacks.onDomainsChanged(changed);
      }
      return changed;
    } catch {
      return [];
    } finally {
      this.inFlight = false;
    }
  }
}

export const syncCoordinatorService = new SyncCoordinatorService();
