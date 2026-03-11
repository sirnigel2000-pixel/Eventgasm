import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  Linking,
  Share,
  Dimensions
} from 'react-native';
import { formatEventDate, formatShowtime } from '../utils/formatters';

const { width } = Dimensions.get('window');

export default function EventDetailScreen({ route, navigation }) {
  const { event } = route.params;
  const hasMultipleShowtimes = event.showtimes && event.showtimes.length > 1;
  const [selectedShowtime, setSelectedShowtime] = useState(
    hasMultipleShowtimes ? null : (event.showtimes?.[0] || { ticketUrl: event.ticketUrl })
  );

  const handleBuyTickets = () => {
    const ticketUrl = selectedShowtime?.ticketUrl || event.ticketUrl;
    if (ticketUrl) {
      Linking.openURL(ticketUrl);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${event.title}!\n\n${event.shareUrl || event.ticketUrl}`,
        title: event.title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleDirections = () => {
    const { venue } = event;
    if (venue?.coordinates) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${venue.coordinates.lat},${venue.coordinates.lng}`;
      Linking.openURL(url);
    } else if (venue?.address) {
      const address = encodeURIComponent(`${venue.address}, ${venue.city}, ${venue.state}`);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${address}`);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} bounces={false}>
        {event.image ? (
          <Image 
            source={{ uri: event.image }} 
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.heroImage, styles.placeholderImage]}>
            <Text style={styles.placeholderEmoji}>🎉</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.shareButton}
          onPress={handleShare}
        >
          <Text style={styles.shareText}>↗</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.badges}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{event.category}</Text>
            </View>
            {event.subcategory && (
              <View style={[styles.categoryBadge, styles.subcategoryBadge]}>
                <Text style={styles.subcategoryText}>{event.subcategory}</Text>
              </View>
            )}
          </View>

          <Text style={styles.title}>{event.title}</Text>

          {hasMultipleShowtimes ? (
            <View style={styles.showtimesSection}>
              <Text style={styles.sectionTitle}>📅 Select a Date & Time</Text>
              <Text style={styles.showtimesHint}>
                {event.totalShowtimes} showtimes available
              </Text>
              <View style={styles.showtimesList}>
                {event.showtimes.map((showtime, index) => (
                  <TouchableOpacity
                    key={showtime.id || index}
                    style={[
                      styles.showtimeItem,
                      selectedShowtime?.id === showtime.id && styles.showtimeItemSelected
                    ]}
                    onPress={() => setSelectedShowtime(showtime)}
                  >
                    <Text style={[
                      styles.showtimeText,
                      selectedShowtime?.id === showtime.id && styles.showtimeTextSelected
                    ]}>
                      {formatShowtime(showtime.start)}
                    </Text>
                    {selectedShowtime?.id === showtime.id && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.dateSection}>
              <Text style={styles.dateIcon}>📅</Text>
              <View>
                <Text style={styles.dateMain}>
                  {formatEventDate(event.timing?.start)}
                </Text>
                {event.timing?.timezone && (
                  <Text style={styles.timezone}>{event.timing.timezone}</Text>
                )}
              </View>
            </View>
          )}

          {event.venue && (
            <TouchableOpacity style={styles.venueSection} onPress={handleDirections}>
              <Text style={styles.venueIcon}>📍</Text>
              <View style={styles.venueInfo}>
                <Text style={styles.venueName}>{event.venue.name}</Text>
                {event.venue.address && (
                  <Text style={styles.venueAddress}>{event.venue.address}</Text>
                )}
                <Text style={styles.venueCity}>
                  {event.venue.city}, {event.venue.state} {event.venue.zip}
                </Text>
                <Text style={styles.directionsLink}>Get directions →</Text>
              </View>
            </TouchableOpacity>
          )}

          {event.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          )}

          <View style={styles.sourceRow}>
            <Text style={styles.sourceLabel}>via</Text>
            <Text style={styles.sourceName}>{event.source}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>
            {hasMultipleShowtimes && !selectedShowtime ? 'Select a date above' : 'Tickets'}
          </Text>
          <Text style={styles.price}>
            {event.isFree ? 'FREE' : 'Available'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[
            styles.buyButton,
            hasMultipleShowtimes && !selectedShowtime && styles.buyButtonDisabled
          ]}
          onPress={handleBuyTickets}
          disabled={hasMultipleShowtimes && !selectedShowtime}
        >
          <Text style={styles.buyButtonText}>
            {hasMultipleShowtimes && !selectedShowtime ? 'Select Date' : 'Get Tickets'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flex: 1,
  },
  heroImage: {
    width: width,
    height: 280,
    backgroundColor: '#f0f0f0',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#667eea',
  },
  placeholderEmoji: {
    fontSize: 64,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  shareButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#667eea15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  subcategoryBadge: {
    backgroundColor: '#f0f0f0',
  },
  categoryText: {
    color: '#667eea',
    fontSize: 13,
    fontWeight: '600',
  },
  subcategoryText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 20,
    lineHeight: 32,
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  dateIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  dateMain: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  timezone: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  venueSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  venueIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  venueInfo: {
    flex: 1,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  venueAddress: {
    fontSize: 14,
    color: '#666',
  },
  venueCity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  directionsLink: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  sourceLabel: {
    fontSize: 12,
    color: '#888',
    marginRight: 6,
  },
  sourceName: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 36,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: '#888',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  buyButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
  },
  buyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  showtimesSection: {
    marginBottom: 20,
  },
  showtimesHint: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  showtimesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  showtimeItem: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  showtimeItemSelected: {
    backgroundColor: '#667eea15',
    borderColor: '#667eea',
  },
  showtimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  showtimeTextSelected: {
    color: '#667eea',
  },
  checkmark: {
    marginLeft: 8,
    color: '#667eea',
    fontWeight: '700',
  },
});
