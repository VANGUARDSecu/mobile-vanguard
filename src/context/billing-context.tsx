import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import {
  BillingLimitError,
  BillingPlanDefinition,
  BillingPlanId,
  BillingSubscriptionState,
} from '@/models/billing.models';
import {
  BillingService,
  buildDefaultSubscriptionState,
  isAdminRole,
} from '@/services/billing.service';
import { AuthService } from '@/services/auth.service';
import { isLiveBackendToken } from '@/services/totp-sync.service';
import { syncCoordinatorService } from '@/services/sync-coordinator.service';
import { AuthContext } from './auth-context';

export interface BillingContextType {
  subscription: BillingSubscriptionState;
  visiblePlans: BillingPlanDefinition[];
  isIndividual: boolean;
  isCompanyAdmin: boolean;
  isTenantMember: boolean;
  canManageBilling: boolean;
  isFreeTier: boolean;
  maxIntegratedApps: number;
  maxTotpAccounts: number;
  canExportAuditCsv: boolean;
  auditRetentionDays: number;
  isLoadingBilling: boolean;
  isProcessingCheckout: boolean;
  billingError: string | null;
  billingNotice: string | null;
  showBillingModal: boolean;
  paywallMessage: string | null;
  openBillingModal: (reason?: string) => void;
  closeBillingModal: () => void;
  refreshSubscription: () => Promise<BillingSubscriptionState>;
  checkAppQuota: (currentAppCount: number) => { allowed: boolean; reason?: string };
  checkTotpQuota: (currentTotpCount: number) => { allowed: boolean; reason?: string };
  canRestorePlanWithoutCharge: (planId: BillingPlanId) => boolean;
  startPaymongoCheckout: (planId: 'personal_pro' | 'business_pro' | 'enterprise') => Promise<boolean>;
  resumeSubscription: (planId: 'personal_pro' | 'business_pro' | 'enterprise') => Promise<boolean>;
  resendReceipt: (invoiceId?: string) => Promise<boolean>;
  cancelSubscription: () => Promise<void>;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export function BillingProvider({ children }: { children: ReactNode }) {
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.currentUser ?? null;

  const [subscription, setSubscription] = useState<BillingSubscriptionState>(() =>
    buildDefaultSubscriptionState(currentUser),
  );
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [paywallMessage, setPaywallMessage] = useState<string | null>(null);

  const isIndividual = useMemo(
    () => (currentUser?.accountType || subscription.accountType) === 'individual',
    [currentUser?.accountType, subscription.accountType],
  );

  const isCompanyAdmin = useMemo(
    () => !isIndividual && isAdminRole(currentUser?.role),
    [isIndividual, currentUser?.role],
  );

  const isTenantMember = useMemo(
    () => !isIndividual && !isCompanyAdmin,
    [isIndividual, isCompanyAdmin],
  );

  const canManageBilling = useMemo(
    () => (isIndividual || isCompanyAdmin) && !isTenantMember,
    [isIndividual, isCompanyAdmin, isTenantMember],
  );

  const refreshSubscription = useCallback(async (): Promise<BillingSubscriptionState> => {
    const cached = await BillingService.getCachedSubscription(currentUser);
    setSubscription(cached);

    const token =
      currentUser?.accessToken || (await AuthService.getAccessToken()) || undefined;
    if (!isLiveBackendToken(token)) {
      return cached;
    }

    setIsLoadingBilling(true);
    try {
      const live = await BillingService.fetchSubscription(token, currentUser);
      if (live) {
        setSubscription(live);
        return live;
      }
      return cached;
    } finally {
      setIsLoadingBilling(false);
    }
  }, [currentUser]);

  useEffect(() => {
    setBillingError(null);
    setBillingNotice(null);
    void refreshSubscription();
  }, [refreshSubscription]);

  useEffect(() => {
    const sub = AppState?.addEventListener?.('change', (state) => {
      if (state === 'active') {
        void refreshSubscription();
      }
    });
    return () => sub?.remove?.();
  }, [refreshSubscription]);

  const isFreeTier = useMemo(
    () => subscription.status !== 'active' || subscription.planId === 'free',
    [subscription.status, subscription.planId],
  );

  const visiblePlans = useMemo(
    () => BillingService.getVisiblePlans(isIndividual ? 'individual' : 'company'),
    [isIndividual],
  );

  const openBillingModal = useCallback((reason?: string) => {
    setBillingError(null);
    setPaywallMessage(reason || null);
    setShowBillingModal(true);
    void refreshSubscription();
  }, [refreshSubscription]);

  const closeBillingModal = useCallback(() => {
    setShowBillingModal(false);
    setBillingError(null);
  }, []);

  const checkAppQuota = useCallback(
    (currentAppCount: number) =>
      BillingService.checkAppQuota(
        currentAppCount,
        {
          ...subscription,
          canManageBilling,
          accountType: isIndividual ? 'individual' : 'company',
        },
        currentUser?.companyName || 'your company',
      ),
    [subscription, canManageBilling, isIndividual, currentUser?.companyName],
  );

  const checkTotpQuota = useCallback(
    (currentTotpCount: number) =>
      BillingService.checkTotpQuota(
        currentTotpCount,
        {
          ...subscription,
          canManageBilling,
          accountType: isIndividual ? 'individual' : 'company',
        },
        currentUser?.companyName || 'your company',
      ),
    [subscription, canManageBilling, isIndividual, currentUser?.companyName],
  );

  const startPaymongoCheckout = useCallback(
    async (planId: 'personal_pro' | 'business_pro' | 'enterprise'): Promise<boolean> => {
      setBillingError(null);
      setBillingNotice(null);

      if (!canManageBilling) {
        setBillingError(
          'Only your Company Administrator can upgrade the organization subscription.',
        );
        return false;
      }

      const token =
        currentUser?.accessToken || (await AuthService.getAccessToken()) || undefined;
      if (!isLiveBackendToken(token)) {
        setBillingError(
          'Sign in with an active Vanguard account connected to the backend to complete PayMongo checkout.',
        );
        return false;
      }

      setIsProcessingCheckout(true);
      try {
        const returnOrigin =
          Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : undefined;

        const checkout = await BillingService.initiatePaymongoCheckout(
          token,
          planId,
          isIndividual ? 'individual' : 'company',
          returnOrigin,
        );

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.open(checkout.checkoutUrl, '_blank', 'noopener');
        } else if (typeof WebBrowser.openAuthSessionAsync === 'function') {
          await WebBrowser.openAuthSessionAsync(checkout.checkoutUrl);
        } else {
          await Linking.openURL(checkout.checkoutUrl);
        }

        const updated = await refreshSubscription();
        await syncCoordinatorService.checkOnce(true);

        if (BillingService.isPaidActive(updated)) {
          setBillingNotice(
            `Subscribed to ${updated.planName}! Synced across Web & Mobile.`,
          );
          setShowBillingModal(false);
          return true;
        }
        setBillingNotice(
          'Returned from PayMongo checkout. Tap Refresh Plan Status if your payment is still finalizing.',
        );
        return false;
      } catch (err: any) {
        setBillingError(
          err?.message || 'Unable to launch PayMongo Sandbox checkout.',
        );
        return false;
      } finally {
        setIsProcessingCheckout(false);
      }
    },
    [canManageBilling, currentUser?.accessToken, isIndividual, refreshSubscription],
  );

  const cancelSubscription = useCallback(async () => {
    setBillingError(null);
    setBillingNotice(null);
    if (!canManageBilling) {
      setBillingError('Only your Company Administrator can manage billing.');
      return;
    }

    const token =
      currentUser?.accessToken || (await AuthService.getAccessToken()) || undefined;
    if (!isLiveBackendToken(token)) return;

    setIsLoadingBilling(true);
    try {
      const updated = await BillingService.cancelSubscription(
        token,
        isIndividual ? 'individual' : 'company',
        currentUser?.email,
      );
      if (updated) {
        setSubscription(updated);
      } else {
        await refreshSubscription();
      }
      const creditUntil = updated?.paidCredit?.paidUntil?.split('T')[0];
      setBillingNotice(
        creditUntil
          ? `Downgraded to Free tier. Restore your paid plan for $0 anytime before ${creditUntil}.`
          : 'Subscription reverted to Free tier across Web & Mobile.',
      );
      await syncCoordinatorService.checkOnce(true);
    } catch (err: any) {
      setBillingError(err?.message || 'Failed to cancel subscription.');
    } finally {
      setIsLoadingBilling(false);
    }
  }, [
    canManageBilling,
    currentUser?.accessToken,
    currentUser?.email,
    isIndividual,
    refreshSubscription,
  ]);

  const canRestorePlanWithoutCharge = useCallback(
    (planId: BillingPlanId) => BillingService.canRestorePlanWithoutCharge(subscription, planId),
    [subscription],
  );

  const resumeSubscription = useCallback(
    async (planId: 'personal_pro' | 'business_pro' | 'enterprise'): Promise<boolean> => {
      setBillingError(null);
      setBillingNotice(null);
      if (!canManageBilling) {
        setBillingError('Only your Company Administrator can restore the organization subscription.');
        return false;
      }

      const token =
        currentUser?.accessToken || (await AuthService.getAccessToken()) || undefined;
      if (!isLiveBackendToken(token)) {
        setBillingError('Sign in with a live Vanguard account to restore a paid plan.');
        return false;
      }

      setIsProcessingCheckout(true);
      try {
        const res = await BillingService.resumeSubscription(
          token,
          planId,
          isIndividual ? 'individual' : 'company',
          currentUser?.email,
        );
        if (res.subscription) {
          setSubscription(res.subscription);
        } else {
          await refreshSubscription();
        }
        setBillingNotice(res.message);
        await syncCoordinatorService.checkOnce(true);
        return true;
      } catch (err: any) {
        setBillingError(err?.message || 'Unable to restore paid subscription at $0.');
        return false;
      } finally {
        setIsProcessingCheckout(false);
      }
    },
    [
      canManageBilling,
      currentUser?.accessToken,
      currentUser?.email,
      isIndividual,
      refreshSubscription,
    ],
  );

  const resendReceipt = useCallback(
    async (invoiceId?: string): Promise<boolean> => {
      setBillingError(null);
      setBillingNotice(null);
      if (!canManageBilling) {
        setBillingError('Only your Company Administrator can send organization billing receipts.');
        return false;
      }

      const token =
        currentUser?.accessToken || (await AuthService.getAccessToken()) || undefined;
      if (!isLiveBackendToken(token)) {
        setBillingError('Sign in with a live Vanguard account to email receipts.');
        return false;
      }

      setIsLoadingBilling(true);
      try {
        const res = await BillingService.resendReceipt(
          token,
          isIndividual ? 'individual' : 'company',
          invoiceId,
          currentUser?.email,
        );
        if (res.subscription) {
          setSubscription(res.subscription);
        }
        setBillingNotice(res.message);
        return true;
      } catch (err: any) {
        setBillingError(err?.message || 'Failed to dispatch Vanguard receipt email.');
        return false;
      } finally {
        setIsLoadingBilling(false);
      }
    },
    [canManageBilling, currentUser?.accessToken, currentUser?.email, isIndividual],
  );

  const value = useMemo<BillingContextType>(
    () => ({
      subscription,
      visiblePlans,
      isIndividual,
      isCompanyAdmin,
      isTenantMember,
      canManageBilling,
      isFreeTier,
      maxIntegratedApps: isFreeTier
        ? 1
        : (subscription.entitlements?.maxIntegratedApps ?? -1),
      maxTotpAccounts: isFreeTier
        ? 3
        : (subscription.entitlements?.maxTotpAccounts ?? -1),
      canExportAuditCsv:
        !isFreeTier && Boolean(subscription.entitlements?.auditCsvExport),
      auditRetentionDays: subscription.entitlements?.auditRetentionDays ?? (isIndividual ? 7 : 1),
      isLoadingBilling,
      isProcessingCheckout,
      billingError,
      billingNotice,
      showBillingModal,
      paywallMessage,
      openBillingModal,
      closeBillingModal,
      refreshSubscription,
      checkAppQuota,
      checkTotpQuota,
      canRestorePlanWithoutCharge,
      startPaymongoCheckout,
      resumeSubscription,
      resendReceipt,
      cancelSubscription,
    }),
    [
      subscription,
      visiblePlans,
      isIndividual,
      isCompanyAdmin,
      isTenantMember,
      canManageBilling,
      isFreeTier,
      isLoadingBilling,
      isProcessingCheckout,
      billingError,
      billingNotice,
      showBillingModal,
      paywallMessage,
      openBillingModal,
      closeBillingModal,
      refreshSubscription,
      checkAppQuota,
      checkTotpQuota,
      canRestorePlanWithoutCharge,
      startPaymongoCheckout,
      resumeSubscription,
      resendReceipt,
      cancelSubscription,
    ],
  );

  return (
    <BillingContext.Provider value={value}>
      {children}
    </BillingContext.Provider>
  );
}

export function useOptionalBilling(): BillingContextType | undefined {
  return useContext(BillingContext);
}

export function useBilling(): BillingContextType {
  const ctx = useContext(BillingContext);
  if (!ctx) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return ctx;
}

export { BillingLimitError };
