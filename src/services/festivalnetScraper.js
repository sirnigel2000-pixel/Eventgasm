/**
 * Festivalnet Scraper
 * Scrapes festivals from festivalnet.com - 26,000+ events across US & Canada
 */
const axios = require('axios');
const cheerio = require('cheerio');
const Event = require('../models/Event');

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
  'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming'
];

const STATE_ABBREVS = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY'
};

// Parse date ranges like "March 3 - 31, 2026" or "March 14 - 15, 2026"
function parseDateRange(dateStr) {
  if (!dateStr) return { start: null, end: null };
  
  try {
    // Handle "Month Day - Day, Year" format
    const rangeMatch = dateStr.match(/(\w+)\s+(\d+)\s*-\s*(\d+),\s*(\d{4})/);
    if (rangeMatch) {
      const [, month, startDay, endDay, year] = rangeMatch;
      const startDate = new Date(`${month} ${startDay}, ${year}`);
      const endDate = new Date(`${month} ${endDay}, ${year}`);
      return { start: startDate, end: endDate };
    }
    
    // Handle "Month Day, Year" single date
    const singleMatch = dateStr.match(/(\w+)\s+(\d+),\s*(\d{4})/);
    if (singleMatch) {
      const date = new Date(dateStr);
      return { start: date, end: date };
    }
    
    // Handle "Month Day - Month Day, Year"
    const crossMonthMatch = dateStr.match(/(\w+)\s+(\d+)\s*-\s*(\w+)\s+(\d+),\s*(\d{4})/);
    if (crossMonthMatch) {
      const [, startMonth, startDay, endMonth, endDay, year] = crossMonthMatch;
      const startDate = new Date(`${startMonth} ${startDay}, ${year}`);
      const endDate = new Date(`${endMonth} ${endDay}, ${year}`);
      return { start: startDate, end: endDate };
    }
    
    return { start: null, end: null };
  } catch (e) {
    return { start: null, end: null };
  }
}

// Parse location like "Nathan Benderson Park - Sarasota, FL"
function parseLocation(locationStr) {
  if (!locationStr) return { venue: null, city: null, state: null };
  
  try {
    // Format: "Venue Name - City, ST"
    const match = locationStr.match(/^(.+?)\s*-\s*(.+?),\s*([A-Z]{2})$/);
    if (match) {
      return { venue: match[1].trim(), city: match[2].trim(), state: match[3] };
    }
    
    // Just "City, ST"
    const cityMatch = locationStr.match(/^(.+?),\s*([A-Z]{2})$/);
    if (cityMatch) {
      return { venue: null, city: cityMatch[1].trim(), state: cityMatch[2] };
    }
    
    return { venue: locationStr, city: null, state: null };
  } catch (e) {
    return { venue: locationStr, city: null, state: null };
  }
}

// Determine category from URL or title
function guessCategory(url, title) {
  const lower = (url + ' ' + title).toLowerCase();
  
  if (lower.includes('music') || lower.includes('concert')) return 'Music';
  if (lower.includes('art') || lower.includes('gallery')) return 'Arts';
  if (lower.includes('food') || lower.includes('wine') || lower.includes('beer')) return 'Food';
  if (lower.includes('craft')) return 'Crafts';
  if (lower.includes('holiday') || lower.includes('christmas')) return 'Holiday';
  if (lower.includes('renaissance') || lower.includes('medieval')) return 'Renaissance';
  if (lower.includes('farmers') || lower.includes('market')) return 'Market';
  
  return 'Festival';
}

async function scrapeState(stateName) {
  const stateAbbrev = STATE_ABBREVS[stateName];
  console.log(`[Festivalnet] Scraping ${stateName}...`);
  
  try {
    const url = `https://festivalnet.com/fairs-festivals/${stateName.replace(/\s+/g, '-')}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 30000,
    });
    
    const $ = cheerio.load(response.data);
    const events = [];
    
    // Parse event listings from the page
    // Look for event links and extract data
    $('a[href*="/festivalnet.com/"]').each((i, elem) => {
      const eventUrl = $(elem).attr('href');
      const title = $(elem).text().trim();
      
      // Extract event ID from URL like festivalnet.com/100901/...
      const idMatch = eventUrl && eventUrl.match(/festivalnet\.com\/(\d+)/);
      if (idMatch && title && title.length > 5) {
        events.push({
          id: idMatch[1],
          title,
          url: eventUrl,
        });
      }
    });
    
    // Also look for structured listings
    $('article, .event-card, .festival-item').each((i, elem) => {
      const $elem = $(elem);
      const titleEl = $elem.find('h2 a, h3 a, .title a').first();
      const dateEl = $elem.find('h3, .date, .event-date').first();
      const locationEl = $elem.find('h6, .location, .venue').first();
      const descEl = $elem.find('p, .description').first();
      
      if (titleEl.length) {
        const eventUrl = titleEl.attr('href') || '';
        const idMatch = eventUrl.match(/festivalnet\.com\/(\d+)|\/(\d+)\//);
        
        events.push({
          id: idMatch ? (idMatch[1] || idMatch[2]) : `fn_${stateName}_${i}`,
          title: titleEl.text().trim(),
          url: eventUrl,
          dateStr: dateEl.text().trim(),
          locationStr: locationEl.text().trim(),
          description: descEl.text().trim().slice(0, 500),
        });
      }
    });
    
    console.log(`[Festivalnet] Found ${events.length} events in ${stateName}`);
    return events;
  } catch (err) {
    console.error(`[Festivalnet] Error scraping ${stateName}:`, err.message);
    return [];
  }
}

async function syncAll() {
  console.log('[Festivalnet] ====== STARTING FESTIVALNET SYNC ======');
  let totalAdded = 0;
  
  // Start with high-priority states
  const priorityStates = ['Florida', 'California', 'Texas', 'New York', 'Pennsylvania'];
  const otherStates = US_STATES.filter(s => !priorityStates.includes(s));
  const allStates = [...priorityStates, ...otherStates];
  
  for (const state of allStates) {
    try {
      const events = await scrapeState(state);
      
      for (const event of events) {
        if (!event.title) continue;
        
        const { start, end } = parseDateRange(event.dateStr);
        const { venue, city, state: stateAbbrev } = parseLocation(event.locationStr);
        const category = guessCategory(event.url || '', event.title);
        
        try {
          await Event.upsert({
            source: 'festivalnet',
            source_id: `festivalnet_${event.id}`,
            title: event.title,
            description: event.description || `Festival in ${state}`,
            category: category,
            subcategory: 'Festival',
            venue_name: venue || event.title,
            city: city || state,
            state: stateAbbrev || STATE_ABBREVS[state],
            country: 'US',
            start_time: start,
            end_time: end,
            is_free: false,
            external_url: event.url,
          });
          totalAdded++;
        } catch (upsertErr) {
          // Skip duplicates
        }
      }
      
      // Rate limit: wait between states
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (stateErr) {
      console.error(`[Festivalnet] Failed on ${state}:`, stateErr.message);
    }
  }
  
  console.log(`[Festivalnet] ====== SYNC COMPLETE: +${totalAdded} events ======`);
  return totalAdded;
}

module.exports = { syncAll, scrapeState, US_STATES };
