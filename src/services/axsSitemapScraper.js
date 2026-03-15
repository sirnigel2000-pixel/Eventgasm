/**
 * AXS Sitemap Scraper
 * Extracts events from AXS's sitemap
 */
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const Event = require('../models/Event');
const { fillLocation } = require('./geocoder');

const SITEMAP_URLS = [
  'https://www.axs.com/sitemap.xml',
  'https://www.axs.com/sitemap-events.xml',
  'https://www.axs.com/sitemap_index.xml'
];

async function fetchSitemap(url) {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: { 'User-Agent': 'Eventgasm/1.0' }
    });
    return await parseStringPromise(response.data);
  } catch (e) {
    return null;
  }
}

async function scrape() {
  console.log('[AXS] Starting sitemap scrape...');
  
  let allUrls = [];
  
  for (const sitemapUrl of SITEMAP_URLS) {
    const sitemap = await fetchSitemap(sitemapUrl);
    if (sitemap?.urlset?.url) {
      allUrls = allUrls.concat(sitemap.urlset.url);
      console.log(`[AXS] Found ${sitemap.urlset.url.length} URLs in ${sitemapUrl}`);
    } else if (sitemap?.sitemapindex?.sitemap) {
      // It's an index, fetch child sitemaps
      for (const child of sitemap.sitemapindex.sitemap) {
        const childUrl = child.loc?.[0];
        if (childUrl?.includes('event')) {
          const childSitemap = await fetchSitemap(childUrl);
          if (childSitemap?.urlset?.url) {
            allUrls = allUrls.concat(childSitemap.urlset.url);
            console.log(`[AXS] Found ${childSitemap.urlset.url.length} URLs in ${childUrl}`);
          }
        }
      }
    }
  }
  
  if (allUrls.length === 0) {
    console.log('[AXS] No event URLs found');
    return { added: 0, source: 'axs' };
  }
  
  console.log(`[AXS] Total URLs: ${allUrls.length}`);
  
  let added = 0;
  const batchSize = 50;
  
  for (let i = 0; i < allUrls.length && added < 5000; i += batchSize) {
    const batch = allUrls.slice(i, i + batchSize);
    
    for (const urlEntry of batch) {
      const url = urlEntry.loc?.[0];
      if (!url || (!url.includes('/events/') && !url.includes('/event/'))) continue;
      
      try {
        // Extract event info from URL
        // Format: axs.com/events/123456/event-name or axs.com/city/events/event-name/123456
        const idMatch = url.match(/\/(\d+)(?:\/|$)/);
        const slugMatch = url.match(/\/events?\/([^\/\d][^\/]*)/);
        
        if (!idMatch && !slugMatch) continue;
        
        const eventId = idMatch?.[1] || slugMatch?.[1];
        const slug = slugMatch?.[1] || idMatch?.[1];
        const title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        // Try to extract city from URL path
        const cityMatch = url.match(/axs\.com\/([a-z-]+)\/events/i);
        const city = cityMatch ? cityMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null;
        
        let eventData = {
          source: 'axs',
          source_id: `axs-${eventId}`,
          title,
          ticket_url: url,
          city,
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
      console.log(`[AXS] Progress: ${i}/${allUrls.length}, added: ${added}`);
    }
  }
  
  console.log(`[AXS] Complete: ${added} events added`);
  return { added, source: 'axs' };
}

module.exports = { scrape };
