const axios = require('axios');
const cheerio = require('cheerio');
const Event = require('../models/Event');

// Resident Advisor regions (electronic music/nightlife)
const REGIONS = [
  { slug: 'us/newyork', city: 'New York', state: 'NY' },
  { slug: 'us/losangeles', city: 'Los Angeles', state: 'CA' },
  { slug: 'us/chicago', city: 'Chicago', state: 'IL' },
  { slug: 'us/sanfrancisco', city: 'San Francisco', state: 'CA' },
  { slug: 'us/miami', city: 'Miami', state: 'FL' },
  { slug: 'us/detroit', city: 'Detroit', state: 'MI' },
  { slug: 'us/seattle', city: 'Seattle', state: 'WA' },
  { slug: 'us/denver', city: 'Denver', state: 'CO' },
  { slug: 'us/austin', city: 'Austin', state: 'TX' },
  { slug: 'us/portland', city: 'Portland', state: 'OR' },
  { slug: 'us/atlanta', city: 'Atlanta', state: 'GA' },
  { slug: 'us/boston', city: 'Boston', state: 'MA' },
  { slug: 'us/lasvegas', city: 'Las Vegas', state: 'NV' },
  { slug: 'us/neworleans', city: 'New Orleans', state: 'LA' },
  { slug: 'us/philadelphia', city: 'Philadelphia', state: 'PA' },
  { slug: 'us/washingtondc', city: 'Washington', state: 'DC' },
];

async function scrapeRegion(slug, cityName, state) {
  const url = `https://ra.co/events/${slug}`;
  const events = [];

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // RA event listings
    $('[data-testid="event-listing"], .event-listing, article').each((i, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h3, .event-title, [data-testid="event-title"]').text().trim();
        const venue = $el.find('.venue, [data-testid="venue-name"]').text().trim();
        const dateText = $el.find('time, .date').attr('datetime') || $el.find('time').text().trim();
        const link = $el.find('a').first().attr('href');
        const image = $el.find('img').first().attr('src');

        if (title) {
          events.push({
            title,
            venue: venue || 'TBA',
            dateText,
            link: link ? (link.startsWith('http') ? link : `https://ra.co${link}`) : null,
            image,
            city: cityName,
            state
          });
        }
      } catch (err) {}
    });

  } catch (error) {
    if (error.response?.status !== 404) {
      console.error(`[RA] Error scraping ${slug}:`, error.message);
    }
  }

  return events;
}

function parseDate(dateText) {
  if (!dateText) return null;
  try {
    const date = new Date(dateText);
    if (!isNaN(date) && date > new Date()) return date.toISOString();
    
    // Try parsing "Sat, 15 Mar" format
    const match = dateText.match(/(\w+),?\s*(\d+)\s*(\w+)/);
    if (match) {
      const year = new Date().getFullYear();
      const parsed = new Date(`${match[3]} ${match[2]}, ${year}`);
      if (!isNaN(parsed)) {
        if (parsed < new Date()) parsed.setFullYear(year + 1);
        return parsed.toISOString();
      }
    }
  } catch {}
  return null;
}

async function syncRegion(slug, cityName, state) {
  console.log(`[Resident Advisor] Syncing ${cityName}...`);
  const rawEvents = await scrapeRegion(slug, cityName, state);
  let added = 0;

  for (const raw of rawEvents) {
    try {
      const startTime = parseDate(raw.dateText);
      if (!startTime) continue;

      const eventData = {
        source: 'residentadvisor',
        source_id: `ra_${Buffer.from(raw.title + raw.dateText).toString('base64').substring(0, 24)}`,
        title: raw.title,
        category: 'Music',
        subcategory: 'Electronic/DJ',
        venue_name: raw.venue,
        city: raw.city,
        state: raw.state,
        country: 'US',
        start_time: startTime,
        image_url: raw.image,
        ticket_url: raw.link,
      };

      await Event.upsert(eventData);
      added++;
    } catch (err) {}
  }

  console.log(`[Resident Advisor] ${cityName}: ${added} events`);
  return added;
}

async function syncAll() {
  let total = 0;
  for (const region of REGIONS) {
    total += await syncRegion(region.slug, region.city, region.state);
    await new Promise(r => setTimeout(r, 3000));
  }
  console.log(`[Resident Advisor] Total: ${total} events`);
  return total;
}

module.exports = { syncRegion, syncAll };
