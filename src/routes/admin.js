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

module.exports = router;

// B2B Lead Generation
router.get('/leads/generate', authMiddleware, async (req, res) => {
  try {
    const leadScraper = require('../services/leadScraper');
    const Event = require('../models/Event');
    
    const leads = await leadScraper.getLeadsFromEvents(Event);
    
    res.json({
      count: leads.length,
      leads: leads.slice(0, 50), // Preview first 50
      message: 'Use /leads/export for full CSV'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leads/export', authMiddleware, async (req, res) => {
  try {
    const leadScraper = require('../services/leadScraper');
    const Event = require('../models/Event');
    
    const leads = await leadScraper.getLeadsFromEvents(Event);
    const csv = leadScraper.exportToCSV(leads);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=eventgasm_leads.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Power Scraper - Differentiator events
router.post('/sync/power', authMiddleware, async (req, res) => {
  try {
    const powerScraper = require('../services/powerScraper');
    
    // Run async, return immediately
    powerScraper.runAllPowerScrapers().then(results => {
      console.log('[Admin] Power scrape complete:', results);
    }).catch(err => {
      console.error('[Admin] Power scrape error:', err);
    });
    
    res.json({ message: 'Power scrape started', status: 'running' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
