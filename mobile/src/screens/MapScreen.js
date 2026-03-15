/**
 * MapScreen - Dynamic event map with bounding box queries
 * 
 * Features:
 * - Fetches events based on visible map region
 * - Debounced region change handler
 * - Category color-coded markers
 * - Filter support
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
import MapView, { Marker, Callout } from 'react-native-maps';
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

export default function MapScreen({ navigation, route }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [region, setRegion] = useState({
    latitude: 39.8283,  // Center of US
    longitude: -98.5795,
    latitudeDelta: 30,
    longitudeDelta: 30,
  });
  const [filters, setFilters] = useState({
    category: route?.params?.category || null,
    startDate: route?.params?.startDate || null,
    endDate: route?.params?.endDate || null,
  });
  
  const mapRef = useRef(null);
  const debounceTimer = useRef(null);

  useEffect(() => {
    loadInitialLocation();
  }, []);

  const loadInitialLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const userRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        };
        setRegion(userRegion);
        fetchEventsInRegion(userRegion);
      } else {
        // Use default US view
        fetchEventsInRegion(region);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      fetchEventsInRegion(region);
    }
  };

  const fetchEventsInRegion = useCallback(async (mapRegion) => {
    setFetching(true);
    try {
      // Calculate bounding box from region
      const minLat = mapRegion.latitude - mapRegion.latitudeDelta / 2;
      const maxLat = mapRegion.latitude + mapRegion.latitudeDelta / 2;
      const minLng = mapRegion.longitude - mapRegion.longitudeDelta / 2;
      const maxLng = mapRegion.longitude + mapRegion.longitudeDelta / 2;

      const params = {
        min_lat: minLat.toFixed(4),
        max_lat: maxLat.toFixed(4),
        min_lng: minLng.toFixed(4),
        max_lng: maxLng.toFixed(4),
        limit: 500,
      };

      if (filters.category) params.category = filters.category;
      if (filters.startDate) params.start_date = filters.startDate;
      if (filters.endDate) params.end_date = filters.endDate;

      const response = await api.get('/events', { params, timeout: 45000 });
      
      if (response.data.success) {
        // Filter events that have valid coordinates (check both formats)
        const eventsWithCoords = (response.data.events || [])
          .filter(e => 
            (e.latitude && e.longitude) || 
            (e.venue?.coordinates?.lat && e.venue?.coordinates?.lng)
          )
          .map(e => ({
            ...e,
            // Normalize coordinates to top level
            latitude: e.latitude || e.venue?.coordinates?.lat,
            longitude: e.longitude || e.venue?.coordinates?.lng,
          }));
        setEvents(eventsWithCoords);
      }
    } catch (error) {
      console.error('Error fetching map events:', error);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [filters]);

  // Debounced region change handler
  const handleRegionChangeComplete = useCallback((newRegion) => {
    setRegion(newRegion);
    
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new debounced fetch
    debounceTimer.current = setTimeout(() => {
      fetchEventsInRegion(newRegion);
    }, 500); // 500ms debounce
  }, [fetchEventsInRegion]);

  const handleMarkerPress = (event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('EventDetail', { event });
  };

  const getCategoryColor = (category) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
  };

  const formatEventDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM d, h:mm a');
    } catch {
      return '';
    }
  };

  const goToUserLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const location = await Location.getCurrentPositionAsync({});
      const userRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      };
      mapRef.current?.animateToRegion(userRegion, 500);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
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
        {events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: parseFloat(event.latitude),
              longitude: parseFloat(event.longitude),
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
                {event.is_free && (
                  <Text style={styles.calloutFree}>FREE</Text>
                )}
                <Text style={styles.calloutTap}>Tap for details →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.countBadge}>
          {fetching ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.countText}>
              {events.length} {events.length === 500 ? '+' : ''} events
            </Text>
          )}
        </View>

        <TouchableOpacity 
          style={styles.locationButton}
          onPress={goToUserLocation}
        >
          <Ionicons name="locate" size={22} color={colors.primary} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#e91e63' }]} />
            <Text style={styles.legendText}>Music</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
            <Text style={styles.legendText}>Sports</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9c27b0' }]} />
            <Text style={styles.legendText}>Arts</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
            <Text style={styles.legendText}>Festival</Text>
          </View>
        </View>
      </View>

      {/* Zoom hint when zoomed out */}
      {region.latitudeDelta > 10 && events.length >= 500 && (
        <View style={styles.zoomHint}>
          <Text style={styles.zoomHintText}>
            Zoom in to see more events
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.subheadline,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  countBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    minWidth: 100,
    alignItems: 'center',
    ...shadows.md,
  },
  countText: {
    ...typography.subheadlineBold,
    color: colors.textInverse,
  },
  locationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  callout: {
    width: 220,
  },
  calloutContent: {
    padding: spacing.sm,
  },
  calloutTitle: {
    ...typography.headline,
    marginBottom: spacing.xs,
  },
  calloutDate: {
    ...typography.subheadline,
    color: colors.info,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  calloutVenue: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  calloutFree: {
    ...typography.caption1,
    fontWeight: '700',
    color: colors.swipeGoing,
    marginBottom: spacing.xs,
  },
  calloutTap: {
    ...typography.caption2,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  legend: {
    position: 'absolute',
    bottom: 40,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs,
  },
  legendText: {
    ...typography.caption1,
    color: colors.textSecondary,
  },
  zoomHint: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  zoomHintText: {
    ...typography.caption1,
    color: colors.textInverse,
  },
});
