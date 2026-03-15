/**
 * Event Enricher
 * Fills in missing data for existing events by fetching their source pages
 */
const axios = require('axios');
const { pool } = require('../db');

// Find events missing critical data
async function findIncompleteEvents(limit = 100) {
  const result = await pool.query(`
    SELECT id, source, source_id, ticket_url, title
    FROM events 
    WHERE ticket_url IS NOT NULL
      AND (
        city IS NULL OR city = '' OR city = 'Various' OR city = 'Unknown'
        OR latitude IS NULL
        OR start_time IS NULL
        OR category IS NULL OR category = 'Community'
      )
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}

// Extract JSON-LD from any event page
async function fetchEventData(url) {
  try {
    const response = await axios.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
    });
    
    const html = response.data;
    
    // Try JSON-LD first (most sites have this)
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const data = JSON.parse(jsonStr);
          const event = Array.isArray(data) 
            ? data.find(d => d['@type'] === 'Event' || d['@type'] === 'MusicEvent')
            : (data['@type']?.includes('Event') ? data : null);
          
          if (event) {
            return {
              title: event.name,
              description: event.description?.substring(0, 500),
              start_time: event.startDate ? new Date(event.startDate) : null,
              end_time: event.endDate ? new Date(event.endDate) : null,
              venue_name: event.location?.name || event.location?.address?.name,
              city: event.location?.address?.addressLocality,
              state: event.location?.address?.addressRegion,
              country: event.location?.address?.addressCountry || 'US',
              latitude: parseFloat(event.location?.geo?.latitude) || null,
              longitude: parseFloat(event.location?.geo?.longitude) || null,
              image_url: event.image,
              is_free: event.offers?.price === 0 || event.isAccessibleForFree,
            };
          }
        } catch (e) { /* continue */ }
      }
    }
    
    // Fallback: meta tags
    const getMetaContent = (property) => {
      const match = html.match(new RegExp(`<meta[^>]*(?:property|name)="${property}"[^>]*content="([^"]*)"`, 'i'));
      return match ? match[1] : null;
    };
    
    // Try microdata (schema.org)
    const microdataMatch = html.match(/itemtype="https?:\/\/schema\.org\/Event"[\s\S]*?<\/[^>]+>/i);
    if (microdataMatch) {
      const locationMatch = microdataMatch[0].match(/itemprop="location"[^>]*>([^<]*)/i);
      const dateMatch = microdataMatch[0].match(/itemprop="startDate"[^>]*content="([^"]+)"/i);
      if (locationMatch || dateMatch) {
        return {
          venue_name: locationMatch ? locationMatch[1].trim() : null,
          start_time: dateMatch ? new Date(dateMatch[1]) : null,
          title: getMetaContent('og:title'),
          description: getMetaContent('og:description'),
          image_url: getMetaContent('og:image'),
        };
      }
    }
    
    // Try common HTML patterns
    const patterns = {
      // Date patterns
      date: [
        /class="[^"]*date[^"]*"[^>]*>([^<]+)</i,
        /class="[^"]*event-date[^"]*"[^>]*>([^<]+)</i,
        /datetime="([^"]+)"/i,
      ],
      // Location patterns
      location: [
        /class="[^"]*venue[^"]*"[^>]*>([^<]+)</i,
        /class="[^"]*location[^"]*"[^>]*>([^<]+)</i,
        /class="[^"]*address[^"]*"[^>]*>([^<]+)</i,
      ],
      // City patterns
      city: [
        /class="[^"]*city[^"]*"[^>]*>([^<]+)</i,
        /,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\s/,
      ],
    };
    
    let extractedDate = null;
    let extractedVenue = null;
    let extractedCity = null;
    
    for (const pattern of patterns.date) {
      const match = html.match(pattern);
      if (match) {
        try {
          extractedDate = new Date(match[1]);
          if (!isNaN(extractedDate)) break;
        } catch (e) {}
      }
    }
    
    for (const pattern of patterns.location) {
      const match = html.match(pattern);
      if (match) {
        extractedVenue = match[1].trim();
        break;
      }
    }
    
    for (const pattern of patterns.city) {
      const match = html.match(pattern);
      if (match) {
        extractedCity = match[1].trim();
        break;
      }
    }
    
    return {
      title: getMetaContent('og:title'),
      description: getMetaContent('og:description'),
      image_url: getMetaContent('og:image'),
      start_time: extractedDate,
      venue_name: extractedVenue,
      city: extractedCity,
    };
    
  } catch (err) {
    return null;
  }
}

// Google Geocoding API - fast and accurate
async function geocodeWithGoogle(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !address) return null;
  
  try {
    const query = encodeURIComponent(address);
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`,
      { timeout: 5000 }
    );
    
    if (response.data.status === 'OK' && response.data.results[0]) {
      const result = response.data.results[0];
      const components = result.address_components;
      
      // Extract city, state, country from components
      const getComponent = (type) => {
        const comp = components.find(c => c.types.includes(type));
        return comp ? comp.long_name : null;
      };
      
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        city: getComponent('locality') || getComponent('sublocality'),
        state: getComponent('administrative_area_level_1'),
        country: getComponent('country'),
        formatted_address: result.formatted_address,
      };
    }
  } catch (e) {
    console.error('[Enricher] Google Geocode error:', e.message);
  }
  return null;
}

// Google Places API - find venue details from name
async function findVenueWithGoogle(venueName, city) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !venueName) return null;
  
  try {
    const query = encodeURIComponent(`${venueName} ${city || ''}`);
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`,
      { timeout: 5000 }
    );
    
    if (response.data.status === 'OK' && response.data.results[0]) {
      const place = response.data.results[0];
      return {
        venue_name: place.name,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        formatted_address: place.formatted_address,
      };
    }
  } catch (e) {
    console.error('[Enricher] Google Places error:', e.message);
  }
  return null;
}

// Fallback: OpenStreetMap (free, no API key needed)
async function geocodeCity(city, state, country = 'US') {
  if (!city) return null;
  try {
    const query = encodeURIComponent(`${city}, ${state || ''} ${country}`.trim());
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { 
        headers: { 'User-Agent': 'Eventgasm/1.0' },
        timeout: 5000 
      }
    );
    if (response.data && response.data[0]) {
      return {
        latitude: parseFloat(response.data[0].lat),
        longitude: parseFloat(response.data[0].lon),
      };
    }
  } catch (e) {}
  return null;
}

// Categorize based on text
function categorize(title, description) {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  
  if (/concert|music|band|dj|live music|tour/.test(text)) return 'Concert';
  if (/comedy|standup|improv/.test(text)) return 'Comedy';
  if (/food|drink|wine|beer|tasting|brunch/.test(text)) return 'Food & Drink';
  if (/art|gallery|museum|exhibit/.test(text)) return 'Arts';
  if (/sport|game|match|race|marathon/.test(text)) return 'Sports';
  if (/conference|summit|seminar|workshop/.test(text)) return 'Business';
  if (/family|kids|children/.test(text)) return 'Family';
  if (/party|club|nightlife/.test(text)) return 'Nightlife';
  if (/theater|theatre|play|musical/.test(text)) return 'Theater';
  if (/film|movie|screening/.test(text)) return 'Film';
  if (/festival/.test(text)) return 'Festival';
  
  return null; // Keep existing
}

// Update event with new data
async function updateEvent(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;
  
  const addField = (name, value) => {
    if (value !== null && value !== undefined && value !== '') {
      fields.push(`${name} = $${idx++}`);
      values.push(value);
    }
  };
  
  addField('city', data.city);
  addField('state', data.state);
  addField('country', data.country);
  addField('venue_name', data.venue_name);
  addField('latitude', data.latitude);
  addField('longitude', data.longitude);
  if (data.start_time && !isNaN(new Date(data.start_time).getTime())) addField('start_time', data.start_time);
  if (data.end_time && !isNaN(new Date(data.end_time).getTime())) addField('end_time', data.end_time);
  addField('description', data.description);
  addField('image_url', data.image_url);
  
  const category = categorize(data.title, data.description);
  if (category) addField('category', category);
  
  if (fields.length === 0) return false;
  
  values.push(id);
  await pool.query(
    `UPDATE events SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
    values
  );
  return true;
}

// Main enrichment function
async function enrichEvents(batchSize = 50) {
  console.log('[Enricher] ====== STARTING EVENT ENRICHMENT ======');
  
  let totalEnriched = 0;
  let totalFailed = 0;
  let processed = 0;
  
  while (true) {
    const events = await findIncompleteEvents(batchSize);
    if (events.length === 0) {
      console.log('[Enricher] No more incomplete events found');
      break;
    }
    
    for (const event of events) {
      if (!event.ticket_url) continue;
      
      let data = await fetchEventData(event.ticket_url);
      if (!data) data = {};
      
      // Strategy 1: If we have venue but no coords, try Google Places
      if (data.venue_name && !data.latitude) {
        const venue = await findVenueWithGoogle(data.venue_name, data.city);
        if (venue) {
          data.latitude = venue.latitude;
          data.longitude = venue.longitude;
          if (!data.city && venue.formatted_address) {
            // Extract city from address
            const parts = venue.formatted_address.split(',');
            if (parts.length >= 2) data.city = parts[parts.length - 3]?.trim();
          }
        }
      }
      
      // Strategy 2: If we have city but no coords, try Google Geocoding
      if (data.city && !data.latitude) {
        const geo = await geocodeWithGoogle(`${data.city}, ${data.state || ''} ${data.country || 'US'}`);
        if (geo) {
          data.latitude = geo.latitude;
          data.longitude = geo.longitude;
          if (!data.state) data.state = geo.state;
        }
      }
      
      // Strategy 3: Fallback to OpenStreetMap
      if (data.city && !data.latitude) {
        const coords = await geocodeCity(data.city, data.state, data.country);
        if (coords) {
          data.latitude = coords.latitude;
          data.longitude = coords.longitude;
        }
      }
      
      // If we got any useful data, update
      if (data.city || data.latitude || data.start_time || data.venue_name) {
        const updated = await updateEvent(event.id, data);
        if (updated) {
          totalEnriched++;
        }
      } else {
        totalFailed++;
      }
      
      processed++;
      if (processed % 50 === 0) {
        console.log(`[Enricher] Progress: ${processed} checked, ${totalEnriched} enriched`);
      }
      
      // Be nice to source servers
      await new Promise(r => setTimeout(r, 300));
    }
    
    // Log progress every 500
    if (processed % 500 === 0) {
      console.log(`[Enricher] Batch ${processed / 500} complete, continuing...`);
    }
  }
  
  console.log(`[Enricher] ====== COMPLETE: ${totalEnriched} events enriched ======`);
  return totalEnriched;
}

// Continuous enrichment - runs until all events are processed
let continuousRunning = false;
async function runContinuousEnrichment() {
  if (continuousRunning) {
    console.log('[Enricher] Continuous mode already running');
    return { status: 'already_running' };
  }
  
  continuousRunning = true;
  console.log('[Enricher] ====== STARTING CONTINUOUS MODE ======');
  
  let totalBatches = 0;
  let totalEnriched = 0;
  
  while (continuousRunning) {
    const stats = await getIncompleteStats();
    const remaining = parseInt(stats.missing_coords) + parseInt(stats.missing_city);
    
    if (remaining < 100) {
      console.log('[Enricher] Nearly complete! Remaining:', remaining);
      break;
    }
    
    console.log(`[Enricher] Starting batch ${totalBatches + 1}, ${remaining} events need work...`);
    
    try {
      const enriched = await enrichEvents(100);
      totalEnriched += enriched;
      totalBatches++;
      
      console.log(`[Enricher] Batch ${totalBatches} done: +${enriched} (total: ${totalEnriched})`);
      
      // Brief pause between batches
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (error) {
      console.error('[Enricher] Batch error:', error.message);
      await new Promise(r => setTimeout(r, 10000)); // Wait longer on error
    }
  }
  
  continuousRunning = false;
  console.log(`[Enricher] ====== CONTINUOUS COMPLETE: ${totalBatches} batches, ${totalEnriched} enriched ======`);
  return { batches: totalBatches, enriched: totalEnriched };
}

function stopContinuousEnrichment() {
  continuousRunning = false;
  console.log('[Enricher] Stopping continuous mode...');
}

// Get stats on incomplete events
async function getIncompleteStats() {
  const result = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE city IS NULL OR city IN ('', 'Various', 'Unknown')) as missing_city,
      COUNT(*) FILTER (WHERE latitude IS NULL) as missing_coords,
      COUNT(*) FILTER (WHERE start_time IS NULL) as missing_date,
      COUNT(*) FILTER (WHERE category IS NULL OR category = 'Community') as generic_category,
      COUNT(*) as total
    FROM events
  `);
  return result.rows[0];
}

module.exports = { 
  enrichEvents, 
  getIncompleteStats, 
  findIncompleteEvents,
  runContinuousEnrichment,
  stopContinuousEnrichment
};

// Self-scheduling enrichment using setInterval
let enrichInterval = null;

function startAutoEnrichment(intervalMs = 5000) {
  if (enrichInterval) {
    console.log('[Enricher] Auto-enrichment already running');
    return false;
  }
  
  console.log('[Enricher] Starting auto-enrichment, batch every', intervalMs, 'ms');
  
  enrichInterval = setInterval(async () => {
    try {
      const stats = await getIncompleteStats();
      const remaining = parseInt(stats.missing_coords);
      
      if (remaining < 100) {
        console.log('[Enricher] Auto-enrichment complete! Remaining:', remaining);
        stopAutoEnrichment();
        return;
      }
      
      // Run small batch (won't timeout)
      await enrichEvents(25);
      
    } catch (error) {
      console.error('[Enricher] Auto batch error:', error.message);
    }
  }, intervalMs);
  
  return true;
}

function stopAutoEnrichment() {
  if (enrichInterval) {
    clearInterval(enrichInterval);
    enrichInterval = null;
    console.log('[Enricher] Auto-enrichment stopped');
  }
}

function isAutoEnrichmentRunning() {
  return enrichInterval !== null;
}

// Auto-start on server boot if there's work to do
setTimeout(async () => {
  const stats = await getIncompleteStats();
  if (parseInt(stats.missing_coords) > 1000) {
    console.log('[Enricher] Auto-starting enrichment on boot...');
    startAutoEnrichment(10000); // Every 10 seconds
  }
}, 30000); // Wait 30s after server starts

module.exports.startAutoEnrichment = startAutoEnrichment;
module.exports.stopAutoEnrichment = stopAutoEnrichment;
module.exports.isAutoEnrichmentRunning = isAutoEnrichmentRunning;
