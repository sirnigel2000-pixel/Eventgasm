const axios = require('axios');
const cheerio = require('cheerio');
const Event = require('../models/Event');

// Scrape 10times.com for festivals, expos, and niche events
// Great source for: beer festivals, cultural events, craft shows, food festivals, etc.

const BASE_URL = 'https://10times.com';

// Categories to scrape - these are the niche ones users want
const NICHE_CATEGORIES = [
  { slug: 'food-beverage', category: 'Food & Drink', name: 'Food & Beverage Festivals' },
  { slug: 'arts-crafts', category: 'Arts & Theatre', name: 'Arts & Crafts Shows' },
  { slug: 'music', category: 'Music', name: 'Music Festivals' },
  { slug: 'lifestyle', category: 'Community', name: 'Lifestyle Events' },
  { slug: 'pets', category: 'Family & Kids', name: 'Pet Events' },
  { slug: 'sports-fitness', category: 'Sports', name: 'Sports & Fitness' },
  { slug: 'education-training', category: 'Education', name: 'Education Events' },
  { slug: 'entertainment', category: 'Entertainment', name: 'Entertainment' },
];

async function scrapeCategory(categorySlug, city, state) {
  const location = `${city.toLowerCase().replace(/\s+/g, '-')}-us`;
  const url = `${BASE_URL}/${location}/${categorySlug}`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventgasmBot/1.0)',
        'Accept': 'text/html'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    const events = [];
    
    // Parse event cards
    $('.event-card, .event-item, .listing-item').each((i, el) => {
      try {
        const $el = $(el);
        
        const title = $el.find('.event-name, .title, h3, h4').first().text().trim();
        const dateText = $el.find('.date, .event-date, time').first().text().trim();
        const venue = $el.find('.venue, .location').first().text().trim();
        const link = $el.find('a').first().attr('href');
        const image = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
        
        if (title && dateText) {
          events.push({
            title,
            dateText,
            venue,
            link: link ? (link.startsWith('http') ? link : BASE_URL + link) : null,
            image
          });
        }
      } catch (err) {
        // Skip malformed entries
      }
    });
    
    return events;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return [];
  }
}

// Scrape Eventful/ActiveNet remnants and community calendars
async function scrapeLocalCalendar(city, state) {
  // Try multiple local sources
  const sources = [
    `https://patch.com/search?q=events+${city}+${state}`,
    `https://www.yelp.com/events/${city.toLowerCase()}-${state.toLowerCase()}`,
  ];
  
  const events = [];
  
  for (const url of sources) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EventgasmBot/1.0)' },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // Generic event parsing
      $('[class*="event"], [class*="listing"]').slice(0, 20).each((i, el) => {
        const title = $(el).find('h2, h3, h4, .title').first().text().trim();
        const date = $(el).find('[class*="date"], time').first().text().trim();
        
        if (title && title.length > 5) {
          events.push({ title, dateText: date, source: url });
        }
      });
    } catch (err) {
      // Source unavailable, continue
    }
  }
  
  return events;
}

// Parse date text to ISO format (best effort)
function parseDate(dateText) {
  if (!dateText) return null;
  
  try {
    // Try common formats
    const date = new Date(dateText);
    if (!isNaN(date)) {
      return date.toISOString();
    }
    
    // Try "Mar 15, 2026" format
    const match = dateText.match(/(\w+)\s+(\d+),?\s*(\d{4})?/);
    if (match) {
      const year = match[3] || new Date().getFullYear();
      const parsed = new Date(`${match[1]} ${match[2]}, ${year}`);
      if (!isNaN(parsed)) {
        return parsed.toISOString();
      }
    }
  } catch (err) {}
  
  return null;
}

// Sync community events for a city
async function syncCity(city, state, coords) {
  console.log(`[Community] Syncing ${city}, ${state}...`);
  
  let totalAdded = 0;
  
  for (const cat of NICHE_CATEGORIES) {
    const events = await scrapeCategory(cat.slug, city, state);
    
    for (const raw of events) {
      try {
        const startTime = parseDate(raw.dateText);
        
        const eventData = {
          source: 'community',
          source_id: `comm_${Buffer.from(raw.title + raw.dateText).toString('base64').substring(0, 20)}`,
          title: raw.title,
          description: null,
          category: cat.category,
          subcategory: cat.name,
          
          venue_name: raw.venue || null,
          city: city,
          state: state,
          country: 'US',
          latitude: coords?.lat || null,
          longitude: coords?.lng || null,
          
          start_time: startTime,
          image_url: raw.image,
          ticket_url: raw.link,
          is_free: raw.title.toLowerCase().includes('free'),
          
          raw_data: raw
        };
        
        if (eventData.start_time) {
          await Event.upsert(eventData);
          totalAdded++;
        }
      } catch (err) {
        // Skip problematic events
      }
    }
    
    // Rate limiting between categories
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`[Community] ${city}, ${state}: ${totalAdded} events synced`);
  return totalAdded;
}

// Sync all major cities
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
    { city: 'New Orleans', state: 'LA', lat: 29.9511, lng: -90.0715 },
    { city: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784 },
    { city: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
    { city: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
    { city: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
    { city: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
    { city: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
    { city: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398 },
  ];

  let totalEvents = 0;
  for (const loc of cities) {
    const added = await syncCity(loc.city, loc.state, { lat: loc.lat, lng: loc.lng });
    totalEvents += added;
    await new Promise(r => setTimeout(r, 5000)); // Be polite
  }

  console.log(`[Community] Total sync complete: ${totalEvents} events`);
  return totalEvents;
}

module.exports = { syncCity, syncMajorCities, scrapeCategory };
