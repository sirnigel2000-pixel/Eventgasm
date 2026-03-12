import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FavoritesContext = createContext();

const STORAGE_KEY = '@eventgasm_favorites';

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Load favorites from storage on mount
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoaded(true);
    }
  };

  const saveFavorites = async (newFavorites) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  const addFavorite = (event) => {
    const newFavorites = [...favorites, event];
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  };

  const removeFavorite = (eventId) => {
    const newFavorites = favorites.filter(e => e.id !== eventId);
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  };

  const toggleFavorite = (event) => {
    if (isFavorite(event.id)) {
      removeFavorite(event.id);
    } else {
      addFavorite(event);
    }
  };

  const isFavorite = (eventId) => {
    return favorites.some(e => e.id === eventId);
  };

  return (
    <FavoritesContext.Provider value={{
      favorites,
      loaded,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      isFavorite,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
