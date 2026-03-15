/**
 * Local News Event Scraper
 * Scrapes local news sites for event announcements and creates events
 */
const axios = require('axios');
const cheerio = require('cheerio');
const Event = require('../models/Event');

// Major metro areas with their local news sources
const NEWS_SOURCES = [
  // Florida
  { city: 'Miami', state: 'FL', feeds: [
    'https://www.miamiherald.com/entertainment/article-list.rss',
    'https://www.local10.com/entertainment/rss/',
  ]},
  { city: 'Orlando', state: 'FL', feeds: [
    'https://www.orlandosentinel.com/entertainment/rss/',
  ]},
  { city: 'Tampa', state: 'FL', feeds: [
    'https://www.tampabay.com/things-to-do/feed/',
  ]},
  // California
  { city: 'Los Angeles', state: 'CA', feeds: [
    'https://www.latimes.com/entertainment-arts/rss2.0.xml',
  ]},
  { city: 'San Francisco', state: 'CA', feeds: [
    'https://www.sfchronicle.com/entertainment/feed/',
  ]},
  // New York
  { city: 'New York', state: 'NY', feeds: [
    'https://www.timeout.com/newyork/rss',
  ]},
  // Texas
  { city: 'Houston', state: 'TX', feeds: [
    'https://www.houstonchronicle.com/entertainment/feed/',
  ]},
  { city: 'Austin', state: 'TX', feeds: [
    'https://www.austin360.com/rss/',
  ]},
];

// Keywords that indicate an event article
const EVENT_KEYWORDS = [
  'festival', 'concert', 'show', 'performance', 'exhibit', 'exhibition',
  'fair', 'parade', 'celebration', 'event', 'tickets', 'live music',
  'art show', 'food festival', 'beer fest', 'wine tasting', 'market',
  'carnival', 'rodeo', 'race', 'marathon', 'tournament', 'competition'
];

// Date patterns to extract from text
const DATE_PATTERNS = [
  /(?:on\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/gi,
  /(?:on\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*[-–]\s*\d{1,2}(?:st|nd|rd|th)?)?,?\s*\d{4})/gi,
  /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
  /(this\s+(?:saturday|sunday|weekend|friday))/gi,
  /(next\s+(?:saturday|sunday|weekend|friday|week))/gi,
];

// Extract potential event data from article text
function extractEventFromText(title, text, city, state) {
  // Check if it's likely an event article
  const lowerText = (title + ' ' + text).toLowerCase();
  const isEventArticle = EVENT_KEYWORDS.some(kw => lowerText.includes(kw));
  
  if (!isEventArticle) return null;
  
  // Try to extract date
  let eventDate = null;
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      try {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime()) && parsed > new Date()) {
          eventDate = parsed;
          break;
        }
      } catch (e) {}
    }
  }
  
  // If no future date found, skip
  if (!eventDate) {
    // Default to 30 days from now for "upcoming" events
    const now = new Date();
    eventDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  
  // Extract venue - look for "at [Venue]" patterns
  let venue = null;
  const venueMatch = text.match(/(?:at|held at|takes place at|located at)\s+(?:the\s+)?([A-Z][A-Za-z\s&']+?)(?:,|\.|on|in|\d)/);
  if (venueMatch) {
    venue = venueMatch[1].trim();
  }
  
  // Determine category
  let category = 'Community';
  if (lowerText.includes('music') || lowerText.includes('concert')) category = 'Music';
  else if (lowerText.includes('art') || lowerText.includes('exhibit')) category = 'Arts';
  else if (lowerText.includes('food') || lowerText.includes('taste')) category = 'Food';
  else if (lowerText.includes('festival')) category = 'Festival';
  else if (lowerText.includes('market') || lowerText.includes('fair')) category = 'Market';
  
  return {
    title: title.trim(),
    description: text.slice(0, 500).trim(),
    category,
    venue: venue || city,
    city,
    state,
    date: eventDate,
  };
}

async function scrapeRSSFeed(feedUrl, city, state) {
  const events = [];
  
  try {
    const response = await axios.get(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 EventgasmBot/1.0' },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data, { xmlMode: true });
    
    $('item, entry').each((i, item) => {
      const $item = $(item);
      const title = $item.find('title').text();
      const description = $item.find('description, summary, content').text();
      const link = $item.find('link').text() || $item.find('link').attr('href');
      
      const eventData = extractEventFromText(title, description, city, state);
      
      if (eventData) {
        eventData.url = link;
        eventData.source_id = `news_${city.toLowerCase().replace(/\s/g, '_')}_${Buffer.from(title).toString('base64').slice(0, 20)}`;
        events.push(eventData);
      }
    });
    
  } catch (err) {
    console.log(`[News] Failed to fetch ${feedUrl}: ${err.message}`);
  }
  
  return events;
}

async function syncAll() {
  console.log('[News] ====== STARTING NEWS SCRAPER ======');
  let totalAdded = 0;
  
  for (const source of NEWS_SOURCES) {
    console.log(`[News] Scraping ${source.city}, ${source.state}...`);
    
    for (const feedUrl of source.feeds) {
      try {
        const events = await scrapeRSSFeed(feedUrl, source.city, source.state);
        
        for (const event of events) {
          try {
            await Event.upsert({
              source: 'news',
              source_id: event.source_id,
              title: event.title,
              description: event.description,
              category: event.category,
              venue_name: event.venue,
              city: event.city,
              state: event.state,
              country: 'US',
              start_time: event.date,
              is_free: true, // Assume free unless stated otherwise
              external_url: event.url,
            });
            totalAdded++;
          } catch (upsertErr) {
            // Skip duplicates
          }
        }
        
        // Rate limit
        await new Promise(r => setTimeout(r, 500));
        
      } catch (feedErr) {
        console.log(`[News] Error on feed: ${feedErr.message}`);
      }
    }
  }
  
  console.log(`[News] ====== SYNC COMPLETE: +${totalAdded} events ======`);
  return totalAdded;
}

module.exports = { syncAll, NEWS_SOURCES, extractEventFromText };
