/**
 * Scraper Runner - Run all scrapers with monitoring
 * 
 * Features:
 * - Runs all scrapers in sequence
 * - Retry logic
 * - Progress tracking
 * - Error recovery
 */

const { pool } = require('../db');

// Import all scrapers
const scrapers = {
  ticketmaster: () => require('./ticketmasterScraper'),
  seatgeek: () => require('./seatgeekScraper'),
  eventbrite: () => require('./eventbriteScraper'),
  songkick: () => require('./songkickSitemapScraper'),
  vividseats: () => require('./vividSeatsSitemapScraper'),
  stubhub: () => require('./stubhubSitemapScraper'),
  festivalnet: () => require('./festivalnetScraper'),
  theater: () => require('./theaterScraper'),
  sports: () => require('./sportsScraper'),
  comedy: () => require('./comedyScraper'),
  festivals: () => require('./festivalScraper'),
};

// Track run status
let runStatus = {
  running: false,
  startedAt: null,
  currentScraper: null,
  completed: [],
  failed: [],
  eventsAdded: 0,
};

// Run a single scraper with error handling
async function runScraper(name, scraperModule) {
  console.log(`[ScraperRunner] Starting: ${name}`);
  runStatus.currentScraper = name;
  
  const startCount = await getEventCount();
  const startTime = Date.now();
  
  try {
    // Most scrapers have a sync() or scrape() function
    if (typeof scraperModule.sync === 'function') {
      await scraperModule.sync();
    } else if (typeof scraperModule.scrape === 'function') {
      await scraperModule.scrape();
    } else if (typeof scraperModule.run === 'function') {
      await scraperModule.run();
    } else if (typeof scraperModule.default === 'function') {
      await scraperModule.default();
    } else {
      console.log(`[ScraperRunner] ${name}: No sync/scrape/run function found`);
      return { success: false, error: 'No entry function' };
    }
    
    const endCount = await getEventCount();
    const added = endCount - startCount;
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`[ScraperRunner] ✓ ${name}: +${added} events in ${duration}s`);
    
    return { success: true, added, duration };
    
  } catch (e) {
    console.error(`[ScraperRunner] ✗ ${name} failed:`, e.message);
    return { success: false, error: e.message };
  }
}

// Get current event count
async function getEventCount() {
  const result = await pool.query('SELECT COUNT(*) as count FROM events');
  return parseInt(result.rows[0].count);
}

// Run all scrapers
async function runAll(options = {}) {
  if (runStatus.running) {
    return { error: 'Already running', status: runStatus };
  }
  
  const { 
    scraperNames = Object.keys(scrapers), 
    delayBetween = 5000,
    retries = 1 
  } = options;
  
  runStatus = {
    running: true,
    startedAt: new Date().toISOString(),
    currentScraper: null,
    completed: [],
    failed: [],
    eventsAdded: 0,
  };
  
  console.log(`[ScraperRunner] Starting full run: ${scraperNames.length} scrapers`);
  
  for (const name of scraperNames) {
    if (!scrapers[name]) {
      console.log(`[ScraperRunner] Unknown scraper: ${name}`);
      continue;
    }
    
    let result;
    let attempts = 0;
    
    while (attempts <= retries) {
      try {
        const scraperModule = scrapers[name]();
        result = await runScraper(name, scraperModule);
        
        if (result.success) break;
        
      } catch (e) {
        result = { success: false, error: e.message };
      }
      
      attempts++;
      if (attempts <= retries) {
        console.log(`[ScraperRunner] Retrying ${name} (attempt ${attempts + 1})`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    if (result.success) {
      runStatus.completed.push({ name, ...result });
      runStatus.eventsAdded += result.added || 0;
    } else {
      runStatus.failed.push({ name, error: result.error });
    }
    
    // Delay between scrapers to avoid overwhelming APIs
    await new Promise(r => setTimeout(r, delayBetween));
  }
  
  runStatus.running = false;
  runStatus.finishedAt = new Date().toISOString();
  
  console.log(`[ScraperRunner] Complete! ${runStatus.completed.length} succeeded, ${runStatus.failed.length} failed, +${runStatus.eventsAdded} events`);
  
  return runStatus;
}

// Get current status
function getStatus() {
  return runStatus;
}

// Run specific scrapers
async function runSpecific(names) {
  return runAll({ scraperNames: names });
}

module.exports = {
  runAll,
  runSpecific,
  getStatus,
  scrapers: Object.keys(scrapers),
};
