import api from './api';

export const createSquad = async (eventId, creatorId, name, description, maxMembers = 10) => {
  const response = await api.post('/squads', {
    eventId,
    creatorId,
    name,
    description,
    maxMembers,
  });
  return response.data;
};

export const getEventSquads = async (eventId) => {
  const response = await api.get(`/squads/event/${eventId}`);
  return response.data;
};

export const getUserSquads = async (userId) => {
  const response = await api.get(`/squads/user/${userId}`);
  return response.data;
};

export const joinSquad = async (squadId, userId) => {
  const response = await api.post(`/squads/${squadId}/join`, { userId });
  return response.data;
};

export const leaveSquad = async (squadId, userId) => {
  const response = await api.post(`/squads/${squadId}/leave`, { userId });
  return response.data;
};

export default {
  createSquad,
  getEventSquads,
  getUserSquads,
  joinSquad,
  leaveSquad,
};
