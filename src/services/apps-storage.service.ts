import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  SaaSApp,
  UserConnectedApp,
  AppAccessRequest,
  PersonalVaultItem,
  PersonalAppInput,
  AppItemCategory,
} from '../models/apps.models.ts';

const STORAGE_KEYS = {
  PERSONAL_APPS: '@vanguard_personal_apps',
  ENTERPRISE_APPS: '@vanguard_enterprise_apps',
  CONNECTED_APPS: '@vanguard_connected_apps',
  ACCESS_REQUESTS: '@vanguard_access_requests',
  VAULT_ITEMS: '@vanguard_vault_items',
  WORKSPACE_MODE: '@vanguard_workspace_mode',
};

// In-memory fallback map for headless/test environments
const memoryAppsStore = new Map<string, string>();

async function getStoredItem(key: string): Promise<string | null> {
  try {
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      const val = await AsyncStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
    }
  } catch {
    // In-memory fallback
  }
  return memoryAppsStore.get(key) ?? null;
}

async function setStoredItem(key: string, value: string): Promise<void> {
  memoryAppsStore.set(key, value);
  try {
    if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      await AsyncStorage.setItem(key, value);
    }
  } catch {
    // In-memory fallback
  }
}

async function removeStoredItems(keys: string[]): Promise<void> {
  for (const k of keys) {
    memoryAppsStore.delete(k);
  }
  try {
    if (AsyncStorage && typeof AsyncStorage.multiRemove === 'function') {
      await AsyncStorage.multiRemove(keys);
    }
  } catch {
    // In-memory fallback
  }
}

// SCRUM-83: Dashboard collections initialize to zero hardcoded items by default
export const DEFAULT_ENTERPRISE_APPS: SaaSApp[] = [];
export const DEFAULT_CONNECTED_APPS: UserConnectedApp[] = [];
export const DEFAULT_ACCESS_REQUESTS: AppAccessRequest[] = [];
export const DEFAULT_VAULT_ITEMS: PersonalVaultItem[] = [];

// Mock fixtures preserved for development simulators & test suites
export const MOCK_ENTERPRISE_APPS_FIXTURES: SaaSApp[] = [
  {
    id: 'app-aws',
    name: 'AWS Management Console',
    category: 'cloud',
    description: 'Amazon Web Services cloud computing console & production infra',
    icon: '☁️',
    protocol: 'SAML 2.0',
    launchUrl: 'https://signin.aws.amazon.com/console',
    assigned: true,
    inheritedViaGroup: 'Engineering DevOps',
    status: 'Active',
  },
  {
    id: 'app-slack',
    name: 'Slack Enterprise Grid',
    category: 'collaboration',
    description: 'Secure workplace messaging, zero-trust channels & huddles',
    icon: '💬',
    protocol: 'SAML 2.0',
    launchUrl: 'https://slack.com/signin',
    assigned: true,
    inheritedViaGroup: 'All Personnel',
    status: 'Active',
  },
  {
    id: 'app-github',
    name: 'GitHub Enterprise',
    category: 'developer',
    description: 'Enterprise source code repository hosting, CI/CD Actions & security',
    icon: '🐙',
    protocol: 'SAML 2.0',
    launchUrl: 'https://github.com/login',
    assigned: true,
    inheritedViaGroup: 'Core Developers',
    status: 'Active',
  },
  {
    id: 'app-google',
    name: 'Google Workspace',
    category: 'cloud',
    description: 'Corporate email, Google Drive, Meet, and Docs suite',
    icon: '📁',
    protocol: 'SAML 2.0',
    launchUrl: 'https://workspace.google.com',
    assigned: true,
    inheritedViaGroup: 'All Personnel',
    status: 'Active',
  },
  {
    id: 'app-figma',
    name: 'Figma Enterprise',
    category: 'collaboration',
    description: 'Collaborative UI/UX interface design and vector prototyping',
    icon: '🎨',
    protocol: 'SAML 2.0',
    launchUrl: 'https://www.figma.com/login',
    assigned: true,
    inheritedViaGroup: 'Product & Design',
    status: 'Active',
  },
];

export const MOCK_CONNECTED_APPS_FIXTURES: UserConnectedApp[] = [
  {
    id: 'conn-dummy-web-ellen',
    clientId: 'vanguard-dummy-portal',
    clientName: 'Acme Dummy Web',
    userEmail: 'ellen.ripley@weyland.corp',
    protocol: 'OIDC 1.0 PKCE',
    scopes: ['openid', 'profile', 'email', 'roles', 'offline_access'],
    redirectUri: 'http://localhost:4201/auth/callback',
    originUrl: 'http://localhost:4201',
    status: 'Connected',
    connectedAt: '2026-09-27T08:00:00.000Z',
    lastActiveAt: 'Active Session • Just now',
    icon: '🌐',
    description: 'Acme Dummy Web portal integrated via Vanguard Single Sign-On and OpenID Connect 1.0 PKCE authentication.',
  },
  {
    id: 'conn-dummy-web-user',
    clientId: 'vanguard-dummy-portal-corp',
    clientName: 'Acme Dummy Web',
    userEmail: 'user@company.com',
    protocol: 'OIDC 1.0 PKCE',
    scopes: ['openid', 'profile', 'email', 'roles', 'offline_access'],
    redirectUri: 'http://localhost:4201/auth/callback',
    originUrl: 'http://localhost:4201',
    status: 'Connected',
    connectedAt: '2026-09-27T08:00:00.000Z',
    lastActiveAt: 'Active Session • Just now',
    icon: '🌐',
    description: 'Acme Dummy Web portal integrated via Vanguard Single Sign-On and OpenID Connect 1.0 PKCE authentication.',
  },
];

export const MOCK_GOVERNANCE_FIXTURES: AppAccessRequest[] = [
  {
    id: 'req-snowflake',
    userId: 'usr-current',
    userName: 'John Roben Manayon',
    userEmail: 'johnroben.manayon21@gmail.com',
    department: 'Engineering',
    role: 'Full Stack Engineer',
    appName: 'Snowflake Data Cloud',
    protocol: 'SAML 2.0',
    category: 'cloud',
    icon: '❄️',
    launchUrl: 'https://snowflake.com',
    justification: 'Need access to enterprise analytics data warehouse for zero-trust reporting pipeline.',
    status: 'Pending Approval',
    submittedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'req-figma-approved',
    userId: 'usr-current',
    userName: 'John Roben Manayon',
    userEmail: 'johnroben.manayon21@gmail.com',
    department: 'Engineering',
    role: 'Full Stack Engineer',
    appName: 'Figma Enterprise',
    protocol: 'SAML 2.0',
    category: 'collaboration',
    icon: '🎨',
    launchUrl: 'https://www.figma.com/login',
    justification: 'UI mockup inspection for mobile authenticator flow.',
    status: 'Approved',
    submittedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    reviewedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    reviewedBy: 'Security Operations Admin',
  },
  {
    id: 'req-salesforce',
    userId: 'usr-current',
    userName: 'John Roben Manayon',
    userEmail: 'johnroben.manayon21@gmail.com',
    department: 'Engineering',
    role: 'Full Stack Engineer',
    appName: 'Salesforce CRM',
    protocol: 'SAML 2.0',
    category: 'cloud',
    icon: '☁️',
    launchUrl: 'https://salesforce.com',
    justification: 'Customer sync troubleshooting.',
    status: 'Rejected',
    submittedAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    reviewedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    reviewedBy: 'Security Operations Admin',
    adminNotes: 'Developer role not permitted for CRM write access. Contact line manager for elevation.',
  },
];

export const MOCK_VAULT_FIXTURES: PersonalVaultItem[] = [
  {
    id: 'vault-1',
    title: 'GitHub Personal Credentials',
    category: 'Login',
    username: 'john.dev@vanguard.security',
    url: 'https://github.com/login',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vault-2',
    title: 'Figma Design Cloud',
    category: 'Login',
    username: 'john.design@vanguard.security',
    url: 'https://www.figma.com/login',
    updatedAt: new Date().toISOString(),
  },
];

export class AppsStorageService {
  /**
   * Workspace Mode: true = Personal Workspace, false = Enterprise / Company Workspace
   */
  static async getWorkspaceMode(): Promise<boolean> {
    try {
      const mode = await getStoredItem(STORAGE_KEYS.WORKSPACE_MODE);
      return mode !== null ? JSON.parse(mode) : false;
    } catch {
      return false;
    }
  }

  static async setWorkspaceMode(isPersonal: boolean): Promise<void> {
    try {
      await setStoredItem(STORAGE_KEYS.WORKSPACE_MODE, JSON.stringify(isPersonal));
    } catch {
      // Ignored
    }
  }

  /**
   * Personal Applications (SCRUM-52: starts empty unless added)
   */
  static async getPersonalApps(): Promise<SaaSApp[]> {
    try {
      const data = await getStoredItem(STORAGE_KEYS.PERSONAL_APPS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static async savePersonalApps(apps: SaaSApp[]): Promise<void> {
    try {
      await setStoredItem(STORAGE_KEYS.PERSONAL_APPS, JSON.stringify(apps));
    } catch {
      // Ignored
    }
  }

  static async addPersonalApp(input: PersonalAppInput): Promise<SaaSApp> {
    const apps = await this.getPersonalApps();
    let formattedUrl = input.launchUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const newApp: SaaSApp = {
      id: 'papp-' + Date.now(),
      name: input.name.trim(),
      category: input.category,
      launchUrl: formattedUrl,
      description: input.description?.trim() || `${input.name.trim()} web application`,
      icon: input.icon?.trim() || '🌐',
      protocol: 'Web Auth',
      assigned: true,
      status: 'Active',
    };

    const updated = [newApp, ...apps];
    await this.savePersonalApps(updated);
    return newApp;
  }

  static async deletePersonalApp(id: string): Promise<void> {
    const apps = await this.getPersonalApps();
    const updated = apps.filter((a) => a.id !== id);
    await this.savePersonalApps(updated);
  }

  /**
   * Enterprise Applications (SCRUM-83: starts empty unless dynamically assigned)
   */
  static async getEnterpriseApps(): Promise<SaaSApp[]> {
    try {
      const data = await getStoredItem(STORAGE_KEYS.ENTERPRISE_APPS);
      if (data) {
        const parsed: SaaSApp[] = JSON.parse(data);
        const legacyIds = new Set(['app-aws', 'app-slack', 'app-github', 'app-google', 'app-figma']);
        const cleaned = parsed.filter((a) => !legacyIds.has(a.id));
        if (cleaned.length !== parsed.length) {
          await setStoredItem(STORAGE_KEYS.ENTERPRISE_APPS, JSON.stringify(cleaned));
        }
        return cleaned;
      }
      return [];
    } catch {
      return [];
    }
  }

  static async saveEnterpriseApps(apps: SaaSApp[]): Promise<void> {
    try {
      await setStoredItem(STORAGE_KEYS.ENTERPRISE_APPS, JSON.stringify(apps));
    } catch {
      // Ignored
    }
  }

  /**
   * Active SSO Connected Apps (SCRUM-57 & SCRUM-58)
   */
  static deduplicateConnectedApps(apps: UserConnectedApp[]): UserConnectedApp[] {
    const dedupMap = new Map<string, UserConnectedApp>();
    for (const app of apps) {
      if (app.status === 'Disconnected') continue;
      const key = (app.originUrl || app.clientName || app.clientId)
        .toLowerCase()
        .trim()
        .replace(/\/$/, '');
      if (!dedupMap.has(key)) {
        dedupMap.set(key, app);
      } else {
        const existing = dedupMap.get(key)!;
        if (existing.status !== 'Connected' && app.status === 'Connected') {
          dedupMap.set(key, app);
        } else if (app.lastActiveAt && (!existing.lastActiveAt || app.lastActiveAt > existing.lastActiveAt)) {
          dedupMap.set(key, { ...existing, ...app });
        }
      }
    }
    return Array.from(dedupMap.values());
  }

  private static activeApiUrlOverride: string | null = null;

  static setBackendApiUrlOverride(url: string | null): void {
    this.activeApiUrlOverride = url ? url.trim().replace(/\/$/, '') : null;
    if (this.activeApiUrlOverride) {
      setStoredItem('vanguard_api_url_override', this.activeApiUrlOverride).catch(() => {});
    } else {
      removeStoredItems(['vanguard_api_url_override']).catch(() => {});
    }
  }

  static async loadBackendApiUrlOverride(): Promise<string> {
    try {
      const saved = await getStoredItem('vanguard_api_url_override');
      if (saved) {
        this.activeApiUrlOverride = saved.trim().replace(/\/$/, '');
      }
    } catch {}
    return this.getBackendApiUrl();
  }

  static getLocalhostIp(): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Constants = require('expo-constants');
      const hostUri =
        Constants?.default?.expoConfig?.hostUri ||
        Constants?.expoConfig?.hostUri ||
        Constants?.default?.manifest2?.extra?.expoClient?.hostUri;
      if (hostUri && typeof hostUri === 'string') {
        const host = hostUri.split(':')[0];
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          return host;
        }
      }
    } catch {}
    const isAndroid = typeof process === 'undefined' && typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');
    return isAndroid ? '10.0.2.2' : 'localhost';
  }

  static getLocalhostUrl(port: number = 3000): string {
    const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (isWeb) {
      return `http://localhost:${port}`;
    }
    const host = this.getLocalhostIp();
    return `http://${host}:${port}`;
  }

  static getBackendApiUrl(): string {
    // 1. Manual user override (e.g. toggled to localhost or custom address)
    if (this.activeApiUrlOverride) {
      return this.activeApiUrlOverride;
    }

    // 2. Explicit environment variable if provided
    if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
      return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
    }

    // 3. Dynamic resolution for local Metro LAN / emulator
    try {
      const host = this.getLocalhostIp();
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:3000`;
      }
    } catch {
      // Non-native / headless fallback
    }

    // 4. Default to localhost for local web development, production Render for native builds
    const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (isWeb) {
      return 'http://localhost:3000';
    }
    return 'https://backend-vanguard.onrender.com';
  }

  static async getConnectedApps(): Promise<UserConnectedApp[]> {
    try {
      const data = await getStoredItem(STORAGE_KEYS.CONNECTED_APPS);
      if (data) {
        const parsed: UserConnectedApp[] = JSON.parse(data);
        const cleaned = parsed.filter(
          (a) =>
            a.id !== 'conn-dummy-web-ellen' &&
            a.id !== 'conn-dummy-web-user' &&
            a.userEmail !== 'ellen.ripley@weyland.corp' &&
            a.userEmail !== 'user@company.com'
        );
        if (cleaned.length !== parsed.length) {
          await setStoredItem(STORAGE_KEYS.CONNECTED_APPS, JSON.stringify(cleaned));
        }
        return this.deduplicateConnectedApps(cleaned);
      }
      return [];
    } catch {
      return [];
    }
  }

  static async saveConnectedApps(apps: UserConnectedApp[]): Promise<void> {
    try {
      const deduped = this.deduplicateConnectedApps(apps);
      await setStoredItem(STORAGE_KEYS.CONNECTED_APPS, JSON.stringify(deduped));
    } catch {
      // Ignored
    }
  }

  static async syncConnectedAppsWithBackend(email?: string): Promise<UserConnectedApp[]> {
    const currentLocal = await this.getConnectedApps();
    try {
      const baseUrl = this.getBackendApiUrl();
      const url = email
        ? `${baseUrl}/oauth/connected-apps?email=${encodeURIComponent(email)}`
        : `${baseUrl}/oauth/connected-apps`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const body = await response.json();
        if (body?.success && Array.isArray(body.connectedApps) && body.connectedApps.length > 0) {
          const merged = this.deduplicateConnectedApps([...body.connectedApps, ...currentLocal]);
          await this.saveConnectedApps(merged);
          return merged;
        }
      }
    } catch {
      // Gracefully fall back to local storage if backend is unreachable or offline
    }
    return currentLocal;
  }

  static async disconnectConnectedApp(clientId: string, email?: string): Promise<void> {
    const apps = await this.getConnectedApps();
    const target = apps.find((a) => a.clientId === clientId);
    const targetOrigin = target ? (target.originUrl || '').toLowerCase().trim().replace(/\/$/, '') : '';

    const updated = apps.filter((a) => {
      const origin = (a.originUrl || '').toLowerCase().trim().replace(/\/$/, '');
      return a.clientId !== clientId && (!targetOrigin || origin !== targetOrigin);
    });

    await this.saveConnectedApps(updated);

    // Asynchronously notify backend revocation if online
    try {
      const baseUrl = this.getBackendApiUrl();
      const url = email
        ? `${baseUrl}/oauth/connected-apps/${encodeURIComponent(clientId)}?email=${encodeURIComponent(email)}`
        : `${baseUrl}/oauth/connected-apps/${encodeURIComponent(clientId)}`;
      fetch(url, { method: 'DELETE' }).catch(() => {});
    } catch {
      // Non-blocking
    }
  }

  /**
   * Access Requests (SCRUM-42 & SCRUM-83: starts empty, dynamic user requests)
   */
  static async getAccessRequests(): Promise<AppAccessRequest[]> {
    try {
      const data = await getStoredItem(STORAGE_KEYS.ACCESS_REQUESTS);
      if (data) {
        const parsed: AppAccessRequest[] = JSON.parse(data);
        const cleaned = parsed.filter(
          (r) =>
            r.userEmail !== 'johnroben.manayon21@gmail.com' &&
            r.userName !== 'John Roben Manayon' &&
            !r.id?.startsWith('req-snowflake') &&
            !r.id?.startsWith('req-figma-approved') &&
            !r.id?.startsWith('req-salesforce')
        );
        if (cleaned.length !== parsed.length) {
          await setStoredItem(STORAGE_KEYS.ACCESS_REQUESTS, JSON.stringify(cleaned));
        }
        return cleaned;
      }
      return [];
    } catch {
      return [];
    }
  }

  static async saveAccessRequests(requests: AppAccessRequest[]): Promise<void> {
    try {
      await setStoredItem(STORAGE_KEYS.ACCESS_REQUESTS, JSON.stringify(requests));
    } catch {
      // Ignored
    }
  }

  static async submitAccessRequest(input: {
    appName: string;
    justification: string;
    category?: AppItemCategory;
    icon?: string;
    userName?: string;
    userEmail?: string;
    department?: string;
    role?: string;
  }): Promise<AppAccessRequest> {
    const requests = await this.getAccessRequests();
    const newReq: AppAccessRequest = {
      id: 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      userId: 'usr-' + Date.now(),
      userName: input.userName || 'Authenticated User',
      userEmail: input.userEmail || 'user@company.com',
      department: input.department || 'Engineering',
      role: input.role || 'user',
      appName: (input.appName || '').trim(),
      protocol: 'SAML 2.0',
      category: input.category || 'collaboration',
      icon: input.icon || '🚀',
      justification: (input.justification || '').trim(),
      status: 'Pending Approval',
      submittedAt: new Date().toISOString(),
    };

    const updated = [newReq, ...requests];
    await this.saveAccessRequests(updated);
    return newReq;
  }

  static async approveAccessRequest(
    id: string,
    reviewedBy: string = 'Company Admin'
  ): Promise<AppAccessRequest | null> {
    const requests = await this.getAccessRequests();
    let updatedTarget: AppAccessRequest | null = null;
    const updated = requests.map((r) => {
      if (r.id === id) {
        updatedTarget = {
          ...r,
          status: 'Approved' as const,
          reviewedAt: new Date().toISOString(),
          reviewedBy,
        };
        return updatedTarget;
      }
      return r;
    });
    if (updatedTarget) {
      await this.saveAccessRequests(updated);
    }
    return updatedTarget;
  }

  static async rejectAccessRequest(
    id: string,
    reviewedBy: string = 'Company Admin',
    adminNotes?: string
  ): Promise<AppAccessRequest | null> {
    const requests = await this.getAccessRequests();
    let updatedTarget: AppAccessRequest | null = null;
    const updated = requests.map((r) => {
      if (r.id === id) {
        updatedTarget = {
          ...r,
          status: 'Rejected' as const,
          reviewedAt: new Date().toISOString(),
          reviewedBy,
          adminNotes: adminNotes || 'Access request declined by company administrator.',
        };
        return updatedTarget;
      }
      return r;
    });
    if (updatedTarget) {
      await this.saveAccessRequests(updated);
    }
    return updatedTarget;
  }

  /**
   * Personal Vault Credentials (SCRUM-83: starts empty, dynamic detection)
   */
  static async getVaultItems(): Promise<PersonalVaultItem[]> {
    try {
      const data = await getStoredItem(STORAGE_KEYS.VAULT_ITEMS);
      if (data) {
        const parsed: PersonalVaultItem[] = JSON.parse(data);
        const legacyIds = new Set(['vault-1', 'vault-2']);
        const cleaned = parsed.filter(
          (v) =>
            !legacyIds.has(v.id) &&
            !v.username?.includes('john.dev') &&
            !v.username?.includes('john.design')
        );
        if (cleaned.length !== parsed.length) {
          await setStoredItem(STORAGE_KEYS.VAULT_ITEMS, JSON.stringify(cleaned));
        }
        return cleaned;
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Reset all storage data for test harness
   */
  static async resetToDefaults(): Promise<void> {
    try {
      await removeStoredItems([
        STORAGE_KEYS.PERSONAL_APPS,
        STORAGE_KEYS.ENTERPRISE_APPS,
        STORAGE_KEYS.CONNECTED_APPS,
        STORAGE_KEYS.ACCESS_REQUESTS,
        STORAGE_KEYS.VAULT_ITEMS,
        STORAGE_KEYS.WORKSPACE_MODE,
      ]);
    } catch {
      // Ignored
    }
  }
}
