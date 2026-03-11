import React from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions 
} from 'react-native';
import { formatEventDate, formatDateRange, formatDistance } from '../utils/formatters';

const { width } = Dimensions.get('window');

export default function EventCard({ event, onPress }) {
  const isFree = event.isFree || event.price?.isFree;
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
            source={{ uri: event.image }} 
            style={styles.image}
            resizeMode="cover"
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
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{event.category}</Text>
          </View>
          {event.distance && (
            <Text style={styles.distance}>{formatDistance(event.distance)}</Text>
          )}
        </View>
        
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        
        <Text style={styles.date}>
          {hasMultipleShowtimes && event.dateRange
            ? formatDateRange(event.dateRange.start, event.dateRange.end)
            : formatEventDate(event.timing?.start)}
        </Text>
        
        <View style={styles.footer}>
          <Text style={styles.venue} numberOfLines={1}>
            📍 {event.venue?.name || 'Venue TBA'}
          </Text>
          {event.venue?.city && (
            <Text style={styles.location}>
              {event.venue.city}, {event.venue.state}
            </Text>
          )}
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
  venue: {
    fontSize: 14,
    color: '#444',
    marginBottom: 2,
  },
  location: {
    fontSize: 13,
    color: '#888',
  },
});
