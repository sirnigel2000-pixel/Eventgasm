/**
 * Description Generator - Optimized
 * 1. First tries to scrape the real description from ticket_url
 * 2. Falls back to category templates only if scraping fails
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { pool } = require('../db');

// Scrape real description from ticket page
async function scrapeDescription(url) {
  if (!url) return null;
  
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Eventgasm/1.0)',
        'Accept': 'text/html'
      },
      maxRedirects: 3
    });
    
    const $ = cheerio.load(response.data);
    
    // 1. Schema.org event description (best)
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
      try {
        const data = JSON.parse($(scripts[i]).text());
        const desc = data.description || data['@graph']?.find(n => n['@type'] === 'Event')?.description;
        if (desc && typeof desc === 'string' && desc.length > 30) {
          return cleanDescription(desc);
        }
      } catch (e) {}
    }
    
    // 2. og:description meta tag
    const ogDesc = $('meta[property="og:description"]').attr('content');
    if (ogDesc && ogDesc.length > 30) return cleanDescription(ogDesc);
    
    // 3. twitter:description
    const twDesc = $('meta[name="twitter:description"]').attr('content');
    if (twDesc && twDesc.length > 30) return cleanDescription(twDesc);
    
    // 4. Standard meta description
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc && metaDesc.length > 30) return cleanDescription(metaDesc);
    
    // 5. Eventbrite-specific
    const ebDesc = $('.event-description__content, [data-automation="event-description"], .structured-content').text().trim();
    if (ebDesc && ebDesc.length > 30) return cleanDescription(ebDesc.substring(0, 800));
    
    // 6. Generic article content
    const article = $('article p, .description p, .event-body p, [class*="description"] p').first().text().trim();
    if (article && article.length > 30) return cleanDescription(article.substring(0, 600));
    
  } catch (e) {
    // Silent fail - many sites block scrapers
  }
  return null;
}

function cleanDescription(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
    .substring(0, 1000);
}

// Category-specific templates (fallback only)
const TEMPLATES = {
  'Music': [
    "Experience {title} live! An evening of exceptional music and unforgettable moments at {venue}.",
    "Don't miss {title} - live music that promises incredible energy and amazing performances.",
    "Join us for {title}, a must-see musical event bringing the crowd together at {venue}.",
  ],
  'Sports': [
    "Catch all the action at {title}! Experience the thrill of live sports and cheer on your team.",
    "Game day! Join fans at {title} for live sports action and the energy of the crowd.",
    "Don't miss {title} - live sports excitement where every play matters.",
  ],
  'Comedy': [
    "Laugh out loud at {title}! An evening of hilarious comedy guaranteed to have you in stitches.",
    "Get ready to laugh with {title} - professional comedy at its finest.",
    "Join us for {title}, where the jokes are sharp and the laughs are real.",
  ],
  'Theater': [
    "Experience the magic of {title} on stage. Live theatre that moves and inspires.",
    "Don't miss {title} - a captivating theatrical performance at {venue}.",
    "Step into the world of {title}, bringing powerful stories to life through live performance.",
  ],
  'Arts': [
    "Immerse yourself in {title} - a remarkable artistic experience that sparks creativity and conversation.",
    "Discover {title} at {venue}, showcasing the work of talented artists and creators.",
    "Experience {title}, where art comes alive and invites you to see the world differently.",
  ],
  'Festival': [
    "Join the celebration at {title}! Music, food, fun, and unforgettable moments for everyone.",
    "Don't miss {title} - a vibrant festival experience with entertainment and community spirit.",
    "Be part of {title}, a festival that brings people together for a day to remember.",
  ],
  'Food': [
    "Indulge at {title}! A culinary experience celebrating incredible food, drinks, and flavors.",
    "Savor the moment at {title} - delicious food and great company in one event.",
    "Join fellow food lovers at {title} for an unforgettable culinary adventure.",
  ],
  'Family': [
    "Bring the whole family to {title}! A fun-filled event with something for everyone.",
    "Create memories at {title} - a family-friendly experience packed with entertainment.",
    "Don't miss {title}, perfect for families looking for fun, laughs, and great times together.",
  ],
  'Community': [
    "Connect with neighbors at {title}! A community event celebrating what brings us together.",
    "Join your community at {title} - fun, connection, and local spirit all in one place.",
    "Be part of {title}, where neighbors become friends and community comes alive.",
  ],
  'Nightlife': [
    "The night comes alive at {title}! Dancing, drinks, and an incredible atmosphere await.",
    "Don't miss {title} - the place to be for an unforgettable night out.",
    "Experience {title} where great music meets great vibes for a night you won't forget.",
  ],
  'default': [
    "Don't miss {title} at {venue}! An exciting event with entertainment and great moments.",
    "Join us for {title} - a can't-miss event that promises a great time for all.",
    "Experience {title}, where memorable moments are made and good times are guaranteed.",
  ]
};

function generateTemplate(event) {
  const key = Object.keys(TEMPLATES).find(k => 
    event.category?.toLowerCase().includes(k.toLowerCase())
  ) || 'default';
  
  const templates = TEMPLATES[key];
  const idx = Math.abs(event.id?.charCodeAt(0) || 0) % templates.length;
  const template = templates[idx];
  
  const venue = event.venue_name || 'a great venue';
  const city = event.city || '';
  const state = event.state || '';
  const location = city && state ? `${city}, ${state}` : city || state || '';
  
  let desc = template
    .replace(/{title}/g, event.title || 'this event')
    .replace(/{venue}/g, venue);
  
  if (location && !desc.includes(location)) {
    desc += ` Taking place in ${location}.`;
  }
  
  return desc;
}

// Process a batch of events
async function fillMissingDescriptions(limit = 500) {
  const stats = { processed: 0, scraped: 0, templated: 0, errors: 0 };
  
  const result = await pool.query(`
    SELECT id, title, category, venue_name, city, state, start_time, ticket_url
    FROM events
    WHERE (description IS NULL 
      OR description = '' 
      OR description ILIKE '%event on eventbrite%'
      OR description ILIKE '%register now%'
      OR LENGTH(description) < 25)
      AND title IS NOT NULL
      AND title NOT ILIKE '%deposit%'
      AND title NOT ILIKE '%season ticket%'
    ORDER BY start_time ASC
    LIMIT $1
  `, [limit]);
  
  console.log(`[DescGen] Processing ${result.rows.length} events...`);
  
  for (const event of result.rows) {
    stats.processed++;
    
    try {
      let description = null;
      
      // Try scraping first if ticket URL exists
      if (event.ticket_url) {
        description = await scrapeDescription(event.ticket_url);
        if (description) stats.scraped++;
      }
      
      // Fall back to template
      if (!description) {
        description = generateTemplate(event);
        stats.templated++;
      }
      
      await pool.query(
        'UPDATE events SET description = $1, updated_at = NOW() WHERE id = $2',
        [description, event.id]
      );
      
      if (stats.processed % 50 === 0) {
        console.log(`[DescGen] ${stats.processed}/${result.rows.length} | scraped: ${stats.scraped} | templated: ${stats.templated}`);
      }
      
      // Rate limit scraping
      await new Promise(r => setTimeout(r, 100));
      
    } catch (e) {
      stats.errors++;
    }
  }
  
  console.log(`[DescGen] Done: scraped=${stats.scraped}, templated=${stats.templated}, errors=${stats.errors}`);
  return stats;
}

module.exports = { fillMissingDescriptions, scrapeDescription, generateTemplate };
