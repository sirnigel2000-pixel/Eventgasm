const cron = require('node-cron');
const Event = require('../models/Event');
const { pool } = require('../db');

// Import all source integrations
const ticketmaster = require('./ticketmaster');
const seatgeek = require('./seatgeek');
let allevents, bandsintown, libraryEvents, parksAndRec, meetup, communityEvents, eventbrite;

// Dynamic imports for new sources
try {
  allevents = require('./allevents');
} catch (e) {
  console.log('[SyncManager] AllEvents module not available');
}

try {
  bandsintown = require('./bandsintown');
} catch (e) {
  console.log('[SyncManager] Bandsintown module not available');
}

try {
  libraryEvents = require('./libraryEvents');
} catch (e) {
  console.log('[SyncManager] Library Events module not available');
}

try {
  parksAndRec = require('./parksAndRec');
} catch (e) {
  console.log('[SyncManager] Parks & Rec module not available');
}

try {
  meetup = require('./meetup');
} catch (e) {
  console.log('[SyncManager] Meetup module not available');
}

try {
  communityEvents = require('./communityEvents');
} catch (e) {
  console.log('[SyncManager] Community Events module not available');
}

try {
  eventbrite = require('./eventbriteScraper'); // Use scraper instead of API
} catch (e) {
  console.log('[SyncManager] Eventbrite Scraper module not available');
}

let craigslist, residentAdvisor, universityEvents, cityGov;

try {
  craigslist = require('./craigslist');
} catch (e) {
  console.log('[SyncManager] Craigslist module not available');
}

try {
  residentAdvisor = require('./residentAdvisor');
} catch (e) {
  console.log('[SyncManager] Resident Advisor module not available');
}

try {
  universityEvents = require('./universityEvents');
} catch (e) {
  console.log('[SyncManager] University Events module not available');
}

try {
  cityGov = require('./cityGov');
} catch (e) {
  console.log('[SyncManager] City Gov module not available');
}

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
    seatgeek: 0,
    allevents: 0,
    bandsintown: 0,
    library: 0,
    parks: 0,
    meetup: 0,
    community: 0,
    eventbrite: 0,
    craigslist: 0,
    residentAdvisor: 0,
    university: 0,
    cityGov: 0,
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

    // SeatGeek (major metros)
    console.log('[SyncManager] Syncing SeatGeek...');
    try {
      stats.seatgeek = await seatgeek.syncMajorMetros();
      await logSync('seatgeek', 'US-metros', stats.seatgeek, 0, 'success');
    } catch (err) {
      stats.errors.push(`SeatGeek: ${err.message}`);
      await logSync('seatgeek', 'US-metros', 0, 0, 'error', err.message);
    }

    // AllEvents (local/community events - Florida focus)
    if (allevents) {
      console.log('[SyncManager] Syncing AllEvents...');
      try {
        stats.allevents = await allevents.syncAll();
        await logSync('allevents', 'FL', stats.allevents, 0, 'success');
      } catch (err) {
        stats.errors.push(`AllEvents: ${err.message}`);
        await logSync('allevents', 'FL', 0, 0, 'error', err.message);
      }
    }

    // Bandsintown (local music)
    if (bandsintown) {
      console.log('[SyncManager] Syncing Bandsintown...');
      try {
        stats.bandsintown = await bandsintown.syncAll();
        await logSync('bandsintown', 'FL', stats.bandsintown, 0, 'success');
      } catch (err) {
        stats.errors.push(`Bandsintown: ${err.message}`);
        await logSync('bandsintown', 'FL', 0, 0, 'error', err.message);
      }
    }

    // Library Events (FREE community events - nationwide)
    if (libraryEvents) {
      console.log('[SyncManager] Syncing Library Events (nationwide)...');
      try {
        const events = await libraryEvents.syncAll();
        stats.library = events.length;
        for (const event of events) {
          try { await Event.upsert(event); } catch (e) { /* skip dupes */ }
        }
        await logSync('library', 'US', stats.library, 0, 'success');
      } catch (err) {
        stats.errors.push(`Library Events: ${err.message}`);
        await logSync('library', 'US', 0, 0, 'error', err.message);
      }
    }

    // Parks & Recreation Events (FREE community events - nationwide)
    if (parksAndRec) {
      console.log('[SyncManager] Syncing Parks & Rec Events (nationwide)...');
      try {
        const events = await parksAndRec.syncAll();
        stats.parks = events.length;
        for (const event of events) {
          try { await Event.upsert(event); } catch (e) { /* skip dupes */ }
        }
        await logSync('parks', 'US', stats.parks, 0, 'success');
      } catch (err) {
        stats.errors.push(`Parks & Rec: ${err.message}`);
        await logSync('parks', 'US', 0, 0, 'error', err.message);
      }
    }

    // Meetup (niche community events - dog meetups, craft groups, etc)
    if (meetup) {
      console.log('[SyncManager] Syncing Meetup Events...');
      try {
        stats.meetup = await meetup.syncMajorCities();
        await logSync('meetup', 'US', stats.meetup, 0, 'success');
      } catch (err) {
        stats.errors.push(`Meetup: ${err.message}`);
        await logSync('meetup', 'US', 0, 0, 'error', err.message);
      }
    }

    // Community Events (festivals, fairs, cultural events)
    if (communityEvents) {
      console.log('[SyncManager] Syncing Community Events (festivals, fairs)...');
      try {
        stats.community = await communityEvents.syncMajorCities();
        await logSync('community', 'US', stats.community, 0, 'success');
      } catch (err) {
        stats.errors.push(`Community: ${err.message}`);
        await logSync('community', 'US', 0, 0, 'error', err.message);
      }
    }

    // Eventbrite (beer festivals, craft shows, local events) - via scraper
    if (eventbrite) {
      console.log('[SyncManager] Syncing Eventbrite (scraper)...');
      try {
        stats.eventbrite = await eventbrite.syncMajorCities();
        await logSync('eventbrite', 'US', stats.eventbrite, 0, 'success');
      } catch (err) {
        stats.errors.push(`Eventbrite: ${err.message}`);
        await logSync('eventbrite', 'US', 0, 0, 'error', err.message);
      }
    }

    // Craigslist (hyperlocal community events)
    if (craigslist) {
      console.log('[SyncManager] Syncing Craigslist...');
      try {
        stats.craigslist = await craigslist.syncAll();
        await logSync('craigslist', 'US', stats.craigslist, 0, 'success');
      } catch (err) {
        stats.errors.push(`Craigslist: ${err.message}`);
        await logSync('craigslist', 'US', 0, 0, 'error', err.message);
      }
    }

    // Resident Advisor (electronic music / nightlife)
    if (residentAdvisor) {
      console.log('[SyncManager] Syncing Resident Advisor...');
      try {
        stats.residentAdvisor = await residentAdvisor.syncAll();
        await logSync('residentadvisor', 'US', stats.residentAdvisor, 0, 'success');
      } catch (err) {
        stats.errors.push(`Resident Advisor: ${err.message}`);
        await logSync('residentadvisor', 'US', 0, 0, 'error', err.message);
      }
    }

    // University Events (campus events, lectures, concerts)
    if (universityEvents) {
      console.log('[SyncManager] Syncing University Events...');
      try {
        stats.university = await universityEvents.syncAll();
        await logSync('university', 'US', stats.university, 0, 'success');
      } catch (err) {
        stats.errors.push(`University: ${err.message}`);
        await logSync('university', 'US', 0, 0, 'error', err.message);
      }
    }

    // City Government Calendars (official city events)
    if (cityGov) {
      console.log('[SyncManager] Syncing City Government Events...');
      try {
        stats.cityGov = await cityGov.syncAll();
        await logSync('citygov', 'US', stats.cityGov, 0, 'success');
      } catch (err) {
        stats.errors.push(`CityGov: ${err.message}`);
        await logSync('citygov', 'US', 0, 0, 'error', err.message);
      }
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
  const total = stats.ticketmaster + stats.seatgeek + stats.allevents + stats.bandsintown + 
                stats.library + stats.parks + stats.meetup + stats.community + stats.eventbrite +
                stats.craigslist + stats.residentAdvisor + stats.university + stats.cityGov;
  
  console.log(`[SyncManager] Sync complete in ${duration}s`);
  console.log(`  - Ticketmaster: ${stats.ticketmaster}`);
  console.log(`  - SeatGeek: ${stats.seatgeek}`);
  console.log(`  - AllEvents: ${stats.allevents}`);
  console.log(`  - Bandsintown: ${stats.bandsintown}`);
  console.log(`  - Library Events: ${stats.library}`);
  console.log(`  - Parks & Rec: ${stats.parks}`);
  console.log(`  - Meetup: ${stats.meetup}`);
  console.log(`  - Community: ${stats.community}`);
  console.log(`  - Eventbrite: ${stats.eventbrite}`);
  console.log(`  - Craigslist: ${stats.craigslist}`);
  console.log(`  - Resident Advisor: ${stats.residentAdvisor}`);
  console.log(`  - University: ${stats.university}`);
  console.log(`  - City Gov: ${stats.cityGov}`);
  console.log(`  - Total: ${total}`);
  if (stats.errors.length) {
    console.log(`  - Errors: ${stats.errors.join('; ')}`);
  }

  lastSyncTime = new Date();
  lastSyncStats = stats;
  isSyncing = false;

  return stats;
}

// Florida-focused sync - local events
async function runFloridaSync() {
  if (isSyncing) {
    console.log('[SyncManager] Sync already in progress, skipping...');
    return;
  }

  isSyncing = true;
  console.log('[SyncManager] Starting Florida local events sync...');

  const stats = { 
    ticketmaster: 0,
    allevents: 0, 
    bandsintown: 0,
    library: 0,
    parks: 0,
    total: 0 
  };

  try {
    // Ticketmaster Florida only
    console.log('[SyncManager] Syncing Ticketmaster FL...');
    try {
      stats.ticketmaster = await ticketmaster.syncState('FL');
    } catch (err) {
      console.error(`Ticketmaster FL error: ${err.message}`);
    }

    // AllEvents (community events)
    if (allevents) {
      try {
        stats.allevents = await allevents.syncAll();
      } catch (err) {
        console.error(`AllEvents error: ${err.message}`);
      }
    }

    // Bandsintown (local music)
    if (bandsintown) {
      try {
        stats.bandsintown = await bandsintown.syncAll();
      } catch (err) {
        console.error(`Bandsintown error: ${err.message}`);
      }
    }

    // Library Events (FREE community events)
    if (libraryEvents) {
      console.log('[SyncManager] Syncing Library Events...');
      try {
        const events = await libraryEvents.syncAll();
        stats.library = events.length;
        // Upsert library events to database
        for (const event of events) {
          try {
            await Event.upsert(event);
          } catch (e) {
            // Skip duplicates
          }
        }
        await logSync('library', 'FL', stats.library, 0, 'success');
      } catch (err) {
        console.error(`Library Events error: ${err.message}`);
        await logSync('library', 'FL', 0, 0, 'error', err.message);
      }
    }

    // Parks & Recreation Events (FREE community events)
    if (parksAndRec) {
      console.log('[SyncManager] Syncing Parks & Rec Events...');
      try {
        const events = await parksAndRec.syncAll();
        stats.parks = events.length;
        // Upsert parks events to database
        for (const event of events) {
          try {
            await Event.upsert(event);
          } catch (e) {
            // Skip duplicates
          }
        }
        await logSync('parks', 'FL', stats.parks, 0, 'success');
      } catch (err) {
        console.error(`Parks & Rec error: ${err.message}`);
        await logSync('parks', 'FL', 0, 0, 'error', err.message);
      }
    }

    stats.total = stats.ticketmaster + stats.allevents + stats.bandsintown + stats.library + stats.parks;
  } catch (error) {
    console.error('[SyncManager] Florida sync error:', error);
  }

  isSyncing = false;
  console.log(`[SyncManager] Florida sync complete: ${stats.total} events`);
  console.log(`  - Library Events: ${stats.library}`);
  console.log(`  - Parks & Rec: ${stats.parks}`);
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
    // Quick Florida cities from AllEvents
    if (allevents) {
      const quickCities = ['Miami', 'Orlando', 'Tampa'];
      for (const city of quickCities) {
        try {
          const added = await allevents.syncCity(city);
          stats.total += added;
        } catch (err) {
          console.error(`Quick sync error for ${city}: ${err.message}`);
        }
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
  // Full sync every 12 hours
  cron.schedule('0 */12 * * *', () => {
    console.log('[Scheduler] Running scheduled full sync...');
    runFullSync();
  });

  // Florida focus sync every 4 hours
  cron.schedule('0 */4 * * *', () => {
    console.log('[Scheduler] Running scheduled Florida sync...');
    runFloridaSync();
  });

  // Quick sync every hour
  cron.schedule('30 * * * *', () => {
    console.log('[Scheduler] Running scheduled quick sync...');
    runQuickSync();
  });

  console.log('[Scheduler] Sync scheduler started');
  console.log('  - Full sync: every 12 hours');
  console.log('  - Florida sync: every 4 hours');
  console.log('  - Quick sync: every hour at :30');
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
  runFloridaSync,
  runQuickSync,
  startScheduler,
  getStatus
};
