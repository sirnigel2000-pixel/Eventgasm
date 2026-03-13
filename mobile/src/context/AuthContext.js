import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

const AUTH_KEY = '@eventgasm_user';
const API_URL = 'https://eventgasm.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveUser = async (userData) => {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const signUp = async ({ name, email }) => {
    try {
      const response = await fetch(`${API_URL}/api/users/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Signup failed');
      }
      
      const userData = await response.json();
      await saveUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signIn = async ({ email }) => {
    try {
      const response = await fetch(`${API_URL}/api/users/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Sign in failed');
      }
      
      const userData = await response.json();
      await saveUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setUser(null);
  };

  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: 'Not signed in' };
    
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error('Update failed');
      }
      
      const updatedUser = await response.json();
      await saveUser(updatedUser);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Sync favorites to server
  const syncFavorites = async (favorites) => {
    if (!user) return;
    
    try {
      await fetch(`${API_URL}/api/users/${user.id}/favorites`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorites: favorites.map(e => e.id) }),
      });
    } catch (error) {
      console.error('Failed to sync favorites:', error);
    }
  };

  // Get favorites from server
  const getFavorites = async () => {
    if (!user) return [];
    
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}/favorites`);
      if (response.ok) {
        const data = await response.json();
        return data.favorites || [];
      }
    } catch (error) {
      console.error('Failed to get favorites:', error);
    }
    return [];
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isSignedIn: !!user,
      signUp,
      signIn,
      signOut,
      updateProfile,
      syncFavorites,
      getFavorites,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
