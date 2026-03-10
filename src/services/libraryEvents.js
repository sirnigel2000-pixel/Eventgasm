/**
 * Florida Library Events Scraper
 * Scrapes free community events from public library systems
 * Great for: kids events, classes, workshops, book clubs, community meetings
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Major US library systems with event calendars (Top 30 metros + Florida)
const LIBRARY_SYSTEMS = [
  // FLORIDA
  { name: 'Miami-Dade Public Library', city: 'Miami', state: 'FL', url: 'https://mdpls.org/events', type: 'html' },
  { name: 'Orange County Library', city: 'Orlando', state: 'FL', url: 'https://www.ocls.info/events', type: 'html' },
  { name: 'Tampa-Hillsborough Public Library', city: 'Tampa', state: 'FL', url: 'https://hcplc.org/events', type: 'html' },
  { name: 'Jacksonville Public Library', city: 'Jacksonville', state: 'FL', url: 'https://jaxpubliclibrary.org/events', type: 'libcal' },
  { name: 'Broward County Library', city: 'Fort Lauderdale', state: 'FL', url: 'https://www.broward.org/Library/Pages/Events.aspx', type: 'html' },
  { name: 'Palm Beach County Library', city: 'West Palm Beach', state: 'FL', url: 'https://www.pbclibrary.org/events', type: 'html' },
  
  // NORTHEAST
  { name: 'New York Public Library', city: 'New York', state: 'NY', url: 'https://www.nypl.org/events', type: 'html' },
  { name: 'Brooklyn Public Library', city: 'Brooklyn', state: 'NY', url: 'https://www.bklynlibrary.org/calendar', type: 'html' },
  { name: 'Queens Public Library', city: 'Queens', state: 'NY', url: 'https://www.queenslibrary.org/programs-activities', type: 'html' },
  { name: 'Free Library of Philadelphia', city: 'Philadelphia', state: 'PA', url: 'https://libwww.freelibrary.org/calendar/', type: 'html' },
  { name: 'Boston Public Library', city: 'Boston', state: 'MA', url: 'https://www.bpl.org/events/', type: 'html' },
  { name: 'DC Public Library', city: 'Washington', state: 'DC', url: 'https://www.dclibrary.org/events', type: 'html' },
  
  // MIDWEST
  { name: 'Chicago Public Library', city: 'Chicago', state: 'IL', url: 'https://www.chipublib.org/events/', type: 'html' },
  { name: 'Detroit Public Library', city: 'Detroit', state: 'MI', url: 'https://detroitpubliclibrary.org/events', type: 'html' },
  { name: 'Cleveland Public Library', city: 'Cleveland', state: 'OH', url: 'https://cpl.org/events/', type: 'html' },
  { name: 'Columbus Metropolitan Library', city: 'Columbus', state: 'OH', url: 'https://www.columbuslibrary.org/events', type: 'html' },
  { name: 'Indianapolis Public Library', city: 'Indianapolis', state: 'IN', url: 'https://www.indypl.org/events', type: 'html' },
  { name: 'Minneapolis Public Library', city: 'Minneapolis', state: 'MN', url: 'https://www.hclib.org/events', type: 'html' },
  
  // SOUTH
  { name: 'Houston Public Library', city: 'Houston', state: 'TX', url: 'https://houstonlibrary.org/events', type: 'html' },
  { name: 'Dallas Public Library', city: 'Dallas', state: 'TX', url: 'https://dallaslibrary.org/events', type: 'html' },
  { name: 'Austin Public Library', city: 'Austin', state: 'TX', url: 'https://library.austintexas.gov/events', type: 'html' },
  { name: 'San Antonio Public Library', city: 'San Antonio', state: 'TX', url: 'https://www.mysapl.org/Events-News/Events-Calendar', type: 'html' },
  { name: 'Atlanta-Fulton Public Library', city: 'Atlanta', state: 'GA', url: 'https://www.fulcolibrary.org/events/', type: 'html' },
  { name: 'Charlotte Mecklenburg Library', city: 'Charlotte', state: 'NC', url: 'https://www.cmlibrary.org/events', type: 'html' },
  { name: 'Nashville Public Library', city: 'Nashville', state: 'TN', url: 'https://library.nashville.org/events', type: 'html' },
  { name: 'New Orleans Public Library', city: 'New Orleans', state: 'LA', url: 'https://nolalibrary.org/events/', type: 'html' },
  
  // WEST
  { name: 'Los Angeles Public Library', city: 'Los Angeles', state: 'CA', url: 'https://www.lapl.org/whats-on', type: 'html' },
  { name: 'San Francisco Public Library', city: 'San Francisco', state: 'CA', url: 'https://sfpl.org/events', type: 'html' },
  { name: 'San Diego Public Library', city: 'San Diego', state: 'CA', url: 'https://www.sandiego.gov/public-library/news-events', type: 'html' },
  { name: 'San Jose Public Library', city: 'San Jose', state: 'CA', url: 'https://www.sjpl.org/events', type: 'html' },
  { name: 'Phoenix Public Library', city: 'Phoenix', state: 'AZ', url: 'https://www.phoenixpubliclibrary.org/events', type: 'html' },
  { name: 'Denver Public Library', city: 'Denver', state: 'CO', url: 'https://www.denverlibrary.org/events', type: 'html' },
  { name: 'Seattle Public Library', city: 'Seattle', state: 'WA', url: 'https://www.spl.org/programs-and-services/learning', type: 'html' },
  { name: 'Portland Public Library', city: 'Portland', state: 'OR', url: 'https://multcolib.org/events', type: 'html' },
  { name: 'Las Vegas-Clark County Library', city: 'Las Vegas', state: 'NV', url: 'https://lvccld.org/events/', type: 'html' },
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
            state: config.state || 'FL',
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
