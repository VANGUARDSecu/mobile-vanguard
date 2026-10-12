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
}

export const ENTERPRISE_APP_SUGGESTIONS = [
  { name: 'Figma Enterprise', category: 'collaboration' as const, icon: '🎨' },
  { name: 'Salesforce CRM', category: 'collaboration' as const, icon: '💼' },
  { name: 'Snowflake Data Cloud', category: 'cloud' as const, icon: '❄️' },
  { name: 'Datadog APM', category: 'developer' as const, icon: '🐶' },
  { name: 'Splunk Enterprise', category: 'cloud' as const, icon: '🔍' },
];
