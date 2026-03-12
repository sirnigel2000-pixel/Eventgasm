import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_PREFIX = 'eventgasm_cache_';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Cache utilities for offline support
export const cache = {
  // Store data with expiry
  async set(key, data) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheData));
    } catch (err) {
      console.log('[Cache] Write error:', err.message);
    }
  },

  // Get cached data (returns null if expired or missing)
  async get(key, maxAge = CACHE_EXPIRY) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;

      const { data, timestamp } = JSON.parse(raw);
      const age = Date.now() - timestamp;

      // Return null if expired
      if (age > maxAge) {
        return null;
      }

      return data;
    } catch (err) {
      console.log('[Cache] Read error:', err.message);
      return null;
    }
  },

  // Get even if expired (for offline fallback)
  async getStale(key) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;

      const { data, timestamp } = JSON.parse(raw);
      return { data, timestamp, age: Date.now() - timestamp };
    } catch (err) {
      return null;
    }
  },

  // Clear specific cache
  async clear(key) {
    try {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
    } catch (err) {}
  },

  // Clear all event caches
  async clearAll() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (err) {}
  },

  // Check if online
  async isOnline() {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected && state.isInternetReachable;
    } catch {
      return true; // Assume online if check fails
    }
  },
};

// Generate cache key from params
export function cacheKey(params) {
  const sorted = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return `events_${sorted}`;
}

export default cache;
