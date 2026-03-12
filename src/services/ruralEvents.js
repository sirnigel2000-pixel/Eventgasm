const axios = require('axios');
const cheerio = require('cheerio');
const Event = require('../models/Event');

// State fairs - EVERY state has one, huge draw
const STATE_FAIRS = [
  { name: 'Florida State Fair', city: 'Tampa', state: 'FL', month: 2 },
  { name: 'Texas State Fair', city: 'Dallas', state: 'TX', month: 9 },
  { name: 'California State Fair', city: 'Sacramento', state: 'CA', month: 7 },
  { name: 'New York State Fair', city: 'Syracuse', state: 'NY', month: 8 },
  { name: 'Ohio State Fair', city: 'Columbus', state: 'OH', month: 7 },
  { name: 'Minnesota State Fair', city: 'St. Paul', state: 'MN', month: 8 },
  { name: 'Iowa State Fair', city: 'Des Moines', state: 'IA', month: 8 },
  { name: 'Wisconsin State Fair', city: 'West Allis', state: 'WI', month: 8 },
  { name: 'Arizona State Fair', city: 'Phoenix', state: 'AZ', month: 10 },
  { name: 'North Carolina State Fair', city: 'Raleigh', state: 'NC', month: 10 },
  { name: 'Georgia State Fair', city: 'Perry', state: 'GA', month: 9 },
  { name: 'Indiana State Fair', city: 'Indianapolis', state: 'IN', month: 8 },
  { name: 'Illinois State Fair', city: 'Springfield', state: 'IL', month: 8 },
  { name: 'Michigan State Fair', city: 'Novi', state: 'MI', month: 9 },
  { name: 'Tennessee State Fair', city: 'Nashville', state: 'TN', month: 9 },
  { name: 'Kentucky State Fair', city: 'Louisville', state: 'KY', month: 8 },
  { name: 'Oklahoma State Fair', city: 'Oklahoma City', state: 'OK', month: 9 },
  { name: 'Colorado State Fair', city: 'Pueblo', state: 'CO', month: 8 },
  { name: 'Oregon State Fair', city: 'Salem', state: 'OR', month: 8 },
  { name: 'Washington State Fair', city: 'Puyallup', state: 'WA', month: 9 },
  { name: 'Louisiana State Fair', city: 'Shreveport', state: 'LA', month: 10 },
  { name: 'Alabama State Fair', city: 'Birmingham', state: 'AL', month: 10 },
  { name: 'South Carolina State Fair', city: 'Columbia', state: 'SC', month: 10 },
  { name: 'Virginia State Fair', city: 'Doswell', state: 'VA', month: 9 },
  { name: 'Maryland State Fair', city: 'Timonium', state: 'MD', month: 8 },
];

// County fair aggregator URLs
const COUNTY_FAIR_SOURCES = [
  'https://www.countyfairgrounds.net',
  'https://www.fairsandfestivals.net',
];

// Rodeos - big in rural America
const RODEO_CIRCUITS = [
  { name: 'Professional Rodeo Cowboys Association', url: 'https://www.prorodeo.com/schedule' },
  { name: 'Professional Bull Riders', url: 'https://www.pbr.com/events' },
];

// Farm/Agricultural events
async function scrapeFarmEvents() {
  const events = [];
  
  // Try farmers market directories
  const sources = [
    'https://www.ams.usda.gov/local-food-directories/farmersmarkets',
    'https://www.localharvest.org/farmers-markets/',
  ];

  for (const url of sources) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
      });
      const $ = cheerio.load(response.data);
      
      $('[class*="market"], [class*="event"], .listing').slice(0, 50).each((i, el) => {
        const title = $(el).find('h2, h3, h4, .title, a').first().text().trim();
        const location = $(el).find('.location, .address').first().text().trim();
        if (title && title.length > 3) {
          events.push({ title, location, category: 'Food & Drink', subcategory: 'Farmers Market' });
        }
      });
    } catch (err) {}
  }

  return events;
}

// Scrape fairs and festivals aggregator
async function scrapeFairsAndFestivals(state) {
  const events = [];
  const url = `https://www.fairsandfestivals.net/states/${state.toLowerCase()}/`;

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);

    $('.event-listing, .fair-listing, article, .listing').each((i, el) => {
      const $el = $(el);
      const title = $el.find('h2, h3, h4, .title, a').first().text().trim();
      const dateText = $el.find('.date, time').first().text().trim();
      const location = $el.find('.location, .venue').first().text().trim();
      const link = $el.find('a').first().attr('href');

      if (title && title.length > 3) {
        events.push({
          title,
          dateText,
          location,
          link,
          state,
          category: 'Festivals',
          subcategory: 'Fair/Festival'
        });
      }
    });
  } catch (err) {
    console.log(`[RuralEvents] Error scraping fairs for ${state}: ${err.message}`);
  }

  return events;
}

// Generate state fair events
function generateStateFairEvents() {
  const events = [];
  const currentYear = new Date().getFullYear();

  for (const fair of STATE_FAIRS) {
    // Create event for this year and next
    for (const year of [currentYear, currentYear + 1]) {
      const startDate = new Date(year, fair.month - 1, 15); // Approximate middle of month
      
      if (startDate > new Date()) {
        events.push({
          source: 'statefair',
          source_id: `sf_${fair.state}_${year}`,
          title: fair.name,
          description: `Annual ${fair.name} - one of the largest events in ${fair.state}! Rides, food, livestock, concerts, and more.`,
          category: 'Festivals',
          subcategory: 'State Fair',
          venue_name: `${fair.name} Grounds`,
          city: fair.city,
          state: fair.state,
          country: 'US',
          start_time: startDate.toISOString(),
          is_free: false,
          price_min: 10,
          price_max: 25,
        });
      }
    }
  }

  return events;
}

// Sync state fairs
async function syncStateFairs() {
  console.log('[RuralEvents] Syncing state fairs...');
  const events = generateStateFairEvents();
  let added = 0;

  for (const event of events) {
    try {
      await Event.upsert(event);
      added++;
    } catch (err) {}
  }

  console.log(`[RuralEvents] State fairs: ${added} events`);
  return added;
}

// Sync fairs by state
async function syncFairsByState(state) {
  console.log(`[RuralEvents] Syncing fairs for ${state}...`);
  const rawEvents = await scrapeFairsAndFestivals(state);
  let added = 0;

  for (const raw of rawEvents) {
    try {
      const eventData = {
        source: 'fairsfestivals',
        source_id: `ff_${Buffer.from(raw.title + raw.state).toString('base64').substring(0, 24)}`,
        title: raw.title,
        category: raw.category,
        subcategory: raw.subcategory,
        state: raw.state,
        country: 'US',
        ticket_url: raw.link,
        is_free: raw.title.toLowerCase().includes('free'),
      };

      // Only add if we can parse a date
      if (raw.dateText) {
        try {
          const date = new Date(raw.dateText);
          if (!isNaN(date) && date > new Date()) {
            eventData.start_time = date.toISOString();
            await Event.upsert(eventData);
            added++;
          }
        } catch {}
      }
    } catch (err) {}
  }

  console.log(`[RuralEvents] ${state} fairs: ${added} events`);
  return added;
}

// Sync all rural-focused events
async function syncAll() {
  let total = 0;

  // State fairs (guaranteed events)
  total += await syncStateFairs();

  // Fairs by state for major rural states
  const ruralStates = ['FL', 'TX', 'GA', 'NC', 'TN', 'AL', 'SC', 'LA', 'OK', 'AR', 'MS', 'KY', 'WV', 'VA', 'OH', 'IN', 'IA', 'MO', 'KS', 'NE'];
  
  for (const state of ruralStates) {
    total += await syncFairsByState(state);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`[RuralEvents] Total: ${total} events`);
  return total;
}

module.exports = { syncStateFairs, syncFairsByState, syncAll };
