import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/HomeScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import MapScreen from './src/screens/MapScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OnboardingScreen, { checkOnboardingComplete } from './src/screens/OnboardingScreen';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { AuthProvider } from './src/context/AuthContext';
import { addNotificationListeners, registerForPushNotifications } from './src/services/notifications';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigationRef = useRef(null);

  useEffect(() => {
    checkInitialState();
  }, []);

  useEffect(() => {
    // Set up notification listeners
    const unsubscribe = addNotificationListeners(
      // Notification received while app is foregrounded
      (notification) => {
        console.log('Notification received:', notification);
      },
      // User tapped on notification
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.eventId && navigationRef.current) {
          // Navigate to event detail
          navigationRef.current.navigate('EventDetail', { eventId: data.eventId });
        }
      }
    );

    return unsubscribe;
  }, []);

  const checkInitialState = async () => {
    try {
      const onboardingComplete = await checkOnboardingComplete();
      setShowOnboarding(!onboardingComplete);
      
      // Register for push notifications if onboarding is complete
      if (onboardingComplete) {
        registerForPushNotifications();
      }
    } catch (error) {
      console.error('Error checking initial state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    registerForPushNotifications();
  };

  if (isLoading) {
    return null; // Or a splash screen
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return (
    <AuthProvider>
    <FavoritesProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="dark" />
        <Stack.Navigator 
          screenOptions={{ 
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen 
            name="EventDetail" 
            component={EventDetailScreen}
            options={{
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen 
            name="Map" 
            component={MapScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen 
            name="Profile" 
            component={ProfileScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </FavoritesProvider>
    </AuthProvider>
  );
}
