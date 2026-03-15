const cron = require('node-cron');
const Event = require('../models/Event');
const { pool } = require('../db');

// Import all source integrations
const ticketmaster = require('./ticketmaster');
const seatgeek = require('./seatgeek');

// Dynamic imports with error handling
const safeRequire = (path, name) => {
  try {
    return require(path);
  } catch (e) {
    console.log(`[SyncManager] ${name} module not available`);
    return null;
  }
};

const allevents = safeRequire('./allevents', 'AllEvents');
const bandsintown = safeRequire('./bandsintown', 'Bandsintown');
const libraryEvents = safeRequire('./libraryEvents', 'Library Events');
const parksAndRec = safeRequire('./parksAndRec', 'Parks & Rec');
const meetup = safeRequire('./meetup', 'Meetup');
const communityEvents = safeRequire('./communityEvents', 'Community Events');
const eventbrite = safeRequire('./eventbriteScraper', 'Eventbrite');
const craigslist = safeRequire('./craigslist', 'Craigslist');
const residentAdvisor = safeRequire('./residentAdvisor', 'Resident Advisor');
const universityEvents = safeRequire('./universityEvents', 'University Events');
const cityGov = safeRequire('./cityGov', 'City Gov');
const ruralEvents = safeRequire('./ruralEvents', 'Rural Events');
const sportsScraper = safeRequire('./sportsScraper', 'Sports');
const cityDataScraper = safeRequire('./cityDataScraper', 'City Data');
const festivalScraper = safeRequire('./festivalScraper', 'Festival');
const theaterScraper = safeRequire('./theaterScraper', 'Theater');
const concertScraper = safeRequire('./concertScraper', 'Concert');
const festivalnetScraper = safeRequire('./festivalnetScraper', 'Festivalnet');
const newsScraper = safeRequire('./newsScraper', 'News');
const venueScraper = safeRequire('./venueScraper', 'Venue');
const stubhubSitemap = safeRequire('./stubhubSitemapScraper', 'StubHub Sitemap');
const axsSitemap = safeRequire('./axsSitemapScraper', 'AXS Sitemap');

// Track sync status
let isSyncing = false;
let lastSyncTime = null;
let lastSyncStats = {};

// Track scraper performance (events added per run)
let scraperYield = {};

// Log sync to database
async function logSync(source, region, added, updated, status, error = null) {
  try {
    await pool.query(`
      INSERT INTO sync_log (source, region, events_added, events_updated, status, error_message)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [source, region, added, updated, status, error]);
    
    // Track yield for optimization
    scraperYield[source] = scraperYield[source] || [];
    scraperYield[source].push(added);
    if (scraperYield[source].length > 10) scraperYield[source].shift();
  } catch (err) {
    console.error('Failed to log sync:', err.message);
  }
}

// Check if a scraper is "tapped out" (low recent yield)
function isTappedOut(source) {
  const yields = scraperYield[source];
  if (!yields || yields.length < 3) return false;
  const avgYield = yields.slice(-3).reduce((a, b) => a + b, 0) / 3;
  return avgYield < 5; // Less than 5 events avg over last 3 runs
}

// Run a single scraper with error handling
async function runScraper(name, syncFn, region = 'US') {
  if (!syncFn) return 0;
  
  const tapped = isTappedOut(name);
  if (tapped) {
    console.log(`[SyncManager] Skipping ${name} (tapped out - low recent yield)`);
    return 0;
  }
  
  console.log(`[SyncManager] Syncing ${name}...`);
  try {
    const result = await syncFn();
    const added = typeof result === 'number' ? result : (Array.isArray(result) ? result.length : 0);
    await logSync(name, region, added, 0, 'success');
    console.log(`[SyncManager] ${name}: +${added} events`);
    return added;
  } catch (err) {
    console.error(`[SyncManager] ${name} error: ${err.message}`);
    await logSync(name, region, 0, 0, 'error', err.message);
    return 0;
  }
}

// Run multiple scrapers in parallel (with limit)
async function runParallel(scrapers, limit = 3) {
  const results = {};
  
  for (let i = 0; i < scrapers.length; i += limit) {
    const batch = scrapers.slice(i, i + limit);
    const batchResults = await Promise.all(
      batch.map(async ({ name, fn, region }) => {
        const count = await runScraper(name, fn, region);
        return { name, count };
      })
    );
    batchResults.forEach(r => results[r.name] = r.count);
  }
  
  return results;
}

// Run full sync across all sources - OPTIMIZED
async function runFullSync() {
  if (isSyncing) {
    console.log('[SyncManager] Sync already in progress, skipping...');
    return;
  }

  isSyncing = true;
  const startTime = Date.now();
  console.log('[SyncManager] ========== STARTING OPTIMIZED FULL SYNC ==========');

  const stats = { errors: [] };

  try {
    // TIER 1: HIGH-YIELD SOURCES (run first, these have the most untapped events)
    console.log('\n[SyncManager] === TIER 1: HIGH-YIELD SOURCES ===');
    
    // These are proven high-volume sources
    stats.ticketmaster = await runScraper('ticketmaster', () => ticketmaster.syncAll());
    stats.seatgeek = await runScraper('seatgeek', () => seatgeek.syncMajorMetros());
    
    // NEW SOURCES - potentially huge untapped pools
    stats.festivalnet = await runScraper('festivalnet', festivalnetScraper?.syncAll);
    stats.venues = await runScraper('venues', venueScraper?.syncAll);
    stats.news = await runScraper('news', newsScraper?.syncAll);
    stats.concert = await runScraper('concert', concertScraper?.syncAll);
    stats.stubhub = await runScraper('stubhub', stubhubSitemap?.scrape);
    stats.axs = await runScraper('axs', axsSitemap?.scrape);

    // TIER 2: MEDIUM-YIELD SOURCES (run in parallel batches of 3)
    console.log('\n[SyncManager] === TIER 2: MEDIUM-YIELD SOURCES ===');
    
    const tier2Results = await runParallel([
      { name: 'eventbrite', fn: eventbrite?.syncMajorCities },
      { name: 'allevents', fn: allevents?.syncAll },
      { name: 'bandsintown', fn: bandsintown?.syncAll },
      { name: 'sports', fn: sportsScraper?.syncAll },
      { name: 'theater', fn: theaterScraper?.syncAll },
      { name: 'festivals', fn: festivalScraper?.syncAll },
    ], 3);
    Object.assign(stats, tier2Results);

    // TIER 3: COMMUNITY SOURCES (smaller but consistent)
    console.log('\n[SyncManager] === TIER 3: COMMUNITY SOURCES ===');
    
    const tier3Results = await runParallel([
      { name: 'library', fn: async () => {
        if (!libraryEvents) return 0;
        const events = await libraryEvents.syncAll();
        for (const e of events) { try { await Event.upsert(e); } catch {} }
        return events.length;
      }},
      { name: 'parks', fn: async () => {
        if (!parksAndRec) return 0;
        const events = await parksAndRec.syncAll();
        for (const e of events) { try { await Event.upsert(e); } catch {} }
        return events.length;
      }},
      { name: 'community', fn: communityEvents?.syncMajorCities },
      { name: 'cityGov', fn: cityGov?.syncAll },
      { name: 'university', fn: universityEvents?.syncAll },
      { name: 'rural', fn: ruralEvents?.syncAll },
    ], 3);
    Object.assign(stats, tier3Results);

    // TIER 4: EXPERIMENTAL/UNRELIABLE (skip if tapped out)
    console.log('\n[SyncManager] === TIER 4: EXPERIMENTAL SOURCES ===');
    
    stats.cityData = await runScraper('cityData', cityDataScraper?.syncAll);
    stats.residentAdvisor = await runScraper('residentAdvisor', residentAdvisor?.syncAll);
    stats.meetup = await runScraper('meetup', meetup?.syncMajorCities);
    stats.craigslist = await runScraper('craigslist', craigslist?.syncAll);

  } catch (error) {
    console.error('[SyncManager] Fatal sync error:', error);
    stats.errors.push(`Fatal: ${error.message}`);
  }

  // Cleanup old events
  try {
    const deleted = await Event.deleteOldEvents(7);
    console.log(`[SyncManager] Cleaned up ${deleted} old events`);
  } catch (err) {
    console.error('[SyncManager] Cleanup error:', err.message);
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  const total = Object.values(stats).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
  
  console.log('\n[SyncManager] ========== SYNC COMPLETE ==========');
  console.log(`Duration: ${duration}s | Total added: ${total}`);
  console.log('\nBreakdown:');
  Object.entries(stats).forEach(([k, v]) => {
    if (typeof v === 'number' && v > 0) console.log(`  ${k}: +${v}`);
  });
  if (stats.errors?.length) {
    console.log(`\nErrors: ${stats.errors.join('; ')}`);
  }

  lastSyncTime = new Date();
  lastSyncStats = stats;
  isSyncing = false;

  return stats;
}

// Florida-focused sync
async function runFloridaSync() {
  if (isSyncing) return;
  isSyncing = true;
  console.log('[SyncManager] Starting Florida sync...');

  const stats = { total: 0 };
  try {
    stats.ticketmaster = await runScraper('ticketmaster-fl', () => ticketmaster.syncState('FL'));
    stats.allevents = await runScraper('allevents-fl', allevents?.syncAll);
    stats.bandsintown = await runScraper('bandsintown-fl', bandsintown?.syncAll);
    stats.total = (stats.ticketmaster || 0) + (stats.allevents || 0) + (stats.bandsintown || 0);
  } catch (error) {
    console.error('[SyncManager] Florida sync error:', error);
  }

  isSyncing = false;
  console.log(`[SyncManager] Florida sync complete: ${stats.total} events`);
  return stats;
}

// Quick sync
async function runQuickSync() {
  if (isSyncing) return;
  isSyncing = true;
  console.log('[SyncManager] Starting quick sync...');

  let total = 0;
  try {
    if (allevents) {
      for (const city of ['Miami', 'Orlando', 'Tampa']) {
        total += await allevents.syncCity(city).catch(() => 0);
      }
    }
  } catch (error) {
    console.error('[SyncManager] Quick sync error:', error);
  }

  isSyncing = false;
  return { total };
}

// Schedule automatic syncs
function startScheduler() {
  cron.schedule('0 */12 * * *', () => runFullSync());
  cron.schedule('0 */4 * * *', () => runFloridaSync());
  cron.schedule('30 * * * *', () => runQuickSync());
  console.log('[Scheduler] Started - Full: 12h, FL: 4h, Quick: 1h');
}

function getStatus() {
  return { isSyncing, lastSyncTime, lastSyncStats, scraperYield };
}

module.exports = {
  runFullSync,
  runFloridaSync,
  runQuickSync,
  startScheduler,
  getStatus
};
