import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  BillingAccountType,
  BillingEntitlements,
  BillingPlanDefinition,
  BillingPlanId,
  BillingSubscriptionState,
  BillingCheckoutInitResponse,
} from '../models/billing.models.ts';
import { AppsStorageService } from './apps-storage.service.ts';
import { isLiveBackendToken } from './totp-sync.service.ts';

const BILLING_CACHE_PREFIX = '@vanguard_billing_subscription_';
const memoryBillingStore = new Map<string, string>();

const ADMIN_ROLE_PREFIXES = [
  'admin',
  'super_admin',
  'super administrator',
  'security officer',
  'security_officer',
  'manager',
  'owner',
];

export const INDIVIDUAL_BILLING_PLANS: BillingPlanDefinition[] = [
  {
    id: 'free',
    accountType: 'individual',
    name: 'Free Starter',
    tagline: 'Essential single-app & personal MFA starter tier',
    priceMonthlyUsd: 0,
    priceMonthlyPhp: 0,
    features: [
      '1 integrated application (2nd+ locked)',
      'Up to 3 third-party 2FA accounts',
      'CSV security audit export locked (7d view)',
    ],
  },
  {
    id: 'personal_pro',
    accountType: 'individual',
    name: 'Personal Pro',
    tagline: 'Unlimited personal apps, 2FA vault & audit CSV export',
    priceMonthlyUsd: 5,
    priceMonthlyPhp: 290,
    popular: true,
    features: [
      'Unlimited integrated applications',
      'Unlimited 3rd-party 2FA Authenticator accounts',
      '90-day Personal Activity History + CSV Export',
    ],
  },
];

export const COMPANY_BILLING_PLANS: BillingPlanDefinition[] = [
  {
    id: 'free',
    accountType: 'company',
    name: 'Company Free Trial',
    tagline: 'Starter organization tier — employees inherit Free limits until Admin upgrades',
    priceMonthlyUsd: 0,
    priceMonthlyPhp: 0,
    features: [
      '1 integrated application org-wide',
      'Up to 3 third-party 2FA accounts per member',
      'CSV security audit export locked org-wide',
    ],
  },
  {
    id: 'business_pro',
    accountType: 'company',
    name: 'Business Pro',
    tagline: 'Team SSO launchpad, unlimited 2FA & CSV security audit logs',
    priceMonthlyUsd: 29,
    priceMonthlyPhp: 1690,
    popular: true,
    features: [
      'Unlimited corporate & personal app integrations',
      'Unlimited 2FA accounts for all tenant employees',
      '30-day Retention + CSV Security Audit Export',
    ],
  },
  {
    id: 'enterprise',
    accountType: 'company',
    name: 'Enterprise Zero-Trust',
    tagline: 'Unlimited org scale, 365-day forensic audit archive & priority SLA',
    priceMonthlyUsd: 79,
    priceMonthlyPhp: 4590,
    features: [
      'Unlimited apps & Unlimited 2FA accounts org-wide',
      '365-day Forensic Security Audit Retention + CSV Export',
      'Priority Zero-Trust Support & SLA',
    ],
  },
];

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const norm = role.toLowerCase().trim();
  return ADMIN_ROLE_PREFIXES.some((p) => norm.startsWith(p));
}

export function defaultEntitlementsForPlan(
  planId: BillingPlanId,
  accountType: BillingAccountType,
): BillingEntitlements {
  if (planId === 'free') {
    return {
      maxIntegratedApps: 1,
      maxTotpAccounts: 3,
      maxVaultItems: 10,
      auditRetentionDays: accountType === 'individual' ? 7 : 1,
      auditCsvExport: false,
      prioritySupport: false,
    };
  }
  if (planId === 'personal_pro') {
    return {
      maxIntegratedApps: -1,
      maxTotpAccounts: -1,
      maxVaultItems: -1,
      auditRetentionDays: 90,
      auditCsvExport: true,
      prioritySupport: false,
    };
  }
  if (planId === 'enterprise') {
    return {
      maxIntegratedApps: -1,
      maxTotpAccounts: -1,
      maxVaultItems: -1,
      auditRetentionDays: 365,
      auditCsvExport: true,
      prioritySupport: true,
    };
  }
  return {
    maxIntegratedApps: -1,
    maxTotpAccounts: -1,
    maxVaultItems: -1,
    auditRetentionDays: 30,
    auditCsvExport: true,
    prioritySupport: true,
  };
}

export function buildDefaultSubscriptionState(user?: {
  id?: string | null;
  email?: string | null;
  accountType?: BillingAccountType | null;
  role?: string | null;
  companyName?: string | null;
} | null): BillingSubscriptionState {
  const accountType: BillingAccountType =
    user?.accountType === 'company' ? 'company' : 'individual';
  const admin = accountType === 'company' && isAdminRole(user?.role);
  const canManageBilling = accountType === 'individual' || admin;

  return {
    accountType,
    planId: 'free',
    planName: accountType === 'individual' ? 'Free Starter' : 'Company Free Trial',
    status: 'active',
    scopeKey:
      accountType === 'company'
        ? `company:${(user?.companyName || 'tenant').toLowerCase().trim()}`
        : `individual:${user?.id || user?.email || 'anon'}`,
    tenantId: null,
    canManageBilling,
    roleLabel:
      accountType === 'individual'
        ? 'Individual Account'
        : admin
          ? 'Company Administrator'
          : 'Tenant Employee (Read-Only)',
    priceMonthlyUsd: 0,
    priceMonthlyPhp: 0,
    entitlements: defaultEntitlementsForPlan('free', accountType),
    invoices: [],
  };
}

async function readCache(key: string): Promise<string | null> {
  try {
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      const val = await AsyncStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
    }
  } catch {
    // Fallback
  }
  return memoryBillingStore.get(key) ?? null;
}

async function writeCache(key: string, value: string): Promise<void> {
  memoryBillingStore.set(key, value);
  try {
    if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      await AsyncStorage.setItem(key, value);
    }
  } catch {
    // Fallback
  }
}

export function getCacheKeyForUser(email?: string | null, accountType?: BillingAccountType | null): string {
  const cleanEmail = (email || 'anon').toLowerCase().trim();
  const acct = accountType === 'company' ? 'company' : 'individual';
  return `${BILLING_CACHE_PREFIX}${acct}_${cleanEmail}`;
}

export class BillingService {
  static getVisiblePlans(accountType: BillingAccountType): BillingPlanDefinition[] {
    return accountType === 'company' ? COMPANY_BILLING_PLANS : INDIVIDUAL_BILLING_PLANS;
  }

  static isPaidActive(sub: BillingSubscriptionState): boolean {
    return sub.status === 'active' && sub.planId !== 'free';
  }

  static checkAppQuota(
    currentCount: number,
    sub: BillingSubscriptionState,
    organizationName = 'your company',
  ): { allowed: boolean; reason?: string } {
    const limit = sub.entitlements.maxIntegratedApps;
    if (limit === -1 || currentCount < limit) {
      return { allowed: true };
    }
    if (sub.accountType === 'individual') {
      return {
        allowed: false,
        reason: `Free plan allows ${limit} integrated app. Upgrade to Personal Pro ($5/mo via PayMongo) for unlimited apps across web & mobile.`,
      };
    }
    if (!sub.canManageBilling) {
      return {
        allowed: false,
        reason: `${organizationName} is on Company Free Trial (${limit} app max). Wait for your Company Administrator to upgrade via PayMongo.`,
      };
    }
    return {
      allowed: false,
      reason: `Company Free Trial allows ${limit} app org-wide. Upgrade to Business Pro ($29/mo) or Enterprise ($79/mo) via PayMongo to unlock your organization.`,
    };
  }

  static checkTotpQuota(
    currentCount: number,
    sub: BillingSubscriptionState,
    organizationName = 'your company',
  ): { allowed: boolean; reason?: string } {
    const limit = sub.entitlements.maxTotpAccounts;
    if (limit === -1 || currentCount < limit) {
      return { allowed: true };
    }
    if (sub.accountType === 'individual') {
      return {
        allowed: false,
        reason: `Free Starter allows ${limit} 2FA Authenticator accounts. Upgrade to Personal Pro ($5/mo via PayMongo) for unlimited 2FA tokens.`,
      };
    }
    if (!sub.canManageBilling) {
      return {
        allowed: false,
        reason: `${organizationName} is on Company Free Trial (${limit} 2FA tokens max). Wait for your Company Administrator to upgrade.`,
      };
    }
    return {
      allowed: false,
      reason: `Company Free Trial allows ${limit} 2FA Authenticator accounts per member. Upgrade via PayMongo to unlock unlimited 2FA.`,
    };
  }

  static async getCachedSubscription(
    user?: {
      id?: string | null;
      email?: string | null;
      accountType?: BillingAccountType | null;
      role?: string | null;
      companyName?: string | null;
    } | null,
  ): Promise<BillingSubscriptionState> {
    const fallback = buildDefaultSubscriptionState(user);
    if (!user?.email) return fallback;
    try {
      const raw = await readCache(getCacheKeyForUser(user.email, fallback.accountType));
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<BillingSubscriptionState>;
      if (!parsed || !parsed.planId) return fallback;
      const acct = parsed.accountType === 'company' || parsed.accountType === 'individual'
        ? parsed.accountType
        : fallback.accountType;
      return {
        ...fallback,
        ...parsed,
        accountType: acct,
        // Always derive canManageBilling dynamically from current role/accountType unless server overrides
        canManageBilling:
          typeof parsed.canManageBilling === 'boolean'
            ? parsed.canManageBilling
            : fallback.canManageBilling,
        entitlements:
          parsed.entitlements || defaultEntitlementsForPlan(parsed.planId, acct),
      };
    } catch {
      return fallback;
    }
  }

  static async fetchSubscription(
    token: string,
    user?: {
      id?: string | null;
      email?: string | null;
      accountType?: BillingAccountType | null;
      role?: string | null;
      companyName?: string | null;
    } | null,
  ): Promise<BillingSubscriptionState | null> {
    if (!isLiveBackendToken(token)) return null;

    const baseUrl = AppsStorageService.getBackendApiUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(`${baseUrl}/billing/subscription`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) return null;

      const data = (await response.json()) as any;
      if (!data || !data.planId) return null;

      const acct: BillingAccountType =
        data.accountType === 'company' ? 'company' : 'individual';
      const fallback = buildDefaultSubscriptionState({
        ...user,
        accountType: acct,
      });

      const normalized: BillingSubscriptionState = {
        accountType: acct,
        planId: data.planId,
        planName:
          data.planName ||
          (data.planId === 'free'
            ? acct === 'company'
              ? 'Company Free Trial'
              : 'Free Starter'
            : data.planId),
        status: data.status || 'active',
        scopeKey: data.scopeKey || fallback.scopeKey,
        tenantId: data.tenantId ?? null,
        canManageBilling:
          typeof data.canManageBilling === 'boolean'
            ? data.canManageBilling
            : fallback.canManageBilling,
        roleLabel: data.roleLabel || fallback.roleLabel,
        priceMonthlyUsd: Number(data.priceMonthlyUsd ?? 0),
        priceMonthlyPhp: Number(data.priceMonthlyPhp ?? 0),
        entitlements:
          data.entitlements || defaultEntitlementsForPlan(data.planId, acct),
        invoices: Array.isArray(data.invoices) ? data.invoices : [],
        updatedAt: data.currentPeriodStart || new Date().toISOString(),
      };

      if (user?.email) {
        await writeCache(
          getCacheKeyForUser(user.email, acct),
          JSON.stringify(normalized),
        );
      }
      return normalized;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  static async initiatePaymongoCheckout(
    token: string,
    planId: 'personal_pro' | 'business_pro' | 'enterprise',
    accountType: BillingAccountType,
    returnOrigin?: string,
  ): Promise<BillingCheckoutInitResponse> {
    if (!isLiveBackendToken(token)) {
      throw new Error('Sign in with a live Vanguard account to initiate PayMongo checkout.');
    }

    const baseUrl = AppsStorageService.getBackendApiUrl();
    const response = await fetch(`${baseUrl}/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        accountType,
        planId,
        ...(returnOrigin ? { returnOrigin } : {}),
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.message || 'Unable to start PayMongo Sandbox checkout.');
    }
    return body as BillingCheckoutInitResponse;
  }

  static async cancelSubscription(
    token: string,
    accountType: BillingAccountType,
    userEmail?: string | null,
  ): Promise<BillingSubscriptionState | null> {
    if (!isLiveBackendToken(token)) return null;

    const baseUrl = AppsStorageService.getBackendApiUrl();
    const response = await fetch(`${baseUrl}/billing/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accountType }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.message || 'Unable to cancel subscription.');
    }
    const sub = body?.subscription as BillingSubscriptionState | undefined;
    if (sub && userEmail) {
      await writeCache(
        getCacheKeyForUser(userEmail, accountType),
        JSON.stringify(sub),
      );
    }
    return sub ?? null;
  }
}
