/**
 * Image Enricher - Find the BEST image for every event
 * 
 * Multi-source, smart matching, accuracy-focused
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { pool } = require('../db');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY;

// Known artist/performer image patterns
const ARTIST_DOMAINS = [
  'spotify.com', 'last.fm', 'bandsintown.com', 'songkick.com',
  'ticketmaster.com', 'livenation.com', 'seatgeek.com', 'stubhub.com'
];

// Team logo/image sources
const SPORTS_TEAMS = {
  // MLB
  'yankees': 'https://www.mlbstatic.com/team-logos/147.svg',
  'red sox': 'https://www.mlbstatic.com/team-logos/111.svg',
  'dodgers': 'https://www.mlbstatic.com/team-logos/119.svg',
  'cubs': 'https://www.mlbstatic.com/team-logos/112.svg',
  'mets': 'https://www.mlbstatic.com/team-logos/121.svg',
  // NBA
  'lakers': 'https://cdn.nba.com/logos/nba/1610612747/global/L/logo.svg',
  'celtics': 'https://cdn.nba.com/logos/nba/1610612738/global/L/logo.svg',
  'warriors': 'https://cdn.nba.com/logos/nba/1610612744/global/L/logo.svg',
  'bulls': 'https://cdn.nba.com/logos/nba/1610612741/global/L/logo.svg',
  // NFL
  'cowboys': 'https://static.www.nfl.com/image/private/t_headshot_desktop/league/ieid8hoygzdlmzo0tnf6',
  'patriots': 'https://static.www.nfl.com/image/private/t_headshot_desktop/league/moyfxx3dq5pio4aiftnc',
  'chiefs': 'https://static.www.nfl.com/image/private/t_headshot_desktop/league/ujshjqvmnxce8m4obmvs',
};

// Category-specific Pexels searches for best fallback images
const CATEGORY_SEARCHES = {
  'Music': ['concert crowd stage lights', 'live music performance', 'rock concert audience'],
  'Sports': ['sports stadium crowd', 'basketball game', 'football stadium night'],
  'Comedy': ['standup comedy microphone', 'comedy club stage', 'comedian spotlight'],
  'Theater': ['broadway theater stage', 'theater performance spotlight', 'musical theater'],
  'Arts': ['art gallery exhibition', 'museum exhibit', 'art show opening'],
  'Festival': ['music festival crowd', 'outdoor festival celebration', 'festival stage lights'],
  'Family': ['family event outdoor', 'kids entertainment show', 'family fun fair'],
  'Food': ['food festival outdoor', 'culinary event', 'food market stalls'],
  'Nightlife': ['nightclub party', 'dj club lights', 'dance club crowd'],
  'Community': ['community gathering event', 'local fair', 'outdoor community event'],
};

// ============ IMAGE SOURCES ============

// 1. Try to extract image from ticket page
async function scrapeTicketPageImage(url) {
  if (!url) return null;
  
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Eventgasm/1.0)',
        'Accept': 'text/html'
      },
      maxRedirects: 3
    });
    
    const $ = cheerio.load(response.data);
    
    // Look for og:image (most reliable)
    let img = $('meta[property="og:image"]').attr('content');
    if (img && isValidImageUrl(img)) return img;
    
    // Twitter card image
    img = $('meta[name="twitter:image"]').attr('content');
    if (img && isValidImageUrl(img)) return img;
    
    // Schema.org event image
    const schema = $('script[type="application/ld+json"]').text();
    if (schema) {
      try {
        const data = JSON.parse(schema);
        if (data.image) return Array.isArray(data.image) ? data.image[0] : data.image;
        if (data['@graph']) {
          const event = data['@graph'].find(i => i['@type'] === 'Event');
          if (event?.image) return Array.isArray(event.image) ? event.image[0] : event.image;
        }
      } catch (e) {}
    }
    
    // Look for main event image
    img = $('.event-image img, .hero-image img, .event-hero img, [class*="event"] img').first().attr('src');
    if (img && isValidImageUrl(img)) return makeAbsoluteUrl(img, url);
    
  } catch (e) {
    // Silent fail
  }
  return null;
}

// 2. Google Places venue photo
async function getVenuePhoto(venueName, city) {
  if (!GOOGLE_API_KEY || !venueName) return null;
  
  try {
    const query = encodeURIComponent(`${venueName} ${city || ''}`);
    const searchResp = await axios.get(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_API_KEY}`,
      { timeout: 5000 }
    );
    
    if (searchResp.data.status !== 'OK' || !searchResp.data.results[0]) return null;
    
    const place = searchResp.data.results[0];
    if (!place.photos?.[0]?.photo_reference) return null;
    
    const photoRef = place.photos[0].photo_reference;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`;
    
  } catch (e) {
    return null;
  }
}

// 3. Pexels search - try multiple queries
async function searchPexels(queries) {
  if (!PEXELS_KEY || !queries || queries.length === 0) return null;
  
  for (const query of queries) {
    try {
      const response = await axios.get(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
        { 
          headers: { Authorization: PEXELS_KEY },
          timeout: 5000 
        }
      );
      
      if (response.data?.photos?.[0]?.src?.large) {
        return response.data.photos[0].src.large;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// 4. Check for sports team in title
function getSportsTeamImage(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  
  for (const [team, url] of Object.entries(SPORTS_TEAMS)) {
    if (lower.includes(team)) {
      return url;
    }
  }
  return null;
}

// ============ HELPERS ============

function isValidImageUrl(url) {
  if (!url) return false;
  if (url.includes('placeholder') || url.includes('default')) return false;
  if (url.includes('1x1') || url.includes('spacer')) return false;
  if (url.length < 20) return false;
  return true;
}

function makeAbsoluteUrl(url, baseUrl) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  try {
    return new URL(url, baseUrl).href;
  } catch (e) {
    return null;
  }
}

// Extract likely performer/artist name from event title
function extractPerformerName(title) {
  if (!title) return null;
  
  // Remove common suffixes
  let name = title
    .replace(/\s*(live|tour|concert|show|tickets|presents|featuring|feat\.?|ft\.?|with|&|vs\.?|versus).*$/i, '')
    .replace(/\s*[-–—:]\s*.*$/, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  
  // If still reasonable length, use it
  if (name.length > 2 && name.length < 60) {
    return name;
  }
  return null;
}

// ============ MAIN ENRICHMENT ============

async function findBestImage(event) {
  const { title, venue_name, city, category, ticket_url, source } = event;
  const performer = extractPerformerName(title);
  
  // Source order matters - most accurate first
  
  // 1. Try ticket page first (most accurate - actual event image)
  if (ticket_url) {
    const ticketImg = await scrapeTicketPageImage(ticket_url);
    if (ticketImg) {
      console.log(`[ImageEnricher] ✓ Ticket page: ${title?.substring(0, 30)}...`);
      return { url: ticketImg, source: 'ticket_page', accuracy: 'high' };
    }
  }
  
  // 2. Sports team logos
  if (category === 'Sports' || title?.toLowerCase().includes('vs')) {
    const teamImg = getSportsTeamImage(title);
    if (teamImg) {
      console.log(`[ImageEnricher] ✓ Team logo: ${title?.substring(0, 30)}...`);
      return { url: teamImg, source: 'team_logo', accuracy: 'high' };
    }
  }
  
  // 3. Venue photo (good for theater, arena shows)
  if (venue_name) {
    const venueImg = await getVenuePhoto(venue_name, city);
    if (venueImg) {
      console.log(`[ImageEnricher] ✓ Venue: ${venue_name}`);
      return { url: venueImg, source: 'google_places', accuracy: 'medium' };
    }
  }
  
  // 4. Search Pexels for performer/event
  if (performer) {
    const queries = [
      `${performer} concert`,
      `${performer} live`,
      performer
    ];
    const pexelsImg = await searchPexels(queries);
    if (pexelsImg) {
      console.log(`[ImageEnricher] ✓ Pexels performer: ${performer}`);
      return { url: pexelsImg, source: 'pexels_search', accuracy: 'medium' };
    }
  }
  
  // 5. Category-specific fallback
  const categorySearches = CATEGORY_SEARCHES[category] || CATEGORY_SEARCHES['Music'];
  const categoryImg = await searchPexels(categorySearches);
  if (categoryImg) {
    console.log(`[ImageEnricher] ✓ Category fallback: ${category}`);
    return { url: categoryImg, source: 'pexels_category', accuracy: 'low' };
  }
  
  return null;
}

// Process events in batches
async function enrichImages(limit = 50) {
  console.log(`[ImageEnricher] Starting batch of ${limit}...`);
  
  const result = await pool.query(`
    SELECT id, title, venue_name, city, category, ticket_url, source
    FROM events
    WHERE (image_url IS NULL OR image_url = '')
      AND title IS NOT NULL
      AND start_time >= NOW()
    ORDER BY start_time ASC
    LIMIT $1
  `, [limit]);
  
  let enriched = 0;
  let highAccuracy = 0;
  
  for (const event of result.rows) {
    const imageResult = await findBestImage(event);
    
    if (imageResult) {
      await pool.query(
        'UPDATE events SET image_url = $1, updated_at = NOW() WHERE id = $2',
        [imageResult.url, event.id]
      );
      enriched++;
      if (imageResult.accuracy === 'high') highAccuracy++;
    }
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log(`[ImageEnricher] Complete: ${enriched}/${result.rows.length} (${highAccuracy} high accuracy)`);
  return { enriched, total: result.rows.length, highAccuracy };
}

// Get stats
async function getStats() {
  const result = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_image,
      COUNT(*) FILTER (WHERE image_url IS NULL OR image_url = '') as without_image,
      COUNT(*) as total
    FROM events
    WHERE start_time >= NOW()
  `);
  return result.rows[0];
}

// Auto-run state
let autoRunning = false;
let autoInterval = null;

function startAutoEnrich(intervalMs = 30000, batchSize = 25) {
  if (autoRunning) return { message: 'Already running' };
  
  autoRunning = true;
  
  const run = async () => {
    if (!autoRunning) return;
    try {
      await enrichImages(batchSize);
    } catch (e) {
      console.error('[ImageEnricher] Error:', e.message);
    }
  };
  
  run();
  autoInterval = setInterval(run, intervalMs);
  
  return { message: 'Started', intervalMs, batchSize };
}

function stopAutoEnrich() {
  autoRunning = false;
  if (autoInterval) {
    clearInterval(autoInterval);
    autoInterval = null;
  }
  return { message: 'Stopped' };
}

module.exports = {
  findBestImage,
  enrichImages,
  getStats,
  startAutoEnrich,
  stopAutoEnrich,
  scrapeTicketPageImage,
  getVenuePhoto
};
