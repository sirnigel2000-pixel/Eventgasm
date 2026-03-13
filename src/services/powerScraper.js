/**
 * POWER SCRAPER - Differentiator Events
 * Sources that competitors DON'T aggregate well
 */

const axios = require('axios');
const cheerio = require('cheerio');
const Event = require('../models/Event');
const { resilientFetch, sleep } = require('../utils/resilientScraper');

// ============================================
// 1. DO512 / LOCAL CITY BLOGS (Austin model)
// ============================================
const CITY_BLOGS = [
  { url: 'https://do512.com/events', city: 'Austin', state: 'TX' },
  { url: 'https://www.thrillist.com/events/miami', city: 'Miami', state: 'FL' },
  { url: 'https://www.timeout.com/miami/things-to-do', city: 'Miami', state: 'FL' },
  { url: 'https://www.timeout.com/newyork/things-to-do', city: 'New York', state: 'NY' },
  { url: 'https://www.timeout.com/los-angeles/things-to-do', city: 'Los Angeles', state: 'CA' },
  { url: 'https://www.timeout.com/chicago/things-to-do', city: 'Chicago', state: 'IL' },
];

// ============================================
// 2. BREWERY/WINERY EVENTS (Untapped market)
// ============================================
const BREWERIES = [
  // Florida
  { name: 'Cigar City Brewing', city: 'Tampa', state: 'FL', url: 'https://cigarcitybrewing.com/events/' },
  { name: 'Funky Buddha', city: 'Oakland Park', state: 'FL', url: 'https://funkybuddhabrewery.com/events/' },
  // Add more breweries per state...
];

// ============================================
// 3. FOOD TRUCK RALLIES / NIGHT MARKETS
// ============================================
async function scrapeFoodTruckEvents() {
  const events = [];
  const sources = [
    'https://streetfoodfinder.com/events',
    'https://roaminghunger.com/events',
  ];

  for (const url of sources) {
    try {
      const response = await resilientFetch(url);
      if (!response?.data) continue;

      const $ = cheerio.load(response.data);
      $('[class*="event"], .event-card, article').each((i, el) => {
        const title = $(el).find('h2, h3, .title').first().text().trim();
        const dateText = $(el).find('.date, time, [class*="date"]').first().text().trim();
        const location = $(el).find('.location, .venue, [class*="location"]').first().text().trim();
        
        if (title && title.length > 5) {
          events.push({
            title,
            dateText,
            location,
            category: 'Food & Drink',
            subcategory: 'Food Truck Rally',
            source: 'foodtruck',
          });
        }
      });
      await sleep(2000);
    } catch (err) {
      console.log(`[PowerScraper] Food truck error: ${err.message}`);
    }
  }
  return events;
}

// ============================================
// 4. TRIVIA NIGHTS (Every bar has them)
// ============================================
async function scrapeTriviaEvents() {
  const events = [];
  const triviaCompanies = [
    'https://www.geekswhodrink.com/schedule',
    'https://www.lastcalltrivia.com/schedule',
    'https://www.triviamafia.com/schedule',
  ];

  for (const url of triviaCompanies) {
    try {
      const response = await resilientFetch(url);
      if (!response?.data) continue;

      const $ = cheerio.load(response.data);
      $('tr, .event, .schedule-item, [class*="venue"]').each((i, el) => {
        const venue = $(el).find('.venue, .name, td:first-child').first().text().trim();
        const day = $(el).find('.day, .time, td:nth-child(2)').first().text().trim();
        const location = $(el).find('.location, .city, td:nth-child(3)').first().text().trim();

        if (venue && venue.length > 3) {
          events.push({
            title: `Trivia Night at ${venue}`,
            day, // "Every Tuesday 7pm"
            location,
            category: 'Nightlife',
            subcategory: 'Trivia',
            source: 'trivia',
            isRecurring: true,
          });
        }
      });
      await sleep(2000);
    } catch (err) {
      console.log(`[PowerScraper] Trivia error: ${err.message}`);
    }
  }
  return events;
}

// ============================================
// 5. OPEN MIC NIGHTS
// ============================================
async function scrapeOpenMics() {
  const events = [];
  const sources = [
    'https://openmikes.org/search',
  ];

  for (const url of sources) {
    try {
      const response = await resilientFetch(url);
      if (!response?.data) continue;

      const $ = cheerio.load(response.data);
      $('.listing, .event, .mic').each((i, el) => {
        const venue = $(el).find('.venue, .name').first().text().trim();
        const type = $(el).find('.type').first().text().trim(); // Comedy, Music, Poetry
        const city = $(el).find('.city').first().text().trim();
        const day = $(el).find('.day, .night').first().text().trim();

        if (venue) {
          events.push({
            title: `Open Mic ${type ? `(${type})` : ''} at ${venue}`,
            day,
            city,
            category: type?.toLowerCase().includes('comedy') ? 'Comedy' : 'Music',
            subcategory: 'Open Mic',
            source: 'openmic',
            isRecurring: true,
          });
        }
      });
      await sleep(2000);
    } catch (err) {
      console.log(`[PowerScraper] Open mic error: ${err.message}`);
    }
  }
  return events;
}

// ============================================
// 6. KARAOKE NIGHTS
// ============================================
const KARAOKE_SEARCH_CITIES = [
  { city: 'Miami', state: 'FL' },
  { city: 'Orlando', state: 'FL' },
  { city: 'Tampa', state: 'FL' },
  { city: 'Austin', state: 'TX' },
  { city: 'Nashville', state: 'TN' },
  { city: 'New York', state: 'NY' },
  { city: 'Los Angeles', state: 'CA' },
  { city: 'Chicago', state: 'IL' },
  { city: 'Atlanta', state: 'GA' },
  { city: 'Denver', state: 'CO' },
];

// ============================================
// 7. DRAG SHOWS / LGBTQ+ EVENTS
// ============================================
async function scrapeLGBTQEvents() {
  const events = [];
  const sources = [
    'https://www.gaycities.com/events/',
  ];

  for (const url of sources) {
    try {
      const response = await resilientFetch(url);
      if (!response?.data) continue;

      const $ = cheerio.load(response.data);
      $('.event, article, .listing').each((i, el) => {
        const title = $(el).find('h2, h3, .title').first().text().trim();
        const venue = $(el).find('.venue').first().text().trim();
        const date = $(el).find('.date, time').first().text().trim();
        const city = $(el).find('.city, .location').first().text().trim();

        if (title) {
          events.push({
            title,
            venue,
            dateText: date,
            city,
            category: 'Nightlife',
            subcategory: 'LGBTQ+',
            source: 'lgbtq',
          });
        }
      });
      await sleep(2000);
    } catch (err) {}
  }
  return events;
}

// ============================================
// 8. FARMERS MARKETS (Weekly recurring)
// ============================================
async function scrapeFarmersMarkets() {
  const events = [];
  
  try {
    // USDA Farmers Market API (free, official)
    const response = await axios.get('https://www.usdalocalfoodportal.com/api/farmersmarket/', {
      params: { apikey: 'demo', state: 'FL' },
      timeout: 15000
    });

    if (response.data?.results) {
      for (const market of response.data.results.slice(0, 200)) {
        events.push({
          title: market.MarketName || market.listing_name,
          venue: market.street || market.location_address,
          city: market.city,
          state: market.State || 'FL',
          schedule: market.Schedule,
          category: 'Food & Drink',
          subcategory: 'Farmers Market',
          source: 'usda',
          isFree: true,
          isRecurring: true,
        });
      }
    }
  } catch (err) {
    console.log(`[PowerScraper] Farmers market error: ${err.message}`);
  }

  return events;
}

// ============================================
// 9. CAR SHOWS / CARS & COFFEE
// ============================================
async function scrapeCarShows() {
  const events = [];
  const sources = [
    'https://www.carshowsusa.com/',
  ];

  for (const url of sources) {
    try {
      const response = await resilientFetch(url);
      if (!response?.data) continue;

      const $ = cheerio.load(response.data);
      $('.event, .show, tr').each((i, el) => {
        const title = $(el).find('.title, .name, td:first-child a').first().text().trim();
        const date = $(el).find('.date, td:nth-child(2)').first().text().trim();
        const location = $(el).find('.location, td:nth-child(3)').first().text().trim();

        if (title && title.length > 5) {
          events.push({
            title,
            dateText: date,
            location,
            category: 'Community',
            subcategory: 'Car Show',
            source: 'carshow',
          });
        }
      });
      await sleep(2000);
    } catch (err) {}
  }
  return events;
}

// ============================================
// 10. RUN/WALK CHARITY EVENTS (5Ks, Marathons)
// ============================================
async function scrapeRunningEvents() {
  const events = [];
  const sources = [
    'https://www.runningintheusa.com/race/list',
    'https://www.running.competitor.com/calendar',
  ];

  for (const url of sources) {
    try {
      const response = await resilientFetch(url);
      if (!response?.data) continue;

      const $ = cheerio.load(response.data);
      $('.race, .event, tr').each((i, el) => {
        const title = $(el).find('.race-name, .title, a').first().text().trim();
        const date = $(el).find('.date, time').first().text().trim();
        const location = $(el).find('.location, .city').first().text().trim();

        if (title && title.length > 5) {
          events.push({
            title,
            dateText: date,
            location,
            category: 'Sports',
            subcategory: 'Running/5K',
            source: 'running',
          });
        }
      });
      await sleep(2000);
    } catch (err) {}
  }
  return events;
}

// ============================================
// MAIN: Run all power scrapers
// ============================================
async function runAllPowerScrapers() {
  console.log('[PowerScraper] Starting differentiator scrape...');
  
  const results = {
    foodTruck: 0,
    trivia: 0,
    openMic: 0,
    lgbtq: 0,
    farmersMarket: 0,
    carShow: 0,
    running: 0,
    total: 0,
  };

  // Food trucks
  console.log('[PowerScraper] Scraping food truck events...');
  const foodTruckEvents = await scrapeFoodTruckEvents();
  results.foodTruck = foodTruckEvents.length;
  
  // Trivia
  console.log('[PowerScraper] Scraping trivia nights...');
  const triviaEvents = await scrapeTriviaEvents();
  results.trivia = triviaEvents.length;

  // Open mics
  console.log('[PowerScraper] Scraping open mics...');
  const openMicEvents = await scrapeOpenMics();
  results.openMic = openMicEvents.length;

  // LGBTQ+
  console.log('[PowerScraper] Scraping LGBTQ+ events...');
  const lgbtqEvents = await scrapeLGBTQEvents();
  results.lgbtq = lgbtqEvents.length;

  // Farmers markets
  console.log('[PowerScraper] Scraping farmers markets...');
  const farmersMarketEvents = await scrapeFarmersMarkets();
  results.farmersMarket = farmersMarketEvents.length;

  // Car shows
  console.log('[PowerScraper] Scraping car shows...');
  const carShowEvents = await scrapeCarShows();
  results.carShow = carShowEvents.length;

  // Running events
  console.log('[PowerScraper] Scraping running events...');
  const runningEvents = await scrapeRunningEvents();
  results.running = runningEvents.length;

  // Combine all
  const allEvents = [
    ...foodTruckEvents,
    ...triviaEvents,
    ...openMicEvents,
    ...lgbtqEvents,
    ...farmersMarketEvents,
    ...carShowEvents,
    ...runningEvents,
  ];

  results.total = allEvents.length;
  console.log(`[PowerScraper] Found ${results.total} differentiator events`);

  // Save to database
  let saved = 0;
  for (const event of allEvents) {
    try {
      // Generate unique ID
      const sourceId = Buffer.from(
        `${event.source}_${event.title}_${event.city || ''}`
      ).toString('base64').substring(0, 32);

      await Event.upsert({
        source: event.source,
        source_id: sourceId,
        title: event.title,
        category: event.category,
        subcategory: event.subcategory,
        venue_name: event.venue,
        city: event.city,
        state: event.state,
        is_free: event.isFree || false,
      });
      saved++;
    } catch (err) {}
  }

  console.log(`[PowerScraper] Saved ${saved} events to database`);
  results.saved = saved;

  return results;
}

module.exports = {
  runAllPowerScrapers,
  scrapeFoodTruckEvents,
  scrapeTriviaEvents,
  scrapeOpenMics,
  scrapeLGBTQEvents,
  scrapeFarmersMarkets,
  scrapeCarShows,
  scrapeRunningEvents,
};
