/**
 * CategoryPlaceholder - Dark metallic backgrounds for events without images
 * Extracts keyword from title and displays as embossed text
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Keywords to extract from event titles (priority order)
const EVENT_KEYWORDS = [
  // Event types
  'expo', 'festival', 'fair', 'show', 'concert', 'game', 'match',
  'gala', 'party', 'meetup', 'summit', 'conference', 'workshop',
  'seminar', 'lecture', 'tour', 'exhibit', 'market', 'bazaar',
  'race', 'marathon', 'championship', 'tournament', 'recital',
  'performance', 'screening', 'premiere', 'opening', 'celebration',
  'parade', 'carnival', 'rodeo', 'circus', 'comedy', 'opera',
  'ballet', 'musical', 'play', 'auction', 'tasting', 'brunch',
  'dinner', 'lunch', 'cruise', 'mixer', 'social', 'fundraiser',
  'benefit', 'showcase', 'convention', 'symposium', 'forum',
  'retreat', 'jam', 'session', 'clinic', 'camp', 'class',
  // Sports
  'hockey', 'baseball', 'basketball', 'football', 'soccer', 'tennis',
  'golf', 'racing', 'boxing', 'wrestling', 'skating',
  // Music genres
  'jazz', 'rock', 'country', 'hip-hop', 'classical', 'blues',
  // Other
  'wedding', 'graduation', 'reunion', 'memorial', 'ceremony',
];

// Extract the best keyword from event title
function extractKeyword(title, category) {
  if (!title && !category) return 'EVENT';
  
  const searchText = `${title || ''} ${category || ''}`.toLowerCase();
  
  for (const keyword of EVENT_KEYWORDS) {
    if (searchText.includes(keyword)) {
      return keyword.toUpperCase();
    }
  }
  
  // Fallback: use category if available
  if (category) {
    // Clean up category name
    const clean = category.replace(/[&]/g, '').trim().split(' ')[0];
    if (clean.length <= 12) {
      return clean.toUpperCase();
    }
  }
  
  return 'EVENT';
}

const CategoryPlaceholder = ({ 
  category, 
  title,
  style, 
}) => {
  const keyword = extractKeyword(title, category);
  
  return (
    <LinearGradient
      colors={['#1a1a1a', '#2a2a2a', '#3a3a3a', '#2d2d2d', '#1f1f1f']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style]}
    >
      {/* Metallic sheen overlay */}
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'transparent', 'rgba(255,255,255,0.04)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sheenOverlay}
      />
      
      {/* Embossed keyword text */}
      <View style={styles.keywordContainer}>
        <Text style={styles.keywordText}>{keyword}</Text>
      </View>
      
      {/* Subtle brushed metal texture lines */}
      <View style={styles.textureOverlay}>
        {[...Array(20)].map((_, i) => (
          <View key={i} style={[styles.textureLine, { top: `${i * 5}%` }]} />
        ))}
      </View>
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
  keywordContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    transform: [{ rotate: '-6deg' }],
  },
  keywordText: {
    fontSize: 48,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.10)',
    letterSpacing: 6,
    textTransform: 'uppercase',
    // Embossed effect
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  textureOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
  },
  textureLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});

export default CategoryPlaceholder;
