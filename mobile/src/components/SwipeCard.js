/**
 * SwipeCard - Tinder-style swipeable event card
 * 
 * Swipe directions:
 * - Right: Going ✓
 * - Left: Not going ✗
 * - Up: Might go 🤔
 * - Down: Want to but can't 😢
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import CategoryPlaceholder from './CategoryPlaceholder';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { colors, typography, shadows, borderRadius, spacing, swipe } from '../theme';
import { format } from 'date-fns';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.92;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

const SWIPE_LABELS = {
  right: { text: 'GOING', color: colors.swipeGoing, emoji: '✓' },
  left: { text: 'NOPE', color: colors.swipeNotGoing, emoji: '✗' },
  up: { text: 'MAYBE', color: colors.swipeMaybe, emoji: '🤔' },
  down: { text: 'WISH', color: colors.swipeWantTo, emoji: '😢' },
};

const SwipeCard = ({
  event,
  onSwipe,
  onPress,
  isFirst = false,
  friendsGoing = [],
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(isFirst ? 1 : 0.95);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSwipeComplete = (direction) => {
    triggerHaptic();
    onSwipe?.(direction, event);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const velocityX = Math.abs(e.velocityX);
      const velocityY = Math.abs(e.velocityY);
      const absX = Math.abs(translateX.value);
      const absY = Math.abs(translateY.value);

      // Determine swipe direction
      let direction = null;
      
      // Check horizontal swipes first
      if (absX > absY) {
        if (absX > swipe.threshold || velocityX > swipe.velocityThreshold) {
          direction = translateX.value > 0 ? 'right' : 'left';
        }
      } else {
        // Vertical swipes
        if (absY > swipe.threshold || velocityY > swipe.velocityThreshold) {
          direction = translateY.value > 0 ? 'down' : 'up';
        }
      }

      if (direction) {
        // Animate off screen
        const exitX = direction === 'right' ? SCREEN_WIDTH * 1.5 : 
                      direction === 'left' ? -SCREEN_WIDTH * 1.5 : 0;
        const exitY = direction === 'down' ? SCREEN_HEIGHT : 
                      direction === 'up' ? -SCREEN_HEIGHT : 0;

        translateX.value = withSpring(exitX, { damping: 20, stiffness: 100 });
        translateY.value = withSpring(exitY, { damping: 20, stiffness: 100 }, () => {
          runOnJS(handleSwipeComplete)(direction);
        });
      } else {
        // Snap back
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-swipe.rotationAngle, 0, swipe.rotationAngle]
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale: scale.value },
      ],
    };
  });

  // Overlay styles for each direction
  const rightOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, swipe.threshold], [0, swipe.overlayOpacity]),
  }));

  const leftOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -swipe.threshold], [0, swipe.overlayOpacity]),
  }));

  const upOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, -swipe.threshold], [0, swipe.overlayOpacity]),
  }));

  const downOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, swipe.threshold], [0, swipe.overlayOpacity]),
  }));

  const formatEventDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'EEE, MMM d • h:mm a');
    } catch {
      return '';
    }
  };

  const formatPrice = () => {
    if (event.is_free) return 'Free';
    if (event.price_min) return `From $${event.price_min}`;
    return null;
  };

  if (!event) return null;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Pressable 
          style={styles.cardInner}
          onPress={() => onPress?.(event)}
        >
          {/* Event Image or Category Placeholder */}
          {(event.image_url || event.image) ? (
            <Image
              source={{ uri: event.image_url || event.image }}
              style={styles.image}
              contentFit="cover"
              placeholder={{ blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH' }}
              transition={200}
            />
          ) : (
            <CategoryPlaceholder 
              category={event.category}
              title={event.title}
              style={styles.image}
              iconSize={120}
            />
          )}

          {/* Gradient overlay for text readability */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
            locations={[0.3, 0.6, 1]}
            style={styles.gradient}
          />

          {/* Swipe direction overlays */}
          <Animated.View style={[styles.labelOverlay, styles.rightLabel, rightOverlayStyle]}>
            <View style={[styles.labelBadge, { borderColor: SWIPE_LABELS.right.color }]}>
              <Text style={[styles.labelText, { color: SWIPE_LABELS.right.color }]}>
                {SWIPE_LABELS.right.text}
              </Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.labelOverlay, styles.leftLabel, leftOverlayStyle]}>
            <View style={[styles.labelBadge, { borderColor: SWIPE_LABELS.left.color }]}>
              <Text style={[styles.labelText, { color: SWIPE_LABELS.left.color }]}>
                {SWIPE_LABELS.left.text}
              </Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.labelOverlay, styles.upLabel, upOverlayStyle]}>
            <View style={[styles.labelBadge, { borderColor: SWIPE_LABELS.up.color }]}>
              <Text style={[styles.labelText, { color: SWIPE_LABELS.up.color }]}>
                {SWIPE_LABELS.up.text}
              </Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.labelOverlay, styles.downLabel, downOverlayStyle]}>
            <View style={[styles.labelBadge, { borderColor: SWIPE_LABELS.down.color }]}>
              <Text style={[styles.labelText, { color: SWIPE_LABELS.down.color }]}>
                {SWIPE_LABELS.down.text}
              </Text>
            </View>
          </Animated.View>

          {/* Content */}
          <View style={styles.content}>
            {/* Category pill */}
            {event.category && (
              <View style={styles.categoryPill}>
                <Text style={styles.categoryText}>{event.category}</Text>
              </View>
            )}

            {/* Title */}
            <Text style={styles.title} numberOfLines={2}>
              {event.title}
            </Text>

            {/* Date & Time */}
            <Text style={styles.datetime}>
              {formatEventDate(event.start_time)}
            </Text>

            {/* Venue */}
            {event.venue_name && (
              <Text style={styles.venue} numberOfLines={1}>
                📍 {event.venue_name}
                {event.city && `, ${event.city}`}
              </Text>
            )}

            {/* Bottom row: Price & Friends */}
            <View style={styles.bottomRow}>
              {formatPrice() && (
                <View style={styles.pricePill}>
                  <Text style={styles.priceText}>{formatPrice()}</Text>
                </View>
              )}

              {friendsGoing.length > 0 && (
                <View style={styles.friendsBadge}>
                  <Text style={styles.friendsText}>
                    {friendsGoing.length} friend{friendsGoing.length > 1 ? 's' : ''} going
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    borderRadius: borderRadius.card,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  cardInner: {
    flex: 1,
    borderRadius: borderRadius.card,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundSecondary,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  categoryText: {
    ...typography.caption1,
    color: colors.textInverse,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    ...typography.title1,
    color: colors.textInverse,
    marginBottom: spacing.sm,
  },
  datetime: {
    ...typography.subheadline,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: spacing.xs,
  },
  venue: {
    ...typography.subheadline,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.md,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pricePill: {
    backgroundColor: colors.textInverse,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  priceText: {
    ...typography.subheadlineBold,
    color: colors.primary,
  },
  friendsBadge: {
    backgroundColor: colors.swipeGoing,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  friendsText: {
    ...typography.caption1,
    color: colors.textInverse,
    fontWeight: '600',
  },
  // Swipe label overlays
  labelOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  rightLabel: {
    top: spacing.xxl,
    left: spacing.xl,
    transform: [{ rotate: '-20deg' }],
  },
  leftLabel: {
    top: spacing.xxl,
    right: spacing.xl,
    transform: [{ rotate: '20deg' }],
  },
  upLabel: {
    top: '40%',
    alignSelf: 'center',
  },
  downLabel: {
    bottom: '30%',
    alignSelf: 'center',
  },
  labelBadge: {
    borderWidth: 4,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  labelText: {
    ...typography.title1,
    fontWeight: '800',
  },
});

export default SwipeCard;
