import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  SaaSApp,
  UserConnectedApp,
  AppAccessRequest,
  PersonalVaultItem,
  PersonalAppInput,
  AppItemCategory,
} from '../models/apps.models.ts';
import { BillingLimitError, isBillingLimitError } from '../models/billing.models.ts';

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
  static getPersonalAppsKey(email?: string): string {
    const clean = email?.trim().toLowerCase();
    return clean ? `${STORAGE_KEYS.PERSONAL_APPS}_${clean}` : STORAGE_KEYS.PERSONAL_APPS;
  }

  static getEnterpriseAppsKey(email?: string): string {
    const clean = email?.trim().toLowerCase();
    return clean ? `${STORAGE_KEYS.ENTERPRISE_APPS}_${clean}` : STORAGE_KEYS.ENTERPRISE_APPS;
  }

  static getAccessRequestsKey(email?: string): string {
    const clean = email?.trim().toLowerCase();
    return clean ? `${STORAGE_KEYS.ACCESS_REQUESTS}_${clean}` : STORAGE_KEYS.ACCESS_REQUESTS;
  }

  static getVaultItemsKey(email?: string): string {
    const clean = email?.trim().toLowerCase();
    return clean ? `${STORAGE_KEYS.VAULT_ITEMS}_${clean}` : STORAGE_KEYS.VAULT_ITEMS;
  }

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
  static async getPersonalApps(email?: string): Promise<SaaSApp[]> {
    try {
      const userKey = this.getPersonalAppsKey(email);
      let data = await getStoredItem(userKey);
      if (!data && email) {
        data = await getStoredItem(STORAGE_KEYS.PERSONAL_APPS);
      }
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static async savePersonalApps(apps: SaaSApp[], email?: string): Promise<void> {
    try {
      const json = JSON.stringify(apps);
      const userKey = this.getPersonalAppsKey(email);
      await setStoredItem(userKey, json);
      await setStoredItem(STORAGE_KEYS.PERSONAL_APPS, json);
    } catch {
      // Ignored
    }
  }

  static isLiveToken(token?: string | null): token is string {
    return Boolean(
      token &&
      typeof token === 'string' &&
      !token.startsWith('mock_jwt_') &&
      !token.startsWith('mock-') &&
      !token.startsWith('test-'),
    );
  }

  static async addPersonalApp(
    input: PersonalAppInput,
    email?: string,
    token?: string,
    userId?: string
  ): Promise<SaaSApp> {
    const apps = await this.getPersonalApps(email);
    let formattedUrl = input.launchUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const cleanEmail = email?.trim().toLowerCase() || undefined;

    const newApp: SaaSApp = {
      id: 'papp-' + Date.now(),
      name: input.name.trim(),
      category: input.category,
      launchUrl: formattedUrl,
      description: input.description?.trim() || `${input.name.trim()} web application`,
      icon: input.icon?.trim() || '🌐',
      protocol: 'Extension Autofill',
      assigned: true,
      status: 'Approved',
      assignedUsername: input.username?.trim() || undefined,
      assignedPassword: input.password || undefined,
      targetUserEmail: cleanEmail,
      targetUserId: userId || undefined,
    };

    const updatedPersonal = [
      newApp,
      ...apps.filter((a) => a.name.toLowerCase().trim() !== newApp.name.toLowerCase().trim()),
    ];
    await this.savePersonalApps(updatedPersonal, email);
    await setStoredItem(
      `@vanguard_personal_apps_migrated_${cleanEmail || 'default'}`,
      '1',
    );

    // Save credentials to personal vault items if username or password provided
    if (input.username || input.password) {
      try {
        const vaults = await this.getVaultItems(email);
        const newVault: PersonalVaultItem = {
          id: 'vault-' + Date.now(),
          title: input.name.trim(),
          category: 'Login',
          username: input.username?.trim() || '',
          password: input.password || '',
          url: formattedUrl,
          notes: `Linked auto-fill credentials for ${input.name.trim()}`,
          updatedAt: new Date().toISOString(),
        };
        await this.saveVaultItems([newVault, ...vaults], email);
      } catch {
        // Non-blocking
      }
    }

    // SCRUM-178 & SCRUM-185: Push personal app to /apps/personal and honor Free-tier 403 paywall
    if (this.isLiveToken(token)) {
      try {
        const baseUrl = this.getBackendApiUrl();
        const response = await fetch(`${baseUrl}/apps/personal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: newApp.id,
            name: newApp.name,
            protocol: newApp.protocol,
            launchUrl: newApp.launchUrl,
            category: newApp.category,
            icon: newApp.icon,
            description: newApp.description,
            assignedUsername: newApp.assignedUsername,
            assignedPassword: newApp.assignedPassword,
          }),
        });
        if (response.status === 403) {
          const errBody = await response.json().catch(() => ({}));
          if (
            errBody?.error === 'billing_limit_reached' ||
            errBody?.code === 'PAYWALL_REQUIRED' ||
            errBody?.upgradeRequired
          ) {
            await this.savePersonalApps(apps, email);
            throw new BillingLimitError(
              errBody?.message || 'Free plan integrated app limit reached. Upgrade via PayMongo to unlock unlimited apps.',
              'integrated_apps',
            );
          }
        }
      } catch (err) {
        if (isBillingLimitError(err)) {
          throw err;
        }
        // Non-blocking network fallback for offline usage
      }
    }

    return newApp;
  }

  static async syncPersonalAppsWithBackend(
    token?: string,
    email?: string,
  ): Promise<SaaSApp[]> {
    const currentLocal = await this.getPersonalApps(email);
    if (!this.isLiveToken(token)) return currentLocal;

    const cleanEmail = email?.trim().toLowerCase() || 'default';
    const migrationKey = `@vanguard_personal_apps_migrated_${cleanEmail}`;

    try {
      const baseUrl = this.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`${baseUrl}/apps/personal`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows)) {
          const alreadyMigrated = (await getStoredItem(migrationKey)) === '1';
          if (rows.length === 0 && !alreadyMigrated && currentLocal.length > 0) {
            await setStoredItem(migrationKey, '1');
            for (const app of currentLocal) {
              await fetch(`${baseUrl}/apps/personal`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                  id: app.id,
                  name: app.name,
                  protocol: app.protocol || 'Extension Autofill',
                  launchUrl: app.launchUrl,
                  category: app.category || 'cloud',
                  icon: app.icon || '🌐',
                  description: app.description || '',
                  assignedUsername: app.assignedUsername,
                  assignedPassword: app.assignedPassword,
                }),
              }).catch(() => {});
            }
            return currentLocal;
          }

          await setStoredItem(migrationKey, '1');
          const mapped: SaaSApp[] = rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            category: (r.category as SaaSApp['category']) || 'cloud',
            description: r.description || '',
            icon: r.icon || '🌐',
            protocol: r.protocol || 'Extension Autofill',
            launchUrl: r.launchUrl || r.launch_url || '',
            assigned: r.assigned !== false,
            status: 'Approved',
            assignedUsername: r.assignedUsername || r.assigned_username,
            assignedPassword: r.assignedPassword || r.assigned_password,
            targetUserId: r.userId || r.targetUserId,
            targetUserEmail: cleanEmail !== 'default' ? cleanEmail : undefined,
          }));
          await this.savePersonalApps(mapped, email);
          return mapped;
        }
      }
    } catch {
      // Offline fallback keeps cached local personal apps
    }
    return currentLocal;
  }

  static async deletePersonalApp(
    id: string,
    email?: string,
    token?: string,
    _userId?: string
  ): Promise<void> {
    const apps = await this.getPersonalApps(email);
    const updated = apps.filter((a) => a.id !== id);
    await this.savePersonalApps(updated, email);

    const entApps = await this.getEnterpriseApps(email);
    const updatedEnt = entApps.filter((a) => a.id !== id);
    if (updatedEnt.length !== entApps.length) {
      await this.saveEnterpriseApps(updatedEnt, email);
    }

    if (this.isLiveToken(token)) {
      try {
        const baseUrl = this.getBackendApiUrl();
        fetch(`${baseUrl}/apps/personal/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }).catch(() => {});
      } catch {
        // Non-blocking
      }
    }
  }

  /**
   * Enterprise Applications (SCRUM-83: starts empty unless dynamically assigned)
   */
  static async getEnterpriseApps(email?: string): Promise<SaaSApp[]> {
    try {
      const userKey = this.getEnterpriseAppsKey(email);
      let data = await getStoredItem(userKey);
      if (!data && email) {
        data = await getStoredItem(STORAGE_KEYS.ENTERPRISE_APPS);
      }
      if (data) {
        const parsed: SaaSApp[] = JSON.parse(data);
        const legacyIds = new Set(['app-aws', 'app-slack', 'app-github', 'app-google', 'app-figma']);
        const cleaned = parsed.filter((a) => !legacyIds.has(a.id));
        if (cleaned.length !== parsed.length) {
          await setStoredItem(userKey, JSON.stringify(cleaned));
          await setStoredItem(STORAGE_KEYS.ENTERPRISE_APPS, JSON.stringify(cleaned));
        }
        return cleaned;
      }
      return [];
    } catch {
      return [];
    }
  }

  static async saveEnterpriseApps(apps: SaaSApp[], email?: string): Promise<void> {
    try {
      const json = JSON.stringify(apps);
      const userKey = this.getEnterpriseAppsKey(email);
      await setStoredItem(userKey, json);
      await setStoredItem(STORAGE_KEYS.ENTERPRISE_APPS, json);
    } catch {
      // Ignored
    }
  }

  /**
   * Synchronize tenant/enterprise apps with the live production backend (GET /apps/my)
   */
  static async syncEnterpriseAppsWithBackend(
    token?: string,
    email?: string,
  ): Promise<SaaSApp[]> {
    const currentLocal = await this.getEnterpriseApps(email);
    if (!this.isLiveToken(token)) return currentLocal;

    try {
      const baseUrl = this.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`${baseUrl}/apps/my`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows)) {
          const mapped: SaaSApp[] = rows.map((r: any) => ({
            id: r.app_id || r.id,
            name: r.name,
            category: (r.category as SaaSApp['category']) || 'cloud',
            description: r.description || `${r.name} enterprise application`,
            icon: r.icon || '🌐',
            protocol: r.protocol || 'SAML 2.0',
            launchUrl: r.launch_url || r.launchUrl || '',
            assigned: r.assigned !== false,
            inheritedViaGroup: r.inherited_via_group || undefined,
            status: 'Approved',
            assignedUsername: r.assigned_username || r.assignedUsername,
            assignedPassword: r.assigned_password || r.assignedPassword,
            targetUserId: r.user_id || r.targetUserId,
            targetUserEmail: r.target_user_email || r.targetUserEmail,
          }));

          const dedupedMap = new Map<string, SaaSApp>();
          for (const app of mapped) {
            const key = (app.name || app.id).toLowerCase().trim();
            if (!dedupedMap.has(key)) {
              dedupedMap.set(key, app);
            }
          }
          const authoritative = Array.from(dedupedMap.values());
          await this.saveEnterpriseApps(authoritative, email);
          return authoritative;
        }
      }
    } catch {
      // Offline fallback
    }
    return currentLocal;
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
    const configured =
      typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_URL : undefined;
    if (configured && typeof configured === 'string' && configured.trim().length > 0) {
      const normalized = configured.trim().replace(/\/$/, '');
      if (!normalized.includes('backend-vanguard.onrender.com')) {
        return normalized;
      }
    }
    return 'http://127.0.0.1:3000';
  }

  static getSupabaseUrl(): string {
    const configured =
      typeof process !== 'undefined'
        ? process.env?.EXPO_PUBLIC_SUPABASE_URL || process.env?.SUPABASE_URL
        : undefined;
    if (configured && typeof configured === 'string' && configured.trim().length > 0) {
      return configured.trim().replace(/\/$/, '');
    }
    return 'https://jvvidkrwrqhlshnpufdd.supabase.co';
  }

  static getSupabasePublishableKey(): string {
    const configured =
      typeof process !== 'undefined'
        ? process.env?.EXPO_PUBLIC_SUPABASE_KEY || process.env?.SUPABASE_KEY
        : undefined;
    if (configured && typeof configured === 'string' && configured.trim().length > 0) {
      return configured.trim();
    }
    return 'sb_publishable_M44OcaVK3zxBqdy1Sj4SzQ_0FHQCzU5';
  }

  static getSecondarySupabaseUrl(): string {
    const configured =
      typeof process !== 'undefined'
        ? process.env?.EXPO_PUBLIC_SUPABASE_URL_SECOND || process.env?.SUPABASE_URL_SECOND
        : undefined;
    if (configured && typeof configured === 'string' && configured.trim().length > 0) {
      return configured.trim().replace(/\/$/, '');
    }
    return 'https://pqerfqomwujdyrfbnmer.supabase.co';
  }

  static getSecondarySupabasePublishableKey(): string {
    const configured =
      typeof process !== 'undefined'
        ? process.env?.EXPO_PUBLIC_SUPABASE_KEY_SECOND || process.env?.SUPABASE_KEY_SECOND
        : undefined;
    if (configured && typeof configured === 'string' && configured.trim().length > 0) {
      return configured.trim();
    }
    return 'sb_publishable_Q70rh6zz4fgr81rguy-dvw_q5iZFnxU';
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

  static async syncConnectedAppsWithBackend(
    email?: string,
    token?: string,
  ): Promise<UserConnectedApp[]> {
    const currentLocal = await this.getConnectedApps();
    if (!this.isLiveToken(token)) return currentLocal;

    try {
      const baseUrl = this.getBackendApiUrl();
      const url = email
        ? `${baseUrl}/oauth/connected-apps?email=${encodeURIComponent(email)}`
        : `${baseUrl}/oauth/connected-apps`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const body = await response.json();
        if (body?.success && Array.isArray(body.connectedApps)) {
          const authoritative = this.deduplicateConnectedApps(body.connectedApps);
          await this.saveConnectedApps(authoritative);
          return authoritative;
        }
      }
    } catch {
      // Gracefully fall back to local storage if backend is unreachable or offline
    }
    return currentLocal;
  }

  static async disconnectConnectedApp(
    clientId: string,
    email?: string,
    token?: string,
  ): Promise<void> {
    const apps = await this.getConnectedApps();
    const target = apps.find((a) => a.clientId === clientId);
    const targetOrigin = target ? (target.originUrl || '').toLowerCase().trim().replace(/\/$/, '') : '';

    const updated = apps.filter((a) => {
      const origin = (a.originUrl || '').toLowerCase().trim().replace(/\/$/, '');
      return a.clientId !== clientId && (!targetOrigin || origin !== targetOrigin);
    });

    await this.saveConnectedApps(updated);

    // Notify backend revocation with Bearer JWT if live session token is available
    if (this.isLiveToken(token)) {
      try {
        const baseUrl = this.getBackendApiUrl();
        const url = email
          ? `${baseUrl}/oauth/connected-apps/${encodeURIComponent(clientId)}?email=${encodeURIComponent(email)}`
          : `${baseUrl}/oauth/connected-apps/${encodeURIComponent(clientId)}`;
        fetch(url, {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      } catch {
        // Non-blocking
      }
    }
  }

  /**
   * Access Requests (SCRUM-42 & SCRUM-83: starts empty, dynamic user requests)
   */
  static async getAccessRequests(email?: string): Promise<AppAccessRequest[]> {
    try {
      const userKey = this.getAccessRequestsKey(email);
      let data = await getStoredItem(userKey);
      if (!data && email) {
        data = await getStoredItem(STORAGE_KEYS.ACCESS_REQUESTS);
      }
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
          await setStoredItem(userKey, JSON.stringify(cleaned));
          await setStoredItem(STORAGE_KEYS.ACCESS_REQUESTS, JSON.stringify(cleaned));
        }
        return cleaned;
      }
      return [];
    } catch {
      return [];
    }
  }

  static async saveAccessRequests(requests: AppAccessRequest[], email?: string): Promise<void> {
    try {
      const json = JSON.stringify(requests);
      const userKey = this.getAccessRequestsKey(email);
      await setStoredItem(userKey, json);
      await setStoredItem(STORAGE_KEYS.ACCESS_REQUESTS, json);
    } catch {
      // Ignored
    }
  }

  /**
   * Synchronize access requests with backend (GET /apps/access-requests)
   */
  static async syncAccessRequestsWithBackend(
    token?: string,
    email?: string,
  ): Promise<AppAccessRequest[]> {
    const currentLocal = await this.getAccessRequests(email);
    if (!this.isLiveToken(token)) return currentLocal;

    try {
      const baseUrl = this.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`${baseUrl}/apps/access-requests`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows)) {
          const mapped: AppAccessRequest[] = rows.map((r: any) => ({
            id: r.id,
            userId: r.user_id || r.userId,
            userName: r.user_name || r.userName || 'Authenticated User',
            userEmail: r.user_email || r.userEmail || '',
            department: r.department || 'Engineering',
            role: r.role || 'user',
            appName: r.app_name || r.appName,
            protocol: r.protocol || 'SAML 2.0',
            category: r.category || 'collaboration',
            icon: r.icon || '🚀',
            launchUrl: r.launch_url || r.launchUrl,
            justification: r.justification || '',
            status: r.status,
            submittedAt: r.created_at || r.submittedAt || new Date().toISOString(),
            reviewedAt: r.reviewed_at || r.reviewedAt,
            reviewedBy: r.reviewed_by || r.reviewedBy,
            adminNotes: r.admin_notes || r.adminNotes,
          }));

          const authoritative = Array.from(
            new Map(mapped.map((req) => [req.id, req])).values(),
          );
          await this.saveAccessRequests(authoritative, email);
          return authoritative;
        }
      }
    } catch {
      // Offline fallback
    }
    return currentLocal;
  }

  static async submitAccessRequest(
    input: {
      appName: string;
      justification: string;
      category?: AppItemCategory;
      icon?: string;
      userName?: string;
      userEmail?: string;
      department?: string;
      role?: string;
    },
    token?: string,
  ): Promise<AppAccessRequest> {
    const requests = await this.getAccessRequests(input.userEmail);
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
    await this.saveAccessRequests(updated, input.userEmail);

    if (this.isLiveToken(token)) {
      try {
        const baseUrl = this.getBackendApiUrl();
        fetch(`${baseUrl}/apps/access-requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            appName: input.appName,
            justification: input.justification,
            category: input.category || 'collaboration',
            icon: input.icon || '🚀',
            protocol: 'SAML 2.0',
            deliveryMode: 'sso',
          }),
        }).catch(() => {});
      } catch {
        // Non-blocking
      }
    }

    return newReq;
  }

  static async approveAccessRequest(
    id: string,
    reviewedBy: string = 'Company Admin',
    token?: string,
    notes?: string,
    email?: string,
  ): Promise<AppAccessRequest | null> {
    const requests = await this.getAccessRequests(email);
    let updatedTarget: AppAccessRequest | null = null;
    const updated = requests.map((r) => {
      if (r.id === id) {
        updatedTarget = {
          ...r,
          status: 'Approved' as const,
          reviewedAt: new Date().toISOString(),
          reviewedBy,
          adminNotes: notes,
        };
        return updatedTarget;
      }
      return r;
    });
    if (updatedTarget) {
      await this.saveAccessRequests(updated, email);
    }

    if (token) {
      try {
        const baseUrl = this.getBackendApiUrl();
        fetch(`${baseUrl}/apps/access-requests/${encodeURIComponent(id)}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ adminNotes: notes }),
        }).catch(() => {});
      } catch {
        // Non-blocking
      }
    }

    return updatedTarget;
  }

  static async rejectAccessRequest(
    id: string,
    reviewedBy: string = 'Company Admin',
    adminNotes?: string,
    token?: string,
    email?: string,
  ): Promise<AppAccessRequest | null> {
    const requests = await this.getAccessRequests(email);
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
      await this.saveAccessRequests(updated, email);
    }

    if (token) {
      try {
        const baseUrl = this.getBackendApiUrl();
        fetch(`${baseUrl}/apps/access-requests/${encodeURIComponent(id)}/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ adminNotes }),
        }).catch(() => {});
      } catch {
        // Non-blocking
      }
    }

    return updatedTarget;
  }

  /**
   * Personal Vault Credentials (SCRUM-83: starts empty, dynamic detection)
   */
  static async getVaultItems(email?: string): Promise<PersonalVaultItem[]> {
    try {
      const userKey = this.getVaultItemsKey(email);
      let data = await getStoredItem(userKey);
      if (!data && email) {
        data = await getStoredItem(STORAGE_KEYS.VAULT_ITEMS);
      }
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
          await setStoredItem(userKey, JSON.stringify(cleaned));
          await setStoredItem(STORAGE_KEYS.VAULT_ITEMS, JSON.stringify(cleaned));
        }
        return cleaned;
      }
      return [];
    } catch {
      return [];
    }
  }

  static async saveVaultItems(items: PersonalVaultItem[], email?: string): Promise<void> {
    try {
      const json = JSON.stringify(items);
      const userKey = this.getVaultItemsKey(email);
      await setStoredItem(userKey, json);
      await setStoredItem(STORAGE_KEYS.VAULT_ITEMS, json);
    } catch {
      // Ignored
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
