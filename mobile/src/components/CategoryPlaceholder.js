/**
 * CategoryPlaceholder - Rich, category-specific backgrounds for events without images
 * Multiple color schemes + emoji icons per category, randomly varied for diversity
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Category-specific themes: [gradient colors, icon, accent color]
const CATEGORY_THEMES = {
  'Music': [
    { colors: ['#1a0533', '#3d1060', '#6b21a8'], icon: '🎸', accent: '#c084fc' },
    { colors: ['#0f1729', '#1e3a5f', '#2563eb'], icon: '🎵', accent: '#60a5fa' },
    { colors: ['#1a0000', '#4a0010', '#9f1239'], icon: '🎤', accent: '#fb7185' },
    { colors: ['#0a1628', '#1e2d50', '#1d4ed8'], icon: '🎹', accent: '#93c5fd' },
    { colors: ['#0f0f1a', '#1e1e4a', '#4338ca'], icon: '🎧', accent: '#a5b4fc' },
    { colors: ['#1a0f00', '#3d2500', '#92400e'], icon: '🎺', accent: '#fbbf24' },
    { colors: ['#001a0f', '#003320', '#065f46'], icon: '🎻', accent: '#34d399' },
  ],
  'Sports': [
    { colors: ['#0a2a0a', '#14532d', '#16a34a'], icon: '⚽', accent: '#86efac' },
    { colors: ['#1a0a00', '#7c2d12', '#c2410c'], icon: '🏈', accent: '#fb923c' },
    { colors: ['#00101a', '#0c2a4a', '#1d4ed8'], icon: '🏀', accent: '#60a5fa' },
    { colors: ['#0a001a', '#2e1065', '#7c3aed'], icon: '⚾', accent: '#c4b5fd' },
    { colors: ['#001a1a', '#134e4a', '#0f766e'], icon: '🏒', accent: '#2dd4bf' },
    { colors: ['#1a1a00', '#3d3a00', '#854d0e'], icon: '🎾', accent: '#a3e635' },
    { colors: ['#0f0f0f', '#1f1f1f', '#3f3f3f'], icon: '🥊', accent: '#e5e7eb' },
  ],
  'Comedy': [
    { colors: ['#1a1500', '#403800', '#854d0e'], icon: '😂', accent: '#fbbf24' },
    { colors: ['#1a0000', '#4a0010', '#9f1239'], icon: '🎭', accent: '#fb7185' },
    { colors: ['#001a0f', '#003320', '#065f46'], icon: '🎤', accent: '#34d399' },
    { colors: ['#0f0533', '#2e1065', '#6d28d9'], icon: '😆', accent: '#c084fc' },
  ],
  'Theater': [
    { colors: ['#1a0000', '#4a0010', '#9f1239'], icon: '🎭', accent: '#fb7185' },
    { colors: ['#1a0f00', '#3d2500', '#92400e'], icon: '🎪', accent: '#fbbf24' },
    { colors: ['#0a001a', '#2e1065', '#5b21b6'], icon: '🎬', accent: '#c4b5fd' },
    { colors: ['#0f1a0f', '#1a3320', '#14532d'], icon: '🌹', accent: '#86efac' },
  ],
  'Arts': [
    { colors: ['#0a001a', '#2e1065', '#6d28d9'], icon: '🎨', accent: '#c084fc' },
    { colors: ['#1a0533', '#4a1080', '#7c3aed'], icon: '🖼️', accent: '#a78bfa' },
    { colors: ['#001a1a', '#0c3a3a', '#0e7490'], icon: '🎭', accent: '#67e8f9' },
    { colors: ['#1a0f00', '#3d2500', '#78350f'], icon: '✏️', accent: '#fcd34d' },
  ],
  'Festival': [
    { colors: ['#1a0500', '#4a1000', '#b45309'], icon: '🎡', accent: '#fbbf24' },
    { colors: ['#0a001a', '#28006a', '#7c3aed'], icon: '🎆', accent: '#e879f9' },
    { colors: ['#001a0a', '#003d20', '#15803d'], icon: '⛺', accent: '#86efac' },
    { colors: ['#1a0010', '#4a0028', '#be185d'], icon: '🎊', accent: '#f9a8d4' },
    { colors: ['#0a1000', '#1a2800', '#3f6212'], icon: '🌄', accent: '#bef264' },
  ],
  'Family': [
    { colors: ['#001a1a', '#003f3f', '#0e7490'], icon: '🎠', accent: '#67e8f9' },
    { colors: ['#1a0f00', '#3d2500', '#b45309'], icon: '🎪', accent: '#fcd34d' },
    { colors: ['#0a001a', '#1e0050', '#4f46e5'], icon: '🎢', accent: '#a5b4fc' },
    { colors: ['#001a05', '#003d10', '#15803d'], icon: '🌈', accent: '#86efac' },
  ],
  'Food': [
    { colors: ['#1a0500', '#4a1200', '#b45309'], icon: '🍕', accent: '#fbbf24' },
    { colors: ['#0a1a00', '#1a3d00', '#365314'], icon: '🌿', accent: '#bef264' },
    { colors: ['#1a000a', '#4a0018', '#9f1239'], icon: '🍷', accent: '#fb7185' },
    { colors: ['#001015', '#001f2d', '#0c4a6e'], icon: '🦞', accent: '#7dd3fc' },
    { colors: ['#0f0a00', '#2d1f00', '#78350f'], icon: '🍺', accent: '#fde68a' },
  ],
  'Nightlife': [
    { colors: ['#0a0014', '#1a0033', '#4c1d95'], icon: '🎉', accent: '#c084fc' },
    { colors: ['#000a14', '#00203d', '#1e3a5f'], icon: '🍸', accent: '#60a5fa' },
    { colors: ['#140014', '#3d003d', '#86198f'], icon: '💃', accent: '#e879f9' },
    { colors: ['#0a0000', '#280000', '#7f1d1d'], icon: '🎶', accent: '#fca5a5' },
    { colors: ['#000a0a', '#001f1f', '#134e4a'], icon: '🕺', accent: '#2dd4bf' },
  ],
  'Community': [
    { colors: ['#001a0a', '#003d20', '#065f46'], icon: '🤝', accent: '#6ee7b7' },
    { colors: ['#001015', '#003040', '#0e7490'], icon: '🏛️', accent: '#67e8f9' },
    { colors: ['#0f0a00', '#2d1f00', '#78350f'], icon: '🏘️', accent: '#fcd34d' },
    { colors: ['#0a0a1a', '#1a1a40', '#1e3a8a'], icon: '👥', accent: '#93c5fd' },
  ],
  'Conference': [
    { colors: ['#0a0a14', '#1a1a3a', '#1e3a8a'], icon: '💼', accent: '#93c5fd' },
    { colors: ['#000a05', '#001f10', '#064e3b'], icon: '🎯', accent: '#6ee7b7' },
    { colors: ['#0f0f0f', '#1f1f1f', '#374151'], icon: '📊', accent: '#d1d5db' },
  ],
  'default': [
    { colors: ['#0f0f1a', '#1a1a2e', '#16213e'], icon: '📅', accent: '#94a3b8' },
    { colors: ['#0f1a0f', '#1a2e1a', '#1a3a1a'], icon: '✨', accent: '#86efac' },
    { colors: ['#1a0f0f', '#2e1a1a', '#3a1a1a'], icon: '🌟', accent: '#fca5a5' },
    { colors: ['#0f0f0f', '#1e1e1e', '#2d2d2d'], icon: '🎟️', accent: '#d1d5db' },
  ],
};

// Get a consistent but varied theme for an event based on its ID or title
function getTheme(category, title) {
  const themes = CATEGORY_THEMES[category] 
    || CATEGORY_THEMES[category?.split(' ')[0]] 
    || CATEGORY_THEMES['default'];
  
  // Use title hash for consistent variety (same event = same look)
  const str = (title || category || 'event').toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % themes.length;
  return themes[idx];
}

// Extract short keyword from title for display
function extractKeyword(title, category) {
  if (!title && !category) return null;

  const KEYWORDS = [
    'festival', 'concert', 'show', 'game', 'fair', 'expo', 'gala',
    'party', 'tour', 'comedy', 'opera', 'ballet', 'race', 'match',
    'championship', 'tournament', 'premiere', 'market', 'brunch',
    'dinner', 'mixer', 'workshop', 'seminar', 'jazz', 'rock',
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

  return (
    <LinearGradient
      colors={theme.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style]}
    >
      {/* Sheen overlay */}
      <LinearGradient
        colors={['rgba(255,255,255,0.07)', 'transparent', 'rgba(255,255,255,0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Large background icon */}
      <Text style={[styles.bgIcon, { color: theme.accent + '22' }]}>
        {theme.icon}
      </Text>

      {/* Center icon */}
      <Text style={styles.centerIcon}>{theme.icon}</Text>

      {/* Keyword label */}
      {keyword && (
        <View style={styles.keywordBadge}>
          <Text style={[styles.keywordText, { color: theme.accent }]}>
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
  bgIcon: {
    position: 'absolute',
    fontSize: 180,
    right: -20,
    bottom: -20,
  },
  centerIcon: {
    fontSize: 64,
    marginBottom: 8,
    // subtle drop shadow via text shadow not available on RN but emoji renders fine
  },
  keywordBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  keywordText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
});

export default CategoryPlaceholder;
