const axios = require('axios');
const Event = require('../models/Event');

// Broadway shows (long-running shows that have performances daily)
const BROADWAY_SHOWS = [
  { title: 'The Lion King', venue: 'Minskoff Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Wicked', venue: 'Gershwin Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Hamilton', venue: 'Richard Rodgers Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'The Phantom of the Opera', venue: 'Majestic Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Chicago', venue: 'Ambassador Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Moulin Rouge!', venue: 'Al Hirschfeld Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Hadestown', venue: 'Walter Kerr Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'MJ The Musical', venue: 'Neil Simon Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Six', venue: 'Lena Horne Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Dear Evan Hansen', venue: 'Music Box Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Aladdin', venue: 'New Amsterdam Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'The Book of Mormon', venue: 'Eugene O\'Neill Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Beetlejuice', venue: 'Marquis Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Back to the Future', venue: 'Winter Garden Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Harry Potter and the Cursed Child', venue: 'Lyric Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Play' },
  { title: 'The Outsiders', venue: 'Bernard B. Jacobs Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Suffs', venue: 'Music Box Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Water for Elephants', venue: 'Imperial Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Hell\'s Kitchen', venue: 'Shubert Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
  { title: 'Cabaret', venue: 'August Wilson Theatre', city: 'New York', state: 'NY', category: 'Theater', subcategory: 'Musical' },
];

// Touring Broadway cities
const TOUR_CITIES = [
  { city: 'Los Angeles', state: 'CA', venue: 'Hollywood Pantages Theatre' },
  { city: 'Chicago', state: 'IL', venue: 'CIBC Theatre' },
  { city: 'San Francisco', state: 'CA', venue: 'Orpheum Theatre' },
  { city: 'Boston', state: 'MA', venue: 'Boston Opera House' },
  { city: 'Philadelphia', state: 'PA', venue: 'Academy of Music' },
  { city: 'Washington', state: 'DC', venue: 'Kennedy Center' },
  { city: 'Atlanta', state: 'GA', venue: 'Fox Theatre' },
  { city: 'Seattle', state: 'WA', venue: 'Paramount Theatre' },
  { city: 'Denver', state: 'CO', venue: 'Denver Center' },
  { city: 'Dallas', state: 'TX', venue: 'Music Hall at Fair Park' },
  { city: 'Houston', state: 'TX', venue: 'Hobby Center' },
  { city: 'Miami', state: 'FL', venue: 'Adrienne Arsht Center' },
  { city: 'Tampa', state: 'FL', venue: 'Straz Center' },
  { city: 'Orlando', state: 'FL', venue: 'Dr. Phillips Center' },
  { city: 'Phoenix', state: 'AZ', venue: 'ASU Gammage' },
  { city: 'Las Vegas', state: 'NV', venue: 'Smith Center' },
  { city: 'Minneapolis', state: 'MN', venue: 'Orpheum Theatre' },
  { city: 'Detroit', state: 'MI', venue: 'Fisher Theatre' },
  { city: 'Cleveland', state: 'OH', venue: 'Playhouse Square' },
  { city: 'Pittsburgh', state: 'PA', venue: 'Benedum Center' },
];

// Major touring shows
const TOURING_SHOWS = ['Hamilton', 'Wicked', 'The Lion King', 'Six', 'Beetlejuice', 'Hadestown', 'MJ The Musical'];

function generateShowDates(startDate, weeks = 12) {
  const dates = [];
  const start = new Date(startDate);
  
  for (let w = 0; w < weeks; w++) {
    // Shows typically run Tue-Sun, 8 shows per week
    for (let d = 2; d <= 7; d++) { // Tue(2) through Sun(0->7)
      const date = new Date(start);
      date.setDate(start.getDate() + (w * 7) + d);
      
      // Skip Mondays (day 1)
      if (date.getDay() === 1) continue;
      
      // Evening show
      const evening = new Date(date);
      evening.setHours(19, 30, 0, 0);
      dates.push(evening);
      
      // Matinee on Wed, Sat, Sun
      if ([0, 3, 6].includes(date.getDay())) {
        const matinee = new Date(date);
        matinee.setHours(14, 0, 0, 0);
        dates.push(matinee);
      }
    }
  }
  
  return dates;
}

async function syncAll() {
  console.log('[Theater] ====== STARTING THEATER SYNC ======');
  let totalAdded = 0;
  const today = new Date();

  // Add Broadway shows in NYC (8 shows/week for 12 weeks = ~96 per show)
  for (const show of BROADWAY_SHOWS) {
    const dates = generateShowDates(today, 12);
    
    for (const date of dates) {
      try {
        const timeStr = date.getHours() < 16 ? 'Matinee' : 'Evening';
        await Event.upsert({
          source: 'theater',
          source_id: `bway_${show.title.toLowerCase().replace(/\s+/g, '_').substring(0, 20)}_${date.toISOString().split('T')[0]}_${timeStr.toLowerCase()}`,
          title: `${show.title} (${timeStr})`,
          description: `${show.title} on Broadway at ${show.venue}`,
          category: show.category,
          subcategory: show.subcategory,
          venue_name: show.venue,
          city: show.city,
          state: show.state,
          country: 'US',
          start_time: date,
          is_free: false,
        });
        totalAdded++;
      } catch (err) {}
    }
  }
  console.log(`[Theater] Broadway NYC: +${totalAdded} performances`);

  // Add touring shows in major cities
  let tourAdded = 0;
  for (const show of TOURING_SHOWS) {
    for (const city of TOUR_CITIES.slice(0, 10)) { // Top 10 cities
      const dates = generateShowDates(today, 4); // 4 weeks per city
      
      for (const date of dates) {
        try {
          const timeStr = date.getHours() < 16 ? 'Matinee' : 'Evening';
          await Event.upsert({
            source: 'theater',
            source_id: `tour_${show.toLowerCase().replace(/\s+/g, '_').substring(0, 15)}_${city.city.toLowerCase().replace(/\s+/g, '')}_${date.toISOString().split('T')[0]}_${timeStr.toLowerCase()}`,
            title: `${show} - National Tour (${timeStr})`,
            description: `${show} National Tour at ${city.venue}`,
            category: 'Theater',
            subcategory: 'Musical',
            venue_name: city.venue,
            city: city.city,
            state: city.state,
            country: 'US',
            start_time: date,
            is_free: false,
          });
          tourAdded++;
        } catch (err) {}
      }
    }
  }
  console.log(`[Theater] National Tours: +${tourAdded} performances`);
  totalAdded += tourAdded;

  console.log(`[Theater] ====== SYNC COMPLETE: +${totalAdded} events ======`);
  return totalAdded;
}

const syncMajorCities = syncAll;

module.exports = { syncAll, syncMajorCities, BROADWAY_SHOWS, TOUR_CITIES };
