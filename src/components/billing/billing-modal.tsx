import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import { useOptionalBilling } from '@/context/billing-context';
import { useAuth } from '@/context/auth-context';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';

export function BillingModal() {
  const billing = useOptionalBilling();
  const { currentUser } = useAuth();
  const responsive = useResponsiveLayout();
  const [confirmingPlanId, setConfirmingPlanId] = React.useState<string | null>(null);

  if (!billing || !billing.showBillingModal) {
    return null;
  }

  const {
    subscription,
    visiblePlans,
    isIndividual,
    isTenantMember,
    canManageBilling,
    isFreeTier,
    maxIntegratedApps,
    maxTotpAccounts,
    canExportAuditCsv,
    auditRetentionDays,
    isLoadingBilling,
    isProcessingCheckout,
    billingError,
    billingNotice,
    paywallMessage,
    closeBillingModal,
    refreshSubscription,
    canRestorePlanWithoutCharge,
    startPaymongoCheckout,
    resumeSubscription,
    resendReceipt,
    cancelSubscription,
  } = billing;

  const orgName = currentUser?.companyName || 'Your Organization';
  const handleCloseModal = () => {
    setConfirmingPlanId(null);
    closeBillingModal();
  };

  return (
    <Modal
      visible={billing.showBillingModal}
      animationType="slide"
      transparent
      onRequestClose={handleCloseModal}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              maxHeight: responsive.modalMaxHeight,
              paddingHorizontal: responsive.horizontalPadding + 2,
              paddingBottom: Math.max(24, responsive.bottomInset + 16),
              ...(responsive.isTablet
                ? { maxWidth: 560, alignSelf: 'center', width: '100%', borderRadius: 20 }
                : {}),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>💳 Vanguard Billing & Plans</Text>
              <Text style={styles.subtitle}>
                {isIndividual
                  ? 'Personal Account • Synced Web & Mobile'
                  : isTenantMember
                    ? `${orgName} • Admin-Managed`
                    : `${orgName} Admin Billing • Synced Org-Wide`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleCloseModal}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close billing modal"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Paywall trigger message */}
            {paywallMessage ? (
              <View style={styles.alertAmber}>
                <Text style={styles.alertAmberText}>🔒 {paywallMessage}</Text>
              </View>
            ) : null}

            {billingError ? (
              <View style={styles.alertRed}>
                <Text style={styles.alertRedText}>⚠️ {billingError}</Text>
              </View>
            ) : null}

            {billingNotice ? (
              <View style={styles.alertGreen}>
                <Text style={styles.alertGreenText}>✅ {billingNotice}</Text>
              </View>
            ) : null}

            {/* Active Entitlement Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryPlanName}>
                Current Plan: {subscription.planName}
              </Text>
              <View style={styles.pillRow}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>
                    Apps: {maxIntegratedApps === -1 ? 'Unlimited' : `${maxIntegratedApps} Max (Free)`}
                  </Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>
                    2FA Vault: {maxTotpAccounts === -1 ? 'Unlimited' : `${maxTotpAccounts} Tokens Max`}
                  </Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>
                    CSV Audit: {canExportAuditCsv ? 'Unlocked' : 'Locked'} ({auditRetentionDays}d)
                  </Text>
                </View>
              </View>
            </View>

            {/* Tenant Employee Read-Only View */}
            {isTenantMember ? (
              <View style={styles.employeeCard}>
                <Text style={styles.employeeTitle}>
                  🏢 Managed by Your Company Administrator
                </Text>
                <Text style={styles.employeeDesc}>
                  Your corporate account belongs to {orgName}. Only your Company Administrator can upgrade or modify the PayMongo subscription.
                </Text>
                <Text style={styles.employeeDesc}>
                  {isFreeTier
                    ? 'Your mobile and web sessions currently share Company Free Trial limits (1 app max, 3 2FA tokens max). Once your admin upgrades via PayMongo, your limits unlock automatically.'
                    : 'Your Company Administrator has activated an active paid tier — Unlimited Apps and Unlimited 2FA are unlocked across Web & Mobile.'}
                </Text>

                <TouchableOpacity
                  style={styles.refreshActionBtn}
                  onPress={() => void refreshSubscription()}
                  disabled={isLoadingBilling}
                >
                  {isLoadingBilling ? (
                    <ActivityIndicator size="small" color={CyberColors.cyan} />
                  ) : (
                    <Text style={styles.refreshActionText}>↻ Refresh Organization Plan Status</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Isolated Plan Cards for Individual OR Company Admin */}
            {canManageBilling ? (
              <View style={styles.plansWrap}>
                {visiblePlans.map((plan) => {
                  const isCurrent =
                    subscription.planId === plan.id && subscription.status === 'active';
                  const isPaid = plan.id !== 'free';

                  return (
                    <View
                      key={plan.id}
                      style={[
                        styles.planCard,
                        isCurrent && styles.planCardActive,
                        plan.popular && !isCurrent && styles.planCardPopular,
                      ]}
                    >
                      <View style={styles.planTopRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.planName}>{plan.name}</Text>
                          <Text style={styles.planTagline}>{plan.tagline}</Text>
                        </View>
                        <View style={styles.priceWrap}>
                          <Text style={styles.priceMain}>${plan.priceMonthlyUsd}/mo</Text>
                          {plan.priceMonthlyPhp > 0 ? (
                            <Text style={styles.pricePhp}>₱{plan.priceMonthlyPhp}/mo</Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.featuresList}>
                        {plan.features.map((feat) => (
                          <Text key={feat} style={styles.featureItem}>
                            • {feat}
                          </Text>
                        ))}
                      </View>

                      {isCurrent ? (
                        <View style={styles.activePlanWrap}>
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>✓ Active Across Web & Mobile</Text>
                          </View>
                          {isPaid ? (
                            confirmingPlanId !== plan.id ? (
                              <TouchableOpacity
                                testID="btn-unsubscribe-plan"
                                style={styles.unsubscribeCardBtn}
                                onPress={() => setConfirmingPlanId(plan.id)}
                                disabled={isLoadingBilling}
                              >
                                <Text style={styles.unsubscribeCardBtnText}>Unsubscribe</Text>
                              </TouchableOpacity>
                            ) : (
                              <View testID="unsubscribe-confirm-panel" style={styles.confirmUnsubBox}>
                                <Text style={styles.confirmUnsubText}>
                                  Unsubscribe from {plan.name}? Your account reverts to Free immediately, while $0 Restore stays available until your paid cycle ends.
                                </Text>
                                <View style={styles.confirmUnsubRow}>
                                  <TouchableOpacity
                                    testID="btn-cancel-unsubscribe"
                                    style={styles.keepPlanBtn}
                                    onPress={() => setConfirmingPlanId(null)}
                                    disabled={isLoadingBilling}
                                  >
                                    <Text style={styles.keepPlanBtnText}>Keep Plan</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    testID="btn-confirm-unsubscribe"
                                    style={styles.confirmUnsubBtn}
                                    onPress={() => {
                                      setConfirmingPlanId(null);
                                      void cancelSubscription();
                                    }}
                                    disabled={isLoadingBilling}
                                  >
                                    <Text style={styles.confirmUnsubBtnText}>Confirm Unsubscribe</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )
                          ) : null}
                        </View>
                      ) : isPaid && canRestorePlanWithoutCharge(plan.id) ? (
                        <TouchableOpacity
                          style={styles.restoreBtn}
                          onPress={() =>
                            void resumeSubscription(
                              plan.id as 'personal_pro' | 'business_pro' | 'enterprise',
                            )
                          }
                          disabled={isProcessingCheckout}
                        >
                          {isProcessingCheckout ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.payBtnText}>
                              Restore {plan.name} ($0 — Paid until{' '}
                              {subscription.paidCredit?.paidUntil?.split('T')?.[0] || 'cycle end'})
                            </Text>
                          )}
                        </TouchableOpacity>
                      ) : isPaid ? (
                        <TouchableOpacity
                          style={styles.payBtn}
                          onPress={() =>
                            void startPaymongoCheckout(
                              plan.id as 'personal_pro' | 'business_pro' | 'enterprise',
                            )
                          }
                          disabled={isProcessingCheckout}
                        >
                          {isProcessingCheckout ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.payBtnText}>
                              💳 Subscribe via PayMongo (₱{plan.priceMonthlyPhp}/mo)
                            </Text>
                          )}
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}

                <View style={styles.footerActions}>
                  <TouchableOpacity
                    style={styles.refreshActionBtn}
                    onPress={() => void refreshSubscription()}
                    disabled={isLoadingBilling}
                  >
                    {isLoadingBilling ? (
                      <ActivityIndicator size="small" color={CyberColors.cyan} />
                    ) : (
                      <Text style={styles.refreshActionText}>↻ Sync Plan Status</Text>
                    )}
                  </TouchableOpacity>

                  {!isFreeTier ? (
                    <TouchableOpacity
                      style={styles.cancelPlanBtn}
                      onPress={() => setConfirmingPlanId(subscription.planId)}
                      disabled={isLoadingBilling}
                    >
                      <Text style={styles.cancelPlanText}>Unsubscribe / Downgrade to Free</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {subscription.invoices && subscription.invoices.length > 0 ? (
                  <View style={styles.receiptsCard}>
                    <Text style={styles.receiptsTitle}>
                      🧾 Official Vanguard Purchase Receipts
                    </Text>
                    {subscription.invoices.slice(0, 5).map((inv) => (
                      <View key={inv.id} style={styles.receiptItem}>
                        <View style={styles.receiptTopRow}>
                          <Text style={styles.receiptNum}>
                            {inv.receiptNumber || inv.id} • {inv.planName}
                          </Text>
                          <Text style={styles.receiptAmt}>${inv.amountUsd}.00 PAID</Text>
                        </View>
                        <Text style={styles.receiptEmailText}>
                          Sent to Registered Email:{' '}
                          {inv.receiptSentTo || inv.buyerEmail || currentUser?.email || 'Account Email'}
                        </Text>
                        {inv.gatewayPayerEmail &&
                        inv.gatewayPayerEmail !== (inv.receiptSentTo || inv.buyerEmail) ? (
                          <Text style={styles.receiptGatewayText}>
                            PayMongo Checkout Email: {inv.gatewayPayerEmail}
                          </Text>
                        ) : null}
                        <TouchableOpacity
                          style={styles.resendBtn}
                          onPress={() => void resendReceipt(inv.id)}
                          disabled={isLoadingBilling}
                        >
                          <Text style={styles.resendBtnText}>
                            ✉ Send Receipt to Registered Email
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: CyberColors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: CyberColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: CyberColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  scrollBody: {
    gap: 12,
    paddingBottom: 16,
  },
  alertAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
  },
  alertAmberText: {
    color: '#fcd34d',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  alertRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
  },
  alertRedText: {
    color: '#fca5a5',
    fontSize: 12.5,
    lineHeight: 18,
  },
  alertGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
  },
  alertGreenText: {
    color: '#6ee7b7',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
    gap: 8,
  },
  summaryPlanName: {
    color: CyberColors.cyan,
    fontSize: 13.5,
    fontWeight: '800',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(148, 163, 184, 0.28)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  employeeCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 14,
    gap: 10,
  },
  employeeTitle: {
    color: CyberColors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  employeeDesc: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  plansWrap: {
    gap: 12,
  },
  planCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 14,
    gap: 10,
  },
  planCardActive: {
    borderColor: CyberColors.green,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  planCardPopular: {
    borderColor: 'rgba(56, 189, 248, 0.55)',
  },
  planTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  planName: {
    color: CyberColors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  planTagline: {
    color: CyberColors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  priceWrap: {
    alignItems: 'flex-end',
  },
  priceMain: {
    color: CyberColors.cyan,
    fontSize: 16,
    fontWeight: '900',
  },
  pricePhp: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  featuresList: {
    gap: 4,
  },
  featureItem: {
    color: CyberColors.textSecondary,
    fontSize: 12,
  },
  activePlanWrap: {
    gap: 8,
  },
  currentBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  unsubscribeCardBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingVertical: 9,
    alignItems: 'center',
  },
  unsubscribeCardBtnText: {
    color: '#fca5a5',
    fontSize: 12.5,
    fontWeight: '800',
  },
  confirmUnsubBox: {
    backgroundColor: 'rgba(127, 29, 29, 0.28)',
    borderColor: 'rgba(248, 113, 113, 0.45)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    padding: 10,
    gap: 8,
  },
  confirmUnsubText: {
    color: '#fecaca',
    fontSize: 11.5,
    lineHeight: 16,
  },
  confirmUnsubRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keepPlanBtn: {
    flex: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: CyberRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  keepPlanBtnText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  confirmUnsubBtn: {
    flex: 1.3,
    backgroundColor: '#dc2626',
    borderRadius: CyberRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  confirmUnsubBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  currentBadgeText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '800',
  },
  payBtn: {
    backgroundColor: '#2563eb',
    borderRadius: CyberRadius.sm,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreBtn: {
    backgroundColor: '#0284c7',
    borderColor: 'rgba(56, 189, 248, 0.55)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingVertical: 11,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptsCard: {
    marginTop: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderColor: 'rgba(148, 163, 184, 0.22)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
    gap: 10,
  },
  receiptsTitle: {
    color: CyberColors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  receiptItem: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.14)',
    paddingTop: 8,
    gap: 4,
  },
  receiptTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  receiptNum: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  receiptAmt: {
    color: '#34d399',
    fontSize: 11.5,
    fontWeight: '800',
  },
  receiptEmailText: {
    color: '#7dd3fc',
    fontSize: 11,
  },
  receiptGatewayText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  resendBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  resendBtnText: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '700',
  },
  payBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  footerActions: {
    gap: 8,
    marginTop: 4,
  },
  refreshActionBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  refreshActionText: {
    color: CyberColors.cyan,
    fontSize: 12.5,
    fontWeight: '700',
  },
  cancelPlanBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingVertical: 9,
    alignItems: 'center',
  },
  cancelPlanText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
});
