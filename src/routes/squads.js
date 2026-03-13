const express = require('express');
const router = express.Router();
const Squad = require('../models/Squad');
const SquadMember = require('../models/SquadMember');
const Conversation = require('../models/Conversation');
const ConversationParticipant = require('../models/ConversationParticipant');
const { Op } = require('sequelize');

// Create a squad for an event
router.post('/', async (req, res) => {
  try {
    const { eventId, creatorId, name, description, maxMembers = 10, isPublic = true } = req.body;
    
    // Create squad
    const squad = await Squad.create({
      event_id: eventId,
      creator_id: creatorId,
      name,
      description,
      max_members: maxMembers,
      is_public: isPublic,
    });
    
    // Add creator as member
    await SquadMember.create({
      squad_id: squad.id,
      user_id: creatorId,
      role: 'creator',
      status: 'accepted',
    });
    
    // Create squad conversation
    const conversation = await Conversation.create({
      type: 'squad',
      squad_id: squad.id,
    });
    
    await ConversationParticipant.create({
      conversation_id: conversation.id,
      user_id: creatorId,
    });
    
    res.json({
      squad: {
        id: squad.id,
        eventId: squad.event_id,
        name: squad.name,
        description: squad.description,
        maxMembers: squad.max_members,
        isPublic: squad.is_public,
        status: squad.status,
        conversationId: conversation.id,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get squads for an event
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const squads = await Squad.findAll({
      where: { 
        event_id: eventId,
        is_public: true,
        status: { [Op.ne]: 'closed' },
      },
      order: [['created_at', 'DESC']],
    });
    
    const result = await Promise.all(squads.map(async (squad) => {
      const members = await SquadMember.findAll({
        where: { squad_id: squad.id, status: 'accepted' },
      });
      
      return {
        id: squad.id,
        name: squad.name,
        description: squad.description,
        creatorId: squad.creator_id,
        maxMembers: squad.max_members,
        currentMembers: members.length,
        status: squad.status,
        createdAt: squad.created_at,
      };
    }));
    
    res.json({ squads: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's squads
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const memberships = await SquadMember.findAll({
      where: { user_id: userId, status: 'accepted' },
    });
    
    const squadIds = memberships.map(m => m.squad_id);
    
    const squads = await Squad.findAll({
      where: { id: { [Op.in]: squadIds } },
      order: [['created_at', 'DESC']],
    });
    
    const result = await Promise.all(squads.map(async (squad) => {
      const members = await SquadMember.findAll({
        where: { squad_id: squad.id, status: 'accepted' },
      });
      
      return {
        id: squad.id,
        eventId: squad.event_id,
        name: squad.name,
        description: squad.description,
        currentMembers: members.length,
        maxMembers: squad.max_members,
        myRole: memberships.find(m => m.squad_id === squad.id)?.role,
      };
    }));
    
    res.json({ squads: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request to join a squad
router.post('/:squadId/join', async (req, res) => {
  try {
    const { squadId } = req.params;
    const { userId } = req.body;
    
    const squad = await Squad.findByPk(squadId);
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }
    
    // Check if already a member
    const existing = await SquadMember.findOne({
      where: { squad_id: squadId, user_id: userId },
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Already a member or pending' });
    }
    
    // Check if squad is full
    const memberCount = await SquadMember.count({
      where: { squad_id: squadId, status: 'accepted' },
    });
    
    if (memberCount >= squad.max_members) {
      return res.status(400).json({ error: 'Squad is full' });
    }
    
    // Add as pending (or accepted if auto-approve)
    const member = await SquadMember.create({
      squad_id: squadId,
      user_id: userId,
      status: squad.is_public ? 'accepted' : 'pending',
    });
    
    // If accepted, add to conversation
    if (member.status === 'accepted') {
      const conversation = await Conversation.findOne({
        where: { squad_id: squadId },
      });
      
      if (conversation) {
        await ConversationParticipant.create({
          conversation_id: conversation.id,
          user_id: userId,
        });
      }
      
      // Update squad status if full
      if (memberCount + 1 >= squad.max_members) {
        await squad.update({ status: 'full' });
      }
    }
    
    res.json({
      success: true,
      status: member.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave a squad
router.post('/:squadId/leave', async (req, res) => {
  try {
    const { squadId } = req.params;
    const { userId } = req.body;
    
    const member = await SquadMember.findOne({
      where: { squad_id: squadId, user_id: userId },
    });
    
    if (!member) {
      return res.status(404).json({ error: 'Not a member' });
    }
    
    if (member.role === 'creator') {
      return res.status(400).json({ error: 'Creator cannot leave. Transfer ownership or delete squad.' });
    }
    
    await member.destroy();
    
    // Remove from conversation
    const conversation = await Conversation.findOne({
      where: { squad_id: squadId },
    });
    
    if (conversation) {
      await ConversationParticipant.destroy({
        where: { conversation_id: conversation.id, user_id: userId },
      });
    }
    
    // Update squad status if was full
    const squad = await Squad.findByPk(squadId);
    if (squad && squad.status === 'full') {
      await squad.update({ status: 'open' });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
