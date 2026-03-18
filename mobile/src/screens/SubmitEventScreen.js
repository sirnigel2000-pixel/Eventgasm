/**
 * SubmitEventScreen
 * Mobile: fast, minimal, camera-first
 * Web: full desktop form, spacious, all fields visible
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

const QUICK_DATES = [
  { label: 'Tonight', getValue: () => { const d = new Date(); d.setHours(20,0,0,0); return d; } },
  { label: 'Tomorrow', getValue: () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(20,0,0,0); return d; } },
  { label: 'This Sat', getValue: () => { const d = new Date(); d.setDate(d.getDate()+(6-d.getDay()+7)%7); d.setHours(20,0,0,0); return d; } },
  { label: 'This Sun', getValue: () => { const d = new Date(); d.setDate(d.getDate()+(7-d.getDay())%7); d.setHours(14,0,0,0); return d; } },
];
const QUICK_TIMES = ['6 PM','7 PM','8 PM','9 PM','10 PM','11 PM','12 AM'];

export default function SubmitEventScreen({ navigation }) {
  const [mode, setMode] = useState('choice');
  const [cameraPermission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', category: 'Music',
    venue_name: '', address: '', city: '', state: '',
    start_time: null, end_time: null,
    ticket_url: '', is_free: false,
    price_min: '', price_max: '',
  });

  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const fmt = (d, type) => {
    if (!d) return '';
    if (type === 'date') return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    if (type === 'time') return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
    return '';
  };

  // Camera
  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const r = await requestPermission();
      if (!r.granted) { Alert.alert('Camera needed', 'Allow camera to scan posters.'); return; }
    }
    setMode('camera');
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    setIsScanning(true);
    try {
      const p = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: true });
      setCapturedImage(p.uri);
      await extractFromImage(p.base64);
    } catch(e) { Alert.alert('Error','Try again.'); setIsScanning(false); }
  };

  const pickFromGallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: true });
    if (!r.canceled && r.assets[0]) {
      setIsScanning(true);
      setCapturedImage(r.assets[0].uri);
      await extractFromImage(r.assets[0].base64);
    }
  };

  const extractFromImage = async (base64) => {
    try {
      const fd = new FormData();
      fd.append('base64Image', `data:image/jpeg;base64,${base64}`);
      fd.append('language', 'eng');
      fd.append('isOverlayRequired', 'false');
      const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST', headers: { apikey: 'K81721619988957' }, body: fd,
      });
      const data = await res.json();
      const text = data?.ParsedResults?.[0]?.ParsedText || '';
      if (text) prefillFromText(text);
    } catch(e) { console.log('OCR:', e.message); }
    finally { setIsScanning(false); setMode('form'); }
  };

  const prefillFromText = (text) => {
    const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
    const title = lines.find(l => l.length > 3 && l.length < 100);
    if (title && !form.title) update('title', title);
    const dateRx = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i;
    const dl = lines.find(l => dateRx.test(l));
    if (dl) { try { const m = dl.match(dateRx); if(m) { const p = new Date(m[0]); if(!isNaN(p)) update('start_time',p); } } catch(e){} }
    const vl = lines.find(l => l.includes('@') || /^at\s+/i.test(l));
    if (vl) { const vp = vl.split('@').pop()?.trim() || vl.replace(/^at\s+/i,''); if(vp && !form.venue_name) update('venue_name', vp.substring(0,100)); }
    if (text.toLowerCase().includes('free')) update('is_free', true);
  };

  const fetchFromUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingUrl(true);
    try {
      const res = await fetch(`${API_BASE}/api/submissions/scrape-url`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (data.event) setForm(p => ({ ...p, ...data.event }));
      setMode('form');
    } catch(e) { setMode('form'); }
    finally { setIsFetchingUrl(false); }
  };

  const checkDuplicates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/submissions/check-duplicate`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ title: form.title, start_time: form.start_time, venue_name: form.venue_name }),
      });
      return (await res.json()).duplicates || [];
    } catch(e) { return []; }
  };

  const handleSubmit = async (forceNew = false, existingId = null) => {
    if (!form.title.trim()) { Alert.alert("What's the event called?"); return; }
    if (!form.start_time) { Alert.alert("When is it?"); return; }
    setIsSubmitting(true);
    setShowDuplicate(false);
    try {
      if (!forceNew && !existingId) {
        const dupes = await checkDuplicates();
        if (dupes.length > 0) { setDuplicates(dupes); setShowDuplicate(true); setIsSubmitting(false); return; }
      }
      const payload = {
        ...form, start_time: form.start_time?.toISOString(),
        end_time: form.end_time?.toISOString() || null,
        price_min: form.price_min ? parseFloat(form.price_min) : null,
        price_max: form.price_max ? parseFloat(form.price_max) : null,
        user_id:'demo_user', username:'you',
        is_update: !!existingId, event_id: existingId || null,
        source_type: capturedImage ? 'photo_scan' : 'manual',
      };
      const res = await fetch(`${API_BASE}/api/submissions`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert(data.is_update ? 'Update submitted!' : '🎉 Event submitted!', data.message,
          [{ text: 'Nice!', onPress: () => navigation.goBack() }]);
      } else { Alert.alert('Error', data.error || 'Something went wrong'); }
    } catch(e) { Alert.alert('Error','Check your connection.'); }
    finally { setIsSubmitting(false); }
  };

  // ============================================================
  // WEB VERSION - Full desktop form
  // ============================================================
  if (isWeb) {
    return (
      <ScrollView style={web.container} contentContainerStyle={web.content}>
        <View style={web.card}>
          {/* Header */}
          <View style={web.cardHeader}>
            <View>
              <Text style={web.cardTitle}>Submit an Event</Text>
              <Text style={web.cardSubtitle}>Help your community find what's happening</Text>
            </View>
            <TouchableOpacity style={web.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={web.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={web.divider} />

          {/* Two-column layout */}
          <View style={web.twoCol}>
            {/* Left column */}
            <View style={web.col}>
              <Text style={web.sectionLabel}>Event Info</Text>

              <Text style={web.label}>Event Name *</Text>
              <TextInput
                style={web.input}
                placeholder="e.g. The Midnight at Fillmore"
                value={form.title}
                onChangeText={v => update('title', v)}
              />

              <Text style={web.label}>Description</Text>
              <TextInput
                style={[web.input, web.textarea]}
                placeholder="What should people expect? Who's performing?"
                value={form.description}
                onChangeText={v => update('description', v)}
                multiline
                numberOfLines={4}
              />

              <View style={web.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={web.label}>Date *</Text>
                  <TextInput
                    style={web.input}
                    placeholder="e.g. March 25, 2026"
                    value={form.start_time ? form.start_time.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : ''}
                    onChangeText={v => { const d = new Date(v); if(!isNaN(d)) update('start_time',d); }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={web.label}>Time</Text>
                  <TextInput
                    style={web.input}
                    placeholder="e.g. 8:00 PM"
                    value={form.start_time ? fmt(form.start_time,'time') : ''}
                    onChangeText={v => {
                      const base = form.start_time || new Date();
                      const match = v.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
                      if (match) {
                        const d = new Date(base);
                        let h = parseInt(match[1]);
                        const m = parseInt(match[2] || '0');
                        const period = match[3].toLowerCase();
                        if (period === 'pm' && h !== 12) h += 12;
                        if (period === 'am' && h === 12) h = 0;
                        d.setHours(h, m, 0, 0);
                        update('start_time', d);
                      }
                    }}
                  />
                </View>
              </View>

              <Text style={web.label}>Category</Text>
              <View style={web.catGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[web.catChip, form.category === cat && web.catChipActive]}
                    onPress={() => update('category', cat)}
                  >
                    <Text style={[web.catChipText, form.category === cat && web.catChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Right column */}
            <View style={web.col}>
              <Text style={web.sectionLabel}>Location & Tickets</Text>

              <Text style={web.label}>Venue Name</Text>
              <TextInput
                style={web.input}
                placeholder="e.g. The Fillmore, Madison Square Garden"
                value={form.venue_name}
                onChangeText={v => update('venue_name', v)}
              />

              <Text style={web.label}>Address</Text>
              <TextInput
                style={web.input}
                placeholder="Street address"
                value={form.address}
                onChangeText={v => update('address', v)}
              />

              <View style={web.row}>
                <View style={{ flex: 2, marginRight: 10 }}>
                  <Text style={web.label}>City</Text>
                  <TextInput
                    style={web.input}
                    placeholder="City"
                    value={form.city}
                    onChangeText={v => update('city', v)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={web.label}>State</Text>
                  <TextInput
                    style={web.input}
                    placeholder="FL"
                    value={form.state}
                    onChangeText={v => update('state', v)}
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <Text style={web.label}>Ticket Link</Text>
              <TextInput
                style={web.input}
                placeholder="https://ticketmaster.com/..."
                value={form.ticket_url}
                onChangeText={v => update('ticket_url', v)}
                autoCapitalize="none"
              />

              <View style={web.freeRow}>
                <View>
                  <Text style={web.label}>Free Event</Text>
                  <Text style={web.labelSub}>No ticket required</Text>
                </View>
                <Switch value={form.is_free} onValueChange={v => update('is_free', v)} trackColor={{ true: '#000' }} />
              </View>

              {!form.is_free && (
                <View style={web.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={web.label}>Min Price</Text>
                    <TextInput style={web.input} placeholder="$0" keyboardType="decimal-pad" value={form.price_min} onChangeText={v => update('price_min', v)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={web.label}>Max Price</Text>
                    <TextInput style={web.input} placeholder="$100" keyboardType="decimal-pad" value={form.price_max} onChangeText={v => update('price_max', v)} />
                  </View>
                </View>
              )}

              {/* Flyer upload */}
              <Text style={web.label}>Event Flyer</Text>
              <TouchableOpacity style={web.uploadBox} onPress={pickFromGallery}>
                {capturedImage ? (
                  <>
                    <Image source={{ uri: capturedImage }} style={web.uploadPreview} />
                    <Text style={web.uploadChangeText}>Click to change</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="image-outline" size={32} color="#9ca3af" />
                    <Text style={web.uploadText}>Upload event flyer</Text>
                    <Text style={web.uploadSub}>We'll extract details automatically</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* URL prefill */}
              <Text style={web.label}>Or paste a link</Text>
              <View style={web.urlRow}>
                <TextInput
                  style={[web.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Eventbrite, Facebook, venue website..."
                  value={urlInput}
                  onChangeText={setUrlInput}
                  autoCapitalize="none"
                  onSubmitEditing={fetchFromUrl}
                />
                <TouchableOpacity style={web.urlBtn} onPress={fetchFromUrl} disabled={isFetchingUrl}>
                  {isFetchingUrl
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={web.urlBtnText}>Fetch</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Contributor callout */}
          <View style={web.contributorBanner}>
            <Ionicons name="ribbon" size={18} color="#7c3aed" />
            <Text style={web.contributorBannerText}>
              Submit 5 approved events to earn <Text style={{ fontWeight:'700' }}>Verified Contributor</Text> status
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[web.submitBtn, (!form.title || !form.start_time || isSubmitting) && web.submitBtnDisabled]}
            onPress={() => handleSubmit()}
            disabled={!form.title || !form.start_time || isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={web.submitBtnText}>Submit Event</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Duplicate modal */}
        <Modal visible={showDuplicate} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.dupeModal, { maxWidth: 480, alignSelf:'center', width:'100%' }]}>
              <Text style={styles.dupeTitle}>Already in Eventgasm?</Text>
              <Text style={styles.dupeSub}>We found something similar:</Text>
              {duplicates.map(d => (
                <TouchableOpacity key={d.id} style={styles.dupeCard} onPress={() => handleSubmit(false, d.id)}>
                  <Text style={styles.dupeCardTitle}>{d.title}</Text>
                  <Text style={styles.dupeCardMeta}>{d.venue_name} • {new Date(d.start_time).toLocaleDateString()}</Text>
                  <Text style={styles.dupeCardAction}>Click to update this event →</Text>
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
      </ScrollView>
    );
  }

  // ============================================================
  // MOBILE VERSION - Fast, minimal, camera-first
  // ============================================================

  // Camera screen
  if (mode === 'camera') {
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
          <TouchableOpacity style={styles.shutterBtn} onPress={takePicture} disabled={isScanning} activeOpacity={0.7}>
            {isScanning ? <ActivityIndicator color="#000" size="large" /> : <View style={styles.shutterInner} />}
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

  // Choice screen
  if (mode === 'choice') {
    return (
      <View style={styles.choiceContainer}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="#666" />
        </TouchableOpacity>
        <Text style={styles.choiceTitle}>Add an Event</Text>
        <TouchableOpacity style={styles.bigCameraBtn} onPress={openCamera} activeOpacity={0.8}>
          <Ionicons name="camera" size={52} color="#fff" />
          <Text style={styles.bigCameraBtnLabel}>Scan a Poster</Text>
          <Text style={styles.bigCameraBtnSub}>Point at any flyer or poster</Text>
        </TouchableOpacity>
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
              {isFetchingUrl ? <ActivityIndicator size="small" color="#000" /> : <Ionicons name="arrow-forward-circle" size={30} color="#000" />}
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.manualBtn} onPress={() => setMode('form')}>
          <Ionicons name="create-outline" size={20} color="#555" />
          <Text style={styles.manualBtnText}>Fill in manually</Text>
        </TouchableOpacity>
        <View style={styles.badgeCallout}>
          <Text style={styles.badgeCalloutText}>
            Submit 5 events → earn <Text style={{ fontWeight:'700', color:'#7c3aed' }}>Verified Contributor</Text> badge
          </Text>
        </View>
      </View>
    );
  }

  // Form screen
  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor:'#fff' }} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={styles.formHeader}>
        <TouchableOpacity onPress={() => setMode('choice')} style={styles.formBackBtn}>
          <Ionicons name="chevron-back" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={styles.formTitle}>Event Details</Text>
        <TouchableOpacity
          style={[styles.submitBtn, (!form.title||!form.start_time||isSubmitting) && styles.submitBtnDisabled]}
          onPress={() => handleSubmit()}
          disabled={!form.title||!form.start_time||isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Submit</Text>}
        </TouchableOpacity>
      </View>

      {capturedImage && (
        <View style={styles.scanPreview}>
          <Image source={{ uri: capturedImage }} style={styles.scanImage} />
          <Text style={styles.scanLabel}>Scanned — edit below</Text>
        </View>
      )}

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.titleInput}
          placeholder="What's the event? *"
          placeholderTextColor="#bbb"
          value={form.title}
          onChangeText={v => update('title',v)}
          autoFocus={!capturedImage}
        />

        <View style={styles.dateTimeRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDateModal(true)}>
            <Ionicons name="calendar-outline" size={18} color={form.start_time?'#000':'#bbb'} />
            <Text style={[styles.dateBtnText, !form.start_time&&{color:'#bbb'}]}>
              {form.start_time ? fmt(form.start_time,'date') : 'Date *'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.timeBtn} onPress={() => setShowTimeModal(true)}>
            <Ionicons name="time-outline" size={18} color={form.start_time?'#000':'#bbb'} />
            <Text style={[styles.dateBtnText, !form.start_time&&{color:'#bbb'}]}>
              {form.start_time ? fmt(form.start_time,'time') : 'Time'}
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput style={styles.input} placeholder="Venue / location" placeholderTextColor="#bbb" value={form.venue_name} onChangeText={v=>update('venue_name',v)} />
        <TextInput style={styles.input} placeholder="City" placeholderTextColor="#bbb" value={form.city} onChangeText={v=>update('city',v)} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity key={cat} style={[styles.catChip, form.category===cat&&styles.catChipActive]} onPress={()=>update('category',cat)}>
              <Text style={[styles.catChipText, form.category===cat&&styles.catChipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.freeRow}>
          <Text style={styles.freeLabel}>Free event</Text>
          <Switch value={form.is_free} onValueChange={v=>update('is_free',v)} trackColor={{true:'#000'}} />
        </View>

        <TouchableOpacity style={styles.extrasToggle} onPress={()=>setShowExtras(!showExtras)}>
          <Text style={styles.extrasToggleText}>{showExtras ? 'Hide extra details' : '+ Add description, ticket link, price'}</Text>
          <Ionicons name={showExtras?'chevron-up':'chevron-down'} size={16} color="#888" />
        </TouchableOpacity>

        {showExtras && (
          <View>
            {!form.is_free && (
              <View style={styles.priceRow}>
                <TextInput style={[styles.input,{flex:1,marginRight:8}]} placeholder="Min $" keyboardType="decimal-pad" placeholderTextColor="#bbb" value={form.price_min} onChangeText={v=>update('price_min',v)} />
                <TextInput style={[styles.input,{flex:1}]} placeholder="Max $" keyboardType="decimal-pad" placeholderTextColor="#bbb" value={form.price_max} onChangeText={v=>update('price_max',v)} />
              </View>
            )}
            <TextInput style={styles.input} placeholder="Ticket link" placeholderTextColor="#bbb" value={form.ticket_url} onChangeText={v=>update('ticket_url',v)} autoCapitalize="none" keyboardType="url" />
            <TextInput style={[styles.input,styles.textarea]} placeholder="Description" placeholderTextColor="#bbb" value={form.description} onChangeText={v=>update('description',v)} multiline numberOfLines={3} />
          </View>
        )}
        <View style={{height:60}} />
      </ScrollView>

      {/* Date Modal */}
      <Modal visible={showDateModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={()=>setShowDateModal(false)}>
          <View style={styles.quickPickModal}>
            <Text style={styles.quickPickTitle}>When is it?</Text>
            <View style={styles.quickPickRow}>
              {QUICK_DATES.map(qd => (
                <TouchableOpacity key={qd.label} style={styles.quickPickBtn} onPress={()=>{const d=qd.getValue();update('start_time',d);setShowDateModal(false);}}>
                  <Text style={styles.quickPickBtnText}>{qd.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Time Modal */}
      <Modal visible={showTimeModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={()=>setShowTimeModal(false)}>
          <View style={styles.quickPickModal}>
            <Text style={styles.quickPickTitle}>What time?</Text>
            <View style={styles.timeGrid}>
              {QUICK_TIMES.map(t => (
                <TouchableOpacity key={t} style={styles.timeChip} onPress={()=>{
                  const base = form.start_time||new Date();
                  const d = new Date(base);
                  const [h,period] = t.split(' ');
                  let hr = parseInt(h);
                  if(period==='PM'&&hr!==12) hr+=12;
                  if(period==='AM'&&hr===12) hr=0;
                  d.setHours(hr,0,0,0);
                  update('start_time',d);
                  setShowTimeModal(false);
                }}>
                  <Text style={styles.timeChipText}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Dupe Modal */}
      <Modal visible={showDuplicate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.dupeModal}>
            <Text style={styles.dupeTitle}>Already in Eventgasm?</Text>
            <Text style={styles.dupeSub}>We found something similar:</Text>
            {duplicates.map(d => (
              <TouchableOpacity key={d.id} style={styles.dupeCard} onPress={()=>handleSubmit(false,d.id)}>
                <Text style={styles.dupeCardTitle}>{d.title}</Text>
                <Text style={styles.dupeCardMeta}>{d.venue_name} • {new Date(d.start_time).toLocaleDateString()}</Text>
                <Text style={styles.dupeCardAction}>Tap to update this event →</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.dupeNewBtn} onPress={()=>handleSubmit(true)}>
              <Text style={styles.dupeNewBtnText}>Different event, submit anyway</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setShowDuplicate(false)}>
              <Text style={styles.dupeCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// WEB STYLES
// ============================================================
const web = StyleSheet.create({
  container: { flex:1, backgroundColor:'#f9fafb' },
  content: { padding: 32, maxWidth: 960, alignSelf:'center', width:'100%' },
  card: { backgroundColor:'#fff', borderRadius:16, padding:32, shadowColor:'#000', shadowOpacity:0.06, shadowOffset:{width:0,height:2}, shadowRadius:12 },
  cardHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 },
  cardTitle: { fontSize:28, fontWeight:'800', color:'#000' },
  cardSubtitle: { color:'#666', fontSize:15, marginTop:4 },
  cancelBtn: { borderWidth:1.5, borderColor:'#e5e5e5', borderRadius:8, paddingHorizontal:16, paddingVertical:8 },
  cancelBtnText: { color:'#666', fontSize:14 },
  divider: { height:1, backgroundColor:'#f0f0f0', marginBottom:28 },
  twoCol: { flexDirection:'row', gap:32 },
  col: { flex:1 },
  sectionLabel: { fontSize:12, fontWeight:'700', color:'#9ca3af', letterSpacing:1, textTransform:'uppercase', marginBottom:16 },
  label: { fontSize:13, fontWeight:'600', color:'#374151', marginBottom:6, marginTop:16 },
  labelSub: { fontSize:12, color:'#9ca3af', marginTop:-4 },
  input: {
    borderWidth:1.5, borderColor:'#e5e5e5', borderRadius:8,
    padding:12, fontSize:15, color:'#000', backgroundColor:'#fff',
    outlineStyle:'none',
  },
  textarea: { height:100, textAlignVertical:'top' },
  row: { flexDirection:'row', gap:0 },
  catGrid: { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:4 },
  catChip: { borderWidth:1.5, borderColor:'#e5e5e5', borderRadius:20, paddingHorizontal:14, paddingVertical:7 },
  catChipActive: { backgroundColor:'#000', borderColor:'#000' },
  catChipText: { fontSize:13, color:'#666' },
  catChipTextActive: { color:'#fff', fontWeight:'600' },
  freeRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:16, paddingVertical:12, borderTopWidth:1, borderTopColor:'#f0f0f0' },
  uploadBox: {
    borderWidth:2, borderColor:'#e5e5e5', borderStyle:'dashed', borderRadius:10,
    padding:24, alignItems:'center', justifyContent:'center', cursor:'pointer',
  },
  uploadText: { fontSize:15, color:'#6b7280', marginTop:8, fontWeight:'500' },
  uploadSub: { fontSize:12, color:'#9ca3af', marginTop:4 },
  uploadPreview: { width:'100%', height:120, borderRadius:8, resizeMode:'cover' },
  uploadChangeText: { color:'#6b7280', fontSize:13, marginTop:8 },
  urlRow: { flexDirection:'row', gap:10, alignItems:'center' },
  urlBtn: { backgroundColor:'#000', borderRadius:8, paddingHorizontal:16, paddingVertical:12 },
  urlBtnText: { color:'#fff', fontWeight:'600' },
  contributorBanner: {
    flexDirection:'row', alignItems:'center', gap:10,
    backgroundColor:'#f5f3ff', borderRadius:10, padding:14,
    marginTop:28, marginBottom:20,
  },
  contributorBannerText: { color:'#4c1d95', fontSize:14 },
  submitBtn: { backgroundColor:'#000', borderRadius:10, padding:16, alignItems:'center' },
  submitBtnDisabled: { backgroundColor:'#d1d5db' },
  submitBtnText: { color:'#fff', fontWeight:'700', fontSize:16 },
});

// ============================================================
// MOBILE STYLES
// ============================================================
const styles = StyleSheet.create({
  cameraContainer: { flex:1, backgroundColor:'#000' },
  camera: { flex:1 },
  cameraOverlay: { flex:1, justifyContent:'center', alignItems:'center' },
  cameraFrame: { width:280, height:380, borderWidth:2.5, borderColor:'#fff', borderRadius:14 },
  cameraHint: { color:'rgba(255,255,255,0.7)', marginTop:16, fontSize:15 },
  cameraControls: { flexDirection:'row', justifyContent:'space-around', alignItems:'center', paddingVertical:30, paddingHorizontal:20, backgroundColor:'#000' },
  cameraIconBtn: { width:56, height:56, justifyContent:'center', alignItems:'center' },
  shutterBtn: { width:84, height:84, borderRadius:42, backgroundColor:'#fff', justifyContent:'center', alignItems:'center' },
  shutterInner: { width:70, height:70, borderRadius:35, backgroundColor:'#fff', borderWidth:3, borderColor:'#ddd' },
  scanningOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'center', alignItems:'center' },
  scanningText: { color:'#fff', marginTop:16, fontSize:17 },

  choiceContainer: { flex:1, backgroundColor:'#fff', paddingHorizontal:20, paddingTop:60 },
  closeBtn: { position:'absolute', top:54, right:20 },
  choiceTitle: { fontSize:30, fontWeight:'800', marginBottom:28, color:'#000' },
  bigCameraBtn: { backgroundColor:'#000', borderRadius:22, padding:30, alignItems:'center', marginBottom:16 },
  bigCameraBtnLabel: { color:'#fff', fontSize:22, fontWeight:'700', marginTop:10 },
  bigCameraBtnSub: { color:'rgba(255,255,255,0.5)', fontSize:14, marginTop:4 },
  urlRow: { flexDirection:'row', alignItems:'center', borderWidth:1.5, borderColor:'#e5e5e5', borderRadius:14, paddingHorizontal:14, paddingVertical:12, marginBottom:12 },
  urlInput: { flex:1, fontSize:16, color:'#000', marginLeft:8 },
  manualBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor:'#e5e5e5', borderRadius:14, padding:14, marginBottom:24 },
  manualBtnText: { fontSize:16, color:'#555', marginLeft:8 },
  badgeCallout: { backgroundColor:'#f5f3ff', borderRadius:12, padding:14 },
  badgeCalloutText: { color:'#4c1d95', fontSize:13, textAlign:'center' },

  formHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop:56, paddingBottom:12, borderBottomWidth:0.5, borderBottomColor:'#eee' },
  formBackBtn: { padding:4 },
  formTitle: { fontSize:17, fontWeight:'600' },
  submitBtn: { backgroundColor:'#000', borderRadius:20, paddingHorizontal:18, paddingVertical:9 },
  submitBtnDisabled: { backgroundColor:'#ccc' },
  submitBtnText: { color:'#fff', fontWeight:'700', fontSize:15 },
  scanPreview: { flexDirection:'row', alignItems:'center', backgroundColor:'#f5f5f5', padding:12 },
  scanImage: { width:44, height:44, borderRadius:6 },
  scanLabel: { marginLeft:10, color:'#666', fontSize:12, flex:1 },

  form: { flex:1, paddingHorizontal:16 },
  titleInput: { fontSize:22, fontWeight:'600', color:'#000', borderBottomWidth:1.5, borderBottomColor:'#e5e5e5', paddingVertical:16, marginBottom:12 },
  input: { borderWidth:1.5, borderColor:'#eee', borderRadius:12, padding:14, fontSize:16, color:'#000', backgroundColor:'#fafafa', marginBottom:10 },
  textarea: { height:90, textAlignVertical:'top' },
  dateTimeRow: { flexDirection:'row', gap:10, marginBottom:10 },
  dateBtn: { flex:2, flexDirection:'row', alignItems:'center', gap:8, borderWidth:1.5, borderColor:'#eee', borderRadius:12, padding:14, backgroundColor:'#fafafa' },
  timeBtn: { flex:1, flexDirection:'row', alignItems:'center', gap:6, borderWidth:1.5, borderColor:'#eee', borderRadius:12, padding:14, backgroundColor:'#fafafa' },
  dateBtnText: { fontSize:15, color:'#000', fontWeight:'500' },
  catRow: { marginBottom:12 },
  catChip: { borderWidth:1.5, borderColor:'#eee', borderRadius:20, paddingHorizontal:14, paddingVertical:7, marginRight:8, backgroundColor:'#fafafa' },
  catChipActive: { backgroundColor:'#000', borderColor:'#000' },
  catChipText: { fontSize:14, color:'#666' },
  catChipTextActive: { color:'#fff', fontWeight:'600' },
  freeRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  freeLabel: { fontSize:16, color:'#000' },
  extrasToggle: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:14, borderTopWidth:1, borderTopColor:'#f0f0f0', marginBottom:4 },
  extrasToggleText: { color:'#666', fontSize:14 },
  priceRow: { flexDirection:'row', marginBottom:0 },

  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  quickPickModal: { backgroundColor:'#fff', borderTopLeftRadius:22, borderTopRightRadius:22, padding:24 },
  quickPickTitle: { fontSize:20, fontWeight:'700', marginBottom:16 },
  quickPickRow: { flexDirection:'row', gap:10, marginBottom:16 },
  quickPickBtn: { flex:1, backgroundColor:'#f3f4f6', borderRadius:12, padding:14, alignItems:'center' },
  quickPickBtnText: { fontSize:15, fontWeight:'600', color:'#000' },
  timeGrid: { flexDirection:'row', flexWrap:'wrap', gap:10 },
  timeChip: { backgroundColor:'#f3f4f6', borderRadius:12, paddingHorizontal:18, paddingVertical:12 },
  timeChipText: { fontSize:16, fontWeight:'600', color:'#000' },

  dupeModal: { backgroundColor:'#fff', borderTopLeftRadius:22, borderTopRightRadius:22, padding:24 },
  dupeTitle: { fontSize:20, fontWeight:'700', marginBottom:4 },
  dupeSub: { color:'#666', marginBottom:16 },
  dupeCard: { borderWidth:1.5, borderColor:'#e5e5e5', borderRadius:12, padding:14, marginBottom:10 },
  dupeCardTitle: { fontWeight:'600', fontSize:16 },
  dupeCardMeta: { color:'#888', fontSize:13, marginTop:2 },
  dupeCardAction: { color:'#000', fontWeight:'600', fontSize:13, marginTop:6 },
  dupeNewBtn: { borderWidth:1.5, borderColor:'#000', borderRadius:12, padding:14, alignItems:'center', marginTop:4, marginBottom:12 },
  dupeNewBtnText: { fontWeight:'600', fontSize:16 },
  dupeCancel: { textAlign:'center', color:'#999', padding:8 },
});
