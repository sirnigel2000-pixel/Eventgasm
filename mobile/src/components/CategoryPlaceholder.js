/**
 * CategoryPlaceholder - Elegant gradient backgrounds for events without images
 * Apple-inspired minimal aesthetic
 * 
 * For uncategorized events: extracts keyword from title (expo, festival, fair, show, etc.)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Keywords to extract from event titles for the metallic placeholder
const EVENT_KEYWORDS = [
  'expo', 'festival', 'fair', 'show', 'concert', 'game', 'match', 
  'gala', 'party', 'meetup', 'summit', 'conference', 'workshop',
  'seminar', 'lecture', 'tour', 'exhibit', 'market', 'bazaar',
  'race', 'marathon', 'championship', 'tournament', 'recital',
  'performance', 'screening', 'premiere', 'opening', 'celebration',
  'parade', 'carnival', 'rodeo', 'circus', 'comedy', 'opera',
  'ballet', 'musical', 'play', 'auction', 'tasting', 'brunch',
];

// Extract a keyword from event title
function extractKeyword(title) {
  if (!title) return null;
  const lowerTitle = title.toLowerCase();
  
  for (const keyword of EVENT_KEYWORDS) {
    if (lowerTitle.includes(keyword)) {
      return keyword.toUpperCase();
    }
  }
  return null;
}

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
  
  // Default - Dark metallic grey
  default: {
    gradient: ['#2d2d2d', '#3d3d3d', '#4a4a4a', '#3d3d3d', '#2d2d2d'],
    icon: null, // No icon for default - use keyword text
    iconColor: 'rgba(255,255,255,0.08)',
  },
};

const CategoryPlaceholder = ({ 
  category, 
  title,
  style, 
  iconSize = 80,
  showIcon = true 
}) => {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.default;
  const isDefault = !CATEGORY_CONFIG[category];
  
  // For default/unknown categories, try to extract keyword from title
  const keyword = isDefault ? extractKeyword(title) : null;
  
  return (
    <LinearGradient
      colors={config.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style]}
    >
      {/* Metallic sheen overlay for default */}
      {isDefault && (
        <LinearGradient
          colors={['rgba(255,255,255,0.05)', 'transparent', 'rgba(255,255,255,0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sheenOverlay}
        />
      )}
      
      {/* Keyword text for default category */}
      {isDefault && keyword && (
        <View style={styles.keywordContainer}>
          <Text style={styles.keywordText}>{keyword}</Text>
        </View>
      )}
      
      {/* Icon for known categories */}
      {showIcon && config.icon && !isDefault && (
        <View style={styles.iconContainer}>
          <Ionicons 
            name={config.icon} 
            size={iconSize} 
            color={config.iconColor}
          />
        </View>
      )}
      
      {/* Subtle texture/grain effect */}
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
  sheenOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  iconContainer: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    opacity: 0.8,
  },
  keywordContainer: {
    position: 'absolute',
    bottom: 20,
    right: 15,
    transform: [{ rotate: '-8deg' }],
  },
  keywordText: {
    fontSize: 42,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.08)',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  noiseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.02,
  },
});

export default CategoryPlaceholder;
