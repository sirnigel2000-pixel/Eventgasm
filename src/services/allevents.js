/**
 * AllEvents.in Integration
 * Great for local community events, free events, festivals
 */

const axios = require('axios');
const { Event } = require('../models/Event');

const API_BASE = 'https://allevents.in/api/index.php/events/web/search';

// City coordinates for Florida metros
const FL_CITIES = [
  { city: 'Miami', lat: 25.7617, lng: -80.1918 },
  { city: 'Orlando', lat: 28.5383, lng: -81.3792 },
  { city: 'Tampa', lat: 27.9506, lng: -82.4572 },
  { city: 'Jacksonville', lat: 30.3322, lng: -81.6557 },
  { city: 'Fort Lauderdale', lat: 26.1224, lng: -80.1373 },
  { city: 'West Palm Beach', lat: 26.7153, lng: -80.0534 },
  { city: 'St Petersburg', lat: 27.7676, lng: -82.6403 },
  { city: 'Gainesville', lat: 29.6516, lng: -82.3248 },
  { city: 'Tallahassee', lat: 30.4383, lng: -84.2807 },
  { city: 'Pensacola', lat: 30.4213, lng: -87.2169 },
];

async function fetchEvents({ city, lat, lng, page = 1 }) {
  try {
    const response = await axios.get(API_BASE, {
      params: {
        city: city.toLowerCase().replace(' ', '-'),
        lat,
        lng,
        miles: 25,
        page,
        category: 'all',
      },
      timeout: 15000,
    });

    if (!response.data?.data) {
      return { events: [], hasMore: false };
    }

    const events = response.data.data.map(e => ({
      externalId: `allevents-${e.event_id}`,
      source: 'allevents',
      title: e.eventname,
      description: e.description || null,
      category: mapCategory(e.categories?.[0]),
      subcategory: e.categories?.[1] || null,
      venueName: e.venue?.name || e.location,
      venueAddress: e.venue?.street || null,
      city: e.venue?.city || city,
      state: 'FL',
      zip: e.venue?.zip || null,
      country: 'US',
      lat: parseFloat(e.venue?.latitude) || lat,
      lng: parseFloat(e.venue?.longitude) || lng,
      startTime: new Date(e.start_time_utc || e.start_time),
      endTime: e.end_time ? new Date(e.end_time) : null,
      timezone: 'America/New_York',
      imageUrl: e.banner_url || e.thumb_url || null,
      ticketUrl: e.tickets?.ticket_url || e.event_url,
      priceMin: e.tickets?.min_ticket_price || null,
      priceMax: e.tickets?.max_ticket_price || null,
      isFree: e.tickets?.has_tickets === false || e.tickets?.min_ticket_price === 0,
    }));

    return {
      events,
      hasMore: response.data.data.length >= 20,
    };
  } catch (error) {
    console.error(`[AllEvents] Error fetching ${city}:`, error.message);
    return { events: [], hasMore: false };
  }
}

function mapCategory(cat) {
  const mapping = {
    'music': 'Music',
    'concerts': 'Music',
    'festivals': 'Festival',
    'food-drink': 'Food & Drink',
    'nightlife': 'Nightlife',
    'arts': 'Arts & Theatre',
    'comedy': 'Comedy',
    'sports': 'Sports',
    'fitness': 'Sports',
    'business': 'Business',
    'community': 'Community',
    'family': 'Family',
    'education': 'Education',
    'dating': 'Singles',
    'networking': 'Networking',
  };
  return mapping[cat?.toLowerCase()] || 'Other';
}

async function syncCity(cityName) {
  const cityConfig = FL_CITIES.find(c => 
    c.city.toLowerCase() === cityName.toLowerCase()
  );
  
  if (!cityConfig) {
    console.log(`[AllEvents] Unknown city: ${cityName}`);
    return 0;
  }

  console.log(`[AllEvents] Syncing ${cityName}...`);
  
  let totalAdded = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 5) {
    const { events, hasMore: more } = await fetchEvents({
      city: cityConfig.city,
      lat: cityConfig.lat,
      lng: cityConfig.lng,
      page,
    });

    for (const eventData of events) {
      try {
        await Event.upsert(eventData);
        totalAdded++;
      } catch (err) {
        // Skip duplicates
      }
    }

    hasMore = more;
    page++;
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[AllEvents] Added ${totalAdded} events from ${cityName}`);
  return totalAdded;
}

async function syncAll() {
  let total = 0;
  
  for (const city of FL_CITIES) {
    const added = await syncCity(city.city);
    total += added;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  return total;
}

module.exports = {
  fetchEvents,
  syncCity,
  syncAll,
  FL_CITIES,
};
