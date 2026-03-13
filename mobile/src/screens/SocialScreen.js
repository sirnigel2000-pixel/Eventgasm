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

const SocialScreen = ({ navigation }) => {
  const [tab, setTab] = useState('matches'); // matches | friends | messages
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userScore, setUserScore] = useState(null);

  // TODO: Get from auth context
  const userId = 'demo-user-id';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // In real app, these would use actual userId
      // For now, show placeholder UI
      setLoading(false);
    } catch (err) {
      console.log('Failed to load social data:', err);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderMatchCard = ({ item }) => (
    <TouchableOpacity style={styles.matchCard}>
      <View style={styles.matchAvatar}>
        <Text style={styles.avatarText}>👤</Text>
      </View>
      <View style={styles.matchInfo}>
        <Text style={styles.matchName}>{item.name || 'Event Fan'}</Text>
        <View style={styles.matchCategories}>
          {(item.topCategories || []).map((cat, i) => (
            <Text key={i} style={styles.categoryEmoji}>{cat.emoji}</Text>
          ))}
        </View>
        <Text style={styles.matchScore}>{item.totalScore || 0} events</Text>
      </View>
      <View style={styles.matchPercent}>
        <Text style={styles.percentText}>{item.matchPercent || 0}%</Text>
        <Text style={styles.percentLabel}>match</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyMatches = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>👥</Text>
      <Text style={styles.emptyTitle}>Find Your Event Crew</Text>
      <Text style={styles.emptyText}>
        Mark events as "Interested" or "Going" to find people with similar taste!
      </Text>
      <TouchableOpacity 
        style={styles.exploreButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.exploreButtonText}>Explore Events</Text>
      </TouchableOpacity>
    </View>
  );

  const renderScoreCard = () => (
    <View style={styles.scoreCard}>
      <View style={styles.scoreHeader}>
        <Text style={styles.scoreTitle}>Your Event Score</Text>
        <Text style={styles.scoreValue}>{userScore?.totalScore || 0}</Text>
      </View>
      <View style={styles.scoreBreakdown}>
        {[
          { label: 'Music', value: userScore?.breakdown?.music || 0, emoji: '🎸' },
          { label: 'Sports', value: userScore?.breakdown?.sports || 0, emoji: '🏃' },
          { label: 'Comedy', value: userScore?.breakdown?.comedy || 0, emoji: '🎭' },
          { label: 'Arts', value: userScore?.breakdown?.arts || 0, emoji: '🎨' },
        ].map((cat, i) => (
          <View key={i} style={styles.scoreCategory}>
            <Text style={styles.scoreCatEmoji}>{cat.emoji}</Text>
            <Text style={styles.scoreCatValue}>{cat.value}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.scoreHint}>
        Go to events to increase your score!
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Social</Text>
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'matches', label: 'Matches', icon: 'heart' },
          { key: 'friends', label: 'Friends', icon: 'people' },
          { key: 'messages', label: 'Messages', icon: 'chatbubbles' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons 
              name={t.icon} 
              size={20} 
              color={tab === t.key ? '#667eea' : '#888'} 
            />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#667eea" style={styles.loader} />
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatchCard}
          keyExtractor={(item) => item.userId || Math.random().toString()}
          ListHeaderComponent={renderScoreCard}
          ListEmptyComponent={renderEmptyMatches}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  loader: {
    marginTop: 40,
  },
  list: {
    padding: 16,
  },
  scoreCard: {
    backgroundColor: '#667eea',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  scoreBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  scoreCategory: {
    alignItems: 'center',
  },
  scoreCatEmoji: {
    fontSize: 24,
  },
  scoreCatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
  },
  scoreHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  matchAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
  },
  matchInfo: {
    flex: 1,
    marginLeft: 12,
  },
  matchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  matchCategories: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  matchScore: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  matchPercent: {
    alignItems: 'center',
  },
  percentText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#667eea',
  },
  percentLabel: {
    fontSize: 10,
    color: '#888',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  exploreButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  exploreButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default SocialScreen;
