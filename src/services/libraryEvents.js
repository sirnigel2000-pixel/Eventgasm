/**
 * Florida Library Events Scraper
 * Scrapes free community events from public library systems
 * Great for: kids events, classes, workshops, book clubs, community meetings
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Major Florida library systems with event calendars
const LIBRARY_SYSTEMS = [
  {
    name: 'Miami-Dade Public Library',
    city: 'Miami',
    url: 'https://mdpls.org/events',
    type: 'librarymarket',
  },
  {
    name: 'Orange County Library',
    city: 'Orlando', 
    url: 'https://www.ocls.info/events',
    type: 'evanced',
  },
  {
    name: 'Tampa-Hillsborough Public Library',
    city: 'Tampa',
    url: 'https://hcplc.org/events',
    type: 'communico',
  },
  {
    name: 'Jacksonville Public Library',
    city: 'Jacksonville',
    url: 'https://jaxpubliclibrary.org/events',
    type: 'libcal',
  },
  {
    name: 'Broward County Library',
    city: 'Fort Lauderdale',
    url: 'https://www.broward.org/Library/Pages/Events.aspx',
    type: 'sharepoint',
  },
  {
    name: 'Palm Beach County Library',
    city: 'West Palm Beach', 
    url: 'https://www.pbclibrary.org/events',
    type: 'evanced',
  },
];

// Map library event categories to our categories
function mapCategory(libCategory) {
  const cat = (libCategory || '').toLowerCase();
  
  if (cat.includes('kid') || cat.includes('child') || cat.includes('teen') || cat.includes('youth')) {
    return 'Family';
  }
  if (cat.includes('book') || cat.includes('read') || cat.includes('author') || cat.includes('writing')) {
    return 'Arts & Theatre';
  }
  if (cat.includes('computer') || cat.includes('tech') || cat.includes('digital')) {
    return 'Education';
  }
  if (cat.includes('craft') || cat.includes('art') || cat.includes('creative')) {
    return 'Arts & Theatre';
  }
  if (cat.includes('health') || cat.includes('fitness') || cat.includes('yoga')) {
    return 'Health & Fitness';
  }
  if (cat.includes('music') || cat.includes('concert')) {
    return 'Music';
  }
  if (cat.includes('movie') || cat.includes('film')) {
    return 'Film';
  }
  if (cat.includes('business') || cat.includes('career') || cat.includes('job')) {
    return 'Business';
  }
  
  return 'Community';
}

/**
 * Generic scraper for LibCal-based library calendars
 */
async function scrapeLibCal(config) {
  const events = [];
  
  try {
    // LibCal uses a JSON API endpoint
    const apiUrl = config.url.replace('/events', '/calendar/events?limit=100');
    const response = await axios.get(apiUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Eventgasm/1.0 (Community Event Aggregator)',
      },
    });

    const data = response.data?.events || response.data || [];
    
    for (const e of data) {
      events.push({
        externalId: `library-${config.city.toLowerCase()}-${e.id || Date.now()}`,
        source: 'library',
        title: e.title || e.name,
        description: e.description || e.content || null,
        category: mapCategory(e.category || e.type),
        subcategory: 'Library Event',
        venueName: e.location?.name || e.branch || config.name,
        venueAddress: e.location?.address || null,
        city: config.city,
        state: 'FL',
        zip: null,
        country: 'US',
        lat: e.location?.latitude || null,
        lng: e.location?.longitude || null,
        startTime: new Date(e.start || e.startDate),
        endTime: e.end ? new Date(e.end) : null,
        timezone: 'America/New_York',
        imageUrl: e.image || e.featured_image || null,
        ticketUrl: e.url || e.link || config.url,
        priceMin: 0,
        priceMax: 0,
        isFree: true, // Library events are always free
      });
    }
  } catch (error) {
    console.error(`[Library] Error scraping ${config.name}:`, error.message);
  }
  
  return events;
}

/**
 * Generic HTML scraper for library event pages
 */
async function scrapeHtml(config) {
  const events = [];
  
  try {
    const response = await axios.get(config.url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Eventgasm/1.0 (Community Event Aggregator)',
      },
    });

    const $ = cheerio.load(response.data);
    
    // Common selectors for event listings
    const selectors = [
      '.event-item',
      '.event-listing',
      '.event-card',
      '[class*="event"]',
      '.views-row', // Drupal
      '.fc-event', // FullCalendar
    ];

    for (const selector of selectors) {
      $(selector).each((i, el) => {
        const $el = $(el);
        
        // Try to extract event data
        const title = $el.find('h2, h3, h4, .title, .event-title, a').first().text().trim();
        const dateText = $el.find('.date, .event-date, time, [datetime]').first().text().trim();
        const description = $el.find('.description, .summary, p').first().text().trim();
        const link = $el.find('a').first().attr('href');
        
        if (title && title.length > 3) {
          events.push({
            externalId: `library-${config.city.toLowerCase()}-${Buffer.from(title).toString('base64').slice(0, 20)}`,
            source: 'library',
            title: title.slice(0, 200),
            description: description.slice(0, 500) || null,
            category: mapCategory(title + ' ' + description),
            subcategory: 'Library Event',
            venueName: config.name,
            venueAddress: null,
            city: config.city,
            state: 'FL',
            zip: null,
            country: 'US',
            lat: null,
            lng: null,
            startTime: parseDate(dateText) || new Date(),
            endTime: null,
            timezone: 'America/New_York',
            imageUrl: null,
            ticketUrl: link?.startsWith('http') ? link : (config.url + link),
            priceMin: 0,
            priceMax: 0,
            isFree: true,
          });
        }
      });
      
      if (events.length > 0) break; // Found events, stop trying selectors
    }
  } catch (error) {
    console.error(`[Library] Error scraping ${config.name}:`, error.message);
  }
  
  return events;
}

/**
 * Parse various date formats
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Try native parsing first
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  // Try common patterns
  const patterns = [
    /(\w+ \d+, \d{4})/,  // "March 15, 2026"
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,  // "3/15/2026"
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      const parsed = new Date(match[1]);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  
  return null;
}

/**
 * Sync all library systems
 */
async function syncAll() {
  console.log('[Library] Starting library events sync...');
  let allEvents = [];
  
  for (const lib of LIBRARY_SYSTEMS) {
    console.log(`[Library] Scraping ${lib.name}...`);
    
    let events = [];
    
    if (lib.type === 'libcal') {
      events = await scrapeLibCal(lib);
    } else {
      events = await scrapeHtml(lib);
    }
    
    console.log(`[Library] Found ${events.length} events from ${lib.name}`);
    allEvents = allEvents.concat(events);
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log(`[Library] Total: ${allEvents.length} library events found`);
  return allEvents;
}

/**
 * Sync specific city
 */
async function syncCity(cityName) {
  const lib = LIBRARY_SYSTEMS.find(l => 
    l.city.toLowerCase() === cityName.toLowerCase()
  );
  
  if (!lib) {
    console.log(`[Library] No library system configured for ${cityName}`);
    return [];
  }
  
  if (lib.type === 'libcal') {
    return await scrapeLibCal(lib);
  } else {
    return await scrapeHtml(lib);
  }
}

module.exports = {
  syncAll,
  syncCity,
  LIBRARY_SYSTEMS,
  scrapeLibCal,
  scrapeHtml,
};
