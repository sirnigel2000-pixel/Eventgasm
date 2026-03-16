/**
 * Scraper Runner - Run all scrapers with monitoring
 */

const { pool } = require('../db');

// Import all scrapers with correct paths and functions
const scrapers = {
  eventbrite: { 
    load: () => require('./eventbriteScraper'), 
    fn: 'syncAll' 
  },
  eventbriteSitemap: { 
    load: () => require('./eventbriteSitemapScraper'), 
    fn: 'syncAll' 
  },
  songkick: { 
    load: () => require('./songkickSitemapScraper'), 
    fn: 'syncAll' 
  },
  vividseats: { 
    load: () => require('./vividSeatsSitemapScraper'), 
    fn: 'syncAll' 
  },
  festivalnet: { 
    load: () => require('./festivalnetScraper'), 
    fn: 'syncAll' 
  },
  theater: { 
    load: () => require('./theaterScraper'), 
    fn: 'syncAll' 
  },
  sports: { 
    load: () => require('./sportsScraper'), 
    fn: 'syncAll' 
  },
  comedy: { 
    load: () => require('./comedyScraper'), 
    fn: 'syncAll' 
  },
  festivals: { 
    load: () => require('./festivalScraper'), 
    fn: 'syncAll' 
  },
  citydata: { 
    load: () => require('./cityDataScraper'), 
    fn: 'syncAll' 
  },
  concert: { 
    load: () => require('./concertScraper'), 
    fn: 'syncAll' 
  },
  axs: { 
    load: () => require('./axsSitemapScraper'), 
    fn: 'scrape' 
  },
  stubhub: { 
    load: () => require('./stubhubSitemapScraper'), 
    fn: 'scrape' 
  },
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

// Get current event count
async function getEventCount() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM events');
    return parseInt(result.rows[0].count);
  } catch (e) {
    return 0;
  }
}

// Run a single scraper with error handling
async function runScraper(name, config) {
  console.log(`[ScraperRunner] Starting: ${name}`);
  runStatus.currentScraper = name;
  
  const startCount = await getEventCount();
  const startTime = Date.now();
  
  try {
    const scraperModule = config.load();
    const fn = scraperModule[config.fn];
    
    if (typeof fn !== 'function') {
      throw new Error(`Function ${config.fn} not found in ${name}`);
    }
    
    await fn();
    
    const endCount = await getEventCount();
    const added = endCount - startCount;
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`[ScraperRunner] ✓ ${name}: +${added} events in ${duration}s`);
    return { success: true, added, duration };
    
  } catch (e) {
    console.error(`[ScraperRunner] ✗ ${name}:`, e.message);
    return { success: false, error: e.message };
  }
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
      runStatus.failed.push({ name, error: 'Unknown scraper' });
      continue;
    }
    
    let result;
    let attempts = 0;
    
    while (attempts <= retries) {
      result = await runScraper(name, scrapers[name]);
      if (result.success) break;
      
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
    
    // Delay between scrapers
    await new Promise(r => setTimeout(r, delayBetween));
  }
  
  runStatus.running = false;
  runStatus.finishedAt = new Date().toISOString();
  runStatus.currentScraper = null;
  
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
