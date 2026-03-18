/**
 * AdminReviewScreen - Joey & Jeff's submission review panel
 * With event preview before approving
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal,
  ScrollView, Image, TextInput, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const isWeb = Platform.OS === 'web';
const API_BASE = 'https://eventgasm.onrender.com';
const ADMIN_TOKEN = 'eventgasm-admin';

const REJECT_REASONS = [
  'Duplicate event',
  'Incomplete information',
  'Spam or fake event',
  'Not an event',
  'Inappropriate content',
  'Other',
];

const CATEGORY_ICONS = {
  Music: 'musical-notes', Sports: 'football', Comedy: 'mic',
  Theater: 'film', Arts: 'color-palette', Festival: 'sparkles',
  Food: 'restaurant', Family: 'people', Nightlife: 'moon',
  Community: 'heart', Other: 'calendar',
};

export default function AdminReviewScreen({ navigation }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [preview, setPreview] = useState(null); // submission being previewed
  const [rejectModal, setRejectModal] = useState(null); // id being rejected
  const [customReason, setCustomReason] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [isActing, setIsActing] = useState(false);

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
    setIsActing(true);
    try {
      await fetch(`${API_BASE}/api/submissions/admin/${id}/approve`, {
        method: 'POST',
        headers: { 'x-admin-token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: 'joey' })
      });
      setSubmissions(prev => prev.filter(s => s.id !== id));
      setTotal(t => t - 1);
      setPreview(null);
    } catch (e) {
      Alert.alert('Error', 'Could not approve');
    } finally {
      setIsActing(false);
    }
  };

  const reject = async (id, reason) => {
    setIsActing(true);
    try {
      await fetch(`${API_BASE}/api/submissions/admin/${id}/reject`, {
        method: 'POST',
        headers: { 'x-admin-token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: 'joey', reason })
      });
      setSubmissions(prev => prev.filter(s => s.id !== id));
      setTotal(t => t - 1);
      setRejectModal(null);
      setPreview(null);
      setSelectedReason('');
      setCustomReason('');
    } catch (e) {
      Alert.alert('Error', 'Could not reject');
    } finally {
      setIsActing(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return 'No date';
    return new Date(d).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  };

  const formatTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
  };

  // ---- EVENT PREVIEW MODAL ----
  const EventPreview = ({ item, onClose }) => {
    const icon = CATEGORY_ICONS[item.category] || 'calendar';
    return (
      <Modal visible animationType="slide" transparent>
        <View style={previewStyles.overlay}>
          <View style={previewStyles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Image or placeholder */}
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={previewStyles.heroImage} />
              ) : (
                <View style={previewStyles.heroPlaceholder}>
                  <Ionicons name={icon} size={48} color="rgba(255,255,255,0.4)" />
                  <Text style={previewStyles.heroCategory}>{item.category || 'Event'}</Text>
                </View>
              )}

              {/* Submission badge */}
              <View style={previewStyles.submissionBanner}>
                <Ionicons name={item.is_update ? 'refresh-circle' : 'add-circle'} size={14} color="#92400e" />
                <Text style={previewStyles.submissionBannerText}>
                  {item.is_update ? 'UPDATE SUBMISSION' : 'NEW SUBMISSION'} by @{item.username || 'anonymous'}
                </Text>
              </View>

              <View style={previewStyles.body}>
                {/* Title */}
                <Text style={previewStyles.title}>{item.title}</Text>

                {/* Date + time */}
                <View style={previewStyles.metaRow}>
                  <Ionicons name="calendar" size={15} color="#666" />
                  <Text style={previewStyles.metaText}>
                    {formatDate(item.start_time)}{item.start_time ? ` at ${formatTime(item.start_time)}` : ''}
                  </Text>
                </View>

                {/* Venue */}
                {(item.venue_name || item.city) && (
                  <View style={previewStyles.metaRow}>
                    <Ionicons name="location" size={15} color="#666" />
                    <Text style={previewStyles.metaText}>
                      {[item.venue_name, item.city, item.state].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                )}

                {/* Price */}
                <View style={previewStyles.metaRow}>
                  <Ionicons name="pricetag" size={15} color="#666" />
                  <Text style={previewStyles.metaText}>
                    {item.is_free ? 'Free' : item.price_min ? `From $${item.price_min}` : 'Paid'}
                  </Text>
                </View>

                {/* Ticket link */}
                {item.ticket_url && (
                  <View style={previewStyles.metaRow}>
                    <Ionicons name="link" size={15} color="#666" />
                    <Text style={previewStyles.metaLink} numberOfLines={1}>{item.ticket_url}</Text>
                  </View>
                )}

                {/* Description */}
                {item.description && (
                  <View style={previewStyles.descBox}>
                    <Text style={previewStyles.descText}>{item.description}</Text>
                  </View>
                )}

                {/* If update - show what's changing */}
                {item.is_update && item.existing_title && (
                  <View style={previewStyles.updateBox}>
                    <Text style={previewStyles.updateLabel}>Updating existing event:</Text>
                    <Text style={previewStyles.updateExisting}>"{item.existing_title}"</Text>
                  </View>
                )}

                {/* Category badge */}
                <View style={previewStyles.catBadge}>
                  <Ionicons name={icon} size={13} color="#4338ca" />
                  <Text style={previewStyles.catBadgeText}>{item.category}</Text>
                </View>
              </View>
            </ScrollView>

            {/* Action bar */}
            <View style={previewStyles.actionBar}>
              <TouchableOpacity style={previewStyles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity
                style={previewStyles.rejectBtn}
                onPress={() => { setRejectModal(item.id); }}
              >
                <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                <Text style={previewStyles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[previewStyles.approveBtn, isActing && { opacity: 0.6 }]}
                onPress={() => approve(item.id)}
                disabled={isActing}
              >
                {isActing
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={previewStyles.approveBtnText}>Approve & Publish</Text>
                  </>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ---- REJECT MODAL ----
  const RejectModal = ({ id, onClose }) => (
    <Modal visible animationType="fade" transparent>
      <View style={rejectStyles.overlay}>
        <View style={rejectStyles.card}>
          <Text style={rejectStyles.title}>Why are you rejecting this?</Text>
          <View style={rejectStyles.reasons}>
            {REJECT_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[rejectStyles.reason, selectedReason === r && rejectStyles.reasonActive]}
                onPress={() => setSelectedReason(r)}
              >
                <Ionicons
                  name={selectedReason === r ? 'radio-button-on' : 'radio-button-off'}
                  size={16}
                  color={selectedReason === r ? '#000' : '#9ca3af'}
                />
                <Text style={[rejectStyles.reasonText, selectedReason === r && { color: '#000', fontWeight: '600' }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedReason === 'Other' && (
            <TextInput
              style={rejectStyles.customInput}
              placeholder="Explain why..."
              value={customReason}
              onChangeText={setCustomReason}
              multiline
            />
          )}
          <View style={rejectStyles.actions}>
            <TouchableOpacity style={rejectStyles.cancelBtn} onPress={onClose}>
              <Text style={rejectStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rejectStyles.rejectBtn, !selectedReason && { opacity: 0.4 }]}
              disabled={!selectedReason || isActing}
              onPress={() => {
                const reason = selectedReason === 'Other' ? customReason || 'Other' : selectedReason;
                reject(id, reason);
              }}
            >
              {isActing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={rejectStyles.rejectText}>Reject</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ---- QUEUE CARD ----
  const renderItem = ({ item }) => (
    <TouchableOpacity style={queueStyles.card} onPress={() => setPreview(item)} activeOpacity={0.8}>
      <View style={queueStyles.cardLeft}>
        {item.is_update && (
          <View style={queueStyles.updatePill}>
            <Text style={queueStyles.updatePillText}>UPDATE</Text>
          </View>
        )}
        <Text style={queueStyles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={queueStyles.cardMeta}>
          {formatDate(item.start_time)}
          {item.venue_name ? ` · ${item.venue_name}` : ''}
        </Text>
        <Text style={queueStyles.cardUser}>@{item.username || 'anonymous'} · {item.category}</Text>
      </View>
      <View style={queueStyles.cardRight}>
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  if (loading) return <View style={queueStyles.center}><ActivityIndicator size="large" /></View>;

  return (
    <View style={queueStyles.container}>
      {/* Header */}
      <View style={queueStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View>
          <Text style={queueStyles.headerTitle}>Review Queue</Text>
          <Text style={queueStyles.headerSub}>{total} pending · Tap to preview</Text>
        </View>
        <TouchableOpacity onPress={() => { setLoading(true); fetchQueue(); }}>
          <Ionicons name="refresh" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      {submissions.length === 0 ? (
        <View style={queueStyles.empty}>
          <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
          <Text style={queueStyles.emptyTitle}>All caught up!</Text>
          <Text style={queueStyles.emptySub}>No pending submissions.</Text>
        </View>
      ) : (
        <FlatList
          data={submissions}
          renderItem={renderItem}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchQueue(); }} />}
        />
      )}

      {/* Preview modal */}
      {preview && <EventPreview item={preview} onClose={() => setPreview(null)} />}

      {/* Reject modal */}
      {rejectModal && <RejectModal id={rejectModal} onClose={() => { setRejectModal(null); setSelectedReason(''); setCustomReason(''); }} />}
    </View>
  );
}

// ---- STYLES ----

const queueStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 56, backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4,
  },
  cardLeft: { flex: 1 },
  cardRight: { marginLeft: 8 },
  updatePill: { backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 6 },
  updatePillText: { color: '#92400e', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  cardUser: { fontSize: 12, color: '#9ca3af' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 16 },
  emptySub: { color: '#9ca3af', marginTop: 4 },
});

const previewStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%', overflow: 'hidden',
  },
  heroImage: { width: '100%', height: 200, resizeMode: 'cover' },
  heroPlaceholder: {
    width: '100%', height: 160,
    backgroundColor: '#1f2937',
    justifyContent: 'center', alignItems: 'center',
  },
  heroCategory: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8 },
  submissionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fffbeb', paddingHorizontal: 16, paddingVertical: 8,
  },
  submissionBannerText: { fontSize: 11, color: '#92400e', fontWeight: '700', letterSpacing: 0.5 },
  body: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  metaText: { fontSize: 14, color: '#4b5563', flex: 1 },
  metaLink: { fontSize: 13, color: '#3b82f6', flex: 1 },
  descBox: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 14, marginVertical: 12 },
  descText: { fontSize: 14, color: '#374151', lineHeight: 21 },
  updateBox: { backgroundColor: '#fff7ed', borderRadius: 10, padding: 14, marginBottom: 12 },
  updateLabel: { fontSize: 11, fontWeight: '700', color: '#92400e', marginBottom: 4 },
  updateExisting: { fontSize: 14, color: '#78350f' },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#eef2ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
  catBadgeText: { fontSize: 13, color: '#4338ca', fontWeight: '600' },
  actionBar: {
    flexDirection: 'row', padding: 16, paddingBottom: 32, gap: 10,
    borderTopWidth: 0.5, borderTopColor: '#e5e5e5', backgroundColor: '#fff',
    alignItems: 'center',
  },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#ef4444', borderRadius: 12, padding: 13 },
  rejectBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
  approveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#000', borderRadius: 12, padding: 13 },
  approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const rejectStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  reasons: { gap: 2 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10 },
  reasonActive: { backgroundColor: '#f3f4f6' },
  reasonText: { fontSize: 15, color: '#6b7280' },
  customInput: { borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 10, padding: 12, marginTop: 8, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 12, padding: 13, alignItems: 'center' },
  cancelText: { fontWeight: '600', color: '#666' },
  rejectBtn: { flex: 1, backgroundColor: '#ef4444', borderRadius: 12, padding: 13, alignItems: 'center' },
  rejectText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
