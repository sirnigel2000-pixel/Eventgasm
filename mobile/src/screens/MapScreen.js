/**
 * MapScreen - Interactive map with state bubbles, markers, and list view
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { MapView, Marker } from '../components/CrossPlatformMap';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Haptics from '../utils/haptics';
import api from '../services/api';
import { colors, shadows } from '../theme';
import { format } from 'date-fns';

const { width, height } = Dimensions.get('window');

const CATEGORY_COLORS = {
  'Music': '#e91e63', 'Concert': '#e91e63', 'Sports': '#34C759',
  'Arts & Theatre': '#9c27b0', 'Arts': '#9c27b0', 'Theater': '#9c27b0',
  'Comedy': '#FF9500', 'Food & Drink': '#795548', 'Food': '#795548',
  'Family': '#007AFF', 'Festival': '#FF3B30', 'Festivals': '#FF3B30',
  'Community': '#5856D6', 'default': colors.primary,
};

const CATEGORIES = [
  { key: 'All', icon: 'apps', label: 'All' },
  { key: 'Music', icon: 'musical-notes', label: 'Music' },
  { key: 'Sports', icon: 'football', label: 'Sports' },
  { key: 'Arts', icon: 'color-palette', label: 'Arts' },
  { key: 'Comedy', icon: 'happy', label: 'Comedy' },
  { key: 'Food', icon: 'restaurant', label: 'Food' },
  { key: 'Family', icon: 'people', label: 'Family' },
  { key: 'Festival', icon: 'bonfire', label: 'Festival' },
];

const STATE_VIEW_THRESHOLD = 4;

export default function MapScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [stateCounts, setStateCounts] = useState([]);
  const [region, setRegion] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [viewMode, setViewMode] = useState('states');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showList, setShowList] = useState(false);
  const [highlightedEventId, setHighlightedEventId] = useState(null);
  
  const mapRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    loadStateCounts();
    initializeLocation();
  }, []);

  const loadStateCounts = async () => {
    try {
      // Use longer timeout for this slow query
      const response = await api.get('/events/counts/by-state', { timeout: 90000 });
      if (response.data.success) {
        setStateCounts(response.data.states || []);
      }
    } catch (error) {
      console.error('Error loading state counts:', error);
      // Set empty array to prevent crash, map will still work without bubbles
      setStateCounts([]);
    }
  };

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 6,
          longitudeDelta: 6,
        });
      } else {
        setRegion({
          latitude: 39.8283,
          longitude: -98.5795,
          latitudeDelta: 40,
          longitudeDelta: 40,
        });
      }
    } catch (e) {
      setRegion({
        latitude: 39.8283,
        longitude: -98.5795,
        latitudeDelta: 40,
        longitudeDelta: 40,
      });
    }
  };

  const handleRegionChangeComplete = useCallback((newRegion) => {
    setRegion(newRegion);
    
    if (newRegion.latitudeDelta > STATE_VIEW_THRESHOLD) {
      setViewMode('states');
      setEvents([]);
      setShowList(false);
    } else {
      setViewMode('events');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchEventsInRegion(newRegion), 250);
    }
  }, [selectedCategory]);

  const fetchEventsInRegion = async (mapRegion) => {
    setFetching(true);
    try {
      const padding = 0.1;
      const params = {
        min_lat: (mapRegion.latitude - mapRegion.latitudeDelta / 2 - padding).toFixed(4),
        max_lat: (mapRegion.latitude + mapRegion.latitudeDelta / 2 + padding).toFixed(4),
        min_lng: (mapRegion.longitude - mapRegion.longitudeDelta / 2 - padding).toFixed(4),
        max_lng: (mapRegion.longitude + mapRegion.longitudeDelta / 2 + padding).toFixed(4),
        limit: mapRegion.latitudeDelta < 1 ? 300 : 200,
      };

      if (selectedCategory !== 'All') {
        params.category = selectedCategory;
      }

      const response = await api.get('/events', { params, timeout: 15000 });
      
      if (response.data.success) {
        const eventsWithCoords = (response.data.events || [])
          .map(e => {
            // Get coordinates from top-level or venue.coordinates
            const lat = e.latitude || e.venue?.coordinates?.lat;
            const lng = e.longitude || e.venue?.coordinates?.lng;
            if (!lat || !lng) return null;
            return {
              ...e,
              latitude: parseFloat(lat),
              longitude: parseFloat(lng),
            };
          })
          .filter(Boolean);
        setEvents(eventsWithCoords);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setFetching(false);
    }
  };

  // Sort events by distance from user
  const sortedEvents = useMemo(() => {
    if (!userLocation) return events;
    return [...events].sort((a, b) => {
      const distA = Math.sqrt(
        Math.pow(a.latitude - userLocation.latitude, 2) + 
        Math.pow(a.longitude - userLocation.longitude, 2)
      );
      const distB = Math.sqrt(
        Math.pow(b.latitude - userLocation.latitude, 2) + 
        Math.pow(b.longitude - userLocation.longitude, 2)
      );
      return distA - distB;
    });
  }, [events, userLocation]);

  const handleStatePress = (state) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mapRef.current?.animateToRegion({
      latitude: state.lat,
      longitude: state.lng,
      latitudeDelta: 2.5,
      longitudeDelta: 2.5,
    }, 400);
  };

  const handleEventPress = (event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('EventDetail', { event });
  };

  // Focus on event and highlight it
  const focusOnEvent = (event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHighlightedEventId(event.id);
    mapRef.current?.animateToRegion({
      latitude: event.latitude,
      longitude: event.longitude,
      latitudeDelta: 0.3,
      longitudeDelta: 0.3,
    }, 300);
    
    // Clear highlight after 3 seconds
    setTimeout(() => setHighlightedEventId(null), 3000);
  };

  const handleCategorySelect = (cat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(cat);
    if (region && viewMode === 'events') {
      fetchEventsInRegion(region);
    }
  };

  const getColor = (cat) => CATEGORY_COLORS[cat] || CATEGORY_COLORS.default;
  
  const formatDate = (d) => {
    if (!d) return '';
    try {
      return format(new Date(d), 'MMM d · h:mm a');
    } catch (e) {
      return '';
    }
  };
  
  const formatCount = (c) => c >= 1000 ? `${(c/1000).toFixed(1)}k` : c.toString();
  
  const getBubbleSize = (count) => {
    const max = Math.max(...stateCounts.map(s => s.count), 1);
    return 35 + 35 * Math.sqrt(count / max);
  };

  const totalEvents = stateCounts.reduce((sum, s) => sum + s.count, 0);

  const renderEventItem = ({ item, index }) => {
    const isHighlighted = item.id === highlightedEventId;
    return (
      <TouchableOpacity 
        style={[styles.eventItem, isHighlighted && styles.eventItemHighlighted]} 
        onPress={() => focusOnEvent(item)}
      >
        <View style={[styles.categoryDot, { backgroundColor: getColor(item.category) }]} />
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.eventMeta}>{formatDate(item.start_time)}</Text>
          {item.venue?.name && <Text style={styles.eventVenue} numberOfLines={1}>📍 {item.venue.name}</Text>}
        </View>
        <TouchableOpacity 
          style={styles.goButton}
          onPress={() => handleEventPress(item)}
        >
          <Text style={styles.goButtonText}>View</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Handle list scroll to focus on visible events
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0 && showList) {
      const firstVisible = viewableItems[0].item;
      if (firstVisible && firstVisible.latitude && firstVisible.longitude) {
        mapRef.current?.animateToRegion({
          latitude: firstVisible.latitude,
          longitude: firstVisible.longitude,
          latitudeDelta: region?.latitudeDelta || 0.5,
          longitudeDelta: region?.longitudeDelta || 0.5,
        }, 200);
        setHighlightedEventId(firstVisible.id);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 300,
  }).current;

  if (!region) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={[styles.map, showList && styles.mapWithList]}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsCompass={false}
      >
        {/* State bubbles */}
        {viewMode === 'states' && stateCounts.map((state) => (
          <Marker
            key={state.state}
            coordinate={{ latitude: state.lat, longitude: state.lng }}
            onPress={() => handleStatePress(state)}
          >
            <View style={[styles.bubble, { 
              width: getBubbleSize(state.count),
              height: getBubbleSize(state.count),
              borderRadius: getBubbleSize(state.count) / 2,
            }]}>
              <Text style={styles.bubbleCount}>{formatCount(state.count)}</Text>
            </View>
          </Marker>
        ))}

        {/* Event markers */}
        {viewMode === 'events' && events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.latitude, longitude: event.longitude }}
            onPress={() => handleEventPress(event)}
          >
            <View style={[
              styles.eventMarker,
              { backgroundColor: getColor(event.category) },
              event.id === highlightedEventId && styles.eventMarkerHighlighted
            ]}>
              <View style={styles.markerDot} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Top status bar */}
      <View style={styles.topBar}>
        <Text style={styles.statusText}>
          {viewMode === 'states' 
            ? `${totalEvents.toLocaleString()} events · ${stateCounts.length} states`
            : `${events.length} events nearby`}
        </Text>
        {fetching && <ActivityIndicator size="small" color={colors.primary} style={{marginLeft: 8}} />}
      </View>

      {/* Category filter bar */}
      {viewMode === 'events' && (
        <View style={styles.filterBar}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={CATEGORIES}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterPill, 
                  selectedCategory === item.key && styles.filterPillActive
                ]}
                onPress={() => handleCategorySelect(item.key)}
              >
                <Ionicons 
                  name={item.icon} 
                  size={14} 
                  color={selectedCategory === item.key ? '#fff' : colors.text} 
                  style={styles.filterIcon}
                />
                <Text style={[
                  styles.filterText, 
                  selectedCategory === item.key && styles.filterTextActive
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Floating action buttons */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            mapRef.current?.animateToRegion({
              latitude: 39.8283,
              longitude: -98.5795,
              latitudeDelta: 40,
              longitudeDelta: 40,
            }, 400);
          }}
        >
          <Ionicons name="globe-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            if (userLocation) {
              mapRef.current?.animateToRegion({
                ...userLocation,
                latitudeDelta: 0.5,
                longitudeDelta: 0.5,
              }, 400);
            }
          }}
        >
          <Ionicons name="locate" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* BIG List toggle button - prominent! */}
      {viewMode === 'events' && (
        <TouchableOpacity
          style={[styles.listToggle, showList && styles.listToggleActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowList(!showList);
          }}
        >
          <Ionicons 
            name={showList ? "map" : "list"} 
            size={20} 
            color={showList ? '#fff' : colors.primary} 
          />
          <Text style={[styles.listToggleText, showList && styles.listToggleTextActive]}>
            {showList ? 'Map' : `List (${events.length})`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Event list panel */}
      {viewMode === 'events' && showList && (
        <View style={styles.listPanel}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              📍 {sortedEvents.length} Events {userLocation ? '· Closest First' : ''}
            </Text>
          </View>
          
          <FlatList
            ref={listRef}
            data={sortedEvents}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderEventItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  mapWithList: { height: height * 0.4 },
  
  topBar: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  statusText: { fontSize: 14, fontWeight: '600', color: colors.text },
  
  filterBar: {
    position: 'absolute',
    top: 108,
    left: 0,
    right: 0,
  },
  filterList: {
    paddingHorizontal: 12,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    marginHorizontal: 4,
    ...shadows.sm,
  },
  filterPillActive: { 
    backgroundColor: colors.primary,
  },
  filterIcon: {
    marginRight: 4,
  },
  filterText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  
  controls: {
    position: 'absolute',
    right: 16,
    top: 170,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
    marginBottom: 10,
  },
  
  // Big prominent list toggle
  listToggle: {
    position: 'absolute',
    bottom: 100,
    left: '50%',
    marginLeft: -70,
    width: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    ...shadows.lg,
  },
  listToggleActive: {
    backgroundColor: colors.primary,
  },
  listToggleText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  listToggleTextActive: {
    color: '#fff',
  },
  
  bubble: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  bubbleCount: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  // Custom event markers
  eventMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  eventMarkerHighlighted: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    transform: [{ scale: 1.2 }],
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  
  listPanel: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    ...shadows.lg,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  listTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  eventItemHighlighted: {
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  eventMeta: { fontSize: 12, color: colors.primary, marginTop: 2 },
  eventVenue: { fontSize: 11, color: '#888', marginTop: 2 },
  
  goButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  goButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
