const express = require('express');
const router = express.Router();
const syncManager = require('../services/syncManager');
const { pool } = require('../db');

// Simple auth middleware (use a real auth system in production)
const AUTH_TOKEN = process.env.ADMIN_TOKEN || 'eventgasm-admin';

function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /admin/status - Sync status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const status = syncManager.getStatus();
    
    // Get event counts
    const countResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN start_time >= NOW() THEN 1 END) as upcoming,
        COUNT(DISTINCT source) as sources,
        COUNT(DISTINCT category) as categories,
        COUNT(CASE WHEN is_free = true AND start_time >= NOW() THEN 1 END) as free_events
      FROM events
    `);

    // Get counts by source
    const sourceResult = await pool.query(`
      SELECT source, COUNT(*) as count 
      FROM events 
      WHERE start_time >= NOW()
      GROUP BY source
    `);

    // Get recent sync logs
    const logsResult = await pool.query(`
      SELECT * FROM sync_log 
      ORDER BY last_sync DESC 
      LIMIT 10
    `);

    res.json({
      sync: status,
      events: countResult.rows[0],
      bySource: sourceResult.rows,
      recentSyncs: logsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/sync/full - Trigger full sync
router.post('/sync/full', authMiddleware, async (req, res) => {
  const status = syncManager.getStatus();
  if (status.isSyncing) {
    return res.status(409).json({ error: 'Sync already in progress' });
  }

  // Start sync in background
  syncManager.runFullSync();
  res.json({ message: 'Full sync started', status: 'running' });
});

// POST /admin/sync/quick - Trigger quick sync
router.post('/sync/quick', authMiddleware, async (req, res) => {
  const status = syncManager.getStatus();
  if (status.isSyncing) {
    return res.status(409).json({ error: 'Sync already in progress' });
  }

  // Start sync in background
  syncManager.runQuickSync();
  res.json({ message: 'Quick sync started', status: 'running' });
});

// DELETE /admin/events/cleanup - Remove test/junk events
router.delete('/events/cleanup', authMiddleware, async (req, res) => {
  try {
    // Delete events with test-like titles
    const result = await pool.query(`
      DELETE FROM events 
      WHERE LOWER(title) LIKE '%test%'
         OR LOWER(title) LIKE '%copy event%'
         OR LOWER(title) LIKE '%placeholder%'
         OR LOWER(title) LIKE '%sample%'
      RETURNING id, title
    `);
    
    res.json({ 
      message: 'Cleaned up test events',
      eventsDeleted: result.rowCount,
      deleted: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/fix-free-flags - Fix incorrectly marked free events
router.post('/fix-free-flags', authMiddleware, async (req, res) => {
  try {
    // Reset is_free to false for Ticketmaster events that have null prices
    // (They should only be free if explicitly marked)
    const result = await pool.query(`
      UPDATE events 
      SET is_free = false 
      WHERE source = 'ticketmaster' 
        AND is_free = true 
        AND price_min IS NULL 
        AND price_max IS NULL
      RETURNING id
    `);
    
    res.json({ 
      message: 'Fixed free flags',
      eventsUpdated: result.rowCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/sync/florida - Trigger Florida-focused sync (local events)
router.post('/sync/florida', authMiddleware, async (req, res) => {
  const status = syncManager.getStatus();
  if (status.isSyncing) {
    return res.status(409).json({ error: 'Sync already in progress' });
  }

  // Start Florida sync in background
  if (syncManager.runFloridaSync) {
    syncManager.runFloridaSync();
    res.json({ message: 'Florida local events sync started', status: 'running' });
  } else {
    res.status(501).json({ error: 'Florida sync not available' });
  }
});

// GET /admin/events/stats - Detailed event statistics
router.get('/events/stats', authMiddleware, async (req, res) => {
  try {
    // Events by category
    const categoryStats = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM events 
      WHERE start_time >= NOW()
      GROUP BY category 
      ORDER BY count DESC
    `);

    // Events by state
    const stateStats = await pool.query(`
      SELECT state, COUNT(*) as count 
      FROM events 
      WHERE start_time >= NOW() AND state IS NOT NULL
      GROUP BY state 
      ORDER BY count DESC
      LIMIT 20
    `);

    // Events by date (next 30 days)
    const dateStats = await pool.query(`
      SELECT DATE(start_time) as date, COUNT(*) as count
      FROM events
      WHERE start_time >= NOW() AND start_time < NOW() + INTERVAL '30 days'
      GROUP BY DATE(start_time)
      ORDER BY date
    `);

    // Free events count
    const freeStats = await pool.query(`
      SELECT COUNT(*) as count
      FROM events
      WHERE start_time >= NOW() AND is_free = true
    `);

    res.json({
      byCategory: categoryStats.rows,
      byState: stateStats.rows,
      byDate: dateStats.rows,
      freeEvents: freeStats.rows[0]?.count || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/events/mark-free - Mark events as free based on patterns
router.post('/events/mark-free', authMiddleware, async (req, res) => {
  try {
    // Mark events as free if they have no price or price is 0
    const result = await pool.query(`
      UPDATE events 
      SET is_free = true 
      WHERE (price_min IS NULL OR price_min = 0) 
        AND (price_max IS NULL OR price_max = 0)
        AND is_free = false
        AND start_time >= NOW()
      RETURNING id
    `);

    res.json({ 
      message: 'Events marked as free',
      count: result.rowCount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// POST /admin/sync/festivalnet - Run ONLY Festivalnet scraper
router.post('/sync/festivalnet', authMiddleware, async (req, res) => {
  try {
    const festivalnetScraper = require('../services/festivalnetScraper');
    
    res.json({ message: 'Festivalnet sync started', status: 'running' });
    
    // Run async
    festivalnetScraper.syncAll()
      .then(count => console.log(`[Admin] Festivalnet sync complete: +${count}`))
      .catch(err => console.error('[Admin] Festivalnet sync error:', err.message));
      
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/sync/eventbrite-sitemap - Run Eventbrite sitemap scraper (350K potential!)
router.post('/sync/eventbrite-sitemap', authMiddleware, async (req, res) => {
  try {
    const eventbriteSitemap = require('../services/eventbriteSitemapScraper');
    res.json({ message: 'Eventbrite sitemap sync started', status: 'running' });
    
    eventbriteSitemap.syncAll()
      .then(count => console.log(`[Admin] Eventbrite sitemap sync complete: +${count}`))
      .catch(err => console.error('[Admin] Eventbrite sitemap sync error:', err.message));
      
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/sync/vividseats-sitemap - Run Vivid Seats sitemap scraper
router.post('/sync/vividseats-sitemap', authMiddleware, async (req, res) => {
  try {
    const vividSeatsSitemap = require('../services/vividSeatsSitemapScraper');
    res.json({ message: 'Vivid Seats sitemap sync started', status: 'running' });
    vividSeatsSitemap.syncAll()
      .then(count => console.log(`[Admin] Vivid Seats sitemap sync complete: +${count}`))
      .catch(err => console.error('[Admin] Vivid Seats sitemap sync error:', err.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/sync/songkick-sitemap - Run Songkick sitemap scraper
router.post('/sync/songkick-sitemap', authMiddleware, async (req, res) => {
  try {
    const songkickSitemap = require('../services/songkickSitemapScraper');
    res.json({ message: 'Songkick sitemap sync started', status: 'running' });
    songkickSitemap.syncAll()
      .then(count => console.log(`[Admin] Songkick sitemap sync complete: +${count}`))
      .catch(err => console.error('[Admin] Songkick sitemap sync error:', err.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/enrich/continuous - Run enrichment continuously until done
router.post('/enrich/continuous', authMiddleware, async (req, res) => {
  try {
    const enricher = require('../services/eventEnricher');
    res.json({ message: 'Continuous enrichment started', status: 'running' });
    enricher.runContinuousEnrichment(); // Don't await - runs in background
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/enrich/stop - Stop continuous enrichment
router.post('/enrich/stop', authMiddleware, async (req, res) => {
  try {
    const enricher = require('../services/eventEnricher');
    enricher.stopContinuousEnrichment();
    res.json({ message: 'Stopping continuous enrichment' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/enrich - Enrich incomplete events with real data
router.post('/enrich', authMiddleware, async (req, res) => {
  try {
    const enricher = require('../services/eventEnricher');
    const stats = await enricher.getIncompleteStats();
    res.json({ message: 'Enrichment started', incompleteStats: stats, status: 'running' });
    enricher.enrichEvents()
      .then(count => console.log(`[Admin] Enrichment complete: ${count} events updated`))
      .catch(err => console.error('[Admin] Enrichment error:', err.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/enrich/stats - Get incomplete event stats
router.get('/enrich/stats', authMiddleware, async (req, res) => {
  try {
    const enricher = require('../services/eventEnricher');
    const stats = await enricher.getIncompleteStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/unusable - Count unusable events
router.get('/unusable', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM events 
      WHERE title IS NULL OR title = ''
         OR (city IS NULL OR city IN ('', 'Various', 'Unknown'))
         OR start_time IS NULL
         OR start_time < NOW()
    `);
    res.json({ unusable: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/cleanup/mark - Mark unusable events (does NOT delete)
router.post('/cleanup/mark', authMiddleware, async (req, res) => {
  try {
    // Mark events as unusable (add a flag column if needed)
    const result = await pool.query(`
      UPDATE events SET is_hidden = true
      WHERE title IS NULL OR title = ''
         OR (city IS NULL OR city IN ('', 'Various', 'Unknown'))
         OR start_time IS NULL
         OR start_time < NOW()
      RETURNING id
    `);
    
    const marked = result.rowCount;
    res.json({ marked, message: `Marked ${marked} events as hidden (not deleted)` });
  } catch (err) {
    // If is_hidden column doesn't exist, just count them
    const countResult = await pool.query(`
      SELECT COUNT(*) FROM events 
      WHERE title IS NULL OR title = ''
         OR (city IS NULL OR city IN ('', 'Various', 'Unknown'))
         OR start_time IS NULL
         OR start_time < NOW()
    `);
    res.json({ 
      unusable: parseInt(countResult.rows[0].count),
      message: 'Counted unusable events (is_hidden column may need to be added)'
    });
  }
});

// DELETE /admin/cleanup/confirm - ACTUALLY delete (requires explicit call)
router.delete('/cleanup/confirm', authMiddleware, async (req, res) => {
  try {
    const { confirm } = req.query;
    if (confirm !== 'yes-delete-unusable') {
      return res.status(400).json({ 
        error: 'Safety check failed', 
        message: 'Add ?confirm=yes-delete-unusable to actually delete'
      });
    }
    
    const result = await pool.query(`
      DELETE FROM events 
      WHERE title IS NULL OR title = ''
         OR (city IS NULL OR city IN ('', 'Various', 'Unknown'))
         OR start_time IS NULL
         OR start_time < NOW()
      RETURNING id
    `);
    
    const deleted = result.rowCount;
    console.log(`[Cleanup] DELETED ${deleted} unusable events (confirmed by user)`);
    
    const countResult = await pool.query('SELECT COUNT(*) FROM events');
    const remaining = parseInt(countResult.rows[0].count);
    
    res.json({ deleted, remaining, message: `Permanently removed ${deleted} events` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GEOCODING
// ============================================

// POST /admin/geocode - Geocode events without coordinates
router.post('/geocode', authMiddleware, async (req, res) => {
  try {
    const geocoder = require('../services/geocoder');
    const { limit = 100, mode = 'full' } = req.query;
    
    // First, ensure geocode_source column exists
    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS geocode_source VARCHAR(50)
    `).catch(() => {}); // Ignore if exists
    
    if (mode === 'quick') {
      // Quick mode: use city/state fallbacks only (fast, no API calls)
      const result = await geocoder.quickGeocodeEvents(parseInt(limit));
      res.json({ 
        message: 'Quick geocode complete', 
        ...result,
        mode: 'fallbacks_only'
      });
    } else {
      // Full mode: use Nominatim API (slow, 1 req/sec)
      res.json({ 
        message: 'Geocoding started in background', 
        limit: parseInt(limit),
        note: 'Rate limited to 1 request/second. Check logs for progress.'
      });
      
      // Run in background
      geocoder.geocodeEvents(parseInt(limit)).then(result => {
        console.log('[Admin] Geocoding complete:', result);
      }).catch(err => {
        console.error('[Admin] Geocoding error:', err);
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/geocode/stats - Get geocoding statistics
router.get('/geocode/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as geocoded,
        COUNT(CASE WHEN latitude IS NULL AND city IS NOT NULL THEN 1 END) as pending_with_city,
        COUNT(CASE WHEN latitude IS NULL AND city IS NULL THEN 1 END) as no_location_data
      FROM events
      WHERE start_time >= NOW()
    `);
    
    const bySource = await pool.query(`
      SELECT geocode_source, COUNT(*) as count
      FROM events
      WHERE latitude IS NOT NULL AND geocode_source IS NOT NULL
      GROUP BY geocode_source
    `);
    
    res.json({
      ...stats.rows[0],
      bySource: bySource.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// StubHub sitemap
router.post('/sync/stubhub-sitemap', authMiddleware, async (req, res) => {
  try {
    const scraper = require('../services/stubhubSitemapScraper');
    res.json({ message: 'StubHub sitemap sync started' });
    scraper.scrape().then(r => console.log('[Admin] StubHub done:', r));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// AXS sitemap
router.post('/sync/axs-sitemap', authMiddleware, async (req, res) => {
  try {
    const scraper = require('../services/axsSitemapScraper');
    res.json({ message: 'AXS sitemap sync started' });
    scraper.scrape().then(r => console.log('[Admin] AXS done:', r));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Title-based enrichment for events without URLs
router.post('/enrich/titles', authMiddleware, async (req, res) => {
  try {
    const { pool } = require('../db');
    const { extractCityFromTitle, detectLanguage } = require('../services/titleParser');
    const { fillLocation } = require('../services/geocoder');
    
    res.json({ message: 'Title enrichment started' });
    
    // Get events missing city (no URL required)
    const result = await pool.query(`
      SELECT id, title, venue_name 
      FROM events 
      WHERE city IS NULL 
      LIMIT 1000
    `);
    
    let updated = 0;
    for (const event of result.rows) {
      try {
        // Try to extract city from title
        let location = extractCityFromTitle(event.title);
        
        // If not found, try language detection (skip non-US)
        if (!location) {
          const lang = detectLanguage(event.title);
          if (lang?.country && lang.country !== 'US') {
            // Mark as non-US so we don't keep retrying
            await pool.query('UPDATE events SET country = $1 WHERE id = $2', [lang.country, event.id]);
            continue;
          }
        }
        
        if (location?.city) {
          // Use geocoder to get coordinates
          const filled = await fillLocation({
            city: location.city,
            state: location.state,
            country: location.country || 'US'
          });
          
          if (filled.latitude) {
            await pool.query(`
              UPDATE events 
              SET city = $1, state = $2, country = $3, latitude = $4, longitude = $5
              WHERE id = $6
            `, [filled.city || location.city, filled.state || location.state, 
                filled.country || 'US', filled.latitude, filled.longitude, event.id]);
            updated++;
          }
        }
      } catch (e) {
        // Skip individual errors
      }
    }
    
    console.log(`[Admin] Title enrichment complete: ${updated} updated`);
  } catch (e) {
    console.error('[Admin] Title enrichment error:', e.message);
  }
});

// Fix garbage event names (deposit, TBD, etc.)
router.post('/fix-names', authMiddleware, async (req, res) => {
  const { limit = 500 } = req.query;
  
  res.json({ message: 'Name fixer started', limit });
  
  try {
    const { fixEventNames } = require('../services/eventNameFixer');
    const result = await fixEventNames(parseInt(limit));
    console.log('[Admin] Name fix complete:', result);
  } catch (e) {
    console.error('[Admin] Name fix error:', e.message);
  }
});

// Generate descriptions for events missing them
router.post('/fill-descriptions', authMiddleware, async (req, res) => {
  const { limit = 1000 } = req.query;
  
  res.json({ message: 'Description generation started', limit });
  
  try {
    const { fillMissingDescriptions } = require('../services/descriptionGenerator');
    const result = await fillMissingDescriptions(parseInt(limit));
    console.log('[Admin] Description fill complete:', result);
  } catch (e) {
    console.error('[Admin] Description fill error:', e.message);
  }
});

// Scrape/recategorize comedy events
router.post('/scrape-comedy', authMiddleware, async (req, res) => {
  res.json({ message: 'Comedy scraper started' });
  
  try {
    const { scrapeComedy } = require('../services/comedyScraper');
    const result = await scrapeComedy();
    console.log('[Admin] Comedy scrape complete:', result);
  } catch (e) {
    console.error('[Admin] Comedy scrape error:', e.message);
  }
});

// Fill state from coordinates for map-ready events
router.post('/fill-states', authMiddleware, async (req, res) => {
  try {
    res.json({ message: 'State fill started' });
    
    const { pool } = require('../db');
    const axios = require('axios');
    
    // Get events with coords but no state
    const result = await pool.query(`
      SELECT id, latitude, longitude 
      FROM events 
      WHERE latitude IS NOT NULL 
        AND (state IS NULL OR state = '')
      LIMIT 500
    `);
    
    console.log(`[Admin] Filling state for ${result.rows.length} events...`);
    let updated = 0;
    
    for (const event of result.rows) {
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        const response = await axios.get(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${event.latitude},${event.longitude}&key=${apiKey}`,
          { timeout: 5000 }
        );
        
        if (response.data.status === 'OK' && response.data.results[0]) {
          const components = response.data.results[0].address_components;
          const stateComp = components.find(c => c.types.includes('administrative_area_level_1'));
          const cityComp = components.find(c => c.types.includes('locality'));
          
          if (stateComp) {
            await pool.query(
              `UPDATE events SET state = $1, city = COALESCE(NULLIF(city, ''), NULLIF(city, 'UNKNOWN'), $2) WHERE id = $3`,
              [stateComp.long_name, cityComp?.long_name, event.id]
            );
            updated++;
          }
        }
      } catch (e) {}
    }
    
    console.log(`[Admin] State fill complete: ${updated} updated`);
  } catch (e) {
    console.error('[Admin] State fill error:', e.message);
  }
});
