/**
 * Image Finder - Find images for events
 * 
 * Priority:
 * 1. Google Places venue photos
 * 2. Google Custom Search for event/artist
 * 3. Unsplash fallback by category
 */

const axios = require('axios');
const { pool } = require('../db');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID; // Custom Search Engine ID
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY;

// Category to Unsplash search mapping
const CATEGORY_IMAGES = {
  'Music': 'concert crowd lights',
  'Sports': 'sports stadium crowd',
  'Comedy': 'comedy microphone stage',
  'Theater': 'theater stage curtain',
  'Arts': 'art gallery exhibition',
  'Festival': 'festival crowd celebration',
  'Food': 'food festival outdoor',
  'Community': 'community event gathering',
  'Family': 'family outdoor event',
  'Nightlife': 'nightclub party lights',
};

// Get venue photo from Google Places
async function getVenuePhoto(venueName, city) {
  if (!GOOGLE_API_KEY || !venueName) return null;
  
  try {
    // Find the place
    const query = encodeURIComponent(`${venueName} ${city || ''}`);
    const searchResp = await axios.get(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_API_KEY}`,
      { timeout: 5000 }
    );
    
    if (searchResp.data.status !== 'OK' || !searchResp.data.results[0]) return null;
    
    const place = searchResp.data.results[0];
    if (!place.photos?.[0]?.photo_reference) return null;
    
    // Get the photo URL
    const photoRef = place.photos[0].photo_reference;
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`;
    
    // Verify the URL works (Places API returns redirect)
    const headResp = await axios.head(photoUrl, { 
      timeout: 5000,
      maxRedirects: 5,
      validateStatus: s => s < 400 
    });
    
    // Return the final URL after redirects
    return headResp.request?.res?.responseUrl || photoUrl;
    
  } catch (e) {
    console.log(`[ImageFinder] Venue photo failed: ${e.message}`);
    return null;
  }
}

// Search Google Images via Custom Search API
async function searchGoogleImages(query) {
  if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID || !query) return null;
  
  try {
    const searchQuery = encodeURIComponent(query);
    const response = await axios.get(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${searchQuery}&searchType=image&num=1&safe=active&imgSize=large`,
      { timeout: 8000 }
    );
    
    if (response.data.items?.[0]?.link) {
      return response.data.items[0].link;
    }
  } catch (e) {
    console.log(`[ImageFinder] Google image search failed: ${e.message}`);
  }
  return null;
}

// Search Pexels for images (free, easy setup)
async function searchPexels(query) {
  if (!PEXELS_KEY || !query) return null;
  
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
    console.log(`[ImageFinder] Pexels failed: ${e.message}`);
  }
  return null;
}

// Get a category-appropriate image from Unsplash
async function getUnsplashImage(category) {
  if (!UNSPLASH_KEY) return null;
  
  const searchTerm = CATEGORY_IMAGES[category] || 'event crowd celebration';
  
  try {
    const response = await axios.get(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(searchTerm)}&orientation=landscape`,
      { 
        headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
        timeout: 5000 
      }
    );
    
    if (response.data?.urls?.regular) {
      return response.data.urls.regular;
    }
  } catch (e) {
    console.log(`[ImageFinder] Unsplash failed: ${e.message}`);
  }
  return null;
}

// Get category image from Pexels (fallback)
async function getPexelsCategoryImage(category) {
  const searchTerm = CATEGORY_IMAGES[category] || 'event crowd celebration';
  return searchPexels(searchTerm);
}

// Main function - find best image for an event
async function findEventImage(event) {
  const { title, venue_name, city, category } = event;
  
  // 1. Try venue photo from Google Places (most reliable, uses existing API key)
  if (venue_name) {
    const venuePhoto = await getVenuePhoto(venue_name, city);
    if (venuePhoto) {
      console.log(`[ImageFinder] ✓ Venue photo: ${venue_name}`);
      return venuePhoto;
    }
  }
  
  // 2. Clean title for searches
  let cleanTitle = '';
  if (title) {
    cleanTitle = title
      .replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '')
      .replace(/\d{1,2}:\d{2}\s*(am|pm)?/gi, '')
      .replace(/tickets?|presale|vip|general admission/gi, '')
      .replace(/\(.*?\)/g, '')
      .trim();
  }
  
  // 3. Try Google Custom Search (if configured)
  if (cleanTitle && GOOGLE_CSE_ID) {
    const searchQuery = `${cleanTitle} ${category || 'event'}`;
    const googleImage = await searchGoogleImages(searchQuery);
    if (googleImage) {
      console.log(`[ImageFinder] ✓ Google image: ${cleanTitle.substring(0, 30)}...`);
      return googleImage;
    }
  }
  
  // 4. Try Pexels search for artist/event name (simple API key)
  if (cleanTitle && PEXELS_KEY) {
    const pexelsImage = await searchPexels(`${cleanTitle} ${category || ''}`);
    if (pexelsImage) {
      console.log(`[ImageFinder] ✓ Pexels: ${cleanTitle.substring(0, 30)}...`);
      return pexelsImage;
    }
  }
  
  // 5. Fallback to category image from Pexels
  if (PEXELS_KEY) {
    const pexelsCat = await getPexelsCategoryImage(category);
    if (pexelsCat) {
      console.log(`[ImageFinder] ✓ Pexels category: ${category}`);
      return pexelsCat;
    }
  }
  
  // 6. Last resort: Unsplash
  const unsplashImage = await getUnsplashImage(category);
  if (unsplashImage) {
    console.log(`[ImageFinder] ✓ Unsplash fallback: ${category}`);
    return unsplashImage;
  }
  
  return null;
}

// Find and update images for events without them
async function enrichEventImages(limit = 50) {
  console.log(`[ImageFinder] Starting image enrichment...`);
  
  const result = await pool.query(`
    SELECT id, title, venue_name, city, category
    FROM events
    WHERE (image_url IS NULL OR image_url = '')
      AND title IS NOT NULL
      AND start_time >= NOW()
    ORDER BY start_time ASC
    LIMIT $1
  `, [limit]);
  
  let enriched = 0;
  
  for (const event of result.rows) {
    const imageUrl = await findEventImage(event);
    
    if (imageUrl) {
      await pool.query(
        'UPDATE events SET image_url = $1, updated_at = NOW() WHERE id = $2',
        [imageUrl, event.id]
      );
      enriched++;
      console.log(`[ImageFinder] ✓ ${event.title.substring(0, 40)}...`);
    }
    
    // Rate limit - be nice to APIs
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`[ImageFinder] Complete: ${enriched}/${result.rows.length} events got images`);
  return enriched;
}

// Get stats
async function getImageStats() {
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

module.exports = { 
  findEventImage, 
  getVenuePhoto, 
  searchGoogleImages, 
  enrichEventImages,
  getImageStats 
};
