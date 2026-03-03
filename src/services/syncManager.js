const cron = require('node-cron');
const Event = require('../models/Event');
const { pool } = require('../db');

// Import all source integrations
const ticketmaster = require('./ticketmaster');
const eventbrite = require('./eventbrite');
const seatgeek = require('./seatgeek');

// Track sync status
let isSyncing = false;
let lastSyncTime = null;
let lastSyncStats = {};

// Log sync to database
async function logSync(source, region, added, updated, status, error = null) {
  try {
    await pool.query(`
      INSERT INTO sync_log (source, region, events_added, events_updated, status, error_message)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [source, region, added, updated, status, error]);
  } catch (err) {
    console.error('Failed to log sync:', err.message);
  }
}

// Run full sync across all sources
async function runFullSync() {
  if (isSyncing) {
    console.log('[SyncManager] Sync already in progress, skipping...');
    return;
  }

  isSyncing = true;
  const startTime = Date.now();
  console.log('[SyncManager] Starting full sync...');

  const stats = {
    ticketmaster: 0,
    eventbrite: 0,
    seatgeek: 0,
    errors: []
  };

  try {
    // Ticketmaster (all US states)
    console.log('[SyncManager] Syncing Ticketmaster...');
    try {
      stats.ticketmaster = await ticketmaster.syncAll();
      await logSync('ticketmaster', 'US', stats.ticketmaster, 0, 'success');
    } catch (err) {
      stats.errors.push(`Ticketmaster: ${err.message}`);
      await logSync('ticketmaster', 'US', 0, 0, 'error', err.message);
    }

    // Eventbrite (major cities)
    console.log('[SyncManager] Syncing Eventbrite...');
    try {
      stats.eventbrite = await eventbrite.syncMajorCities();
      await logSync('eventbrite', 'US-cities', stats.eventbrite, 0, 'success');
    } catch (err) {
      stats.errors.push(`Eventbrite: ${err.message}`);
      await logSync('eventbrite', 'US-cities', 0, 0, 'error', err.message);
    }

    // SeatGeek (major metros)
    console.log('[SyncManager] Syncing SeatGeek...');
    try {
      stats.seatgeek = await seatgeek.syncMajorMetros();
      await logSync('seatgeek', 'US-metros', stats.seatgeek, 0, 'success');
    } catch (err) {
      stats.errors.push(`SeatGeek: ${err.message}`);
      await logSync('seatgeek', 'US-metros', 0, 0, 'error', err.message);
    }

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
  const total = stats.ticketmaster + stats.eventbrite + stats.seatgeek;
  
  console.log(`[SyncManager] Sync complete in ${duration}s`);
  console.log(`  - Ticketmaster: ${stats.ticketmaster}`);
  console.log(`  - Eventbrite: ${stats.eventbrite}`);
  console.log(`  - SeatGeek: ${stats.seatgeek}`);
  console.log(`  - Total: ${total}`);
  if (stats.errors.length) {
    console.log(`  - Errors: ${stats.errors.join('; ')}`);
  }

  lastSyncTime = new Date();
  lastSyncStats = stats;
  isSyncing = false;

  return stats;
}

// Quick sync - just trending/major metros
async function runQuickSync() {
  if (isSyncing) {
    console.log('[SyncManager] Sync already in progress, skipping...');
    return;
  }

  isSyncing = true;
  console.log('[SyncManager] Starting quick sync...');

  const stats = { total: 0 };

  try {
    // Just sync a few major cities quickly
    const quickCities = [
      { city: 'New York', state: 'NY' },
      { city: 'Los Angeles', state: 'CA' },
      { city: 'Chicago', state: 'IL' },
      { city: 'Philadelphia', state: 'PA' }
    ];

    for (const { city, state } of quickCities) {
      try {
        const added = await eventbrite.syncCity(city, state);
        stats.total += added;
      } catch (err) {
        console.error(`Quick sync error for ${city}: ${err.message}`);
      }
    }
  } catch (error) {
    console.error('[SyncManager] Quick sync error:', error);
  }

  isSyncing = false;
  return stats;
}

// Schedule automatic syncs
function startScheduler() {
  // Full sync every 6 hours
  cron.schedule('0 */6 * * *', () => {
    console.log('[Scheduler] Running scheduled full sync...');
    runFullSync();
  });

  // Quick sync every hour
  cron.schedule('30 * * * *', () => {
    console.log('[Scheduler] Running scheduled quick sync...');
    runQuickSync();
  });

  console.log('[Scheduler] Sync scheduler started');
  console.log('  - Full sync: every 6 hours (0 */6 * * *)');
  console.log('  - Quick sync: every hour at :30 (30 * * * *)');
}

// Get sync status
function getStatus() {
  return {
    isSyncing,
    lastSyncTime,
    lastSyncStats
  };
}

module.exports = {
  runFullSync,
  runQuickSync,
  startScheduler,
  getStatus
};
