import axios from 'axios';

const API_BASE = 'https://eventgasm.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

export async function fetchEvents(params = {}) {
  try {
    const { data } = await api.get('/events', { params });
    return data;
  } catch (error) {
    console.error('API Error:', error.message);
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
