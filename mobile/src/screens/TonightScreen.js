import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import EventCard from '../components/EventCard';

const TonightScreen = ({ navigation }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'Music', label: '🎸 Music' },
    { key: 'Comedy', label: '🎭 Comedy' },
    { key: 'Sports', label: '🏃 Sports' },
    { key: 'Food', label: '🍕 Food' },
  ];

  useEffect(() => {
    loadEvents();
  }, [filter]);

  const loadEvents = async () => {
    try {
      // Get today's date range
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(4, 0, 0, 0); // 4am tomorrow
      
      const params = {
        limit: 50,
        startDate: today.toISOString(),
        endDate: tomorrow.toISOString(),
      };
      
      if (filter !== 'all') {
        params.category = filter;
      }

      const response = await api.get('/events', { params });
      setEvents(response.data.events || []);
    } catch (err) {
      console.log('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const handleEventPress = (event) => {
    navigation.navigate('EventDetail', { event });
  };

  const getTimeLabel = (event) => {
    const start = new Date(event.timing?.start);
    const now = new Date();
    const diffMs = start - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMs < 0) {
      return { label: 'Now', color: '#10b981' };
    } else if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return { label: `In ${diffMins}m`, color: '#f59e0b' };
    } else if (diffHours < 3) {
      return { label: `In ${diffHours}h`, color: '#667eea' };
    }
    return { label: start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), color: '#888' };
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <Text style={styles.dateText}>
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{events.length}</Text>
          <Text style={styles.statLabel}>events tonight</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔥 Tonight</Text>
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#667eea" style={styles.loader} />
      ) : (
        <FlatList
          data={events}
          renderItem={({ item }) => {
            const time = getTimeLabel(item);
            return (
              <View>
                <View style={styles.timeLabel}>
                  <View style={[styles.timeDot, { backgroundColor: time.color }]} />
                  <Text style={[styles.timeLabelText, { color: time.color }]}>{time.label}</Text>
                </View>
                <EventCard event={item} onPress={handleEventPress} />
              </View>
            );
          }}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌙</Text>
              <Text style={styles.emptyTitle}>Nothing tonight</Text>
              <Text style={styles.emptyText}>Check back later or browse all events</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterChipActive: {
    backgroundColor: '#667eea',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  loader: {
    marginTop: 40,
  },
  list: {
    paddingBottom: 20,
  },
  headerSection: {
    padding: 20,
  },
  dateText: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 14,
    color: '#888',
  },
  timeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 6,
  },
  timeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timeLabelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
});

export default TonightScreen;
