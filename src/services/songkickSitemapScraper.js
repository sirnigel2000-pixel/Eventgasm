/**
 * Songkick Sitemap Scraper - FULL DATA VERSION
 */
const axios = require('axios');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);
const Event = require('../models/Event');

const SITEMAPS = [
  'https://www.songkick.com/sitemap/concerts.0.xml.gz',
  'https://www.songkick.com/sitemap/concerts.1.xml.gz',
  'https://www.songkick.com/sitemap/concerts.2.xml.gz',
  'https://www.songkick.com/sitemap/concerts.3.xml.gz',
  'https://www.songkick.com/sitemap/concerts.4.xml.gz',
];

async function fetchSitemap(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 60000,
    });
    return (await gunzip(response.data)).toString('utf-8');
  } catch (err) {
    return null;
  }
}

async function fetchEventDetails(url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 15000,
    });
    
    const html = response.data;
    
    // JSON-LD
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

function extractUrls(xml) {
  const urls = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    if (match[1].includes('/concerts/')) urls.push(match[1]);
  }
  return urls;
}

async function syncAll() {
  console.log('[Songkick] ====== STARTING FULL DATA SYNC ======');
  
  let totalAdded = 0, totalSkipped = 0, processed = 0;
  
  for (const sitemapUrl of SITEMAPS) {
    console.log(`[Songkick] Processing ${sitemapUrl}`);
    const xml = await fetchSitemap(sitemapUrl);
    if (!xml) continue;
    
    const urls = extractUrls(xml);
    console.log(`[Songkick] Found ${urls.length} concerts`);
    
    const batchSize = 10;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (url) => {
        const eventId = url.match(/concerts\/(\d+)/);
        if (!eventId) { totalSkipped++; return; }
        
        const details = await fetchEventDetails(url);
        if (!details || !details.title || !details.city || !details.start_time) {
          totalSkipped++;
          return;
        }
        
        try {
          await Event.upsert({
            source: 'songkick',
            source_id: `songkick_${eventId[1]}`,
            title: details.title,
            description: details.description || '',
            category: 'Concert',
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
        console.log(`[Songkick] ${processed} processed, ${totalAdded} added`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  console.log(`[Songkick] ====== COMPLETE: ${totalAdded} quality events ======`);
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
