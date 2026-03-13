import api from './api';

export const markInterested = async (eventId, userId) => {
  const response = await api.post(`/social/events/${eventId}/interact`, {
    userId,
    status: 'interested',
  });
  return response.data;
};

export const markGoing = async (eventId, userId) => {
  const response = await api.post(`/social/events/${eventId}/interact`, {
    userId,
    status: 'going',
  });
  return response.data;
};

export const markAttended = async (eventId, userId) => {
  const response = await api.post(`/social/events/${eventId}/interact`, {
    userId,
    status: 'attended',
  });
  return response.data;
};

export const getEventStats = async (eventId, userId = null) => {
  const params = userId ? { userId } : {};
  const response = await api.get(`/social/events/${eventId}/stats`, { params });
  return response.data;
};

export const getUserScore = async (userId) => {
  const response = await api.get(`/social/users/${userId}/score`);
  return response.data;
};

export const getEventUsers = async (eventId, status = null) => {
  const params = status ? { status } : {};
  const response = await api.get(`/social/events/${eventId}/users`, { params });
  return response.data;
};

export default {
  markInterested,
  markGoing,
  markAttended,
  getEventStats,
  getUserScore,
  getEventUsers,
};
