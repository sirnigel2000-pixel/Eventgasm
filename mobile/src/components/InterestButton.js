import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import haptics from '../utils/haptics';
import social from '../services/social';

const InterestButton = ({ eventId, userId, initialStats, compact = false }) => {
  const [stats, setStats] = useState(initialStats || { interested: 0, going: 0, total: 0 });
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (eventId && userId) {
      loadStats();
    }
  }, [eventId, userId]);

  const loadStats = async () => {
    try {
      const data = await social.getEventStats(eventId, userId);
      setStats(data);
      setUserStatus(data.userStatus);
    } catch (err) {
      console.log('Failed to load stats:', err.message);
    }
  };

  const handleInterested = async () => {
    if (!userId) return; // Need to be logged in
    
    haptics.selection();
    setLoading(true);
    
    try {
      const result = await social.markInterested(eventId, userId);
      setStats(result.eventStats);
      setUserStatus('interested');
      haptics.success();
    } catch (err) {
      console.log('Failed to mark interested:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoing = async () => {
    if (!userId) return;
    
    haptics.selection();
    setLoading(true);
    
    try {
      const result = await social.markGoing(eventId, userId);
      setStats(result.eventStats);
      setUserStatus('going');
      haptics.success();
    } catch (err) {
      console.log('Failed to mark going:', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    // Just show the count
    const total = (stats.interested || 0) + (stats.going || 0);
    if (total === 0) return null;
    
    return (
      <View style={styles.compactContainer}>
        <Ionicons name="people" size={14} color="#667eea" />
        <Text style={styles.compactText}>{total} interested</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <Ionicons name="people" size={16} color="#667eea" />
        <Text style={styles.statsText}>
          {stats.interested + stats.going} people interested
        </Text>
      </View>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[
            styles.button,
            userStatus === 'interested' && styles.buttonActive,
          ]}
          onPress={handleInterested}
          disabled={loading}
        >
          <Ionicons 
            name={userStatus === 'interested' ? 'eye' : 'eye-outline'} 
            size={18} 
            color={userStatus === 'interested' ? '#fff' : '#667eea'} 
          />
          <Text style={[
            styles.buttonText,
            userStatus === 'interested' && styles.buttonTextActive,
          ]}>
            Interested
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.button,
            styles.goingButton,
            userStatus === 'going' && styles.goingButtonActive,
          ]}
          onPress={handleGoing}
          disabled={loading}
        >
          <Ionicons 
            name={userStatus === 'going' ? 'checkmark-circle' : 'checkmark-circle-outline'} 
            size={18} 
            color={userStatus === 'going' ? '#fff' : '#10b981'} 
          />
          <Text style={[
            styles.buttonText,
            styles.goingButtonText,
            userStatus === 'going' && styles.buttonTextActive,
          ]}>
            I'm Going
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#f8f9ff',
    borderRadius: 12,
    marginTop: 12,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  statsText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#667eea',
    backgroundColor: '#fff',
  },
  buttonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  goingButton: {
    borderColor: '#10b981',
  },
  goingButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  goingButtonText: {
    color: '#10b981',
  },
  buttonTextActive: {
    color: '#fff',
  },
});

export default InterestButton;
