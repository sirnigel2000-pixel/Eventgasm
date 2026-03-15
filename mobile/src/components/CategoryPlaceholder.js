/**
 * CategoryPlaceholder - Elegant gradient backgrounds for events without images
 * Apple-inspired minimal aesthetic
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Category configurations with gradients and icons
const CATEGORY_CONFIG = {
  // Music & Concerts
  Music: {
    gradient: ['#1a1a2e', '#16213e', '#0f3460'],
    icon: 'musical-notes',
    iconColor: 'rgba(255,255,255,0.15)',
  },
  Concert: {
    gradient: ['#1a1a2e', '#16213e', '#0f3460'],
    icon: 'musical-notes',
    iconColor: 'rgba(255,255,255,0.15)',
  },
  
  // Sports
  Sports: {
    gradient: ['#134e5e', '#1a5a4c', '#1d6b4a'],
    icon: 'football',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  Baseball: {
    gradient: ['#2d5a27', '#3a6b34', '#4a7c41'],
    icon: 'baseball',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  Basketball: {
    gradient: ['#c84b31', '#a13d2d', '#7d2e22'],
    icon: 'basketball',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  Football: {
    gradient: ['#134e5e', '#1a5a4c', '#1d6b4a'],
    icon: 'american-football',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  Hockey: {
    gradient: ['#2c3e50', '#34495e', '#415b76'],
    icon: 'snow',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  Soccer: {
    gradient: ['#1e3c72', '#2a5298', '#3867b0'],
    icon: 'football-outline',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  
  // Arts & Theater
  Arts: {
    gradient: ['#3c1053', '#4a1259', '#5c1a6b'],
    icon: 'color-palette',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  'Arts & Theatre': {
    gradient: ['#3c1053', '#4a1259', '#5c1a6b'],
    icon: 'color-palette',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  Theater: {
    gradient: ['#4a1c40', '#5c2751', '#6e3262'],
    icon: 'film',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  Theatre: {
    gradient: ['#4a1c40', '#5c2751', '#6e3262'],
    icon: 'film',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  
  // Comedy
  Comedy: {
    gradient: ['#f39c12', '#d68910', '#b9770e'],
    icon: 'happy',
    iconColor: 'rgba(255,255,255,0.15)',
  },
  
  // Food & Drink
  Food: {
    gradient: ['#5d4037', '#6d4c41', '#795548'],
    icon: 'restaurant',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  'Food & Drink': {
    gradient: ['#5d4037', '#6d4c41', '#795548'],
    icon: 'restaurant',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  
  // Festivals
  Festival: {
    gradient: ['#c0392b', '#a93226', '#922b21'],
    icon: 'bonfire',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  Festivals: {
    gradient: ['#c0392b', '#a93226', '#922b21'],
    icon: 'bonfire',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  
  // Family
  Family: {
    gradient: ['#2980b9', '#3498db', '#5dade2'],
    icon: 'heart',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  
  // Community
  Community: {
    gradient: ['#5b2c6f', '#6c3483', '#7d3c98'],
    icon: 'people',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  
  // Education/Classes
  Education: {
    gradient: ['#1a5276', '#2471a3', '#2e86c1'],
    icon: 'school',
    iconColor: 'rgba(255,255,255,0.12)',
  },
  
  // Nightlife
  Nightlife: {
    gradient: ['#0c0c0c', '#1a1a2e', '#16213e'],
    icon: 'moon',
    iconColor: 'rgba(255,255,255,0.1)',
  },
  
  // Default
  default: {
    gradient: ['#2c3e50', '#34495e', '#415b76'],
    icon: 'calendar',
    iconColor: 'rgba(255,255,255,0.1)',
  },
};

const CategoryPlaceholder = ({ 
  category, 
  style, 
  iconSize = 80,
  showIcon = true 
}) => {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.default;
  
  return (
    <LinearGradient
      colors={config.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style]}
    >
      {showIcon && (
        <View style={styles.iconContainer}>
          <Ionicons 
            name={config.icon} 
            size={iconSize} 
            color={config.iconColor}
          />
        </View>
      )}
      {/* Subtle texture overlay */}
      <View style={styles.noiseOverlay} />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconContainer: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    opacity: 0.8,
  },
  noiseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Subtle grain effect via opacity pattern
    opacity: 0.03,
  },
});

export default CategoryPlaceholder;
