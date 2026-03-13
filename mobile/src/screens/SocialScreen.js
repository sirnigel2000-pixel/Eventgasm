import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import ActivityFeed from '../components/ActivityFeed';

const SocialScreen = ({ navigation }) => {
  const [tab, setTab] = useState('activity'); // activity | matches | messages
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userScore, setUserScore] = useState({ totalScore: 0, eventsAttended: 0 });

  const userId = 'demo-user-id';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const scoreRes = await api.get(`/social/score/${userId}`).catch(() => null);
      if (scoreRes?.data) {
        setUserScore(scoreRes.data);
      }
    } catch (err) {
      console.log('Failed to load social data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEventPress = (event) => {
    navigation.navigate('EventDetail', { event });
  };

  const renderMatchCard = ({ item }) => (
    <TouchableOpacity style={styles.matchCard}>
      <View style={styles.matchAvatar}>
        <Text style={styles.avatarText}>👤</Text>
      </View>
      <View style={styles.matchInfo}>
        <Text style={styles.matchName}>{item.name || 'Event Fan'}</Text>
        <Text style={styles.matchScore}>{item.totalScore || 0} events</Text>
      </View>
      <View style={styles.matchPercent}>
        <Text style={styles.percentText}>{item.matchPercent || 0}%</Text>
        <Text style={styles.percentLabel}>match</Text>
      </View>
    </TouchableOpacity>
  );

  const renderContent = () => {
    switch (tab) {
      case 'activity':
        return <ActivityFeed userId={userId} onEventPress={handleEventPress} />;
      case 'matches':
        return matches.length > 0 ? (
          <FlatList
            data={matches}
            renderItem={renderMatchCard}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={styles.list}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyTitle}>Find Your Event Crew</Text>
            <Text style={styles.emptyText}>
              Mark events as "Interested" or "Going" to find people with similar taste!
            </Text>
          </View>
        );
      case 'messages':
        return (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>Start a conversation with your event matches!</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Social</Text>
      </View>

      {/* Score Card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreMain}>
          <Text style={styles.scoreValue}>{userScore.totalScore}</Text>
          <Text style={styles.scoreLabel}>Event Score</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreStats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{userScore.eventsAttended || 0}</Text>
            <Text style={styles.statLabel}>Attended</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{userScore.eventsGoing || 0}</Text>
            <Text style={styles.statLabel}>Going</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'activity', label: 'Activity', icon: 'pulse' },
          { key: 'matches', label: 'Matches', icon: 'people' },
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
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>
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
  scoreCard: {
    flexDirection: 'row',
    backgroundColor: 'linear-gradient(135deg, #667eea, #764ba2)',
    backgroundColor: '#667eea',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  scoreMain: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
  },
  scoreLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  scoreDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 20,
  },
  scoreStats: {
    flexDirection: 'row',
    gap: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#667eea',
  },
  tabLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#667eea',
  },
  content: {
    flex: 1,
  },
  list: {
    padding: 16,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  matchAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  matchScore: {
    fontSize: 13,
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
    fontSize: 11,
    color: '#888',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
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
    textAlign: 'center',
    marginTop: 4,
  },
});

export default SocialScreen;
