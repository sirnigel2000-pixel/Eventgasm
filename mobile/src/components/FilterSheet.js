/**
 * FilterSheet - Bottom sheet for discovery filters
 * Apple-style modal with clean controls
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { colors, typography, borderRadius, spacing, shadows } from '../theme';

const CATEGORIES = [
  { id: 'music', label: 'Music', icon: 'musical-notes' },
  { id: 'sports', label: 'Sports', icon: 'football' },
  { id: 'arts', label: 'Arts & Theater', icon: 'color-palette' },
  { id: 'food', label: 'Food & Drink', icon: 'restaurant' },
  { id: 'comedy', label: 'Comedy', icon: 'happy' },
  { id: 'festivals', label: 'Festivals', icon: 'bonfire' },
  { id: 'community', label: 'Community', icon: 'people' },
  { id: 'nightlife', label: 'Nightlife', icon: 'moon' },
  { id: 'family', label: 'Family', icon: 'heart' },
  { id: 'education', label: 'Classes', icon: 'school' },
];

const DATE_RANGES = [
  { id: 'all', label: 'Any Time' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'This Weekend' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

const PRICE_RANGES = [
  { id: 'all', label: 'Any Price' },
  { id: 'free', label: 'Free Only' },
  { id: 'under25', label: 'Under $25' },
  { id: 'under50', label: 'Under $50' },
  { id: 'under100', label: 'Under $100' },
];

const FilterSheet = ({ visible, onClose, filters, onApply }) => {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const toggleCategory = (categoryId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalFilters(prev => {
      const categories = prev.categories.includes(categoryId)
        ? prev.categories.filter(c => c !== categoryId)
        : [...prev.categories, categoryId];
      return { ...prev, categories };
    });
  };

  const handleDistanceChange = (value) => {
    setLocalFilters(prev => ({ ...prev, maxDistance: Math.round(value) }));
  };

  const handleDateRangeChange = (rangeId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalFilters(prev => ({ ...prev, dateRange: rangeId }));
  };

  const handlePriceRangeChange = (rangeId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalFilters(prev => ({ ...prev, priceRange: rangeId }));
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLocalFilters({
      categories: [],
      maxDistance: 50,
      dateRange: 'all',
      priceRange: 'all',
    });
  };

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply(localFilters);
  };

  const hasChanges = JSON.stringify(localFilters) !== JSON.stringify(filters);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={onClose}>
            <Text style={styles.headerButtonText}>Cancel</Text>
          </Pressable>
          
          <Text style={styles.headerTitle}>Filters</Text>
          
          <Pressable style={styles.headerButton} onPress={handleReset}>
            <Text style={[styles.headerButtonText, styles.resetText]}>Reset</Text>
          </Pressable>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Categories */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <Text style={styles.sectionSubtitle}>
              {localFilters.categories.length === 0 
                ? 'Showing all categories' 
                : `${localFilters.categories.length} selected`}
            </Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(category => {
                const isSelected = localFilters.categories.includes(category.id);
                return (
                  <Pressable
                    key={category.id}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipSelected,
                    ]}
                    onPress={() => toggleCategory(category.id)}
                  >
                    <Ionicons
                      name={category.icon}
                      size={18}
                      color={isSelected ? colors.textInverse : colors.textSecondary}
                    />
                    <Text style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextSelected,
                    ]}>
                      {category.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Distance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Maximum Distance</Text>
            <Text style={styles.sectionSubtitle}>
              {localFilters.maxDistance} miles
            </Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>5 mi</Text>
              <Slider
                style={styles.slider}
                minimumValue={5}
                maximumValue={100}
                value={localFilters.maxDistance}
                onValueChange={handleDistanceChange}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.borderLight}
                thumbTintColor={colors.primary}
              />
              <Text style={styles.sliderLabel}>100 mi</Text>
            </View>
          </View>

          {/* Date Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>When</Text>
            <View style={styles.optionsList}>
              {DATE_RANGES.map(range => (
                <Pressable
                  key={range.id}
                  style={styles.optionRow}
                  onPress={() => handleDateRangeChange(range.id)}
                >
                  <Text style={styles.optionText}>{range.label}</Text>
                  {localFilters.dateRange === range.id && (
                    <Ionicons name="checkmark" size={22} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Price Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price</Text>
            <View style={styles.optionsList}>
              {PRICE_RANGES.map(range => (
                <Pressable
                  key={range.id}
                  style={styles.optionRow}
                  onPress={() => handlePriceRangeChange(range.id)}
                >
                  <Text style={styles.optionText}>{range.label}</Text>
                  {localFilters.priceRange === range.id && (
                    <Ionicons name="checkmark" size={22} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Apply Button */}
        <View style={styles.footer}>
          <Pressable 
            style={[styles.applyButton, !hasChanges && styles.applyButtonDisabled]}
            onPress={handleApply}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  headerButton: {
    minWidth: 60,
  },
  headerButtonText: {
    ...typography.body,
    color: colors.info,
  },
  resetText: {
    textAlign: 'right',
  },
  headerTitle: {
    ...typography.headline,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing.xxl,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.headline,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.subheadline,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    ...typography.subheadline,
    color: colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    ...typography.caption1,
    color: colors.textTertiary,
    minWidth: 40,
  },
  optionsList: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  optionText: {
    ...typography.body,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderLight,
  },
  applyButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
});

export default FilterSheet;
