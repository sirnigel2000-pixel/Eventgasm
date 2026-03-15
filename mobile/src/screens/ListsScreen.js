/**
 * ListsScreen - View saved event lists
 * 
 * Lists:
 * - Going ✓
 * - Maybe 🤔  
 * - Wishlist 😢 (want to but can't)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Haptics from '../utils/haptics';
import { format } from 'date-fns';
import { colors, typography, borderRadius, spacing, shadows } from '../theme';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const LISTS = [
  { id: 'going', label: 'Going', icon: 'checkmark-circle', color: colors.swipeGoing, status: 'going' },
  { id: 'maybe', label: 'Maybe', icon: 'help-circle', color: colors.swipeMaybe, status: 'maybe' },
  { id: 'wishlist', label: 'Wishlist', icon: 'heart-circle', color: colors.swipeWantTo, status: 'want_to' },
];

const ListsScreen = ({ navigation }) => {
  const { user, isSignedIn: isAuthenticated } = useAuth();
  const [activeList, setActiveList] = useState('going');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchListEvents = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const listConfig = LISTS.find(l => l.id === activeList);
      const response = await api.get(`/users/interactions?status=${listConfig.status}`);
      
      if (response.data.success) {
        setEvents(response.data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch list:', error);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeList, isAuthenticated]);

  useEffect(() => {
    fetchListEvents();
  }, [fetchListEvents]);

  const handleListChange = (listId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveList(listId);
    setLoading(true);
  };

  const handleEventPress = (event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('EventDetail', { event });
  };

  const handleRemoveFromList = async (eventId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.delete(`/users/interactions/${eventId}`);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (error) {
      console.error('Failed to remove from list:', error);
    }
  };

  const formatEventDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'EEE, MMM d • h:mm a');
    } catch {
      return '';
    }
  };

  const renderEventItem = ({ item }) => (
    <Pressable 
      style={styles.eventCard}
      onPress={() => handleEventPress(item)}
    >
      <Image
        source={{ uri: item.image_url || item.image }}
        style={styles.eventImage}
        contentFit="cover"
      />
      <View style={styles.eventContent}>
        <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.eventDate}>{formatEventDate(item.start_time)}</Text>
        {item.venue_name && (
          <Text style={styles.eventVenue} numberOfLines={1}>
            {item.venue_name}
          </Text>
        )}
      </View>
      <Pressable 
        style={styles.removeButton}
        onPress={() => handleRemoveFromList(item.id)}
        hitSlop={10}
      >
        <Ionicons name="close-circle" size={24} color={colors.textTertiary} />
      </Pressable>
    </Pressable>
  );

  const renderEmptyList = () => {
    if (!isAuthenticated) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Sign in to save events</Text>
          <Text style={styles.emptySubtitle}>
            Create an account to save events and sync across devices
          </Text>
          <Pressable 
            style={styles.signInButton}
            onPress={() => navigation.navigate('ProfileTab')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
        </View>
      );
    }

    const listConfig = LISTS.find(l => l.id === activeList);
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name={listConfig.icon} size={64} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No events yet</Text>
        <Text style={styles.emptySubtitle}>
          Swipe on events to add them to your {listConfig.label.toLowerCase()} list
        </Text>
        <Pressable 
          style={styles.discoverButton}
          onPress={() => navigation.navigate('DiscoverTab')}
        >
          <Text style={styles.discoverButtonText}>Discover Events</Text>
        </Pressable>
      </View>
    );
  };

  const activeListConfig = LISTS.find(l => l.id === activeList);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Events</Text>
      </View>

      {/* List Tabs */}
      <View style={styles.tabs}>
        {LISTS.map(list => (
          <Pressable
            key={list.id}
            style={[
              styles.tab,
              activeList === list.id && styles.tabActive,
            ]}
            onPress={() => handleListChange(list.id)}
          >
            <Ionicons 
              name={list.icon} 
              size={20} 
              color={activeList === list.id ? list.color : colors.textTertiary}
            />
            <Text style={[
              styles.tabText,
              activeList === list.id && { color: list.color, fontWeight: '600' },
            ]}>
              {list.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Event List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderEventItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchListEvents();
              }}
              tintColor={activeListConfig.color}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.largeTitle,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
  },
  tabActive: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabText: {
    ...typography.subheadline,
    color: colors.textTertiary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    ...shadows.sm,
    overflow: 'hidden',
  },
  eventImage: {
    width: 100,
    height: 100,
    backgroundColor: colors.backgroundSecondary,
  },
  eventContent: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
  },
  eventTitle: {
    ...typography.headline,
    marginBottom: spacing.xs,
  },
  eventDate: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  eventVenue: {
    ...typography.caption1,
    color: colors.textTertiary,
  },
  removeButton: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.massive,
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
  signInButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
  },
  signInButtonText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
  discoverButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
  },
  discoverButtonText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
});

export default ListsScreen;
