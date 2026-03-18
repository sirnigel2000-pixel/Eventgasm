/**
 * AdminReviewScreen - Joey & Jeff's submission review panel
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'https://eventgasm.onrender.com';
const ADMIN_TOKEN = 'eventgasm-admin';

export default function AdminReviewScreen({ navigation }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/submissions/admin/queue`, {
        headers: { 'x-admin-token': ADMIN_TOKEN }
      });
      const data = await res.json();
      setSubmissions(data.submissions || []);
      setTotal(data.total || 0);
    } catch (e) {
      Alert.alert('Error', 'Could not load queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, []);

  const approve = async (id) => {
    try {
      await fetch(`${API_BASE}/api/submissions/admin/${id}/approve`, {
        method: 'POST',
        headers: { 'x-admin-token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: 'joey' })
      });
      setSubmissions(prev => prev.filter(s => s.id !== id));
      setTotal(t => t - 1);
    } catch (e) {
      Alert.alert('Error', 'Could not approve');
    }
  };

  const reject = async (id) => {
    Alert.prompt('Reject Event', 'Reason (optional):', async (reason) => {
      try {
        await fetch(`${API_BASE}/api/submissions/admin/${id}/reject`, {
          method: 'POST',
          headers: { 'x-admin-token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_id: 'joey', reason })
        });
        setSubmissions(prev => prev.filter(s => s.id !== id));
        setTotal(t => t - 1);
      } catch (e) {
        Alert.alert('Error', 'Could not reject');
      }
    });
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {item.is_update && (
        <View style={styles.updateBadge}>
          <Text style={styles.updateBadgeText}>UPDATE TO EXISTING EVENT</Text>
        </View>
      )}

      <Text style={styles.cardTitle}>{item.title}</Text>

      <View style={styles.meta}>
        <Ionicons name="calendar-outline" size={13} color="#666" />
        <Text style={styles.metaText}>
          {item.start_time ? new Date(item.start_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'No date'}
        </Text>
      </View>

      {item.venue_name && (
        <View style={styles.meta}>
          <Ionicons name="location-outline" size={13} color="#666" />
          <Text style={styles.metaText}>{item.venue_name}{item.city ? `, ${item.city}` : ''}</Text>
        </View>
      )}

      <View style={styles.meta}>
        <Ionicons name="person-outline" size={13} color="#666" />
        <Text style={styles.metaText}>Submitted by @{item.username || 'anonymous'}</Text>
      </View>

      <View style={styles.meta}>
        <Ionicons name="pricetag-outline" size={13} color="#666" />
        <Text style={styles.metaText}>{item.category} • {item.is_free ? 'Free' : item.price_min ? `$${item.price_min}+` : 'Paid'}</Text>
      </View>

      {item.description ? (
        <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
      ) : null}

      {item.is_update && item.existing_title && (
        <View style={styles.existingInfo}>
          <Text style={styles.existingLabel}>Existing event: {item.existing_title}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(item.id)}>
          <Ionicons name="close" size={20} color="#ef4444" />
          <Text style={styles.rejectText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.approveBtn} onPress={() => approve(item.id)}>
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.approveText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Review Queue</Text>
          <Text style={styles.headerSub}>{total} pending</Text>
        </View>
        <TouchableOpacity onPress={fetchQueue}>
          <Ionicons name="refresh" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {submissions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle" size={60} color="#22c55e" />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySub}>No pending submissions.</Text>
        </View>
      ) : (
        <FlatList
          data={submissions}
          renderItem={renderItem}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchQueue(); }} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 56, backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 13, color: '#666' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8,
  },
  updateBadge: {
    backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 8,
    paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8,
  },
  updateBadgeText: { color: '#92400e', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  metaText: { fontSize: 13, color: '#666', marginLeft: 5 },
  description: { color: '#555', fontSize: 14, marginTop: 8, lineHeight: 20 },
  existingInfo: { backgroundColor: '#f0f9ff', borderRadius: 8, padding: 10, marginTop: 10 },
  existingLabel: { color: '#0369a1', fontSize: 13 },
  actions: { flexDirection: 'row', marginTop: 14, gap: 10 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#ef4444', borderRadius: 10, padding: 12, gap: 6,
  },
  rejectText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000', borderRadius: 10, padding: 12, gap: 6,
  },
  approveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 16 },
  emptySub: { color: '#666', marginTop: 6 },
});
