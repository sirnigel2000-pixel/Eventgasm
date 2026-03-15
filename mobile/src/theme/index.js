/**
 * Eventgasm Design System - Apple-Inspired
 * Clean, minimal, contemporary
 */

export const colors = {
  // Primary palette
  primary: '#000000',
  primaryLight: '#1C1C1E',
  
  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F2F2F7',
  backgroundTertiary: '#E5E5EA',
  
  // Cards & surfaces
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  
  // Text
  text: '#000000',
  textSecondary: '#3C3C43',
  textTertiary: '#8E8E93',
  textInverse: '#FFFFFF',
  
  // Semantic colors
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#007AFF',
  
  // Swipe action colors
  swipeGoing: '#34C759',      // Green - Right
  swipeNotGoing: '#FF3B30',   // Red - Left  
  swipeMaybe: '#FF9500',      // Orange - Up
  swipeWantTo: '#007AFF',     // Blue - Down
  
  // Borders & dividers
  border: '#C6C6C8',
  borderLight: '#E5E5EA',
  divider: '#C6C6C8',
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',
  
  // Gradients (for special elements)
  gradientStart: '#000000',
  gradientEnd: '#1C1C1E',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,
};

export const typography = {
  // Large titles (hero text)
  largeTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.37,
    lineHeight: 41,
  },
  
  // Titles
  title1: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.36,
    lineHeight: 34,
  },
  title2: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.35,
    lineHeight: 28,
  },
  title3: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.38,
    lineHeight: 25,
  },
  
  // Headlines
  headline: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  
  // Body text
  body: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  bodyBold: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  
  // Callouts
  callout: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.32,
    lineHeight: 21,
  },
  
  // Subheadlines
  subheadline: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.24,
    lineHeight: 20,
  },
  subheadlineBold: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.24,
    lineHeight: 20,
  },
  
  // Footnotes
  footnote: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.08,
    lineHeight: 18,
  },
  
  // Captions
  caption1: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 16,
  },
  caption2: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.07,
    lineHeight: 13,
  },
};

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  
  // For swipe cards
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
  
  // Specific components
  card: 20,
  button: 12,
  input: 10,
  chip: 8,
  avatar: 9999,
};

export const animation = {
  // Durations (ms)
  fast: 150,
  normal: 250,
  slow: 400,
  
  // Spring configs for swipe
  swipeSpring: {
    damping: 20,
    stiffness: 200,
    mass: 1,
  },
  
  // Bounce for card stack
  bounceSpring: {
    damping: 15,
    stiffness: 150,
    mass: 0.8,
  },
};

// Component-specific styles
export const components = {
  // Swipe card
  swipeCard: {
    width: '92%',
    aspectRatio: 0.7,
    borderRadius: borderRadius.card,
    ...shadows.card,
  },
  
  // Action buttons
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    ...shadows.md,
  },
  
  // Navigation bar
  navBar: {
    height: 44,
    backgroundColor: colors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  
  // Tab bar
  tabBar: {
    height: 83,
    backgroundColor: colors.background,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderLight,
  },
  
  // Chip/pill
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.chip,
    backgroundColor: colors.backgroundSecondary,
  },
};

// Swipe thresholds and feedback - tuned for snappy feel
export const swipe = {
  threshold: 80,            // Reduced for easier swiping
  velocityThreshold: 500,   // Lower velocity threshold
  rotationAngle: 12,        // More dramatic rotation
  overlayOpacity: 0.9,      // More visible overlay feedback
};

export default {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
  animation,
  components,
  swipe,
};
