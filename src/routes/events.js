const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const Event = require('../models/Event');
const stubhub = require('../services/stubhub');
const vividseats = require('../services/vividseats');

// Database connection for direct queries
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper: Add variety to event list - dedupe titles, mix categories, shuffle
function addVariety(events) {
  if (events.length < 5) return events;
  
  // FIRST: Dedupe by title (same show, different showtimes)
  const seenTitles = new Set();
  events = events.filter(e => {
    const titleKey = (e.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
    if (seenTitles.has(titleKey)) return false;
    seenTitles.add(titleKey);
    return true;
  });
  
  // Group by category
  const byCategory = {};
  events.forEach(e => {
    const cat = e.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(e);
  });
  
  // Shuffle each category
  Object.values(byCategory).forEach(arr => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  });
  
  // Interleave categories for variety
  const result = [];
  const categories = Object.keys(byCategory);
  let added = true;
  let index = 0;
  
  while (added && result.length < events.length) {
    added = false;
    // Randomize category order each round
    const shuffledCats = [...categories].sort(() => Math.random() - 0.5);
    for (const cat of shuffledCats) {
      if (byCategory[cat].length > index) {
        result.push(byCategory[cat][index]);
        added = true;
      }
    }
    index++;
  }
  
  return result;
}

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

// GET /api/events/recommended - Personalized event recommendations
// Uses location + user preferences to sort events
router.get('/recommended', async (req, res) => {
  try {
    const {
      lat, lng, radius = 50,
      preferred_categories,
      limit = 50,
      offset = 0,
    } = req.query;

    let events = [];
    
    // If we have location, get nearby events
    if (lat && lng) {
      events = await Event.findNearby({
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radiusMiles: parseInt(radius),
        limit: Math.min(parseInt(limit) * 2, 200), // Fetch extra for filtering
        offset: parseInt(offset),
      });
    } else {
      // Fallback: get upcoming events sorted by popularity
      events = await Event.getTrending({ limit: parseInt(limit) * 2 });
    }

    // Boost preferred categories to the top
    if (preferred_categories) {
      const preferred = preferred_categories.split(',').map(c => c.trim().toLowerCase());
      events = events.map(e => ({
        ...e,
        _boost: preferred.includes((e.category || '').toLowerCase()) ? 100 : 0
      }));
      
      // Sort by boost (preferred first), then by original order (distance)
      events.sort((a, b) => {
        if (b._boost !== a._boost) return b._boost - a._boost;
        return 0; // Keep original distance-based order for same boost
      });
    }

    // Filter out events without images (swipe needs visual appeal)
    events = events.filter(e => e.image_url);
    
    // Add variety: shuffle within distance bands, mix categories
    events = addVariety(events);
    
    // Limit results
    events = events.slice(0, parseInt(limit));

    // Format events
    const formattedEvents = events.map(formatEvent);

    res.json({
      success: true,
      count: formattedEvents.length,
      personalized: !!preferred_categories,
      events: formattedEvents,
    });
  } catch (error) {
    console.error('Error fetching recommended events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
  }
});

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
        limit: Math.min(parseInt(limit), 2000), // Cap at 2000 for map
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

// Get event counts by state for map overview (MUST be before /:id)
router.get('/counts/by-state', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        state,
        COUNT(*) as count
      FROM events 
      WHERE state IS NOT NULL 
        AND latitude IS NOT NULL
        AND start_time > NOW()
      GROUP BY state
      ORDER BY count DESC
    `);
    
    const stateCenters = {
      'Alabama': { lat: 32.806671, lng: -86.791130 },
      'Alaska': { lat: 61.370716, lng: -152.404419 },
      'Arizona': { lat: 33.729759, lng: -111.431221 },
      'Arkansas': { lat: 34.969704, lng: -92.373123 },
      'California': { lat: 36.116203, lng: -119.681564 },
      'Colorado': { lat: 39.059811, lng: -105.311104 },
      'Connecticut': { lat: 41.597782, lng: -72.755371 },
      'Delaware': { lat: 39.318523, lng: -75.507141 },
      'Florida': { lat: 27.766279, lng: -81.686783 },
      'Georgia': { lat: 33.040619, lng: -83.643074 },
      'Hawaii': { lat: 21.094318, lng: -157.498337 },
      'Idaho': { lat: 44.240459, lng: -114.478828 },
      'Illinois': { lat: 40.349457, lng: -88.986137 },
      'Indiana': { lat: 39.849426, lng: -86.258278 },
      'Iowa': { lat: 42.011539, lng: -93.210526 },
      'Kansas': { lat: 38.526600, lng: -96.726486 },
      'Kentucky': { lat: 37.668140, lng: -84.670067 },
      'Louisiana': { lat: 31.169546, lng: -91.867805 },
      'Maine': { lat: 44.693947, lng: -69.381927 },
      'Maryland': { lat: 39.063946, lng: -76.802101 },
      'Massachusetts': { lat: 42.230171, lng: -71.530106 },
      'Michigan': { lat: 43.326618, lng: -84.536095 },
      'Minnesota': { lat: 45.694454, lng: -93.900192 },
      'Mississippi': { lat: 32.741646, lng: -89.678696 },
      'Missouri': { lat: 38.456085, lng: -92.288368 },
      'Montana': { lat: 46.921925, lng: -110.454353 },
      'Nebraska': { lat: 41.125370, lng: -98.268082 },
      'Nevada': { lat: 38.313515, lng: -117.055374 },
      'New Hampshire': { lat: 43.452492, lng: -71.563896 },
      'New Jersey': { lat: 40.298904, lng: -74.521011 },
      'New Mexico': { lat: 34.840515, lng: -106.248482 },
      'New York': { lat: 42.165726, lng: -74.948051 },
      'North Carolina': { lat: 35.630066, lng: -79.806419 },
      'North Dakota': { lat: 47.528912, lng: -99.784012 },
      'Ohio': { lat: 40.388783, lng: -82.764915 },
      'Oklahoma': { lat: 35.565342, lng: -96.928917 },
      'Oregon': { lat: 44.572021, lng: -122.070938 },
      'Pennsylvania': { lat: 40.590752, lng: -77.209755 },
      'Rhode Island': { lat: 41.680893, lng: -71.511780 },
      'South Carolina': { lat: 33.856892, lng: -80.945007 },
      'South Dakota': { lat: 44.299782, lng: -99.438828 },
      'Tennessee': { lat: 35.747845, lng: -86.692345 },
      'Texas': { lat: 31.054487, lng: -97.563461 },
      'Utah': { lat: 40.150032, lng: -111.862434 },
      'Vermont': { lat: 44.045876, lng: -72.710686 },
      'Virginia': { lat: 37.769337, lng: -78.169968 },
      'Washington': { lat: 47.400902, lng: -121.490494 },
      'West Virginia': { lat: 38.491226, lng: -80.954453 },
      'Wisconsin': { lat: 44.268543, lng: -89.616508 },
      'Wyoming': { lat: 42.755966, lng: -107.302490 },
      'District of Columbia': { lat: 38.897438, lng: -77.026817 },
    };
    
    const states = result.rows.map(row => ({
      state: row.state,
      count: parseInt(row.count),
      ...stateCenters[row.state]
    })).filter(s => s.lat);
    
    res.json({ success: true, states });
  } catch (error) {
    console.error('Error getting state counts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/events/:id (MUST be last - catches all)
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
    // Include lat/lng at top level for mobile map compatibility
    latitude: event.latitude ? parseFloat(event.latitude) : null,
    longitude: event.longitude ? parseFloat(event.longitude) : null,
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
