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

export const DEFAULT_ENTERPRISE_APPS: SaaSApp[] = [
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

export const DEFAULT_CONNECTED_APPS: UserConnectedApp[] = [
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

export const DEFAULT_ACCESS_REQUESTS: AppAccessRequest[] = [
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

export const DEFAULT_VAULT_ITEMS: PersonalVaultItem[] = [
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
      const mode = await AsyncStorage.getItem(STORAGE_KEYS.WORKSPACE_MODE);
      return mode !== null ? JSON.parse(mode) : false;
    } catch {
      return false;
    }
  }

  static async setWorkspaceMode(isPersonal: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WORKSPACE_MODE, JSON.stringify(isPersonal));
    } catch {
      // Ignored
    }
  }

  /**
   * Personal Applications (SCRUM-52: starts empty unless added)
   */
  static async getPersonalApps(): Promise<SaaSApp[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PERSONAL_APPS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static async savePersonalApps(apps: SaaSApp[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PERSONAL_APPS, JSON.stringify(apps));
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
   * Enterprise Applications
   */
  static async getEnterpriseApps(): Promise<SaaSApp[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ENTERPRISE_APPS);
      if (data) {
        return JSON.parse(data);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.ENTERPRISE_APPS, JSON.stringify(DEFAULT_ENTERPRISE_APPS));
      return DEFAULT_ENTERPRISE_APPS;
    } catch {
      return DEFAULT_ENTERPRISE_APPS;
    }
  }

  static async saveEnterpriseApps(apps: SaaSApp[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ENTERPRISE_APPS, JSON.stringify(apps));
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

  static getBackendApiUrl(): string {
    if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
      return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
    }
    return 'http://localhost:3000';
  }

  static async getConnectedApps(): Promise<UserConnectedApp[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CONNECTED_APPS);
      if (data) {
        const parsed: UserConnectedApp[] = JSON.parse(data);
        return this.deduplicateConnectedApps(parsed);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.CONNECTED_APPS, JSON.stringify(DEFAULT_CONNECTED_APPS));
      return DEFAULT_CONNECTED_APPS;
    } catch {
      return DEFAULT_CONNECTED_APPS;
    }
  }

  static async saveConnectedApps(apps: UserConnectedApp[]): Promise<void> {
    try {
      const deduped = this.deduplicateConnectedApps(apps);
      await AsyncStorage.setItem(STORAGE_KEYS.CONNECTED_APPS, JSON.stringify(deduped));
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
   * Access Requests (SCRUM-42)
   */
  static async getAccessRequests(): Promise<AppAccessRequest[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_REQUESTS);
      if (data) {
        return JSON.parse(data);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_REQUESTS, JSON.stringify(DEFAULT_ACCESS_REQUESTS));
      return DEFAULT_ACCESS_REQUESTS;
    } catch {
      return DEFAULT_ACCESS_REQUESTS;
    }
  }

  static async saveAccessRequests(requests: AppAccessRequest[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_REQUESTS, JSON.stringify(requests));
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
  }): Promise<AppAccessRequest> {
    const requests = await this.getAccessRequests();
    const newReq: AppAccessRequest = {
      id: 'req-' + Date.now(),
      userId: 'usr-current',
      userName: input.userName || 'John Roben Manayon',
      userEmail: input.userEmail || 'user@company.com',
      department: input.department || 'Engineering',
      role: 'Full Stack Engineer',
      appName: input.appName.trim(),
      protocol: 'SAML 2.0',
      category: input.category || 'collaboration',
      icon: input.icon || '🚀',
      justification: input.justification.trim(),
      status: 'Pending Approval',
      submittedAt: new Date().toISOString(),
    };

    const updated = [newReq, ...requests];
    await this.saveAccessRequests(updated);
    return newReq;
  }

  /**
   * Personal Vault Credentials (for autofill readiness detection)
   */
  static async getVaultItems(): Promise<PersonalVaultItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.VAULT_ITEMS);
      if (data) {
        return JSON.parse(data);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.VAULT_ITEMS, JSON.stringify(DEFAULT_VAULT_ITEMS));
      return DEFAULT_VAULT_ITEMS;
    } catch {
      return DEFAULT_VAULT_ITEMS;
    }
  }

  /**
   * Reset all storage data for test harness
   */
  static async resetToDefaults(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
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
