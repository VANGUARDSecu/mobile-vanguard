import { AppsStorageService } from './apps-storage.service.ts';
import { isLiveBackendToken } from './totp-sync.service.ts';

export interface SyncWatermarks {
  totpUpdatedAt: string | null;
  personalAppsUpdatedAt: string | null;
  enterpriseAppsUpdatedAt: string | null;
  connectedAppsUpdatedAt: string | null;
  accessRequestsUpdatedAt: string | null;
  billingUpdatedAt?: string | null;
}

export type SyncDomainKey =
  | 'totp'
  | 'personalApps'
  | 'enterpriseApps'
  | 'connectedApps'
  | 'accessRequests'
  | 'billing';

export interface SyncCoordinatorCallbacks {
  getToken: () => Promise<string | null>;
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

  async fetchSyncState(token: string): Promise<SyncWatermarks | null> {
    if (!isLiveBackendToken(token)) return null;
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
      if (!response.ok) return null;
      return (await response.json()) as SyncWatermarks;
    } catch {
      return null;
    }
  }

  async checkOnce(forceAll = false): Promise<SyncDomainKey[]> {
    if (this.inFlight || !this.callbacks) return [];
    this.inFlight = true;
    try {
      const token = await this.callbacks.getToken();
      if (!isLiveBackendToken(token)) return [];

      const next = await this.fetchSyncState(token);
      if (!next) return [];

      const prev = this.lastWatermarks;
      this.lastWatermarks = next;

      if (!prev) {
        if (!forceAll) {
          return [];
        }
        const all: SyncDomainKey[] = [
          'totp',
          'personalApps',
          'enterpriseApps',
          'connectedApps',
          'accessRequests',
          'billing',
        ];
        await this.callbacks.onDomainsChanged(all);
        return all;
      }

      const changed: SyncDomainKey[] = [];
      if (next.totpUpdatedAt !== prev.totpUpdatedAt) changed.push('totp');
      if (next.personalAppsUpdatedAt !== prev.personalAppsUpdatedAt) changed.push('personalApps');
      if (next.enterpriseAppsUpdatedAt !== prev.enterpriseAppsUpdatedAt) changed.push('enterpriseApps');
      if (next.connectedAppsUpdatedAt !== prev.connectedAppsUpdatedAt) changed.push('connectedApps');
      if (next.accessRequestsUpdatedAt !== prev.accessRequestsUpdatedAt) changed.push('accessRequests');
      if ((next.billingUpdatedAt ?? null) !== (prev.billingUpdatedAt ?? null)) changed.push('billing');

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
