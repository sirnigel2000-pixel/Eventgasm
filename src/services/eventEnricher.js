/**
 * Event Enricher
 * Fills in missing data for existing events by fetching their source pages
 */
const axios = require('axios');
const { pool } = require('../db');

// Find events missing critical data
async function findIncompleteEvents(limit = 100) {
  const result = await pool.query(`
    SELECT id, source, source_id, external_url, title
    FROM events 
    WHERE external_url IS NOT NULL
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
    
    return {
      title: getMetaContent('og:title'),
      description: getMetaContent('og:description'),
      image_url: getMetaContent('og:image'),
    };
    
  } catch (err) {
    return null;
  }
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
  addField('start_time', data.start_time);
  addField('end_time', data.end_time);
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
      if (!event.external_url) continue;
      
      const data = await fetchEventData(event.external_url);
      if (data && (data.city || data.latitude || data.start_time)) {
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
    
    // Check if we should continue (limit to 500 per run to not timeout)
    if (processed >= 500) {
      console.log('[Enricher] Batch limit reached, stopping');
      break;
    }
  }
  
  console.log(`[Enricher] ====== COMPLETE: ${totalEnriched} events enriched ======`);
  return totalEnriched;
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

module.exports = { enrichEvents, getIncompleteStats, findIncompleteEvents };
