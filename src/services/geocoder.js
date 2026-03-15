/**
 * Geocoding Service
 * Uses OpenStreetMap Nominatim (free, 1 req/sec rate limit)
 * Falls back to city/state center if address fails
 */

const axios = require('axios');
const { pool } = require('../db');

// Rate limiting: 1 request per second for Nominatim
const RATE_LIMIT_MS = 1100;
let lastRequestTime = 0;

// City center coordinates fallback (major US cities)
const CITY_CENTERS = {
  'new york,ny': { lat: 40.7128, lng: -74.0060 },
  'los angeles,ca': { lat: 34.0522, lng: -118.2437 },
  'chicago,il': { lat: 41.8781, lng: -87.6298 },
  'houston,tx': { lat: 29.7604, lng: -95.3698 },
  'phoenix,az': { lat: 33.4484, lng: -112.0740 },
  'philadelphia,pa': { lat: 39.9526, lng: -75.1652 },
  'san antonio,tx': { lat: 29.4241, lng: -98.4936 },
  'san diego,ca': { lat: 32.7157, lng: -117.1611 },
  'dallas,tx': { lat: 32.7767, lng: -96.7970 },
  'austin,tx': { lat: 30.2672, lng: -97.7431 },
  'san francisco,ca': { lat: 37.7749, lng: -122.4194 },
  'seattle,wa': { lat: 47.6062, lng: -122.3321 },
  'denver,co': { lat: 39.7392, lng: -104.9903 },
  'boston,ma': { lat: 42.3601, lng: -71.0589 },
  'nashville,tn': { lat: 36.1627, lng: -86.7816 },
  'atlanta,ga': { lat: 33.7490, lng: -84.3880 },
  'miami,fl': { lat: 25.7617, lng: -80.1918 },
  'orlando,fl': { lat: 28.5383, lng: -81.3792 },
  'tampa,fl': { lat: 27.9506, lng: -82.4572 },
  'las vegas,nv': { lat: 36.1699, lng: -115.1398 },
  'portland,or': { lat: 45.5152, lng: -122.6784 },
  'detroit,mi': { lat: 42.3314, lng: -83.0458 },
  'minneapolis,mn': { lat: 44.9778, lng: -93.2650 },
  'charlotte,nc': { lat: 35.2271, lng: -80.8431 },
  'san jose,ca': { lat: 37.3382, lng: -121.8863 },
  'indianapolis,in': { lat: 39.7684, lng: -86.1581 },
  'columbus,oh': { lat: 39.9612, lng: -82.9988 },
  'fort worth,tx': { lat: 32.7555, lng: -97.3308 },
  'baltimore,md': { lat: 39.2904, lng: -76.6122 },
  'milwaukee,wi': { lat: 43.0389, lng: -87.9065 },
  'albuquerque,nm': { lat: 35.0844, lng: -106.6504 },
  'tucson,az': { lat: 32.2226, lng: -110.9747 },
  'sacramento,ca': { lat: 38.5816, lng: -121.4944 },
  'kansas city,mo': { lat: 39.0997, lng: -94.5786 },
  'mesa,az': { lat: 33.4152, lng: -111.8315 },
  'virginia beach,va': { lat: 36.8529, lng: -75.9780 },
  'raleigh,nc': { lat: 35.7796, lng: -78.6382 },
  'omaha,ne': { lat: 41.2565, lng: -95.9345 },
  'oakland,ca': { lat: 37.8044, lng: -122.2712 },
  'new orleans,la': { lat: 29.9511, lng: -90.0715 },
  'cleveland,oh': { lat: 41.4993, lng: -81.6944 },
  'pittsburgh,pa': { lat: 40.4406, lng: -79.9959 },
  'cincinnati,oh': { lat: 39.1031, lng: -84.5120 },
  'st. louis,mo': { lat: 38.6270, lng: -90.1994 },
  'saint louis,mo': { lat: 38.6270, lng: -90.1994 },
};

// State centers fallback
const STATE_CENTERS = {
  'AL': { lat: 32.806671, lng: -86.791130 },
  'AK': { lat: 61.370716, lng: -152.404419 },
  'AZ': { lat: 33.729759, lng: -111.431221 },
  'AR': { lat: 34.969704, lng: -92.373123 },
  'CA': { lat: 36.116203, lng: -119.681564 },
  'CO': { lat: 39.059811, lng: -105.311104 },
  'CT': { lat: 41.597782, lng: -72.755371 },
  'DE': { lat: 39.318523, lng: -75.507141 },
  'FL': { lat: 27.766279, lng: -81.686783 },
  'GA': { lat: 33.040619, lng: -83.643074 },
  'HI': { lat: 21.094318, lng: -157.498337 },
  'ID': { lat: 44.240459, lng: -114.478828 },
  'IL': { lat: 40.349457, lng: -88.986137 },
  'IN': { lat: 39.849426, lng: -86.258278 },
  'IA': { lat: 42.011539, lng: -93.210526 },
  'KS': { lat: 38.526600, lng: -96.726486 },
  'KY': { lat: 37.668140, lng: -84.670067 },
  'LA': { lat: 31.169546, lng: -91.867805 },
  'ME': { lat: 44.693947, lng: -69.381927 },
  'MD': { lat: 39.063946, lng: -76.802101 },
  'MA': { lat: 42.230171, lng: -71.530106 },
  'MI': { lat: 43.326618, lng: -84.536095 },
  'MN': { lat: 45.694454, lng: -93.900192 },
  'MS': { lat: 32.741646, lng: -89.678696 },
  'MO': { lat: 38.456085, lng: -92.288368 },
  'MT': { lat: 46.921925, lng: -110.454353 },
  'NE': { lat: 41.125370, lng: -98.268082 },
  'NV': { lat: 38.313515, lng: -117.055374 },
  'NH': { lat: 43.452492, lng: -71.563896 },
  'NJ': { lat: 40.298904, lng: -74.521011 },
  'NM': { lat: 34.840515, lng: -106.248482 },
  'NY': { lat: 42.165726, lng: -74.948051 },
  'NC': { lat: 35.630066, lng: -79.806419 },
  'ND': { lat: 47.528912, lng: -99.784012 },
  'OH': { lat: 40.388783, lng: -82.764915 },
  'OK': { lat: 35.565342, lng: -96.928917 },
  'OR': { lat: 44.572021, lng: -122.070938 },
  'PA': { lat: 40.590752, lng: -77.209755 },
  'RI': { lat: 41.680893, lng: -71.511780 },
  'SC': { lat: 33.856892, lng: -80.945007 },
  'SD': { lat: 44.299782, lng: -99.438828 },
  'TN': { lat: 35.747845, lng: -86.692345 },
  'TX': { lat: 31.054487, lng: -97.563461 },
  'UT': { lat: 40.150032, lng: -111.862434 },
  'VT': { lat: 44.045876, lng: -72.710686 },
  'VA': { lat: 37.769337, lng: -78.169968 },
  'WA': { lat: 47.400902, lng: -121.490494 },
  'WV': { lat: 38.491226, lng: -80.954456 },
  'WI': { lat: 44.268543, lng: -89.616508 },
  'WY': { lat: 42.755966, lng: -107.302490 },
  'DC': { lat: 38.9072, lng: -77.0369 },
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimitedRequest() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
}

/**
 * Geocode an address using Nominatim
 */
async function geocodeAddress(address, city, state, zip, country = 'US') {
  try {
    // Build search query
    const parts = [address, city, state, zip, country].filter(Boolean);
    const query = parts.join(', ');
    
    if (!query || query.length < 5) {
      return getCityFallback(city, state);
    }

    await rateLimitedRequest();

    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        limit: 1,
        countrycodes: country.toLowerCase(),
      },
      headers: {
        'User-Agent': 'Eventgasm/1.0 (event aggregation app)',
      },
      timeout: 10000,
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        source: 'nominatim',
        confidence: 'high',
      };
    }

    // Try city-only if full address fails
    if (city) {
      await rateLimitedRequest();
      const cityResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: `${city}, ${state || ''}, ${country}`,
          format: 'json',
          limit: 1,
        },
        headers: {
          'User-Agent': 'Eventgasm/1.0 (event aggregation app)',
        },
        timeout: 10000,
      });

      if (cityResponse.data && cityResponse.data.length > 0) {
        const result = cityResponse.data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          source: 'nominatim_city',
          confidence: 'medium',
        };
      }
    }

    // Fallback to hardcoded centers
    return getCityFallback(city, state);

  } catch (error) {
    console.error('[Geocoder] Error:', error.message);
    return getCityFallback(city, state);
  }
}

/**
 * Get fallback coordinates from city/state centers
 */
function getCityFallback(city, state) {
  if (city && state) {
    const key = `${city.toLowerCase()},${state.toLowerCase()}`;
    if (CITY_CENTERS[key]) {
      return { ...CITY_CENTERS[key], source: 'city_center', confidence: 'low' };
    }
  }
  
  if (state) {
    const stateUpper = state.toUpperCase();
    if (STATE_CENTERS[stateUpper]) {
      return { ...STATE_CENTERS[stateUpper], source: 'state_center', confidence: 'very_low' };
    }
  }
  
  return null;
}

/**
 * Batch geocode events without coordinates
 */
async function geocodeEvents(limit = 100) {
  console.log(`[Geocoder] Starting batch geocode for up to ${limit} events...`);
  
  // Get events without coordinates
  const result = await pool.query(`
    SELECT id, address, venue_name, city, state, zip, country
    FROM events
    WHERE latitude IS NULL 
      AND (city IS NOT NULL OR address IS NOT NULL)
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  const events = result.rows;
  console.log(`[Geocoder] Found ${events.length} events to geocode`);

  let geocoded = 0;
  let failed = 0;

  for (const event of events) {
    try {
      // Try venue name + city first, then address
      const searchAddress = event.address || event.venue_name;
      const coords = await geocodeAddress(
        searchAddress,
        event.city,
        event.state,
        event.zip,
        event.country || 'US'
      );

      if (coords) {
        await pool.query(`
          UPDATE events 
          SET latitude = $1, longitude = $2, geocode_source = $3
          WHERE id = $4
        `, [coords.lat, coords.lng, coords.source, event.id]);
        geocoded++;
        
        if (geocoded % 50 === 0) {
          console.log(`[Geocoder] Progress: ${geocoded}/${events.length} geocoded`);
        }
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`[Geocoder] Failed to geocode event ${event.id}:`, error.message);
      failed++;
    }
  }

  console.log(`[Geocoder] Complete: ${geocoded} geocoded, ${failed} failed`);
  return { geocoded, failed, total: events.length };
}

/**
 * Quick geocode using only fallbacks (for bulk processing)
 */
async function quickGeocodeEvents(limit = 1000) {
  console.log(`[Geocoder] Quick geocode (fallbacks only) for up to ${limit} events...`);
  
  const result = await pool.query(`
    SELECT id, city, state
    FROM events
    WHERE latitude IS NULL 
      AND city IS NOT NULL
    LIMIT $1
  `, [limit]);

  let updated = 0;
  
  for (const event of result.rows) {
    const coords = getCityFallback(event.city, event.state);
    if (coords) {
      await pool.query(`
        UPDATE events 
        SET latitude = $1, longitude = $2, geocode_source = $3
        WHERE id = $4
      `, [coords.lat, coords.lng, coords.source, event.id]);
      updated++;
    }
  }

  console.log(`[Geocoder] Quick geocode complete: ${updated} events updated`);
  return { updated, total: result.rows.length };
}

module.exports = {
  geocodeAddress,
  geocodeEvents,
  quickGeocodeEvents,
  getCityFallback,
};
