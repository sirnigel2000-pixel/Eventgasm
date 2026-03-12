import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { fetchEvents } from '../services/api';
import { formatEventDate } from '../utils/formatters';

const { width, height } = Dimensions.get('window');

export default function MapScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState({
    latitude: 28.5383,  // Default to Orlando
    longitude: -81.3792,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  });
  const mapRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Try to get user location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.3,
          longitudeDelta: 0.3,
        });
        
        // Fetch events near user
        const data = await fetchEvents({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          radius: 50,
          limit: 100,
        });
        setEvents(data.events?.filter(e => e.venue?.coordinates) || []);
      } else {
        // Fetch default events
        const data = await fetchEvents({ limit: 100 });
        setEvents(data.events?.filter(e => e.venue?.coordinates) || []);
      }
    } catch (error) {
      console.error('Error loading map data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerPress = (event) => {
    navigation.navigate('EventDetail', { event });
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Music': '#e91e63',
      'Sports': '#4caf50',
      'Arts & Theatre': '#9c27b0',
      'Comedy': '#ff9800',
      'Food & Drink': '#795548',
      'Family': '#2196f3',
    };
    return colors[category] || '#667eea';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading events map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.venue.coordinates.lat,
              longitude: event.venue.coordinates.lng,
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
                  {formatEventDate(event.timing?.start)}
                </Text>
                <Text style={styles.calloutVenue} numberOfLines={1}>
                  📍 {event.venue?.name}
                </Text>
                {event.isFree && (
                  <Text style={styles.calloutFree}>FREE</Text>
                )}
                <Text style={styles.calloutTap}>Tap for details →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Back Button */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      {/* Event Count */}
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{events.length} events nearby</Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Categories</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#e91e63' }]} />
            <Text style={styles.legendText}>Music</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4caf50' }]} />
            <Text style={styles.legendText}>Sports</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9c27b0' }]} />
            <Text style={styles.legendText}>Arts</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#667eea' }]} />
            <Text style={styles.legendText}>Other</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  map: {
    width: width,
    height: height,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  backText: {
    fontSize: 24,
    color: '#333',
  },
  countBadge: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  countText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  callout: {
    width: 220,
  },
  calloutContent: {
    padding: 8,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  calloutDate: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 4,
  },
  calloutVenue: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  calloutFree: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4caf50',
    marginBottom: 4,
  },
  calloutTap: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  legend: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
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
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
});
