const axios = require('axios');
const Event = require('../models/Event');

const API_KEY = process.env.EVENTBRITE_API_KEY;
const BASE_URL = 'https://www.eventbriteapi.com/v3';

// Category mapping from Eventbrite category IDs to our categories
const CATEGORY_MAP = {
  '103': 'Music',
  '101': 'Education',
  '110': 'Food & Drink',
  '113': 'Community',
  '105': 'Arts & Theatre',
  '104': 'Film',
  '108': 'Sports',
  '109': 'Fitness',
  '111': 'Nightlife',
  '115': 'Family & Kids',
  '102': 'Education',
  '106': 'Festivals',
  '107': 'Comedy'
};

async function fetchEvents({ location, page = 1, pageSize = 50 }) {
  if (!API_KEY) {
    console.log('Eventbrite API key not configured');
    return { events: [], hasMore: false };
  }

  try {
    const response = await axios.get(`${BASE_URL}/events/search/`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      params: {
        'location.address': location,
        'location.within': '50mi',
        'start_date.range_start': new Date().toISOString(),
        'expand': 'venue,category,format',
        'page': page,
        'page_size': pageSize
      }
    });

    const data = response.data;
    const events = (data.events || []).map(parseEvent);
    const hasMore = data.pagination?.has_more_items || false;

    return { events, hasMore };
  } catch (error) {
    console.error('Eventbrite API error:', error.response?.data || error.message);
    return { events: [], hasMore: false };
  }
}

function parseEvent(raw) {
  const venue = raw.venue || {};
  const category = raw.category || {};
  
  // Parse price from ticket info if available
  let priceMin = null;
  let priceMax = null;
  let isFree = raw.is_free || false;

  if (raw.ticket_availability?.minimum_ticket_price) {
    priceMin = parseFloat(raw.ticket_availability.minimum_ticket_price.major_value);
  }
  if (raw.ticket_availability?.maximum_ticket_price) {
    priceMax = parseFloat(raw.ticket_availability.maximum_ticket_price.major_value);
  }

  return {
    source: 'eventbrite',
    source_id: raw.id,
    title: raw.name?.text || raw.name?.html || 'Untitled Event',
    description: raw.description?.text || raw.summary || null,
    category: CATEGORY_MAP[category.id] || 'Other',
    subcategory: category.name || null,
    
    venue_name: venue.name,
    address: venue.address?.localized_address_display || venue.address?.address_1,
    city: venue.address?.city,
    state: venue.address?.region,
    zip: venue.address?.postal_code,
    country: venue.address?.country || 'US',
    latitude: venue.latitude ? parseFloat(venue.latitude) : null,
    longitude: venue.longitude ? parseFloat(venue.longitude) : null,
    
    start_time: raw.start?.utc || raw.start?.local,
    end_time: raw.end?.utc || raw.end?.local,
    timezone: raw.start?.timezone,
    is_all_day: false,
    
    image_url: raw.logo?.original?.url || raw.logo?.url || null,
    ticket_url: raw.url,
    price_min: priceMin,
    price_max: priceMax,
    is_free: isFree,
    age_restriction: raw.age_restriction || null,
    
    raw_data: raw
  };
}

// Sync events for a city
async function syncCity(city, state) {
  const location = `${city}, ${state}`;
  console.log(`[Eventbrite] Syncing ${location}...`);
  
  let page = 1;
  let totalAdded = 0;
  let hasMore = true;

  while (hasMore && page <= 10) { // Limit to 10 pages
    const { events, hasMore: more } = await fetchEvents({ location, page });
    
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
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[Eventbrite] ${location}: ${totalAdded} events synced`);
  return totalAdded;
}

// Sync major US cities
async function syncMajorCities() {
  const cities = [
    { city: 'New York', state: 'NY' },
    { city: 'Los Angeles', state: 'CA' },
    { city: 'Chicago', state: 'IL' },
    { city: 'Houston', state: 'TX' },
    { city: 'Phoenix', state: 'AZ' },
    { city: 'Philadelphia', state: 'PA' },
    { city: 'San Antonio', state: 'TX' },
    { city: 'San Diego', state: 'CA' },
    { city: 'Dallas', state: 'TX' },
    { city: 'San Jose', state: 'CA' },
    { city: 'Austin', state: 'TX' },
    { city: 'Jacksonville', state: 'FL' },
    { city: 'San Francisco', state: 'CA' },
    { city: 'Indianapolis', state: 'IN' },
    { city: 'Columbus', state: 'OH' },
    { city: 'Fort Worth', state: 'TX' },
    { city: 'Charlotte', state: 'NC' },
    { city: 'Seattle', state: 'WA' },
    { city: 'Denver', state: 'CO' },
    { city: 'Washington', state: 'DC' },
    { city: 'Boston', state: 'MA' },
    { city: 'Nashville', state: 'TN' },
    { city: 'Detroit', state: 'MI' },
    { city: 'Portland', state: 'OR' },
    { city: 'Las Vegas', state: 'NV' },
    { city: 'Miami', state: 'FL' },
    { city: 'Atlanta', state: 'GA' },
    { city: 'Minneapolis', state: 'MN' },
    { city: 'New Orleans', state: 'LA' },
    { city: 'Cleveland', state: 'OH' }
  ];

  let totalEvents = 0;
  for (const { city, state } of cities) {
    const added = await syncCity(city, state);
    totalEvents += added;
    await new Promise(r => setTimeout(r, 2000)); // Delay between cities
  }

  console.log(`[Eventbrite] Total sync complete: ${totalEvents} events`);
  return totalEvents;
}

module.exports = { fetchEvents, syncCity, syncMajorCities };
