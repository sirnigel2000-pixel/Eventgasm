import api from './api';

export const getConversations = async (userId) => {
  const response = await api.get(`/messages/conversations/${userId}`);
  return response.data;
};

export const startConversation = async (userId, otherUserId) => {
  const response = await api.post('/messages/conversations/direct', {
    userId,
    otherUserId,
  });
  return response.data;
};

export const getMessages = async (conversationId, before = null) => {
  const params = before ? { before } : {};
  const response = await api.get(`/messages/conversations/${conversationId}/messages`, { params });
  return response.data;
};

export const sendMessage = async (conversationId, senderId, content, messageType = 'text', eventId = null) => {
  const response = await api.post(`/messages/conversations/${conversationId}/messages`, {
    senderId,
    content,
    messageType,
    eventId,
  });
  return response.data;
};

export const markAsRead = async (conversationId, userId) => {
  const response = await api.post(`/messages/conversations/${conversationId}/read`, {
    userId,
  });
  return response.data;
};

export default {
  getConversations,
  startConversation,
  getMessages,
  sendMessage,
  markAsRead,
};
