/**
 * SubmitEventScreen - Fast event submission
 * Camera scan → OCR → form prefill → submit
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Switch, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_BASE = 'https://eventgasm.onrender.com';

const CATEGORIES = [
  'Music', 'Sports', 'Comedy', 'Theater', 'Arts', 'Festival',
  'Food', 'Family', 'Nightlife', 'Community', 'Other'
];

export default function SubmitEventScreen({ navigation }) {
  const [mode, setMode] = useState('choice'); // 'choice' | 'camera' | 'form'
  const [cameraPermission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Music',
    venue_name: '',
    address: '',
    city: '',
    state: '',
    start_time: new Date(),
    end_time: null,
    ticket_url: '',
    is_free: false,
    price_min: '',
    price_max: '',
    image_url: '',
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // === CAMERA FLOW ===

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera access needed', 'Please allow camera access to scan event posters.');
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
      Alert.alert('Error', 'Could not capture photo. Try again.');
      setIsScanning(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setIsScanning(true);
      setCapturedImage(result.assets[0].uri);
      await extractFromImage(result.assets[0].base64);
    }
  };

  const extractFromImage = async (base64) => {
    try {
      // Use free OCR API (ocr.space - free tier, no Google)
      const formData = new FormData();
      formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: { apikey: 'K81721619988957' }, // free tier key
        body: formData,
      });

      const data = await response.json();
      const text = data?.ParsedResults?.[0]?.ParsedText || '';

      if (text) {
        prefillFromText(text);
      }
    } catch (e) {
      console.log('OCR error:', e.message);
    } finally {
      setIsScanning(false);
      setMode('form');
    }
  };

  const prefillFromText = (text) => {
    // Simple extraction from OCR text
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Title = first non-empty line that looks like a title (all caps or longer text)
    const titleLine = lines.find(l => l.length > 3 && l.length < 100);
    if (titleLine && !form.title) update('title', titleLine);

    // Look for date patterns
    const datePattern = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i;
    const dateLine = lines.find(l => datePattern.test(l));
    if (dateLine) {
      const match = dateLine.match(datePattern);
      if (match) {
        try {
          const parsed = new Date(match[0]);
          if (!isNaN(parsed)) update('start_time', parsed);
        } catch (e) {}
      }
    }

    // Look for venue / @ patterns
    const venueLine = lines.find(l => l.includes('@') || l.toLowerCase().includes('at '));
    if (venueLine) {
      const venuePart = venueLine.split('@').pop()?.trim() || venueLine.replace(/^at\s+/i, '');
      if (venuePart && !form.venue_name) update('venue_name', venuePart.substring(0, 100));
    }

    // Look for free / ticket price
    if (text.toLowerCase().includes('free')) update('is_free', true);
  };

  // === URL PASTE FLOW ===
  const [urlInput, setUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  const fetchFromUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingUrl(true);
    try {
      const response = await fetch(`${API_BASE}/api/submissions/scrape-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await response.json();
      if (data.event) {
        setForm(prev => ({ ...prev, ...data.event }));
      }
      setMode('form');
    } catch (e) {
      Alert.alert('Could not fetch URL', 'Try filling in the form manually.');
      setMode('form');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // === SUBMIT ===

  const checkDuplicates = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/submissions/check-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          start_time: form.start_time,
          venue_name: form.venue_name,
        }),
      });
      const data = await response.json();
      return data.duplicates || [];
    } catch (e) {
      return [];
    }
  };

  const handleSubmit = async (forceNew = false, existingEventId = null) => {
    if (!form.title.trim()) {
      Alert.alert('Missing info', 'Event title is required.');
      return;
    }

    setIsSubmitting(true);
    setShowDuplicate(false);

    try {
      // Check duplicates first (unless user already acknowledged)
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
        end_time: form.end_time?.toISOString() || null,
        price_min: form.price_min ? parseFloat(form.price_min) : null,
        price_max: form.price_max ? parseFloat(form.price_max) : null,
        user_id: 'demo_user', // TODO: wire up auth
        username: 'you',
        is_update: !!existingEventId,
        event_id: existingEventId || null,
        source_type: capturedImage ? 'photo_scan' : 'manual',
      };

      const response = await fetch(`${API_BASE}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          data.is_update ? 'Update submitted!' : 'Event submitted!',
          data.message,
          [{ text: 'Nice!', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', data.error || 'Something went wrong');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not submit. Check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // === RENDER ===

  if (mode === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraFrame} />
            <Text style={styles.cameraHint}>Point at the event poster</Text>
          </View>
        </CameraView>

        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.cameraBtn} onPress={() => setMode('choice')}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureBtn}
            onPress={takePicture}
            disabled={isScanning}
          >
            {isScanning
              ? <ActivityIndicator color="#000" size="large" />
              : <View style={styles.captureInner} />
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.cameraBtn} onPress={pickFromGallery}>
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

  if (mode === 'choice') {
    return (
      <View style={styles.choiceContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>

        <Text style={styles.choiceTitle}>Add an Event</Text>
        <Text style={styles.choiceSubtitle}>How do you want to add it?</Text>

        {/* CAMERA - primary CTA */}
        <TouchableOpacity style={styles.choicePrimary} onPress={openCamera}>
          <Ionicons name="camera" size={32} color="#fff" />
          <View style={styles.choiceTextBlock}>
            <Text style={styles.choicePrimaryLabel}>Scan a Poster</Text>
            <Text style={styles.choicePrimaryHint}>Point your camera at any flyer or poster</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        {/* URL */}
        <View style={styles.choiceUrl}>
          <Ionicons name="link" size={22} color="#666" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.urlInput}
            placeholder="Paste a link (Facebook, Eventbrite...)"
            placeholderTextColor="#aaa"
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
                : <Ionicons name="arrow-forward-circle" size={28} color="#000" />
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Manual */}
        <TouchableOpacity style={styles.choiceSecondary} onPress={() => setMode('form')}>
          <Ionicons name="create-outline" size={22} color="#000" />
          <Text style={styles.choiceSecondaryLabel}>Fill in manually</Text>
        </TouchableOpacity>

        {/* Contributor callout */}
        <View style={styles.contributorCallout}>
          <Ionicons name="ribbon" size={18} color="#f59e0b" />
          <Text style={styles.contributorText}>
            Submit 5 events → Earn <Text style={{ fontWeight: '700' }}>Verified Contributor</Text> badge
          </Text>
        </View>
      </View>
    );
  }

  // FORM
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.formHeader}>
        <TouchableOpacity onPress={() => setMode('choice')}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.formTitle}>Event Details</Text>
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={() => handleSubmit()}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.submitBtnText}>Submit</Text>
          }
        </TouchableOpacity>
      </View>

      {capturedImage && (
        <View style={styles.scannedImagePreview}>
          <Image source={{ uri: capturedImage }} style={styles.scannedImage} />
          <Text style={styles.scannedLabel}>Scanned from photo - edit as needed</Text>
        </View>
      )}

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <Text style={styles.label}>Event Name *</Text>
        <TextInput
          style={[styles.input, styles.inputLarge]}
          placeholder="What's the event?"
          value={form.title}
          onChangeText={v => update('title', v)}
          autoFocus={!capturedImage}
        />

        {/* Date */}
        <Text style={styles.label}>Date & Time *</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={{ color: form.start_time ? '#000' : '#aaa' }}>
            {form.start_time
              ? form.start_time.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
              : 'Select date and time'}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={form.start_time || new Date()}
            mode="datetime"
            onChange={(e, date) => {
              setShowDatePicker(false);
              if (date) update('start_time', date);
            }}
          />
        )}

        {/* Venue */}
        <Text style={styles.label}>Venue / Location</Text>
        <TextInput
          style={styles.input}
          placeholder="Bar name, club, arena..."
          value={form.venue_name}
          onChangeText={v => update('venue_name', v)}
        />
        <TextInput
          style={styles.input}
          placeholder="City"
          value={form.city}
          onChangeText={v => update('city', v)}
        />

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, form.category === cat && styles.categoryChipActive]}
              onPress={() => update('category', cat)}
            >
              <Text style={[styles.categoryChipText, form.category === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Free / Price */}
        <View style={styles.freeRow}>
          <Text style={styles.label}>Free Event</Text>
          <Switch value={form.is_free} onValueChange={v => update('is_free', v)} />
        </View>
        {!form.is_free && (
          <View style={styles.priceRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              placeholder="Min price $"
              keyboardType="decimal-pad"
              value={form.price_min}
              onChangeText={v => update('price_min', v)}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Max price $"
              keyboardType="decimal-pad"
              value={form.price_max}
              onChangeText={v => update('price_max', v)}
            />
          </View>
        )}

        {/* Ticket URL */}
        <Text style={styles.label}>Ticket Link</Text>
        <TextInput
          style={styles.input}
          placeholder="https://..."
          value={form.ticket_url}
          onChangeText={v => update('ticket_url', v)}
          autoCapitalize="none"
          keyboardType="url"
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Tell people what to expect..."
          value={form.description}
          onChangeText={v => update('description', v)}
          multiline
          numberOfLines={4}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Duplicate Modal */}
      <Modal visible={showDuplicate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>This event might already exist</Text>
            <Text style={styles.modalSubtitle}>We found similar events. Is it one of these?</Text>

            {duplicates.map(dupe => (
              <TouchableOpacity
                key={dupe.id}
                style={styles.dupeCard}
                onPress={() => handleSubmit(false, dupe.id)}
              >
                <Text style={styles.dupeTitle}>{dupe.title}</Text>
                <Text style={styles.dupeMeta}>
                  {dupe.venue_name} • {new Date(dupe.start_time).toLocaleDateString()}
                </Text>
                <Text style={styles.dupeAction}>Update this event →</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.newEventBtn} onPress={() => handleSubmit(true)}>
              <Text style={styles.newEventBtnText}>No - this is a different event</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowDuplicate(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
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
  cameraFrame: {
    width: 280, height: 380,
    borderWidth: 2, borderColor: '#fff', borderRadius: 12,
    backgroundColor: 'transparent',
  },
  cameraHint: { color: '#fff', marginTop: 16, fontSize: 14, opacity: 0.8 },
  cameraControls: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    padding: 30, backgroundColor: '#000',
  },
  cameraBtn: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  captureBtn: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  captureInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000' },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  scanningText: { color: '#fff', marginTop: 16, fontSize: 16 },

  // Choice screen
  choiceContainer: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 60 },
  backBtn: { position: 'absolute', top: 52, right: 24 },
  choiceTitle: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  choiceSubtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
  choicePrimary: {
    backgroundColor: '#000', borderRadius: 16, padding: 20,
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
  },
  choiceTextBlock: { flex: 1, marginLeft: 14 },
  choicePrimaryLabel: { color: '#fff', fontSize: 18, fontWeight: '700' },
  choicePrimaryHint: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
  choiceUrl: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 12,
    padding: 14, marginBottom: 16,
  },
  urlInput: { flex: 1, fontSize: 15, color: '#000' },
  choiceSecondary: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 12,
    padding: 16, marginBottom: 32,
  },
  choiceSecondaryLabel: { fontSize: 16, marginLeft: 10, color: '#000' },
  contributorCallout: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fffbeb', borderRadius: 10, padding: 14,
  },
  contributorText: { marginLeft: 8, color: '#92400e', fontSize: 13 },

  // Form
  formHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 56, backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5',
  },
  formTitle: { fontSize: 17, fontWeight: '600' },
  submitBtn: { backgroundColor: '#000', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  submitBtnDisabled: { backgroundColor: '#999' },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  scannedImagePreview: { backgroundColor: '#f5f5f5', padding: 12, flexDirection: 'row', alignItems: 'center' },
  scannedImage: { width: 50, height: 50, borderRadius: 6 },
  scannedLabel: { marginLeft: 10, color: '#666', fontSize: 12, flex: 1 },
  form: { flex: 1, padding: 16, backgroundColor: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 10,
    padding: 14, fontSize: 16, color: '#000', backgroundColor: '#fafafa',
  },
  inputLarge: { fontSize: 18, fontWeight: '500' },
  textarea: { height: 100, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', marginVertical: 4 },
  categoryChip: {
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, backgroundColor: '#fafafa',
  },
  categoryChipActive: { backgroundColor: '#000', borderColor: '#000' },
  categoryChipText: { fontSize: 14, color: '#666' },
  categoryChipTextActive: { color: '#fff', fontWeight: '600' },
  freeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  priceRow: { flexDirection: 'row', marginTop: 8 },

  // Duplicate modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  modalSubtitle: { color: '#666', marginBottom: 20 },
  dupeCard: {
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 12,
    padding: 14, marginBottom: 10,
  },
  dupeTitle: { fontWeight: '600', fontSize: 16 },
  dupeMeta: { color: '#666', fontSize: 13, marginTop: 2 },
  dupeAction: { color: '#000', fontWeight: '600', fontSize: 13, marginTop: 6 },
  newEventBtn: {
    borderWidth: 1.5, borderColor: '#000', borderRadius: 12,
    padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 12,
  },
  newEventBtnText: { fontWeight: '600', fontSize: 16 },
  cancelText: { textAlign: 'center', color: '#666', padding: 8 },
});
