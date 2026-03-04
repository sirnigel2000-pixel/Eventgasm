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
        COUNT(DISTINCT category) as categories
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

    res.json({
      byCategory: categoryStats.rows,
      byState: stateStats.rows,
      byDate: dateStats.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
