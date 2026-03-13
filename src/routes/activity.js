const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const Event = require('../models/Event');
const { Op } = require('sequelize');

// Get activity feed (friends' activities)
router.get('/feed/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 30, before } = req.query;
    
    // For now, show all recent activities (will filter to friends later)
    const where = {};
    if (before) {
      where.created_at = { [Op.lt]: new Date(before) };
    }
    
    const activities = await Activity.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
    });
    
    // Enrich with event data
    const enriched = await Promise.all(activities.map(async (act) => {
      let event = null;
      if (act.event_id) {
        event = await Event.findByPk(act.event_id, {
          attributes: ['id', 'title', 'image_url', 'start_time', 'venue_name', 'city'],
        });
      }
      
      return {
        id: act.id,
        userId: act.user_id,
        type: act.activity_type,
        eventId: act.event_id,
        squadId: act.squad_id,
        targetUserId: act.target_user_id,
        metadata: act.metadata,
        createdAt: act.created_at,
        event: event ? {
          id: event.id,
          title: event.title,
          image: event.image_url,
          date: event.start_time,
          venue: event.venue_name,
          city: event.city,
        } : null,
      };
    }));
    
    res.json({ activities: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log an activity
router.post('/', async (req, res) => {
  try {
    const { userId, activityType, eventId, squadId, targetUserId, metadata } = req.body;
    
    const activity = await Activity.create({
      user_id: userId,
      activity_type: activityType,
      event_id: eventId || null,
      squad_id: squadId || null,
      target_user_id: targetUserId || null,
      metadata: metadata || {},
    });
    
    res.json({ 
      success: true,
      activity: {
        id: activity.id,
        type: activity.activity_type,
        createdAt: activity.created_at,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's own activity history
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;
    
    const activities = await Activity.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
    });
    
    res.json({ activities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
