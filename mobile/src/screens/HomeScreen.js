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
  ScrollView
} from 'react-native';
import * as Location from 'expo-location';
import { fetchEvents } from '../services/api';
import EventCard from '../components/EventCard';

const CATEGORIES = ['All', 'Music', 'Sports', 'Arts', 'Comedy', 'Family', 'Other'];
const US_STATES = [
  { code: 'FL', name: 'Florida' },
  { code: 'CA', name: 'California' },
  { code: 'NY', name: 'New York' },
  { code: 'TX', name: 'Texas' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'GA', name: 'Georgia' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'OH', name: 'Ohio' },
  { code: 'IL', name: 'Illinois' },
  { code: 'AZ', name: 'Arizona' },
];

export default function HomeScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedState, setSelectedState] = useState('FL');
  const [location, setLocation] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadEvents = useCallback(async (reset = false) => {
    try {
      const currentPage = reset ? 1 : page;
      const params = {
        limit: 20,
        offset: (currentPage - 1) * 20,
        state: selectedState,
      };

      if (selectedCategory !== 'All') {
        params.category = selectedCategory;
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
  }, [page, selectedCategory, selectedState, location, searchQuery]);

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
    loadEvents(true).finally(() => setLoading(false));
  }, [selectedCategory, selectedState]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents(true);
    setRefreshing(false);
  }, [loadEvents]);

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

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.logo}>🎉 Eventgasm</Text>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search events..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.stateScroll}
      >
        {US_STATES.map(state => (
          <TouchableOpacity
            key={state.code}
            style={[
              styles.stateChip,
              selectedState === state.code && styles.stateChipSelected
            ]}
            onPress={() => setSelectedState(state.code)}
          >
            <Text style={[
              styles.stateChipText,
              selectedState === state.code && styles.stateChipTextSelected
            ]}>
              {state.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              selectedCategory === cat && styles.categoryChipSelected
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[
              styles.categoryChipText,
              selectedCategory === cat && styles.categoryChipTextSelected
            ]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (loading && events.length === 0) {
    return (
      <View style={styles.centered}>
        {renderHeader()}
        <ActivityIndicator size="large" color="#667eea" />
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
            <Text style={styles.emptySubtext}>Try a different category or location</Text>
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
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
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
  stateScroll: {
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  stateChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
  },
  stateChipSelected: {
    backgroundColor: '#667eea',
  },
  stateChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  stateChipTextSelected: {
    color: '#fff',
  },
  categoryScroll: {
    paddingHorizontal: 12,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
  },
  categoryChipSelected: {
    backgroundColor: '#1a1a1a',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#fff',
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
