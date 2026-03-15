import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { fetchEvents } from '../services/api';
import CategoryPlaceholder from '../components/CategoryPlaceholder';
import EventCard from '../components/EventCard';
import SearchBar from '../components/SearchBar';
import SkeletonCard from '../components/SkeletonCard';
import { getRecommendedEvents, getTopCategories } from '../services/recommendations';
import { useAuth } from '../context/AuthContext';
import haptics from '../utils/haptics';

const { width } = Dimensions.get('window');

const VIBES = [
  { id: 'all', name: 'All', emoji: '✨' },
  { id: 'free', name: 'Free', emoji: '🆓' },
  { id: 'music', name: 'Music', emoji: '🎵' },
  { id: 'food', name: 'Food & Drink', emoji: '🍻' },
  { id: 'cultural', name: 'Cultural', emoji: '🌍' },
  { id: 'festivals', name: 'Festivals', emoji: '🎪' },
  { id: 'sports', name: 'Sports', emoji: '⚽' },
  { id: 'arts', name: 'Arts', emoji: '🎨' },
  { id: 'comedy', name: 'Comedy', emoji: '😂' },
  { id: 'community', name: 'Local', emoji: '🏘️' },
  { id: 'family', name: 'Family', emoji: '👨‍👩‍👧' },
];

// Date range filters
const DATE_FILTERS = [
  { id: 'all', name: 'Any Date', emoji: '📅' },
  { id: 'today', name: 'Today', emoji: '🌟' },
  { id: 'tomorrow', name: 'Tomorrow', emoji: '☀️' },
  { id: 'weekend', name: 'This Weekend', emoji: '🎉' },
  { id: 'week', name: 'This Week', emoji: '📆' },
  { id: 'month', name: 'This Month', emoji: '🗓️' },
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
  const { user, isSignedIn } = useAuth();
  const [events, setEvents] = useState([]);
  const [freeEvents, setFreeEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationCoords, setLocationCoords] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFreeSection, setShowFreeSection] = useState(true);
  const [recommendedEvents, setRecommendedEvents] = useState([]);
  const [userTopCategories, setUserTopCategories] = useState([]);

  // Load free events for the spotlight section (respects current filters)
  const loadFreeEvents = useCallback(async () => {
    try {
      const params = {
        free: 'true',
        limit: 10,
      };
      
      // Apply location filter
      if (locationCoords) {
        params.lat = locationCoords.lat;
        params.lng = locationCoords.lng;
        params.radius = 50;
      }
      
      // Apply date filter
      if (selectedDateFilter !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (selectedDateFilter === 'today') {
          params.start_date = today.toISOString();
          params.end_date = new Date(today.getTime() + 24*60*60*1000).toISOString();
        } else if (selectedDateFilter === 'weekend') {
          const dayOfWeek = today.getDay();
          const saturday = new Date(today.getTime() + ((6 - dayOfWeek) % 7) * 24*60*60*1000);
          const monday = new Date(saturday.getTime() + 2*24*60*60*1000);
          params.start_date = saturday.toISOString();
          params.end_date = monday.toISOString();
        } else if (selectedDateFilter === 'week') {
          params.start_date = today.toISOString();
          params.end_date = new Date(today.getTime() + 7*24*60*60*1000).toISOString();
        }
      }
      
      const data = await fetchEvents(params);
      setFreeEvents(data.events || []);
    } catch (error) {
      console.error('Failed to load free events:', error);
    }
  }, [locationCoords, selectedDateFilter]);

  const loadRecommendedEvents = useCallback(async () => {
    try {
      const params = { limit: 50 };
      
      // Apply location filter
      if (locationCoords) {
        params.lat = locationCoords.lat;
        params.lng = locationCoords.lng;
        params.radius = 50;
      }
      
      // Apply category filter from vibe
      if (selectedVibe !== 'all' && selectedVibe !== 'free') {
        const vibeToCategory = {
          'music': 'Music',
          'food': 'Food & Drink',
          'cultural': 'Cultural',
          'festivals': 'Festivals',
          'sports': 'Sports',
          'arts': 'Arts & Theatre',
          'comedy': 'Comedy',
          'family': 'Family & Kids',
          'community': null, // handled by source
        };
        if (vibeToCategory[selectedVibe]) {
          params.category = vibeToCategory[selectedVibe];
        }
        if (selectedVibe === 'community') {
          params.source = 'allevents';
        }
      }
      
      // Apply date filter
      if (selectedDateFilter !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (selectedDateFilter === 'today') {
          params.start_date = today.toISOString();
          params.end_date = new Date(today.getTime() + 24*60*60*1000).toISOString();
        } else if (selectedDateFilter === 'weekend') {
          const dayOfWeek = today.getDay();
          const saturday = new Date(today.getTime() + ((6 - dayOfWeek) % 7) * 24*60*60*1000);
          const monday = new Date(saturday.getTime() + 2*24*60*60*1000);
          params.start_date = saturday.toISOString();
          params.end_date = monday.toISOString();
        } else if (selectedDateFilter === 'week') {
          params.start_date = today.toISOString();
          params.end_date = new Date(today.getTime() + 7*24*60*60*1000).toISOString();
        }
      }
      
      const data = await fetchEvents(params);
      const allEvents = data.events || [];
      
      // Get personalized recommendations from filtered results
      const recommended = await getRecommendedEvents(allEvents, 8);
      setRecommendedEvents(recommended);
      
      // Get user's top categories for display
      const topCats = await getTopCategories(3);
      setUserTopCategories(topCats);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  }, [locationCoords, selectedVibe, selectedDateFilter]);

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
          'cultural': 'Cultural',
          'festivals': 'Festivals',
          'sports': 'Sports',
          'arts': 'Arts & Theatre',
          'comedy': 'Comedy',
          'family': 'Family & Kids',
        };
        if (vibeToCategory[selectedVibe]) {
          params.category = vibeToCategory[selectedVibe];
        }
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      // Add date filter
      if (selectedDateFilter !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (selectedDateFilter) {
          case 'today':
            params.start_date = today.toISOString();
            params.end_date = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'tomorrow':
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
            params.start_date = tomorrow.toISOString();
            params.end_date = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'weekend':
            const dayOfWeek = now.getDay();
            const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
            const saturday = new Date(today.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
            const monday = new Date(saturday.getTime() + 2 * 24 * 60 * 60 * 1000);
            params.start_date = dayOfWeek === 0 || dayOfWeek === 6 ? today.toISOString() : saturday.toISOString();
            params.end_date = monday.toISOString();
            break;
          case 'week':
            params.start_date = today.toISOString();
            params.end_date = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'month':
            params.start_date = today.toISOString();
            params.end_date = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
            break;
        }
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
  }, [page, selectedVibe, locationCoords, searchQuery, selectedDateFilter]);

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

  // Track if this is the initial mount
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip the very first render (initial mount handles its own load)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // Initial load
      setLoading(true);
      Promise.all([
        loadEvents(true),
        loadFreeEvents(),
        loadRecommendedEvents()
      ]).finally(() => setLoading(false));
      return;
    }

    // Subsequent filter changes
    setLoading(true);
    setPage(1);
    Promise.all([
      loadEvents(true),
      loadFreeEvents(),
      loadRecommendedEvents()
    ]).finally(() => setLoading(false));
  }, [selectedVibe, locationCoords, selectedDateFilter, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadEvents(true), loadFreeEvents(), loadRecommendedEvents()]);
    setRefreshing(false);
  }, [loadEvents, loadFreeEvents, loadRecommendedEvents]);

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
  const renderForYou = () => {
    if (recommendedEvents.length === 0) {
      return null;
    }

    return (
      <View style={styles.forYouSection}>
        <View style={styles.spotlightHeader}>
          <View>
            <Text style={styles.spotlightTitle}>✨ For You</Text>
            {userTopCategories.length > 0 && (
              <Text style={styles.forYouSubtitle}>
                Based on your love of {userTopCategories.slice(0, 2).join(' & ')}
              </Text>
            )}
          </View>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.spotlightScroll}
        >
          {recommendedEvents.map((event) => (
            <TouchableOpacity 
              key={event.id} 
              style={styles.forYouCard}
              onPress={() => handleEventPress(event)}
            >
              {event.image ? (
                <Image 
                  source={event.image}
                  style={styles.forYouImage}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                />
              ) : (
                <CategoryPlaceholder 
                  category={event.category}
                  title={event.title}
                  style={styles.forYouImage}
                />
              )}
              <View style={styles.forYouContent}>
                <Text style={styles.forYouCategory}>{event.category}</Text>
                <Text style={styles.forYouTitle} numberOfLines={2}>
                  {event.title}
                </Text>
                <Text style={styles.forYouMeta}>
                  {event.isFree ? '🆓 Free' : event.price?.min ? `From $${Math.round(event.price.min)}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

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
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.logo}>🎉 Eventgasm</Text>
          <Text style={styles.tagline}>Find the fun. Skip the search.</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={() => navigation.navigate('Map')}
          >
            <Text style={styles.mapButtonIcon}>🗺️</Text>
            <Text style={styles.mapButtonText}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            {isSignedIn ? (
              <Text style={styles.profileAvatar}>
                {user?.name?.charAt(0)?.toUpperCase() || '👤'}
              </Text>
            ) : (
              <Text style={styles.profileIcon}>👤</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
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
            onPress={() => {
              haptics.selection();
              setSelectedVibe(vibe.id);
            }}
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

      {/* Date Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.dateScroll}
      >
        {DATE_FILTERS.map(df => (
          <TouchableOpacity
            key={df.id}
            style={[
              styles.dateChip,
              selectedDateFilter === df.id && styles.dateChipSelected
            ]}
            onPress={() => {
              haptics.selection();
              setSelectedDateFilter(df.id);
            }}
          >
            <Text style={styles.dateEmoji}>{df.emoji}</Text>
            <Text style={[
              styles.dateChipText,
              selectedDateFilter === df.id && styles.dateChipTextSelected
            ]}>
              {df.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* For You Section */}
      {renderForYou()}

      {/* Free Events Spotlight */}
      {renderFreeSpotlight()}
    </View>
  );

  if (loading && events.length === 0) {
    return (
      <ScrollView style={styles.container}>
        {renderHeader()}
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={({ item }) => (
          <EventCard event={item} onPress={handleEventPress} />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={styles.emptyText}>No events found</Text>
            <Text style={styles.emptySubtext}>
              {selectedVibe === 'free' 
                ? "No free events in this area right now. Try expanding your search!"
                : selectedDateFilter !== 'all'
                ? "Nothing scheduled for this time. Try a different date range!"
                : "Try a different location or category to discover more events."}
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => {
                setSelectedVibe('all');
                setSelectedDateFilter('all');
                setSelectedLocation(null);
                setLocationCoords(null);
              }}
            >
              <Text style={styles.emptyButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.footerLoader} color="#667eea" />
          ) : null
        }
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#667eea"
            colors={['#667eea']}
            title="Pull to refresh"
            titleColor="#888"
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={8}
        updateCellsBatchingPeriod={50}
        getItemLayout={(data, index) => ({
          length: 320, // Approximate card height
          offset: 320 * index,
          index,
        })}
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  mapButtonIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIcon: {
    fontSize: 18,
  },
  profileAvatar: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
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
  // Date Filters
  dateScroll: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateChipSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  dateEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  dateChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  dateChipTextSelected: {
    color: '#fff',
  },
  // For You Section
  forYouSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  forYouSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  forYouCard: {
    width: 180,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  forYouImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#f0f0f0',
  },
  forYouContent: {
    padding: 10,
  },
  forYouCategory: {
    fontSize: 10,
    color: '#667eea',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  forYouTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    lineHeight: 17,
  },
  forYouMeta: {
    fontSize: 11,
    color: '#888',
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
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 20,
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
  },
});
