const cheerio = require('cheerio');
const Event = require('../models/Event');
const { resilientFetch, isBlocked, sleep } = require('../utils/resilientScraper');

const BASE_URL = 'https://www.eventbrite.com';

// Category slugs on Eventbrite
const CATEGORIES = [
  { slug: 'music', category: 'Music' },
  { slug: 'food-and-drink', category: 'Food & Drink' },
  { slug: 'community-and-culture', category: 'Cultural' },
  { slug: 'performing-and-visual-arts', category: 'Arts & Theatre' },
  { slug: 'film-and-media', category: 'Film' },
  { slug: 'sports-and-fitness', category: 'Sports' },
  { slug: 'health-and-wellness', category: 'Fitness' },
  { slug: 'science-and-technology', category: 'Education' },
  { slug: 'travel-and-outdoor', category: 'Outdoors' },
  { slug: 'charity-and-causes', category: 'Community' },
  { slug: 'family-and-education', category: 'Family & Kids' },
  { slug: 'fashion-and-beauty', category: 'Lifestyle' },
  { slug: 'hobbies-and-special-interest', category: 'Community' },
  { slug: 'holiday', category: 'Festivals' },
];

async function scrapeCity(city, state) {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  const events = [];

  for (const cat of CATEGORIES) {
    const url = `${BASE_URL}/d/${stateSlug}--${citySlug}/${cat.slug}/`;
    
    // Skip if domain is blocked
    if (isBlocked(url)) {
      console.log(`[Eventbrite] Domain in cooldown, skipping ${cat.slug}`);
      continue;
    }
    
    try {
      // Use resilient fetch with auto-retry and block detection
      const response = await resilientFetch(url, { timeout: 15000 });
      
      if (!response || !response.data) {
        continue;
      }

      const $ = cheerio.load(response.data);

      // Parse event cards - Eventbrite uses various selectors
      $('[data-testid="event-card"], .discover-search-desktop-card, .eds-event-card, .search-event-card-wrapper').each((i, el) => {
        try {
          const $card = $(el);
          
          // Try multiple selectors for title
          const title = $card.find('[data-testid="event-card-title"], .eds-event-card__formatted-name--is-clamped, .event-card__title, h2, h3').first().text().trim();
          
          // Date
          const dateText = $card.find('[data-testid="event-card-date"], .eds-event-card-content__sub-title, .event-card__date, time').first().text().trim();
          
          // Venue/Location
          const venue = $card.find('[data-testid="event-card-location"], .eds-event-card-content__sub-content, .event-card__venue').first().text().trim();
          
          // Link
          let link = $card.find('a').first().attr('href');
          if (link && !link.startsWith('http')) {
            link = BASE_URL + link;
          }
          
          // Image
          const image = $card.find('img').first().attr('src') || $card.find('img').first().attr('data-src');
          
          // Price
          const priceText = $card.find('[data-testid="event-card-price"], .eds-event-card-content__primary-content, .event-card__price').first().text().trim();
          const isFree = priceText.toLowerCase().includes('free');
          let priceMin = null;
          const priceMatch = priceText.match(/\$(\d+(?:\.\d{2})?)/);
          if (priceMatch) {
            priceMin = parseFloat(priceMatch[1]);
          }

          if (title && title.length > 3) {
            events.push({
              title,
              dateText,
              venue,
              link,
              image,
              isFree,
              priceMin,
              category: cat.category,
              city,
              state
            });
          }
        } catch (err) {
          // Skip malformed cards
        }
      });

      // Rate limiting
      await new Promise(r => setTimeout(r, 1500));
      
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error(`[Eventbrite Scraper] Error fetching ${url}:`, error.message);
      }
    }
  }

  return events;
}

// Parse date text to ISO
function parseDate(dateText) {
  if (!dateText) return null;
  
  try {
    // Clean up the text
    const cleaned = dateText.replace(/\s+/g, ' ').trim();
    
    // Try direct parse
    const date = new Date(cleaned);
    if (!isNaN(date) && date > new Date()) {
      return date.toISOString();
    }
    
    // Try patterns like "Sat, Mar 15, 7:00 PM"
    const match = cleaned.match(/(\w+),?\s*(\w+)\s+(\d+),?\s*(\d+:\d+\s*(?:AM|PM)?)?/i);
    if (match) {
      const year = new Date().getFullYear();
      const dateStr = `${match[2]} ${match[3]}, ${year} ${match[4] || '12:00 PM'}`;
      const parsed = new Date(dateStr);
      if (!isNaN(parsed)) {
        // If date is in past, assume next year
        if (parsed < new Date()) {
          parsed.setFullYear(parsed.getFullYear() + 1);
        }
        return parsed.toISOString();
      }
    }
  } catch (err) {}
  
  return null;
}

// Sync a city
async function syncCity(city, state, coords = null) {
  console.log(`[Eventbrite Scraper] Syncing ${city}, ${state}...`);
  
  const rawEvents = await scrapeCity(city, state);
  let added = 0;

  for (const raw of rawEvents) {
    try {
      const startTime = parseDate(raw.dateText);
      
      const eventData = {
        source: 'eventbrite',
        source_id: `eb_${Buffer.from(raw.title + raw.dateText).toString('base64').substring(0, 24)}`,
        title: raw.title,
        description: null,
        category: raw.category,
        
        venue_name: raw.venue || null,
        city: raw.city,
        state: raw.state,
        country: 'US',
        latitude: coords?.lat || null,
        longitude: coords?.lng || null,
        
        start_time: startTime,
        image_url: raw.image,
        ticket_url: raw.link,
        price_min: raw.priceMin,
        is_free: raw.isFree,
        
        raw_data: raw
      };

      if (eventData.start_time && eventData.title) {
        await Event.upsert(eventData);
        added++;
      }
    } catch (err) {
      // Skip problematic events
    }
  }

  console.log(`[Eventbrite Scraper] ${city}, ${state}: ${added} events`);
  return added;
}

// Sync major cities
async function syncMajorCities() {
  const cities = [
    { city: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
    { city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
    { city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
    { city: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
    { city: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
    { city: 'Orlando', state: 'FL', lat: 28.5383, lng: -81.3792 },
    { city: 'Tampa', state: 'FL', lat: 27.9506, lng: -82.4572 },
    { city: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
    { city: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
    { city: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
    { city: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
    { city: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816 },
    { city: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
    { city: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
    { city: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
    { city: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
    { city: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
    { city: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784 },
    { city: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398 },
    { city: 'New Orleans', state: 'LA', lat: 29.9511, lng: -90.0715 },
  ];

  let totalEvents = 0;
  
  for (const loc of cities) {
    try {
      const added = await syncCity(loc.city, loc.state, { lat: loc.lat, lng: loc.lng });
      totalEvents += added;
    } catch (err) {
      console.error(`[Eventbrite Scraper] Failed ${loc.city}: ${err.message}`);
    }
    
    // Be polite - longer delay between cities
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`[Eventbrite Scraper] Total: ${totalEvents} events synced`);
  return totalEvents;
}

module.exports = { scrapeCity, syncCity, syncMajorCities };
