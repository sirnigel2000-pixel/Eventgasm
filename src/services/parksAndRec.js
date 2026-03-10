/**
 * Florida Parks & Recreation Events Scraper
 * Scrapes free community events from city parks & rec departments
 * Great for: outdoor events, sports, fitness classes, festivals, community gatherings
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Florida city Parks & Recreation departments
const PARKS_DEPTS = [
  {
    name: 'Miami Parks & Recreation',
    city: 'Miami',
    url: 'https://www.miamigov.com/Parks-Recreation/Special-Events',
    apiUrl: null,
  },
  {
    name: 'Orlando Parks & Recreation',
    city: 'Orlando',
    url: 'https://www.orlando.gov/Parks-the-Environment/Community-Programs-Events',
    apiUrl: null,
  },
  {
    name: 'Tampa Parks & Recreation',
    city: 'Tampa',
    url: 'https://www.tampa.gov/parks-and-recreation/programs/special-events',
    apiUrl: null,
  },
  {
    name: 'Jacksonville Parks',
    city: 'Jacksonville',
    url: 'https://www.coj.net/departments/parks-and-recreation/recreation-and-community-programming/special-events',
    apiUrl: null,
  },
  {
    name: 'Fort Lauderdale Parks',
    city: 'Fort Lauderdale',
    url: 'https://www.fortlauderdale.gov/departments/parks-recreation/special-events',
    apiUrl: null,
  },
  {
    name: 'St. Petersburg Parks',
    city: 'St Petersburg',
    url: 'https://www.stpete.org/recreation_events/index.php',
    apiUrl: null,
  },
];

// Category mapping
function mapCategory(text) {
  const t = (text || '').toLowerCase();
  
  if (t.includes('fitness') || t.includes('yoga') || t.includes('exercise') || t.includes('run') || t.includes('walk')) {
    return 'Health & Fitness';
  }
  if (t.includes('sport') || t.includes('basketball') || t.includes('soccer') || t.includes('tennis')) {
    return 'Sports';
  }
  if (t.includes('music') || t.includes('concert') || t.includes('jazz')) {
    return 'Music';
  }
  if (t.includes('art') || t.includes('paint') || t.includes('craft')) {
    return 'Arts & Theatre';
  }
  if (t.includes('kid') || t.includes('child') || t.includes('family') || t.includes('youth')) {
    return 'Family';
  }
  if (t.includes('festival') || t.includes('celebration') || t.includes('parade')) {
    return 'Festival';
  }
  if (t.includes('movie') || t.includes('film')) {
    return 'Film';
  }
  if (t.includes('food') || t.includes('taste') || t.includes('culinary')) {
    return 'Food & Drink';
  }
  if (t.includes('nature') || t.includes('hike') || t.includes('outdoor') || t.includes('garden')) {
    return 'Outdoors';
  }
  
  return 'Community';
}

/**
 * Scrape events from HTML page
 */
async function scrapeDept(config) {
  const events = [];
  
  try {
    const response = await axios.get(config.url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Eventgasm/1.0 (Community Event Aggregator)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    const $ = cheerio.load(response.data);
    
    // Common selectors for city government event listings
    const containers = [
      '.event',
      '.event-item',
      '.event-listing',
      '.calendar-event',
      '.views-row',
      'article',
      '.card',
      '[class*="event"]',
      'li:has(a):has(time)',
    ];

    for (const selector of containers) {
      $(selector).each((i, el) => {
        const $el = $(el);
        
        // Extract event data
        const title = (
          $el.find('h2, h3, h4, .title, .event-title').first().text().trim() ||
          $el.find('a').first().text().trim()
        );
        
        const dateText = (
          $el.find('time, .date, .event-date, [datetime]').first().text().trim() ||
          $el.find('.meta').first().text().trim()
        );
        
        const description = $el.find('p, .description, .summary, .excerpt').first().text().trim();
        const location = $el.find('.location, .venue, address').first().text().trim();
        const link = $el.find('a').first().attr('href');
        const image = $el.find('img').first().attr('src');
        
        // Skip if no title or too short
        if (!title || title.length < 5) return;
        
        // Skip navigation links and other non-events
        if (title.toLowerCase().includes('click here') || 
            title.toLowerCase().includes('read more') ||
            title.toLowerCase().includes('register')) {
          return;
        }
        
        const eventId = `parks-${config.city.toLowerCase().replace(' ', '-')}-${Buffer.from(title).toString('base64').slice(0, 16)}`;
        
        events.push({
          externalId: eventId,
          source: 'parks',
          title: title.slice(0, 200),
          description: description.slice(0, 1000) || null,
          category: mapCategory(title + ' ' + description),
          subcategory: 'Parks & Recreation',
          venueName: location || config.name,
          venueAddress: location || null,
          city: config.city,
          state: 'FL',
          zip: null,
          country: 'US',
          lat: null,
          lng: null,
          startTime: parseDate(dateText) || new Date(),
          endTime: null,
          timezone: 'America/New_York',
          imageUrl: image?.startsWith('http') ? image : (image ? config.url.split('/').slice(0, 3).join('/') + image : null),
          ticketUrl: link?.startsWith('http') ? link : (link ? config.url.split('/').slice(0, 3).join('/') + link : config.url),
          priceMin: 0,
          priceMax: 0,
          isFree: true, // Most parks events are free
        });
      });
      
      if (events.length > 0) break;
    }
  } catch (error) {
    console.error(`[Parks] Error scraping ${config.name}:`, error.message);
  }
  
  return events;
}

/**
 * Parse various date formats
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Clean up the string
  dateStr = dateStr.replace(/\s+/g, ' ').trim();
  
  // Try native parsing first
  const d = new Date(dateStr);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2020) return d;
  
  // Try common patterns
  const patterns = [
    /(\w+day,?\s+)?(\w+)\s+(\d{1,2}),?\s+(\d{4})/i,  // "Saturday, March 15, 2026"
    /(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/,  // "3/15/2026" or "3-15-26"
    /(\w+)\s+(\d{1,2})/i,  // "March 15" (assume current year)
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      const parsed = new Date(match[0]);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  
  return null;
}

/**
 * Sync all parks departments
 */
async function syncAll() {
  console.log('[Parks] Starting parks & rec events sync...');
  let allEvents = [];
  
  for (const dept of PARKS_DEPTS) {
    console.log(`[Parks] Scraping ${dept.name}...`);
    
    const events = await scrapeDept(dept);
    
    console.log(`[Parks] Found ${events.length} events from ${dept.name}`);
    allEvents = allEvents.concat(events);
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }
  
  console.log(`[Parks] Total: ${allEvents.length} parks events found`);
  return allEvents;
}

/**
 * Sync specific city
 */
async function syncCity(cityName) {
  const dept = PARKS_DEPTS.find(d => 
    d.city.toLowerCase() === cityName.toLowerCase()
  );
  
  if (!dept) {
    console.log(`[Parks] No parks dept configured for ${cityName}`);
    return [];
  }
  
  return await scrapeDept(dept);
}

module.exports = {
  syncAll,
  syncCity,
  PARKS_DEPTS,
  scrapeDept,
};
