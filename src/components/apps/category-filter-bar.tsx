import React from 'react';
import {
  ScrollView,
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { AppCategory } from '@/models/apps.models';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';

interface CategoryFilterBarProps {
  selectedCategory: AppCategory;
  onSelectCategory: (category: AppCategory) => void;
  totalAppsCount: number;
  style?: ViewStyle;
}

interface CategoryOption {
  key: AppCategory;
  label: string;
}

export function CategoryFilterBar({
  selectedCategory,
  onSelectCategory,
  totalAppsCount,
  style,
}: CategoryFilterBarProps) {
  const categories: CategoryOption[] = [
    { key: 'all', label: `All Applications (${totalAppsCount})` },
    { key: 'cloud', label: 'Cloud & Infrastructure' },
    { key: 'developer', label: 'Developer Tools' },
    { key: 'collaboration', label: 'Team Collaboration' },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={[styles.scrollWrap, style]}
    >
      {categories.map((cat) => {
        const isActive = selectedCategory === cat.key;
        return (
          <Pressable
            key={cat.key}
            style={({ pressed }) => [
              styles.pill,
              isActive ? styles.pillActive : styles.pillInactive,
              pressed && styles.pillPressed,
            ]}
            onPress={() => onSelectCategory(cat.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={cat.label}
          >
            <Text
              style={[
                styles.pillText,
                isActive ? styles.pillTextActive : styles.pillTextInactive,
              ]}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollWrap: {
    maxHeight: 46,
    marginBottom: 10,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: CyberRadius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyan,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  pillInactive: {
    backgroundColor: CyberColors.cardBgSecondary,
    borderColor: CyberColors.border,
  },
  pillPressed: {
    opacity: 0.75,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pillTextActive: {
    color: CyberColors.cyan,
  },
  pillTextInactive: {
    color: CyberColors.textSecondary,
  },
});
