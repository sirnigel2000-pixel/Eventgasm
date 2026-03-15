import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cache, cacheKey } from './cache';

// Always use production API (localhost won't work from phone)
const API_BASE = 'https://eventgasm.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // Increased for Render cold starts
});

// Add auth interceptor to include user_id in requests
const AUTH_KEY = '@eventgasm_user';
api.interceptors.request.use(async (config) => {
  try {
    const userData = await AsyncStorage.getItem(AUTH_KEY);
    if (userData) {
      const user = JSON.parse(userData);
      // Add user_id to params for GET requests
      if (config.method === 'get' && user.id) {
        config.params = { ...config.params, user_id: user.id };
      }
      // Add user_id to body for POST/PUT/PATCH requests
      if (['post', 'put', 'patch'].includes(config.method) && user.id) {
        config.data = { ...config.data, user_id: user.id };
      }
    }
  } catch (e) {
    // Ignore auth errors
  }
  return config;
});

export async function fetchEvents(params = {}) {
  const key = cacheKey(params);
  
  try {
    // Try network first
    const { data } = await api.get('/events', { params });
    
    // Cache successful response
    await cache.set(key, data);
    
    return data;
  } catch (error) {
    console.error('API Error:', error.message);
    
    // Try to serve from cache if offline
    const cached = await cache.getStale(key);
    if (cached) {
      console.log('[API] Serving cached data (offline mode)');
      return { 
        ...cached.data, 
        _cached: true,
        _cacheAge: cached.age 
      };
    }
    
    throw error;
  }
}

export async function fetchFreeEvents(params = {}) {
  try {
    const { data } = await api.get('/events/free', { params });
    return data;
  } catch (error) {
    console.error('API Error:', error.message);
    throw error;
  }
}

export async function fetchLocalEvents(params = {}) {
  try {
    const { data } = await api.get('/events/local', { params });
    return data;
  } catch (error) {
    console.error('API Error:', error.message);
    throw error;
  }
}

export async function fetchTrending(params = {}) {
  try {
    const { data } = await api.get('/events/trending', { params });
    return data;
  } catch (error) {
    console.error('API Error:', error.message);
    throw error;
  }
}

export async function fetchEventById(id) {
  try {
    const { data } = await api.get(`/events/${id}`);
    return data;
  } catch (error) {
    console.error('API Error:', error.message);
    throw error;
  }
}

export async function fetchCategories() {
  try {
    const { data } = await api.get('/events/categories');
    return data;
  } catch (error) {
    console.error('API Error:', error.message);
    throw error;
  }
}

export default api;
