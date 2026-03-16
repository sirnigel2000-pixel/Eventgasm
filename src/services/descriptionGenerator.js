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

// Extract performer/artist name from event title
function extractPerformer(title) {
  if (!title) return null;
  return title
    .replace(/\s*(live|tour|concert|show|tickets|presents|featuring|feat\.?|ft\.?|at\s+\w+|:\s*.*)$/i, '')
    .replace(/\s*[-–—]\s*.*$/, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .split(' ').slice(0, 4).join(' ');
}

// Format a readable date
function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      weekday: 'long', month: 'long', day: 'numeric' 
    });
  } catch (e) { return null; }
}

// Smart template generator - uses all available event data
function generateTemplate(event) {
  const title = event.title || 'this event';
  const venue = event.venue_name;
  const city = event.city || '';
  const state = event.state || '';
  const location = city && state ? `${city}, ${state}` : city || state || null;
  const date = formatDate(event.start_time);
  const performer = extractPerformer(title);
  const category = (event.category || '').toLowerCase();

  // Build context strings
  const at = venue ? `at ${venue}` : location ? `in ${location}` : '';
  const on = date ? `on ${date}` : '';
  const inCity = location ? `in ${location}` : '';
  const whoWhere = [venue, location].filter(Boolean).join(', ');

  // Category-specific smart templates
  if (category.includes('music') || category.includes('concert')) {
    const options = [
      `${performer || title} takes the stage ${at}${on ? ' ' + on : ''}. An evening of live music, electric energy, and unforgettable performances${inCity ? ' ' + inCity : ''}.`,
      `Don't miss ${performer || title} live${at ? ' ' + at : ''}. ${date ? `This ${date.split(',')[0]} night` : 'One night'} of raw music and real moments${inCity ? ' in ' + (city || location) : ''}.`,
      `${performer || title}${at ? ' performs ' + at : ' performing live'}${on ? ' ' + on : ''}. Get your tickets now${inCity ? ' — ' + (city || location) : ''}.`,
    ];
    return options[Math.abs((event.id || '').charCodeAt(0) || 0) % options.length];
  }

  if (category.includes('sport')) {
    const options = [
      `${title}${at ? ' ' + at : ''}${on ? ' ' + on : ''}. Catch every play, every call, every moment live${inCity ? ' in ' + (city || location) : ''}.`,
      `Game day ${inCity ? 'in ' + (city || location) : ''}${on ? ' — ' + on : ''}. ${title}${venue ? ' at ' + venue : ''}. Be there.`,
      `Live sports action: ${title}. ${date ? date + ' ' : ''}${whoWhere ? 'At ' + whoWhere + '. ' : ''}Cheer your team on in person.`,
    ];
    return options[Math.abs((event.id || '').charCodeAt(0) || 0) % options.length];
  }

  if (category.includes('comedy')) {
    const options = [
      `${performer || title} brings sharp wit and real laughs${at ? ' ' + at : ''}${on ? ' ' + on : ''}. A night of stand-up comedy${inCity ? ' in ' + (city || location) : ''} you won't forget.`,
      `Laugh-out-loud comedy with ${performer || title}${on ? ' ' + on : ''}${at ? ' ' + at : ''}. ${inCity ? (city || location) + ' — c' : 'C'}ome ready to lose it.`,
      `${performer || title} is coming${inCity ? ' to ' + (city || location) : ''}${on ? ' ' + on : ''}. ${venue ? 'At ' + venue + '. ' : ''}Expect an hour of unfiltered, unforgettable comedy.`,
    ];
    return options[Math.abs((event.id || '').charCodeAt(0) || 0) % options.length];
  }

  if (category.includes('theater') || category.includes('theatre')) {
    const options = [
      `${title} comes to life on stage${at ? ' ' + at : ''}${on ? ' ' + on : ''}. A theatrical experience${inCity ? ' in ' + (city || location) : ''} that moves and inspires.`,
      `Live theatre${at ? ' ' + at : ''}: ${title}${on ? ', ' + on : ''}. ${inCity ? (city || location) + ' — e' : 'E'}xperience the power of live performance.`,
    ];
    return options[Math.abs((event.id || '').charCodeAt(0) || 0) % options.length];
  }

  if (category.includes('festival')) {
    const options = [
      `${title}${on ? ' — ' + on : ''}${at ? ' ' + at : ''}. ${inCity ? (city || location) + '\'s ' : ''}biggest celebration of the season. Music, food, and good people all in one place.`,
      `${title} returns${inCity ? ' to ' + (city || location) : ''}${on ? ' ' + on : ''}. ${venue ? 'At ' + venue + ' — e' : 'E'}xpect incredible entertainment from start to finish.`,
    ];
    return options[Math.abs((event.id || '').charCodeAt(0) || 0) % options.length];
  }

  if (category.includes('food') || category.includes('drink')) {
    const options = [
      `${title}${on ? ' ' + on : ''}${at ? ' ' + at : ''}. Discover incredible flavors, meet local makers, and eat well${inCity ? ' in ' + (city || location) : ''}.`,
      `A culinary experience${inCity ? ' in ' + (city || location) : ''}: ${title}${on ? ' ' + on : ''}${venue ? ' at ' + venue : ''}. Taste, sip, and enjoy the best the area has to offer.`,
    ];
    return options[Math.abs((event.id || '').charCodeAt(0) || 0) % options.length];
  }

  if (category.includes('nightlife')) {
    const options = [
      `${title}${on ? ' — ' + on : ''}${at ? ' ' + at : ''}. The night starts${inCity ? ' in ' + (city || location) : ''} and so does the music. Come ready to dance.`,
      `${inCity ? (city || location) + ' comes alive' : 'The night comes alive'} at ${title}${on ? ' ' + on : ''}${venue ? ' at ' + venue : ''}. One of those nights.`,
    ];
    return options[Math.abs((event.id || '').charCodeAt(0) || 0) % options.length];
  }

  if (category.includes('family')) {
    return `${title}${on ? ' ' + on : ''}${at ? ' ' + at : ''}. A fun-filled day for the whole family${inCity ? ' in ' + (city || location) : ''} — activities, entertainment, and memories waiting to be made.`;
  }

  if (category.includes('community')) {
    return `${title}${on ? ' ' + on : ''}${at ? ' ' + at : ''}. Come out, meet your neighbors, and be part of what makes ${city || 'this community'} special.`;
  }

  if (category.includes('art')) {
    return `${title}${on ? ' ' + on : ''}${at ? ' ' + at : ''}. A chance to see${inCity ? ' ' + (city || location) + '\'s' : ''} creative scene up close — exhibits, artists, and work that makes you think.`;
  }

  // Smart default
  const defaults = [
    `${title}${on ? ' ' + on : ''}${at ? ' ' + at : ''}. ${inCity ? (city || location) + ' — d' : 'D'}on't miss it.`,
    `${title}${at ? ' ' + at : ''}${on ? ' ' + on : ''}. An event worth showing up for${inCity ? ' in ' + (city || location) : ''}.`,
    `Join us for ${title}${on ? ' ' + on : ''}${venue ? ' at ' + venue : ''}${inCity ? ' in ' + (city || location) : ''}. A great time guaranteed.`,
  ];
  return defaults[Math.abs((event.id || '').charCodeAt(0) || 0) % defaults.length];
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
