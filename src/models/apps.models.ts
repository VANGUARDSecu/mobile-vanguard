export type AppItemCategory = 'cloud' | 'developer' | 'collaboration' | 'custom';
export type AppCategory = 'all' | AppItemCategory;

export type AppProtocol = 'SAML 2.0' | 'OIDC' | 'OAuth 2.0' | 'Web Auth' | (string & {});

export interface SaaSApp {
  id: string;
  name: string;
  category: AppItemCategory;
  description: string;
  icon: string;
  protocol: AppProtocol;
  launchUrl: string;
  assigned: boolean;
  inheritedViaGroup?: string;
  status?: string;
  isIntegrated?: boolean;
  connectedUrl?: string;
  connectionStatus?: string;
  assignedUsername?: string;
  assignedPassword?: string;
  targetUserId?: string;
  targetUserEmail?: string;
}

export interface UserConnectedApp {
  id: string;
  clientId: string;
  clientName: string;
  userEmail?: string;
  protocol: string;
  scopes: string[];
  redirectUri: string;
  originUrl: string;
  status: 'Connected' | 'Active' | 'Disconnected';
  connectedAt: string;
  lastActiveAt?: string;
  icon?: string;
  description?: string;
}

export type AccessRequestStatus = 'Pending Approval' | 'Approved' | 'Rejected';

export interface AppAccessRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  department: string;
  role: string;
  appName: string;
  protocol: AppProtocol;
  category: AppItemCategory;
  icon?: string;
  launchUrl?: string;
  justification: string;
  status: AccessRequestStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNotes?: string;
}

export interface PersonalVaultItem {
  id: string;
  userId?: string;
  title: string;
  category: 'Login' | 'Card' | 'Identity' | 'Secure Note';
  username: string;
  password?: string;
  totpSecret?: string;
  url?: string;
  notes?: string;
  favorite?: boolean;
  updatedAt: string;
}

export interface PersonalAppInput {
  name: string;
  category: 'cloud' | 'developer' | 'collaboration';
  launchUrl: string;
  description?: string;
  icon?: string;
  username?: string;
  password?: string;
}

export const ENTERPRISE_APP_SUGGESTIONS = [
  { name: 'Figma Enterprise', category: 'collaboration' as const, icon: '🎨' },
  { name: 'Salesforce CRM', category: 'collaboration' as const, icon: '💼' },
  { name: 'Snowflake Data Cloud', category: 'cloud' as const, icon: '❄️' },
  { name: 'Datadog APM', category: 'developer' as const, icon: '🐶' },
  { name: 'Splunk Enterprise', category: 'cloud' as const, icon: '🔍' },
];

export function normalizeIntegratedAppKey(value?: string | null): string {
  return (value || '').trim().toLowerCase().replace(/\/+$/, '');
}

function getNormalizedOrigin(rawUrl?: string | null): string {
  const norm = normalizeIntegratedAppKey(rawUrl);
  if (!norm) return '';
  try {
    return new URL(norm.startsWith('http') ? norm : `https://${norm}`).origin.toLowerCase();
  } catch {
    return norm;
  }
}

export function isAppMatchedConnectedApp(
  app: Pick<SaaSApp, 'id' | 'name' | 'launchUrl'>,
  connectedApps: readonly Pick<UserConnectedApp, 'clientId' | 'clientName' | 'originUrl'>[],
): boolean {
  const appId = normalizeIntegratedAppKey(app.id);
  const appName = normalizeIntegratedAppKey(app.name);
  const appUrl = normalizeIntegratedAppKey(app.launchUrl);
  const appOrigin = getNormalizedOrigin(app.launchUrl);

  return connectedApps.some((conn) => {
    const cId = normalizeIntegratedAppKey(conn.clientId);
    const cName = normalizeIntegratedAppKey(conn.clientName);
    const cUrl = normalizeIntegratedAppKey(conn.originUrl);
    const cOrigin = getNormalizedOrigin(conn.originUrl);
    return Boolean(
      (appId && cId && appId === cId) ||
        (appName && cName && appName === cName) ||
        (appUrl && cUrl && appUrl === cUrl) ||
        (appOrigin && cOrigin && appOrigin === cOrigin),
    );
  });
}

function collectUnifiedSlotKeys(
  activeApps: readonly Pick<SaaSApp, 'id' | 'name' | 'launchUrl'>[],
  connectedApps: readonly Pick<UserConnectedApp, 'clientId' | 'clientName' | 'originUrl'>[],
): Set<string> {
  const keys = new Set<string>();
  for (const conn of connectedApps) {
    const key =
      normalizeIntegratedAppKey(conn.clientName) ||
      getNormalizedOrigin(conn.originUrl) ||
      normalizeIntegratedAppKey(conn.clientId);
    if (key) keys.add(key);
  }
  for (const app of activeApps) {
    if (isAppMatchedConnectedApp(app, connectedApps)) continue;
    const key =
      normalizeIntegratedAppKey(app.name) ||
      getNormalizedOrigin(app.launchUrl) ||
      normalizeIntegratedAppKey(app.id);
    if (key) keys.add(key);
  }
  return keys;
}

export function countUnifiedIntegratedApps(
  activeApps: readonly Pick<SaaSApp, 'id' | 'name' | 'launchUrl'>[],
  connectedApps: readonly Pick<UserConnectedApp, 'clientId' | 'clientName' | 'originUrl'>[],
): number {
  return collectUnifiedSlotKeys(activeApps, connectedApps).size;
}

export function isIntegratedAppSlotTaken(
  appName: string | undefined,
  launchUrl: string | undefined,
  activeApps: readonly Pick<SaaSApp, 'id' | 'name' | 'launchUrl'>[],
  connectedApps: readonly Pick<UserConnectedApp, 'clientId' | 'clientName' | 'originUrl'>[],
): boolean {
  if (isAppMatchedConnectedApp({ id: '', name: appName || '', launchUrl: launchUrl || '' }, connectedApps)) {
    return true;
  }
  const slots = collectUnifiedSlotKeys(activeApps, connectedApps);
  const normName = normalizeIntegratedAppKey(appName);
  if (normName && slots.has(normName)) return true;
  const origin = getNormalizedOrigin(launchUrl);
  if (origin && slots.has(origin)) return true;
  return false;
}
