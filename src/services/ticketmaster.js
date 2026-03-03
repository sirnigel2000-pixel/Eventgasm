const axios = require('axios');
const Event = require('../models/Event');

const API_KEY = process.env.TICKETMASTER_API_KEY;
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

// Category mapping from Ticketmaster to our categories
const CATEGORY_MAP = {
  'Music': 'Music',
  'Sports': 'Sports',
  'Arts & Theatre': 'Arts & Theatre',
  'Film': 'Film',
  'Miscellaneous': 'Other',
  'Undefined': 'Other'
};

async function fetchEvents({ stateCode, countryCode = 'US', page = 0, size = 200 }) {
  if (!API_KEY) {
    console.log('Ticketmaster API key not configured');
    return { events: [], totalPages: 0 };
  }

  try {
    const response = await axios.get(`${BASE_URL}/events.json`, {
      params: {
        apikey: API_KEY,
        countryCode,
        stateCode,
        size,
        page,
        startDateTime: new Date().toISOString().split('.')[0] + 'Z',
        sort: 'date,asc'
      }
    });

    const data = response.data;
    if (!data._embedded?.events) {
      return { events: [], totalPages: 0 };
    }

    const events = data._embedded.events.map(parseEvent);
    const totalPages = data.page?.totalPages || 0;

    return { events, totalPages };
  } catch (error) {
    console.error('Ticketmaster API error:', error.message);
    return { events: [], totalPages: 0 };
  }
}

function parseEvent(raw) {
  const venue = raw._embedded?.venues?.[0] || {};
  const priceRanges = raw.priceRanges?.[0] || {};
  const classification = raw.classifications?.[0] || {};
  const images = raw.images || [];
  
  // Get best image (prefer 16:9 ratio, highest resolution)
  const bestImage = images
    .filter(img => img.ratio === '16_9')
    .sort((a, b) => (b.width || 0) - (a.width || 0))[0]
    || images[0];

  return {
    source: 'ticketmaster',
    source_id: raw.id,
    title: raw.name,
    description: raw.info || raw.pleaseNote || null,
    category: CATEGORY_MAP[classification.segment?.name] || 'Other',
    subcategory: classification.genre?.name || null,
    
    venue_name: venue.name,
    address: venue.address?.line1,
    city: venue.city?.name,
    state: venue.state?.stateCode,
    zip: venue.postalCode,
    country: venue.country?.countryCode || 'US',
    latitude: venue.location?.latitude ? parseFloat(venue.location.latitude) : null,
    longitude: venue.location?.longitude ? parseFloat(venue.location.longitude) : null,
    
    start_time: raw.dates?.start?.dateTime || `${raw.dates?.start?.localDate}T${raw.dates?.start?.localTime || '00:00:00'}`,
    end_time: raw.dates?.end?.dateTime || null,
    timezone: raw.dates?.timezone,
    is_all_day: raw.dates?.start?.noSpecificTime || false,
    
    image_url: bestImage?.url || null,
    ticket_url: raw.url,
    price_min: priceRanges.min || null,
    price_max: priceRanges.max || null,
    is_free: false,
    age_restriction: raw.ageRestrictions?.legalAgeEnforced ? '21+' : null,
    
    raw_data: raw
  };
}

// Sync events for a state
async function syncState(stateCode) {
  console.log(`[Ticketmaster] Syncing ${stateCode}...`);
  let page = 0;
  let totalAdded = 0;
  let totalUpdated = 0;
  let hasMore = true;

  while (hasMore && page < 5) { // Limit to 5 pages (1000 events) per state
    const { events, totalPages } = await fetchEvents({ stateCode, page });
    
    for (const eventData of events) {
      try {
        await Event.upsert(eventData);
        totalAdded++;
      } catch (err) {
        console.error(`Failed to upsert event: ${err.message}`);
      }
    }

    page++;
    hasMore = page < totalPages;
    
    // Rate limiting - Ticketmaster allows 5 req/sec
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`[Ticketmaster] ${stateCode}: ${totalAdded} events synced`);
  return { added: totalAdded, updated: totalUpdated };
}

// Sync all US states
async function syncAll() {
  const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ];

  let totalEvents = 0;
  for (const state of states) {
    const { added } = await syncState(state);
    totalEvents += added;
    // Small delay between states
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[Ticketmaster] Total sync complete: ${totalEvents} events`);
  return totalEvents;
}

module.exports = { fetchEvents, syncState, syncAll };
