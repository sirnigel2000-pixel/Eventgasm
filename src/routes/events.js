const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const stubhub = require('../services/stubhub');
const vividseats = require('../services/vividseats');

// Helper: Group events by title + venue to consolidate multiple showtimes
function groupEventsByShowtime(events) {
  const grouped = new Map();
  
  for (const event of events) {
    // Create a key from title + venue name (normalized)
    const title = (event.title || '').toLowerCase().trim();
    const venue = (event.venue_name || event.venue?.name || '').toLowerCase().trim();
    const key = `${title}|||${venue}`;
    
    if (grouped.has(key)) {
      // Add this showtime to existing group
      const existing = grouped.get(key);
      existing.showtimes.push({
        id: event.id,
        start: event.start_time || event.timing?.start,
        end: event.end_time || event.timing?.end,
        ticketUrl: event.ticket_url || event.ticketUrl
      });
      // Update date range
      const newStart = new Date(event.start_time || event.timing?.start);
      if (newStart < new Date(existing.dateRange.start)) {
        existing.dateRange.start = event.start_time || event.timing?.start;
      }
      if (newStart > new Date(existing.dateRange.end)) {
        existing.dateRange.end = event.start_time || event.timing?.start;
      }
    } else {
      // Create new group
      const startTime = event.start_time || event.timing?.start;
      grouped.set(key, {
        ...event,
        showtimes: [{
          id: event.id,
          start: startTime,
          end: event.end_time || event.timing?.end,
          ticketUrl: event.ticket_url || event.ticketUrl
        }],
        dateRange: {
          start: startTime,
          end: startTime
        },
        totalShowtimes: 1
      });
    }
  }
  
  // Convert map to array and update totalShowtimes
  return Array.from(grouped.values()).map(event => ({
    ...event,
    totalShowtimes: event.showtimes.length
  }));
}

// GET /api/events - List events with filters
router.get('/', async (req, res) => {
  try {
    const {
      lat, lng, radius = 25,
      // Bounding box params for map view
      min_lat, max_lat, min_lng, max_lng,
      city, state,
      category,
      free,        // New: filter for free events only
      source,      // New: filter by source (allevents, ticketmaster, etc.)
      vibe,        // New: vibe filter (chill, rowdy, artsy, etc.)
      start_date, end_date,
      q, search,   // search query (support both)
      limit = 50, offset = 0,
      cluster      // If true, return clustered results for map
    } = req.query;

    const query = q || search;
    const isFreeOnly = free === 'true' || free === '1';

    let events;

    if (query) {
      // Text search
      events = await Event.search({
        query,
        limit: parseInt(limit),
        offset: parseInt(offset),
        isFree: isFreeOnly,
        source,
        category
      });
    } else if (min_lat && max_lat && min_lng && max_lng) {
      // Bounding box search for map view
      events = await Event.findInBounds({
        minLat: parseFloat(min_lat),
        maxLat: parseFloat(max_lat),
        minLng: parseFloat(min_lng),
        maxLng: parseFloat(max_lng),
        limit: Math.min(parseInt(limit), 500), // Cap at 500 for map performance
        offset: parseInt(offset),
        category,
        startDate: start_date,
        endDate: end_date,
        isFree: isFreeOnly,
        source
      });
    } else if (lat && lng) {
      // Geospatial search with smart radius expansion for rural areas
      let searchRadius = parseInt(radius);
      
      events = await Event.findNearby({
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radiusMiles: searchRadius,
        limit: parseInt(limit),
        offset: parseInt(offset),
        category,
        startDate: start_date,
        endDate: end_date,
        isFree: isFreeOnly,
        source
      });

      // AUTO-EXPAND: If few results, expand radius for rural users
      const MIN_RESULTS = 5;
      const RADIUS_STEPS = [50, 100, 150]; // Miles to try
      
      for (const expandedRadius of RADIUS_STEPS) {
        if (events.length >= MIN_RESULTS || searchRadius >= expandedRadius) break;
        
        console.log(`[SmartRadius] Only ${events.length} events at ${searchRadius}mi, expanding to ${expandedRadius}mi`);
        searchRadius = expandedRadius;
        
        events = await Event.findNearby({
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          radiusMiles: searchRadius,
          limit: parseInt(limit),
          offset: parseInt(offset),
          category,
          startDate: start_date,
          endDate: end_date,
          isFree: isFreeOnly,
          source
        });
      }

      // Mark events with "worth the drive" if they're far
      events = events.map(e => ({
        ...e,
        expandedRadius: searchRadius > parseInt(radius),
        searchRadius: searchRadius
      }));
    } else if (city || state) {
      // Location-based search
      events = await Event.findByLocation({
        city,
        state,
        limit: parseInt(limit),
        offset: parseInt(offset),
        category,
        startDate: start_date,
        endDate: end_date,
        isFree: isFreeOnly,
        source
      });
    } else if (category) {
      // Category filter
      events = await Event.findByCategory({
        category,
        limit: parseInt(limit),
        offset: parseInt(offset),
        isFree: isFreeOnly,
        source
      });
    } else if (isFreeOnly) {
      // Free events only
      events = await Event.findFreeEvents({
        limit: parseInt(limit),
        offset: parseInt(offset),
        state
      });
    } else {
      // Trending/default
      events = await Event.getTrending({ 
        limit: parseInt(limit),
        state,
        source
      });
    }

    // Group events by title+venue to consolidate showtimes (default: on)
    const shouldGroup = req.query.group !== 'false';
    let processedEvents = events.map(formatEvent);
    
    if (shouldGroup) {
      processedEvents = groupEventsByShowtime(processedEvents);
    }

    res.json({
      success: true,
      count: processedEvents.length,
      events: processedEvents
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
});

// GET /api/events/free - Free events only (convenience endpoint)
router.get('/free', async (req, res) => {
  try {
    const { state = 'FL', city, limit = 50, offset = 0, category } = req.query;
    
    const events = await Event.findFreeEvents({
      state,
      city,
      category,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      count: events.length,
      filter: 'free',
      events: events.map(formatEvent)
    });
  } catch (error) {
    console.error('Error fetching free events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch free events' });
  }
});

// GET /api/events/local - Local/community events (AllEvents, small venues)
router.get('/local', async (req, res) => {
  try {
    const { state = 'FL', city, limit = 50, offset = 0 } = req.query;
    
    const events = await Event.findByLocation({
      state,
      city,
      limit: parseInt(limit),
      offset: parseInt(offset),
      source: 'allevents'  // Focus on community events
    });

    res.json({
      success: true,
      count: events.length,
      filter: 'local',
      events: events.map(formatEvent)
    });
  } catch (error) {
    console.error('Error fetching local events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch local events' });
  }
});

// GET /api/events/trending
router.get('/trending', async (req, res) => {
  try {
    const { limit = 20, state } = req.query;
    const events = await Event.getTrending({ limit: parseInt(limit), state });
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
    
    // Add curated vibes
    const vibes = [
      { id: 'free', name: 'Free', emoji: '🆓' },
      { id: 'music', name: 'Live Music', emoji: '🎵' },
      { id: 'food', name: 'Food & Drink', emoji: '🍻' },
      { id: 'artsy', name: 'Arts & Culture', emoji: '🎨' },
      { id: 'sports', name: 'Sports', emoji: '⚽' },
      { id: 'nightlife', name: 'Nightlife', emoji: '🌙' },
      { id: 'family', name: 'Family Friendly', emoji: '👨‍👩‍👧' },
      { id: 'singles', name: 'Singles & Dating', emoji: '💘' },
      { id: 'outdoor', name: 'Outdoor', emoji: '🌳' },
      { id: 'community', name: 'Community', emoji: '🏘️' },
    ];

    res.json({ 
      success: true, 
      categories,
      vibes
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// GET /api/events/sources - List available event sources
router.get('/sources', async (req, res) => {
  try {
    const sources = [
      { id: 'ticketmaster', name: 'Ticketmaster', type: 'major' },
      { id: 'seatgeek', name: 'SeatGeek', type: 'major' },
      { id: 'allevents', name: 'AllEvents', type: 'local' },
      { id: 'bandsintown', name: 'Bandsintown', type: 'music' },
    ];

    res.json({ success: true, sources });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch sources' });
  }
});

// GET /api/events/stats - Get total event counts
router.get('/stats', async (req, res) => {
  try {
    const { pool } = require('../db');
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM events');
    const futureResult = await pool.query('SELECT COUNT(*) as future FROM events WHERE start_time >= NOW()');
    const sourcesResult = await pool.query(`
      SELECT source, COUNT(*) as count 
      FROM events 
      GROUP BY source 
      ORDER BY count DESC
    `);
    const recentResult = await pool.query(`
      SELECT COUNT(*) as recent 
      FROM events 
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);
    
    res.json({ 
      success: true,
      total: parseInt(totalResult.rows[0].total),
      future: parseInt(futureResult.rows[0].future),
      addedLastHour: parseInt(recentResult.rows[0].recent),
      sources: sourcesResult.rows.map(r => ({ source: r.source, count: parseInt(r.count) }))
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
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

// Generate ticket links for an event (primary + resale options)
function getTicketLinks(event) {
  const links = [];
  
  // Primary ticket link (from original source)
  if (event.ticket_url) {
    const sourceNames = {
      'ticketmaster': 'Ticketmaster',
      'seatgeek': 'SeatGeek',
      'eventbrite': 'Eventbrite',
      'allevents': 'AllEvents',
      'bandsintown': 'Bandsintown'
    };
    
    links.push({
      source: event.source,
      name: sourceNames[event.source] || event.source,
      type: 'primary',
      url: event.ticket_url,
      icon: '🎟️'
    });
  }
  
  // Add resale options for paid events (not for free/community events)
  if (!event.is_free && event.source !== 'library' && event.source !== 'parks') {
    // StubHub
    links.push(stubhub.getTicketLink(event));
    // VividSeats
    links.push(vividseats.getTicketLink(event));
  }
  
  return links;
}

// Format event for API response
function formatEvent(event) {
  const ticketLinks = getTicketLinks(event);
  
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
    ticketLinks: ticketLinks,  // NEW: Array of all ticket options
    price: {
      min: event.price_min ? parseFloat(event.price_min) : null,
      max: event.price_max ? parseFloat(event.price_max) : null,
      isFree: event.is_free
    },
    isFree: event.is_free,
    ageRestriction: event.age_restriction,
    source: event.source,
    shareUrl: `${process.env.BASE_URL || 'https://eventgasm.com'}/e/${event.id}`,
    distance: event.distance_miles ? Math.round(event.distance_miles * 10) / 10 : null,
    // Social stats (populated separately if requested)
    social: event.social || {
      interested: 0,
      going: 0,
      total: 0,
    }
  };
}

module.exports = router;
