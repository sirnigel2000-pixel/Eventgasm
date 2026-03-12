import axios from 'axios';
import { cache, cacheKey } from './cache';

const API_BASE = 'https://eventgasm.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
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
