/**
 * MASS SYNC - Aggressive overnight scraping to hit 100K events
 * Expands all sources to maximum coverage
 */

const axios = require('axios');
const Event = require('../models/Event');
const { sleep } = require('../utils/resilientScraper');

// ============================================
// ALL MAJOR US METROS (Top 100 by population)
// ============================================
const US_METROS = [
  // Florida (home base)
  { city: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
  { city: 'Orlando', state: 'FL', lat: 28.5383, lng: -81.3792 },
  { city: 'Tampa', state: 'FL', lat: 27.9506, lng: -82.4572 },
  { city: 'Jacksonville', state: 'FL', lat: 30.3322, lng: -81.6557 },
  { city: 'Fort Lauderdale', state: 'FL', lat: 26.1224, lng: -80.1373 },
  
  // Texas
  { city: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  { city: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
  { city: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
  { city: 'Fort Worth', state: 'TX', lat: 32.7555, lng: -97.3308 },
  { city: 'El Paso', state: 'TX', lat: 31.7619, lng: -106.4850 },
  
  // California
  { city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { city: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
  { city: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
  { city: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.8863 },
  { city: 'Sacramento', state: 'CA', lat: 38.5816, lng: -121.4944 },
  { city: 'Oakland', state: 'CA', lat: 37.8044, lng: -122.2712 },
  { city: 'Fresno', state: 'CA', lat: 36.7378, lng: -119.7871 },
  { city: 'Long Beach', state: 'CA', lat: 33.7701, lng: -118.1937 },
  
  // New York
  { city: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
  { city: 'Buffalo', state: 'NY', lat: 42.8864, lng: -78.8784 },
  { city: 'Rochester', state: 'NY', lat: 43.1566, lng: -77.6088 },
  
  // Illinois
  { city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  
  // Pennsylvania
  { city: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
  { city: 'Pittsburgh', state: 'PA', lat: 40.4406, lng: -79.9959 },
  
  // Arizona
  { city: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
  { city: 'Tucson', state: 'AZ', lat: 32.2226, lng: -110.9747 },
  
  // Ohio
  { city: 'Columbus', state: 'OH', lat: 39.9612, lng: -82.9988 },
  { city: 'Cleveland', state: 'OH', lat: 41.4993, lng: -81.6944 },
  { city: 'Cincinnati', state: 'OH', lat: 39.1031, lng: -84.5120 },
  
  // Georgia
  { city: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
  
  // North Carolina
  { city: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431 },
  { city: 'Raleigh', state: 'NC', lat: 35.7796, lng: -78.6382 },
  
  // Michigan
  { city: 'Detroit', state: 'MI', lat: 42.3314, lng: -83.0458 },
  { city: 'Grand Rapids', state: 'MI', lat: 42.9634, lng: -85.6681 },
  
  // Washington
  { city: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
  
  // Colorado
  { city: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
  
  // Massachusetts
  { city: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
  
  // Tennessee
  { city: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816 },
  { city: 'Memphis', state: 'TN', lat: 35.1495, lng: -90.0490 },
  
  // Maryland
  { city: 'Baltimore', state: 'MD', lat: 39.2904, lng: -76.6122 },
  
  // Oregon
  { city: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784 },
  
  // Nevada
  { city: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398 },
  
  // Missouri
  { city: 'Kansas City', state: 'MO', lat: 39.0997, lng: -94.5786 },
  { city: 'St Louis', state: 'MO', lat: 38.6270, lng: -90.1994 },
  
  // Indiana
  { city: 'Indianapolis', state: 'IN', lat: 39.7684, lng: -86.1581 },
  
  // Minnesota
  { city: 'Minneapolis', state: 'MN', lat: 44.9778, lng: -93.2650 },
  
  // Louisiana
  { city: 'New Orleans', state: 'LA', lat: 29.9511, lng: -90.0715 },
  
  // Wisconsin
  { city: 'Milwaukee', state: 'WI', lat: 43.0389, lng: -87.9065 },
  
  // Oklahoma
  { city: 'Oklahoma City', state: 'OK', lat: 35.4676, lng: -97.5164 },
  
  // Kentucky
  { city: 'Louisville', state: 'KY', lat: 38.2527, lng: -85.7585 },
  
  // South Carolina
  { city: 'Charleston', state: 'SC', lat: 32.7765, lng: -79.9311 },
  
  // Alabama
  { city: 'Birmingham', state: 'AL', lat: 33.5207, lng: -86.8025 },
  
  // Utah
  { city: 'Salt Lake City', state: 'UT', lat: 40.7608, lng: -111.8910 },
  
  // Hawaii
  { city: 'Honolulu', state: 'HI', lat: 21.3069, lng: -157.8583 },
  
  // New Mexico
  { city: 'Albuquerque', state: 'NM', lat: 35.0844, lng: -106.6504 },
];

// ============================================
// ALLEVENTS.IN MASS SYNC
// ============================================
const ALLEVENTS_API = 'https://allevents.in/api/index.php/events/web/search';

async function syncAllEventsForCity(city, lat, lng, state) {
  let totalAdded = 0;
  
  try {
    for (let page = 1; page <= 5; page++) {
      const response = await axios.get(ALLEVENTS_API, {
        params: {
          city: city.toLowerCase().replace(/\s+/g, '-'),
          lat,
          lng,
          miles: 50,
          page,
          category: 'all',
        },
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
      });

      if (!response.data?.data || response.data.data.length === 0) break;

      for (const e of response.data.data) {
        try {
          await Event.upsert({
            source: 'allevents',
            source_id: `ae_${e.event_id}`,
            title: e.eventname,
            description: e.description?.substring(0, 2000),
            category: mapCategory(e.categories?.[0]),
            venue_name: e.venue?.name || e.location,
            city: city,
            state: state,
            country: 'US',
            latitude: e.venue?.latitude,
            longitude: e.venue?.longitude,
            start_time: e.start_time ? new Date(e.start_time * 1000).toISOString() : null,
            end_time: e.end_time ? new Date(e.end_time * 1000).toISOString() : null,
            image_url: e.banner_url || e.thumb_url,
            ticket_url: e.tickets?.tickets_url || e.event_url,
            is_free: e.tickets?.min_ticket_price === 0 || e.tickets?.has_tickets === false,
            price_min: e.tickets?.min_ticket_price || null,
          });
          totalAdded++;
        } catch (err) {}
      }

      await sleep(1000);
    }
  } catch (err) {
    console.log(`[MassSync] AllEvents error for ${city}: ${err.message}`);
  }

  return totalAdded;
}

function mapCategory(cat) {
  const map = {
    'music': 'Music',
    'sports': 'Sports', 
    'nightlife': 'Nightlife',
    'performing-arts': 'Arts & Theatre',
    'food': 'Food & Drink',
    'festivals': 'Festivals',
    'community': 'Community',
    'film': 'Film',
    'kids': 'Family & Kids',
    'health': 'Fitness',
    'business': 'Education',
    'science': 'Education',
  };
  return map[cat?.toLowerCase()] || 'Community';
}

// ============================================
// EVENTBRITE EXPANDED
// ============================================
async function syncEventbriteForCity(city, state) {
  const cheerio = require('cheerio');
  const { resilientFetch } = require('../utils/resilientScraper');
  
  let totalAdded = 0;
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  
  const categories = ['music', 'food-and-drink', 'community', 'arts', 'sports', 'nightlife'];
  
  for (const cat of categories) {
    try {
      const url = `https://www.eventbrite.com/d/${stateSlug}--${citySlug}/${cat}/`;
      const response = await resilientFetch(url);
      
      if (!response?.data) continue;
      
      const $ = cheerio.load(response.data);
      
      $('[data-testid="event-card"], .discover-search-desktop-card, .eds-event-card').each((i, el) => {
        try {
          const title = $(el).find('h2, h3, [data-testid="event-card-title"]').first().text().trim();
          const link = $(el).find('a').first().attr('href');
          
          if (title && title.length > 5) {
            Event.upsert({
              source: 'eventbrite_scrape',
              source_id: `eb_${Buffer.from(title + city).toString('base64').substring(0, 24)}`,
              title,
              category: mapCategory(cat),
              city,
              state,
              country: 'US',
              ticket_url: link?.startsWith('http') ? link : `https://www.eventbrite.com${link}`,
            }).catch(() => {});
            totalAdded++;
          }
        } catch {}
      });
      
      await sleep(2000);
    } catch (err) {}
  }
  
  return totalAdded;
}

// ============================================
// BANDSINTOWN EXPANDED  
// ============================================
async function syncBandsintownForCity(city, state, lat, lng) {
  let totalAdded = 0;
  
  try {
    // Search for concerts near location
    const response = await axios.get('https://rest.bandsintown.com/v4/events', {
      params: {
        app_id: 'eventgasm',
        location: `${lat},${lng}`,
        radius: 50,
      },
      timeout: 15000,
    });

    if (response.data && Array.isArray(response.data)) {
      for (const e of response.data) {
        try {
          await Event.upsert({
            source: 'bandsintown',
            source_id: `bit_${e.id}`,
            title: `${e.lineup?.join(', ') || 'Concert'} at ${e.venue?.name || 'TBA'}`,
            category: 'Music',
            subcategory: 'Concert',
            venue_name: e.venue?.name,
            city: e.venue?.city || city,
            state: e.venue?.region || state,
            country: e.venue?.country || 'US',
            latitude: e.venue?.latitude,
            longitude: e.venue?.longitude,
            start_time: e.datetime,
            ticket_url: e.url,
            is_free: false,
          });
          totalAdded++;
        } catch {}
      }
    }
  } catch (err) {
    console.log(`[MassSync] Bandsintown error for ${city}: ${err.message}`);
  }
  
  return totalAdded;
}

// ============================================
// MAIN: Run mass sync across all cities
// ============================================
async function runMassSync() {
  console.log('[MassSync] 🚀 STARTING MASS SYNC - Target: 100K events');
  console.log(`[MassSync] Processing ${US_METROS.length} cities...`);
  
  const stats = {
    allevents: 0,
    eventbrite: 0,
    bandsintown: 0,
    cities: 0,
    errors: 0,
  };

  for (const metro of US_METROS) {
    console.log(`[MassSync] Processing ${metro.city}, ${metro.state}...`);
    
    try {
      // AllEvents
      const ae = await syncAllEventsForCity(metro.city, metro.lat, metro.lng, metro.state);
      stats.allevents += ae;
      
      // Eventbrite
      const eb = await syncEventbriteForCity(metro.city, metro.state);
      stats.eventbrite += eb;
      
      // Bandsintown
      const bit = await syncBandsintownForCity(metro.city, metro.state, metro.lat, metro.lng);
      stats.bandsintown += bit;
      
      stats.cities++;
      console.log(`[MassSync] ${metro.city}: +${ae} AllEvents, +${eb} Eventbrite, +${bit} Bandsintown`);
      
      // Pace ourselves
      await sleep(1500);
      
    } catch (err) {
      stats.errors++;
      console.log(`[MassSync] Error processing ${metro.city}: ${err.message}`);
    }
  }

  const total = stats.allevents + stats.eventbrite + stats.bandsintown;
  console.log(`[MassSync] ✅ COMPLETE!`);
  console.log(`  Cities processed: ${stats.cities}`);
  console.log(`  AllEvents: +${stats.allevents}`);
  console.log(`  Eventbrite: +${stats.eventbrite}`);
  console.log(`  Bandsintown: +${stats.bandsintown}`);
  console.log(`  Total new events: +${total}`);
  
  return stats;
}

module.exports = { runMassSync, US_METROS };
