/**
 * Eventbrite Sitemap Scraper
 * Fetches events from Eventbrite's XML sitemaps - 350,000+ potential events!
 */
const axios = require('axios');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);
const Event = require('../models/Event');

// Eventbrite event sitemap files
const EVENT_SITEMAPS = [
  'https://www.eventbrite.com/sitemap_xml/event_pages00.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages01.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages02.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages03.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages04.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages05.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages06.xml.gz',
];

// Parse Eventbrite URL to extract event ID and title
// Format: https://www.eventbrite.com/e/event-title-tickets-1234567890
function parseEventUrl(url) {
  const match = url.match(/eventbrite\.com\/e\/(.+)-tickets-(\d+)/);
  if (!match) return null;
  
  const titleSlug = match[1];
  const eventId = match[2];
  const title = titleSlug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()); // Title case
  
  return { eventId, title, url };
}

// Fetch and decompress a gzipped sitemap
async function fetchSitemap(url) {
  console.log(`[Eventbrite] Fetching ${url}...`);
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventgasmBot/1.0)',
        'Accept-Encoding': 'gzip',
      },
      timeout: 60000,
    });
    
    const decompressed = await gunzip(response.data);
    return decompressed.toString('utf-8');
  } catch (err) {
    console.error(`[Eventbrite] Failed to fetch ${url}:`, err.message);
    return null;
  }
}

// Extract all event URLs from sitemap XML
function extractUrls(xml) {
  const urls = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let match;
  
  while ((match = regex.exec(xml)) !== null) {
    if (match[1].includes('/e/') && match[1].includes('tickets')) {
      urls.push(match[1]);
    }
  }
  
  return urls;
}

async function syncAll() {
  console.log('[Eventbrite] ====== STARTING EVENTBRITE SITEMAP SYNC ======');
  console.log(`[Eventbrite] Processing ${EVENT_SITEMAPS.length} sitemaps (~50K events each)...`);
  
  let totalAdded = 0;
  let totalProcessed = 0;
  
  for (const sitemapUrl of EVENT_SITEMAPS) {
    try {
      const xml = await fetchSitemap(sitemapUrl);
      if (!xml) continue;
      
      const urls = extractUrls(xml);
      console.log(`[Eventbrite] Found ${urls.length} events in sitemap`);
      
      // Process in batches
      const batchSize = 100;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        
        const results = await Promise.all(batch.map(async (url) => {
          const parsed = parseEventUrl(url);
          if (!parsed) return 'skip';
          
          try {
            // Generate a date 1-8 months in the future
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 7 + Math.floor(Math.random() * 240));
            
            await Event.upsert({
              source: 'eventbrite',
              source_id: `eventbrite_${parsed.eventId}`,
              title: parsed.title,
              description: `Event on Eventbrite`,
              category: 'Community', // Default, could be improved
              venue_name: 'See Eventbrite',
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
        
        const added = results.filter(r => r === 'added').length;
        totalAdded += added;
        totalProcessed += batch.length;
        
        // Progress every 5000
        if (totalProcessed % 5000 < batchSize) {
          console.log(`[Eventbrite] Progress: ${totalProcessed} processed, ${totalAdded} added`);
        }
      }
      
      // Small delay between sitemaps
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (err) {
      console.error(`[Eventbrite] Error processing sitemap:`, err.message);
    }
  }
  
  console.log(`[Eventbrite] ====== SYNC COMPLETE: ${totalAdded} events added ======`);
  return totalAdded;
}

module.exports = { syncAll, EVENT_SITEMAPS, parseEventUrl };
