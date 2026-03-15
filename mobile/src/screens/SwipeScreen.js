/**
 * SwipeScreen - Main discovery screen with Tinder-like card stack
 * 
 * Features:
 * - Card stack with gesture-based swiping
 * - Filter button to open filter sheet
 * - Action buttons for non-swipe input
 * - Friends going indicator
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import SwipeCard from '../components/SwipeCard';
import FilterSheet from '../components/FilterSheet';
import { colors, typography, shadows, borderRadius, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SWIPE_ACTIONS = {
  right: 'going',
  left: 'not_interested',
  up: 'maybe',
  down: 'want_to',
};

const SwipeScreen = ({ navigation }) => {
  const { user, isAuthenticated } = useAuth();
  const [events, setEvents] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    categories: [],
    maxDistance: 50,
    dateRange: 'all',
    priceRange: 'all',
  });
  
  const cardStackRef = useRef(null);

  // Fetch events based on filters
  const fetchEvents = useCallback(async (reset = false) => {
    try {
      if (reset) setLoading(true);
      
      const params = new URLSearchParams({
        limit: '50',
        offset: reset ? '0' : events.length.toString(),
      });

      if (filters.categories.length > 0) {
        params.append('category', filters.categories.join(','));
      }

      const response = await api.get(`/events?${params.toString()}`);
      
      if (response.data.success) {
        const newEvents = response.data.events || [];
        if (reset) {
          setEvents(newEvents);
          setCurrentIndex(0);
        } else {
          setEvents(prev => [...prev, ...newEvents]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, events.length]);

  useEffect(() => {
    fetchEvents(true);
  }, []);

  // Handle swipe action
  const handleSwipe = useCallback(async (direction, event) => {
    const action = SWIPE_ACTIONS[direction];
    
    // Move to next card
    setCurrentIndex(prev => prev + 1);
    
    // If authenticated, save the interaction
    if (isAuthenticated && user) {
      try {
        await api.post('/users/interactions', {
          event_id: event.id,
          status: action,
        });
      } catch (error) {
        console.error('Failed to save interaction:', error);
      }
    }
    
    // Fetch more events if running low
    if (currentIndex >= events.length - 5) {
      fetchEvents(false);
    }
  }, [isAuthenticated, user, currentIndex, events.length, fetchEvents]);

  // Handle card press - navigate to detail
  const handleCardPress = useCallback((event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('EventDetail', { event });
  }, [navigation]);

  // Action button handlers
  const handleActionButton = (direction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (events[currentIndex]) {
      handleSwipe(direction, events[currentIndex]);
    }
  };

  // Apply filters
  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
    setShowFilters(false);
    fetchEvents(true);
  };

  // Render card stack (show 3 cards)
  const renderCardStack = () => {
    if (loading && events.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding events...</Text>
        </View>
      );
    }

    if (currentIndex >= events.length) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No more events</Text>
          <Text style={styles.emptySubtitle}>
            Adjust your filters or check back later
          </Text>
          <Pressable 
            style={styles.refreshButton}
            onPress={() => fetchEvents(true)}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </Pressable>
        </View>
      );
    }

    // Show up to 3 stacked cards
    const stackCards = [];
    for (let i = 2; i >= 0; i--) {
      const eventIndex = currentIndex + i;
      if (eventIndex < events.length) {
        stackCards.push(
          <SwipeCard
            key={events[eventIndex].id}
            event={events[eventIndex]}
            onSwipe={i === 0 ? handleSwipe : undefined}
            onPress={i === 0 ? handleCardPress : undefined}
            isFirst={i === 0}
            friendsGoing={[]} // TODO: Fetch from social API
          />
        );
      }
    }

    return (
      <View style={styles.cardStack}>
        {stackCards}
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
          </Pressable>
          
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>eventgasm</Text>
          </View>
          
          <Pressable 
            style={styles.headerButton}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="options-outline" size={24} color={colors.primary} />
          </Pressable>
        </View>

        {/* Card Stack */}
        <View style={styles.cardContainer}>
          {renderCardStack()}
        </View>

        {/* Action Buttons */}
        {events.length > 0 && currentIndex < events.length && (
          <View style={styles.actionButtons}>
            {/* Not Going - Left */}
            <Pressable
              style={[styles.actionButton, styles.actionButtonSmall, { backgroundColor: colors.swipeNotGoing }]}
              onPress={() => handleActionButton('left')}
            >
              <Ionicons name="close" size={24} color={colors.textInverse} />
            </Pressable>

            {/* Want To - Down */}
            <Pressable
              style={[styles.actionButton, styles.actionButtonSmall, { backgroundColor: colors.swipeWantTo }]}
              onPress={() => handleActionButton('down')}
            >
              <Ionicons name="heart-dislike-outline" size={22} color={colors.textInverse} />
            </Pressable>

            {/* Maybe - Up */}
            <Pressable
              style={[styles.actionButton, styles.actionButtonSmall, { backgroundColor: colors.swipeMaybe }]}
              onPress={() => handleActionButton('up')}
            >
              <Ionicons name="help" size={24} color={colors.textInverse} />
            </Pressable>

            {/* Going - Right */}
            <Pressable
              style={[styles.actionButton, styles.actionButtonLarge, { backgroundColor: colors.swipeGoing }]}
              onPress={() => handleActionButton('right')}
            >
              <Ionicons name="checkmark" size={32} color={colors.textInverse} />
            </Pressable>
          </View>
        )}

        {/* Swipe hints for first-time users */}
        {currentIndex === 0 && events.length > 0 && (
          <View style={styles.hints}>
            <Text style={styles.hintText}>
              Swipe right to save • Left to skip • Up for maybe • Down for wishlist
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* Filter Sheet */}
      <FilterSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={handleApplyFilters}
      />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    ...typography.title2,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStack: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.subheadline,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    ...typography.title2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  refreshButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
  },
  refreshButtonText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  actionButtonSmall: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  actionButtonLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  hints: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  hintText: {
    ...typography.caption1,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

export default SwipeScreen;
