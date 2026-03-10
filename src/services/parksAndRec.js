/**
 * Florida Parks & Recreation Events Scraper
 * Scrapes free community events from city parks & rec departments
 * Great for: outdoor events, sports, fitness classes, festivals, community gatherings
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Major US city Parks & Recreation departments (Top 30 metros + Florida)
const PARKS_DEPTS = [
  // FLORIDA
  { name: 'Miami Parks & Recreation', city: 'Miami', state: 'FL', url: 'https://www.miamigov.com/Parks-Recreation/Special-Events' },
  { name: 'Orlando Parks & Recreation', city: 'Orlando', state: 'FL', url: 'https://www.orlando.gov/Parks-the-Environment/Community-Programs-Events' },
  { name: 'Tampa Parks & Recreation', city: 'Tampa', state: 'FL', url: 'https://www.tampa.gov/parks-and-recreation/programs/special-events' },
  { name: 'Jacksonville Parks', city: 'Jacksonville', state: 'FL', url: 'https://www.coj.net/departments/parks-and-recreation/recreation-and-community-programming/special-events' },
  { name: 'Fort Lauderdale Parks', city: 'Fort Lauderdale', state: 'FL', url: 'https://www.fortlauderdale.gov/departments/parks-recreation/special-events' },
  { name: 'St. Petersburg Parks', city: 'St Petersburg', state: 'FL', url: 'https://www.stpete.org/recreation_events/index.php' },
  
  // NORTHEAST
  { name: 'NYC Parks', city: 'New York', state: 'NY', url: 'https://www.nycgovparks.org/events' },
  { name: 'Philadelphia Parks & Recreation', city: 'Philadelphia', state: 'PA', url: 'https://www.phila.gov/departments/philadelphia-parks-recreation/events/' },
  { name: 'Boston Parks & Recreation', city: 'Boston', state: 'MA', url: 'https://www.boston.gov/departments/parks-and-recreation' },
  { name: 'DC Parks & Recreation', city: 'Washington', state: 'DC', url: 'https://dpr.dc.gov/page/special-events' },
  
  // MIDWEST
  { name: 'Chicago Park District', city: 'Chicago', state: 'IL', url: 'https://www.chicagoparkdistrict.com/events' },
  { name: 'Detroit Parks & Recreation', city: 'Detroit', state: 'MI', url: 'https://detroitmi.gov/departments/parks-recreation' },
  { name: 'Cleveland Metroparks', city: 'Cleveland', state: 'OH', url: 'https://www.clevelandmetroparks.com/events' },
  { name: 'Columbus Recreation & Parks', city: 'Columbus', state: 'OH', url: 'https://www.columbus.gov/recreationandparks/events/' },
  { name: 'Indy Parks', city: 'Indianapolis', state: 'IN', url: 'https://www.indy.gov/agency/indy-parks-and-recreation' },
  { name: 'Minneapolis Park & Recreation', city: 'Minneapolis', state: 'MN', url: 'https://www.minneapolisparks.org/events/' },
  
  // SOUTH
  { name: 'Houston Parks & Recreation', city: 'Houston', state: 'TX', url: 'https://www.houstontx.gov/parks/parksevents.html' },
  { name: 'Dallas Parks & Recreation', city: 'Dallas', state: 'TX', url: 'https://www.dallasparks.org/Calendar.aspx' },
  { name: 'Austin Parks & Recreation', city: 'Austin', state: 'TX', url: 'https://www.austintexas.gov/department/parks-and-recreation' },
  { name: 'San Antonio Parks & Recreation', city: 'San Antonio', state: 'TX', url: 'https://www.sanantonio.gov/ParksAndRec/News-Events' },
  { name: 'Atlanta Parks & Recreation', city: 'Atlanta', state: 'GA', url: 'https://www.atlantaga.gov/government/departments/parks-recreation' },
  { name: 'Charlotte Parks & Recreation', city: 'Charlotte', state: 'NC', url: 'https://charlottenc.gov/parks/Pages/default.aspx' },
  { name: 'Nashville Parks', city: 'Nashville', state: 'TN', url: 'https://www.nashville.gov/Parks-and-Recreation/Events.aspx' },
  { name: 'New Orleans Parks', city: 'New Orleans', state: 'LA', url: 'https://nola.gov/parks-and-parkways/' },
  
  // WEST
  { name: 'LA Recreation & Parks', city: 'Los Angeles', state: 'CA', url: 'https://www.laparks.org/events' },
  { name: 'SF Recreation & Parks', city: 'San Francisco', state: 'CA', url: 'https://sfrecpark.org/Calendar.aspx' },
  { name: 'San Diego Parks & Recreation', city: 'San Diego', state: 'CA', url: 'https://www.sandiego.gov/park-and-recreation/general-info/news' },
  { name: 'San Jose Parks', city: 'San Jose', state: 'CA', url: 'https://www.sanjoseca.gov/your-government/departments-offices/prns/recreation-community-services/events' },
  { name: 'Phoenix Parks & Recreation', city: 'Phoenix', state: 'AZ', url: 'https://www.phoenix.gov/parks/events' },
  { name: 'Denver Parks & Recreation', city: 'Denver', state: 'CO', url: 'https://www.denvergov.org/Government/Agencies-Departments-Offices/Parks-Recreation' },
  { name: 'Seattle Parks & Recreation', city: 'Seattle', state: 'WA', url: 'https://www.seattle.gov/parks/events-and-activities' },
  { name: 'Portland Parks & Recreation', city: 'Portland', state: 'OR', url: 'https://www.portland.gov/parks/events' },
  { name: 'Las Vegas Parks', city: 'Las Vegas', state: 'NV', url: 'https://www.lasvegasnevada.gov/Government/Departments/Parks-Recreation' },
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
          state: config.state || 'FL',
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
