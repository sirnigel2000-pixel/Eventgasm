const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const ConversationParticipant = require('../models/ConversationParticipant');
const { Op } = require('sequelize');

// Get user's conversations
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const participations = await ConversationParticipant.findAll({
      where: { user_id: userId },
      order: [['joined_at', 'DESC']],
    });
    
    const conversationIds = participations.map(p => p.conversation_id);
    
    const conversations = await Conversation.findAll({
      where: { id: { [Op.in]: conversationIds } },
      order: [['updated_at', 'DESC']],
    });
    
    // Get last message for each conversation
    const result = await Promise.all(conversations.map(async (conv) => {
      const lastMessage = await Message.findOne({
        where: { conversation_id: conv.id },
        order: [['created_at', 'DESC']],
      });
      
      const participants = await ConversationParticipant.findAll({
        where: { conversation_id: conv.id },
      });
      
      return {
        id: conv.id,
        type: conv.type,
        squadId: conv.squad_id,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          senderId: lastMessage.sender_id,
          createdAt: lastMessage.created_at,
        } : null,
        participants: participants.map(p => p.user_id),
        updatedAt: conv.updated_at,
      };
    }));
    
    res.json({ conversations: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start or get direct conversation
router.post('/conversations/direct', async (req, res) => {
  try {
    const { userId, otherUserId } = req.body;
    
    // Check if conversation exists
    const existingParticipations = await ConversationParticipant.findAll({
      where: { user_id: { [Op.in]: [userId, otherUserId] } },
    });
    
    // Group by conversation and find one with both users
    const convCounts = {};
    existingParticipations.forEach(p => {
      convCounts[p.conversation_id] = (convCounts[p.conversation_id] || 0) + 1;
    });
    
    let conversationId = Object.keys(convCounts).find(id => convCounts[id] === 2);
    
    if (!conversationId) {
      // Create new conversation
      const conversation = await Conversation.create({ type: 'direct' });
      conversationId = conversation.id;
      
      await ConversationParticipant.bulkCreate([
        { conversation_id: conversationId, user_id: userId },
        { conversation_id: conversationId, user_id: otherUserId },
      ]);
    }
    
    res.json({ conversationId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages in conversation
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;
    
    const where = { conversation_id: conversationId };
    if (before) {
      where.created_at = { [Op.lt]: new Date(before) };
    }
    
    const messages = await Message.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
    });
    
    res.json({ 
      messages: messages.reverse().map(m => ({
        id: m.id,
        senderId: m.sender_id,
        content: m.content,
        type: m.message_type,
        eventId: m.event_id,
        createdAt: m.created_at,
        readAt: m.read_at,
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send message
router.post('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { senderId, content, messageType = 'text', eventId } = req.body;
    
    const message = await Message.create({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: messageType,
      event_id: eventId,
    });
    
    // Update conversation timestamp
    await Conversation.update(
      { updated_at: new Date() },
      { where: { id: conversationId } }
    );
    
    res.json({
      message: {
        id: message.id,
        senderId: message.sender_id,
        content: message.content,
        type: message.message_type,
        eventId: message.event_id,
        createdAt: message.created_at,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark messages as read
router.post('/conversations/:conversationId/read', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;
    
    await Message.update(
      { read_at: new Date() },
      { 
        where: { 
          conversation_id: conversationId,
          sender_id: { [Op.ne]: userId },
          read_at: null,
        }
      }
    );
    
    await ConversationParticipant.update(
      { last_read_at: new Date() },
      { where: { conversation_id: conversationId, user_id: userId } }
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
