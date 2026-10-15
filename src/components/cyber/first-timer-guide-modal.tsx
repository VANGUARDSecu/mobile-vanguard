import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { CyberButton } from './cyber-button';
import { CyberCard } from './cyber-card';
import { Badge } from './badge';
import type {
  MobileChecklistItem,
  MobileGuideSlide,
  MobileGuideAction,
} from '@/models/guide.models';
import guideService from '@/services/guide.service';

export interface FirstTimerGuideModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateAction?: (action: MobileGuideAction) => void;
  testID?: string;
}

export function FirstTimerGuideModal({
  visible,
  onClose,
  onNavigateAction,
  testID = 'first-timer-guide-modal',
}: FirstTimerGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'checklist' | 'guide'>('checklist');
  const [checklist, setChecklist] = useState<MobileChecklistItem[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const slides: MobileGuideSlide[] = guideService.getSlides();

  const loadData = useCallback(async () => {
    try {
      const items = await guideService.getChecklist();
      setChecklist(items);
      const dismissed = await guideService.isCompleted();
      setIsDismissed(dismissed);
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);

  const handleToggleItem = async (itemId: string) => {
    const updated = await guideService.toggleItem(itemId);
    setChecklist(updated);
  };

  const handleResetChecklist = async () => {
    const reset = await guideService.resetChecklist();
    setChecklist(reset);
    setIsDismissed(false);
  };

  const handleDismissToggle = async () => {
    const nextVal = !isDismissed;
    setIsDismissed(nextVal);
    await guideService.setCompleted(nextVal);
  };

  const handleAction = (action: MobileGuideAction) => {
    onClose();
    if (onNavigateAction) {
      onNavigateAction(action);
    }
  };

  const completedCount = checklist.filter((i) => i.completed).length;
  const progressPercent = guideService.calculateProgress(checklist);
  const currentSlide = slides[currentSlideIndex] || slides[0];

  const getBadgeVariant = (category: string) => {
    switch (category) {
      case 'biometrics': return 'cyan' as const;
      case 'totp': return 'green' as const;
      case 'push_mfa': return 'indigo' as const;
      case 'sso': return 'amber' as const;
      default: return 'muted' as const;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleWrap}>
                <View style={styles.headerIconWrap}>
                  <Text style={styles.headerIconText}>📖</Text>
                </View>
                <View>
                  <Text style={styles.headerTitle}>First-Timer User Guide</Text>
                  <Text style={styles.headerSubtitle}>Vanguard Zero-Trust Companion</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Progress Card */}
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Setup Progress</Text>
                <Text style={styles.progressCountText}>
                  {completedCount} of {checklist.length} tasks ({progressPercent}%)
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>

            {/* View Tab Switcher */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'checklist' && styles.tabBtnActive]}
                onPress={() => setActiveTab('checklist')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, activeTab === 'checklist' && styles.tabBtnTextActive]}>
                  ☑️ Setup Checklist
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'guide' && styles.tabBtnActive]}
                onPress={() => setActiveTab('guide')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, activeTab === 'guide' && styles.tabBtnTextActive]}>
                  🗺️ Walkthrough Guide
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content Body */}
            <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
              {activeTab === 'checklist' ? (
                <View style={styles.checklistList}>
                  {checklist.map((item) => (
                    <CyberCard
                      key={item.id}
                      variant={item.completed ? 'default' : 'glass'}
                      style={[styles.taskCard, item.completed && styles.taskCardDone]}
                    >
                      <View style={styles.taskCardRow}>
                        <TouchableOpacity
                          style={[styles.checkbox, item.completed && styles.checkboxChecked]}
                          onPress={() => handleToggleItem(item.id)}
                          activeOpacity={0.8}
                        >
                          {item.completed && <Text style={styles.checkmarkText}>✓</Text>}
                        </TouchableOpacity>

                        <View style={styles.taskMeta}>
                          <View style={styles.taskTitleRow}>
                            <Text style={[styles.taskTitle, item.completed && styles.taskTitleStruck]}>
                              {item.title}
                            </Text>
                            <Badge
                              label={item.badge}
                              variant={getBadgeVariant(item.category)}
                              size="sm"
                            />
                          </View>
                          <Text style={styles.taskDescription}>{item.description}</Text>
                        </View>
                      </View>

                      <View style={styles.taskActionRow}>
                        <CyberButton
                          title={`${item.actionLabel} ➔`}
                          variant={item.completed ? 'ghost' : 'outline'}
                          size="sm"
                          onPress={() => handleAction(item.targetAction)}
                        />
                      </View>
                    </CyberCard>
                  ))}

                  <View style={styles.proTipBox}>
                    <Text style={styles.proTipIcon}>💡</Text>
                    <Text style={styles.proTipText}>
                      Security Pro-Tip: Configure native biometrics and save your recovery codes first. Your Authenticator Vault is fully air-gapped and generates RFC 6238 codes offline without cellular connection.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.walkthroughWrap}>
                  <CyberCard variant="glow" style={styles.slideCard}>
                    <View style={styles.slideHeaderRow}>
                      <Badge
                        label={`Step ${currentSlide.stepNumber} of ${slides.length}`}
                        variant="cyan"
                        size="sm"
                      />
                      <Text style={styles.slideIconText}>{currentSlide.icon}</Text>
                    </View>

                    <Text style={styles.slideTitleText}>{currentSlide.title}</Text>
                    <Text style={styles.slideSubtitleText}>{currentSlide.subtitle}</Text>
                    <Text style={styles.slideSummaryText}>{currentSlide.summary}</Text>

                    <View style={styles.keyPointsBox}>
                      {currentSlide.keyPoints.map((point, idx) => (
                        <View key={idx} style={styles.keyPointRow}>
                          <Text style={styles.keyPointCheck}>✓</Text>
                          <Text style={styles.keyPointText}>{point}</Text>
                        </View>
                      ))}
                    </View>

                    {currentSlide.recommendedAction && (
                      <View style={styles.slideActionWrap}>
                        <CyberButton
                          title={`${currentSlide.recommendedAction.label} ➔`}
                          variant="primary"
                          size="sm"
                          onPress={() => handleAction(currentSlide.recommendedAction!.targetAction)}
                        />
                      </View>
                    )}
                  </CyberCard>

                  {/* Carousel Navigation */}
                  <View style={styles.carouselNavRow}>
                    <TouchableOpacity
                      style={[styles.carouselNavBtn, currentSlideIndex === 0 && styles.carouselNavBtnDisabled]}
                      disabled={currentSlideIndex === 0}
                      onPress={() => setCurrentSlideIndex((i) => Math.max(0, i - 1))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.carouselNavBtnText}>← Previous</Text>
                    </TouchableOpacity>

                    <View style={styles.carouselDotsRow}>
                      {slides.map((_, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.carouselDot, currentSlideIndex === idx && styles.carouselDotActive]}
                          onPress={() => setCurrentSlideIndex(idx)}
                        />
                      ))}
                    </View>

                    <TouchableOpacity
                      style={[styles.carouselNavBtn, currentSlideIndex === slides.length - 1 && styles.carouselNavBtnDisabled]}
                      disabled={currentSlideIndex === slides.length - 1}
                      onPress={() => setCurrentSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.carouselNavBtnText}>Next →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.dismissToggleRow}
                onPress={handleDismissToggle}
                activeOpacity={0.7}
              >
                <View style={[styles.dismissCheck, isDismissed && styles.dismissCheckActive]}>
                  {isDismissed && <Text style={styles.dismissCheckmark}>✓</Text>}
                </View>
                <Text style={styles.dismissLabel}>Don't show on launch</Text>
              </TouchableOpacity>

              <View style={styles.footerBtnGroup}>
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={handleResetChecklist}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resetBtnText}>Reset</Text>
                </TouchableOpacity>

                <CyberButton
                  title="Got it, Close"
                  variant="secondary"
                  size="sm"
                  onPress={onClose}
                />
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  safeArea: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '92%',
  },
  modalCard: {
    backgroundColor: '#0a0e17',
    borderRadius: CyberRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%',
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 18,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  progressContainer: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#0d1322',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressCountText: {
    color: CyberColors.cyan,
    fontSize: 11,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: CyberColors.cyan,
    borderRadius: 999,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0a0e17',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    gap: 8,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: CyberColors.cyan,
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
  },
  tabBtnText: {
    color: '#94a3b8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: CyberColors.cyan,
    fontWeight: '700',
  },
  bodyScroll: {
    flex: 1,
    maxHeight: 420,
  },
  bodyContent: {
    padding: 16,
    gap: 12,
  },
  checklistList: {
    gap: 10,
  },
  taskCard: {
    padding: 12,
    gap: 10,
  },
  taskCardDone: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  taskCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(0, 229, 255, 0.5)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: CyberColors.green,
    borderColor: CyberColors.green,
  },
  checkmarkText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  taskMeta: {
    flex: 1,
    gap: 3,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    flexWrap: 'wrap',
  },
  taskTitle: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  taskTitleStruck: {
    textDecorationLine: 'line-through',
    color: '#64748b',
  },
  taskDescription: {
    color: '#94a3b8',
    fontSize: 11.5,
    lineHeight: 16,
  },
  taskActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: 8,
  },
  proTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderRadius: CyberRadius.md,
    marginTop: 6,
  },
  proTipIcon: {
    fontSize: 16,
  },
  proTipText: {
    color: '#cbd5e1',
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
  walkthroughWrap: {
    gap: 14,
  },
  slideCard: {
    padding: 16,
    gap: 10,
  },
  slideHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slideIconText: {
    fontSize: 24,
  },
  slideTitleText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  slideSubtitleText: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '600',
  },
  slideSummaryText: {
    color: '#cbd5e1',
    fontSize: 12.5,
    lineHeight: 18,
  },
  keyPointsBox: {
    backgroundColor: '#0a0e17',
    borderRadius: CyberRadius.sm,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  keyPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  keyPointCheck: {
    color: CyberColors.green,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 1,
  },
  keyPointText: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  slideActionWrap: {
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  carouselNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  carouselNavBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: CyberRadius.sm,
  },
  carouselNavBtnDisabled: {
    opacity: 0.3,
  },
  carouselNavBtnText: {
    color: CyberColors.cyan,
    fontSize: 11.5,
    fontWeight: '600',
  },
  carouselDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carouselDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  carouselDotActive: {
    backgroundColor: CyberColors.cyan,
    width: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0d1322',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
    flexWrap: 'wrap',
  },
  dismissToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dismissCheck: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissCheckActive: {
    backgroundColor: CyberColors.cyan,
    borderColor: CyberColors.cyan,
  },
  dismissCheckmark: {
    color: '#0a0e17',
    fontSize: 10,
    fontWeight: '800',
  },
  dismissLabel: {
    color: '#94a3b8',
    fontSize: 11.5,
  },
  footerBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resetBtn: {
    padding: 6,
  },
  resetBtnText: {
    color: '#94a3b8',
    fontSize: 11.5,
    textDecorationLine: 'underline',
  },
});
