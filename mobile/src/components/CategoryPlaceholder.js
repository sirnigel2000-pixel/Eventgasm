/**
 * CategoryPlaceholder - Sharp, category-specific icon backgrounds
 * Uses @expo/vector-icons (built into Expo) for crisp vector icons
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

// Category themes: gradient colors + icon config
const CATEGORY_THEMES = {
  'Music': [
    { colors: ['#1a0533', '#3d1060', '#6b21a8'], icon: { lib: 'Ionicons', name: 'musical-notes', color: '#c084fc' } },
    { colors: ['#0f1729', '#1e3a5f', '#1e40af'], icon: { lib: 'Ionicons', name: 'headset', color: '#60a5fa' } },
    { colors: ['#1a0000', '#4a0010', '#9f1239'], icon: { lib: 'Ionicons', name: 'mic', color: '#fb7185' } },
    { colors: ['#0a1628', '#1e2d50', '#1d4ed8'], icon: { lib: 'MaterialCommunityIcons', name: 'piano', color: '#93c5fd' } },
    { colors: ['#1a0f00', '#3d2500', '#92400e'], icon: { lib: 'MaterialCommunityIcons', name: 'guitar-acoustic', color: '#fbbf24' } },
    { colors: ['#0f0f1a', '#1e1e4a', '#4338ca'], icon: { lib: 'MaterialCommunityIcons', name: 'music-note-eighth', color: '#a5b4fc' } },
    { colors: ['#001a0f', '#003320', '#065f46'], icon: { lib: 'MaterialCommunityIcons', name: 'violin', color: '#34d399' } },
  ],
  'Sports': [
    { colors: ['#0a2a0a', '#14532d', '#16a34a'], icon: { lib: 'Ionicons', name: 'football', color: '#86efac' } },
    { colors: ['#1a0a00', '#7c2d12', '#c2410c'], icon: { lib: 'MaterialCommunityIcons', name: 'football', color: '#fb923c' } },
    { colors: ['#00101a', '#0c2a4a', '#1d4ed8'], icon: { lib: 'MaterialCommunityIcons', name: 'basketball', color: '#60a5fa' } },
    { colors: ['#0a001a', '#2e1065', '#7c3aed'], icon: { lib: 'MaterialCommunityIcons', name: 'baseball', color: '#c4b5fd' } },
    { colors: ['#001a1a', '#134e4a', '#0f766e'], icon: { lib: 'MaterialCommunityIcons', name: 'hockey-puck', color: '#2dd4bf' } },
    { colors: ['#1a1a00', '#3d3a00', '#854d0e'], icon: { lib: 'MaterialCommunityIcons', name: 'tennis-ball', color: '#a3e635' } },
    { colors: ['#0f0f0f', '#1f1f1f', '#3f3f3f'], icon: { lib: 'FontAwesome5', name: 'boxing-glove', color: '#e5e7eb' } },
  ],
  'Comedy': [
    { colors: ['#1a1500', '#403800', '#854d0e'], icon: { lib: 'Ionicons', name: 'mic-circle', color: '#fbbf24' } },
    { colors: ['#1a0000', '#4a0010', '#9f1239'], icon: { lib: 'MaterialCommunityIcons', name: 'drama-masks', color: '#fb7185' } },
    { colors: ['#0f0533', '#2e1065', '#6d28d9'], icon: { lib: 'MaterialCommunityIcons', name: 'theater', color: '#c084fc' } },
    { colors: ['#001a0f', '#003320', '#065f46'], icon: { lib: 'Ionicons', name: 'mic-outline', color: '#34d399' } },
  ],
  'Theater': [
    { colors: ['#1a0000', '#4a0010', '#9f1239'], icon: { lib: 'MaterialCommunityIcons', name: 'drama-masks', color: '#fb7185' } },
    { colors: ['#1a0f00', '#3d2500', '#92400e'], icon: { lib: 'MaterialCommunityIcons', name: 'theater', color: '#fbbf24' } },
    { colors: ['#0a001a', '#2e1065', '#5b21b6'], icon: { lib: 'MaterialCommunityIcons', name: 'film', color: '#c4b5fd' } },
    { colors: ['#0f1a0f', '#1a3320', '#14532d'], icon: { lib: 'Ionicons', name: 'ticket', color: '#86efac' } },
  ],
  'Arts': [
    { colors: ['#0a001a', '#2e1065', '#6d28d9'], icon: { lib: 'MaterialCommunityIcons', name: 'palette', color: '#c084fc' } },
    { colors: ['#1a0533', '#4a1080', '#7c3aed'], icon: { lib: 'Ionicons', name: 'brush', color: '#a78bfa' } },
    { colors: ['#001a1a', '#0c3a3a', '#0e7490'], icon: { lib: 'MaterialCommunityIcons', name: 'image-frame', color: '#67e8f9' } },
    { colors: ['#1a0f00', '#3d2500', '#78350f'], icon: { lib: 'MaterialCommunityIcons', name: 'pencil-ruler', color: '#fcd34d' } },
  ],
  'Festival': [
    { colors: ['#1a0500', '#4a1000', '#b45309'], icon: { lib: 'MaterialCommunityIcons', name: 'ferris-wheel', color: '#fbbf24' } },
    { colors: ['#0a001a', '#28006a', '#7c3aed'], icon: { lib: 'MaterialCommunityIcons', name: 'party-popper', color: '#e879f9' } },
    { colors: ['#001a0a', '#003d20', '#15803d'], icon: { lib: 'MaterialCommunityIcons', name: 'tent', color: '#86efac' } },
    { colors: ['#1a0010', '#4a0028', '#be185d'], icon: { lib: 'Ionicons', name: 'sparkles', color: '#f9a8d4' } },
    { colors: ['#0a1000', '#1a2800', '#3f6212'], icon: { lib: 'MaterialCommunityIcons', name: 'firework', color: '#bef264' } },
  ],
  'Family': [
    { colors: ['#001a1a', '#003f3f', '#0e7490'], icon: { lib: 'MaterialCommunityIcons', name: 'carousel', color: '#67e8f9' } },
    { colors: ['#1a0f00', '#3d2500', '#b45309'], icon: { lib: 'MaterialCommunityIcons', name: 'balloon', color: '#fcd34d' } },
    { colors: ['#0a001a', '#1e0050', '#4f46e5'], icon: { lib: 'MaterialCommunityIcons', name: 'ticket-percent', color: '#a5b4fc' } },
    { colors: ['#001a05', '#003d10', '#15803d'], icon: { lib: 'Ionicons', name: 'people', color: '#86efac' } },
  ],
  'Food': [
    { colors: ['#1a0500', '#4a1200', '#b45309'], icon: { lib: 'MaterialCommunityIcons', name: 'food-fork-drink', color: '#fbbf24' } },
    { colors: ['#0a1a00', '#1a3d00', '#365314'], icon: { lib: 'MaterialCommunityIcons', name: 'leaf', color: '#bef264' } },
    { colors: ['#1a000a', '#4a0018', '#9f1239'], icon: { lib: 'MaterialCommunityIcons', name: 'glass-wine', color: '#fb7185' } },
    { colors: ['#001015', '#001f2d', '#0c4a6e'], icon: { lib: 'MaterialCommunityIcons', name: 'silverware-fork-knife', color: '#7dd3fc' } },
    { colors: ['#0f0a00', '#2d1f00', '#78350f'], icon: { lib: 'MaterialCommunityIcons', name: 'beer', color: '#fde68a' } },
  ],
  'Nightlife': [
    { colors: ['#0a0014', '#1a0033', '#4c1d95'], icon: { lib: 'MaterialCommunityIcons', name: 'equalizer', color: '#c084fc' } },
    { colors: ['#000a14', '#00203d', '#1e3a5f'], icon: { lib: 'MaterialCommunityIcons', name: 'glass-cocktail', color: '#60a5fa' } },
    { colors: ['#140014', '#3d003d', '#86198f'], icon: { lib: 'MaterialCommunityIcons', name: 'turntable', color: '#e879f9' } },
    { colors: ['#0a0000', '#280000', '#7f1d1d'], icon: { lib: 'MaterialCommunityIcons', name: 'music-note-quarter-dotted', color: '#fca5a5' } },
    { colors: ['#000a0a', '#001f1f', '#134e4a'], icon: { lib: 'Ionicons', name: 'volume-high', color: '#2dd4bf' } },
  ],
  'Community': [
    { colors: ['#001a0a', '#003d20', '#065f46'], icon: { lib: 'Ionicons', name: 'people-circle', color: '#6ee7b7' } },
    { colors: ['#001015', '#003040', '#0e7490'], icon: { lib: 'MaterialCommunityIcons', name: 'town-hall', color: '#67e8f9' } },
    { colors: ['#0f0a00', '#2d1f00', '#78350f'], icon: { lib: 'Ionicons', name: 'home', color: '#fcd34d' } },
    { colors: ['#0a0a1a', '#1a1a40', '#1e3a8a'], icon: { lib: 'Ionicons', name: 'heart-circle', color: '#93c5fd' } },
  ],
  'default': [
    { colors: ['#0f0f1a', '#1a1a2e', '#16213e'], icon: { lib: 'Ionicons', name: 'calendar', color: '#94a3b8' } },
    { colors: ['#0f1a0f', '#1a2e1a', '#1a3a1a'], icon: { lib: 'Ionicons', name: 'star', color: '#86efac' } },
    { colors: ['#1a0f0f', '#2e1a1a', '#3a1a1a'], icon: { lib: 'Ionicons', name: 'ticket', color: '#fca5a5' } },
    { colors: ['#0f0f0f', '#1e1e1e', '#2d2d2d'], icon: { lib: 'Ionicons', name: 'compass', color: '#d1d5db' } },
  ],
};

const ICON_LIBS = {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
};

function getTheme(category, title) {
  const key = Object.keys(CATEGORY_THEMES).find(k => 
    category?.toLowerCase().includes(k.toLowerCase())
  ) || 'default';
  
  const themes = CATEGORY_THEMES[key];
  const str = (title || category || 'event').toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return themes[Math.abs(hash) % themes.length];
}

function extractKeyword(title, category) {
  const KEYWORDS = [
    'festival', 'concert', 'show', 'game', 'fair', 'expo', 'gala',
    'party', 'tour', 'comedy', 'opera', 'ballet', 'race', 'match',
    'championship', 'tournament', 'premiere', 'market', 'brunch',
    'dinner', 'mixer', 'workshop', 'seminar', 'jazz', 'rock', 'live',
  ];
  const text = (title || '').toLowerCase();
  for (const kw of KEYWORDS) {
    if (text.includes(kw)) return kw.toUpperCase();
  }
  if (category) {
    const first = category.split(/[\s&]/)[0].trim();
    if (first.length <= 10) return first.toUpperCase();
  }
  return null;
}

const CategoryPlaceholder = ({ category, title, style }) => {
  const theme = useMemo(() => getTheme(category, title), [category, title]);
  const keyword = useMemo(() => extractKeyword(title, category), [title, category]);
  
  const IconLib = ICON_LIBS[theme.icon.lib] || Ionicons;

  return (
    <LinearGradient
      colors={theme.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style]}
    >
      {/* Sheen */}
      <LinearGradient
        colors={['rgba(255,255,255,0.07)', 'transparent', 'rgba(255,255,255,0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Large background watermark icon */}
      <View style={styles.bgIconContainer}>
        <IconLib name={theme.icon.name} size={160} color={theme.icon.color + '18'} />
      </View>

      {/* Center icon */}
      <IconLib name={theme.icon.name} size={56} color={theme.icon.color} style={styles.centerIcon} />

      {/* Keyword badge */}
      {keyword && (
        <View style={styles.keywordBadge}>
          <Text style={[styles.keywordText, { color: theme.icon.color }]}>
            {keyword}
          </Text>
        </View>
      )}
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
  bgIconContainer: {
    position: 'absolute',
    bottom: -30,
    right: -30,
  },
  centerIcon: {
    marginBottom: 4,
  },
  keywordBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  keywordText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
});

export default CategoryPlaceholder;
