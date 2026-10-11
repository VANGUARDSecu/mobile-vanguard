import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { AppAccessRequest } from '@/models/apps.models';

export interface RequestCardProps {
  request: AppAccessRequest;
  onLaunch?: (request: AppAccessRequest) => void;
}

export function RequestCard({ request, onLaunch }: RequestCardProps) {
  const isPending = request.status === 'Pending Approval';
  const isApproved = request.status === 'Approved';
  const isRejected = request.status === 'Rejected';

  const formattedDate = (() => {
    try {
      const d = new Date(request.submittedAt);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return request.submittedAt;
    }
  })();

  const cardBorderColor = isPending
    ? 'rgba(245, 158, 11, 0.45)'
    : isApproved
    ? 'rgba(16, 185, 129, 0.45)'
    : 'rgba(239, 68, 68, 0.45)';

  return (
    <View style={[styles.card, { borderColor: cardBorderColor }]}>
      {/* Top row: Icon, Status Badge & Protocol */}
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>{request.icon || '🚀'}</Text>
        </View>

        <View style={styles.badgeRow}>
          {isPending && (
            <View style={[styles.statusBadge, styles.statusBadgePending]}>
              <Text style={styles.statusBadgePendingText}>⏳ Pending Approval</Text>
            </View>
          )}

          {isApproved && (
            <View style={[styles.statusBadge, styles.statusBadgeApproved]}>
              <Text style={styles.statusBadgeApprovedText}>✓ Approved & Assigned</Text>
            </View>
          )}

          {isRejected && (
            <View style={[styles.statusBadge, styles.statusBadgeRejected]}>
              <Text style={styles.statusBadgeRejectedText}>✕ Access Rejected</Text>
            </View>
          )}

          <View style={styles.protoBadge}>
            <Text style={styles.protoText}>{request.protocol || 'SAML 2.0'}</Text>
          </View>
        </View>
      </View>

      {/* App Name & Justification */}
      <Text style={styles.appName}>{request.appName}</Text>
      <Text style={styles.justification}>{request.justification}</Text>

      {/* Audit Meta Row */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>📅 Submitted: {formattedDate}</Text>
        {request.reviewedBy ? (
          <Text style={styles.metaText}>👤 Reviewer: {request.reviewedBy}</Text>
        ) : null}
      </View>

      {/* Action / Zero-Trust Status Guard */}
      <View style={styles.actionWrap}>
        {isPending && (
          <View style={styles.disabledActionBtn}>
            <Text style={styles.disabledActionText}>
              🔒 Pending Review (Launch Disabled)
            </Text>
          </View>
        )}

        {isApproved && (
          <Pressable
            style={({ pressed }) => [
              styles.launchBtn,
              pressed && styles.launchBtnPressed,
            ]}
            onPress={() => onLaunch?.(request)}
            accessibilityRole="button"
            accessibilityLabel={`Launch ${request.appName}`}
          >
            <Text style={styles.launchBtnText}>Launch & Auto-fill</Text>
            <Text style={styles.launchBtnArrow}>↗</Text>
          </Pressable>
        )}

        {isRejected && (
          <View style={styles.rejectedWrap}>
            {request.adminNotes ? (
              <View style={styles.adminNotesBox}>
                <Text style={styles.adminNotesTitle}>⚠️ Security Administrator Notes:</Text>
                <Text style={styles.adminNotesText}>{request.adminNotes}</Text>
              </View>
            ) : null}

            <View style={styles.zeroTrustGuardBadge}>
              <Text style={styles.zeroTrustGuardIcon}>🔒</Text>
              <Text style={styles.zeroTrustGuardText}>
                Zero-Trust Guard: Assertion Blocked
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a',
    borderRadius: CyberRadius.lg,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: CyberRadius.md,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: CyberRadius.sm,
    borderWidth: 1,
  },
  statusBadgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  statusBadgePendingText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusBadgeApprovedText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  statusBadgeRejectedText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  protoBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: CyberRadius.sm,
  },
  protoText: {
    color: CyberColors.cyan,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appName: {
    fontSize: 16,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    marginBottom: 4,
  },
  justification: {
    fontSize: 12.5,
    color: CyberColors.textSecondary,
    lineHeight: 17,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.15)',
  },
  metaText: {
    fontSize: 11,
    color: CyberColors.textMuted,
  },
  actionWrap: {
    marginTop: 2,
  },
  disabledActionBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledActionText: {
    color: CyberColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: CyberColors.green,
    borderWidth: 1.5,
    borderRadius: CyberRadius.md,
    paddingVertical: 11,
    gap: 6,
    shadowColor: CyberColors.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  launchBtnPressed: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  launchBtnText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  launchBtnArrow: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '900',
  },
  rejectedWrap: {
    gap: 8,
  },
  adminNotesBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    padding: 10,
  },
  adminNotesTitle: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 3,
  },
  adminNotesText: {
    color: '#fca5a5',
    fontSize: 11.5,
    lineHeight: 15,
  },
  zeroTrustGuardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.sm,
    paddingVertical: 7,
    gap: 6,
  },
  zeroTrustGuardIcon: {
    fontSize: 12,
  },
  zeroTrustGuardText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
