import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/HomeScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import MapScreen from './src/screens/MapScreen';
import { FavoritesProvider } from './src/context/FavoritesContext';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <FavoritesProvider>
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
    </FavoritesProvider>
  );
}
