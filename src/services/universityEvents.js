const axios = require('axios');
const cheerio = require('cheerio');
const Event = require('../models/Event');

// Major universities with public event calendars
const UNIVERSITIES = [
  // Florida
  { name: 'University of Florida', url: 'https://calendar.ufl.edu', city: 'Gainesville', state: 'FL' },
  { name: 'University of Central Florida', url: 'https://events.ucf.edu', city: 'Orlando', state: 'FL' },
  { name: 'Florida State University', url: 'https://calendar.fsu.edu', city: 'Tallahassee', state: 'FL' },
  { name: 'University of Miami', url: 'https://calendar.miami.edu', city: 'Miami', state: 'FL' },
  { name: 'University of South Florida', url: 'https://www.usf.edu/calendar', city: 'Tampa', state: 'FL' },
  // Major state schools
  { name: 'UCLA', url: 'https://happenings.ucla.edu', city: 'Los Angeles', state: 'CA' },
  { name: 'UC Berkeley', url: 'https://events.berkeley.edu', city: 'Berkeley', state: 'CA' },
  { name: 'University of Texas', url: 'https://events.utexas.edu', city: 'Austin', state: 'TX' },
  { name: 'University of Michigan', url: 'https://events.umich.edu', city: 'Ann Arbor', state: 'MI' },
  { name: 'Ohio State University', url: 'https://events.osu.edu', city: 'Columbus', state: 'OH' },
  { name: 'Penn State', url: 'https://events.psu.edu', city: 'State College', state: 'PA' },
  { name: 'University of Wisconsin', url: 'https://today.wisc.edu/events', city: 'Madison', state: 'WI' },
  { name: 'University of Washington', url: 'https://www.washington.edu/calendar', city: 'Seattle', state: 'WA' },
  { name: 'Arizona State', url: 'https://calendar.asu.edu', city: 'Tempe', state: 'AZ' },
  { name: 'University of Colorado', url: 'https://calendar.colorado.edu', city: 'Boulder', state: 'CO' },
  { name: 'Georgia Tech', url: 'https://calendar.gatech.edu', city: 'Atlanta', state: 'GA' },
  { name: 'NYU', url: 'https://events.nyu.edu', city: 'New York', state: 'NY' },
  { name: 'Columbia', url: 'https://events.columbia.edu', city: 'New York', state: 'NY' },
  { name: 'USC', url: 'https://calendar.usc.edu', city: 'Los Angeles', state: 'CA' },
  { name: 'Boston University', url: 'https://calendar.bu.edu', city: 'Boston', state: 'MA' },
];

async function scrapeUniversity(uni) {
  const events = [];

  try {
    const response = await axios.get(uni.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // Generic event parsing - most university calendars use similar structures
    $('[class*="event"], .vevent, article, .views-row, .event-item, li[class*="event"]').each((i, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .event-title, .summary, a').first().text().trim();
        const dateText = $el.find('time, .date, .dtstart, [class*="date"]').first().text().trim() || 
                        $el.find('time').attr('datetime');
        const venue = $el.find('.location, .venue, [class*="location"]').first().text().trim();
        const link = $el.find('a').first().attr('href');
        const desc = $el.find('.description, .summary, p').first().text().trim();

        if (title && title.length > 3 && title.length < 200) {
          events.push({
            title,
            dateText,
            venue: venue || uni.name,
            link: link ? (link.startsWith('http') ? link : uni.url + link) : uni.url,
            description: desc?.substring(0, 500),
            university: uni.name,
            city: uni.city,
            state: uni.state
          });
        }
      } catch (err) {}
    });

  } catch (error) {
    // Many university sites have varied structures, just skip errors
    if (error.response?.status !== 404) {
      console.log(`[University] Skipping ${uni.name}: ${error.message}`);
    }
  }

  return events.slice(0, 50); // Limit per university
}

function parseDate(dateText) {
  if (!dateText) return null;
  try {
    const date = new Date(dateText);
    if (!isNaN(date) && date > new Date()) return date.toISOString();
    
    // Try common formats
    const match = dateText.match(/(\w+)\s+(\d+),?\s*(\d{4})?/);
    if (match) {
      const year = match[3] || new Date().getFullYear();
      const parsed = new Date(`${match[1]} ${match[2]}, ${year}`);
      if (!isNaN(parsed)) {
        if (parsed < new Date()) parsed.setFullYear(parseInt(year) + 1);
        return parsed.toISOString();
      }
    }
  } catch {}
  return null;
}

// Detect category from title
function detectCategory(title) {
  const lower = title.toLowerCase();
  if (lower.includes('concert') || lower.includes('music') || lower.includes('band')) return 'Music';
  if (lower.includes('sport') || lower.includes('game') || lower.includes('match')) return 'Sports';
  if (lower.includes('art') || lower.includes('exhibit') || lower.includes('gallery')) return 'Arts & Theatre';
  if (lower.includes('lecture') || lower.includes('seminar') || lower.includes('workshop')) return 'Education';
  if (lower.includes('film') || lower.includes('movie') || lower.includes('screening')) return 'Film';
  if (lower.includes('food') || lower.includes('tasting')) return 'Food & Drink';
  if (lower.includes('career') || lower.includes('job') || lower.includes('fair')) return 'Education';
  return 'Community';
}

async function syncUniversity(uni) {
  console.log(`[University] Syncing ${uni.name}...`);
  const rawEvents = await scrapeUniversity(uni);
  let added = 0;

  for (const raw of rawEvents) {
    try {
      const startTime = parseDate(raw.dateText);
      if (!startTime) continue;

      const eventData = {
        source: 'university',
        source_id: `uni_${Buffer.from(raw.title + uni.name).toString('base64').substring(0, 24)}`,
        title: raw.title,
        description: raw.description,
        category: detectCategory(raw.title),
        subcategory: raw.university,
        venue_name: raw.venue,
        city: raw.city,
        state: raw.state,
        country: 'US',
        start_time: startTime,
        ticket_url: raw.link,
        is_free: true, // Most university events are free/open
      };

      await Event.upsert(eventData);
      added++;
    } catch (err) {}
  }

  console.log(`[University] ${uni.name}: ${added} events`);
  return added;
}

async function syncAll() {
  let total = 0;
  for (const uni of UNIVERSITIES) {
    total += await syncUniversity(uni);
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`[University] Total: ${total} events`);
  return total;
}

module.exports = { syncUniversity, syncAll };
