import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotifications } from '../services/notifications';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

const ONBOARDING_KEY = '@eventgasm_onboarding_complete';

const SLIDES = [
  {
    id: '1',
    emoji: '🎉',
    title: 'Welcome to Eventgasm',
    subtitle: 'Find the fun. Skip the search.',
    description: 'Discover concerts, sports, comedy, food festivals and more — all in one place.',
  },
  {
    id: '2',
    emoji: '📍',
    title: 'Events Near You',
    subtitle: 'Location makes it personal',
    description: 'Enable location to see what\'s happening nearby. We\'ll never share your location.',
    action: 'location',
  },
  {
    id: '3',
    emoji: '🔔',
    title: 'Never Miss Out',
    subtitle: 'Get notified about events you\'ll love',
    description: 'We\'ll remind you before your saved events and alert you to new ones in your area.',
    action: 'notifications',
  },
  {
    id: '4',
    emoji: '❤️',
    title: 'Save Your Favorites',
    subtitle: 'Build your event wishlist',
    description: 'Tap the heart on any event to save it. We\'ll remind you when it\'s coming up!',
  },
];

export default function OnboardingScreen({ onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationGranted(status === 'granted');
  };

  const handleNotificationPermission = async () => {
    const token = await registerForPushNotifications();
    setNotificationsGranted(!!token);
  };

  const handleNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      // Complete onboarding
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      onComplete();
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  const renderSlide = ({ item }) => (
    <View style={styles.slide}>
      <Text style={styles.emoji}>{item.emoji}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
      <Text style={styles.description}>{item.description}</Text>

      {item.action === 'location' && (
        <TouchableOpacity
          style={[styles.permissionButton, locationGranted && styles.permissionGranted]}
          onPress={handleLocationPermission}
          disabled={locationGranted}
        >
          <Text style={styles.permissionButtonText}>
            {locationGranted ? '✓ Location Enabled' : 'Enable Location'}
          </Text>
        </TouchableOpacity>
      )}

      {item.action === 'notifications' && (
        <TouchableOpacity
          style={[styles.permissionButton, notificationsGranted && styles.permissionGranted]}
          onPress={handleNotificationPermission}
          disabled={notificationsGranted}
        >
          <Text style={styles.permissionButtonText}>
            {notificationsGranted ? '✓ Notifications Enabled' : 'Enable Notifications'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {SLIDES.map((_, index) => {
        const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[styles.dot, { width: dotWidth, opacity }]}
          />
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        scrollEventThrottle={16}
      />

      {renderDots()}

      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>
          {currentIndex === SLIDES.length - 1 ? "Let's Go! 🚀" : 'Next'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export async function checkOnboardingComplete() {
  const complete = await AsyncStorage.getItem(ONBOARDING_KEY);
  return complete === 'true';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    color: '#888',
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#667eea',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionButton: {
    marginTop: 32,
    backgroundColor: '#667eea',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
  },
  permissionGranted: {
    backgroundColor: '#4caf50',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
    marginHorizontal: 4,
  },
  nextButton: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 40,
    marginBottom: 50,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
