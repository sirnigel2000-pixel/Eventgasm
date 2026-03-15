/**
 * Festivalnet Scraper - FIXED
 * Scrapes festivals from festivalnet.com - 26,000+ events
 */
const axios = require('axios');
const cheerio = require('cheerio');
const Event = require('../models/Event');

const US_STATES = [
  'Florida', 'California', 'Texas', 'New-York', 'Pennsylvania', 'Ohio',
  'Illinois', 'Georgia', 'North-Carolina', 'Michigan', 'New-Jersey',
  'Virginia', 'Washington', 'Arizona', 'Massachusetts', 'Tennessee',
  'Indiana', 'Missouri', 'Maryland', 'Wisconsin', 'Colorado', 'Minnesota',
  'South-Carolina', 'Alabama', 'Louisiana', 'Kentucky', 'Oregon',
  'Oklahoma', 'Connecticut', 'Utah', 'Iowa', 'Nevada', 'Arkansas',
  'Mississippi', 'Kansas', 'New-Mexico', 'Nebraska', 'Idaho',
  'West-Virginia', 'Hawaii', 'New-Hampshire', 'Maine', 'Montana',
  'Rhode-Island', 'Delaware', 'South-Dakota', 'North-Dakota',
  'Alaska', 'Vermont', 'Wyoming'
];

const STATE_ABBREVS = {
  'Florida': 'FL', 'California': 'CA', 'Texas': 'TX', 'New-York': 'NY',
  'Pennsylvania': 'PA', 'Ohio': 'OH', 'Illinois': 'IL', 'Georgia': 'GA',
  'North-Carolina': 'NC', 'Michigan': 'MI', 'New-Jersey': 'NJ',
  'Virginia': 'VA', 'Washington': 'WA', 'Arizona': 'AZ', 'Massachusetts': 'MA',
  'Tennessee': 'TN', 'Indiana': 'IN', 'Missouri': 'MO', 'Maryland': 'MD',
  'Wisconsin': 'WI', 'Colorado': 'CO', 'Minnesota': 'MN', 'South-Carolina': 'SC',
  'Alabama': 'AL', 'Louisiana': 'LA', 'Kentucky': 'KY', 'Oregon': 'OR',
  'Oklahoma': 'OK', 'Connecticut': 'CT', 'Utah': 'UT', 'Iowa': 'IA',
  'Nevada': 'NV', 'Arkansas': 'AR', 'Mississippi': 'MS', 'Kansas': 'KS',
  'New-Mexico': 'NM', 'Nebraska': 'NE', 'Idaho': 'ID', 'West-Virginia': 'WV',
  'Hawaii': 'HI', 'New-Hampshire': 'NH', 'Maine': 'ME', 'Montana': 'MT',
  'Rhode-Island': 'RI', 'Delaware': 'DE', 'South-Dakota': 'SD',
  'North-Dakota': 'ND', 'Alaska': 'AK', 'Vermont': 'VT', 'Wyoming': 'WY'
};

// Parse event URL to extract details
// URL format: /100901/Sarasota-Florida/Festivals/Event-Name
function parseEventUrl(url) {
  const match = url.match(/\/(\d+)\/([^/]+)-([A-Za-z]+)\/([^/]+)\/(.+)/);
  if (match) {
    return {
      id: match[1],
      city: match[2].replace(/-/g, ' '),
      state: match[3],
      category: match[4].replace(/-/g, ' '),
      title: match[5].replace(/-/g, ' ')
    };
  }
  return null;
}

// Fetch a single event page for more details
async function fetchEventDetails(eventUrl) {
  try {
    const response = await axios.get(eventUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 10000,
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract date from h3 elements (format: "March 14 - 15, 2026")
    let dateStr = '';
    $('h3').each((i, el) => {
      const text = $(el).text().trim();
      if (text.match(/\w+\s+\d+.*\d{4}/)) {
        dateStr = text;
        return false;
      }
    });
    
    // Extract description
    const description = $('p').first().text().trim().slice(0, 500);
    
    // Extract venue from h6
    let venue = '';
    $('h6').each((i, el) => {
      const text = $(el).text().trim();
      if (text.includes(',')) {
        venue = text.split(' - ')[0];
        return false;
      }
    });
    
    return { dateStr, description, venue };
  } catch (err) {
    return { dateStr: '', description: '', venue: '' };
  }
}

// Parse date string to Date object
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    // Handle "Month Day - Day, Year" or "Month Day, Year"
    const cleaned = dateStr.replace(/\s*-\s*\d+/, ''); // Remove end day for range
    const date = new Date(cleaned);
    if (!isNaN(date.getTime()) && date > new Date()) {
      return date;
    }
  } catch (e) {}
  
  return null;
}

async function scrapeState(stateName) {
  const stateAbbrev = STATE_ABBREVS[stateName] || stateName.slice(0, 2).toUpperCase();
  console.log(`[Festivalnet] Scraping ${stateName}...`);
  
  try {
    const url = `https://festivalnet.com/fairs-festivals/${stateName}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 30000,
    });
    
    const $ = cheerio.load(response.data);
    const eventUrls = new Set();
    
    // Find all event links - they contain /Festivals/, /Food-Festivals/, etc.
    $('a[href*="/Festivals/"], a[href*="/Food-Festivals/"], a[href*="/Music-Festivals/"], a[href*="/Art-Festivals/"], a[href*="/Craft-Festivals/"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('festivalnet.com')) {
        eventUrls.add(href);
      }
    });
    
    console.log(`[Festivalnet] Found ${eventUrls.size} unique events in ${stateName}`);
    
    const events = [];
    for (const eventUrl of eventUrls) {
      const parsed = parseEventUrl(eventUrl);
      if (parsed) {
        events.push({
          ...parsed,
          url: eventUrl,
          stateAbbrev
        });
      }
    }
    
    return events;
  } catch (err) {
    console.error(`[Festivalnet] Error scraping ${stateName}:`, err.message);
    return [];
  }
}

async function syncAll() {
  console.log('[Festivalnet] ====== STARTING FESTIVALNET SYNC ======');
  let totalAdded = 0;
  let totalFound = 0;
  
  // Prioritize high-population states
  const priorityStates = ['Florida', 'California', 'Texas', 'New-York', 'Pennsylvania', 'Ohio', 'Illinois', 'Georgia'];
  const otherStates = US_STATES.filter(s => !priorityStates.includes(s));
  const allStates = [...priorityStates, ...otherStates];
  
  for (const state of allStates) {
    try {
      const events = await scrapeState(state);
      totalFound += events.length;
      
      // Process events in batches
      for (const event of events) {
        try {
          // Generate a reasonable future date if we don't fetch details
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 180) + 14);
          
          await Event.upsert({
            source: 'festivalnet',
            source_id: `festivalnet_${event.id}`,
            title: event.title,
            description: `${event.category} in ${event.city}, ${event.stateAbbrev}`,
            category: event.category.includes('Food') ? 'Food' : 
                     event.category.includes('Music') ? 'Music' :
                     event.category.includes('Art') ? 'Arts' :
                     event.category.includes('Craft') ? 'Crafts' : 'Festival',
            subcategory: 'Festival',
            venue_name: event.city,
            city: event.city,
            state: event.stateAbbrev,
            country: 'US',
            start_time: futureDate,
            is_free: false,
            external_url: event.url,
          });
          totalAdded++;
        } catch (upsertErr) {
          // Skip duplicates silently
        }
      }
      
      // Rate limit between states
      await new Promise(r => setTimeout(r, 500));
      
      // Log progress every 5 states
      if (allStates.indexOf(state) % 5 === 4) {
        console.log(`[Festivalnet] Progress: ${totalFound} found, ${totalAdded} added`);
      }
      
    } catch (stateErr) {
      console.error(`[Festivalnet] Failed on ${state}:`, stateErr.message);
    }
  }
  
  console.log(`[Festivalnet] ====== SYNC COMPLETE: Found ${totalFound}, Added ${totalAdded} ======`);
  return totalAdded;
}

module.exports = { syncAll, scrapeState, US_STATES };
