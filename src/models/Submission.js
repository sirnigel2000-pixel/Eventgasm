/**
 * Submission Model - User-submitted events
 */
const { pool } = require('../db');

const Submission = {
  // Create submissions table
  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        event_id UUID REFERENCES events(id) ON DELETE SET NULL,
        is_update BOOLEAN DEFAULT false,
        
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        venue_name VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(50),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        ticket_url TEXT,
        image_url TEXT,
        is_free BOOLEAN DEFAULT false,
        price_min DECIMAL(10,2),
        price_max DECIMAL(10,2),
        
        source_type VARCHAR(50) DEFAULT 'manual',
        review_note TEXT,
        admin_note TEXT,
        reviewed_by VARCHAR(100),
        reviewed_at TIMESTAMPTZ,
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_contributions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255),
        approved_count INTEGER DEFAULT 0,
        pending_count INTEGER DEFAULT 0,
        rejected_count INTEGER DEFAULT 0,
        tier VARCHAR(50) DEFAULT 'none',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_event ON submissions(event_id)`);
  },

  // Create a new submission
  async create(data) {
    const result = await pool.query(`
      INSERT INTO submissions (
        user_id, username, title, description, category,
        venue_name, address, city, state, latitude, longitude,
        start_time, end_time, ticket_url, image_url, is_free,
        price_min, price_max, source_type, is_update, event_id, review_note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *
    `, [
      data.user_id, data.username, data.title, data.description, data.category,
      data.venue_name, data.address, data.city, data.state, data.latitude, data.longitude,
      data.start_time, data.end_time, data.ticket_url, data.image_url, data.is_free || false,
      data.price_min, data.price_max, data.source_type || 'manual',
      data.is_update || false, data.event_id || null,
      data.is_update ? 'Update to existing event' : null
    ]);
    return result.rows[0];
  },

  // Get pending submissions (for admin)
  async getPending(limit = 50, offset = 0) {
    const result = await pool.query(`
      SELECT s.*, 
        e.title as existing_title,
        e.start_time as existing_start_time
      FROM submissions s
      LEFT JOIN events e ON s.event_id = e.id
      WHERE s.status = 'pending'
      ORDER BY s.created_at ASC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
  },

  // Get count of pending
  async getPendingCount() {
    const result = await pool.query(`SELECT COUNT(*) FROM submissions WHERE status = 'pending'`);
    return parseInt(result.rows[0].count);
  },

  // Approve a submission
  async approve(submissionId, adminId) {
    const sub = await pool.query(`SELECT * FROM submissions WHERE id = $1`, [submissionId]);
    if (!sub.rows[0]) throw new Error('Submission not found');
    const s = sub.rows[0];

    let eventId = s.event_id;

    if (s.is_update && s.event_id) {
      // Update existing event
      await pool.query(`
        UPDATE events SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          category = COALESCE($3, category),
          venue_name = COALESCE($4, venue_name),
          address = COALESCE($5, address),
          city = COALESCE($6, city),
          state = COALESCE($7, state),
          latitude = COALESCE($8, latitude),
          longitude = COALESCE($9, longitude),
          start_time = COALESCE($10, start_time),
          end_time = COALESCE($11, end_time),
          ticket_url = COALESCE($12, ticket_url),
          image_url = COALESCE($13, image_url),
          is_free = COALESCE($14, is_free),
          community_updated = true,
          community_updated_at = NOW(),
          community_updated_by = $15,
          updated_at = NOW()
        WHERE id = $16
      `, [
        s.title, s.description, s.category, s.venue_name, s.address,
        s.city, s.state, s.latitude, s.longitude, s.start_time, s.end_time,
        s.ticket_url, s.image_url, s.is_free, s.username, s.event_id
      ]);
    } else {
      // Create new event
      const newEvent = await pool.query(`
        INSERT INTO events (
          title, description, category, venue_name, address, city, state,
          latitude, longitude, start_time, end_time, ticket_url, image_url,
          is_free, source, community_submitted, community_submitted_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'community',true,$15)
        RETURNING id
      `, [
        s.title, s.description, s.category, s.venue_name, s.address,
        s.city, s.state, s.latitude, s.longitude, s.start_time, s.end_time,
        s.ticket_url, s.image_url, s.is_free, s.username
      ]);
      eventId = newEvent.rows[0].id;
    }

    // Mark submission approved
    await pool.query(`
      UPDATE submissions SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), event_id = $2
      WHERE id = $3
    `, [adminId, eventId, submissionId]);

    // Update contributor stats
    await updateContributorStats(s.user_id, s.username, 'approve');

    return { eventId };
  },

  // Reject a submission
  async reject(submissionId, adminId, reason) {
    const sub = await pool.query(`SELECT user_id, username FROM submissions WHERE id = $1`, [submissionId]);
    if (!sub.rows[0]) throw new Error('Not found');

    await pool.query(`
      UPDATE submissions SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), admin_note = $2
      WHERE id = $3
    `, [adminId, reason, submissionId]);

    await updateContributorStats(sub.rows[0].user_id, sub.rows[0].username, 'reject');
  },

  // Get user's submissions
  async getByUser(userId) {
    const result = await pool.query(`
      SELECT s.*, e.id as live_event_id
      FROM submissions s
      LEFT JOIN events e ON s.event_id = e.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 50
    `, [userId]);
    return result.rows;
  },

  // Get contributor stats
  async getContributorStats(userId) {
    const result = await pool.query(`
      SELECT * FROM user_contributions WHERE user_id = $1
    `, [userId]);
    return result.rows[0] || null;
  },

  // Leaderboard
  async getLeaderboard(limit = 20) {
    const result = await pool.query(`
      SELECT user_id, username, approved_count, tier
      FROM user_contributions
      WHERE approved_count > 0
      ORDER BY approved_count DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  },

  // Find duplicate events
  async findDuplicate(title, startTime, venueName) {
    const result = await pool.query(`
      SELECT id, title, venue_name, start_time, city, image_url, category
      FROM events
      WHERE start_time >= NOW()
        AND (
          (LOWER(title) = LOWER($1) AND start_time::date = $2::date)
          OR (LOWER(venue_name) = LOWER($3) AND start_time::date = $2::date AND LOWER(title) ILIKE '%' || LOWER(SPLIT_PART($1, ' ', 1)) || '%')
        )
      LIMIT 3
    `, [title, startTime || new Date().toISOString(), venueName || '']);
    return result.rows;
  }
};

async function updateContributorStats(userId, username, action) {
  if (action === 'approve') {
    await pool.query(`
      INSERT INTO user_contributions (user_id, username, approved_count, tier)
      VALUES ($1, $2, 1, 'contributor')
      ON CONFLICT (user_id) DO UPDATE SET
        approved_count = user_contributions.approved_count + 1,
        username = $2,
        tier = CASE
          WHEN user_contributions.approved_count + 1 >= 10 THEN 'top_contributor'
          WHEN user_contributions.approved_count + 1 >= 5 THEN 'verified_contributor'
          ELSE 'contributor'
        END,
        updated_at = NOW()
    `, [userId, username]);
  } else if (action === 'reject') {
    await pool.query(`
      INSERT INTO user_contributions (user_id, username, rejected_count)
      VALUES ($1, $2, 1)
      ON CONFLICT (user_id) DO UPDATE SET
        rejected_count = user_contributions.rejected_count + 1,
        updated_at = NOW()
    `, [userId, username]);
  }
}

module.exports = Submission;
