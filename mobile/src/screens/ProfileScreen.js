import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import ContributionsTab from '../components/ContributionsTab';

export default function ProfileScreen({ navigation }) {
  const { user, isSignedIn, signUp, signIn, signOut, updateProfile } = useAuth();
  const { favorites } = useFavorites();
  const [mode, setMode] = useState('benefits'); // benefits, signin, signup
  const [profileTab, setProfileTab] = useState('activity'); // activity, contributions
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Missing Info', 'Please enter your name and email');
      return;
    }
    
    setLoading(true);
    const result = await signUp({ name: name.trim(), email: email.trim().toLowerCase() });
    setLoading(false);
    
    if (result.success) {
      Alert.alert('Welcome! 🎉', 'Your profile has been created');
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email');
      return;
    }
    
    setLoading(true);
    const result = await signIn({ email: email.trim().toLowerCase() });
    setLoading(false);
    
    if (result.success) {
      Alert.alert('Welcome back! 👋', '');
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Your favorites will stay on this device. Sign back in anytime!',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', onPress: signOut },
      ]
    );
  };

  // Signed in view
  if (isSignedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{favorites.length}</Text>
            <Text style={styles.statLabel}>Saved Events</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Attended</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>🔥</Text>
            <Text style={styles.statLabel}>1 Day Streak</Text>
          </View>
        </View>

        {/* Tab switcher */}
        <View style={profileStyles.tabRow}>
          <TouchableOpacity
            style={[profileStyles.tab, profileTab === 'activity' && profileStyles.tabActive]}
            onPress={() => setProfileTab('activity')}
          >
            <Text style={[profileStyles.tabText, profileTab === 'activity' && profileStyles.tabTextActive]}>Activity</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[profileStyles.tab, profileTab === 'contributions' && profileStyles.tabActive]}
            onPress={() => setProfileTab('contributions')}
          >
            <Ionicons name="ribbon-outline" size={14} color={profileTab === 'contributions' ? '#000' : '#888'} style={{ marginRight: 4 }} />
            <Text style={[profileStyles.tabText, profileTab === 'contributions' && profileStyles.tabTextActive]}>Contributions</Text>
          </TouchableOpacity>
        </View>

        {/* Activity tab content */}
        {profileTab === 'activity' && (
          <ScrollView style={{ flex: 1 }}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Benefits</Text>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>☁️</Text>
                <Text style={styles.benefitText}>Favorites synced across devices</Text>
                <Text style={styles.checkmark}>✓</Text>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>🎯</Text>
                <Text style={styles.benefitText}>Personalized recommendations</Text>
                <Text style={styles.checkmark}>✓</Text>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>🔔</Text>
                <Text style={styles.benefitText}>Event reminders</Text>
                <Text style={styles.checkmark}>✓</Text>
              </View>
            </View>
            {/* Admin panel - Joey & Jeff only */}
            {(user?.name?.toLowerCase().includes('joey') || user?.name?.toLowerCase().includes('jeff') || user?.name?.toLowerCase().includes('nigel') || user?.email?.includes('sirnigel2000')) && (
              <TouchableOpacity
                style={[styles.signOutButton, { backgroundColor: '#7c3aed', marginBottom: 8 }]}
                onPress={() => navigation.navigate('AdminReview')}
              >
                <Text style={[styles.signOutText, { color: '#fff' }]}>⚡ Admin: Review Submissions</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Contributions tab */}
        {profileTab === 'contributions' && (
          <ContributionsTab
            userId={user?.id}
            username={user?.name}
            navigation={navigation}
          />
        )}
      </View>
    );
  }

  // Benefits view (not signed in)
  if (mode === 'benefits') {
    return (
      <ScrollView style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>✨</Text>
          <Text style={styles.heroTitle}>Create Your Profile</Text>
          <Text style={styles.heroSubtitle}>Free forever. Better experience.</Text>
        </View>

        <View style={styles.benefitsSection}>
          <View style={styles.benefitCard}>
            <Text style={styles.benefitCardIcon}>☁️</Text>
            <Text style={styles.benefitCardTitle}>Sync Everywhere</Text>
            <Text style={styles.benefitCardDesc}>
              Your saved events follow you across all your devices
            </Text>
          </View>

          <View style={styles.benefitCard}>
            <Text style={styles.benefitCardIcon}>🎯</Text>
            <Text style={styles.benefitCardTitle}>Better Recommendations</Text>
            <Text style={styles.benefitCardDesc}>
              We learn your taste to show events you'll actually love
            </Text>
          </View>

          <View style={styles.benefitCard}>
            <Text style={styles.benefitCardIcon}>🏆</Text>
            <Text style={styles.benefitCardTitle}>Earn Badges</Text>
            <Text style={styles.benefitCardDesc}>
              Track your event journey and unlock achievements
            </Text>
          </View>

          <View style={styles.benefitCard}>
            <Text style={styles.benefitCardIcon}>👥</Text>
            <Text style={styles.benefitCardTitle}>Connect with Friends</Text>
            <Text style={styles.benefitCardDesc}>
              See what events your friends are interested in (coming soon)
            </Text>
          </View>
        </View>

        <View style={styles.ctaSection}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => setMode('signup')}
          >
            <Text style={styles.primaryButtonText}>Create Free Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => setMode('signin')}
          >
            <Text style={styles.secondaryButtonText}>Already have one? Sign In</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.noAccountText}>
          Don't want a profile? No problem!{'\n'}
          You can still use all core features. 🎉
        </Text>
      </ScrollView>
    );
  }

  // Sign up / Sign in form
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView>
        <TouchableOpacity style={styles.backButton} onPress={() => setMode('benefits')}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.formSection}>
          <Text style={styles.formTitle}>
            {mode === 'signup' ? 'Create Profile' : 'Welcome Back'}
          </Text>
          <Text style={styles.formSubtitle}>
            {mode === 'signup' 
              ? 'Just a name and email. That\'s it!' 
              : 'Enter your email to sign in'}
          </Text>

          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity 
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={mode === 'signup' ? handleSignUp : handleSignIn}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Please wait...' : mode === 'signup' ? 'Create Profile' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
          >
            <Text style={styles.switchModeText}>
              {mode === 'signup' 
                ? 'Already have a profile? Sign in' 
                : 'Need a profile? Create one'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 16,
    paddingTop: 60,
  },
  backText: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
  },
  // Hero section
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  heroEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#888',
  },
  // Benefits section
  benefitsSection: {
    padding: 16,
  },
  benefitCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  benefitCardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  benefitCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  benefitCardDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // CTA section
  ctaSection: {
    padding: 16,
    paddingTop: 8,
  },
  primaryButton: {
    backgroundColor: '#667eea',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  noAccountText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    padding: 16,
    paddingTop: 8,
    lineHeight: 22,
  },
  // Form section
  formSection: {
    padding: 24,
    paddingTop: 40,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  switchModeText: {
    textAlign: 'center',
    color: '#667eea',
    fontSize: 14,
    marginTop: 16,
  },
  // Profile header (signed in)
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  // Sections
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    color: '#444',
  },
  checkmark: {
    fontSize: 16,
    color: '#4caf50',
    fontWeight: '700',
  },
  signOutButton: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  signOutText: {
    color: '#888',
    fontSize: 16,
  },
});

const profileStyles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#000',
    fontWeight: '700',
  },
});
