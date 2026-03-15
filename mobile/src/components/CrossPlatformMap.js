/**
 * CrossPlatformMap - Works on iOS, Android, and Web
 */
import React, { forwardRef } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

// Web uses a different map library
let MapView, Marker;

if (Platform.OS === 'web') {
  // Web placeholder - TODO: integrate with Google Maps or Leaflet
  MapView = forwardRef(({ children, style, onRegionChangeComplete, initialRegion, ...props }, ref) => {
    return (
      <View style={[styles.webMap, style]}>
        <Text style={styles.webMapText}>🗺️ Map View</Text>
        <Text style={styles.webMapSubtext}>
          {initialRegion ? `${initialRegion.latitude.toFixed(2)}, ${initialRegion.longitude.toFixed(2)}` : 'Loading...'}
        </Text>
        {children}
      </View>
    );
  });
  
  Marker = ({ children, coordinate, onPress }) => {
    return (
      <View style={styles.webMarker} onClick={onPress}>
        {children || <Text>📍</Text>}
      </View>
    );
  };
} else {
  // Native uses react-native-maps
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
}

const styles = StyleSheet.create({
  webMap: {
    flex: 1,
    backgroundColor: '#e8f4f8',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  webMapText: {
    fontSize: 48,
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  webMarker: {
    padding: 4,
  },
});

export { MapView, Marker };
export default MapView;
