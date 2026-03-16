/**
 * SwipeScreen - Addictive event discovery
 * Dopamine hits, not game mechanics
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Haptics from '../utils/haptics';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SwipeCard from '../components/SwipeCard';
import FilterSheet from '../components/FilterSheet';
import { colors, shadows } from '../theme';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SWIPE_ACTIONS = {
  right: 'going',
  left: 'not_interested',
  up: 'maybe',
};

const STATS_KEY = '@eventgasm_discovery';

const SwipeScreen = ({ navigation }) => {
  const { user, isSignedIn: isAuthenticated } = useAuth();
  const [events, setEvents] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [location, setLocation] = useState(null);
  const [filters, setFilters] = useState({ categories: [], maxDistance: 50 });
  const [lastSwipeDirection, setLastSwipeDirection] = useState(null);
  const [showMatchGlow, setShowMatchGlow] = useState(false);
  
  // Simple stats for personalization
  const [stats, setStats] = useState({
    explored: 0,
    liked: 0,
    topCategory: null,
    categoryLikes: {},
    sessionSwipes: 0,
  });

  // Animations for that dopamine hit
  const matchGlowOpacity = useSharedValue(0);
  const cardStackPulse = useSharedValue(1);
  const headerPop = useSharedValue(1);
  
  const debounceRef = useRef(null);

  useEffect(() => {
    loadStats();
    getLocation();
  }, []);

  useEffect(() => {
    if (location) fetchEvents(true);
  }, [location]);

  const loadStats = async () => {
    try {
      const stored = await AsyncStorage.getItem(STATS_KEY);
      if (stored) setStats(JSON.parse(stored));
    } catch (e) {}
  };

  const saveStats = async (newStats) => {
    try {
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));
    } catch (e) {}
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } else {
        fetchEvents(true);
      }
    } catch (e) {
      fetchEvents(true);
    }
  };

  const fetchEvents = useCallback(async (reset = false) => {
    try {
      if (reset) setLoading(true);
      
      const params = { limit: 50, offset: reset ? 0 : events.length };
      if (location) {
        params.lat = location.latitude;
        params.lng = location.longitude;
        params.radius = filters.maxDistance || 50;
      }

      const response = await api.get('/events', { params });
      
      if (response.data.success) {
        const garbageWords = ['deposit', 'test', 'placeholder', 'tbd', 'tba', 'private', 'staff only', 'season ticket', 'parking pass', 'waitlist', 'presale', 'membership'];
        let newEvents = (response.data.events || [])
          .filter(e => {
            const title = (e.title || '').toLowerCase().trim();
            if (!title) return false;
            if (/^\$?\d+\.?\d*$/.test(title)) return false;
            for (const word of garbageWords) {
              if (title.includes(word)) return false;
            }
            return true;
          });
        
        // Dedupe
        const existingIds = new Set(events.map(e => e.id));
        newEvents = newEvents.filter(e => !existingIds.has(e.id));
        
        const seenTitles = new Set();
        newEvents = newEvents.filter(e => {
          const titleKey = (e.title || '').toLowerCase().trim();
          if (seenTitles.has(titleKey)) return false;
          seenTitles.add(titleKey);
          return true;
        });
        
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
    }
  }, [filters, events.length, location]);

  // Handle swipe - satisfying feedback, no cheesy points
  const handleSwipe = useCallback(async (direction, event) => {
    const action = SWIPE_ACTIONS[direction];
    const category = event.category || 'Other';
    setLastSwipeDirection(direction);
    
    // Different haptic patterns for different actions
    if (direction === 'right') {
      // Satisfying double-tap for "yes"
      Haptics.notificationAsync('Success');
      
      // Subtle glow effect
      setShowMatchGlow(true);
      matchGlowOpacity.value = withSequence(
        withTiming(0.6, { duration: 100 }),
        withTiming(0, { duration: 400 })
      );
      setTimeout(() => setShowMatchGlow(false), 500);
      
    } else if (direction === 'up') {
      // Soft bump for "maybe"
      Haptics.impactAsync('Light');
    } else {
      // Quick light tap for "nope"
      Haptics.selectionAsync();
    }
    
    // Card stack "breathes" - subtle anticipation
    cardStackPulse.value = withSequence(
      withTiming(0.98, { duration: 50 }),
      withSpring(1, { damping: 15, stiffness: 200 })
    );
    
    // Update stats quietly
    const newStats = { ...stats };
    newStats.explored = (stats.explored || 0) + 1;
    newStats.sessionSwipes = (stats.sessionSwipes || 0) + 1;
    
    if (direction === 'right' || direction === 'up') {
      newStats.liked = (stats.liked || 0) + 1;
      newStats.categoryLikes = { ...stats.categoryLikes };
      newStats.categoryLikes[category] = (newStats.categoryLikes[category] || 0) + 1;
      
      const sorted = Object.entries(newStats.categoryLikes).sort((a, b) => b[1] - a[1]);
      newStats.topCategory = sorted[0]?.[0];
    }
    
    setStats(newStats);
    saveStats(newStats);
    setCurrentIndex(prev => prev + 1);
    
    // Save to server
    if (isAuthenticated && user) {
      try {
        await api.post('/users/interactions', { event_id: event.id, status: action });
      } catch (error) {}
    }
    
    if (currentIndex >= events.length - 5) {
      fetchEvents(false);
    }
  }, [isAuthenticated, user, currentIndex, events.length, fetchEvents, stats]);

  const handleCardPress = useCallback((event) => {
    Haptics.impactAsync('Light');
    navigation.navigate('EventDetail', { event });
  }, [navigation]);

  const handleActionButton = (direction) => {
    if (events[currentIndex]) {
      handleSwipe(direction, events[currentIndex]);
    }
  };
  
  // Session momentum indicator (subtle, not gamey)
  const getMomentumText = () => {
    const s = stats.sessionSwipes || 0;
    if (s >= 20) return '🔥';
    if (s >= 10) return '⚡';
    if (s >= 5) return '✨';
    return null;
  };

  // Animated card stack style
  const cardStackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardStackPulse.value }],
  }));
  
  // Match glow style
  const glowStyle = useAnimatedStyle(() => ({
    opacity: matchGlowOpacity.value,
  }));

  const renderCardStack = () => {
    if (loading && events.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding events near you...</Text>
        </View>
      );
    }

    if (currentIndex >= events.length) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyTitle}>You're all caught up</Text>
          <Text style={styles.emptySubtitle}>Check back later for new events</Text>
          <Pressable style={styles.refreshButton} onPress={() => fetchEvents(true)}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </Pressable>
        </View>
      );
    }

    const stackCards = [];
    for (let i = 2; i >= 0; i--) {
      const eventIndex = currentIndex + i;
      if (eventIndex < events.length) {
        const evt = events[eventIndex];
        // Add some spice - mark trending/hot events
        const isHot = evt.is_free || (evt.price_min && evt.price_min < 30);
        
        stackCards.push(
          <SwipeCard
            key={evt.id}
            event={evt}
            onSwipe={i === 0 ? handleSwipe : undefined}
            onPress={i === 0 ? handleCardPress : undefined}
            isFirst={i === 0}
            isHot={i === 0 && isHot}
            style={[
              styles.card,
              { zIndex: 3 - i, transform: [{ scale: 1 - i * 0.05 }, { translateY: i * 8 }] }
            ]}
          />
        );
      }
    }

    return (
      <Animated.View style={[styles.cardStack, cardStackStyle]}>
        {/* Success glow behind cards */}
        {showMatchGlow && (
          <Animated.View style={[styles.matchGlow, glowStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(52, 199, 89, 0.3)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
        {stackCards}
      </Animated.View>
    );
  };

  // Get taste label
  const getTasteLabel = () => {
    if (!stats.topCategory) return null;
    return stats.topCategory;
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Clean header with subtle momentum */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Discover</Text>
            {getMomentumText() && (
              <Text style={styles.momentumEmoji}>{getMomentumText()}</Text>
            )}
          </View>
          
          <View style={styles.headerRight}>
            {stats.topCategory && (
              <View style={styles.tasteBadge}>
                <Text style={styles.tasteBadgeText}>{stats.topCategory}</Text>
              </View>
            )}
            <Pressable style={styles.filterButton} onPress={() => setShowFilters(true)}>
              <Ionicons name="options-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Cards */}
        <View style={styles.cardContainer}>
          {renderCardStack()}
        </View>

        {/* Action Buttons - minimal */}
        {currentIndex < events.length && (
          <View style={styles.actionButtons}>
            <Pressable style={[styles.actionButton, styles.actionNope]} onPress={() => handleActionButton('left')}>
              <Ionicons name="close" size={32} color="#FF3B30" />
            </Pressable>
            
            <Pressable style={[styles.actionButton, styles.actionSave]} onPress={() => handleActionButton('up')}>
              <Ionicons name="bookmark-outline" size={26} color="#FF9500" />
            </Pressable>
            
            <Pressable style={[styles.actionButton, styles.actionLike]} onPress={() => handleActionButton('right')}>
              <Ionicons name="heart" size={32} color="#34C759" />
            </Pressable>
          </View>
        )}

        <FilterSheet
          visible={showFilters}
          onClose={() => setShowFilters(false)}
          filters={filters}
          onApply={(f) => { setFilters(f); setShowFilters(false); fetchEvents(true); }}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  safeArea: { flex: 1 },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  momentumEmoji: {
    fontSize: 18,
  },
  tasteBadge: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tasteBadgeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  filterButton: {
    padding: 6,
  },
  
  // Cards
  cardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardStack: { width: SCREEN_WIDTH - 32, height: '88%', position: 'relative' },
  card: { position: 'absolute', width: '100%', height: '100%' },
  
  // Match glow effect
  matchGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 30,
    zIndex: -1,
  },
  
  // Loading/Empty
  loadingContainer: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: colors.textSecondary },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 24, fontWeight: '600', color: colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 8 },
  refreshButton: {
    marginTop: 24,
    backgroundColor: colors.text,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  refreshButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  // Action buttons - sleek, satisfying
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 20,
    gap: 20,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
    shadowOpacity: 0.12,
  },
  actionNope: { 
    borderWidth: 2.5, 
    borderColor: 'rgba(255,59,48,0.15)',
  },
  actionSave: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    borderWidth: 2, 
    borderColor: 'rgba(255,149,0,0.15)',
  },
  actionLike: { 
    borderWidth: 2.5, 
    borderColor: 'rgba(52,199,89,0.15)',
  },
});

export default SwipeScreen;
