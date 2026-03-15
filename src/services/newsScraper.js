/**
 * Local News Event Scraper
 * Scrapes local news sites for event announcements and creates events
 */
const axios = require('axios');
const cheerio = require('cheerio');
const Event = require('../models/Event');

// Major metro areas with their local news sources - comprehensive list
const NEWS_SOURCES = [
  // FLORIDA
  { city: 'Miami', state: 'FL', feeds: ['https://www.miamiherald.com/entertainment/rss/'] },
  { city: 'Orlando', state: 'FL', feeds: ['https://www.orlandosentinel.com/entertainment/rss/'] },
  { city: 'Tampa', state: 'FL', feeds: ['https://www.tampabay.com/things-to-do/feed/'] },
  { city: 'Jacksonville', state: 'FL', feeds: ['https://www.jacksonville.com/entertainment/rss/'] },
  { city: 'Fort Lauderdale', state: 'FL', feeds: ['https://www.sun-sentinel.com/entertainment/rss/'] },
  
  // CALIFORNIA
  { city: 'Los Angeles', state: 'CA', feeds: ['https://www.latimes.com/entertainment-arts/rss2.0.xml'] },
  { city: 'San Francisco', state: 'CA', feeds: ['https://www.sfchronicle.com/entertainment/feed/'] },
  { city: 'San Diego', state: 'CA', feeds: ['https://www.sandiegouniontribune.com/entertainment/rss/'] },
  { city: 'San Jose', state: 'CA', feeds: ['https://www.mercurynews.com/entertainment/feed/'] },
  { city: 'Sacramento', state: 'CA', feeds: ['https://www.sacbee.com/entertainment/rss/'] },
  { city: 'Fresno', state: 'CA', feeds: ['https://www.fresnobee.com/entertainment/rss/'] },
  
  // TEXAS
  { city: 'Houston', state: 'TX', feeds: ['https://www.houstonchronicle.com/entertainment/feed/'] },
  { city: 'Dallas', state: 'TX', feeds: ['https://www.dallasnews.com/arts-entertainment/feed/'] },
  { city: 'Austin', state: 'TX', feeds: ['https://www.austin360.com/rss/', 'https://www.statesman.com/entertainment/rss/'] },
  { city: 'San Antonio', state: 'TX', feeds: ['https://www.expressnews.com/entertainment/feed/'] },
  { city: 'Fort Worth', state: 'TX', feeds: ['https://www.star-telegram.com/entertainment/rss/'] },
  { city: 'El Paso', state: 'TX', feeds: ['https://www.elpasotimes.com/entertainment/rss/'] },
  
  // NEW YORK
  { city: 'New York', state: 'NY', feeds: ['https://www.timeout.com/newyork/rss', 'https://gothamist.com/feed'] },
  { city: 'Buffalo', state: 'NY', feeds: ['https://buffalonews.com/entertainment/rss/'] },
  { city: 'Rochester', state: 'NY', feeds: ['https://www.democratandchronicle.com/entertainment/rss/'] },
  { city: 'Albany', state: 'NY', feeds: ['https://www.timesunion.com/entertainment/feed/'] },
  
  // PENNSYLVANIA
  { city: 'Philadelphia', state: 'PA', feeds: ['https://www.inquirer.com/entertainment/rss/'] },
  { city: 'Pittsburgh', state: 'PA', feeds: ['https://www.post-gazette.com/ae/rss/'] },
  
  // ILLINOIS
  { city: 'Chicago', state: 'IL', feeds: ['https://www.chicagotribune.com/entertainment/rss/', 'https://www.timeout.com/chicago/rss'] },
  
  // OHIO
  { city: 'Columbus', state: 'OH', feeds: ['https://www.dispatch.com/entertainment/rss/'] },
  { city: 'Cleveland', state: 'OH', feeds: ['https://www.cleveland.com/entertainment/rss/'] },
  { city: 'Cincinnati', state: 'OH', feeds: ['https://www.cincinnati.com/entertainment/rss/'] },
  
  // GEORGIA
  { city: 'Atlanta', state: 'GA', feeds: ['https://www.ajc.com/entertainment/rss/'] },
  
  // NORTH CAROLINA
  { city: 'Charlotte', state: 'NC', feeds: ['https://www.charlotteobserver.com/entertainment/rss/'] },
  { city: 'Raleigh', state: 'NC', feeds: ['https://www.newsobserver.com/entertainment/rss/'] },
  
  // MICHIGAN
  { city: 'Detroit', state: 'MI', feeds: ['https://www.freep.com/entertainment/rss/'] },
  { city: 'Grand Rapids', state: 'MI', feeds: ['https://www.mlive.com/entertainment/rss/'] },
  
  // ARIZONA
  { city: 'Phoenix', state: 'AZ', feeds: ['https://www.azcentral.com/entertainment/rss/'] },
  { city: 'Tucson', state: 'AZ', feeds: ['https://tucson.com/entertainment/rss/'] },
  
  // WASHINGTON
  { city: 'Seattle', state: 'WA', feeds: ['https://www.seattletimes.com/entertainment/rss/'] },
  
  // COLORADO
  { city: 'Denver', state: 'CO', feeds: ['https://www.denverpost.com/entertainment/feed/'] },
  
  // MASSACHUSETTS
  { city: 'Boston', state: 'MA', feeds: ['https://www.boston.com/culture/entertainment/feed/'] },
  
  // MINNESOTA
  { city: 'Minneapolis', state: 'MN', feeds: ['https://www.startribune.com/entertainment/rss/'] },
  
  // MISSOURI
  { city: 'St. Louis', state: 'MO', feeds: ['https://www.stltoday.com/entertainment/rss/'] },
  { city: 'Kansas City', state: 'MO', feeds: ['https://www.kansascity.com/entertainment/rss/'] },
  
  // TENNESSEE
  { city: 'Nashville', state: 'TN', feeds: ['https://www.tennessean.com/entertainment/rss/'] },
  { city: 'Memphis', state: 'TN', feeds: ['https://www.commercialappeal.com/entertainment/rss/'] },
  
  // MARYLAND
  { city: 'Baltimore', state: 'MD', feeds: ['https://www.baltimoresun.com/entertainment/rss/'] },
  
  // WISCONSIN
  { city: 'Milwaukee', state: 'WI', feeds: ['https://www.jsonline.com/entertainment/rss/'] },
  
  // OREGON
  { city: 'Portland', state: 'OR', feeds: ['https://www.oregonlive.com/entertainment/rss/'] },
  
  // INDIANA
  { city: 'Indianapolis', state: 'IN', feeds: ['https://www.indystar.com/entertainment/rss/'] },
  
  // NEVADA
  { city: 'Las Vegas', state: 'NV', feeds: ['https://www.reviewjournal.com/entertainment/feed/'] },
  
  // LOUISIANA
  { city: 'New Orleans', state: 'LA', feeds: ['https://www.nola.com/entertainment/rss/'] },
  
  // KENTUCKY
  { city: 'Louisville', state: 'KY', feeds: ['https://www.courier-journal.com/entertainment/rss/'] },
  
  // OKLAHOMA
  { city: 'Oklahoma City', state: 'OK', feeds: ['https://www.oklahoman.com/entertainment/rss/'] },
  
  // CONNECTICUT
  { city: 'Hartford', state: 'CT', feeds: ['https://www.courant.com/entertainment/rss/'] },
  
  // UTAH
  { city: 'Salt Lake City', state: 'UT', feeds: ['https://www.sltrib.com/entertainment/rss/'] },
  { city: 'Jackson Hole', state: 'WY', feeds: ['https://www.jhnewsandguide.com/rss/'] },
  
  // ALABAMA
  { city: 'Birmingham', state: 'AL', feeds: ['https://www.al.com/entertainment/rss/'] },
  
  // SOUTH CAROLINA
  { city: 'Charleston', state: 'SC', feeds: ['https://www.postandcourier.com/entertainment/rss/'] },
  
  // IOWA
  { city: 'Des Moines', state: 'IA', feeds: ['https://www.desmoinesregister.com/entertainment/rss/'] },
  
  // NEW JERSEY
  { city: 'Newark', state: 'NJ', feeds: ['https://www.nj.com/entertainment/rss/'] },
  
  // VIRGINIA
  { city: 'Richmond', state: 'VA', feeds: ['https://richmond.com/entertainment/rss/'] },
  { city: 'Virginia Beach', state: 'VA', feeds: ['https://www.pilotonline.com/entertainment/rss/'] },
  
  // HAWAII
  { city: 'Honolulu', state: 'HI', feeds: ['https://www.staradvertiser.com/entertainment/rss/'] },
  
  // NEW MEXICO
  { city: 'Albuquerque', state: 'NM', feeds: ['https://www.abqjournal.com/entertainment/rss/'] },
  
  // NEBRASKA
  { city: 'Omaha', state: 'NE', feeds: ['https://omaha.com/entertainment/rss/'] },
  
  // ARKANSAS
  { city: 'Little Rock', state: 'AR', feeds: ['https://www.arkansasonline.com/entertainment/rss/'] },
];

// Keywords that indicate an event article
const EVENT_KEYWORDS = [
  'festival', 'concert', 'show', 'performance', 'exhibit', 'exhibition',
  'fair', 'parade', 'celebration', 'event', 'tickets', 'live music',
  'art show', 'food festival', 'beer fest', 'wine tasting', 'market',
  'carnival', 'rodeo', 'race', 'marathon', 'tournament', 'competition',
  'conference', 'convention', 'expo', 'workshop', 'seminar', 'gala',
  'fundraiser', 'benefit', 'block party', 'street fair', 'craft fair'
];

// Date patterns to extract from text
const DATE_PATTERNS = [
  /(?:on\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/gi,
  /(?:on\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*[-–]\s*\d{1,2}(?:st|nd|rd|th)?)?,?\s*\d{4})/gi,
  /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
];

// Extract potential event data from article text
function extractEventFromText(title, text, city, state) {
  const lowerText = (title + ' ' + text).toLowerCase();
  const isEventArticle = EVENT_KEYWORDS.some(kw => lowerText.includes(kw));
  
  if (!isEventArticle) return null;
  
  // Try to extract date
  let eventDate = null;
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      try {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime()) && parsed > new Date()) {
          eventDate = parsed;
          break;
        }
      } catch (e) {}
    }
  }
  
  if (!eventDate) {
    const now = new Date();
    eventDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  
  // Extract venue
  let venue = null;
  const venueMatch = text.match(/(?:at|held at|takes place at|located at)\s+(?:the\s+)?([A-Z][A-Za-z\s&']+?)(?:,|\.|on|in|\d)/);
  if (venueMatch) {
    venue = venueMatch[1].trim();
  }
  
  // Determine category
  let category = 'Community';
  if (lowerText.includes('music') || lowerText.includes('concert')) category = 'Music';
  else if (lowerText.includes('art') || lowerText.includes('exhibit')) category = 'Arts';
  else if (lowerText.includes('food') || lowerText.includes('taste')) category = 'Food';
  else if (lowerText.includes('festival')) category = 'Festival';
  else if (lowerText.includes('market') || lowerText.includes('fair')) category = 'Market';
  else if (lowerText.includes('conference') || lowerText.includes('expo')) category = 'Conference';
  
  return {
    title: title.trim(),
    description: text.slice(0, 500).trim(),
    category,
    venue: venue || city,
    city,
    state,
    date: eventDate,
  };
}

async function scrapeRSSFeed(feedUrl, city, state) {
  const events = [];
  
  try {
    const response = await axios.get(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 EventgasmBot/1.0' },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data, { xmlMode: true });
    
    $('item, entry').each((i, item) => {
      const $item = $(item);
      const title = $item.find('title').text();
      const description = $item.find('description, summary, content').text();
      const link = $item.find('link').text() || $item.find('link').attr('href');
      
      const eventData = extractEventFromText(title, description, city, state);
      
      if (eventData) {
        eventData.url = link;
        eventData.source_id = `news_${city.toLowerCase().replace(/\s/g, '_')}_${Buffer.from(title).toString('base64').slice(0, 20)}`;
        events.push(eventData);
      }
    });
    
  } catch (err) {
    // Silent fail - many feeds may not work
  }
  
  return events;
}

async function syncAll() {
  console.log('[News] ====== STARTING NEWS SCRAPER ======');
  console.log(`[News] Scanning ${NEWS_SOURCES.length} cities...`);
  let totalAdded = 0;
  
  for (const source of NEWS_SOURCES) {
    for (const feedUrl of source.feeds) {
      try {
        const events = await scrapeRSSFeed(feedUrl, source.city, source.state);
        
        for (const event of events) {
          try {
            await Event.upsert({
              source: 'news',
              source_id: event.source_id,
              title: event.title,
              description: event.description,
              category: event.category,
              venue_name: event.venue,
              city: event.city,
              state: event.state,
              country: 'US',
              start_time: event.date,
              is_free: true,
              external_url: event.url,
            });
            totalAdded++;
          } catch (upsertErr) {}
        }
        
        await new Promise(r => setTimeout(r, 300));
      } catch (feedErr) {}
    }
  }
  
  console.log(`[News] ====== SYNC COMPLETE: +${totalAdded} events ======`);
  return totalAdded;
}

module.exports = { syncAll, NEWS_SOURCES, extractEventFromText };
