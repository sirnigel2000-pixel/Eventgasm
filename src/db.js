const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Enable PostGIS if available (for geospatial queries)
    await client.query(`CREATE EXTENSION IF NOT EXISTS postgis;`).catch(() => {
      console.log('PostGIS not available, using basic geo queries');
    });

    // Events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source VARCHAR(50) NOT NULL,
        source_id VARCHAR(255) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        subcategory VARCHAR(100),
        
        -- Location
        venue_name VARCHAR(255),
        address VARCHAR(500),
        city VARCHAR(100),
        state VARCHAR(50),
        zip VARCHAR(20),
        country VARCHAR(50) DEFAULT 'US',
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        
        -- Timing
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE,
        timezone VARCHAR(50),
        is_all_day BOOLEAN DEFAULT FALSE,
        
        -- Details
        image_url TEXT,
        ticket_url TEXT,
        price_min DECIMAL(10, 2),
        price_max DECIMAL(10, 2),
        is_free BOOLEAN DEFAULT FALSE,
        age_restriction VARCHAR(50),
        
        -- Meta
        raw_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(source, source_id)
      );
    `);

    // Indexes for fast queries
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_city ON events(city);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_state ON events(state);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_location ON events(latitude, longitude);`);
    
    // Performance indexes for common queries
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_state_coords ON events(state, latitude) WHERE state IS NOT NULL AND latitude IS NOT NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_upcoming ON events(start_time) WHERE start_time > NOW();`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_free ON events(is_free, start_time) WHERE is_free = true;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_coords_upcoming ON events(latitude, longitude, start_time) WHERE latitude IS NOT NULL;`);

    // Categories table for normalization
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        icon VARCHAR(50),
        color VARCHAR(20)
      );
    `);

    // Insert default categories
    await client.query(`
      INSERT INTO categories (name, icon, color) VALUES
        ('Music', '🎵', '#FF6B6B'),
        ('Sports', '⚽', '#4ECDC4'),
        ('Arts & Theatre', '🎭', '#9B59B6'),
        ('Comedy', '😂', '#F39C12'),
        ('Festivals', '🎪', '#E74C3C'),
        ('Family & Kids', '👨‍👩‍👧‍👦', '#3498DB'),
        ('Food & Drink', '🍕', '#E67E22'),
        ('Nightlife', '🌙', '#8E44AD'),
        ('Community', '🤝', '#27AE60'),
        ('Education', '📚', '#2980B9'),
        ('Fitness', '💪', '#1ABC9C'),
        ('Film', '🎬', '#34495E'),
        ('Other', '📌', '#95A5A6')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Sync log to track what we've fetched
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        region VARCHAR(100),
        last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        events_added INT DEFAULT 0,
        events_updated INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT
      );
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase };
