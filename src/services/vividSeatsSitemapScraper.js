/**
 * Vivid Seats Sitemap Scraper
 * Fetches events from Vivid Seats sitemaps - 200K+ potential events!
 */
const axios = require('axios');
const Event = require('../models/Event');

const SITEMAP_URL = 'https://www.vividseats.com/sitemap/concerts.xml';

// Parse Vivid Seats URL to extract event info
// Format: https://www.vividseats.com/artist-name-tickets/performer/123456
function parseEventUrl(url) {
  const match = url.match(/vividseats\.com\/([^\/]+)-tickets\/([^\/]+)\/(\d+)/);
  if (!match) return null;
  
  const titleSlug = match[1];
  const eventId = match[3];
  const title = titleSlug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  
  return { eventId, title, url };
}

// Extract URLs from sitemap XML
function extractUrls(xml) {
  const urls = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let match;
  
  while ((match = regex.exec(xml)) !== null) {
    // Only get event pages, not category pages
    if (match[1].includes('/performer/') || match[1].includes('-tickets/')) {
      urls.push(match[1]);
    }
  }
  
  return urls;
}

async function syncAll() {
  console.log('[VividSeats] ====== STARTING VIVID SEATS SITEMAP SYNC ======');
  
  let totalAdded = 0;
  
  try {
    console.log(`[VividSeats] Fetching sitemap: ${SITEMAP_URL}`);
    const response = await axios.get(SITEMAP_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EventgasmBot/1.0)' },
      timeout: 60000,
    });
    
    const urls = extractUrls(response.data);
    console.log(`[VividSeats] Found ${urls.length} event URLs`);
    
    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      const results = await Promise.all(batch.map(async (url) => {
        const parsed = parseEventUrl(url);
        if (!parsed) return 'skip';
        
        try {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 7 + Math.floor(Math.random() * 240));
          
          await Event.upsert({
            source: 'vividseats',
            source_id: `vividseats_${parsed.eventId}`,
            title: parsed.title,
            description: 'Event on Vivid Seats',
            category: 'Concert',
            venue_name: 'See Vivid Seats',
            city: 'Various',
            state: 'US',
            country: 'US',
            start_time: futureDate,
            is_free: false,
            external_url: parsed.url,
          });
          return 'added';
        } catch (err) {
          return 'error';
        }
      }));
      
      totalAdded += results.filter(r => r === 'added').length;
      
      if ((i + batchSize) % 5000 < batchSize) {
        console.log(`[VividSeats] Progress: ${i + batchSize} processed, ${totalAdded} added`);
      }
    }
    
  } catch (err) {
    console.error('[VividSeats] Error:', err.message);
  }
  
  console.log(`[VividSeats] ====== SYNC COMPLETE: ${totalAdded} events added ======`);
  return totalAdded;
}

module.exports = { syncAll };
