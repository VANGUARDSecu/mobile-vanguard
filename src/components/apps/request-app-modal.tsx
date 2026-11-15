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
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import {
  AppItemCategory,
  AppAccessRequest,
  ENTERPRISE_APP_SUGGESTIONS,
} from '@/models/apps.models';

export { ENTERPRISE_APP_SUGGESTIONS };

export interface RequestAppInput {
  appName: string;
  justification: string;
  category?: AppItemCategory;
  icon?: string;
}

export interface RequestAppModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: RequestAppInput) => Promise<AppAccessRequest | void> | void;
}

export function RequestAppModal({
  visible,
  onClose,
  onSubmit,
}: RequestAppModalProps) {
  const responsive = useResponsiveLayout();
  const [appName, setAppName] = useState('');
  const [category, setCategory] = useState<AppItemCategory>('collaboration');
  const [icon, setIcon] = useState('🚀');
  const [justification, setJustification] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setAppName('');
    setCategory('collaboration');
    setIcon('🚀');
    setJustification('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelectSuggestion = (suggestion: typeof ENTERPRISE_APP_SUGGESTIONS[number]) => {
    setAppName(suggestion.name);
    setCategory(suggestion.category);
    setIcon(suggestion.icon);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    const trimmedName = appName.trim();
    const trimmedJustification = justification.trim();

    if (!trimmedName) {
      setErrorMessage('Please provide an application name.');
      return;
    }

    if (!trimmedJustification) {
      setErrorMessage('Please provide a business justification for requesting access.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        appName: trimmedName,
        justification: trimmedJustification,
        category,
        icon,
      });

      setSuccessMessage('✓ Request submitted to administrator for approval!');

      // Close modal after showing success confirmation
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit application request.';
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal backdrop"
        />

        <View
          style={[
            styles.modalCard,
            {
              maxWidth: responsive.modalMaxWidth,
              maxHeight: responsive.modalMaxHeight,
              paddingBottom: Math.max(12, responsive.bottomInset),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.titleBadge}>
                <Text style={styles.titleBadgeIcon}>🛡️</Text>
                <Text style={styles.title}>Request Application Access</Text>
              </View>
              <Text style={styles.subtitle}>
                Submit an application access request to your Vanguard Security Administrator.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Success Banner */}
            {successMessage ? (
              <View style={styles.successBanner}>
                <Text style={styles.successBannerText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* Error Banner */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {errorMessage}</Text>
              </View>
            ) : null}

            {/* Enterprise Suggestions */}
            <View style={styles.sectionGroup}>
              <Text style={styles.label}>POPULAR ENTERPRISE APPLICATIONS</Text>
              <View style={styles.suggestionsWrap}>
                {ENTERPRISE_APP_SUGGESTIONS.map((item) => {
                  const isSelected = appName.toLowerCase() === item.name.toLowerCase();
                  return (
                    <Pressable
                      key={item.name}
                      style={({ pressed }) => [
                        styles.suggestionPill,
                        isSelected && styles.suggestionPillSelected,
                        pressed && styles.suggestionPillPressed,
                      ]}
                      onPress={() => handleSelectSuggestion(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.name}`}
                    >
                      <Text style={styles.suggestionIcon}>{item.icon}</Text>
                      <Text
                        style={[
                          styles.suggestionText,
                          isSelected && styles.suggestionTextSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Form: Application Name & Icon */}
            <View style={styles.formRow}>
              <View style={[styles.fieldGroup, styles.flexField]}>
                <Text style={styles.label}>
                  APPLICATION NAME <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={appName}
                  onChangeText={(val) => {
                    setAppName(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. Figma Enterprise, Salesforce, Snowflake"
                  placeholderTextColor={CyberColors.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <View style={[styles.fieldGroup, styles.iconField]}>
                <Text style={styles.label}>ICON</Text>
                <TextInput
                  style={[styles.input, styles.iconInput]}
                  value={icon}
                  onChangeText={setIcon}
                  placeholder="🚀"
                  placeholderTextColor={CyberColors.textMuted}
                  maxLength={4}
                />
              </View>
            </View>

            {/* Category Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>WORKSPACE CATEGORY</Text>
              <View style={styles.categoryPills}>
                {(['collaboration', 'developer', 'cloud', 'custom'] as AppItemCategory[]).map(
                  (cat) => {
                    const isSelected = category === cat;
                    const displayLabel =
                      cat === 'collaboration'
                        ? 'Collaboration'
                        : cat === 'developer'
                        ? 'Developer'
                        : cat === 'cloud'
                        ? 'Cloud / Infra'
                        : 'Custom';

                    return (
                      <Pressable
                        key={cat}
                        style={({ pressed }) => [
                          styles.categoryPill,
                          isSelected && styles.categoryPillSelected,
                          pressed && styles.categoryPillPressed,
                        ]}
                        onPress={() => setCategory(cat)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select category ${displayLabel}`}
                      >
                        <Text
                          style={[
                            styles.categoryPillText,
                            isSelected && styles.categoryPillTextSelected,
                          ]}
                        >
                          {displayLabel}
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </View>
            </View>

            {/* Business Justification */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                BUSINESS JUSTIFICATION <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={justification}
                onChangeText={(val) => {
                  setJustification(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Explain why you need access to this tool for your role and workflows..."
                placeholderTextColor={CyberColors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                Governance administrators verify access requests according to zero-trust policies.
              </Text>
            </View>

            {/* Protocol Notice */}
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxIcon}>🔒</Text>
              <Text style={styles.infoBoxText}>
                Access is provisioned with continuous Zero-Trust Identity Federation and SAML 2.0 / OIDC credentials.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
              ]}
              onPress={handleClose}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Cancel access request"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Submit access request"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={CyberColors.textDark} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Request</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 8, 16, 0.85)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#0f172a',
    borderColor: 'rgba(0, 229, 255, 0.4)',
    borderWidth: 1.5,
    borderRadius: CyberRadius.lg,
    overflow: 'hidden',
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.25)',
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 10,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  titleBadgeIcon: {
    fontSize: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: CyberColors.textPrimary,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: CyberColors.textSecondary,
    lineHeight: 16,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  closeButtonText: {
    color: CyberColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollBody: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 18,
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  successBannerText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorBannerText: {
    color: '#fca5a5',
    fontSize: 12.5,
    fontWeight: '600',
  },
  sectionGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: CyberColors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: CyberColors.red,
  },
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: CyberRadius.sm,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
  },
  suggestionPillSelected: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: CyberColors.cyan,
  },
  suggestionPillPressed: {
    opacity: 0.8,
  },
  suggestionIcon: {
    fontSize: 13,
  },
  suggestionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: CyberColors.textSecondary,
  },
  suggestionTextSelected: {
    color: CyberColors.cyan,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  flexField: {
    flex: 1,
    marginBottom: 0,
  },
  iconField: {
    width: 68,
    marginBottom: 0,
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
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
  },
  categoryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: CyberRadius.sm,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
  },
  categoryPillSelected: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: CyberColors.cyan,
  },
  categoryPillPressed: {
    opacity: 0.8,
  },
  categoryPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: CyberColors.textSecondary,
  },
  categoryPillTextSelected: {
    color: CyberColors.cyan,
    fontWeight: '700',
  },
  textarea: {
    minHeight: 80,
    paddingTop: 10,
  },
  helperText: {
    fontSize: 11,
    color: CyberColors.textMuted,
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
    padding: 10,
    marginTop: 4,
  },
  infoBoxIcon: {
    fontSize: 14,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 11,
    color: '#a5b4fc',
    lineHeight: 15,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: CyberRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cancelButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: CyberColors.textSecondary,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: CyberRadius.md,
    backgroundColor: CyberColors.cyan,
    minWidth: 130,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: CyberColors.textDark,
    letterSpacing: 0.3,
  },
});
