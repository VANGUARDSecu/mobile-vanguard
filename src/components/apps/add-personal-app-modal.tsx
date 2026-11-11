import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { PersonalAppInput } from '@/models/apps.models';

export type PersonalAppPreset =
  | 'figma'
  | 'facebook'
  | 'github'
  | 'notion'
  | 'google'
  | 'custom';

export interface AddPersonalAppModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (input: PersonalAppInput) => Promise<void> | void;
}

export function AddPersonalAppModal({
  visible,
  onClose,
  onAdd,
}: AddPersonalAppModalProps) {
  const [appName, setAppName] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [appCategory, setAppCategory] = useState<'collaboration' | 'developer' | 'cloud'>('collaboration');
  const [appIcon, setAppIcon] = useState('🌐');
  const [appDescription, setAppDescription] = useState('');
  const [appUsername, setAppUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [activePreset, setActivePreset] = useState<PersonalAppPreset | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setAppName('');
    setAppUrl('');
    setAppCategory('collaboration');
    setAppIcon('🌐');
    setAppDescription('');
    setAppUsername('');
    setAppPassword('');
    setActivePreset(null);
    setErrorMessage(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const applyPreset = (preset: PersonalAppPreset) => {
    setErrorMessage(null);
    setActivePreset(preset);

    switch (preset) {
      case 'figma':
        setAppName('Figma');
        setAppUrl('https://www.figma.com/login');
        setAppCategory('collaboration');
        setAppIcon('🎨');
        setAppDescription('Collaborative interface design & prototyping suite');
        break;
      case 'facebook':
        setAppName('Facebook');
        setAppUrl('https://www.facebook.com/login');
        setAppCategory('collaboration');
        setAppIcon('📘');
        setAppDescription('Social network & Meta business suite');
        break;
      case 'github':
        setAppName('GitHub');
        setAppUrl('https://github.com/login');
        setAppCategory('developer');
        setAppIcon('🐙');
        setAppDescription('Git repository hosting & developer platform');
        break;
      case 'notion':
        setAppName('Notion');
        setAppUrl('https://www.notion.so/login');
        setAppCategory('collaboration');
        setAppIcon('📝');
        setAppDescription('Connected workspace for wiki, docs & project notes');
        break;
      case 'google':
        setAppName('Google Account');
        setAppUrl('https://accounts.google.com');
        setAppCategory('cloud');
        setAppIcon('🔍');
        setAppDescription('Google workspace, Drive, and identity authentication');
        break;
      case 'custom':
        setAppName('');
        setAppUrl('https://');
        setAppCategory('cloud');
        setAppIcon('🌐');
        setAppDescription('');
        break;
    }
  };

  const handleSubmit = async () => {
    const trimmedName = appName.trim();
    if (!trimmedName) {
      setErrorMessage('Please provide an application name.');
      return;
    }

    const trimmedUrl = appUrl.trim();
    if (!trimmedUrl || !trimmedUrl.includes('.')) {
      setErrorMessage('Please provide a valid website or login URL.');
      return;
    }

    let formattedUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onAdd({
        name: trimmedName,
        launchUrl: formattedUrl,
        category: appCategory,
        icon: appIcon.trim() || '🌐',
        description: appDescription.trim() || `${trimmedName} web application`,
        username: appUsername.trim() || undefined,
        password: appPassword || undefined,
      });
      handleClose();
    } catch {
      setErrorMessage('Failed to save application. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.modalTitle}>Add Personal Application</Text>
                <Text style={styles.modalSubtitle}>
                  Configure a web app bookmark for browser extension autofill
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && styles.closeBtnPressed,
                ]}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Quick Presets Section */}
              <View style={styles.presetSection}>
                <Text style={styles.sectionLabel}>Quick Presets</Text>
                <View style={styles.presetPillGroup}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.presetPill,
                      activePreset === 'figma' && styles.presetPillActive,
                      pressed && styles.presetPillPressed,
                    ]}
                    onPress={() => applyPreset('figma')}
                  >
                    <Text style={styles.presetPillText}>🎨 Figma</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.presetPill,
                      activePreset === 'facebook' && styles.presetPillActive,
                      pressed && styles.presetPillPressed,
                    ]}
                    onPress={() => applyPreset('facebook')}
                  >
                    <Text style={styles.presetPillText}>📘 Facebook</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.presetPill,
                      activePreset === 'github' && styles.presetPillActive,
                      pressed && styles.presetPillPressed,
                    ]}
                    onPress={() => applyPreset('github')}
                  >
                    <Text style={styles.presetPillText}>🐙 GitHub</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.presetPill,
                      activePreset === 'notion' && styles.presetPillActive,
                      pressed && styles.presetPillPressed,
                    ]}
                    onPress={() => applyPreset('notion')}
                  >
                    <Text style={styles.presetPillText}>📝 Notion</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.presetPill,
                      activePreset === 'google' && styles.presetPillActive,
                      pressed && styles.presetPillPressed,
                    ]}
                    onPress={() => applyPreset('google')}
                  >
                    <Text style={styles.presetPillText}>🔍 Google</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.presetPill,
                      styles.presetPillCustom,
                      activePreset === 'custom' && styles.presetPillActive,
                      pressed && styles.presetPillPressed,
                    ]}
                    onPress={() => applyPreset('custom')}
                  >
                    <Text style={styles.presetPillText}>🌐 Custom</Text>
                  </Pressable>
                </View>
              </View>

              {/* Form Row: Name & Icon */}
              <View style={styles.formRow}>
                <View style={styles.flexField}>
                  <Text style={styles.fieldLabel}>
                    Application Name <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={appName}
                    onChangeText={(text) => {
                      setAppName(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. Figma, GitHub, Jira"
                    placeholderTextColor={CyberColors.textMuted}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.iconField}>
                  <Text style={styles.fieldLabel}>Icon</Text>
                  <TextInput
                    style={[styles.input, styles.iconInput]}
                    value={appIcon}
                    onChangeText={setAppIcon}
                    placeholder="🌐"
                    placeholderTextColor={CyberColors.textMuted}
                    maxLength={4}
                  />
                </View>
              </View>

              {/* Login / Web URL Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Login / Web URL <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={appUrl}
                  onChangeText={(text) => {
                    setAppUrl(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="https://example.com/login"
                  placeholderTextColor={CyberColors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <Text style={styles.helperText}>
                  The Vanguard browser extension uses this domain to autofill your credentials
                </Text>
              </View>

              {/* Category Picker Segment */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.categoryPicker}>
                  <Pressable
                    style={[
                      styles.categoryOption,
                      appCategory === 'collaboration' && styles.categoryOptionActive,
                    ]}
                    onPress={() => setAppCategory('collaboration')}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        appCategory === 'collaboration' && styles.categoryOptionTextActive,
                      ]}
                    >
                      Collaboration
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.categoryOption,
                      appCategory === 'developer' && styles.categoryOptionActive,
                    ]}
                    onPress={() => setAppCategory('developer')}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        appCategory === 'developer' && styles.categoryOptionTextActive,
                      ]}
                    >
                      Developer
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.categoryOption,
                      appCategory === 'cloud' && styles.categoryOptionActive,
                    ]}
                    onPress={() => setAppCategory('cloud')}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        appCategory === 'cloud' && styles.categoryOptionTextActive,
                      ]}
                    >
                      Cloud & Infra
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Description Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Description (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={appDescription}
                  onChangeText={setAppDescription}
                  placeholder="Personal workspace, project notes, etc."
                  placeholderTextColor={CyberColors.textMuted}
                />
              </View>

              {/* Auto-Fill Username / Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Auto-Fill Username / Email (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={appUsername}
                  onChangeText={setAppUsername}
                  placeholder="e.g. you@example.com"
                  placeholderTextColor={CyberColors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Auto-Fill Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Auto-Fill Password (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={appPassword}
                  onChangeText={setAppPassword}
                  placeholder="Enter application password"
                  placeholderTextColor={CyberColors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.helperText}>
                  Stored securely and available for extension auto-fill and zero-trust launch.
                </Text>
              </View>

              {/* Error Alert */}
              {errorMessage ? (
                <View style={styles.errorAlert}>
                  <Text style={styles.errorAlertText}>⚠️ {errorMessage}</Text>
                </View>
              ) : null}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.cancelBtnPressed,
                ]}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && styles.submitBtnPressed,
                  isSubmitting && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Add to Applications"
              >
                <Text style={styles.submitBtnText}>
                  {isSubmitting ? 'Saving...' : 'Add to Applications'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: CyberColors.modalBackdrop,
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    maxHeight: '92%',
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.2)',
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    letterSpacing: 0.2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: CyberColors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  closeBtnText: {
    color: CyberColors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  scrollView: {
    maxHeight: 460,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  presetSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: CyberColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  presetPillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetPill: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
  },
  presetPillActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: CyberColors.cyan,
  },
  presetPillCustom: {
    borderStyle: 'dashed',
  },
  presetPillPressed: {
    opacity: 0.7,
  },
  presetPillText: {
    color: CyberColors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  flexField: {
    flex: 1,
  },
  iconField: {
    width: 68,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: CyberColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  requiredStar: {
    color: CyberColors.red,
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: CyberColors.textPrimary,
    fontSize: 13.5,
  },
  iconInput: {
    textAlign: 'center',
    fontSize: 18,
    paddingVertical: 7,
  },
  helperText: {
    color: CyberColors.textMuted,
    fontSize: 11,
    marginTop: 5,
    lineHeight: 15,
  },
  categoryPicker: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 3,
    gap: 4,
  },
  categoryOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CyberRadius.sm,
  },
  categoryOptionActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: CyberColors.cyan,
    borderWidth: 1,
  },
  categoryOptionText: {
    color: CyberColors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  categoryOptionTextActive: {
    color: CyberColors.cyan,
    fontWeight: '700',
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  errorAlertText: {
    color: '#fca5a5',
    fontSize: 12.5,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.2)',
  },
  cancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: CyberRadius.md,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnPressed: {
    opacity: 0.7,
  },
  cancelBtnText: {
    color: CyberColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    backgroundColor: CyberColors.cyan,
    borderRadius: CyberRadius.md,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnPressed: {
    opacity: 0.85,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: CyberColors.textDark,
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
