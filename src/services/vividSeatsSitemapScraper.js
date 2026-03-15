/**
 * Vivid Seats Sitemap Scraper - FULL DATA VERSION
 */
const axios = require('axios');
const Event = require('../models/Event');

const SITEMAP_URL = 'https://www.vividseats.com/sitemap/concerts.xml';

async function fetchEventDetails(url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 15000,
    });
    
    const html = response.data;
    
    // Extract JSON-LD
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (jsonLdMatch) {
      try {
        const data = JSON.parse(jsonLdMatch[1]);
        const event = Array.isArray(data) ? data.find(d => d['@type']?.includes('Event')) : data;
        
        if (event && event['@type']?.includes('Event')) {
          return {
            title: event.name,
            description: event.description?.substring(0, 500),
            start_time: event.startDate ? new Date(event.startDate) : null,
            venue_name: event.location?.name,
            city: event.location?.address?.addressLocality,
            state: event.location?.address?.addressRegion,
            country: event.location?.address?.addressCountry || 'US',
            latitude: parseFloat(event.location?.geo?.latitude) || null,
            longitude: parseFloat(event.location?.geo?.longitude) || null,
            image_url: event.image,
            external_url: url,
          };
        }
      } catch (e) {}
    }
    return null;
  } catch (err) {
    return null;
  }
}

function categorize(title) {
  const text = (title || '').toLowerCase();
  if (/concert|tour|band|music/.test(text)) return 'Concert';
  if (/comedy|standup/.test(text)) return 'Comedy';
  if (/theater|theatre|broadway|musical/.test(text)) return 'Theater';
  if (/sport|game|match|nfl|nba|mlb|nhl/.test(text)) return 'Sports';
  if (/festival/.test(text)) return 'Festival';
  return 'Concert';
}

function extractUrls(xml) {
  const urls = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    if (match[1].includes('vividseats.com/') && !match[1].endsWith('.xml')) {
      urls.push(match[1]);
    }
  }
  return urls;
}

async function syncAll() {
  console.log('[VividSeats] ====== STARTING FULL DATA SYNC ======');
  
  let totalAdded = 0, totalSkipped = 0, processed = 0;
  
  try {
    const response = await axios.get(SITEMAP_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 60000,
    });
    
    const urls = extractUrls(response.data);
    console.log(`[VividSeats] Found ${urls.length} URLs`);
    
    const batchSize = 10;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (url) => {
        const eventId = url.match(/\/(\d+)$/) || url.match(/performer\/(\d+)/);
        if (!eventId) { totalSkipped++; return; }
        
        const details = await fetchEventDetails(url);
        if (!details || !details.title || !details.city || !details.start_time) {
          totalSkipped++;
          return;
        }
        
        try {
          await Event.upsert({
            source: 'vividseats',
            source_id: `vividseats_${eventId[1]}`,
            title: details.title,
            description: details.description || '',
            category: categorize(details.title),
            venue_name: details.venue_name || 'TBA',
            city: details.city,
            state: details.state || '',
            country: details.country,
            latitude: details.latitude,
            longitude: details.longitude,
            start_time: details.start_time,
            image_url: details.image_url,
            is_free: false,
            external_url: url,
          });
          totalAdded++;
        } catch (err) { totalSkipped++; }
      }));
      
      processed += batch.length;
      if (processed % 100 < batchSize) {
        console.log(`[VividSeats] ${processed} processed, ${totalAdded} added, ${totalSkipped} skipped`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (err) {
    console.error('[VividSeats] Error:', err.message);
  }
  
  console.log(`[VividSeats] ====== COMPLETE: ${totalAdded} quality events ======`);
  return totalAdded;
}

module.exports = { syncAll };

// Geocode helper
async function geocodeLocation(city, state, country = 'US') {
  if (!city) return null;
  try {
    const query = encodeURIComponent(`${city}, ${state || ''} ${country}`.trim());
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: { 'User-Agent': 'Eventgasm/1.0' }, timeout: 5000 }
    );
    if (response.data?.[0]) {
      return {
        latitude: parseFloat(response.data[0].lat),
        longitude: parseFloat(response.data[0].lon),
      };
    }
  } catch (e) {}
  return null;
}
