export type BillingAccountType = 'individual' | 'company';

export type BillingPlanId = 'free' | 'personal_pro' | 'business_pro' | 'enterprise';

export interface BillingEntitlements {
  maxIntegratedApps: number; // -1 = unlimited
  maxTotpAccounts: number; // -1 = unlimited
  maxVaultItems: number;
  auditRetentionDays: number;
  auditCsvExport: boolean;
  prioritySupport: boolean;
}

export interface BillingPlanDefinition {
  id: BillingPlanId;
  accountType: BillingAccountType;
  name: string;
  tagline: string;
  priceMonthlyUsd: number;
  priceMonthlyPhp: number;
  popular?: boolean;
  features: string[];
}

export interface BillingInvoiceRecord {
  id: string;
  receiptNumber?: string;
  planId: BillingPlanId;
  planName: string;
  accountType?: BillingAccountType;
  amountUsd: number;
  amountPhp?: number;
  status: 'paid' | 'failed' | 'pending' | 'cancelled';
  date: string;
  transactionId: string;
  paymentMethod?: string;
  buyerEmail?: string;
  receiptSentTo?: string;
  gatewayPayerEmail?: string;
  receiptDeliveryStatus?: 'sent' | 'logged' | 'failed';
  receiptSentAt?: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface PaidCycleCredit {
  planId: Exclude<BillingPlanId, 'free'>;
  planName: string;
  paidUntil: string;
  lastTransactionId: string | null;
  downgradedAt?: string;
}

export interface BillingSubscriptionState {
  accountType: BillingAccountType;
  planId: BillingPlanId;
  planName: string;
  status: 'active' | 'cancelled' | 'past_due';
  scopeKey: string;
  tenantId: string | null;
  canManageBilling: boolean;
  roleLabel: string;
  priceMonthlyUsd: number;
  priceMonthlyPhp: number;
  currentPeriodEnd?: string | null;
  paidCredit?: PaidCycleCredit | null;
  entitlements: BillingEntitlements;
  invoices: BillingInvoiceRecord[];
  updatedAt?: string;
}

export interface BillingCheckoutInitResponse {
  sessionId: string;
  mode: 'paymongo_api' | 'local_sandbox';
  checkoutUrl: string;
  amountPhp: number;
  amountUsd: number;
}

export class BillingLimitError extends Error {
  readonly code = 'BILLING_LIMIT_REACHED';
  readonly feature?: string;
  readonly upgradeRequired = true;

  constructor(message: string, feature?: string) {
    super(message);
    this.name = 'BillingLimitError';
    this.feature = feature;
  }
}

export function isBillingLimitError(err: unknown): err is BillingLimitError {
  return (
    err instanceof BillingLimitError ||
    (typeof err === 'object' &&
      err !== null &&
      ((err as any).code === 'BILLING_LIMIT_REACHED' ||
        (err as any).name === 'BillingLimitError'))
  );
}

/**
 * Parses a backend HTTP 403 payload into a BillingLimitError whenever any
 * structured paywall field or free-tier/upgrade message is present.
 */
export function parseBillingLimitResponse(
  status: number,
  errBody: any,
  feature: string,
  fallbackMessage: string,
): BillingLimitError | null {
  if (status !== 403) return null;
  const msg = typeof errBody?.message === 'string' ? errBody.message : '';
  if (
    errBody?.error === 'billing_limit_reached' ||
    errBody?.code === 'PAYWALL_REQUIRED' ||
    Boolean(errBody?.upgradeRequired) ||
    /free\s*(tier|trial|plan)|plan\s*(limit|is\s*limited)|limited\s+to\s+\d+|upgrade|paymongo/i.test(msg)
  ) {
    return new BillingLimitError(msg || fallbackMessage, errBody?.feature || feature);
  }
  return null;
}
