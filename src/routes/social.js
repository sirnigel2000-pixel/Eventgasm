const express = require('express');
const router = express.Router();
const UserEventInteraction = require('../models/UserEventInteraction');
const UserScore = require('../models/UserScore');
const Event = require('../models/Event');

// Mark interest/going for an event
router.post('/events/:eventId/interact', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, status } = req.body; // status: interested, going, attended, not_interested
    
    if (!userId || !status) {
      return res.status(400).json({ error: 'userId and status required' });
    }
    
    // Get event for category
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Upsert interaction
    const [interaction, created] = await UserEventInteraction.upsert({
      user_id: userId,
      event_id: eventId,
      status,
      points_earned: status === 'attended' ? 50 : status === 'going' ? 15 : 5,
    }, {
      returning: true,
    });
    
    // Update user score
    if (created) {
      await UserScore.addPoints(userId, event.category || 'community', status);
    }
    
    // Get updated stats
    const stats = await UserEventInteraction.getEventStats(eventId);
    
    res.json({
      success: true,
      interaction: {
        status,
        eventId,
      },
      eventStats: stats,
    });
  } catch (err) {
    console.error('[Social] Interact error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get event social stats
router.get('/events/:eventId/stats', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.query;
    
    const stats = await UserEventInteraction.getEventStats(eventId);
    
    // Get user's status if provided
    let userStatus = null;
    if (userId) {
      const interaction = await UserEventInteraction.findOne({
        where: { user_id: userId, event_id: eventId }
      });
      userStatus = interaction?.status || null;
    }
    
    res.json({
      interested: stats.interested,
      going: stats.going,
      attended: stats.attended,
      total: stats.interested + stats.going + stats.attended,
      userStatus,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's event score
router.get('/users/:userId/score', async (req, res) => {
  try {
    const { userId } = req.params;
    
    let score = await UserScore.findOne({ where: { user_id: userId } });
    
    if (!score) {
      score = await UserScore.create({ user_id: userId });
    }
    
    res.json({
      totalScore: score.total_score,
      breakdown: {
        music: score.music_score,
        sports: score.sports_score,
        comedy: score.comedy_score,
        arts: score.arts_score,
        nightlife: score.nightlife_score,
        food: score.food_score,
        community: score.community_score,
      },
      stats: {
        interested: score.events_interested,
        going: score.events_going,
        attended: score.events_attended,
      },
      badges: score.badges,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get users interested in an event
router.get('/events/:eventId/users', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status, limit = 20 } = req.query;
    
    const where = { event_id: eventId };
    if (status) where.status = status;
    
    const interactions = await UserEventInteraction.findAll({
      where,
      limit: parseInt(limit),
      order: [['created_at', 'DESC']],
    });
    
    res.json({
      users: interactions.map(i => ({
        userId: i.user_id,
        status: i.status,
        since: i.created_at,
      })),
      count: interactions.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const matchService = require('../services/matchService');

// Get matches for a user
router.get('/users/:userId/matches', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, minScore = 50 } = req.query;
    
    const matches = await matchService.findMatches(userId, {
      limit: parseInt(limit),
      minScore: parseInt(minScore),
    });
    
    res.json({
      matches,
      count: matches.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get match percentage between two users
router.get('/users/:userId/match/:otherUserId', async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;
    const matchPercent = await matchService.calculateMatch(userId, otherUserId);
    
    res.json({ matchPercent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get users interested in same event with match scores
router.get('/events/:eventId/matches/:userId', async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    const matches = await matchService.findEventMatches(userId, eventId);
    
    res.json({
      matches,
      count: matches.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
