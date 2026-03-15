/**
 * StubHub Sitemap Scraper
 * Extracts events from StubHub's sitemap
 */
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const Event = require('../models/Event');
const { fillLocation } = require('./geocoder');

const SITEMAP_URL = 'https://www.stubhub.com/sitemap-events.xml';

async function fetchSitemap(url) {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: { 'User-Agent': 'Eventgasm/1.0' }
    });
    return await parseStringPromise(response.data);
  } catch (e) {
    console.error('[StubHub] Sitemap fetch error:', e.message);
    return null;
  }
}

async function scrape() {
  console.log('[StubHub] Starting sitemap scrape...');
  
  const sitemap = await fetchSitemap(SITEMAP_URL);
  if (!sitemap?.urlset?.url) {
    // Try index sitemap
    const index = await fetchSitemap('https://www.stubhub.com/sitemap_index.xml');
    if (!index) {
      console.log('[StubHub] No sitemap found');
      return { added: 0, source: 'stubhub' };
    }
    console.log('[StubHub] Found sitemap index');
  }
  
  const urls = sitemap?.urlset?.url || [];
  console.log(`[StubHub] Found ${urls.length} URLs`);
  
  let added = 0;
  const batchSize = 50;
  
  for (let i = 0; i < urls.length && added < 5000; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    for (const urlEntry of batch) {
      const url = urlEntry.loc?.[0];
      if (!url || !url.includes('/event/')) continue;
      
      try {
        // Extract event info from URL
        // Format: stubhub.com/event-name-tickets/event/123456
        const match = url.match(/\/([^\/]+)-tickets\/event\/(\d+)/);
        if (!match) continue;
        
        const [, slug, eventId] = match;
        const title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        // Parse location from slug if possible
        const parts = slug.split('-');
        let city = null, state = null;
        
        // Common patterns: "event-name-city-state-tickets"
        const stateAbbrs = ['al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy','dc'];
        
        for (let j = parts.length - 1; j >= 0; j--) {
          if (stateAbbrs.includes(parts[j].toLowerCase())) {
            state = parts[j].toUpperCase();
            if (j > 0) city = parts[j-1].replace(/\b\w/g, c => c.toUpperCase());
            break;
          }
        }
        
        let eventData = {
          source: 'stubhub',
          source_id: eventId,
          title,
          ticket_url: url,
          city,
          state,
          country: 'US'
        };
        
        // Use Google to fill location
        eventData = await fillLocation(eventData);
        
        if (eventData.city || eventData.latitude) {
          await Event.upsert(eventData);
          added++;
        }
      } catch (e) {
        // Skip individual errors
      }
    }
    
    if (i % 500 === 0) {
      console.log(`[StubHub] Progress: ${i}/${urls.length}, added: ${added}`);
    }
  }
  
  console.log(`[StubHub] Complete: ${added} events added`);
  return { added, source: 'stubhub' };
}

module.exports = { scrape };
