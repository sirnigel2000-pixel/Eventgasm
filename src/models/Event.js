const { pool } = require('../db');

class Event {
  // Upsert event (insert or update if exists)
  static async upsert(eventData) {
    const {
      externalId,      // New: allows source-agnostic external IDs
      source, 
      source_id,       // Legacy: keep for backwards compat
      title, description, category, subcategory,
      venueName, venue_name,  // Support both formats
      venueAddress, address,
      city, state, zip, country, 
      latitude, lat,   // Support both formats
      longitude, lng,
      startTime, start_time,
      endTime, end_time,
      timezone, 
      isAllDay, is_all_day,
      imageUrl, image_url, 
      ticketUrl, ticket_url, 
      priceMin, price_min, 
      priceMax, price_max, 
      isFree, is_free, 
      ageRestriction, age_restriction,
      raw_data
    } = eventData;

    // Normalize field names
    const normalizedData = {
      source,
      source_id: source_id || externalId,
      title,
      description,
      category,
      subcategory,
      venue_name: venue_name || venueName,
      address: address || venueAddress,
      city,
      state,
      zip,
      country: country || 'US',
      latitude: latitude || lat,
      longitude: longitude || lng,
      start_time: start_time || startTime,
      end_time: end_time || endTime,
      timezone,
      is_all_day: is_all_day || isAllDay || false,
      image_url: image_url || imageUrl,
      ticket_url: ticket_url || ticketUrl,
      price_min: price_min || priceMin,
      price_max: price_max || priceMax,
      is_free: is_free ?? isFree ?? false,
      age_restriction: age_restriction || ageRestriction,
      raw_data
    };

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
      normalizedData.source, normalizedData.source_id, normalizedData.title, 
      normalizedData.description, normalizedData.category, normalizedData.subcategory,
      normalizedData.venue_name, normalizedData.address, normalizedData.city, 
      normalizedData.state, normalizedData.zip, normalizedData.country, 
      normalizedData.latitude, normalizedData.longitude,
      normalizedData.start_time, normalizedData.end_time, normalizedData.timezone, 
      normalizedData.is_all_day,
      normalizedData.image_url, normalizedData.ticket_url, normalizedData.price_min, 
      normalizedData.price_max, normalizedData.is_free, normalizedData.age_restriction,
      JSON.stringify(normalizedData.raw_data || {})
    ]);

    return result.rows[0];
  }

  // Find events near a location
  static async findNearby({ latitude, longitude, radiusMiles = 25, limit = 50, offset = 0, category, startDate, endDate, isFree, source }) {
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

    if (isFree) {
      query += ` AND is_free = true`;
    }

    if (source) {
      query += ` AND source = $${paramIndex}`;
      params.push(source);
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
  static async findByLocation({ city, state, limit = 50, offset = 0, category, startDate, endDate, isFree, source }) {
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

    if (isFree) {
      query += ` AND is_free = true`;
    }

    if (source) {
      query += ` AND source = $${paramIndex}`;
      params.push(source);
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

  // Find FREE events only
  static async findFreeEvents({ state, city, category, limit = 50, offset = 0 }) {
    let query = `
      SELECT * FROM events
      WHERE start_time >= NOW()
        AND is_free = true
    `;
    const params = [];
    let paramIndex = 1;

    if (state) {
      query += ` AND LOWER(state) = LOWER($${paramIndex})`;
      params.push(state);
      paramIndex++;
    }

    if (city) {
      query += ` AND LOWER(city) = LOWER($${paramIndex})`;
      params.push(city);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    query += ` ORDER BY start_time ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Search events by text
  static async search({ query: searchQuery, limit = 50, offset = 0, isFree, source, category }) {
    let query = `
      SELECT * FROM events
      WHERE start_time >= NOW()
        AND (
          title ILIKE $1
          OR description ILIKE $1
          OR venue_name ILIKE $1
          OR city ILIKE $1
        )
    `;
    const params = [`%${searchQuery}%`];
    let paramIndex = 2;

    if (isFree) {
      query += ` AND is_free = true`;
    }

    if (source) {
      query += ` AND source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    query += ` ORDER BY start_time ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get single event by ID
  static async findById(id) {
    const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    return result.rows[0];
  }

  // Get events by category
  static async findByCategory({ category, limit = 50, offset = 0, isFree, source }) {
    let query = `
      SELECT * FROM events
      WHERE category = $1 AND start_time >= NOW()
    `;
    const params = [category];
    let paramIndex = 2;

    if (isFree) {
      query += ` AND is_free = true`;
    }

    if (source) {
      query += ` AND source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    query += ` ORDER BY start_time ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get trending/popular (most recently added or updated)
  static async getTrending({ limit = 20, state, source }) {
    let query = `
      SELECT * FROM events
      WHERE start_time >= NOW() AND start_time <= NOW() + INTERVAL '7 days'
    `;
    const params = [];
    let paramIndex = 1;

    if (state) {
      query += ` AND LOWER(state) = LOWER($${paramIndex})`;
      params.push(state);
      paramIndex++;
    }

    if (source) {
      query += ` AND source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);
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

  // Get source distribution
  static async getSourceCounts() {
    const result = await pool.query(`
      SELECT source, COUNT(*) as count
      FROM events
      WHERE start_time >= NOW()
      GROUP BY source
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
