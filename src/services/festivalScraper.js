const axios = require('axios');
const Event = require('../models/Event');

// Festival and fair databases
const FESTIVAL_SOURCES = [
  // Music Festival Wizard data
  { 
    url: 'https://www.musicfestivalwizard.com/wp-json/mfw/v1/festivals',
    name: 'Music Festival Wizard',
    transform: (item) => ({
      title: item.title || item.name,
      description: item.description,
      start_time: item.start_date,
      end_time: item.end_date,
      venue_name: item.venue,
      city: item.city,
      state: item.state,
      category: 'Music',
      subcategory: 'Festival',
      ticket_url: item.website || item.url,
      image_url: item.image,
    })
  },
];

// State fair dates (manually curated - these are huge events)
const STATE_FAIRS = [
  { title: 'Texas State Fair', city: 'Dallas', state: 'TX', start: '2026-09-25', end: '2026-10-18', venue: 'Fair Park' },
  { title: 'Minnesota State Fair', city: 'St. Paul', state: 'MN', start: '2026-08-27', end: '2026-09-07', venue: 'Minnesota State Fairgrounds' },
  { title: 'Iowa State Fair', city: 'Des Moines', state: 'IA', start: '2026-08-13', end: '2026-08-23', venue: 'Iowa State Fairgrounds' },
  { title: 'Ohio State Fair', city: 'Columbus', state: 'OH', start: '2026-07-22', end: '2026-08-02', venue: 'Ohio Expo Center' },
  { title: 'California State Fair', city: 'Sacramento', state: 'CA', start: '2026-07-17', end: '2026-08-03', venue: 'Cal Expo' },
  { title: 'Arizona State Fair', city: 'Phoenix', state: 'AZ', start: '2026-09-23', end: '2026-11-01', venue: 'Arizona State Fairgrounds' },
  { title: 'Florida State Fair', city: 'Tampa', state: 'FL', start: '2026-02-05', end: '2026-02-16', venue: 'Florida State Fairgrounds' },
  { title: 'Georgia State Fair', city: 'Macon', state: 'GA', start: '2026-05-21', end: '2026-06-01', venue: 'Central City Park' },
  { title: 'New York State Fair', city: 'Syracuse', state: 'NY', start: '2026-08-26', end: '2026-09-07', venue: 'New York State Fairgrounds' },
  { title: 'North Carolina State Fair', city: 'Raleigh', state: 'NC', start: '2026-10-15', end: '2026-10-25', venue: 'NC State Fairgrounds' },
  { title: 'Indiana State Fair', city: 'Indianapolis', state: 'IN', start: '2026-07-31', end: '2026-08-23', venue: 'Indiana State Fairgrounds' },
  { title: 'Illinois State Fair', city: 'Springfield', state: 'IL', start: '2026-08-13', end: '2026-08-23', venue: 'Illinois State Fairgrounds' },
  { title: 'Wisconsin State Fair', city: 'West Allis', state: 'WI', start: '2026-08-06', end: '2026-08-16', venue: 'Wisconsin State Fair Park' },
  { title: 'Washington State Fair', city: 'Puyallup', state: 'WA', start: '2026-09-04', end: '2026-09-27', venue: 'Washington State Fair Events Center' },
  { title: 'Oklahoma State Fair', city: 'Oklahoma City', state: 'OK', start: '2026-09-17', end: '2026-09-27', venue: 'State Fair Park' },
  { title: 'Kentucky State Fair', city: 'Louisville', state: 'KY', start: '2026-08-20', end: '2026-08-30', venue: 'Kentucky Exposition Center' },
  { title: 'Tennessee State Fair', city: 'Nashville', state: 'TN', start: '2026-09-11', end: '2026-09-20', venue: 'Wilson County Fairgrounds' },
  { title: 'Colorado State Fair', city: 'Pueblo', state: 'CO', start: '2026-08-28', end: '2026-09-07', venue: 'Colorado State Fairgrounds' },
  { title: 'Oregon State Fair', city: 'Salem', state: 'OR', start: '2026-08-28', end: '2026-09-07', venue: 'Oregon State Fairgrounds' },
  { title: 'Michigan State Fair', city: 'Novi', state: 'MI', start: '2026-09-03', end: '2026-09-06', venue: 'Suburban Collection Showplace' },
];

// Major US music festivals 2026
const MUSIC_FESTIVALS = [
  { title: 'Coachella Valley Music and Arts Festival', city: 'Indio', state: 'CA', start: '2026-04-10', end: '2026-04-19', venue: 'Empire Polo Club', category: 'Music', subcategory: 'Festival' },
  { title: 'Lollapalooza', city: 'Chicago', state: 'IL', start: '2026-07-30', end: '2026-08-02', venue: 'Grant Park', category: 'Music', subcategory: 'Festival' },
  { title: 'Austin City Limits Music Festival', city: 'Austin', state: 'TX', start: '2026-10-02', end: '2026-10-11', venue: 'Zilker Park', category: 'Music', subcategory: 'Festival' },
  { title: 'Bonnaroo Music & Arts Festival', city: 'Manchester', state: 'TN', start: '2026-06-11', end: '2026-06-14', venue: 'Great Stage Park', category: 'Music', subcategory: 'Festival' },
  { title: 'Electric Daisy Carnival Las Vegas', city: 'Las Vegas', state: 'NV', start: '2026-05-15', end: '2026-05-17', venue: 'Las Vegas Motor Speedway', category: 'Music', subcategory: 'Electronic' },
  { title: 'Ultra Music Festival', city: 'Miami', state: 'FL', start: '2026-03-27', end: '2026-03-29', venue: 'Bayfront Park', category: 'Music', subcategory: 'Electronic' },
  { title: 'Electric Forest', city: 'Rothbury', state: 'MI', start: '2026-06-25', end: '2026-06-28', venue: 'Double JJ Resort', category: 'Music', subcategory: 'Electronic' },
  { title: 'Outside Lands', city: 'San Francisco', state: 'CA', start: '2026-08-07', end: '2026-08-09', venue: 'Golden Gate Park', category: 'Music', subcategory: 'Festival' },
  { title: 'Governors Ball', city: 'New York', state: 'NY', start: '2026-06-05', end: '2026-06-07', venue: 'Flushing Meadows Corona Park', category: 'Music', subcategory: 'Festival' },
  { title: 'Firefly Music Festival', city: 'Dover', state: 'DE', start: '2026-06-18', end: '2026-06-21', venue: 'The Woodlands', category: 'Music', subcategory: 'Festival' },
  { title: 'Pitchfork Music Festival', city: 'Chicago', state: 'IL', start: '2026-07-17', end: '2026-07-19', venue: 'Union Park', category: 'Music', subcategory: 'Festival' },
  { title: 'Riot Fest', city: 'Chicago', state: 'IL', start: '2026-09-18', end: '2026-09-20', venue: 'Douglass Park', category: 'Music', subcategory: 'Festival' },
  { title: 'Life Is Beautiful', city: 'Las Vegas', state: 'NV', start: '2026-09-18', end: '2026-09-20', venue: 'Downtown Las Vegas', category: 'Music', subcategory: 'Festival' },
  { title: 'BottleRock Napa Valley', city: 'Napa', state: 'CA', start: '2026-05-22', end: '2026-05-24', venue: 'Napa Valley Expo', category: 'Music', subcategory: 'Festival' },
  { title: 'Hangout Music Festival', city: 'Gulf Shores', state: 'AL', start: '2026-05-15', end: '2026-05-17', venue: 'Gulf Shores Beach', category: 'Music', subcategory: 'Festival' },
  { title: 'Shaky Knees Music Festival', city: 'Atlanta', state: 'GA', start: '2026-05-01', end: '2026-05-03', venue: 'Central Park Atlanta', category: 'Music', subcategory: 'Festival' },
  { title: 'Stagecoach Festival', city: 'Indio', state: 'CA', start: '2026-04-24', end: '2026-04-26', venue: 'Empire Polo Club', category: 'Music', subcategory: 'Country' },
  { title: 'CMA Fest', city: 'Nashville', state: 'TN', start: '2026-06-04', end: '2026-06-07', venue: 'Nissan Stadium', category: 'Music', subcategory: 'Country' },
  { title: 'New Orleans Jazz & Heritage Festival', city: 'New Orleans', state: 'LA', start: '2026-04-23', end: '2026-05-03', venue: 'Fair Grounds Race Course', category: 'Music', subcategory: 'Jazz' },
  { title: 'Essence Festival', city: 'New Orleans', state: 'LA', start: '2026-07-02', end: '2026-07-05', venue: 'Caesars Superdome', category: 'Music', subcategory: 'R&B' },
  { title: 'Rolling Loud Miami', city: 'Miami', state: 'FL', start: '2026-07-24', end: '2026-07-26', venue: 'Hard Rock Stadium', category: 'Music', subcategory: 'Hip-Hop' },
  { title: 'Summerfest', city: 'Milwaukee', state: 'WI', start: '2026-06-25', end: '2026-07-11', venue: 'Henry Maier Festival Park', category: 'Music', subcategory: 'Festival' },
  { title: 'SXSW Music Festival', city: 'Austin', state: 'TX', start: '2026-03-13', end: '2026-03-22', venue: 'Various Venues', category: 'Music', subcategory: 'Festival' },
  { title: 'Burning Man', city: 'Black Rock City', state: 'NV', start: '2026-08-30', end: '2026-09-07', venue: 'Black Rock Desert', category: 'Arts', subcategory: 'Festival' },
];

async function syncAll() {
  console.log('[Festivals] ====== STARTING FESTIVAL SYNC ======');
  let totalAdded = 0;

  // Add state fairs
  for (const fair of STATE_FAIRS) {
    try {
      await Event.upsert({
        source: 'festivals',
        source_id: `fair_${fair.state.toLowerCase()}_statefair`,
        title: fair.title,
        description: `Annual ${fair.title} - One of America's largest state fairs featuring rides, food, entertainment, and agricultural exhibits.`,
        category: 'Festival',
        subcategory: 'State Fair',
        venue_name: fair.venue,
        city: fair.city,
        state: fair.state,
        country: 'US',
        start_time: new Date(fair.start),
        end_time: new Date(fair.end),
        is_free: false,
      });
      totalAdded++;
    } catch (err) {}
  }
  console.log(`[Festivals] State Fairs: +${STATE_FAIRS.length} events`);

  // Add music festivals
  for (const fest of MUSIC_FESTIVALS) {
    try {
      await Event.upsert({
        source: 'festivals',
        source_id: `fest_${fest.title.toLowerCase().replace(/\s+/g, '_').substring(0, 30)}`,
        title: fest.title,
        description: `${fest.title} - Major music festival in ${fest.city}, ${fest.state}`,
        category: fest.category,
        subcategory: fest.subcategory,
        venue_name: fest.venue,
        city: fest.city,
        state: fest.state,
        country: 'US',
        start_time: new Date(fest.start),
        end_time: new Date(fest.end),
        is_free: false,
      });
      totalAdded++;
    } catch (err) {}
  }
  console.log(`[Festivals] Music Festivals: +${MUSIC_FESTIVALS.length} events`);

  console.log(`[Festivals] ====== SYNC COMPLETE: +${totalAdded} events ======`);
  return totalAdded;
}

const syncMajorCities = syncAll;

module.exports = { syncAll, syncMajorCities, STATE_FAIRS, MUSIC_FESTIVALS };
