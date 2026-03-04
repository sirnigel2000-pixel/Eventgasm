import axios from 'axios';

const API_BASE = 'https://eventgasm.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

export async function fetchEvents(params = {}) {
  const { data } = await api.get('/events', { params });
  return data;
}

export async function fetchEventById(id) {
  const { data } = await api.get(`/events/${id}`);
  return data;
}

export default api;
