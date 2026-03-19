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
  ScrollView,
  Image,
  Share,
  TouchableOpacity,
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
// BlurView removed - not used
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

// Generate realistic interest counts based on event characteristics
const generateInterestCount = (event) => {
  // Hash the event id for consistent "random" numbers
  const hash = (event.id || '').toString().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  
  // Base interest on event type
  let base = 0;
  const title = (event.title || '').toLowerCase();
  const category = (event.category || '').toLowerCase();
  
  // Popular categories get more interest
  if (category.includes('music') || category.includes('concert')) base = 40;
  else if (category.includes('sports')) base = 60;
  else if (category.includes('comedy')) base = 25;
  else if (category.includes('festival')) base = 80;
  else if (category.includes('theater') || category.includes('broadway')) base = 30;
  else base = 15;
  
  // Known artists/teams get boost
  const bigNames = ['taylor', 'beyonce', 'drake', 'kendrick', 'weeknd', 'lakers', 'yankees', 'chiefs', 'swift'];
  if (bigNames.some(n => title.includes(n))) base += 200;
  
  // Free events get boost
  if (event.is_free) base += 20;
  
  // Add pseudo-random variance using hash
  const variance = (hash % 40) - 20;
  const count = Math.max(0, base + variance);
  
  // 30% chance of no visible count (variety)
  if (hash % 10 < 3) return 0;
  
  return count;
};

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
  const [showHistory, setShowHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState('liked'); // 'liked' | 'passed'
  const [likedEvents, setLikedEvents] = useState([]);
  const [passedEvents, setPassedEvents] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const loadHistory = async () => {
    if (!isAuthenticated || !user?.id) return;
    setHistoryLoading(true);
    try {
      const [likedRes, passedRes] = await Promise.all([
        api.get('/users/interactions', { params: { user_id: user.id, status: 'going' } }),
        api.get('/users/interactions', { params: { user_id: user.id, status: 'not_interested' } }),
      ]);
      setLikedEvents(likedRes.data.events || []);
      setPassedEvents(passedRes.data.events || []);
    } catch (e) {
      console.log('History load error:', e.message);
    } finally {
      setHistoryLoading(false);
    }
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

      // Use recommended endpoint - it excludes seen events + uses swipe history
      const params = {
        limit: 50,
        offset: reset ? 0 : events.length,
      };
      if (location) {
        params.lat = location.latitude;
        params.lng = location.longitude;
        params.radius = filters.maxDistance || 50;
      }
      if (isAuthenticated && user?.id) {
        params.user_id = user.id; // enables personalization + seen-event exclusion
      }

      const response = await api.get('/events/recommended', { params });

      if (response.data.success) {
        let newEvents = response.data.events || [];

        // Client-side dedupe against current session stack
        const existingIds = new Set(events.map(e => e.id));
        newEvents = newEvents.filter(e => !existingIds.has(e.id));

        const seenTitles = new Set();
        newEvents = newEvents.filter(e => {
          const key = (e.title || '').toLowerCase().trim();
          if (seenTitles.has(key)) return false;
          seenTitles.add(key);
          return true;
        });

        newEvents = newEvents.map(e => ({
          ...e,
          interestCount: generateInterestCount(e),
        }));

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
  }, [filters, events.length, location, isAuthenticated, user]);

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
    
    // Preload more events early - never let them see the bottom
    if (currentIndex >= events.length - 10) {
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
      // Never feel "done" - always tease more
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>Finding more...</Text>
          <Text style={styles.emptySubtitle}>New events loading</Text>
          <Pressable 
            style={styles.refreshButton} 
            onPress={() => {
              Haptics.impactAsync('Light');
              fetchEvents(true);
            }}
          >
            <Text style={styles.refreshButtonText}>Show me more</Text>
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
            {/* History button - small, unobtrusive */}
            <Pressable
              style={styles.historyButton}
              onPress={() => { loadHistory(); setShowHistory(true); }}
            >
              <Ionicons name="heart" size={18} color="#ff3b30" />
              {likedEvents.length > 0 && (
                <View style={styles.historyBadge}>
                  <Text style={styles.historyBadgeText}>{likedEvents.length > 99 ? '99+' : likedEvents.length}</Text>
                </View>
              )}
            </Pressable>
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

        {/* ── SWIPE HISTORY SHEET ── */}
        {showHistory && (
          <View style={historyStyles.overlay}>
            <Pressable style={historyStyles.backdrop} onPress={() => setShowHistory(false)} />
            <View style={historyStyles.sheet}>
              {/* Handle */}
              <View style={historyStyles.handle} />

              {/* Header */}
              <View style={historyStyles.sheetHeader}>
                <Text style={historyStyles.sheetTitle}>Your Swipes</Text>
                <Pressable onPress={() => setShowHistory(false)}>
                  <Ionicons name="close" size={22} color="#666" />
                </Pressable>
              </View>

              {/* Tabs */}
              <View style={historyStyles.tabs}>
                <Pressable
                  style={[historyStyles.tab, historyTab === 'liked' && historyStyles.tabActive]}
                  onPress={() => setHistoryTab('liked')}
                >
                  <Ionicons name="heart" size={14} color={historyTab === 'liked' ? '#ff3b30' : '#999'} />
                  <Text style={[historyStyles.tabText, historyTab === 'liked' && historyStyles.tabTextActive]}>
                    Liked {likedEvents.length > 0 ? `(${likedEvents.length})` : ''}
                  </Text>
                </Pressable>
                <Pressable
                  style={[historyStyles.tab, historyTab === 'passed' && historyStyles.tabActive]}
                  onPress={() => setHistoryTab('passed')}
                >
                  <Ionicons name="close-circle" size={14} color={historyTab === 'passed' ? '#666' : '#999'} />
                  <Text style={[historyStyles.tabText, historyTab === 'passed' && historyStyles.tabTextActive]}>
                    Passed {passedEvents.length > 0 ? `(${passedEvents.length})` : ''}
                  </Text>
                </Pressable>
              </View>

              {/* List */}
              {historyLoading ? (
                <View style={historyStyles.center}>
                  <ActivityIndicator color="#000" />
                </View>
              ) : (
                <ScrollableList
                  events={historyTab === 'liked' ? likedEvents : passedEvents}
                  onEventPress={(e) => { setShowHistory(false); navigation.navigate('EventDetail', { event: e }); }}
                  emptyText={historyTab === 'liked' ? 'No liked events yet' : 'No passed events'}
                  emptySub={historyTab === 'liked' ? 'Swipe right on events you want to attend' : 'Events you passed on show up here'}
                />
              )}
            </View>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

// ── HISTORY LIST COMPONENT ──
const ScrollableList = ({ events, onEventPress, emptyText, emptySub }) => {
  if (!events || events.length === 0) {
    return (
      <View style={historyStyles.empty}>
        <Ionicons name="heart-outline" size={40} color="#ddd" />
        <Text style={historyStyles.emptyText}>{emptyText}</Text>
        <Text style={historyStyles.emptySub}>{emptySub}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {events.map(event => (
        <TouchableOpacity
          key={event.id}
          style={historyStyles.eventRow}
          onPress={() => onEventPress(event)}
          activeOpacity={0.7}
        >
          {event.image_url ? (
            <Image source={{ uri: event.image_url }} style={historyStyles.eventThumb} />
          ) : (
            <View style={[historyStyles.eventThumb, historyStyles.eventThumbPlaceholder]}>
              <Ionicons name="calendar" size={18} color="#ccc" />
            </View>
          )}
          <View style={historyStyles.eventInfo}>
            <Text style={historyStyles.eventTitle} numberOfLines={1}>{event.title}</Text>
            <Text style={historyStyles.eventMeta} numberOfLines={1}>
              {event.venue_name ? `${event.venue_name} · ` : ''}{event.start_time ? new Date(event.start_time).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={historyStyles.shareBtn}
            onPress={() => Share.share({ message: `${event.title}\n${event.ticket_url || `https://eventgasm.com/event/${event.id}`}` })}
          >
            <Ionicons name="share-outline" size={18} color="#999" />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const historyStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    height: '75%', paddingBottom: 20,
  },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingHorizontal: 20 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 14, marginRight: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#000' },
  tabText: { fontSize: 14, color: '#999', fontWeight: '500' },
  tabTextActive: { color: '#000', fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#666', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#aaa', marginTop: 4, textAlign: 'center' },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  eventThumb: { width: 52, height: 52, borderRadius: 8, resizeMode: 'cover' },
  eventThumbPlaceholder: { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  eventInfo: { flex: 1, marginLeft: 12 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  eventMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  shareBtn: { padding: 8 },
});

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
  historyButton: {
    padding: 6,
    position: 'relative',
  },
  historyBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#ff3b30', borderRadius: 8,
    minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  historyBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  
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
