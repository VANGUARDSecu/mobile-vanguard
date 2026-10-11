import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { AppAccessRequest } from '@/models/apps.models';
import { RequestCard } from './request-card';

export interface RequestedAppsSectionProps {
  requests: AppAccessRequest[];
  pendingCount: number;
  onLaunch?: (request: AppAccessRequest) => void;
}

export function RequestedAppsSection({
  requests,
  pendingCount,
  onLaunch,
}: RequestedAppsSectionProps) {
  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Sub-section Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Requested Applications & Access Status</Text>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>
                {pendingCount} Pending Review
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>
          Zero-trust access requests submitted for administrator review and governance approval.
        </Text>
      </View>

      {/* Requests List */}
      <View style={styles.list}>
        {requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            onLaunch={onLaunch}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 8,
  },
  header: {
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    letterSpacing: 0.3,
  },
  pendingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: CyberRadius.full,
  },
  pendingBadgeText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    color: CyberColors.textSecondary,
    lineHeight: 16,
  },
  list: {
    gap: 2,
  },
});
