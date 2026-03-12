const axios = require('axios');
const cheerio = require('cheerio');
const Event = require('../models/Event');

// City government event calendars
const CITY_CALENDARS = [
  // Florida
  { name: 'Miami', url: 'https://www.miamigov.com/Events-Calendar', state: 'FL' },
  { name: 'Orlando', url: 'https://www.orlando.gov/Our-Community/Events', state: 'FL' },
  { name: 'Tampa', url: 'https://www.tampa.gov/events', state: 'FL' },
  { name: 'Jacksonville', url: 'https://www.coj.net/events', state: 'FL' },
  { name: 'St. Petersburg', url: 'https://www.stpete.org/events', state: 'FL' },
  // Major cities
  { name: 'New York', url: 'https://www.nyc.gov/events', state: 'NY' },
  { name: 'Los Angeles', url: 'https://www.lacity.org/events', state: 'CA' },
  { name: 'Chicago', url: 'https://www.chicago.gov/city/en/depts/dca/supp_info/events.html', state: 'IL' },
  { name: 'Houston', url: 'https://www.houstontx.gov/events', state: 'TX' },
  { name: 'Phoenix', url: 'https://www.phoenix.gov/calendar', state: 'AZ' },
  { name: 'San Antonio', url: 'https://www.sanantonio.gov/Events', state: 'TX' },
  { name: 'San Diego', url: 'https://www.sandiego.gov/events', state: 'CA' },
  { name: 'Dallas', url: 'https://www.dallascityhall.com/events', state: 'TX' },
  { name: 'Austin', url: 'https://www.austintexas.gov/events', state: 'TX' },
  { name: 'Seattle', url: 'https://www.seattle.gov/events', state: 'WA' },
  { name: 'Denver', url: 'https://www.denvergov.org/events', state: 'CO' },
  { name: 'Boston', url: 'https://www.boston.gov/events', state: 'MA' },
  { name: 'Nashville', url: 'https://www.nashville.gov/events', state: 'TN' },
  { name: 'Portland', url: 'https://www.portland.gov/events', state: 'OR' },
  { name: 'Las Vegas', url: 'https://www.lasvegasnevada.gov/Events', state: 'NV' },
  { name: 'Atlanta', url: 'https://www.atlantaga.gov/events', state: 'GA' },
  { name: 'Philadelphia', url: 'https://www.phila.gov/events', state: 'PA' },
  { name: 'San Francisco', url: 'https://sf.gov/events', state: 'CA' },
  { name: 'New Orleans', url: 'https://www.nola.gov/events', state: 'LA' },
  { name: 'Minneapolis', url: 'https://www.minneapolismn.gov/events', state: 'MN' },
];

async function scrapeCity(calendar) {
  const events = [];

  try {
    const response = await axios.get(calendar.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // Generic event parsing for government sites
    $('[class*="event"], .calendar-item, article, .views-row, li[class*="event"], .event-listing').each((i, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .event-title, .title, a').first().text().trim();
        const dateText = $el.find('time, .date, [class*="date"]').first().text().trim() ||
                        $el.find('time').attr('datetime');
        const venue = $el.find('.location, .venue, [class*="location"]').first().text().trim();
        const link = $el.find('a').first().attr('href');
        const desc = $el.find('.description, .summary, .teaser, p').first().text().trim();

        if (title && title.length > 5 && title.length < 200) {
          events.push({
            title,
            dateText,
            venue: venue || `${calendar.name} City Event`,
            link: link ? (link.startsWith('http') ? link : calendar.url.split('/').slice(0, 3).join('/') + link) : calendar.url,
            description: desc?.substring(0, 500),
            city: calendar.name,
            state: calendar.state
          });
        }
      } catch (err) {}
    });

  } catch (error) {
    // Many gov sites have varied structures
    console.log(`[CityGov] Skipping ${calendar.name}: ${error.message}`);
  }

  return events.slice(0, 30);
}

function parseDate(dateText) {
  if (!dateText) return null;
  try {
    const date = new Date(dateText);
    if (!isNaN(date) && date > new Date()) return date.toISOString();
    
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

function detectCategory(title) {
  const lower = title.toLowerCase();
  if (lower.includes('meeting') || lower.includes('council') || lower.includes('hearing')) return 'Community';
  if (lower.includes('festival') || lower.includes('celebration')) return 'Festivals';
  if (lower.includes('concert') || lower.includes('music')) return 'Music';
  if (lower.includes('market') || lower.includes('farmers')) return 'Food & Drink';
  if (lower.includes('parade')) return 'Cultural';
  if (lower.includes('art') || lower.includes('exhibit')) return 'Arts & Theatre';
  if (lower.includes('sports') || lower.includes('race') || lower.includes('run')) return 'Sports';
  if (lower.includes('kids') || lower.includes('family') || lower.includes('children')) return 'Family & Kids';
  return 'Community';
}

async function syncCalendar(calendar) {
  console.log(`[CityGov] Syncing ${calendar.name}...`);
  const rawEvents = await scrapeCity(calendar);
  let added = 0;

  for (const raw of rawEvents) {
    try {
      const startTime = parseDate(raw.dateText);
      if (!startTime) continue;

      const eventData = {
        source: 'citygov',
        source_id: `gov_${Buffer.from(raw.title + calendar.name).toString('base64').substring(0, 24)}`,
        title: raw.title,
        description: raw.description,
        category: detectCategory(raw.title),
        subcategory: `${calendar.name} City Event`,
        venue_name: raw.venue,
        city: raw.city,
        state: raw.state,
        country: 'US',
        start_time: startTime,
        ticket_url: raw.link,
        is_free: true, // Most city events are free
      };

      await Event.upsert(eventData);
      added++;
    } catch (err) {}
  }

  console.log(`[CityGov] ${calendar.name}: ${added} events`);
  return added;
}

async function syncAll() {
  let total = 0;
  for (const calendar of CITY_CALENDARS) {
    total += await syncCalendar(calendar);
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`[CityGov] Total: ${total} events`);
  return total;
}

module.exports = { syncCalendar, syncAll };
