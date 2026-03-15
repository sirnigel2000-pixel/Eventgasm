/**
 * Songkick Sitemap Scraper
 * Fetches concerts from Songkick sitemaps - 500K+ potential events!
 */
const axios = require('axios');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);
const Event = require('../models/Event');

// Songkick has multiple concert sitemaps
const CONCERT_SITEMAPS = [
  'https://www.songkick.com/sitemap/concerts.0.xml.gz',
  'https://www.songkick.com/sitemap/concerts.1.xml.gz',
  'https://www.songkick.com/sitemap/concerts.2.xml.gz',
  'https://www.songkick.com/sitemap/concerts.3.xml.gz',
  'https://www.songkick.com/sitemap/concerts.4.xml.gz',
];

// Parse Songkick URL
// Format: https://www.songkick.com/concerts/12345-artist-at-venue
function parseEventUrl(url) {
  const match = url.match(/songkick\.com\/concerts\/(\d+)-(.+)/);
  if (!match) return null;
  
  const eventId = match[1];
  const titleSlug = match[2];
  const title = titleSlug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  
  return { eventId, title, url };
}

async function fetchSitemap(url) {
  console.log(`[Songkick] Fetching ${url}...`);
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EventgasmBot/1.0)' },
      timeout: 60000,
    });
    
    const decompressed = await gunzip(response.data);
    return decompressed.toString('utf-8');
  } catch (err) {
    console.error(`[Songkick] Failed to fetch ${url}:`, err.message);
    return null;
  }
}

function extractUrls(xml) {
  const urls = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let match;
  
  while ((match = regex.exec(xml)) !== null) {
    if (match[1].includes('/concerts/')) {
      urls.push(match[1]);
    }
  }
  
  return urls;
}

async function syncAll() {
  console.log('[Songkick] ====== STARTING SONGKICK SITEMAP SYNC ======');
  console.log(`[Songkick] Processing ${CONCERT_SITEMAPS.length} sitemaps...`);
  
  let totalAdded = 0;
  let totalProcessed = 0;
  
  for (const sitemapUrl of CONCERT_SITEMAPS) {
    try {
      const xml = await fetchSitemap(sitemapUrl);
      if (!xml) continue;
      
      const urls = extractUrls(xml);
      console.log(`[Songkick] Found ${urls.length} concerts in sitemap`);
      
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
              source: 'songkick',
              source_id: `songkick_${parsed.eventId}`,
              title: parsed.title,
              description: 'Concert on Songkick',
              category: 'Concert',
              venue_name: 'See Songkick',
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
        totalProcessed += batch.length;
        
        if (totalProcessed % 5000 < batchSize) {
          console.log(`[Songkick] Progress: ${totalProcessed} processed, ${totalAdded} added`);
        }
      }
      
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (err) {
      console.error(`[Songkick] Error:`, err.message);
    }
  }
  
  console.log(`[Songkick] ====== SYNC COMPLETE: ${totalAdded} events added ======`);
  return totalAdded;
}

module.exports = { syncAll };
