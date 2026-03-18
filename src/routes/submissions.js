/**
 * Submissions API
 * POST /api/submissions - create submission
 * GET  /api/submissions/my - user's own submissions
 * GET  /api/submissions/leaderboard - top contributors
 * POST /api/submissions/check-duplicate - check for duplicates
 * GET  /api/admin/submissions - pending queue (admin only)
 * POST /api/admin/submissions/:id/approve - approve
 * POST /api/admin/submissions/:id/reject - reject
 */

const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'eventgasm-admin';

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Initialize tables on startup
Submission.createTable().catch(e => console.error('[Submissions] Table init error:', e.message));

// ============ USER ROUTES ============

// Submit an event
router.post('/', async (req, res) => {
  try {
    const { user_id, username } = req.body;
    if (!user_id) return res.status(401).json({ error: 'Login required to submit events' });
    if (!req.body.title) return res.status(400).json({ error: 'Title is required' });
    if (!req.body.start_time) return res.status(400).json({ error: 'Date/time is required' });

    const submission = await Submission.create({ ...req.body, user_id, username });

    // Update pending count
    try {
      const { pool } = require('../db');
      await pool.query(`
        INSERT INTO user_contributions (user_id, username, pending_count)
        VALUES ($1, $2, 1)
        ON CONFLICT (user_id) DO UPDATE SET
          pending_count = user_contributions.pending_count + 1,
          username = $2, updated_at = NOW()
      `, [user_id, username]);
    } catch(e) {}

    res.json({
      success: true,
      submission_id: submission.id,
      message: submission.is_update
        ? 'Update submitted for review. The current event info stays live until approved.'
        : 'Event submitted! We\'ll review it shortly.',
      is_update: submission.is_update
    });
  } catch (e) {
    console.error('[Submissions] Create error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Check for duplicates before submitting
router.post('/check-duplicate', async (req, res) => {
  try {
    const { title, start_time, venue_name } = req.body;
    const duplicates = await Submission.findDuplicate(title, start_time, venue_name);
    res.json({ duplicates, has_duplicates: duplicates.length > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// User's own submissions
router.get('/my', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(401).json({ error: 'Login required' });
    const submissions = await Submission.getByUser(userId);
    const stats = await Submission.getContributorStats(userId);
    res.json({ submissions, stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const leaders = await Submission.getLeaderboard(20);
    res.json({ leaderboard: leaders });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ ADMIN ROUTES ============

// Get pending queue
router.get('/admin/queue', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const [submissions, count] = await Promise.all([
      Submission.getPending(parseInt(limit), parseInt(offset)),
      Submission.getPendingCount()
    ]);
    res.json({ submissions, total: count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Approve
router.post('/admin/:id/approve', requireAdmin, async (req, res) => {
  try {
    const result = await Submission.approve(req.params.id, req.body.admin_id || 'admin');
    res.json({ success: true, event_id: result.eventId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reject
router.post('/admin/:id/reject', requireAdmin, async (req, res) => {
  try {
    await Submission.reject(req.params.id, req.body.admin_id || 'admin', req.body.reason);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
