/**
 * MapScreen - State overview with drill-down to events
 * 
 * Features:
 * - Shows state bubbles with event counts when zoomed out
 * - Tap state to zoom in
 * - Shows clustered events when zoomed in
 * - Smooth transitions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Pressable,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import { colors, typography, borderRadius, spacing, shadows } from '../theme';
import { format } from 'date-fns';

const { width, height } = Dimensions.get('window');

const CATEGORY_COLORS = {
  'Music': '#e91e63',
  'Concert': '#e91e63',
  'Sports': '#34C759',
  'Arts & Theatre': '#9c27b0',
  'Arts': '#9c27b0',
  'Theater': '#9c27b0',
  'Comedy': '#FF9500',
  'Food & Drink': '#795548',
  'Food': '#795548',
  'Family': '#007AFF',
  'Festival': '#FF3B30',
  'Festivals': '#FF3B30',
  'Community': '#5856D6',
  'default': colors.primary,
};

// Zoom threshold - above this delta, show state view
const STATE_VIEW_THRESHOLD = 5;

export default function MapScreen({ navigation, route }) {
  const [events, setEvents] = useState([]);
  const [stateCounts, setStateCounts] = useState([]);
  const [region, setRegion] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [filters, setFilters] = useState({});
  const [viewMode, setViewMode] = useState('states'); // 'states' or 'events'
  const mapRef = useRef(null);
  const debounceRef = useRef(null);

  // Load state counts on mount
  useEffect(() => {
    loadStateCounts();
    initializeLocation();
  }, []);

  const loadStateCounts = async () => {
    try {
      const response = await api.get('/events/counts/by-state');
      if (response.data.success) {
        setStateCounts(response.data.states);
      }
    } catch (error) {
      console.error('Error loading state counts:', error);
    }
  };

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const userRegion = {
          latitude: 39.8283, // Start at US center to show all states
          longitude: -98.5795,
          latitudeDelta: 50,
          longitudeDelta: 60,
        };
        setRegion(userRegion);
      } else {
        // Default to US center - zoomed out enough to hint at HI/AK
        setRegion({
          latitude: 39.8283,
          longitude: -98.5795,
          latitudeDelta: 50,
          longitudeDelta: 60,
        });
      }
    } catch (error) {
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
    
    // Switch view mode based on zoom
    if (newRegion.latitudeDelta > STATE_VIEW_THRESHOLD) {
      setViewMode('states');
      setEvents([]); // Clear events when zoomed out
    } else {
      setViewMode('events');
      // Debounce event fetching
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchEventsInRegion(newRegion);
      }, 300);
    }
  }, []);

  const fetchEventsInRegion = async (mapRegion) => {
    setFetching(true);
    try {
      const minLat = mapRegion.latitude - mapRegion.latitudeDelta / 2;
      const maxLat = mapRegion.latitude + mapRegion.latitudeDelta / 2;
      const minLng = mapRegion.longitude - mapRegion.longitudeDelta / 2;
      const maxLng = mapRegion.longitude + mapRegion.longitudeDelta / 2;

      // Dynamic limit based on zoom
      let limit = 200;
      if (mapRegion.latitudeDelta < 0.5) limit = 400;
      else if (mapRegion.latitudeDelta < 2) limit = 300;

      const params = {
        min_lat: minLat.toFixed(4),
        max_lat: maxLat.toFixed(4),
        min_lng: minLng.toFixed(4),
        max_lng: maxLng.toFixed(4),
        limit,
      };

      const response = await api.get('/events', { params, timeout: 30000 });
      
      if (response.data.success) {
        const eventsWithCoords = (response.data.events || [])
          .filter(e => e.latitude && e.longitude)
          .map(e => ({
            ...e,
            latitude: parseFloat(e.latitude),
            longitude: parseFloat(e.longitude),
          }));
        setEvents(eventsWithCoords);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleStatePress = (state) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Zoom to state
    mapRef.current?.animateToRegion({
      latitude: state.lat,
      longitude: state.lng,
      latitudeDelta: 3,
      longitudeDelta: 3,
    }, 500);
  };

  const handleMarkerPress = (event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('EventDetail', { event });
  };

  const getCategoryColor = (category) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM d, h:mm a');
    } catch {
      return '';
    }
  };

  const formatCount = (count) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const getStateBubbleSize = (count) => {
    // Scale bubble size based on count
    const minSize = 40;
    const maxSize = 80;
    const maxCount = Math.max(...stateCounts.map(s => s.count), 1);
    const scale = Math.sqrt(count / maxCount);
    return minSize + (maxSize - minSize) * scale;
  };

  if (!region) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsCompass={false}
        rotateEnabled={false}
      >
        {/* State bubbles when zoomed out */}
        {viewMode === 'states' && stateCounts.map((state) => (
          <Marker
            key={state.state}
            coordinate={{ latitude: state.lat, longitude: state.lng }}
            onPress={() => handleStatePress(state)}
          >
            <View style={[
              styles.stateBubble,
              { 
                width: getStateBubbleSize(state.count),
                height: getStateBubbleSize(state.count),
                borderRadius: getStateBubbleSize(state.count) / 2,
              }
            ]}>
              <Text style={styles.stateCount}>{formatCount(state.count)}</Text>
              <Text style={styles.stateName} numberOfLines={1}>
                {state.state.length > 10 ? state.state.substring(0, 8) + '...' : state.state}
              </Text>
            </View>
          </Marker>
        ))}

        {/* Event markers when zoomed in */}
        {viewMode === 'events' && events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.latitude,
              longitude: event.longitude,
            }}
            pinColor={getCategoryColor(event.category)}
            onCalloutPress={() => handleMarkerPress(event)}
          >
            <Callout style={styles.callout}>
              <View style={styles.calloutContent}>
                <Text style={styles.calloutTitle} numberOfLines={2}>
                  {event.title}
                </Text>
                <Text style={styles.calloutDate}>
                  {formatEventDate(event.start_time)}
                </Text>
                {event.venue_name && (
                  <Text style={styles.calloutVenue} numberOfLines={1}>
                    📍 {event.venue_name}
                  </Text>
                )}
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Status bar */}
      <View style={styles.statusBar}>
        {fetching ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.statusText}>
            {viewMode === 'states' 
              ? `${stateCounts.reduce((sum, s) => sum + s.count, 0).toLocaleString()}+ events across ${stateCounts.length} states`
              : `${events.length} events nearby`
            }
          </Text>
        )}
      </View>

      {/* Zoom out button when viewing events */}
      {viewMode === 'events' && (
        <TouchableOpacity
          style={styles.zoomOutButton}
          onPress={() => {
            mapRef.current?.animateToRegion({
              latitude: 39.8283,
              longitude: -98.5795,
              latitudeDelta: 50,
              longitudeDelta: 60,
            }, 500);
          }}
        >
          <Ionicons name="globe-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* My location button */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={async () => {
          try {
            const location = await Location.getCurrentPositionAsync({});
            mapRef.current?.animateToRegion({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            }, 500);
          } catch {}
        }}
      >
        <Ionicons name="locate" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 16,
  },
  stateBubble: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  stateCount: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stateName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 9,
    marginTop: 1,
  },
  callout: {
    width: 200,
    padding: 8,
  },
  calloutContent: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  calloutDate: {
    fontSize: 12,
    color: colors.primary,
    marginBottom: 2,
  },
  calloutVenue: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statusBar: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    ...shadows.small,
  },
  statusText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  zoomOutButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  locationButton: {
    position: 'absolute',
    bottom: 160,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
});
