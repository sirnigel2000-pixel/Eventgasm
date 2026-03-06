import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions
} from 'react-native';
import * as Location from 'expo-location';
import { fetchEvents } from '../services/api';
import EventCard from '../components/EventCard';

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

const FL_CITIES = [
  { name: 'All Florida', value: null },
  { name: 'Miami', value: 'Miami' },
  { name: 'Orlando', value: 'Orlando' },
  { name: 'Tampa', value: 'Tampa' },
  { name: 'Jacksonville', value: 'Jacksonville' },
  { name: 'Fort Lauderdale', value: 'Fort Lauderdale' },
  { name: 'West Palm Beach', value: 'West Palm Beach' },
];

export default function HomeScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [freeEvents, setFreeEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState('all');
  const [selectedCity, setSelectedCity] = useState(null);
  const [location, setLocation] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFreeSection, setShowFreeSection] = useState(true);

  // Load free events for the spotlight section
  const loadFreeEvents = useCallback(async () => {
    try {
      const data = await fetchEvents({
        state: 'FL',
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
        state: 'FL',
      };

      if (selectedCity) {
        params.city = selectedCity;
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

      if (location) {
        params.lat = location.coords.latitude;
        params.lng = location.coords.longitude;
        params.radius = 50;
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
  }, [page, selectedVibe, selectedCity, location, searchQuery]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      }
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    Promise.all([
      loadEvents(true),
      loadFreeEvents()
    ]).finally(() => setLoading(false));
  }, [selectedVibe, selectedCity]);

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
                {event.title}
              </Text>
              <Text style={styles.spotlightCardLocation} numberOfLines={1}>
                📍 {event.venue?.city || 'Florida'}
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
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search events, venues, artists..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      {/* City Picker */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.cityScroll}
      >
        {FL_CITIES.map(city => (
          <TouchableOpacity
            key={city.name}
            style={[
              styles.cityChip,
              selectedCity === city.value && styles.cityChipSelected
            ]}
            onPress={() => setSelectedCity(city.value)}
          >
            <Text style={[
              styles.cityChipText,
              selectedCity === city.value && styles.cityChipTextSelected
            ]}>
              {city.name}
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
