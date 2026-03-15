/**
 * Comedy Event Scraper
 * Scrapes comedy events from various sources
 */

const axios = require('axios');
const cheerio = require('cheerio');
const Event = require('../models/Event');
const { fillLocation } = require('./geocoder');

// Major comedy clubs and venues to scrape
const COMEDY_VENUES = [
  // Florida
  { name: 'Improv Comedy Club', city: 'Orlando', state: 'FL', url: 'https://improv.com/orlando/' },
  { name: 'Improv Comedy Club', city: 'Tampa', state: 'FL', url: 'https://improv.com/tampa/' },
  { name: 'Improv Comedy Club', city: 'West Palm Beach', state: 'FL', url: 'https://improv.com/west-palm-beach/' },
  { name: 'Improv Comedy Club', city: 'Fort Lauderdale', state: 'FL', url: 'https://improv.com/fort-lauderdale/' },
  { name: 'Hard Rock Live', city: 'Hollywood', state: 'FL' },
  
  // Major cities
  { name: 'Comedy Cellar', city: 'New York', state: 'NY' },
  { name: 'The Comedy Store', city: 'Los Angeles', state: 'CA' },
  { name: 'Laugh Factory', city: 'Los Angeles', state: 'CA' },
  { name: 'Second City', city: 'Chicago', state: 'IL' },
  { name: 'Zanies Comedy Club', city: 'Chicago', state: 'IL' },
  { name: 'Punch Line', city: 'San Francisco', state: 'CA' },
  { name: 'Helium Comedy Club', city: 'Philadelphia', state: 'PA' },
  { name: 'Comedy Works', city: 'Denver', state: 'CO' },
  { name: 'Cap City Comedy', city: 'Austin', state: 'TX' },
  { name: 'Addison Improv', city: 'Dallas', state: 'TX' },
  { name: 'Laugh Boston', city: 'Boston', state: 'MA' },
];

// Famous comedians to search for
const COMEDIANS = [
  'Dave Chappelle', 'Kevin Hart', 'Amy Schumer', 'Trevor Noah', 
  'John Mulaney', 'Sebastian Maniscalco', 'Tom Segura', 'Bert Kreischer',
  'Joe Rogan', 'Bill Burr', 'Nate Bargatze', 'Taylor Tomlinson',
  'Nikki Glaser', 'Matt Rife', 'Gabriel Iglesias', 'Jim Gaffigan',
  'Hasan Minhaj', 'Chelsea Handler', 'Whitney Cummings', 'Iliza Shlesinger',
  'Brian Regan', 'Demetri Martin', 'Kathleen Madigan', 'Fortune Feimster',
  'Sam Morril', 'Mark Normand', 'Shane Gillis', 'Andrew Schulz',
];

// Search existing events and re-categorize as comedy
async function recategorizeComedyEvents() {
  const stats = { found: 0, updated: 0 };
  
  // Patterns that indicate comedy
  const comedyPatterns = [
    'comedy', 'comedian', 'stand-up', 'standup', 'stand up',
    'laugh', 'improv', 'funny', 'jokes', 'comic'
  ];
  
  // Search for events that should be comedy but aren't categorized as such
  const searchTerms = [...COMEDIANS, ...comedyPatterns];
  
  for (const term of searchTerms) {
    try {
      const result = await Event.pool.query(`
        UPDATE events 
        SET category = 'Comedy', updated_at = NOW()
        WHERE (LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(venue_name) LIKE $1)
          AND category != 'Comedy'
        RETURNING id
      `, [`%${term.toLowerCase()}%`]);
      
      stats.updated += result.rowCount;
      if (result.rowCount > 0) {
        console.log(`[ComedyScraper] Re-categorized ${result.rowCount} events matching "${term}"`);
      }
    } catch (e) {
      console.error(`[ComedyScraper] Error searching for ${term}:`, e.message);
    }
  }
  
  return stats;
}

// Use Ticketmaster API to find comedy events
async function scrapeTicketmasterComedy() {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.log('[ComedyScraper] No Ticketmaster API key, skipping');
    return { found: 0, added: 0 };
  }
  
  const stats = { found: 0, added: 0 };
  
  try {
    // Search for comedy classification
    const url = `https://app.ticketmaster.com/discovery/v2/events.json`;
    const params = {
      apikey: apiKey,
      classificationName: 'Comedy',
      countryCode: 'US',
      size: 200,
      sort: 'date,asc'
    };
    
    const response = await axios.get(url, { params, timeout: 30000 });
    const events = response.data?._embedded?.events || [];
    
    stats.found = events.length;
    console.log(`[ComedyScraper] Found ${events.length} comedy events from Ticketmaster`);
    
    for (const event of events) {
      try {
        const venue = event._embedded?.venues?.[0] || {};
        
        const eventData = {
          title: event.name,
          description: event.info || event.pleaseNote || `Comedy event featuring ${event.name}`,
          category: 'Comedy',
          source: 'ticketmaster',
          source_id: event.id,
          venue_name: venue.name,
          city: venue.city?.name,
          state: venue.state?.name || venue.state?.stateCode,
          country: venue.country?.countryCode || 'US',
          latitude: venue.location?.latitude,
          longitude: venue.location?.longitude,
          start_time: event.dates?.start?.dateTime || event.dates?.start?.localDate,
          image_url: event.images?.find(i => i.ratio === '16_9')?.url || event.images?.[0]?.url,
          ticket_url: event.url,
          price_min: event.priceRanges?.[0]?.min,
          price_max: event.priceRanges?.[0]?.max,
        };
        
        // Try to geocode if missing coords
        if (!eventData.latitude && eventData.city) {
          await fillLocation(eventData);
        }
        
        await Event.upsert(eventData);
        stats.added++;
        
      } catch (e) {
        console.error(`[ComedyScraper] Error saving event:`, e.message);
      }
    }
    
  } catch (error) {
    console.error('[ComedyScraper] Ticketmaster API error:', error.message);
  }
  
  return stats;
}

// Main scrape function
async function scrapeComedy() {
  console.log('[ComedyScraper] Starting comedy event collection...');
  
  const results = {
    recategorized: 0,
    ticketmaster: { found: 0, added: 0 },
  };
  
  // Step 1: Re-categorize existing events that are actually comedy
  const recat = await recategorizeComedyEvents();
  results.recategorized = recat.updated;
  
  // Step 2: Scrape from Ticketmaster
  results.ticketmaster = await scrapeTicketmasterComedy();
  
  console.log('[ComedyScraper] Complete:', results);
  return results;
}

module.exports = {
  scrapeComedy,
  recategorizeComedyEvents,
  scrapeTicketmasterComedy,
  COMEDIANS,
  COMEDY_VENUES
};
