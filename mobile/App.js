import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './src/screens/HomeScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import MapScreen from './src/screens/MapScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SocialScreen from './src/screens/SocialScreen';
import SavedScreen from './src/screens/SavedScreen';
import OnboardingScreen, { checkOnboardingComplete } from './src/screens/OnboardingScreen';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { AuthProvider } from './src/context/AuthContext';
import { addNotificationListeners, registerForPushNotifications } from './src/services/notifications';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main tab navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'SocialTab') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'SavedTab') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen 
        name="SocialTab" 
        component={SocialScreen}
        options={{ tabBarLabel: 'Social' }}
      />
      <Tab.Screen 
        name="SavedTab" 
        component={SavedScreen}
        options={{ tabBarLabel: 'Saved' }}
      />
      <Tab.Screen 
        name="ProfileTab" 
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigationRef = useRef(null);

  useEffect(() => {
    checkInitialState();
  }, []);

  useEffect(() => {
    const unsubscribe = addNotificationListeners(
      (notification) => {
        console.log('Notification received:', notification);
      },
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.eventId && navigationRef.current) {
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
    return null;
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
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen 
            name="EventDetail" 
            component={EventDetailScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen 
            name="Map" 
            component={MapScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </FavoritesProvider>
    </AuthProvider>
  );
}
