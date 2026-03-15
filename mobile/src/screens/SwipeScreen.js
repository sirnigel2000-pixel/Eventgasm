/**
 * SwipeScreen - Gamified event discovery
 * 
 * Features:
 * - Swipe Score (XP system)
 * - Badges & Achievements
 * - Streaks for daily swiping
 * - Friend matches
 * - Rich event cards
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
  down: 'want_to',
};

// Gamification constants
const POINTS = {
  swipe: 5,
  streak_bonus: 10,
  first_swipe_today: 25,
  category_explorer: 50,  // Swipe 5 different categories
  super_swiper: 100,      // 50 swipes in a day
  match_bonus: 20,        // Friend also interested
};

const BADGES = [
  { id: 'first_swipe', name: 'First Swipe', emoji: '👆', desc: 'Made your first swipe', threshold: 1 },
  { id: 'explorer', name: 'Explorer', emoji: '🧭', desc: 'Discovered 10 events', threshold: 10 },
  { id: 'enthusiast', name: 'Enthusiast', emoji: '🔥', desc: 'Swiped 50 events', threshold: 50 },
  { id: 'power_swiper', name: 'Power Swiper', emoji: '⚡', desc: 'Swiped 100 events', threshold: 100 },
  { id: 'legendary', name: 'Legendary', emoji: '👑', desc: 'Swiped 500 events', threshold: 500 },
  { id: 'streak_3', name: '3 Day Streak', emoji: '🔥', desc: '3 days in a row', threshold: 3, type: 'streak' },
  { id: 'streak_7', name: 'Week Warrior', emoji: '💪', desc: '7 day streak', threshold: 7, type: 'streak' },
  { id: 'music_lover', name: 'Music Lover', emoji: '🎵', desc: 'Loved 10 music events', threshold: 10, type: 'category', category: 'Music' },
  { id: 'sports_fan', name: 'Sports Fan', emoji: '🏆', desc: 'Loved 10 sports events', threshold: 10, type: 'category', category: 'Sports' },
  { id: 'culture_vulture', name: 'Culture Vulture', emoji: '🎭', desc: 'Loved 10 arts events', threshold: 10, type: 'category', category: 'Arts' },
];

const PREFS_KEY = '@eventgasm_swipe_prefs';
const STATS_KEY = '@eventgasm_swipe_stats';

const SwipeScreen = ({ navigation }) => {
  const { user, isSignedIn: isAuthenticated } = useAuth();
  const [events, setEvents] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [location, setLocation] = useState(null);
  const [filters, setFilters] = useState({ categories: [], maxDistance: 50 });
  
  // Gamification state
  const [stats, setStats] = useState({
    totalSwipes: 0,
    score: 0,
    streak: 0,
    lastSwipeDate: null,
    swipesToday: 0,
    badges: [],
    categoryLikes: {},
    categoriesExplored: [],
  });
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [newBadge, setNewBadge] = useState(null);
  const [showScorePopup, setShowScorePopup] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  
  const scoreAnimation = useRef(new Animated.Value(0)).current;
  const mapRef = useRef(null);
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
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if streak is still valid (swiped yesterday or today)
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const lastSwipe = parsed.lastSwipeDate;
        
        if (lastSwipe !== today && lastSwipe !== yesterday) {
          parsed.streak = 0; // Reset streak
        }
        if (lastSwipe !== today) {
          parsed.swipesToday = 0;
        }
        setStats(parsed);
      }
    } catch (e) {
      console.log('Failed to load stats');
    }
  };

  const saveStats = async (newStats) => {
    try {
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));
    } catch (e) {
      console.log('Failed to save stats');
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
      
      const params = { limit: 50, offset: reset ? 0 : events.length };
      if (location) {
        params.lat = location.latitude;
        params.lng = location.longitude;
        params.radius = filters.maxDistance || 50;
      }

      // Use faster /events endpoint instead of slow /recommended
      const response = await api.get('/events', { params });
      
      if (response.data.success) {
        // Filter out garbage events
        const garbageWords = ['deposit', 'test', 'placeholder', 'tbd', 'tba', 'private', 'staff only', 'season ticket', 'parking pass', 'waitlist', 'presale', 'membership', 'vip upgrade', 'suite rental'];
        let newEvents = (response.data.events || [])
          .filter(e => {
            const title = (e.title || '').toLowerCase().trim();
            if (!title) return false;
            if (/^\$?\d+\.?\d*$/.test(title)) return false; // Just a price
            for (const word of garbageWords) {
              if (title.includes(word)) return false;
            }
            return true;
          });
        
        // DEDUPE: Remove events we've already seen
        const existingIds = new Set(events.map(e => e.id));
        newEvents = newEvents.filter(e => !existingIds.has(e.id));
        
        // DEDUPE: Remove duplicate titles (same show different times)
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
      // Try fallback on error
      try {
        const fallback = await api.get('/events', { params: { limit: 50 } });
        if (fallback.data.success && reset) {
          setEvents(fallback.data.events || []);
          setCurrentIndex(0);
        }
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  }, [filters, events.length, location]);

  // Award points and check for badges
  const awardPoints = (points, reason) => {
    setPointsEarned(points);
    setShowScorePopup(true);
    
    Animated.sequence([
      Animated.timing(scoreAnimation, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(800),
      Animated.timing(scoreAnimation, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowScorePopup(false));
  };

  const checkBadges = (newStats) => {
    const earned = [...newStats.badges];
    let newlyEarned = null;
    
    for (const badge of BADGES) {
      if (earned.includes(badge.id)) continue;
      
      let shouldAward = false;
      
      if (badge.type === 'streak') {
        shouldAward = newStats.streak >= badge.threshold;
      } else if (badge.type === 'category') {
        const catLikes = newStats.categoryLikes[badge.category] || 0;
        shouldAward = catLikes >= badge.threshold;
      } else {
        shouldAward = newStats.totalSwipes >= badge.threshold;
      }
      
      if (shouldAward) {
        earned.push(badge.id);
        newlyEarned = badge;
      }
    }
    
    if (newlyEarned) {
      setNewBadge(newlyEarned);
      setShowBadgeModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    return earned;
  };

  // Handle swipe with gamification
  const handleSwipe = useCallback(async (direction, event) => {
    const action = SWIPE_ACTIONS[direction];
    const category = event.category || 'Other';
    const today = new Date().toDateString();
    
    // Calculate points
    let points = POINTS.swipe;
    const isFirstToday = stats.lastSwipeDate !== today;
    if (isFirstToday) points += POINTS.first_swipe_today;
    
    // Update stats
    const newStats = { ...stats };
    newStats.totalSwipes += 1;
    newStats.swipesToday = (stats.lastSwipeDate === today) ? stats.swipesToday + 1 : 1;
    newStats.score += points;
    
    // Update streak
    if (isFirstToday) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (stats.lastSwipeDate === yesterday) {
        newStats.streak += 1;
        points += POINTS.streak_bonus;
      } else if (!stats.lastSwipeDate) {
        newStats.streak = 1;
      } else {
        newStats.streak = 1;
      }
    }
    newStats.lastSwipeDate = today;
    
    // Track category likes
    if (direction === 'right' || direction === 'up') {
      newStats.categoryLikes[category] = (newStats.categoryLikes[category] || 0) + 1;
    }
    
    // Track explored categories
    if (!newStats.categoriesExplored.includes(category)) {
      newStats.categoriesExplored.push(category);
      if (newStats.categoriesExplored.length === 5) {
        points += POINTS.category_explorer;
      }
    }
    
    // Super swiper bonus
    if (newStats.swipesToday === 50) {
      points += POINTS.super_swiper;
    }
    
    // Check badges
    newStats.badges = checkBadges(newStats);
    newStats.score = stats.score + points;
    
    setStats(newStats);
    saveStats(newStats);
    awardPoints(points);
    
    // Move to next card
    setCurrentIndex(prev => prev + 1);
    
    // Save interaction to server
    if (isAuthenticated && user) {
      try {
        await api.post('/users/interactions', {
          event_id: event.id,
          status: action,
          category: category,
        });
      } catch (error) {}
    }
    
    // Fetch more events if running low
    if (currentIndex >= events.length - 5) {
      fetchEvents(false);
    }
  }, [isAuthenticated, user, currentIndex, events.length, fetchEvents, stats]);

  const handleCardPress = useCallback((event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('EventDetail', { event });
  }, [navigation]);

  const handleActionButton = (direction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (events[currentIndex]) {
      handleSwipe(direction, events[currentIndex]);
    }
  };

  const getLevel = () => {
    if (stats.score < 100) return { level: 1, name: 'Newbie', next: 100 };
    if (stats.score < 500) return { level: 2, name: 'Explorer', next: 500 };
    if (stats.score < 1500) return { level: 3, name: 'Enthusiast', next: 1500 };
    if (stats.score < 5000) return { level: 4, name: 'Adventurer', next: 5000 };
    if (stats.score < 15000) return { level: 5, name: 'Tastemaker', next: 15000 };
    return { level: 6, name: 'Legend', next: null };
  };

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
      const level = getLevel();
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>You're all caught up!</Text>
          <Text style={styles.emptyScore}>Score: {stats.score} XP</Text>
          <Text style={styles.emptyLevel}>Level {level.level}: {level.name}</Text>
          <Pressable style={styles.refreshButton} onPress={() => fetchEvents(true)}>
            <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.refreshButtonText}>Find More</Text>
          </Pressable>
        </View>
      );
    }

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
            friendsGoing={[]}
            style={[
              styles.card,
              { 
                zIndex: 3 - i,
                transform: [{ scale: 1 - i * 0.05 }, { translateY: i * 10 }]
              }
            ]}
          />
        );
      }
    }

    return <View style={styles.cardStack}>{stackCards}</View>;
  };

  const level = getLevel();
  const progress = level.next ? (stats.score / level.next) * 100 : 100;

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Gamified Header */}
        <View style={styles.header}>
          {/* Score & Level */}
          <Pressable style={styles.scoreBox} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.scoreValue}>{stats.score}</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Lv.{level.level}</Text>
            </View>
          </Pressable>
          
          {/* Streak */}
          <View style={styles.streakBox}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakValue}>{stats.streak}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
          
          {/* Badges */}
          <Pressable style={styles.badgeBox}>
            <Text style={styles.badgeCount}>{stats.badges.length}</Text>
            <Text style={styles.badgeLabel}>badges</Text>
            <View style={styles.badgeIcons}>
              {stats.badges.slice(-3).map((id, i) => {
                const badge = BADGES.find(b => b.id === id);
                return <Text key={i} style={styles.badgeEmoji}>{badge?.emoji}</Text>;
              })}
            </View>
          </Pressable>
          
          {/* Filter */}
          <Pressable style={styles.filterBtn} onPress={() => setShowFilters(true)}>
            <Ionicons name="options-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${Math.min(progress, 100)}%` }]} />
          <Text style={styles.progressText}>
            {level.next ? `${stats.score}/${level.next} XP to ${level.name === 'Newbie' ? 'Explorer' : 'next level'}` : 'Max Level!'}
          </Text>
        </View>

        {/* Card Stack */}
        <View style={styles.cardContainer}>
          {renderCardStack()}
        </View>

        {/* Score Popup */}
        {showScorePopup && (
          <Animated.View style={[styles.scorePopup, { opacity: scoreAnimation, transform: [{ translateY: scoreAnimation.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
            <Text style={styles.scorePopupText}>+{pointsEarned} XP</Text>
          </Animated.View>
        )}

        {/* Action Buttons */}
        {currentIndex < events.length && (
          <View style={styles.actionButtons}>
            <Pressable style={[styles.actionButton, styles.actionButtonLeft]} onPress={() => handleActionButton('left')}>
              <Ionicons name="close" size={28} color="#FF3B30" />
            </Pressable>
            
            <Pressable style={[styles.actionButton, styles.actionButtonMaybe]} onPress={() => handleActionButton('up')}>
              <Ionicons name="bookmark-outline" size={24} color="#FF9500" />
            </Pressable>
            
            <Pressable style={[styles.actionButton, styles.actionButtonRight]} onPress={() => handleActionButton('right')}>
              <Ionicons name="heart" size={28} color="#34C759" />
            </Pressable>
          </View>
        )}

        {/* Badge Modal */}
        <Modal visible={showBadgeModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.badgeModal}>
              <Text style={styles.badgeModalEmoji}>{newBadge?.emoji}</Text>
              <Text style={styles.badgeModalTitle}>New Badge!</Text>
              <Text style={styles.badgeModalName}>{newBadge?.name}</Text>
              <Text style={styles.badgeModalDesc}>{newBadge?.desc}</Text>
              <Pressable style={styles.badgeModalBtn} onPress={() => setShowBadgeModal(false)}>
                <Text style={styles.badgeModalBtnText}>Awesome!</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

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
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  
  // Gamified Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  scoreBox: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 70,
  },
  scoreLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  scoreValue: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
  levelBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  levelText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  
  streakBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 60,
  },
  streakEmoji: { fontSize: 16 },
  streakValue: { fontSize: 16, fontWeight: 'bold', color: '#E65100' },
  streakLabel: { fontSize: 9, color: '#E65100' },
  
  badgeBox: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeCount: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  badgeLabel: { fontSize: 11, color: colors.textSecondary },
  badgeIcons: { flexDirection: 'row', marginLeft: 'auto' },
  badgeEmoji: { fontSize: 14 },
  
  filterBtn: { padding: 8 },
  
  // Progress Bar
  progressContainer: {
    height: 20,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 12,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  
  cardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardStack: { width: SCREEN_WIDTH - 32, height: '85%', position: 'relative' },
  card: { position: 'absolute', width: '100%', height: '100%' },
  
  loadingContainer: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: colors.textSecondary },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 16 },
  emptyScore: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginTop: 12 },
  emptyLevel: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  refreshButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  // Score Popup
  scorePopup: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scorePopupText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 24,
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
  },
  actionButtonLeft: { borderWidth: 2, borderColor: '#FF3B30' },
  actionButtonMaybe: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#FF9500' },
  actionButtonRight: { borderWidth: 2, borderColor: '#34C759' },
  
  // Badge Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.8,
  },
  badgeModalEmoji: { fontSize: 64 },
  badgeModalTitle: { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: 8 },
  badgeModalName: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginTop: 4 },
  badgeModalDesc: { fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
  badgeModalBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  badgeModalBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default SwipeScreen;
