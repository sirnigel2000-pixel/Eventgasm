/**
 * SwipeScreen - Personalized event discovery with Tinder-like swiping
 * 
 * Features:
 * - Location-based: Shows nearby events first
 * - Algorithm-driven: Learns from swipes to improve recommendations
 * - Swipe right = interested, left = not interested
 * - Every swipe trains your personal recommendation engine
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
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Local storage keys for preferences
const PREFS_KEY = '@eventgasm_swipe_prefs';

const SwipeScreen = ({ navigation }) => {
  const { user, isSignedIn: isAuthenticated } = useAuth();
  const [events, setEvents] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [preferences, setPreferences] = useState({
    likedCategories: {},    // { "Music": 5, "Sports": 3 }
    dislikedCategories: {}, // { "Comedy": 2 }
    swipeCount: 0,
  });
  const [filters, setFilters] = useState({
    categories: [],
    maxDistance: 50,
    dateRange: 'all',
    priceRange: 'all',
  });
  
  const cardStackRef = useRef(null);

  // Load preferences and location on mount
  useEffect(() => {
    loadPreferences();
    getLocation();
  }, []);

  // Fetch events when location is available
  useEffect(() => {
    if (location) {
      fetchEvents(true);
    }
  }, [location]);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(PREFS_KEY);
      if (stored) {
        setPreferences(JSON.parse(stored));
      }
    } catch (e) {
      console.log('Failed to load preferences');
    }
  };

  const savePreferences = async (newPrefs) => {
    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
    } catch (e) {
      console.log('Failed to save preferences');
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        // Still fetch events, just without location sorting
        fetchEvents(true);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (e) {
      setLocationError('Could not get location');
      fetchEvents(true);
    }
  };

  // Fetch events with smart sorting
  const fetchEvents = useCallback(async (reset = false) => {
    try {
      if (reset) setLoading(true);
      
      const params = {
        limit: 50,
        offset: reset ? 0 : events.length,
      };

      // Add location for distance-based sorting
      if (location) {
        params.lat = location.latitude;
        params.lng = location.longitude;
        params.radius = filters.maxDistance;
      }

      // Add category filter if set
      if (filters.categories.length > 0) {
        params.category = filters.categories.join(',');
      }

      // Request personalized/recommended events if we have preference data
      if (preferences.swipeCount > 5) {
        params.personalized = true;
        // Send top liked categories
        const topLiked = Object.entries(preferences.likedCategories)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([cat]) => cat);
        if (topLiked.length > 0) {
          params.preferred_categories = topLiked.join(',');
        }
      }

      const response = await api.get('/events/recommended', { params });
      
      if (response.data.success) {
        let newEvents = response.data.events || [];
        
        // Client-side boost for preferred categories
        if (preferences.swipeCount > 3) {
          newEvents = boostPreferredEvents(newEvents);
        }
        
        if (reset) {
          setEvents(newEvents);
          setCurrentIndex(0);
        } else {
          setEvents(prev => [...prev, ...newEvents]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
      // Fallback to regular events endpoint
      try {
        const fallbackParams = { limit: 50 };
        if (location) {
          fallbackParams.lat = location.latitude;
          fallbackParams.lng = location.longitude;
        }
        const response = await api.get('/events', { params: fallbackParams });
        if (response.data.success) {
          const newEvents = response.data.events || [];
          if (reset) {
            setEvents(newEvents);
            setCurrentIndex(0);
          }
        }
      } catch (e) {
        console.error('Fallback fetch failed:', e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, events.length, location, preferences]);

  // Boost events from preferred categories to the top
  const boostPreferredEvents = (eventList) => {
    const scored = eventList.map(event => {
      let score = 0;
      const cat = event.category;
      
      // Boost liked categories
      if (preferences.likedCategories[cat]) {
        score += preferences.likedCategories[cat] * 10;
      }
      
      // Penalize disliked categories
      if (preferences.dislikedCategories[cat]) {
        score -= preferences.dislikedCategories[cat] * 5;
      }
      
      return { ...event, _score: score };
    });
    
    // Sort by score (higher = better), but keep some randomness
    return scored.sort((a, b) => {
      // Add some randomness so it's not too predictable
      const randomFactor = (Math.random() - 0.5) * 5;
      return (b._score + randomFactor) - (a._score + randomFactor);
    });
  };

  // Handle swipe action - THIS TRAINS THE ALGORITHM
  const handleSwipe = useCallback(async (direction, event) => {
    const action = SWIPE_ACTIONS[direction];
    const category = event.category || 'Other';
    
    // Update local preferences based on swipe
    const newPrefs = { ...preferences };
    newPrefs.swipeCount += 1;
    
    if (direction === 'right' || direction === 'up') {
      // Liked - boost this category
      newPrefs.likedCategories[category] = (newPrefs.likedCategories[category] || 0) + 1;
    } else if (direction === 'left') {
      // Not interested - note this preference
      newPrefs.dislikedCategories[category] = (newPrefs.dislikedCategories[category] || 0) + 1;
    }
    
    setPreferences(newPrefs);
    savePreferences(newPrefs);
    
    // Move to next card
    setCurrentIndex(prev => prev + 1);
    
    // Save interaction to server (for cross-device sync & better recommendations)
    if (isAuthenticated && user) {
      try {
        await api.post('/users/interactions', {
          event_id: event.id,
          status: action,
          category: category,
        });
      } catch (error) {
        console.error('Failed to save interaction:', error);
      }
    }
    
    // Fetch more events if running low
    if (currentIndex >= events.length - 5) {
      fetchEvents(false);
    }
  }, [isAuthenticated, user, currentIndex, events.length, fetchEvents, preferences]);

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

  // Get preference summary for display
  const getPreferenceSummary = () => {
    if (preferences.swipeCount < 5) {
      return `Swipe to train your feed (${preferences.swipeCount}/5)`;
    }
    const topCat = Object.entries(preferences.likedCategories)
      .sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      return `Personalized · You like ${topCat[0]}`;
    }
    return 'Personalized for you';
  };

  // Render card stack (show 3 cards)
  const renderCardStack = () => {
    if (loading && events.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {location ? 'Finding events near you...' : 'Getting your location...'}
          </Text>
        </View>
      );
    }

    if (currentIndex >= events.length) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={64} color={colors.primary} />
          <Text style={styles.emptyTitle}>You're all caught up!</Text>
          <Text style={styles.emptySubtitle}>
            {preferences.swipeCount > 0 
              ? `You've swiped ${preferences.swipeCount} events. We're learning your taste!`
              : 'Check back later for more events'
            }
          </Text>
          <Pressable 
            style={styles.refreshButton}
            onPress={() => fetchEvents(true)}
          >
            <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.refreshButtonText}>Find More</Text>
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
            friendsGoing={[]}
            style={[
              styles.card,
              { 
                zIndex: 3 - i,
                transform: [
                  { scale: 1 - i * 0.05 },
                  { translateY: i * 10 }
                ]
              }
            ]}
          />
        );
      }
    }

    return <View style={styles.cardStack}>{stackCards}</View>;
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header with location + preferences indicator */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={styles.locationText}>
              {location ? 'Near you' : locationError || 'Anywhere'}
            </Text>
          </View>
          
          <Text style={styles.algoText}>{getPreferenceSummary()}</Text>
          
          <Pressable 
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="options-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Card Stack */}
        <View style={styles.cardContainer}>
          {renderCardStack()}
        </View>

        {/* Swipe hint for new users */}
        {preferences.swipeCount < 3 && currentIndex < events.length && (
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>
              👈 Not interested · Interested 👉
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        {currentIndex < events.length && (
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.actionButton, styles.actionButtonLeft]}
              onPress={() => handleActionButton('left')}
            >
              <Ionicons name="close" size={28} color="#FF3B30" />
            </Pressable>
            
            <Pressable
              style={[styles.actionButton, styles.actionButtonMaybe]}
              onPress={() => handleActionButton('up')}
            >
              <Ionicons name="bookmark-outline" size={24} color="#FF9500" />
            </Pressable>
            
            <Pressable
              style={[styles.actionButton, styles.actionButtonRight]}
              onPress={() => handleActionButton('right')}
            >
              <Ionicons name="heart" size={28} color="#34C759" />
            </Pressable>
          </View>
        )}

        {/* Filter Sheet */}
        <FilterSheet
          visible={showFilters}
          onClose={() => setShowFilters(false)}
          filters={filters}
          onApply={handleApplyFilters}
        />
      </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  algoText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  filterButton: {
    padding: 8,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStack: {
    width: SCREEN_WIDTH - 32,
    height: '85%',
    position: 'relative',
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hintContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  hintText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 30,
    gap: 20,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  actionButtonLeft: {
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  actionButtonMaybe: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  actionButtonRight: {
    borderWidth: 2,
    borderColor: '#34C759',
  },
});

export default SwipeScreen;
