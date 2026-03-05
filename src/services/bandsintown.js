/**
 * Bandsintown Integration
 * Great for local concerts, small venue shows
 * Free API with app_id registration
 */

const axios = require('axios');
const { Event } = require('../models/Event');

// Free tier - just needs an app identifier
const APP_ID = 'eventgasm';
const API_BASE = 'https://rest.bandsintown.com';

// Florida metros for venue-based search
const FL_METROS = [
  'Miami, FL',
  'Orlando, FL',
  'Tampa, FL',
  'Jacksonville, FL',
  'Fort Lauderdale, FL',
  'West Palm Beach, FL',
  'St. Petersburg, FL',
  'Gainesville, FL',
  'Tallahassee, FL',
  'Pensacola, FL',
];

async function fetchArtistEvents(artistName) {
  try {
    const encodedArtist = encodeURIComponent(artistName);
    const response = await axios.get(
      `${API_BASE}/artists/${encodedArtist}/events`,
      {
        params: { app_id: APP_ID },
        timeout: 10000,
      }
    );

    if (!Array.isArray(response.data)) {
      return [];
    }

    return response.data
      .filter(e => {
        // Only Florida events
        const venue = e.venue;
        return venue?.region === 'FL' || 
               venue?.country === 'United States' && 
               FL_METROS.some(m => m.includes(venue?.city));
      })
      .map(e => ({
        externalId: `bandsintown-${e.id}`,
        source: 'bandsintown',
        title: `${e.lineup?.join(', ') || artistName}`,
        description: e.description || `Live music at ${e.venue?.name}`,
        category: 'Music',
        subcategory: 'Concert',
        venueName: e.venue?.name,
        venueAddress: e.venue?.street_address,
        city: e.venue?.city,
        state: e.venue?.region || 'FL',
        zip: e.venue?.postal_code,
        country: 'US',
        lat: parseFloat(e.venue?.latitude),
        lng: parseFloat(e.venue?.longitude),
        startTime: new Date(e.datetime),
        endTime: null,
        timezone: 'America/New_York',
        imageUrl: e.artist?.thumb_url || null,
        ticketUrl: e.offers?.[0]?.url || e.url,
        priceMin: null,
        priceMax: null,
        isFree: e.offers?.length === 0,
      }));
  } catch (error) {
    if (error.response?.status !== 404) {
      console.error(`[Bandsintown] Error fetching ${artistName}:`, error.message);
    }
    return [];
  }
}

// Search events by location (using their location endpoint)
async function fetchLocationEvents(location) {
  try {
    // Bandsintown doesn't have a direct location search,
    // but we can use their recommendations endpoint
    const response = await axios.get(
      `${API_BASE}/events/recommended`,
      {
        params: {
          app_id: APP_ID,
          location,
        },
        timeout: 10000,
      }
    );

    if (!Array.isArray(response.data)) {
      return [];
    }

    return response.data.map(e => ({
      externalId: `bandsintown-${e.id}`,
      source: 'bandsintown',
      title: e.lineup?.join(', ') || 'Live Music',
      description: `Live music at ${e.venue?.name}`,
      category: 'Music',
      subcategory: 'Concert',
      venueName: e.venue?.name,
      venueAddress: e.venue?.street_address,
      city: e.venue?.city,
      state: e.venue?.region || 'FL',
      zip: e.venue?.postal_code,
      country: 'US',
      lat: parseFloat(e.venue?.latitude),
      lng: parseFloat(e.venue?.longitude),
      startTime: new Date(e.datetime),
      endTime: null,
      timezone: 'America/New_York',
      imageUrl: null,
      ticketUrl: e.offers?.[0]?.url || e.url,
      priceMin: null,
      priceMax: null,
      isFree: e.offers?.length === 0,
    }));
  } catch (error) {
    console.error(`[Bandsintown] Error fetching location ${location}:`, error.message);
    return [];
  }
}

async function syncLocation(location) {
  console.log(`[Bandsintown] Syncing ${location}...`);
  
  const events = await fetchLocationEvents(location);
  let added = 0;

  for (const eventData of events) {
    try {
      await Event.upsert(eventData);
      added++;
    } catch (err) {
      // Skip duplicates
    }
  }

  console.log(`[Bandsintown] Added ${added} events from ${location}`);
  return added;
}

async function syncAll() {
  let total = 0;
  
  for (const metro of FL_METROS) {
    const added = await syncLocation(metro);
    total += added;
    await new Promise(r => setTimeout(r, 500));
  }
  
  return total;
}

module.exports = {
  fetchArtistEvents,
  fetchLocationEvents,
  syncLocation,
  syncAll,
};
