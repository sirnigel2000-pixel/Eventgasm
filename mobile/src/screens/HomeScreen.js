import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Dimensions
} from 'react-native';
import * as Location from 'expo-location';
import { fetchEvents } from '../services/api';
import EventCard from '../components/EventCard';
import SearchBar from '../components/SearchBar';

const { width } = Dimensions.get('window');

const VIBES = [
  { id: 'all', name: 'All', emoji: '✨' },
  { id: 'free', name: 'Free', emoji: '🆓' },
  { id: 'music', name: 'Music', emoji: '🎵' },
  { id: 'food', name: 'Food & Drink', emoji: '🍻' },
  { id: 'sports', name: 'Sports', emoji: '⚽' },
  { id: 'arts', name: 'Arts', emoji: '🎨' },
  { id: 'comedy', name: 'Comedy', emoji: '😂' },
  { id: 'community', name: 'Local', emoji: '🏘️' },
  { id: 'family', name: 'Family', emoji: '👨‍👩‍👧' },
];

// Cities with coordinates for radius-based search
const LOCATIONS = [
  { name: '📍 All Locations', value: null },
  { name: '📍 Near Me', value: 'geolocate' },
  // Florida
  { name: '🌴 Orlando, FL', value: { lat: 28.5383, lng: -81.3792 } },
  { name: '🌴 Miami, FL', value: { lat: 25.7617, lng: -80.1918 } },
  { name: '🌴 Tampa, FL', value: { lat: 27.9506, lng: -82.4572 } },
  { name: '🌴 Jacksonville, FL', value: { lat: 30.3322, lng: -81.6557 } },
  { name: '🌴 Fort Lauderdale, FL', value: { lat: 26.1224, lng: -80.1373 } },
  { name: '🌴 Sarasota, FL', value: { lat: 27.3364, lng: -82.5307 } },
  { name: '🌴 Melbourne, FL', value: { lat: 28.0836, lng: -80.6081 } },
  // Major US Cities
  { name: '🗽 New York, NY', value: { lat: 40.7128, lng: -74.0060 } },
  { name: '🌆 Los Angeles, CA', value: { lat: 34.0522, lng: -118.2437 } },
  { name: '🌬️ Chicago, IL', value: { lat: 41.8781, lng: -87.6298 } },
  { name: '🤠 Houston, TX', value: { lat: 29.7604, lng: -95.3698 } },
  { name: '🤠 Dallas, TX', value: { lat: 32.7767, lng: -96.7970 } },
  { name: '🤠 Austin, TX', value: { lat: 30.2672, lng: -97.7431 } },
  { name: '🍑 Atlanta, GA', value: { lat: 33.7490, lng: -84.3880 } },
  { name: '🎸 Nashville, TN', value: { lat: 36.1627, lng: -86.7816 } },
  { name: '⚜️ New Orleans, LA', value: { lat: 29.9511, lng: -90.0715 } },
  { name: '🎰 Las Vegas, NV', value: { lat: 36.1699, lng: -115.1398 } },
  { name: '🌉 San Francisco, CA', value: { lat: 37.7749, lng: -122.4194 } },
  { name: '☔ Seattle, WA', value: { lat: 47.6062, lng: -122.3321 } },
  { name: '🏔️ Denver, CO', value: { lat: 39.7392, lng: -104.9903 } },
  { name: '🔔 Philadelphia, PA', value: { lat: 39.9526, lng: -75.1652 } },
  { name: '🏛️ Washington, DC', value: { lat: 38.9072, lng: -77.0369 } },
  { name: '🦀 Boston, MA', value: { lat: 42.3601, lng: -71.0589 } },
];

export default function HomeScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [freeEvents, setFreeEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationCoords, setLocationCoords] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFreeSection, setShowFreeSection] = useState(true);

  // Load free events for the spotlight section
  const loadFreeEvents = useCallback(async () => {
    try {
      // Don't filter by state - show free events nationwide
      const data = await fetchEvents({
        free: 'true',
        limit: 10,
      });
      setFreeEvents(data.events || []);
    } catch (error) {
      console.error('Failed to load free events:', error);
    }
  }, []);

  const loadEvents = useCallback(async (reset = false) => {
    try {
      const currentPage = reset ? 1 : page;
      const params = {
        limit: 20,
        offset: (currentPage - 1) * 20,
      };

      // Use location coordinates for radius search if available
      if (locationCoords) {
        params.lat = locationCoords.lat;
        params.lng = locationCoords.lng;
        params.radius = 25;
      }

      if (selectedVibe === 'free') {
        params.free = 'true';
      } else if (selectedVibe === 'community') {
        params.source = 'allevents';
      } else if (selectedVibe !== 'all') {
        // Map vibe to category
        const vibeToCategory = {
          'music': 'Music',
          'food': 'Food & Drink',
          'sports': 'Sports',
          'arts': 'Arts & Theatre',
          'comedy': 'Comedy',
          'family': 'Family',
        };
        if (vibeToCategory[selectedVibe]) {
          params.category = vibeToCategory[selectedVibe];
        }
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const data = await fetchEvents(params);
      
      if (reset) {
        setEvents(data.events || []);
        setPage(1);
      } else {
        setEvents(prev => [...prev, ...(data.events || [])]);
      }
      
      setHasMore((data.events || []).length === 20);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  }, [page, selectedVibe, locationCoords, searchQuery]);

  // Handle location selection
  const handleLocationSelect = async (location) => {
    setSelectedLocation(location);
    
    if (location?.value === 'geolocate') {
      // Request user's location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocationCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } else {
        alert('Location permission denied. Please select a city instead.');
        setSelectedLocation(null);
        setLocationCoords(null);
      }
    } else if (location?.value) {
      setLocationCoords(location.value);
    } else {
      setLocationCoords(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    setPage(1);
    Promise.all([
      loadEvents(true),
      loadFreeEvents()
    ]).finally(() => setLoading(false));
  }, [selectedVibe, locationCoords]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadEvents(true), loadFreeEvents()]);
    setRefreshing(false);
  }, [loadEvents, loadFreeEvents]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setPage(p => p + 1);
    await loadEvents();
    setLoadingMore(false);
  }, [loadingMore, hasMore, loadEvents]);

  const handleSearch = useCallback(() => {
    setLoading(true);
    setPage(1);
    loadEvents(true).finally(() => setLoading(false));
  }, [loadEvents]);

  const handleEventPress = (event) => {
    navigation.navigate('EventDetail', { event });
  };

  // Free Events Spotlight Section
  const renderFreeSpotlight = () => {
    if (!showFreeSection || freeEvents.length === 0 || selectedVibe === 'free') {
      return null;
    }

    return (
      <View style={styles.spotlightSection}>
        <View style={styles.spotlightHeader}>
          <Text style={styles.spotlightTitle}>🆓 Free This Week</Text>
          <TouchableOpacity onPress={() => setSelectedVibe('free')}>
            <Text style={styles.seeAllText}>See all →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.spotlightScroll}
        >
          {freeEvents.slice(0, 5).map((event) => (
            <TouchableOpacity 
              key={event.id} 
              style={styles.spotlightCard}
              onPress={() => handleEventPress(event)}
            >
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>FREE</Text>
              </View>
              <Text style={styles.spotlightCardTitle} numberOfLines={2}>
                {event.title || 'Event'}
              </Text>
              <Text style={styles.spotlightCardLocation} numberOfLines={1}>
                {'📍 '}{event.venue?.city || 'Florida'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.logo}>🎉 Eventgasm</Text>
      <Text style={styles.tagline}>Find the fun. Skip the search.</Text>
      
      <SearchBar onSearch={setSearchQuery} initialValue={searchQuery} />

      {/* Location Picker */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.cityScroll}
      >
        {LOCATIONS.map(loc => (
          <TouchableOpacity
            key={loc.name}
            style={[
              styles.cityChip,
              selectedLocation?.name === loc.name && styles.cityChipSelected
            ]}
            onPress={() => handleLocationSelect(loc)}
          >
            <Text style={[
              styles.cityChipText,
              selectedLocation?.name === loc.name && styles.cityChipTextSelected
            ]}>
              {loc.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Vibe Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.vibeScroll}
      >
        {VIBES.map(vibe => (
          <TouchableOpacity
            key={vibe.id}
            style={[
              styles.vibeChip,
              selectedVibe === vibe.id && styles.vibeChipSelected,
              vibe.id === 'free' && styles.vibeChipFree
            ]}
            onPress={() => setSelectedVibe(vibe.id)}
          >
            <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
            <Text style={[
              styles.vibeChipText,
              selectedVibe === vibe.id && styles.vibeChipTextSelected
            ]}>
              {vibe.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Free Events Spotlight */}
      {renderFreeSpotlight()}
    </View>
  );

  if (loading && events.length === 0) {
    return (
      <View style={styles.centered}>
        {renderHeader()}
        <ActivityIndicator size="large" color="#667eea" style={{ marginTop: 40 }} />
        <Text style={styles.loadingText}>Finding amazing events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EventCard event={item} onPress={handleEventPress} />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>No events found</Text>
            <Text style={styles.emptySubtext}>Try a different vibe or location</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.footerLoader} color="#667eea" />
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 8,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  cityScroll: {
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  cityChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
  },
  cityChipSelected: {
    backgroundColor: '#667eea',
  },
  cityChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  cityChipTextSelected: {
    color: '#fff',
  },
  vibeScroll: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  vibeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
  },
  vibeChipSelected: {
    backgroundColor: '#1a1a1a',
  },
  vibeChipFree: {
    backgroundColor: '#e8f5e9',
  },
  vibeEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  vibeChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  vibeChipTextSelected: {
    color: '#fff',
  },
  // Spotlight Section
  spotlightSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  spotlightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  spotlightTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  seeAllText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  spotlightScroll: {
    paddingHorizontal: 12,
  },
  spotlightCard: {
    width: 160,
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
  },
  freeBadge: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  freeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  spotlightCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    lineHeight: 18,
  },
  spotlightCardLocation: {
    fontSize: 12,
    color: '#666',
  },
  listContent: {
    paddingBottom: 100,
  },
  loadingText: {
    marginTop: 16,
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  footerLoader: {
    paddingVertical: 20,
  },
});
