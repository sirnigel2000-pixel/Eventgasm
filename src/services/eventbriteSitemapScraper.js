/**
 * Eventbrite Sitemap Scraper - FULL DATA VERSION
 * Fetches complete event details from each page
 */
const axios = require('axios');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);
const Event = require('../models/Event');

const EVENT_SITEMAPS = [
  'https://www.eventbrite.com/sitemap_xml/event_pages00.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages01.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages02.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages03.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages04.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages05.xml.gz',
  'https://www.eventbrite.com/sitemap_xml/event_pages06.xml.gz',
];

// Fetch and decompress gzipped sitemap
async function fetchSitemap(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EventgasmBot/1.0)' },
      timeout: 60000,
    });
    const decompressed = await gunzip(response.data);
    return decompressed.toString('utf-8');
  } catch (err) {
    console.error(`[Eventbrite] Failed to fetch sitemap:`, err.message);
    return null;
  }
}

// Extract event URLs from sitemap
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

// Fetch actual event page and extract JSON-LD data
async function fetchEventDetails(url) {
  try {
    const response = await axios.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      timeout: 15000,
    });
    
    const html = response.data;
    
    // Extract JSON-LD structured data (most reliable)
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (jsonLdMatch) {
      try {
        const data = JSON.parse(jsonLdMatch[1]);
        const event = Array.isArray(data) ? data.find(d => d['@type'] === 'Event') : (data['@type'] === 'Event' ? data : null);
        
        if (event) {
          return {
            title: event.name,
            description: event.description?.substring(0, 500) || '',
            start_time: event.startDate ? new Date(event.startDate) : null,
            end_time: event.endDate ? new Date(event.endDate) : null,
            venue_name: event.location?.name || event.location?.address?.name || '',
            city: event.location?.address?.addressLocality || '',
            state: event.location?.address?.addressRegion || '',
            country: event.location?.address?.addressCountry || 'US',
            latitude: event.location?.geo?.latitude,
            longitude: event.location?.geo?.longitude,
            image_url: event.image,
            is_free: event.offers?.price === 0 || event.isAccessibleForFree,
            external_url: url,
          };
        }
      } catch (e) { /* JSON parse failed */ }
    }
    
    // Fallback: extract from meta tags
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    
    if (titleMatch) {
      return {
        title: titleMatch[1],
        description: descMatch ? descMatch[1] : '',
        image_url: imageMatch ? imageMatch[1] : null,
        external_url: url,
      };
    }
    
    return null;
  } catch (err) {
    return null; // Skip failed fetches
  }
}

// Categorize event based on title/description
function categorizeEvent(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  
  if (/concert|music|band|dj|festival|live music/.test(text)) return 'Concert';
  if (/comedy|standup|stand-up|improv/.test(text)) return 'Comedy';
  if (/food|drink|wine|beer|tasting|brunch|dinner/.test(text)) return 'Food & Drink';
  if (/art|gallery|museum|exhibit/.test(text)) return 'Arts';
  if (/sport|game|match|tournament|race|marathon/.test(text)) return 'Sports';
  if (/conference|summit|seminar|workshop|class|training/.test(text)) return 'Business';
  if (/family|kids|children|child/.test(text)) return 'Family';
  if (/party|club|nightlife|dance/.test(text)) return 'Nightlife';
  if (/charity|fundraiser|benefit|nonprofit/.test(text)) return 'Charity';
  if (/film|movie|screening|cinema/.test(text)) return 'Film';
  if (/theater|theatre|play|musical|broadway/.test(text)) return 'Theater';
  if (/tech|startup|coding|developer/.test(text)) return 'Tech';
  if (/yoga|wellness|meditation|health|fitness/.test(text)) return 'Health';
  
  return 'Community';
}

async function syncAll() {
  console.log('[Eventbrite] ====== STARTING FULL DATA SYNC ======');
  
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalProcessed = 0;
  
  for (const sitemapUrl of EVENT_SITEMAPS) {
    console.log(`[Eventbrite] Processing ${sitemapUrl}...`);
    
    const xml = await fetchSitemap(sitemapUrl);
    if (!xml) continue;
    
    const urls = extractUrls(xml);
    console.log(`[Eventbrite] Found ${urls.length} events`);
    
    // Process in smaller batches to not overwhelm
    const batchSize = 10; // Fetch 10 at a time
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      const results = await Promise.all(batch.map(async (url) => {
        const eventId = url.match(/tickets-(\d+)/)?.[1];
        if (!eventId) return 'skip';
        
        const details = await fetchEventDetails(url);
        if (!details || !details.title) return 'skip';
        
        // Skip if missing critical data
        if (!details.start_time && !details.city) return 'skip';
        
        try {
          await Event.upsert({
            source: 'eventbrite',
            source_id: `eventbrite_${eventId}`,
            title: details.title,
            description: details.description || '',
            category: categorizeEvent(details.title, details.description || ''),
            venue_name: details.venue_name || 'TBA',
            city: details.city || 'Unknown',
            state: details.state || '',
            country: details.country || 'US',
            latitude: details.latitude,
            longitude: details.longitude,
            start_time: details.start_time || new Date(Date.now() + 30*24*60*60*1000),
            end_time: details.end_time,
            image_url: details.image_url,
            is_free: details.is_free || false,
            external_url: url,
          });
          return 'added';
        } catch (err) {
          return 'error';
        }
      }));
      
      totalAdded += results.filter(r => r === 'added').length;
      totalSkipped += results.filter(r => r === 'skip').length;
      totalProcessed += batch.length;
      
      // Progress update every 100 events
      if (totalProcessed % 100 < batchSize) {
        console.log(`[Eventbrite] Progress: ${totalProcessed} processed, ${totalAdded} added, ${totalSkipped} skipped`);
      }
      
      // Small delay to be nice to Eventbrite
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  console.log(`[Eventbrite] ====== COMPLETE: ${totalAdded} quality events added ======`);
  return totalAdded;
}

module.exports = { syncAll };
