const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// GET /api/events - List events with filters
router.get('/', async (req, res) => {
  try {
    const {
      lat, lng, radius = 25,
      city, state,
      category,
      start_date, end_date,
      q, // search query
      limit = 50, offset = 0
    } = req.query;

    let events;

    if (q) {
      // Text search
      events = await Event.search({
        query: q,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } else if (lat && lng) {
      // Geospatial search
      events = await Event.findNearby({
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radiusMiles: parseInt(radius),
        limit: parseInt(limit),
        offset: parseInt(offset),
        category,
        startDate: start_date,
        endDate: end_date
      });
    } else if (city || state) {
      // Location-based search
      events = await Event.findByLocation({
        city,
        state,
        limit: parseInt(limit),
        offset: parseInt(offset),
        category,
        startDate: start_date,
        endDate: end_date
      });
    } else if (category) {
      // Category filter
      events = await Event.findByCategory({
        category,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } else {
      // Trending/default
      events = await Event.getTrending({ limit: parseInt(limit) });
    }

    res.json({
      success: true,
      count: events.length,
      events: events.map(formatEvent)
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
});

// GET /api/events/trending
router.get('/trending', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const events = await Event.getTrending({ limit: parseInt(limit) });
    res.json({
      success: true,
      count: events.length,
      events: events.map(formatEvent)
    });
  } catch (error) {
    console.error('Error fetching trending:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trending events' });
  }
});

// GET /api/events/categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Event.getCategoryCounts();
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// GET /api/events/:id
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    res.json({ success: true, event: formatEvent(event) });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch event' });
  }
});

// Format event for API response
function formatEvent(event) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    subcategory: event.subcategory,
    venue: {
      name: event.venue_name,
      address: event.address,
      city: event.city,
      state: event.state,
      zip: event.zip,
      country: event.country,
      coordinates: event.latitude && event.longitude ? {
        lat: parseFloat(event.latitude),
        lng: parseFloat(event.longitude)
      } : null
    },
    timing: {
      start: event.start_time,
      end: event.end_time,
      timezone: event.timezone,
      isAllDay: event.is_all_day
    },
    image: event.image_url,
    ticketUrl: event.ticket_url,
    price: {
      min: event.price_min ? parseFloat(event.price_min) : null,
      max: event.price_max ? parseFloat(event.price_max) : null,
      isFree: event.is_free
    },
    ageRestriction: event.age_restriction,
    source: event.source,
    shareUrl: `${process.env.BASE_URL}/e/${event.id}`,
    distance: event.distance_miles ? Math.round(event.distance_miles * 10) / 10 : null
  };
}

module.exports = router;
