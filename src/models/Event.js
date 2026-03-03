const { pool } = require('../db');

class Event {
  // Upsert event (insert or update if exists)
  static async upsert(eventData) {
    const {
      source, source_id, title, description, category, subcategory,
      venue_name, address, city, state, zip, country, latitude, longitude,
      start_time, end_time, timezone, is_all_day,
      image_url, ticket_url, price_min, price_max, is_free, age_restriction,
      raw_data
    } = eventData;

    const result = await pool.query(`
      INSERT INTO events (
        source, source_id, title, description, category, subcategory,
        venue_name, address, city, state, zip, country, latitude, longitude,
        start_time, end_time, timezone, is_all_day,
        image_url, ticket_url, price_min, price_max, is_free, age_restriction,
        raw_data, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW())
      ON CONFLICT (source, source_id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        venue_name = EXCLUDED.venue_name,
        address = EXCLUDED.address,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        image_url = EXCLUDED.image_url,
        ticket_url = EXCLUDED.ticket_url,
        price_min = EXCLUDED.price_min,
        price_max = EXCLUDED.price_max,
        is_free = EXCLUDED.is_free,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
      RETURNING *
    `, [
      source, source_id, title, description, category, subcategory,
      venue_name, address, city, state, zip, country || 'US', latitude, longitude,
      start_time, end_time, timezone, is_all_day || false,
      image_url, ticket_url, price_min, price_max, is_free || false, age_restriction,
      JSON.stringify(raw_data || {})
    ]);

    return result.rows[0];
  }

  // Find events near a location
  static async findNearby({ latitude, longitude, radiusMiles = 25, limit = 50, offset = 0, category, startDate, endDate }) {
    let query = `
      SELECT *,
        (3959 * acos(
          cos(radians($1)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(latitude))
        )) AS distance_miles
      FROM events
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND start_time >= NOW()
    `;
    const params = [latitude, longitude];
    let paramIndex = 3;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND start_time >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND start_time <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += `
      HAVING (3959 * acos(
        cos(radians($1)) * cos(radians(latitude)) *
        cos(radians(longitude) - radians($2)) +
        sin(radians($1)) * sin(radians(latitude))
      )) < $${paramIndex}
      ORDER BY start_time ASC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;
    params.push(radiusMiles, limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Find events by city/state
  static async findByLocation({ city, state, limit = 50, offset = 0, category, startDate, endDate }) {
    let query = `
      SELECT * FROM events
      WHERE start_time >= NOW()
    `;
    const params = [];
    let paramIndex = 1;

    if (city) {
      query += ` AND LOWER(city) = LOWER($${paramIndex})`;
      params.push(city);
      paramIndex++;
    }

    if (state) {
      query += ` AND LOWER(state) = LOWER($${paramIndex})`;
      params.push(state);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND start_time >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND start_time <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY start_time ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Search events by text
  static async search({ query: searchQuery, limit = 50, offset = 0 }) {
    const result = await pool.query(`
      SELECT * FROM events
      WHERE start_time >= NOW()
        AND (
          title ILIKE $1
          OR description ILIKE $1
          OR venue_name ILIKE $1
          OR city ILIKE $1
        )
      ORDER BY start_time ASC
      LIMIT $2 OFFSET $3
    `, [`%${searchQuery}%`, limit, offset]);
    return result.rows;
  }

  // Get single event by ID
  static async findById(id) {
    const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    return result.rows[0];
  }

  // Get events by category
  static async findByCategory({ category, limit = 50, offset = 0 }) {
    const result = await pool.query(`
      SELECT * FROM events
      WHERE category = $1 AND start_time >= NOW()
      ORDER BY start_time ASC
      LIMIT $2 OFFSET $3
    `, [category, limit, offset]);
    return result.rows;
  }

  // Get trending/popular (most recently added or updated)
  static async getTrending({ limit = 20 }) {
    const result = await pool.query(`
      SELECT * FROM events
      WHERE start_time >= NOW() AND start_time <= NOW() + INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  // Get all categories with counts
  static async getCategoryCounts() {
    const result = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM events
      WHERE start_time >= NOW()
      GROUP BY category
      ORDER BY count DESC
    `);
    return result.rows;
  }

  // Delete old events (cleanup)
  static async deleteOldEvents(daysAgo = 7) {
    const result = await pool.query(`
      DELETE FROM events
      WHERE end_time < NOW() - INTERVAL '${daysAgo} days'
        OR (end_time IS NULL AND start_time < NOW() - INTERVAL '${daysAgo} days')
      RETURNING id
    `);
    return result.rowCount;
  }
}

module.exports = Event;
