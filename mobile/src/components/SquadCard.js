import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SquadCard = ({ squad, onJoin, onPress }) => {
  const spotsLeft = squad.maxMembers - squad.currentMembers;
  const isFull = spotsLeft <= 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} disabled={!onPress}>
      <View style={styles.header}>
        <Text style={styles.name}>{squad.name}</Text>
        <View style={[styles.statusBadge, isFull && styles.fullBadge]}>
          <Text style={[styles.statusText, isFull && styles.fullText]}>
            {isFull ? 'Full' : `${spotsLeft} spots`}
          </Text>
        </View>
      </View>
      
      {squad.description && (
        <Text style={styles.description} numberOfLines={2}>
          {squad.description}
        </Text>
      )}
      
      <View style={styles.footer}>
        <View style={styles.members}>
          <Ionicons name="people" size={16} color="#888" />
          <Text style={styles.memberCount}>
            {squad.currentMembers}/{squad.maxMembers}
          </Text>
        </View>
        
        {!isFull && onJoin && (
          <TouchableOpacity style={styles.joinButton} onPress={() => onJoin(squad)}>
            <Text style={styles.joinButtonText}>Join</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fullBadge: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2e7d32',
  },
  fullText: {
    color: '#c62828',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  members: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCount: {
    fontSize: 14,
    color: '#888',
  },
  joinButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SquadCard;
