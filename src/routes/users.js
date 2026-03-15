const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create tables if not exists
const initTables = async () => {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        avatar_url TEXT,
        favorites TEXT[] DEFAULT '{}',
        preferences JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // User event interactions table (swipe saves)
    // NOTE: Removed foreign key to allow interactions before user fully synced
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_event_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        event_id UUID NOT NULL,
        status VARCHAR(50) NOT NULL CHECK (status IN ('going', 'maybe', 'want_to', 'not_interested')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, event_id)
      )
    `);
    
    // Drop foreign key if it exists (migration)
    await pool.query(`
      ALTER TABLE user_event_interactions 
      DROP CONSTRAINT IF EXISTS user_event_interactions_user_id_fkey
    `).catch(() => {});
    
    // Index for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_interactions_user_status 
      ON user_event_interactions(user_id, status)
    `);
    
    // Friends/connections table
    // NOTE: Removed foreign keys for flexibility
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_friends (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        friend_id UUID NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, friend_id)
      )
    `);
    
    // Drop foreign keys if they exist (migration)
    await pool.query(`
      ALTER TABLE user_friends 
      DROP CONSTRAINT IF EXISTS user_friends_user_id_fkey
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE user_friends 
      DROP CONSTRAINT IF EXISTS user_friends_friend_id_fkey
    `).catch(() => {});
    
    console.log('Users and interaction tables ready');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
};
initTables();

// Sign up - create new user
router.post('/signup', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    
    // Check if email exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists. Try signing in!' });
    }
    
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email.toLowerCase()]
    );
    
    const user = result.rows[0];
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      favorites: user.favorites || [],
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Failed to create account' });
  }
});

// Sign in - get existing user by email
router.post('/signin', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No account found with this email. Create one!' });
    }
    
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      favorites: user.favorites || [],
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ message: 'Failed to sign in' });
  }
});

// Get user profile
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      favorites: user.favorites || [],
      preferences: user.preferences || {},
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
});

// Update user profile
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, avatarUrl, preferences } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(avatarUrl);
    }
    if (preferences) {
      updates.push(`preferences = $${paramCount++}`);
      values.push(JSON.stringify(preferences));
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      favorites: user.favorites || [],
      preferences: user.preferences || {},
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// Get user favorites
router.get('/:id/favorites', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT favorites FROM users WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ favorites: result.rows[0].favorites || [] });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ message: 'Failed to get favorites' });
  }
});

// Update user favorites
router.put('/:id/favorites', async (req, res) => {
  try {
    const { id } = req.params;
    const { favorites } = req.body;
    
    if (!Array.isArray(favorites)) {
      return res.status(400).json({ message: 'Favorites must be an array' });
    }
    
    const result = await pool.query(
      'UPDATE users SET favorites = $1, updated_at = NOW() WHERE id = $2 RETURNING favorites',
      [favorites, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ favorites: result.rows[0].favorites });
  } catch (error) {
    console.error('Update favorites error:', error);
    res.status(500).json({ message: 'Failed to update favorites' });
  }
});

// ============================================
// EVENT INTERACTIONS (Swipe Saves)
// ============================================

// Save/update an interaction (swipe action)
router.post('/interactions', async (req, res) => {
  try {
    const { user_id, event_id, status } = req.body;
    
    if (!user_id || !event_id || !status) {
      return res.status(400).json({ message: 'user_id, event_id, and status are required' });
    }
    
    const validStatuses = ['going', 'maybe', 'want_to', 'not_interested'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
    }
    
    // Upsert interaction
    const result = await pool.query(`
      INSERT INTO user_event_interactions (user_id, event_id, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, event_id) 
      DO UPDATE SET status = $3, updated_at = NOW()
      RETURNING *
    `, [user_id, event_id, status]);
    
    res.json({ success: true, interaction: result.rows[0] });
  } catch (error) {
    console.error('Save interaction error:', error);
    res.status(500).json({ message: 'Failed to save interaction' });
  }
});

// Get user's interactions (with optional status filter)
router.get('/interactions', async (req, res) => {
  try {
    const { user_id, status } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    
    let query = `
      SELECT 
        uei.*,
        e.title, e.image_url, e.start_time, e.end_time,
        e.venue_name, e.city, e.state,
        e.category, e.price_min, e.is_free
      FROM user_event_interactions uei
      JOIN events e ON e.id = uei.event_id
      WHERE uei.user_id = $1
    `;
    const params = [user_id];
    
    if (status) {
      query += ` AND uei.status = $2`;
      params.push(status);
    }
    
    query += ` ORDER BY e.start_time ASC`;
    
    const result = await pool.query(query, params);
    
    // Transform to event objects with interaction status
    const events = result.rows.map(row => ({
      id: row.event_id,
      title: row.title,
      image_url: row.image_url,
      start_time: row.start_time,
      end_time: row.end_time,
      venue_name: row.venue_name,
      city: row.city,
      state: row.state,
      category: row.category,
      price_min: row.price_min,
      is_free: row.is_free,
      interaction: {
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    }));
    
    res.json({ success: true, events });
  } catch (error) {
    console.error('Get interactions error:', error);
    res.status(500).json({ message: 'Failed to get interactions' });
  }
});

// Delete an interaction
router.delete('/interactions/:event_id', async (req, res) => {
  try {
    const { event_id } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    
    await pool.query(
      'DELETE FROM user_event_interactions WHERE user_id = $1 AND event_id = $2',
      [user_id, event_id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete interaction error:', error);
    res.status(500).json({ message: 'Failed to delete interaction' });
  }
});

// Get friends going to an event
router.get('/interactions/event/:event_id/friends', async (req, res) => {
  try {
    const { event_id } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    
    // Get friends who are going or interested in this event
    const result = await pool.query(`
      SELECT 
        u.id, u.name, u.avatar_url,
        uei.status
      FROM user_event_interactions uei
      JOIN users u ON u.id = uei.user_id
      JOIN user_friends uf ON (
        (uf.user_id = $1 AND uf.friend_id = uei.user_id)
        OR (uf.friend_id = $1 AND uf.user_id = uei.user_id)
      )
      WHERE uei.event_id = $2 
        AND uei.status IN ('going', 'maybe')
        AND uf.status = 'accepted'
    `, [user_id, event_id]);
    
    res.json({ success: true, friends: result.rows });
  } catch (error) {
    console.error('Get friends for event error:', error);
    res.status(500).json({ message: 'Failed to get friends' });
  }
});

// ============================================
// FRIENDS
// ============================================

// Send friend request
router.post('/friends/request', async (req, res) => {
  try {
    const { user_id, friend_id } = req.body;
    
    if (!user_id || !friend_id) {
      return res.status(400).json({ message: 'user_id and friend_id are required' });
    }
    
    if (user_id === friend_id) {
      return res.status(400).json({ message: 'Cannot friend yourself' });
    }
    
    // Check if already friends or pending
    const existing = await pool.query(`
      SELECT * FROM user_friends 
      WHERE (user_id = $1 AND friend_id = $2) 
         OR (user_id = $2 AND friend_id = $1)
    `, [user_id, friend_id]);
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        message: 'Friend request already exists',
        status: existing.rows[0].status 
      });
    }
    
    const result = await pool.query(`
      INSERT INTO user_friends (user_id, friend_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING *
    `, [user_id, friend_id]);
    
    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'Failed to send friend request' });
  }
});

// Accept/reject friend request
router.patch('/friends/request/:request_id', async (req, res) => {
  try {
    const { request_id } = req.params;
    const { status } = req.body; // 'accepted' or 'blocked'
    
    if (!['accepted', 'blocked'].includes(status)) {
      return res.status(400).json({ message: 'status must be accepted or blocked' });
    }
    
    const result = await pool.query(`
      UPDATE user_friends SET status = $1 WHERE id = $2 RETURNING *
    `, [status, request_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Friend request not found' });
    }
    
    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Update friend request error:', error);
    res.status(500).json({ message: 'Failed to update friend request' });
  }
});

// Get user's friends
router.get('/:id/friends', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query; // Optional: filter by 'pending' or 'accepted'
    
    let query = `
      SELECT 
        uf.id as request_id,
        uf.status,
        uf.created_at,
        CASE 
          WHEN uf.user_id = $1 THEN uf.friend_id 
          ELSE uf.user_id 
        END as friend_id,
        u.name, u.email, u.avatar_url
      FROM user_friends uf
      JOIN users u ON u.id = CASE 
        WHEN uf.user_id = $1 THEN uf.friend_id 
        ELSE uf.user_id 
      END
      WHERE (uf.user_id = $1 OR uf.friend_id = $1)
    `;
    const params = [id];
    
    if (status) {
      query += ` AND uf.status = $2`;
      params.push(status);
    }
    
    query += ` ORDER BY uf.created_at DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, friends: result.rows });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Failed to get friends' });
  }
});

// Search users to add as friends
router.get('/search', async (req, res) => {
  try {
    const { q, user_id } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }
    
    const result = await pool.query(`
      SELECT id, name, email, avatar_url
      FROM users
      WHERE (LOWER(name) LIKE $1 OR LOWER(email) LIKE $1)
        AND id != $2
      LIMIT 20
    `, [`%${q.toLowerCase()}%`, user_id || '00000000-0000-0000-0000-000000000000']);
    
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Failed to search users' });
  }
});

module.exports = router;
