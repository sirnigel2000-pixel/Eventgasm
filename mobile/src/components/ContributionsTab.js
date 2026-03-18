/**
 * ContributionsTab - Contributor stats, badge, submissions, leaderboard
 * Embedded in ProfileScreen as a tab
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, FlatList, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'https://eventgasm.onrender.com';

const TIERS = {
  none: {
    label: 'Not yet a contributor',
    color: '#9ca3af',
    bg: '#f3f4f6',
    icon: 'ribbon-outline',
    next: 'Submit your first event to become a Contributor',
    nextAt: 1,
  },
  contributor: {
    label: 'Contributor',
    color: '#2563eb',
    bg: '#eff6ff',
    icon: 'ribbon',
    next: 'Submit 5 approved events for Verified status',
    nextAt: 5,
  },
  verified_contributor: {
    label: 'Verified Contributor',
    color: '#7c3aed',
    bg: '#f5f3ff',
    icon: 'shield-checkmark',
    next: 'Submit 10 approved events for Top Contributor',
    nextAt: 10,
  },
  top_contributor: {
    label: 'Top Contributor',
    color: '#d97706',
    bg: '#fffbeb',
    icon: 'trophy',
    next: 'You\'ve reached the top!',
    nextAt: null,
  },
};

const STATUS_COLORS = {
  pending: { bg: '#fef3c7', text: '#92400e', label: 'Under Review' },
  approved: { bg: '#d1fae5', text: '#065f46', label: 'Live' },
  rejected: { bg: '#fee2e2', text: '#991b1b', label: 'Not Approved' },
};

export default function ContributionsTab({ userId, username, navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [view, setView] = useState('mine'); // 'mine' | 'leaderboard'

  const fetchData = async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const [myRes, boardRes] = await Promise.all([
        fetch(`${API_BASE}/api/submissions/my?user_id=${userId}`),
        fetch(`${API_BASE}/api/submissions/leaderboard`),
      ]);
      const myData = await myRes.json();
      const boardData = await boardRes.json();
      setStats(myData.stats);
      setSubmissions(myData.submissions || []);
      setLeaderboard(boardData.leaderboard || []);
    } catch (e) {
      console.log('ContributionsTab fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId]);

  const tier = TIERS[stats?.tier || 'none'];
  const approved = stats?.approved_count || 0;
  const nextAt = tier.nextAt;
  const progress = nextAt ? Math.min(approved / nextAt, 1) : 1;

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color="#000" />
    </View>
  );

  if (!userId) return (
    <View style={styles.center}>
      <Ionicons name="ribbon-outline" size={48} color="#ccc" />
      <Text style={styles.emptyTitle}>Sign in to track contributions</Text>
      <Text style={styles.emptySub}>Submit events and earn badges</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
    >
      {/* Badge Card */}
      <View style={[styles.badgeCard, { backgroundColor: tier.bg }]}>
        <View style={styles.badgeLeft}>
          <Ionicons name={tier.icon} size={36} color={tier.color} />
          <View style={styles.badgeInfo}>
            <Text style={[styles.badgeLabel, { color: tier.color }]}>{tier.label}</Text>
            <Text style={styles.badgeCount}>{approved} event{approved !== 1 ? 's' : ''} approved</Text>
          </View>
        </View>
      </View>

      {/* Progress to next tier */}
      {nextAt && (
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>{tier.next}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: tier.color }]} />
          </View>
          <Text style={styles.progressCount}>{approved} / {nextAt}</Text>
        </View>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{approved}</Text>
          <Text style={styles.statLbl}>Approved</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{stats?.pending_count || 0}</Text>
          <Text style={styles.statLbl}>Pending</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{submissions.length}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
      </View>

      {/* Submit CTA */}
      <TouchableOpacity
        style={styles.submitCta}
        onPress={() => navigation?.navigate('SubmitTab')}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.submitCtaText}>Submit an Event</Text>
      </TouchableOpacity>

      {/* Toggle: My Submissions / Leaderboard */}
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'mine' && styles.toggleActive]}
          onPress={() => setView('mine')}
        >
          <Text style={[styles.toggleText, view === 'mine' && styles.toggleTextActive]}>My Submissions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'leaderboard' && styles.toggleActive]}
          onPress={() => setView('leaderboard')}
        >
          <Text style={[styles.toggleText, view === 'leaderboard' && styles.toggleTextActive]}>Leaderboard</Text>
        </TouchableOpacity>
      </View>

      {/* My submissions */}
      {view === 'mine' && (
        submissions.length === 0 ? (
          <View style={styles.emptyList}>
            <Ionicons name="calendar-outline" size={36} color="#ccc" />
            <Text style={styles.emptyListText}>No submissions yet</Text>
            <Text style={styles.emptyListSub}>Be the first to add events in your area</Text>
          </View>
        ) : (
          submissions.map(sub => {
            const status = STATUS_COLORS[sub.status] || STATUS_COLORS.pending;
            return (
              <View key={sub.id} style={styles.subCard}>
                <View style={styles.subCardRow}>
                  <Text style={styles.subTitle} numberOfLines={1}>{sub.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.subMeta}>
                  {sub.venue_name ? `${sub.venue_name} • ` : ''}
                  {sub.start_time ? new Date(sub.start_time).toLocaleDateString() : 'No date'}
                  {sub.is_update ? ' • Update' : ''}
                </Text>
                {sub.admin_note && sub.status === 'rejected' && (
                  <Text style={styles.rejectReason}>Reason: {sub.admin_note}</Text>
                )}
              </View>
            );
          })
        )
      )}

      {/* Leaderboard */}
      {view === 'leaderboard' && (
        leaderboard.length === 0 ? (
          <View style={styles.emptyList}>
            <Ionicons name="trophy-outline" size={36} color="#ccc" />
            <Text style={styles.emptyListText}>No contributors yet</Text>
            <Text style={styles.emptyListSub}>Be the first on the leaderboard!</Text>
          </View>
        ) : (
          leaderboard.map((entry, index) => {
            const entryTier = TIERS[entry.tier || 'contributor'];
            const isMe = entry.user_id === userId;
            return (
              <View key={entry.user_id} style={[styles.leaderRow, isMe && styles.leaderRowMe]}>
                <Text style={styles.leaderRank}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </Text>
                <Ionicons name={entryTier.icon} size={18} color={entryTier.color} style={{ marginHorizontal: 8 }} />
                <Text style={[styles.leaderName, isMe && { fontWeight: '700' }]}>
                  @{entry.username || 'anonymous'}{isMe ? ' (you)' : ''}
                </Text>
                <Text style={styles.leaderCount}>{entry.approved_count} events</Text>
              </View>
            );
          })
        )
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 12, color: '#333' },
  emptySub: { color: '#999', marginTop: 4, textAlign: 'center' },

  badgeCard: {
    margin: 16, borderRadius: 16, padding: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  badgeLeft: { flexDirection: 'row', alignItems: 'center' },
  badgeInfo: { marginLeft: 14 },
  badgeLabel: { fontSize: 17, fontWeight: '700' },
  badgeCount: { fontSize: 13, color: '#666', marginTop: 2 },

  progressSection: { paddingHorizontal: 16, marginBottom: 16 },
  progressLabel: { fontSize: 13, color: '#666', marginBottom: 8 },
  progressBar: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressCount: { fontSize: 12, color: '#999', marginTop: 4, textAlign: 'right' },

  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, gap: 10 },
  statBox: {
    flex: 1, backgroundColor: '#f9fafb', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  statNum: { fontSize: 24, fontWeight: '800', color: '#000' },
  statLbl: { fontSize: 12, color: '#666', marginTop: 2 },

  submitCta: {
    marginHorizontal: 16, backgroundColor: '#000', borderRadius: 12,
    padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 20,
  },
  submitCtaText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  toggle: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#f3f4f6', borderRadius: 10, padding: 3,
  },
  toggleBtn: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center' },
  toggleActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3 },
  toggleText: { fontSize: 14, color: '#666', fontWeight: '500' },
  toggleTextActive: { color: '#000', fontWeight: '600' },

  subCard: {
    marginHorizontal: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 10, padding: 14,
  },
  subCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subTitle: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  subMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  rejectReason: { color: '#ef4444', fontSize: 12, marginTop: 4 },

  emptyList: { alignItems: 'center', padding: 40 },
  emptyListText: { fontSize: 16, fontWeight: '600', color: '#666', marginTop: 10 },
  emptyListSub: { color: '#999', fontSize: 13, marginTop: 4, textAlign: 'center' },

  leaderRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 10, padding: 14,
  },
  leaderRowMe: { borderColor: '#000', borderWidth: 1.5 },
  leaderRank: { fontSize: 16, width: 30 },
  leaderName: { flex: 1, fontSize: 15, color: '#000' },
  leaderCount: { fontSize: 13, color: '#666', fontWeight: '600' },
});
