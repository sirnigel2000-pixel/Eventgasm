const cheerio = require('cheerio');
const Event = require('../models/Event');
const { resilientFetch, isBlocked, sleep } = require('../utils/resilientScraper');

// Craigslist city subdomains
const CITIES = [
  { subdomain: 'newyork', city: 'New York', state: 'NY' },
  { subdomain: 'losangeles', city: 'Los Angeles', state: 'CA' },
  { subdomain: 'chicago', city: 'Chicago', state: 'IL' },
  { subdomain: 'houston', city: 'Houston', state: 'TX' },
  { subdomain: 'miami', city: 'Miami', state: 'FL' },
  { subdomain: 'orlando', city: 'Orlando', state: 'FL' },
  { subdomain: 'tampa', city: 'Tampa', state: 'FL' },
  { subdomain: 'sfbay', city: 'San Francisco', state: 'CA' },
  { subdomain: 'seattle', city: 'Seattle', state: 'WA' },
  { subdomain: 'denver', city: 'Denver', state: 'CO' },
  { subdomain: 'austin', city: 'Austin', state: 'TX' },
  { subdomain: 'nashville', city: 'Nashville', state: 'TN' },
  { subdomain: 'atlanta', city: 'Atlanta', state: 'GA' },
  { subdomain: 'boston', city: 'Boston', state: 'MA' },
  { subdomain: 'phoenix', city: 'Phoenix', state: 'AZ' },
  { subdomain: 'sandiego', city: 'San Diego', state: 'CA' },
  { subdomain: 'philadelphia', city: 'Philadelphia', state: 'PA' },
  { subdomain: 'portland', city: 'Portland', state: 'OR' },
  { subdomain: 'lasvegas', city: 'Las Vegas', state: 'NV' },
  { subdomain: 'neworleans', city: 'New Orleans', state: 'LA' },
];

async function scrapeCity(subdomain, cityName, state) {
  const url = `https://${subdomain}.craigslist.org/search/eve`;
  const events = [];

  // Check if domain is blocked (rate limited)
  if (isBlocked(url)) {
    console.log(`[Craigslist] ${subdomain} in cooldown, skipping`);
    return events;
  }

  try {
    // Use resilient fetch with auto-retry and block detection
    const response = await resilientFetch(url, { timeout: 15000 });
    
    if (!response || !response.data) {
      console.log(`[Craigslist] No data for ${subdomain}`);
      return events;
    }

    const $ = cheerio.load(response.data);

    $('.cl-search-result, .result-row, li.result-row').each((i, el) => {
      try {
        const $el = $(el);
        const title = $el.find('.titlestring, .result-title, a.posting-title').text().trim();
        const link = $el.find('a').first().attr('href');
        const dateText = $el.find('time, .result-date').attr('datetime') || $el.find('time').text();
        const hood = $el.find('.result-hood, .nearby').text().replace(/[()]/g, '').trim();

        if (title && link) {
          events.push({
            title,
            link: link.startsWith('http') ? link : `https://${subdomain}.craigslist.org${link}`,
            dateText,
            venue: hood || cityName,
            city: cityName,
            state
          });
        }
      } catch (err) {}
    });

  } catch (error) {
    console.error(`[Craigslist] Error scraping ${subdomain}:`, error.message);
  }

  return events;
}

function parseDate(dateText) {
  if (!dateText) return null;
  try {
    const date = new Date(dateText);
    if (!isNaN(date) && date > new Date()) return date.toISOString();
  } catch {}
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Default to 1 week out
}

async function syncCity(subdomain, cityName, state) {
  console.log(`[Craigslist] Syncing ${cityName}...`);
  const rawEvents = await scrapeCity(subdomain, cityName, state);
  let added = 0;

  for (const raw of rawEvents) {
    try {
      const eventData = {
        source: 'craigslist',
        source_id: `cl_${Buffer.from(raw.link).toString('base64').substring(0, 24)}`,
        title: raw.title,
        category: 'Community',
        venue_name: raw.venue,
        city: raw.city,
        state: raw.state,
        country: 'US',
        start_time: parseDate(raw.dateText),
        ticket_url: raw.link,
        is_free: raw.title.toLowerCase().includes('free'),
      };

      await Event.upsert(eventData);
      added++;
    } catch (err) {}
  }

  console.log(`[Craigslist] ${cityName}: ${added} events`);
  return added;
}

async function syncAll() {
  let total = 0;
  for (const city of CITIES) {
    total += await syncCity(city.subdomain, city.city, city.state);
    await new Promise(r => setTimeout(r, 3000));
  }
  console.log(`[Craigslist] Total: ${total} events`);
  return total;
}

module.exports = { syncCity, syncAll };
