import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { useOptionalGuide } from '@/context/guide-context';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { CyberCard } from './cyber-card';

/**
 * Global simplified role-aware New User Guide modal rendered above mobile navigation tabs.
 */
export function NewUserGuideModal() {
  const guide = useOptionalGuide();
  const responsive = useResponsiveLayout();

  if (!guide || !guide.isOpen) {
    return null;
  }

  const {
    activeProfile,
    activeRole,
    close,
    context,
    dontShowAgain,
    executeStepAction,
    roleTabs,
    selectRole,
    setDontShowAgain,
  } = guide;

  return (
    <Modal
      visible={guide.isOpen}
      transparent
      animationType="fade"
      onRequestClose={() => void close(true)}
    >
      <SafeAreaView style={[styles.backdrop, { padding: responsive.horizontalPadding }]}>
        <View
          style={[
            styles.centerWrap,
            { maxWidth: responsive.modalMaxWidth, maxHeight: responsive.modalMaxHeight },
          ]}
        >
          <CyberCard
            variant="glow"
            style={[styles.card, { padding: responsive.cardPadding }]}
          >
            {/* Header Row */}
            <View style={styles.headerRow}>
              <View style={styles.eyebrowPill}>
                <Text style={styles.eyebrowText}>QUICK START GUIDE</Text>
              </View>
              <Pressable
                onPress={() => void close(true)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && styles.closeBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close guide"
                testID="guide-modal-close-btn"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Role Selector Tabs */}
            <View style={styles.roleTabsRow}>
              {roleTabs.map((tab) => {
                const isSelected = tab.role === activeRole;
                return (
                  <Pressable
                    key={tab.role}
                    onPress={() => selectRole(tab.role)}
                    style={[
                      styles.roleTab,
                      isSelected ? styles.roleTabActive : styles.roleTabInactive,
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    testID={`guide-role-tab-${tab.role}`}
                  >
                    <Text
                      style={[
                        styles.roleTabText,
                        isSelected ? styles.roleTabTextActive : styles.roleTabTextInactive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Scrollable Body */}
            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Role Headline Card */}
              <View style={styles.introBox}>
                <Text style={styles.badgeText}>{activeProfile.badge.toUpperCase()}</Text>
                <Text style={styles.headline}>{activeProfile.headline}</Text>
                <Text style={styles.summary}>{activeProfile.summary}</Text>
              </View>

              {/* Numbered Steps */}
              <View style={styles.stepsList}>
                {activeProfile.steps.map((step) => {
                  const ctaLabel =
                    context === 'dashboard' ? step.actionLabel : step.loginActionLabel;
                  return (
                    <View key={step.stepNumber} style={styles.stepCard}>
                      <View style={styles.stepTopRow}>
                        <View style={styles.stepBadge}>
                          <Text style={styles.stepBadgeText}>{step.stepNumber}</Text>
                        </View>
                        <Text style={styles.stepIcon}>{step.icon}</Text>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                      </View>
                      <Text style={styles.stepDesc}>{step.description}</Text>
                      <Pressable
                        onPress={() => void executeStepAction(step)}
                        style={({ pressed }) => [
                          styles.stepActionBtn,
                          pressed && styles.stepActionBtnPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={ctaLabel}
                        testID={`guide-step-${step.stepNumber}-btn`}
                      >
                        <Text style={styles.stepActionText}>{ctaLabel} →</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Footer Controls */}
            <View style={styles.footer}>
              {context === 'dashboard' ? (
                <Pressable
                  onPress={() => setDontShowAgain(!dontShowAgain)}
                  style={styles.checkboxRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: dontShowAgain }}
                  testID="guide-dont-show-checkbox"
                >
                  <View style={[styles.checkbox, dontShowAgain && styles.checkboxChecked]}>
                    {dontShowAgain ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    {"Don't show automatically next time"}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => void close(true)}
                style={({ pressed }) => [
                  styles.doneBtn,
                  pressed && styles.doneBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Got It"
                testID="guide-modal-done-btn"
              >
                <Text style={styles.doneBtnText}>Got It</Text>
              </Pressable>
            </View>
          </CyberCard>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: CyberColors.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  centerWrap: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
  },
  card: {
    padding: 16,
    backgroundColor: CyberColors.cardBg,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eyebrowPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: CyberRadius.full,
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyanMuted,
    borderWidth: 1,
  },
  eyebrowText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: CyberRadius.full,
    backgroundColor: CyberColors.cardBgSecondary,
    borderColor: CyberColors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: CyberColors.cardBgHover,
  },
  closeBtnText: {
    color: CyberColors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  roleTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  roleTab: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: CyberRadius.sm,
    borderWidth: 1,
  },
  roleTabActive: {
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyan,
  },
  roleTabInactive: {
    backgroundColor: CyberColors.cardBgSecondary,
    borderColor: CyberColors.border,
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleTabTextActive: {
    color: CyberColors.cyan,
  },
  roleTabTextInactive: {
    color: CyberColors.textSecondary,
  },
  bodyScroll: {
    maxHeight: 390,
  },
  bodyScrollContent: {
    paddingBottom: 6,
  },
  introBox: {
    backgroundColor: CyberColors.cardBgSecondary,
    borderColor: CyberColors.border,
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
    marginBottom: 12,
  },
  badgeText: {
    color: CyberColors.green,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  headline: {
    color: CyberColors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 4,
  },
  summary: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  stepsList: {
    gap: 10,
  },
  stepCard: {
    backgroundColor: 'rgba(19, 29, 49, 0.85)',
    borderColor: CyberColors.border,
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 12,
  },
  stepTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: CyberColors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: CyberColors.textDark,
    fontSize: 11.5,
    fontWeight: '900',
  },
  stepIcon: {
    fontSize: 16,
  },
  stepTitle: {
    flex: 1,
    color: CyberColors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  stepDesc: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 10,
  },
  stepActionBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: CyberRadius.sm,
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyanMuted,
    borderWidth: 1,
  },
  stepActionBtnPressed: {
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
  },
  stepActionText: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '800',
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopColor: CyberColors.border,
    borderTopWidth: 1,
    gap: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: CyberRadius.xs,
    borderColor: CyberColors.cyanMuted,
    borderWidth: 1.5,
    backgroundColor: CyberColors.cardBgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: CyberColors.cyan,
    borderColor: CyberColors.cyan,
  },
  checkmark: {
    color: CyberColors.textDark,
    fontSize: 11,
    fontWeight: '900',
  },
  checkboxLabel: {
    color: CyberColors.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 11,
    borderRadius: CyberRadius.md,
    backgroundColor: CyberColors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnPressed: {
    opacity: 0.85,
  },
  doneBtnText: {
    color: CyberColors.textDark,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
