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
const { scrapeUrl, scrapeSourcePage } = require('../services/urlScraper');

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

// Scrape event details from a URL
router.post('/scrape-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    const result = await scrapeUrl(url);
    if (!result.ok) return res.status(422).json({ error: result.error, event: null });
    res.json({ event: result.event });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ SOURCE LINKS ============
// Link a social page / venue / organizer as an ongoing event source

// Create a source link
router.post('/source-links', async (req, res) => {
  try {
    const { user_id, url, label } = req.body;
    if (!user_id) return res.status(401).json({ error: 'Login required' });
    if (!url) return res.status(400).json({ error: 'URL required' });

    const { pool } = require('../db');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS source_links (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        label TEXT,
        last_scraped_at TIMESTAMPTZ,
        events_found INT DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, url)
      )
    `);

    // Test scrape immediately
    const scrapeResult = await scrapeSourcePage(url);
    const eventsFound = scrapeResult.events?.length || 0;

    const result = await pool.query(`
      INSERT INTO source_links (user_id, url, label, last_scraped_at, events_found)
      VALUES ($1, $2, $3, NOW(), $4)
      ON CONFLICT (user_id, url) DO UPDATE SET
        label = EXCLUDED.label, status = 'active', last_scraped_at = NOW(), events_found = $4
      RETURNING *
    `, [user_id, url, label || url, eventsFound]);

    // Look up actual username
    const userRow = await pool.query(`SELECT username FROM users WHERE id = $1`, [user_id]);
    const submitterUsername = userRow.rows[0]?.username || user_id;

    // Auto-submit any events found as pending submissions
    let autoSubmitted = 0;
    if (scrapeResult.events?.length) {
      for (const event of scrapeResult.events.slice(0, 20)) {
        try {
          if (!event.title || !event.start_time) continue;
          await Submission.create({
            ...event,
            user_id,
            username: submitterUsername,
            source_type: 'source_link',
            source_url: url,
          });
          autoSubmitted++;
        } catch(e) { /* skip dupes */ }
      }
    }

    res.json({
      success: true,
      source_link: result.rows[0],
      events_found: eventsFound,
      auto_submitted: autoSubmitted,
      message: eventsFound > 0
        ? `Found ${eventsFound} events on this page. ${autoSubmitted} submitted for review.`
        : 'Source linked! We\'ll check it periodically for new events.',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get user's source links
router.get('/source-links', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(401).json({ error: 'Login required' });
    const { pool } = require('../db');
    const result = await pool.query(
      `SELECT * FROM source_links WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ source_links: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete a source link
router.delete('/source-links/:id', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(401).json({ error: 'Login required' });
    const { pool } = require('../db');
    await pool.query(`DELETE FROM source_links WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
    res.json({ success: true });
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

    // Send push notification to submitter
    try {
      const { pool } = require('../db');
      const sub = await pool.query(`SELECT user_id, title, is_update FROM submissions WHERE id = $1`, [req.params.id]);
      if (sub.rows[0]) {
        const { user_id, title, is_update } = sub.rows[0];
        const userRow = await pool.query(`SELECT push_token FROM users WHERE id = $1`, [user_id]);
        const token = userRow.rows[0]?.push_token;
        if (token) {
          await sendPushNotification(token, {
            title: is_update ? 'Update approved!' : 'Event is live!',
            body: is_update
              ? `Your update to "${title}" is now live on Eventgasm.`
              : `"${title}" is now live on Eventgasm!`,
            data: { type: 'submission_approved', event_id: result.eventId }
          });
        }

        // Check if they hit a new tier - notify
        const stats = await pool.query(`SELECT approved_count, tier FROM user_contributions WHERE user_id = $1`, [user_id]);
        if (stats.rows[0]) {
          const { approved_count, tier } = stats.rows[0];
          const tierMessages = {
            verified_contributor: approved_count === 5 ? "You're now a Verified Contributor! 🛡️" : null,
            top_contributor: approved_count === 10 ? "You've reached Top Contributor status! 🏆" : null,
          };
          const tierMsg = tierMessages[tier];
          if (tierMsg && token) {
            await sendPushNotification(token, {
              title: 'New badge earned!',
              body: tierMsg,
              data: { type: 'tier_up', tier }
            });
          }
        }
      }
    } catch (notifError) {
      console.log('[Submissions] Push notification error:', notifError.message);
    }

    res.json({ success: true, event_id: result.eventId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reject
router.post('/admin/:id/reject', requireAdmin, async (req, res) => {
  try {
    await Submission.reject(req.params.id, req.body.admin_id || 'admin', req.body.reason);

    // Send push notification
    try {
      const { pool } = require('../db');
      const sub = await pool.query(`SELECT user_id, title FROM submissions WHERE id = $1`, [req.params.id]);
      if (sub.rows[0]) {
        const { user_id, title } = sub.rows[0];
        const userRow = await pool.query(`SELECT push_token FROM users WHERE id = $1`, [user_id]);
        const token = userRow.rows[0]?.push_token;
        if (token) {
          await sendPushNotification(token, {
            title: 'Event not approved',
            body: req.body.reason
              ? `"${title}" wasn't approved: ${req.body.reason}`
              : `"${title}" wasn't approved this time.`,
            data: { type: 'submission_rejected' }
          });
        }
      }
    } catch (notifError) {
      console.log('[Submissions] Push notification error:', notifError.message);
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Push notification helper (Expo Push Service - free, no Google)
async function sendPushNotification(token, { title, body, data = {} }) {
  if (!token || !token.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
    });
  } catch (e) {
    console.log('[Push] Failed:', e.message);
  }
}

module.exports = router;
