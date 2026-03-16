/**
 * Image Enricher - Find the BEST image for every event
 * 
 * Multi-source, smart matching, variety-focused (no duplicate images!)
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { pool } = require('../db');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Track recently used images to avoid duplicates (in-memory, resets on restart)
const recentlyUsedImages = new Set();
const MAX_RECENT_IMAGES = 5000; // Track last 5000 images

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
  'braves': 'https://www.mlbstatic.com/team-logos/144.svg',
  'astros': 'https://www.mlbstatic.com/team-logos/117.svg',
  'phillies': 'https://www.mlbstatic.com/team-logos/143.svg',
  // NBA
  'lakers': 'https://cdn.nba.com/logos/nba/1610612747/global/L/logo.svg',
  'celtics': 'https://cdn.nba.com/logos/nba/1610612738/global/L/logo.svg',
  'warriors': 'https://cdn.nba.com/logos/nba/1610612744/global/L/logo.svg',
  'bulls': 'https://cdn.nba.com/logos/nba/1610612741/global/L/logo.svg',
  'heat': 'https://cdn.nba.com/logos/nba/1610612748/global/L/logo.svg',
  'knicks': 'https://cdn.nba.com/logos/nba/1610612752/global/L/logo.svg',
  // NFL
  'cowboys': 'https://static.www.nfl.com/image/private/t_headshot_desktop/league/ieid8hoygzdlmzo0tnf6',
  'patriots': 'https://static.www.nfl.com/image/private/t_headshot_desktop/league/moyfxx3dq5pio4aiftnc',
  'chiefs': 'https://static.www.nfl.com/image/private/t_headshot_desktop/league/ujshjqvmnxce8m4obmvs',
  '49ers': 'https://static.www.nfl.com/image/private/t_headshot_desktop/league/dxibuyxbk0b9ua5ih9hn',
  'eagles': 'https://static.www.nfl.com/image/private/t_headshot_desktop/league/puhrqgj71gobgdkc4qse',
};

// Category-specific search terms with VARIETY (multiple options per category)
const CATEGORY_SEARCHES = {
  'Music': [
    ['concert crowd stage lights', 'live music performance', 'rock concert audience'],
    ['indie band concert', 'music festival night', 'singer microphone stage'],
    ['electric guitar performance', 'drummer concert', 'band playing live'],
    ['acoustic concert intimate', 'music venue crowd', 'concert silhouette'],
    ['pop concert lights', 'metal concert mosh', 'jazz club performance'],
  ],
  'Sports': [
    ['sports stadium crowd', 'basketball game arena', 'football stadium night'],
    ['baseball stadium', 'hockey arena ice', 'soccer match stadium'],
    ['tennis court match', 'golf course tournament', 'boxing ring event'],
    ['racing track cars', 'swimming competition pool', 'track field athletics'],
  ],
  'Comedy': [
    ['standup comedy microphone', 'comedy club stage', 'comedian spotlight'],
    ['comedy show audience laughing', 'microphone stand spotlight', 'comedy night club'],
    ['improv comedy theater', 'open mic comedy', 'comedy venue brick wall'],
  ],
  'Theater': [
    ['broadway theater stage', 'theater performance spotlight', 'musical theater'],
    ['opera house interior', 'ballet performance stage', 'dramatic theater lighting'],
    ['theater audience seated', 'stage curtain red', 'theatrical performance'],
  ],
  'Arts': [
    ['art gallery exhibition', 'museum exhibit', 'art show opening'],
    ['painting gallery wall', 'sculpture exhibition', 'modern art museum'],
    ['photography exhibition', 'art installation', 'creative exhibition space'],
  ],
  'Festival': [
    ['music festival crowd', 'outdoor festival celebration', 'festival stage lights'],
    ['summer festival tents', 'food festival outdoor', 'cultural festival parade'],
    ['street festival market', 'carnival rides night', 'festival fireworks'],
  ],
  'Family': [
    ['family event outdoor', 'kids entertainment show', 'family fun fair'],
    ['children carnival', 'family picnic park', 'kids theater performance'],
    ['puppet show kids', 'magic show children', 'family festival'],
  ],
  'Food': [
    ['food festival outdoor', 'culinary event', 'food market stalls'],
    ['wine tasting event', 'food truck festival', 'cooking demonstration'],
    ['farmers market fresh', 'beer festival crowd', 'gourmet food event'],
  ],
  'Nightlife': [
    ['nightclub party', 'dj club lights', 'dance club crowd'],
    ['bar nightlife drinks', 'rooftop party night', 'lounge club atmosphere'],
    ['neon club lights', 'disco party dance', 'club dj booth'],
  ],
  'Community': [
    ['community gathering event', 'local fair', 'outdoor community event'],
    ['neighborhood block party', 'town square event', 'community celebration'],
    ['charity event gathering', 'volunteer event', 'community festival'],
  ],
};

// ============ VARIETY HELPERS ============

// Track an image as used
function markImageUsed(url) {
  if (!url) return;
  // Normalize URL for comparison
  const normalized = url.split('?')[0].toLowerCase();
  recentlyUsedImages.add(normalized);
  
  // Cleanup if too many
  if (recentlyUsedImages.size > MAX_RECENT_IMAGES) {
    const arr = Array.from(recentlyUsedImages);
    arr.slice(0, 1000).forEach(u => recentlyUsedImages.delete(u));
  }
}

// Check if image was recently used
function isImageRecentlyUsed(url) {
  if (!url) return false;
  const normalized = url.split('?')[0].toLowerCase();
  return recentlyUsedImages.has(normalized);
}

// Get a random element from array
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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
    // Try to find a photo we haven't used recently
    const photos = place.photos || [];
    for (const photo of photos) {
      if (!photo.photo_reference) continue;
      const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`;
      if (!isImageRecentlyUsed(url)) {
        return url;
      }
    }
    // If all are used, return first anyway
    if (photos[0]?.photo_reference) {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
    }
    
  } catch (e) {
    return null;
  }
  return null;
}

// 3. Unsplash search (NEW!) - 50/hr free tier
async function searchUnsplash(query) {
  if (!UNSPLASH_KEY || !query) return null;
  
  try {
    const response = await axios.get(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
      { 
        headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
        timeout: 5000 
      }
    );
    
    const photos = response.data?.results || [];
    // Find one we haven't used recently
    for (const photo of photos) {
      const url = photo.urls?.regular || photo.urls?.full;
      if (url && !isImageRecentlyUsed(url)) {
        return url;
      }
    }
    // Fall back to first if all used
    if (photos[0]?.urls?.regular) {
      return photos[0].urls.regular;
    }
  } catch (e) {
    // Rate limited or error - silent fail
  }
  return null;
}

// 4. Pexels search - try multiple queries, get variety
async function searchPexels(queries, returnMultiple = false) {
  if (!PEXELS_KEY || !queries || queries.length === 0) return null;
  
  for (const query of queries) {
    try {
      const response = await axios.get(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`,
        { 
          headers: { Authorization: PEXELS_KEY },
          timeout: 5000 
        }
      );
      
      const photos = response.data?.photos || [];
      // Find one we haven't used
      for (const photo of photos) {
        const url = photo.src?.large;
        if (url && !isImageRecentlyUsed(url)) {
          return url;
        }
      }
      // Fall back to random one if all used
      if (photos.length > 0) {
        const randomPhoto = randomChoice(photos);
        return randomPhoto.src?.large;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// 5. Check for sports team in title
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

// Extract likely performer/artist name from event title
function extractPerformerName(title) {
  if (!title) return null;
  
  let name = title
    .replace(/\s*(live|tour|concert|show|tickets|presents|featuring|feat\.?|ft\.?|with|&|vs\.?|versus).*$/i, '')
    .replace(/\s*[-–—:]\s*.*$/, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  
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
    if (ticketImg && !isImageRecentlyUsed(ticketImg)) {
      console.log(`[ImageEnricher] ✓ Ticket page: ${title?.substring(0, 30)}...`);
      markImageUsed(ticketImg);
      return { url: ticketImg, source: 'ticket_page', accuracy: 'high' };
    }
  }
  
  // 2. Sports team logos (always unique per team)
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
    if (venueImg && !isImageRecentlyUsed(venueImg)) {
      console.log(`[ImageEnricher] ✓ Venue: ${venue_name}`);
      markImageUsed(venueImg);
      return { url: venueImg, source: 'google_places', accuracy: 'medium' };
    }
  }
  
  // 4. Try Unsplash for performer (high quality, variety)
  if (performer && UNSPLASH_KEY) {
    const unsplashImg = await searchUnsplash(`${performer} concert live`);
    if (unsplashImg && !isImageRecentlyUsed(unsplashImg)) {
      console.log(`[ImageEnricher] ✓ Unsplash performer: ${performer}`);
      markImageUsed(unsplashImg);
      return { url: unsplashImg, source: 'unsplash', accuracy: 'medium' };
    }
  }
  
  // 5. Search Pexels for performer/event
  if (performer) {
    const queries = [
      `${performer} concert`,
      `${performer} live performance`,
      performer
    ];
    const pexelsImg = await searchPexels(queries);
    if (pexelsImg && !isImageRecentlyUsed(pexelsImg)) {
      console.log(`[ImageEnricher] ✓ Pexels performer: ${performer}`);
      markImageUsed(pexelsImg);
      return { url: pexelsImg, source: 'pexels_search', accuracy: 'medium' };
    }
  }
  
  // 6. Unsplash category search (variety)
  if (UNSPLASH_KEY && category) {
    const categoryQueries = CATEGORY_SEARCHES[category] || CATEGORY_SEARCHES['Music'];
    const randomQueries = randomChoice(categoryQueries);
    const query = randomChoice(randomQueries);
    const unsplashImg = await searchUnsplash(query);
    if (unsplashImg && !isImageRecentlyUsed(unsplashImg)) {
      console.log(`[ImageEnricher] ✓ Unsplash category: ${category}`);
      markImageUsed(unsplashImg);
      return { url: unsplashImg, source: 'unsplash_category', accuracy: 'low' };
    }
  }
  
  // 7. Pexels category-specific fallback with VARIETY
  const categoryQuerySets = CATEGORY_SEARCHES[category] || CATEGORY_SEARCHES['Music'];
  const randomQuerySet = randomChoice(categoryQuerySets);
  const categoryImg = await searchPexels(randomQuerySet);
  if (categoryImg) {
    console.log(`[ImageEnricher] ✓ Category fallback: ${category}`);
    markImageUsed(categoryImg);
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
      await trackImageSource(event.id, imageResult.source, imageResult.accuracy, imageResult.url);
      enriched++;
      if (imageResult.accuracy === 'high') highAccuracy++;
      
      // Track in memory for session stats
      if (!enrichImages.sessionStats) enrichImages.sessionStats = {};
      enrichImages.sessionStats[imageResult.source] = (enrichImages.sessionStats[imageResult.source] || 0) + 1;
    }
    
    // Rate limiting (faster now that we have variety)
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`[ImageEnricher] Complete: ${enriched}/${result.rows.length} (${highAccuracy} high accuracy)`);
  return { enriched, total: result.rows.length, highAccuracy };
}

// Track image source in database
async function trackImageSource(eventId, source, accuracy, url) {
  try {
    await pool.query(`
      UPDATE events 
      SET image_source = $1, image_accuracy = $2, image_updated_at = NOW()
      WHERE id = $3
    `, [source, accuracy, eventId]);
  } catch (e) {
    // Columns might not exist yet
    console.log(`[ImageEnricher] Tracking: ${source} (${accuracy})`);
  }
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
  
  let sourceBreakdown = {};
  try {
    const sourceResult = await pool.query(`
      SELECT image_source, image_accuracy, COUNT(*) as count
      FROM events
      WHERE image_source IS NOT NULL AND start_time >= NOW()
      GROUP BY image_source, image_accuracy
      ORDER BY count DESC
    `);
    sourceBreakdown = sourceResult.rows;
  } catch (e) {}
  
  return { 
    ...result.rows[0], 
    sourceBreakdown,
    recentlyUsedCount: recentlyUsedImages.size
  };
}

// Auto-run state
let autoRunning = false;
let autoInterval = null;

// Re-check events with low accuracy images
async function reEnrichLowAccuracy(limit = 50) {
  console.log(`[ImageEnricher] Re-checking low accuracy images...`);
  
  const result = await pool.query(`
    SELECT id, title, venue_name, city, category, ticket_url, source, image_url
    FROM events
    WHERE image_accuracy = 'low'
      AND start_time >= NOW()
    ORDER BY start_time ASC
    LIMIT $1
  `, [limit]);
  
  let upgraded = 0;
  
  for (const event of result.rows) {
    const imageResult = await findBestImage(event);
    
    if (imageResult && imageResult.accuracy !== 'low') {
      await pool.query(
        'UPDATE events SET image_url = $1, updated_at = NOW() WHERE id = $2',
        [imageResult.url, event.id]
      );
      await trackImageSource(event.id, imageResult.source, imageResult.accuracy, imageResult.url);
      upgraded++;
      console.log(`[ImageEnricher] ⬆️ Upgraded: ${event.title?.substring(0, 30)}...`);
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`[ImageEnricher] Upgraded ${upgraded}/${result.rows.length} low-accuracy images`);
  return { upgraded, checked: result.rows.length };
}

function startAutoEnrich(intervalMs = 30000, batchSize = 25) {
  if (autoRunning) return { message: 'Already running', interval: intervalMs, status: 'running' };
  
  autoRunning = true;
  let phase = 'missing';
  
  const run = async () => {
    if (!autoRunning) return;
    try {
      const stats = await getStats();
      const withoutImage = parseInt(stats.without_image) || 0;
      
      if (withoutImage > 0) {
        phase = 'missing';
        await enrichImages(batchSize);
      } else {
        phase = 'upgrade';
        const result = await reEnrichLowAccuracy(batchSize);
        if (result.checked === 0) {
          console.log('[ImageEnricher] All done! Stopping auto-enrich.');
          stopAutoEnrich();
        }
      }
    } catch (e) {
      console.error('[ImageEnricher] Error:', e.message);
    }
  };
  
  run();
  autoInterval = setInterval(run, intervalMs);
  
  return { message: 'Started', intervalMs, batchSize, phase };
}

function stopAutoEnrich() {
  autoRunning = false;
  if (autoInterval) {
    clearInterval(autoInterval);
    autoInterval = null;
  }
  return { message: 'Stopped' };
}

function getSessionStats() {
  return {
    sessionStats: enrichImages.sessionStats || {},
    total: Object.values(enrichImages.sessionStats || {}).reduce((a, b) => a + b, 0),
    recentlyUsedCount: recentlyUsedImages.size,
    breakdown: Object.entries(enrichImages.sessionStats || {}).map(([source, count]) => ({
      source,
      count,
      percentage: 0 // calculated client-side
    }))
  };
}

module.exports = {
  findBestImage,
  enrichImages,
  getStats,
  getSessionStats,
  startAutoEnrich,
  stopAutoEnrich,
  scrapeTicketPageImage,
  getVenuePhoto,
  searchUnsplash,
  searchPexels,
};
