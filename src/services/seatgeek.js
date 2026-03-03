const axios = require('axios');
const Event = require('../models/Event');

const CLIENT_ID = process.env.SEATGEEK_CLIENT_ID;
const CLIENT_SECRET = process.env.SEATGEEK_CLIENT_SECRET;
const BASE_URL = 'https://api.seatgeek.com/2';

// Category mapping
const TYPE_MAP = {
  'concert': 'Music',
  'music_festival': 'Festivals',
  'sports': 'Sports',
  'nfl': 'Sports',
  'mlb': 'Sports',
  'nba': 'Sports',
  'nhl': 'Sports',
  'mls': 'Sports',
  'ncaa_football': 'Sports',
  'ncaa_basketball': 'Sports',
  'theater': 'Arts & Theatre',
  'broadway_tickets_national': 'Arts & Theatre',
  'comedy': 'Comedy',
  'family': 'Family & Kids',
  'cirque_du_soleil': 'Arts & Theatre',
  'classical': 'Music',
  'dance_performance_tour': 'Arts & Theatre'
};

async function fetchEvents({ lat, lon, range = '50mi', page = 1, perPage = 100 }) {
  if (!CLIENT_ID) {
    console.log('SeatGeek API credentials not configured');
    return { events: [], hasMore: false };
  }

  try {
    const params = {
      client_id: CLIENT_ID,
      per_page: perPage,
      page,
      'datetime_utc.gte': new Date().toISOString()
    };

    if (CLIENT_SECRET) {
      params.client_secret = CLIENT_SECRET;
    }

    if (lat && lon) {
      params.lat = lat;
      params.lon = lon;
      params.range = range;
    }

    const response = await axios.get(`${BASE_URL}/events`, { params });

    const data = response.data;
    const events = (data.events || []).map(parseEvent);
    const hasMore = data.meta?.page * data.meta?.per_page < data.meta?.total;

    return { events, hasMore, total: data.meta?.total };
  } catch (error) {
    console.error('SeatGeek API error:', error.response?.data || error.message);
    return { events: [], hasMore: false };
  }
}

function parseEvent(raw) {
  const venue = raw.venue || {};
  const performers = raw.performers || [];
  const stats = raw.stats || {};
  
  // Get main performer's image or event image
  const mainPerformer = performers[0] || {};
  const imageUrl = mainPerformer.image || mainPerformer.images?.huge || null;
  
  // Determine category from type
  const eventType = raw.type || '';
  let category = TYPE_MAP[eventType] || 'Other';
  
  // Check taxonomies for better categorization
  if (raw.taxonomies) {
    for (const tax of raw.taxonomies) {
      if (TYPE_MAP[tax.name]) {
        category = TYPE_MAP[tax.name];
        break;
      }
    }
  }

  return {
    source: 'seatgeek',
    source_id: String(raw.id),
    title: raw.title || raw.short_title,
    description: performers.map(p => p.name).join(', ') || null,
    category,
    subcategory: eventType,
    
    venue_name: venue.name,
    address: venue.address,
    city: venue.city,
    state: venue.state,
    zip: venue.postal_code,
    country: venue.country || 'US',
    latitude: venue.location?.lat || null,
    longitude: venue.location?.lon || null,
    
    start_time: raw.datetime_utc || raw.datetime_local,
    end_time: null,
    timezone: venue.timezone,
    is_all_day: false,
    
    image_url: imageUrl,
    ticket_url: raw.url,
    price_min: stats.lowest_price || null,
    price_max: stats.highest_price || null,
    is_free: false,
    age_restriction: null,
    
    raw_data: raw
  };
}

// Sync events by state
async function syncByGeo(lat, lon, label) {
  console.log(`[SeatGeek] Syncing ${label}...`);
  
  let page = 1;
  let totalAdded = 0;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const { events, hasMore: more } = await fetchEvents({ lat, lon, page });
    
    for (const eventData of events) {
      try {
        await Event.upsert(eventData);
        totalAdded++;
      } catch (err) {
        console.error(`Failed to upsert event: ${err.message}`);
      }
    }

    hasMore = more;
    page++;
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[SeatGeek] ${label}: ${totalAdded} events synced`);
  return totalAdded;
}

// Sync major metropolitan areas
async function syncMajorMetros() {
  // Major US metros with approximate center coordinates
  const metros = [
    { lat: 40.7128, lon: -74.0060, label: 'New York' },
    { lat: 34.0522, lon: -118.2437, label: 'Los Angeles' },
    { lat: 41.8781, lon: -87.6298, label: 'Chicago' },
    { lat: 29.7604, lon: -95.3698, label: 'Houston' },
    { lat: 33.4484, lon: -112.0740, label: 'Phoenix' },
    { lat: 39.9526, lon: -75.1652, label: 'Philadelphia' },
    { lat: 29.4241, lon: -98.4936, label: 'San Antonio' },
    { lat: 32.7767, lon: -96.7970, label: 'Dallas' },
    { lat: 37.3382, lon: -121.8863, label: 'San Jose' },
    { lat: 30.2672, lon: -97.7431, label: 'Austin' },
    { lat: 37.7749, lon: -122.4194, label: 'San Francisco' },
    { lat: 47.6062, lon: -122.3321, label: 'Seattle' },
    { lat: 39.7392, lon: -104.9903, label: 'Denver' },
    { lat: 38.9072, lon: -77.0369, label: 'Washington DC' },
    { lat: 42.3601, lon: -71.0589, label: 'Boston' },
    { lat: 36.1627, lon: -86.7816, label: 'Nashville' },
    { lat: 33.7490, lon: -84.3880, label: 'Atlanta' },
    { lat: 25.7617, lon: -80.1918, label: 'Miami' },
    { lat: 36.1699, lon: -115.1398, label: 'Las Vegas' },
    { lat: 45.5051, lon: -122.6750, label: 'Portland' }
  ];

  let totalEvents = 0;
  for (const metro of metros) {
    const added = await syncByGeo(metro.lat, metro.lon, metro.label);
    totalEvents += added;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[SeatGeek] Total sync complete: ${totalEvents} events`);
  return totalEvents;
}

module.exports = { fetchEvents, syncByGeo, syncMajorMetros };
