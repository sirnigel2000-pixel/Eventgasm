import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

const isWeb = Platform.OS === 'web';

import SwipeScreen from './src/screens/SwipeScreen';
import HomeScreen from './src/screens/HomeScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import MapScreen from './src/screens/MapScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SocialScreen from './src/screens/SocialScreen';
import SavedScreen from './src/screens/SavedScreen';
import ListsScreen from './src/screens/ListsScreen';
import TonightScreen from './src/screens/TonightScreen';
import ChatScreen from './src/screens/ChatScreen';
import OnboardingScreen, { checkOnboardingComplete } from './src/screens/OnboardingScreen';
import SubmitEventScreen from './src/screens/SubmitEventScreen';
import AdminReviewScreen from './src/screens/AdminReviewScreen';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { AuthProvider } from './src/context/AuthContext';
import { addNotificationListeners, registerForPushNotifications } from './src/services/notifications';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName={isWeb ? 'SearchTab' : 'DiscoverTab'}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'DiscoverTab') {
            iconName = focused ? 'albums' : 'albums-outline';
          } else if (route.name === 'SearchTab') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'MapTab') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'ListsTab') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'SocialTab') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'SubmitTab') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0.5,
          borderTopColor: '#C6C6C8',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      })}
    >
      {/* Swipe/Discover - MOBILE ONLY */}
      {!isWeb && (
        <Tab.Screen 
          name="DiscoverTab" 
          component={SwipeScreen}
          options={{ tabBarLabel: 'Discover' }}
        />
      )}
      <Tab.Screen 
        name="SearchTab" 
        component={HomeScreen}
        options={{ tabBarLabel: 'Search' }}
      />
      {/* Map tab for web (replaces swipe) */}
      {isWeb && (
        <Tab.Screen 
          name="MapTab" 
          component={MapScreen}
          options={{ tabBarLabel: 'Map' }}
        />
      )}
      <Tab.Screen 
        name="ListsTab" 
        component={ListsScreen}
        options={{ tabBarLabel: 'Lists' }}
      />
      <Tab.Screen 
        name="SocialTab" 
        component={SocialScreen}
        options={{ tabBarLabel: 'Friends' }}
      />
      <Tab.Screen
        name="SubmitTab"
        component={SubmitEventScreen}
        options={{
          tabBarLabel: 'Add Event',
          tabBarActiveTintColor: '#000',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={size + 4} color={color} />
          ),
        }}
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
      (notification) => console.log('Notification received:', notification),
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
      if (onboardingComplete) registerForPushNotifications();
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

  if (isLoading) return null;
  if (showOnboarding) return <OnboardingScreen onComplete={handleOnboardingComplete} />;

  return (
    <AuthProvider>
    <FavoritesProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Map" component={MapScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </FavoritesProvider>
    </AuthProvider>
  );
}
