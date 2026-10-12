import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { AppAccessRequest } from '@/models/apps.models';

export interface CompanyAdminBannerProps {
  companyName?: string;
  adminName?: string;
  pendingRequests: AppAccessRequest[];
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string, notes?: string) => Promise<void>;
}

export function CompanyAdminBanner({
  companyName = 'Enterprise Organization',
  adminName = 'Admin',
  pendingRequests,
  onApprove,
  onReject,
}: CompanyAdminBannerProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const pendingCount = pendingRequests.length;

  const handleApprove = async (request: AppAccessRequest) => {
    if (processingId) return;
    setProcessingId(request.id);
    setActionType('approve');
    try {
      await onApprove(request.id);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert(`Approved access to ${request.appName} for ${request.userName || request.userEmail}.`);
      } else {
        Alert.alert(
          'Access Approved',
          `Granted zero-trust access to ${request.appName} for ${request.userName || request.userEmail}.`
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to approve access request.');
    } finally {
      setProcessingId(null);
      setActionType(null);
    }
  };

  const handleReject = async (request: AppAccessRequest) => {
    if (processingId) return;

    const executeReject = async (notes?: string) => {
      setProcessingId(request.id);
      setActionType('reject');
      try {
        await onReject(request.id, notes || 'Rejected by Security Administrator policy review.');
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
          window.alert(`Rejected access to ${request.appName} for ${request.userName || request.userEmail}.`);
        } else {
          Alert.alert(
            'Access Rejected',
            `Denied access to ${request.appName} for ${request.userName || request.userEmail}.`
          );
        }
      } catch {
        Alert.alert('Error', 'Failed to reject access request.');
      } finally {
        setProcessingId(null);
        setActionType(null);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      const confirmed = window.confirm(
        `Reject access request for ${request.appName} from ${request.userName || request.userEmail}?`
      );
      if (confirmed) {
        await executeReject();
      }
      return;
    }

    Alert.alert(
      'Reject Access Request',
      `Are you sure you want to deny access to ${request.appName} for ${request.userName || request.userEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Access',
          style: 'destructive',
          onPress: () => executeReject(),
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.bannerContainer}>
      {/* Banner Top Header */}
      <View style={styles.bannerHeader}>
        <View style={styles.titleRow}>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeIcon}>🛡️</Text>
            <Text style={styles.adminBadgeText}>COMPANY ADMIN REVIEW CONSOLE</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.expandToggle,
              pressed && styles.expandTogglePressed,
            ]}
            onPress={() => setIsExpanded(!isExpanded)}
            accessibilityRole="button"
            accessibilityLabel="Toggle Admin Review Console"
          >
            <Text style={styles.expandToggleText}>{isExpanded ? 'Collapse ▾' : 'Expand ▸'}</Text>
          </Pressable>
        </View>

        {/* Status bar */}
        <View style={styles.statusRow}>
          <View style={styles.orgTag}>
            <Text style={styles.orgTagLabel}>ORG:</Text>
            <Text style={styles.orgTagName} numberOfLines={1}>{companyName}</Text>
          </View>

          <View
            style={[
              styles.countPill,
              pendingCount > 0 ? styles.countPillPending : styles.countPillClear,
            ]}
          >
            <Text
              style={[
                styles.countPillText,
                pendingCount > 0 ? styles.countPillTextPending : styles.countPillTextClear,
              ]}
            >
              {pendingCount > 0
                ? `⚡ ${pendingCount} PENDING ACTION`
                : '✓ QUEUE AUDITED'}
            </Text>
          </View>
        </View>

        <Text style={styles.bannerSubtitle}>
          Audit employee SaaS application requests, verify applicant identity & business justification, and enforce zero-trust access controls.
        </Text>
      </View>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {pendingCount === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🛡️</Text>
              <Text style={styles.emptyTitle}>Access Governance Queue Clear</Text>
              <Text style={styles.emptySubtitle}>
                No pending employee access requests at this time. When employees request enterprise applications, their complete profile and business justifications will appear here for review.
              </Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {pendingRequests.map((req) => {
                const isItemProcessing = processingId === req.id;
                return (
                  <View key={req.id} style={styles.requestCard}>
                    {/* App Header Row */}
                    <View style={styles.reqAppHeader}>
                      <View style={styles.reqAppIconBox}>
                        <Text style={styles.reqAppIcon}>{req.icon || '🚀'}</Text>
                      </View>
                      <View style={styles.reqAppInfo}>
                        <Text style={styles.reqAppName}>{req.appName}</Text>
                        <View style={styles.tagRow}>
                          <View style={styles.protoBadge}>
                            <Text style={styles.protoText}>{req.protocol || 'SAML 2.0'}</Text>
                          </View>
                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryText}>
                              {(req.category || 'cloud').toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.pendingTag}>
                        <Text style={styles.pendingTagText}>PENDING</Text>
                      </View>
                    </View>

                    {/* Applicant Information Section */}
                    <View style={styles.dossierBox}>
                      <Text style={styles.dossierHeader}>APPLICANT INFORMATION</Text>

                      <View style={styles.dossierRow}>
                        <Text style={styles.dossierLabel}>Name:</Text>
                        <Text style={styles.dossierValue} numberOfLines={1}>
                          {req.userName || 'Employee'}
                        </Text>
                      </View>

                      <View style={styles.dossierRow}>
                        <Text style={styles.dossierLabel}>Email:</Text>
                        <Text style={styles.dossierValue} numberOfLines={1}>
                          {req.userEmail || 'N/A'}
                        </Text>
                      </View>

                      <View style={styles.dossierRow}>
                        <Text style={styles.dossierLabel}>Department:</Text>
                        <Text style={styles.dossierValue} numberOfLines={1}>
                          {req.department || 'Enterprise Member'}
                        </Text>
                      </View>

                      <View style={styles.dossierRow}>
                        <Text style={styles.dossierLabel}>Role:</Text>
                        <Text style={styles.dossierValue} numberOfLines={1}>
                          {req.role || 'user'}
                        </Text>
                      </View>

                      <View style={styles.dossierRow}>
                        <Text style={styles.dossierLabel}>Submitted:</Text>
                        <Text style={styles.dossierValue} numberOfLines={1}>
                          {formatDate(req.submittedAt)}
                        </Text>
                      </View>
                    </View>

                    {/* Business Justification */}
                    <View style={styles.justificationBox}>
                      <Text style={styles.justificationHeader}>BUSINESS JUSTIFICATION</Text>
                      <Text style={styles.justificationText}>
                        {req.justification || 'No justification provided.'}
                      </Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.approveBtn,
                          pressed && styles.approveBtnPressed,
                          isItemProcessing && styles.btnDisabled,
                        ]}
                        onPress={() => handleApprove(req)}
                        disabled={isItemProcessing}
                        accessibilityRole="button"
                        accessibilityLabel={`Approve ${req.appName} for ${req.userName}`}
                      >
                        {isItemProcessing && actionType === 'approve' ? (
                          <ActivityIndicator size="small" color="#022c22" />
                        ) : (
                          <>
                            <Text style={styles.approveBtnIcon}>✓</Text>
                            <Text style={styles.approveBtnText}>Approve Access</Text>
                          </>
                        )}
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [
                          styles.rejectBtn,
                          pressed && styles.rejectBtnPressed,
                          isItemProcessing && styles.btnDisabled,
                        ]}
                        onPress={() => handleReject(req)}
                        disabled={isItemProcessing}
                        accessibilityRole="button"
                        accessibilityLabel={`Reject ${req.appName} for ${req.userName}`}
                      >
                        {isItemProcessing && actionType === 'reject' ? (
                          <ActivityIndicator size="small" color="#f87171" />
                        ) : (
                          <>
                            <Text style={styles.rejectBtnIcon}>✕</Text>
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#090e17',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderWidth: 1.5,
    borderRadius: CyberRadius.lg,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  bannerHeader: {
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminBadgeIcon: {
    fontSize: 16,
  },
  adminBadgeText: {
    color: '#fbbf24',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  expandToggle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: CyberRadius.sm,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
  },
  expandTogglePressed: {
    opacity: 0.7,
  },
  expandToggleText: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orgTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  orgTagLabel: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  orgTagName: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: CyberRadius.full,
    borderWidth: 1,
  },
  countPillPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: 'rgba(245, 158, 11, 0.6)',
  },
  countPillClear: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  countPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countPillTextPending: {
    color: '#fbbf24',
  },
  countPillTextClear: {
    color: '#34d399',
  },
  bannerSubtitle: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
  },
  expandedContent: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.2)',
    paddingTop: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 6,
  },
  emptyIcon: {
    fontSize: 26,
    marginBottom: 2,
  },
  emptyTitle: {
    color: '#34d399',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    color: CyberColors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 320,
  },
  requestsList: {
    gap: 12,
  },
  requestCard: {
    backgroundColor: '#0c1322',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
    gap: 10,
  },
  reqAppHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reqAppIconBox: {
    width: 38,
    height: 38,
    borderRadius: CyberRadius.md,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqAppIcon: {
    fontSize: 20,
  },
  reqAppInfo: {
    flex: 1,
  },
  reqAppName: {
    color: CyberColors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  protoBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: CyberRadius.sm,
  },
  protoText: {
    color: CyberColors.cyan,
    fontSize: 9.5,
    fontWeight: '800',
  },
  categoryBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: CyberRadius.sm,
  },
  categoryText: {
    color: CyberColors.textSecondary,
    fontSize: 9.5,
    fontWeight: '700',
  },
  pendingTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: CyberRadius.sm,
  },
  pendingTagText: {
    color: '#fbbf24',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dossierBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    padding: 9,
    gap: 4,
  },
  dossierHeader: {
    color: CyberColors.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  dossierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dossierLabel: {
    color: CyberColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    width: 80,
  },
  dossierValue: {
    color: CyberColors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  justificationBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(148, 163, 184, 0.15)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    padding: 9,
    gap: 3,
  },
  justificationHeader: {
    color: '#fbbf24',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  justificationText: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: CyberRadius.sm,
    paddingVertical: 9,
    gap: 5,
  },
  approveBtnPressed: {
    opacity: 0.85,
    backgroundColor: '#059669',
  },
  approveBtnIcon: {
    color: '#022c22',
    fontSize: 13,
    fontWeight: '900',
  },
  approveBtnText: {
    color: '#022c22',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingVertical: 9,
    gap: 4,
  },
  rejectBtnPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  rejectBtnIcon: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '900',
  },
  rejectBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
