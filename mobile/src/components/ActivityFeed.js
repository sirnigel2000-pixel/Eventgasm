import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import api from '../services/api';

const ACTIVITY_ICONS = {
  interested: '👀',
  going: '✓',
  attended: '🎉',
  squad_joined: '👥',
  squad_created: '🚀',
  friend_added: '🤝',
};

const ACTIVITY_VERBS = {
  interested: 'is interested in',
  going: 'is going to',
  attended: 'attended',
  squad_joined: 'joined a squad for',
  squad_created: 'created a squad for',
  friend_added: 'became friends with',
};

const ActivityItem = ({ activity, onEventPress }) => {
  const timeAgo = getTimeAgo(activity.createdAt);
  
  return (
    <TouchableOpacity 
      style={styles.activityItem}
      onPress={() => activity.event && onEventPress(activity.event)}
      disabled={!activity.event}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{ACTIVITY_ICONS[activity.type] || '📌'}</Text>
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityText}>
          <Text style={styles.userName}>{activity.metadata?.userName || 'Someone'}</Text>
          {' '}{ACTIVITY_VERBS[activity.type] || 'did something with'}{' '}
          {activity.event && (
            <Text style={styles.eventName}>{activity.event.title}</Text>
          )}
        </Text>
        <Text style={styles.timeAgo}>{timeAgo}</Text>
      </View>
      {activity.event?.image && (
        <Image source={{ uri: activity.event.image }} style={styles.eventThumb} />
      )}
    </TouchableOpacity>
  );
};

function getTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const ActivityFeed = ({ userId, onEventPress }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadActivities();
  }, [userId]);

  const loadActivities = async () => {
    try {
      const response = await api.get(`/activity/feed/${userId || 'demo'}`);
      setActivities(response.data.activities || []);
    } catch (err) {
      console.log('Failed to load activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Loading activity...</Text>
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>🌟</Text>
        <Text style={styles.emptyTitle}>No activity yet</Text>
        <Text style={styles.emptyText}>
          When your friends interact with events, you'll see it here!
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={activities}
      renderItem={({ item }) => (
        <ActivityItem activity={item} onEventPress={onEventPress} />
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );
};

const styles = StyleSheet.create({
  list: {
    paddingVertical: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  userName: {
    fontWeight: '600',
  },
  eventName: {
    fontWeight: '600',
    color: '#667eea',
  },
  timeAgo: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  eventThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginLeft: 12,
    backgroundColor: '#f0f0f0',
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
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

export default ActivityFeed;
