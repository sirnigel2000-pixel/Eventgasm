/**
 * Eventbrite Scraper - Using structured ld+json data
 * Much more reliable than HTML selectors
 */

const axios = require('axios');
const Event = require('../models/Event');
const { resilientFetch, sleep, isBlocked } = require('../utils/resilientScraper');

const BASE_URL = 'https://www.eventbrite.com';

// Categories to scrape
const CATEGORIES = [
  { slug: 'events', category: 'Community' },
  { slug: 'music', category: 'Music' },
  { slug: 'food-and-drink', category: 'Food & Drink' },
  { slug: 'arts', category: 'Arts & Theatre' },
  { slug: 'nightlife', category: 'Nightlife' },
];

// Major cities to cover
const CITIES = [
  { city: 'Miami', state: 'FL', slug: 'fl--miami' },
  { city: 'Orlando', state: 'FL', slug: 'fl--orlando' },
  { city: 'Tampa', state: 'FL', slug: 'fl--tampa' },
  { city: 'New York', state: 'NY', slug: 'ny--new-york' },
  { city: 'Los Angeles', state: 'CA', slug: 'ca--los-angeles' },
  { city: 'Chicago', state: 'IL', slug: 'il--chicago' },
  { city: 'Houston', state: 'TX', slug: 'tx--houston' },
  { city: 'Dallas', state: 'TX', slug: 'tx--dallas' },
  { city: 'Austin', state: 'TX', slug: 'tx--austin' },
  { city: 'San Francisco', state: 'CA', slug: 'ca--san-francisco' },
  { city: 'Seattle', state: 'WA', slug: 'wa--seattle' },
  { city: 'Denver', state: 'CO', slug: 'co--denver' },
  { city: 'Atlanta', state: 'GA', slug: 'ga--atlanta' },
  { city: 'Boston', state: 'MA', slug: 'ma--boston' },
  { city: 'Phoenix', state: 'AZ', slug: 'az--phoenix' },
  { city: 'Nashville', state: 'TN', slug: 'tn--nashville' },
  { city: 'Las Vegas', state: 'NV', slug: 'nv--las-vegas' },
  { city: 'Portland', state: 'OR', slug: 'or--portland' },
  { city: 'San Diego', state: 'CA', slug: 'ca--san-diego' },
  { city: 'Philadelphia', state: 'PA', slug: 'pa--philadelphia' },
];

// Extract events from ld+json structured data
function extractEventsFromHTML(html) {
  const events = [];
  
  // Find ld+json script
  const jsonMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!jsonMatch) return events;

  try {
    const data = JSON.parse(jsonMatch[1]);
    const items = data.itemListElement || [];
    
    for (const item of items) {
      const event = item.item || {};
      if (event.name) {
        events.push({
          name: event.name,
          url: event.url,
          startDate: event.startDate,
          endDate: event.endDate,
          description: event.description,
          image: event.image,
          location: event.location,
        });
      }
    }
  } catch (err) {
    console.log('[Eventbrite] JSON parse error');
  }

  return events;
}

// Scrape single city/category
async function scrapeCityCategory(citySlug, cityName, state, catSlug, category) {
  const url = `${BASE_URL}/d/${citySlug}/${catSlug}/`;
  
  if (isBlocked(url)) {
    console.log(`[Eventbrite] ${cityName}/${catSlug} blocked, skipping`);
    return 0;
  }

  try {
    const response = await resilientFetch(url);
    if (!response?.data) return 0;

    const events = extractEventsFromHTML(response.data);
    let added = 0;

    for (const e of events) {
      try {
        // Extract venue info
        let venueName = null;
        let address = null;
        if (e.location) {
          if (typeof e.location === 'object') {
            venueName = e.location.name;
            address = e.location.address?.streetAddress;
          }
        }

        await Event.upsert({
          source: 'eventbrite',
          source_id: `eb_${Buffer.from(e.name + cityName).toString('base64').substring(0, 24)}`,
          title: e.name,
          description: e.description?.substring(0, 2000),
          category: category,
          venue_name: venueName,
          address: address,
          city: cityName,
          state: state,
          country: 'US',
          start_time: e.startDate,
          end_time: e.endDate,
          image_url: e.image,
          ticket_url: e.url,
        });
        added++;
      } catch (err) {}
    }

    console.log(`[Eventbrite] ${cityName}/${catSlug}: +${added} events`);
    return added;
  } catch (err) {
    console.log(`[Eventbrite] Error ${cityName}/${catSlug}: ${err.message}`);
    return 0;
  }
}

// Sync all cities and categories
async function syncAll() {
  console.log('[Eventbrite] Starting full sync...');
  let totalAdded = 0;

  for (const city of CITIES) {
    for (const cat of CATEGORIES) {
      const added = await scrapeCityCategory(city.slug, city.city, city.state, cat.slug, cat.category);
      totalAdded += added;
      await sleep(1500); // Be polite
    }
  }

  console.log(`[Eventbrite] Sync complete: +${totalAdded} events`);
  return totalAdded;
}

// Alias for sync manager compatibility
const syncMajorCities = syncAll;

module.exports = { syncAll, syncMajorCities, scrapeCityCategory, CITIES, CATEGORIES };
