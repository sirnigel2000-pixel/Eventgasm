/**
 * SubmitEventScreen - Fast event submission
 * Big dumb camera button + collapsed form + quick date picker
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Switch, Modal, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

const isWeb = Platform.OS === 'web';

const API_BASE = 'https://eventgasm.onrender.com';

const CATEGORIES = [
  'Music', 'Sports', 'Comedy', 'Theater', 'Arts', 'Festival',
  'Food', 'Family', 'Nightlife', 'Community', 'Other'
];

// Quick date options
const QUICK_DATES = [
  { label: 'Tonight', getValue: () => { const d = new Date(); d.setHours(20, 0, 0, 0); return d; } },
  { label: 'Tomorrow', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0); return d; } },
  { label: 'This Sat', getValue: () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (6 - day + 7) % 7); d.setHours(20, 0, 0, 0); return d; } },
  { label: 'This Sun', getValue: () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (7 - day) % 7); d.setHours(14, 0, 0, 0); return d; } },
];

// Time options
const QUICK_TIMES = ['6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM', '12 AM'];

export default function SubmitEventScreen({ navigation }) {
  const [mode, setMode] = useState('choice'); // 'choice' | 'camera' | 'form'
  const [cameraPermission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showExtras, setShowExtras] = useState(false); // collapsed extras
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Music',
    venue_name: '',
    city: '',
    start_time: null,
    ticket_url: '',
    is_free: false,
    price_min: '',
    price_max: '',
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const formatDate = (d) => {
    if (!d) return null;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (d) => {
    if (!d) return null;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const setQuickDate = (quickDate) => {
    const d = quickDate.getValue();
    // Keep existing time if set
    if (form.start_time) {
      d.setHours(form.start_time.getHours(), form.start_time.getMinutes());
    }
    update('start_time', d);
    setShowDateModal(false);
  };

  const setQuickTime = (timeStr) => {
    const base = form.start_time || new Date();
    const d = new Date(base);
    const [hourStr, period] = timeStr.split(' ');
    let hour = parseInt(hourStr);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    d.setHours(hour, 0, 0, 0);
    update('start_time', d);
    setShowTimeModal(false);
  };

  // === CAMERA FLOW ===
  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera needed', 'Allow camera access to scan event posters.');
        return;
      }
    }
    setMode('camera');
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    setIsScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: true });
      setCapturedImage(photo.uri);
      await extractFromImage(photo.base64);
    } catch (e) {
      Alert.alert('Error', 'Could not capture. Try again.');
      setIsScanning(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setIsScanning(true);
      setCapturedImage(result.assets[0].uri);
      await extractFromImage(result.assets[0].base64);
    }
  };

  const extractFromImage = async (base64) => {
    try {
      const formData = new FormData();
      formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: { apikey: 'K81721619988957' },
        body: formData,
      });
      const data = await response.json();
      const text = data?.ParsedResults?.[0]?.ParsedText || '';
      if (text) prefillFromText(text);
    } catch (e) {
      console.log('OCR error:', e.message);
    } finally {
      setIsScanning(false);
      setMode('form');
    }
  };

  const prefillFromText = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const titleLine = lines.find(l => l.length > 3 && l.length < 100);
    if (titleLine && !form.title) update('title', titleLine);

    const datePattern = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i;
    const dateLine = lines.find(l => datePattern.test(l));
    if (dateLine) {
      try {
        const match = dateLine.match(datePattern);
        if (match) {
          const parsed = new Date(match[0]);
          if (!isNaN(parsed)) update('start_time', parsed);
        }
      } catch (e) {}
    }

    const venueLine = lines.find(l => l.includes('@') || /^at\s+/i.test(l));
    if (venueLine) {
      const venuePart = venueLine.split('@').pop()?.trim() || venueLine.replace(/^at\s+/i, '');
      if (venuePart && !form.venue_name) update('venue_name', venuePart.substring(0, 100));
    }

    if (text.toLowerCase().includes('free')) update('is_free', true);
  };

  // === URL FLOW ===
  const [urlInput, setUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  const fetchFromUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingUrl(true);
    try {
      const res = await fetch(`${API_BASE}/api/submissions/scrape-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (data.event) setForm(prev => ({ ...prev, ...data.event }));
      setMode('form');
    } catch (e) {
      setMode('form');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // === SUBMIT ===
  const checkDuplicates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/submissions/check-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, start_time: form.start_time, venue_name: form.venue_name }),
      });
      const data = await res.json();
      return data.duplicates || [];
    } catch (e) { return []; }
  };

  const handleSubmit = async (forceNew = false, existingEventId = null) => {
    if (!form.title.trim()) {
      Alert.alert('What\'s the event called?');
      return;
    }
    if (!form.start_time) {
      Alert.alert('When is it?', 'Pick a date to continue.');
      return;
    }
    setIsSubmitting(true);
    setShowDuplicate(false);

    try {
      if (!forceNew && !existingEventId) {
        const dupes = await checkDuplicates();
        if (dupes.length > 0) {
          setDuplicates(dupes);
          setShowDuplicate(true);
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        ...form,
        start_time: form.start_time?.toISOString(),
        price_min: form.price_min ? parseFloat(form.price_min) : null,
        price_max: form.price_max ? parseFloat(form.price_max) : null,
        user_id: 'demo_user',
        username: 'you',
        is_update: !!existingEventId,
        event_id: existingEventId || null,
        source_type: capturedImage ? 'photo_scan' : 'manual',
      };

      const res = await fetch(`${API_BASE}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        Alert.alert(
          data.is_update ? 'Update submitted!' : '🎉 Event submitted!',
          data.message,
          [{ text: 'Nice!', onPress: () => { navigation.goBack(); } }]
        );
      } else {
        Alert.alert('Error', data.error || 'Something went wrong');
      }
    } catch (e) {
      Alert.alert('Error', 'Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // === CAMERA SCREEN (mobile only) ===
  if (mode === 'camera' && !isWeb) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraFrame} />
            <Text style={styles.cameraHint}>Aim at the event poster</Text>
          </View>
        </CameraView>

        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.cameraIconBtn} onPress={() => setMode('choice')}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {/* BIG FAT SHUTTER */}
          <TouchableOpacity
            style={styles.shutterBtn}
            onPress={takePicture}
            disabled={isScanning}
            activeOpacity={0.7}
          >
            {isScanning
              ? <ActivityIndicator color="#000" size="large" />
              : <View style={styles.shutterInner} />
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.cameraIconBtn} onPress={pickFromGallery}>
            <Ionicons name="images" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {isScanning && (
          <View style={styles.scanningOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.scanningText}>Reading poster...</Text>
          </View>
        )}
      </View>
    );
  }

  // === CHOICE SCREEN ===
  if (mode === 'choice') {
    return (
      <View style={styles.choiceContainer}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="#666" />
        </TouchableOpacity>

        <Text style={styles.choiceTitle}>Add an Event</Text>

        {/* Camera (mobile) or Image upload (web) */}
        {isWeb ? (
          <TouchableOpacity style={styles.bigCameraBtn} onPress={pickFromGallery} activeOpacity={0.8}>
            <Ionicons name="image" size={52} color="#fff" />
            <Text style={styles.bigCameraBtnLabel}>Upload a Flyer</Text>
            <Text style={styles.bigCameraBtnSub}>Upload a photo of the event poster</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.bigCameraBtn} onPress={openCamera} activeOpacity={0.8}>
            <Ionicons name="camera" size={52} color="#fff" />
            <Text style={styles.bigCameraBtnLabel}>Scan a Poster</Text>
            <Text style={styles.bigCameraBtnSub}>Point at any flyer or poster</Text>
          </TouchableOpacity>
        )}

        {/* URL input */}
        <View style={styles.urlRow}>
          <Ionicons name="link-outline" size={20} color="#888" />
          <TextInput
            style={styles.urlInput}
            placeholder="Paste a link..."
            placeholderTextColor="#bbb"
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={fetchFromUrl}
          />
          {urlInput.length > 0 && (
            <TouchableOpacity onPress={fetchFromUrl} disabled={isFetchingUrl}>
              {isFetchingUrl
                ? <ActivityIndicator size="small" color="#000" />
                : <Ionicons name="arrow-forward-circle" size={30} color="#000" />
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Manual */}
        <TouchableOpacity style={styles.manualBtn} onPress={() => setMode('form')}>
          <Ionicons name="create-outline" size={20} color="#555" />
          <Text style={styles.manualBtnText}>Fill in manually</Text>
        </TouchableOpacity>

        {/* Badge callout */}
        <View style={styles.badgeCallout}>
          <Text style={styles.badgeCalloutText}>
            Submit 5 events → earn <Text style={{ fontWeight: '700', color: '#7c3aed' }}>Verified Contributor</Text> badge
          </Text>
        </View>
      </View>
    );
  }

  // === FORM SCREEN ===
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Header */}
      <View style={styles.formHeader}>
        <TouchableOpacity onPress={() => setMode('choice')} style={styles.formBackBtn}>
          <Ionicons name="chevron-back" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={styles.formTitle}>Event Details</Text>
        <TouchableOpacity
          style={[styles.submitBtn, (!form.title || !form.start_time || isSubmitting) && styles.submitBtnDisabled]}
          onPress={() => handleSubmit()}
          disabled={!form.title || !form.start_time || isSubmitting}
        >
          {isSubmitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.submitBtnText}>Submit</Text>
          }
        </TouchableOpacity>
      </View>

      {capturedImage && (
        <View style={styles.scanPreview}>
          <Image source={{ uri: capturedImage }} style={styles.scanImage} />
          <Text style={styles.scanLabel}>Scanned from photo — edit below</Text>
        </View>
      )}

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">

        {/* === REQUIRED FIELDS === */}

        {/* Title */}
        <TextInput
          style={styles.titleInput}
          placeholder="What's the event? *"
          placeholderTextColor="#bbb"
          value={form.title}
          onChangeText={v => update('title', v)}
          autoFocus={!capturedImage}
          returnKeyType="next"
        />

        {/* Date + Time row */}
        {isWeb ? (
          <View style={styles.dateTimeRow}>
            <View style={[styles.dateBtn, { flex: 2 }]}>
              <Ionicons name="calendar-outline" size={18} color="#888" />
              <TextInput
                style={[styles.dateBtnText, { flex: 1 }]}
                placeholder="Date (MM/DD/YYYY) *"
                placeholderTextColor="#bbb"
                value={form.start_time ? formatDate(form.start_time) : ''}
                onChangeText={v => {
                  const d = new Date(v);
                  if (!isNaN(d)) update('start_time', d);
                }}
              />
            </View>
            <View style={[styles.timeBtn, { flex: 1 }]}>
              <Ionicons name="time-outline" size={18} color="#888" />
              <TextInput
                style={[styles.dateBtnText, { flex: 1 }]}
                placeholder="8:00 PM"
                placeholderTextColor="#bbb"
                value={form.start_time ? formatTime(form.start_time) : ''}
              />
            </View>
          </View>
        ) : (
          <View style={styles.dateTimeRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDateModal(true)}>
              <Ionicons name="calendar-outline" size={18} color={form.start_time ? '#000' : '#bbb'} />
              <Text style={[styles.dateBtnText, !form.start_time && { color: '#bbb' }]}>
                {form.start_time ? formatDate(form.start_time) : 'Date *'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.timeBtn} onPress={() => setShowTimeModal(true)}>
              <Ionicons name="time-outline" size={18} color={form.start_time ? '#000' : '#bbb'} />
              <Text style={[styles.dateBtnText, !form.start_time && { color: '#bbb' }]}>
                {form.start_time ? formatTime(form.start_time) : 'Time'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Venue + City */}
        <TextInput
          style={styles.input}
          placeholder="Venue / location"
          placeholderTextColor="#bbb"
          value={form.venue_name}
          onChangeText={v => update('venue_name', v)}
        />
        <TextInput
          style={styles.input}
          placeholder="City"
          placeholderTextColor="#bbb"
          value={form.city}
          onChangeText={v => update('city', v)}
        />

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, form.category === cat && styles.catChipActive]}
              onPress={() => update('category', cat)}
            >
              <Text style={[styles.catChipText, form.category === cat && styles.catChipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Free toggle */}
        <View style={styles.freeRow}>
          <Text style={styles.freeLabel}>Free event</Text>
          <Switch value={form.is_free} onValueChange={v => update('is_free', v)} trackColor={{ true: '#000' }} />
        </View>

        {/* === EXTRA DETAILS (collapsed) === */}
        <TouchableOpacity style={styles.extrasToggle} onPress={() => setShowExtras(!showExtras)}>
          <Text style={styles.extrasToggleText}>{showExtras ? 'Hide extra details' : '+ Add description, ticket link, price'}</Text>
          <Ionicons name={showExtras ? 'chevron-up' : 'chevron-down'} size={16} color="#888" />
        </TouchableOpacity>

        {showExtras && (
          <View>
            {!form.is_free && (
              <View style={styles.priceRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  placeholder="Min price $"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#bbb"
                  value={form.price_min}
                  onChangeText={v => update('price_min', v)}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Max price $"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#bbb"
                  value={form.price_max}
                  onChangeText={v => update('price_max', v)}
                />
              </View>
            )}
            <TextInput
              style={styles.input}
              placeholder="Ticket link (optional)"
              placeholderTextColor="#bbb"
              value={form.ticket_url}
              onChangeText={v => update('ticket_url', v)}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Description (optional)"
              placeholderTextColor="#bbb"
              value={form.description}
              onChangeText={v => update('description', v)}
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* === DATE MODAL === */}
      <Modal visible={showDateModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDateModal(false)}>
          <View style={styles.quickPickModal}>
            <Text style={styles.quickPickTitle}>When is it?</Text>
            <View style={styles.quickPickRow}>
              {QUICK_DATES.map(qd => (
                <TouchableOpacity key={qd.label} style={styles.quickPickBtn} onPress={() => setQuickDate(qd)}>
                  <Text style={styles.quickPickBtnText}>{qd.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.otherDateBtn} onPress={() => {
              // fallback - just close and show native picker would need DateTimePicker
              setShowDateModal(false);
            }}>
              <Text style={styles.otherDateText}>Other date →</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* === TIME MODAL === */}
      <Modal visible={showTimeModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowTimeModal(false)}>
          <View style={styles.quickPickModal}>
            <Text style={styles.quickPickTitle}>What time?</Text>
            <View style={styles.timeGrid}>
              {QUICK_TIMES.map(t => (
                <TouchableOpacity key={t} style={styles.timeChip} onPress={() => setQuickTime(t)}>
                  <Text style={styles.timeChipText}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* === DUPLICATE MODAL === */}
      <Modal visible={showDuplicate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.dupeModal}>
            <Text style={styles.dupeTitle}>Already in Eventgasm?</Text>
            <Text style={styles.dupeSub}>We found something similar:</Text>
            {duplicates.map(dupe => (
              <TouchableOpacity key={dupe.id} style={styles.dupeCard} onPress={() => handleSubmit(false, dupe.id)}>
                <Text style={styles.dupeCardTitle}>{dupe.title}</Text>
                <Text style={styles.dupeCardMeta}>{dupe.venue_name} • {new Date(dupe.start_time).toLocaleDateString()}</Text>
                <Text style={styles.dupeCardAction}>Tap to update this event →</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.dupeNewBtn} onPress={() => handleSubmit(true)}>
              <Text style={styles.dupeNewBtnText}>Different event, submit anyway</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDuplicate(false)}>
              <Text style={styles.dupeCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraFrame: { width: 280, height: 380, borderWidth: 2.5, borderColor: '#fff', borderRadius: 14 },
  cameraHint: { color: 'rgba(255,255,255,0.7)', marginTop: 16, fontSize: 15 },
  cameraControls: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 30, paddingHorizontal: 20, backgroundColor: '#000',
  },
  cameraIconBtn: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  shutterBtn: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#fff', shadowOpacity: 0.3, shadowRadius: 10,
  },
  shutterInner: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', borderWidth: 3, borderColor: '#ddd' },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center',
  },
  scanningText: { color: '#fff', marginTop: 16, fontSize: 17 },

  // Choice
  choiceContainer: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 60 },
  closeBtn: { position: 'absolute', top: 54, right: 20 },
  choiceTitle: { fontSize: 30, fontWeight: '800', marginBottom: 28, color: '#000' },

  bigCameraBtn: {
    backgroundColor: '#000', borderRadius: 22, padding: 30,
    alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
  },
  bigCameraBtnLabel: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 10 },
  bigCameraBtnSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 },

  urlRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  urlInput: { flex: 1, fontSize: 16, color: '#000', marginLeft: 8 },

  manualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 14, padding: 14,
    marginBottom: 24,
  },
  manualBtnText: { fontSize: 16, color: '#555', marginLeft: 8 },

  badgeCallout: { backgroundColor: '#f5f3ff', borderRadius: 12, padding: 14 },
  badgeCalloutText: { color: '#4c1d95', fontSize: 13, textAlign: 'center' },

  // Form header
  formHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  formBackBtn: { padding: 4 },
  formTitle: { fontSize: 17, fontWeight: '600' },
  submitBtn: { backgroundColor: '#000', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9 },
  submitBtnDisabled: { backgroundColor: '#ccc' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  scanPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 12 },
  scanImage: { width: 44, height: 44, borderRadius: 6 },
  scanLabel: { marginLeft: 10, color: '#666', fontSize: 12, flex: 1 },

  // Form fields
  form: { flex: 1, paddingHorizontal: 16 },
  titleInput: {
    fontSize: 22, fontWeight: '600', color: '#000',
    borderBottomWidth: 1.5, borderBottomColor: '#e5e5e5',
    paddingVertical: 16, marginBottom: 12,
  },
  input: {
    borderWidth: 1.5, borderColor: '#eee', borderRadius: 12,
    padding: 14, fontSize: 16, color: '#000', backgroundColor: '#fafafa', marginBottom: 10,
  },
  textarea: { height: 90, textAlignVertical: 'top' },

  dateTimeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dateBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#eee', borderRadius: 12,
    padding: 14, backgroundColor: '#fafafa',
  },
  timeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#eee', borderRadius: 12,
    padding: 14, backgroundColor: '#fafafa',
  },
  dateBtnText: { fontSize: 15, color: '#000', fontWeight: '500' },

  catRow: { marginBottom: 12 },
  catChip: {
    borderWidth: 1.5, borderColor: '#eee', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, backgroundColor: '#fafafa',
  },
  catChipActive: { backgroundColor: '#000', borderColor: '#000' },
  catChipText: { fontSize: 14, color: '#666' },
  catChipTextActive: { color: '#fff', fontWeight: '600' },

  freeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  freeLabel: { fontSize: 16, color: '#000' },

  extrasToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', marginBottom: 4,
  },
  extrasToggleText: { color: '#666', fontSize: 14 },
  priceRow: { flexDirection: 'row', marginBottom: 0 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  quickPickModal: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24 },
  quickPickTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  quickPickRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  quickPickBtn: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  quickPickBtnText: { fontSize: 15, fontWeight: '600', color: '#000' },
  otherDateBtn: { alignItems: 'center', padding: 10 },
  otherDateText: { color: '#666', fontSize: 14 },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeChip: {
    backgroundColor: '#f3f4f6', borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 12,
  },
  timeChipText: { fontSize: 16, fontWeight: '600', color: '#000' },

  dupeModal: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24 },
  dupeTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  dupeSub: { color: '#666', marginBottom: 16 },
  dupeCard: { borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 12, padding: 14, marginBottom: 10 },
  dupeCardTitle: { fontWeight: '600', fontSize: 16 },
  dupeCardMeta: { color: '#888', fontSize: 13, marginTop: 2 },
  dupeCardAction: { color: '#000', fontWeight: '600', fontSize: 13, marginTop: 6 },
  dupeNewBtn: { borderWidth: 1.5, borderColor: '#000', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4, marginBottom: 12 },
  dupeNewBtnText: { fontWeight: '600', fontSize: 16 },
  dupeCancel: { textAlign: 'center', color: '#999', padding: 8 },
});
