import React, { memo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions 
} from 'react-native';
import { Image } from 'expo-image'; // Fast cached images
import { formatEventDate, formatDateRange, formatDistance } from '../utils/formatters';
import { useFavorites } from '../context/FavoritesContext';
import haptics from '../utils/haptics';

// Blurhash placeholder for loading state
const PLACEHOLDER_BLUR = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

const { width } = Dimensions.get('window');

function EventCard({ event, onPress }) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const favorited = isFavorite(event.id);
  
  // Only show FREE badge if explicitly marked free (not just null price)
  const isFree = event.isFree === true;
  const hasPrice = event.price?.min != null || event.price?.max != null;
  const hasMultipleShowtimes = event.totalShowtimes && event.totalShowtimes > 1;

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => onPress(event)}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        {event.image ? (
          <Image 
            source={event.image}
            style={styles.image}
            contentFit="cover"
            placeholder={PLACEHOLDER_BLUR}
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.image, styles.placeholderImage]}>
            <Text style={styles.placeholderEmoji}>🎉</Text>
          </View>
        )}
        
        {/* FREE Badge */}
        {isFree && (
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>FREE</Text>
          </View>
        )}

        {/* Multiple Showtimes Badge */}
        {hasMultipleShowtimes && (
          <View style={styles.showtimesBadge}>
            <Text style={styles.showtimesBadgeText}>{event.totalShowtimes} dates</Text>
          </View>
        )}

        {/* Source Badge */}
        {event.source === 'allevents' && !hasMultipleShowtimes && (
          <View style={styles.localBadge}>
            <Text style={styles.localBadgeText}>LOCAL</Text>
          </View>
        )}

        {/* Favorite Heart Button */}
        <TouchableOpacity 
          style={styles.heartButton}
          onPress={(e) => {
            e.stopPropagation();
            haptics.success(); // Satisfying feedback on favorite
            toggleFavorite(event);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.heartIcon}>{favorited ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{event.category || 'Event'}</Text>
          </View>
          {event.distance != null && formatDistance(event.distance) && (
            <Text style={styles.distance}>{formatDistance(event.distance)}</Text>
          )}
        </View>
        
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        
        <Text style={styles.date}>
          {hasMultipleShowtimes && event.dateRange
            ? formatDateRange(event.dateRange.start, event.dateRange.end)
            : formatEventDate(event.timing?.start) || 'Date TBA'}
        </Text>
        
        <View style={styles.footer}>
          <View style={styles.footerTop}>
            <Text style={styles.venue} numberOfLines={1}>
              {'📍 '}{event.venue?.name || 'Venue TBA'}
            </Text>
            {/* Price Display */}
            {!isFree && event.price?.min != null && (
              <Text style={styles.priceTag}>
                From ${Math.round(event.price.min)}
              </Text>
            )}
          </View>
          <View style={styles.footerBottom}>
            {event.venue?.city && (
              <Text style={styles.location}>
                {event.venue.city}, {event.venue.state}
              </Text>
            )}
            {/* Social Stats */}
            {event.social?.total > 0 && (
              <View style={styles.socialBadge}>
                <Text style={styles.socialText}>
                  👥 {event.social.total} interested
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 160,
    backgroundColor: '#f0f0f0',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#667eea',
  },
  placeholderEmoji: {
    fontSize: 48,
  },
  freeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#4caf50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  freeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  localBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#ff9800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  localBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  showtimesBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#667eea',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  showtimesBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  heartButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  heartIcon: {
    fontSize: 18,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#667eea15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '600',
  },
  distance: {
    color: '#888',
    fontSize: 13,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
    lineHeight: 24,
  },
  date: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 12,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  footerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  venue: {
    fontSize: 14,
    color: '#444',
    marginBottom: 2,
    flex: 1,
  },
  priceTag: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
    marginLeft: 8,
  },
  location: {
    fontSize: 13,
    color: '#888',
  },
  footerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  socialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
  },
});

// Memoize to prevent unnecessary re-renders
export default memo(EventCard);
