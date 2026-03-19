/**
 * SubmitEventScreen
 * Two modes:
 *   1. Paste a URL → scrape & submit single event
 *   2. Link a source page (FB, venue, organizer) → ongoing auto-import
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Modal, Pressable, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'https://eventgasm.onrender.com';
const isWeb = Platform.OS === 'web';

export default function SubmitEventScreen({ navigation, route }) {
  const userId = route?.params?.userId || 'demo_user';

  const [tab, setTab] = useState('url'); // 'url' | 'source'
  const [urlInput, setUrlInput] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [sourceLinks, setSourceLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [preview, setPreview] = useState(null); // scraped event preview
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing source links when tab opens
  const loadSourceLinks = async () => {
    setLoadingLinks(true);
    try {
      const res = await fetch(`${API_BASE}/api/submissions/source-links?user_id=${userId}`);
      const data = await res.json();
      setSourceLinks(data.source_links || []);
    } catch(e) {}
    setLoadingLinks(false);
  };

  const handleTabChange = (t) => {
    setTab(t);
    if (t === 'source') loadSourceLinks();
  };

  // Scrape URL and show preview
  const handleScrapeUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) {
      Alert.alert('Invalid URL', 'Please paste a full link starting with http or https.');
      return;
    }
    setIsFetching(true);
    try {
      const res = await fetch(`${API_BASE}/api/submissions/scrape-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.event && data.event.title) {
        setPreview({ ...data.event, ticket_url: url });
        setShowPreview(true);
      } else {
        Alert.alert(
          'Couldn\'t read that page',
          'We couldn\'t extract event details automatically. Try a different link, or check that it\'s a public event page.',
        );
      }
    } catch(e) {
      Alert.alert('Error', 'Check your connection and try again.');
    }
    setIsFetching(false);
  };

  // Submit the scraped event
  const handleSubmitPreview = async () => {
    if (!preview?.title) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...preview,
          user_id: userId,
          username: userId,
          source_type: 'url_paste',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPreview(false);
        setUrlInput('');
        setPreview(null);
        Alert.alert('🎉 Submitted!', 'We\'ll review it shortly.', [
          { text: 'Nice!', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', data.error || 'Something went wrong');
      }
    } catch(e) {
      Alert.alert('Error', 'Check your connection.');
    }
    setIsSubmitting(false);
  };

  // Link a source page
  const handleLinkSource = async () => {
    const url = sourceInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) {
      Alert.alert('Invalid URL', 'Please paste a full link starting with http or https.');
      return;
    }
    setIsLinking(true);
    try {
      const res = await fetch(`${API_BASE}/api/submissions/source-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, url, label: sourceLabel || url }),
      });
      const data = await res.json();
      if (data.success) {
        setSourceInput('');
        setSourceLabel('');
        Alert.alert('✅ Source linked!', data.message);
        loadSourceLinks();
      } else {
        Alert.alert('Error', data.error || 'Something went wrong');
      }
    } catch(e) {
      Alert.alert('Error', 'Check your connection.');
    }
    setIsLinking(false);
  };

  // Delete a source link
  const handleDeleteSource = (id, label) => {
    Alert.alert('Remove source?', `Stop importing events from "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await fetch(`${API_BASE}/api/submissions/source-links/${id}?user_id=${userId}`, { method: 'DELETE' });
          loadSourceLinks();
        } catch(e) {}
      }},
    ]);
  };

  const fmt = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }); }
    catch(e) { return iso; }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="close" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add Events</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === 'url' && s.tabActive]}
          onPress={() => handleTabChange('url')}
        >
          <Ionicons name="link-outline" size={18} color={tab === 'url' ? '#fff' : '#666'} />
          <Text style={[s.tabText, tab === 'url' && s.tabTextActive]}>Paste a Link</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'source' && s.tabActive]}
          onPress={() => handleTabChange('source')}
        >
          <Ionicons name="refresh-outline" size={18} color={tab === 'source' ? '#fff' : '#666'} />
          <Text style={[s.tabText, tab === 'source' && s.tabTextActive]}>Link a Source</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.body} keyboardShouldPersistTaps="handled">

        {/* === URL TAB === */}
        {tab === 'url' && (
          <View>
            <Text style={s.sectionTitle}>Paste an event link</Text>
            <Text style={s.sectionSub}>
              Works with Eventbrite, Ticketmaster, Facebook events, venue websites, and more.
            </Text>

            <View style={s.inputRow}>
              <TextInput
                style={s.urlInput}
                placeholder="https://..."
                placeholderTextColor="#bbb"
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleScrapeUrl}
                autoFocus
              />
              <TouchableOpacity
                style={[s.goBtn, (!urlInput.trim() || isFetching) && s.goBtnDisabled]}
                onPress={handleScrapeUrl}
                disabled={!urlInput.trim() || isFetching}
              >
                {isFetching
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="arrow-forward" size={22} color="#fff" />
                }
              </TouchableOpacity>
            </View>

            <View style={s.tipBox}>
              <Ionicons name="bulb-outline" size={16} color="#7c3aed" />
              <Text style={s.tipText}>
                We'll automatically pull the event name, date, venue, and image from the page.
              </Text>
            </View>
          </View>
        )}

        {/* === SOURCE TAB === */}
        {tab === 'source' && (
          <View>
            <Text style={s.sectionTitle}>Link an event source</Text>
            <Text style={s.sectionSub}>
              Connect a Facebook page, venue website, or organizer page. We'll monitor it and automatically import new events.
            </Text>

            <Text style={s.label}>Source URL</Text>
            <TextInput
              style={s.input}
              placeholder="https://facebook.com/yourvenue"
              placeholderTextColor="#bbb"
              value={sourceInput}
              onChangeText={setSourceInput}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={s.label}>Label (optional)</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. The Fillmore Orlando"
              placeholderTextColor="#bbb"
              value={sourceLabel}
              onChangeText={setSourceLabel}
            />

            <TouchableOpacity
              style={[s.linkBtn, (!sourceInput.trim() || isLinking) && s.linkBtnDisabled]}
              onPress={handleLinkSource}
              disabled={!sourceInput.trim() || isLinking}
            >
              {isLinking
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                    <Text style={s.linkBtnText}>Link Source</Text>
                  </>
              }
            </TouchableOpacity>

            {/* Existing sources */}
            {loadingLinks ? (
              <ActivityIndicator style={{ marginTop: 24 }} />
            ) : sourceLinks.length > 0 ? (
              <View style={s.linkedSection}>
                <Text style={s.linkedTitle}>Your linked sources</Text>
                {sourceLinks.map(link => (
                  <View key={link.id} style={s.linkedCard}>
                    <View style={s.linkedCardInfo}>
                      <Text style={s.linkedCardLabel}>{link.label}</Text>
                      <Text style={s.linkedCardMeta}>
                        {link.events_found} events found • Last checked {link.last_scraped_at ? fmt(link.last_scraped_at) : 'never'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteSource(link.id, link.label)} style={s.deleteBtn}>
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.emptyLinks}>
                <Ionicons name="link-outline" size={32} color="#ddd" />
                <Text style={s.emptyLinksText}>No sources linked yet</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Preview Modal */}
      <Modal visible={showPreview} animationType="slide" transparent>
        <Pressable style={s.modalOverlay} onPress={() => setShowPreview(false)}>
          <Pressable style={s.previewModal} onPress={e => e.stopPropagation()}>
            <View style={s.previewHeader}>
              <Text style={s.previewTitle}>Looks right?</Text>
              <TouchableOpacity onPress={() => setShowPreview(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {preview && (
              <ScrollView style={s.previewBody}>
                <Text style={s.previewEventTitle}>{preview.title || '—'}</Text>
                {preview.start_time ? (
                  <View style={s.previewRow}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={s.previewMeta}>{fmt(preview.start_time)}</Text>
                  </View>
                ) : null}
                {preview.venue_name ? (
                  <View style={s.previewRow}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={s.previewMeta}>{preview.venue_name}{preview.city ? `, ${preview.city}` : ''}</Text>
                  </View>
                ) : null}
                {preview.description ? (
                  <Text style={s.previewDesc} numberOfLines={4}>{preview.description}</Text>
                ) : null}
                {!preview.start_time && (
                  <View style={s.warningBox}>
                    <Ionicons name="warning-outline" size={16} color="#d97706" />
                    <Text style={s.warningText}>No date found — you can still submit and our team will verify.</Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[s.submitBtn, isSubmitting && s.submitBtnDisabled]}
              onPress={handleSubmitPreview}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitBtnText}>Submit for Review</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowPreview(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000' },

  tabs: {
    flexDirection: 'row', margin: 16, backgroundColor: '#f3f4f6',
    borderRadius: 14, padding: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 11,
  },
  tabActive: { backgroundColor: '#000' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#fff' },

  body: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#000', marginTop: 8, marginBottom: 6 },
  sectionSub: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 24 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  urlInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 14,
    padding: 14, fontSize: 16, color: '#000', backgroundColor: '#fafafa',
  },
  goBtn: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center',
  },
  goBtnDisabled: { backgroundColor: '#d1d5db' },

  tipBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#f5f3ff', borderRadius: 12, padding: 14,
  },
  tipText: { flex: 1, fontSize: 13, color: '#4c1d95', lineHeight: 18 },

  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 12,
    padding: 14, fontSize: 16, color: '#000', backgroundColor: '#fafafa',
  },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#000', borderRadius: 14, padding: 16, marginTop: 24,
  },
  linkBtnDisabled: { backgroundColor: '#d1d5db' },
  linkBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  linkedSection: { marginTop: 32 },
  linkedTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 12 },
  linkedCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 12,
    padding: 14, marginBottom: 10,
  },
  linkedCardInfo: { flex: 1 },
  linkedCardLabel: { fontSize: 15, fontWeight: '600', color: '#000' },
  linkedCardMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  deleteBtn: { padding: 4 },

  emptyLinks: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyLinksText: { color: '#bbb', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  previewModal: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '80%',
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  previewTitle: { fontSize: 20, fontWeight: '800', color: '#000' },
  previewBody: { maxHeight: 260 },
  previewEventTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 12 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  previewMeta: { fontSize: 14, color: '#444' },
  previewDesc: { fontSize: 13, color: '#666', lineHeight: 19, marginTop: 8 },
  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginTop: 12,
  },
  warningText: { flex: 1, fontSize: 13, color: '#92400e' },

  submitBtn: {
    backgroundColor: '#000', borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 20,
  },
  submitBtnDisabled: { backgroundColor: '#d1d5db' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { alignItems: 'center', padding: 14 },
  cancelBtnText: { color: '#888', fontSize: 15 },
});
