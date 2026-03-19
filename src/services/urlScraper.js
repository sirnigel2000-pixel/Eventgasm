/**
 * urlScraper.js
 * Scrapes event details from a URL using metadata + heuristics.
 * No Google APIs. Uses cheerio + axios.
 */
const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Eventgasm/1.0; +https://eventgasm.com)',
  'Accept': 'text/html,application/xhtml+xml',
};

async function scrapeUrl(url) {
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 10000, maxRedirects: 5 });
    const $ = cheerio.load(res.data);
    const event = {};

    // --- Title ---
    event.title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      $('title').text().replace(/\s*[|\-–].*/,'').trim() ||
      '';

    // --- Description ---
    event.description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      '';

    // --- Image ---
    event.image_url =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      '';

    // --- Ticket URL (the source itself) ---
    event.ticket_url = url;

    // --- Date/Time heuristics ---
    // Try JSON-LD structured data first (most reliable)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        const objs = Array.isArray(json) ? json : [json];
        for (const obj of objs) {
          const type = (obj['@type'] || '').toLowerCase();
          if (type === 'event') {
            if (!event.title && obj.name) event.title = obj.name;
            if (!event.description && obj.description) event.description = obj.description;
            if (!event.image_url && obj.image) event.image_url = Array.isArray(obj.image) ? obj.image[0] : obj.image;
            if (obj.startDate) event.start_time = new Date(obj.startDate).toISOString();
            if (obj.endDate) event.end_time = new Date(obj.endDate).toISOString();
            if (obj.location) {
              const loc = obj.location;
              event.venue_name = loc.name || '';
              if (loc.address) {
                if (typeof loc.address === 'string') {
                  event.address = loc.address;
                } else {
                  event.address = loc.address.streetAddress || '';
                  event.city = loc.address.addressLocality || '';
                  event.state = loc.address.addressRegion || '';
                }
              }
            }
            if (obj.offers) {
              const offers = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
              const prices = offers.map(o => parseFloat(o.price)).filter(p => !isNaN(p));
              if (prices.length) {
                event.price_min = Math.min(...prices);
                event.price_max = Math.max(...prices);
                event.is_free = event.price_min === 0;
              }
            }
          }
        }
      } catch(e) {}
    });

    // Fallback: og:event or meta tags
    if (!event.start_time) {
      const dateStr =
        $('meta[property="event:start_time"]').attr('content') ||
        $('meta[itemprop="startDate"]').attr('content') ||
        $('[itemprop="startDate"]').attr('content') ||
        $('[datetime]').first().attr('datetime') || '';
      if (dateStr) {
        try { event.start_time = new Date(dateStr).toISOString(); } catch(e) {}
      }
    }

    // Venue fallback
    if (!event.venue_name) {
      event.venue_name =
        $('meta[property="event:location"]').attr('content') ||
        $('[itemprop="location"] [itemprop="name"]').first().text().trim() ||
        '';
    }

    // City/state fallback from og:locality
    if (!event.city) event.city = $('meta[property="og:locality"]').attr('content') || '';
    if (!event.state) event.state = $('meta[property="og:region"]').attr('content') || '';

    // Free check
    if (!event.is_free) {
      const bodyText = $('body').text().toLowerCase();
      event.is_free = /\bfree\b.*\bevent\b|\bfree admission\b|\bno cover\b|\bfree entry\b/.test(bodyText);
    }

    // Clean up
    event.title = (event.title || '').substring(0, 200).trim();
    event.description = (event.description || '').substring(0, 1000).trim();
    event.venue_name = (event.venue_name || '').substring(0, 200).trim();

    return { ok: true, event };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Scrape a source page (FB page, venue site, organizer page) for multiple events.
 * Returns array of event objects found on the page.
 */
async function scrapeSourcePage(url) {
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 10000, maxRedirects: 5 });
    const $ = cheerio.load(res.data);
    const events = [];

    // Try JSON-LD array
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        const objs = Array.isArray(json) ? json : [json];
        for (const obj of objs) {
          if ((obj['@type'] || '').toLowerCase() === 'event') {
            const e = {};
            e.title = obj.name || '';
            e.description = (obj.description || '').substring(0, 1000);
            if (obj.startDate) e.start_time = new Date(obj.startDate).toISOString();
            if (obj.endDate) e.end_time = new Date(obj.endDate).toISOString();
            if (obj.location) {
              e.venue_name = obj.location.name || '';
              if (obj.location.address) {
                e.address = obj.location.address.streetAddress || '';
                e.city = obj.location.address.addressLocality || '';
                e.state = obj.location.address.addressRegion || '';
              }
            }
            if (obj.url) e.ticket_url = obj.url;
            if (obj.image) e.image_url = Array.isArray(obj.image) ? obj.image[0] : obj.image;
            if (e.title && e.start_time) events.push(e);
          }
        }
      } catch(e) {}
    });

    // Try microdata / itemprop
    if (events.length === 0) {
      $('[itemtype*="Event"]').each((_, el) => {
        const e = {};
        e.title = $(el).find('[itemprop="name"]').first().text().trim();
        const sd = $(el).find('[itemprop="startDate"]').attr('content') || $(el).find('[itemprop="startDate"]').attr('datetime');
        if (sd) { try { e.start_time = new Date(sd).toISOString(); } catch(_) {} }
        e.venue_name = $(el).find('[itemprop="location"] [itemprop="name"]').first().text().trim();
        const href = $(el).find('a[href]').attr('href');
        if (href) e.ticket_url = href.startsWith('http') ? href : new URL(href, url).href;
        if (e.title && e.start_time) events.push(e);
      });
    }

    return { ok: true, events, count: events.length };
  } catch (e) {
    return { ok: false, events: [], error: e.message };
  }
}

module.exports = { scrapeUrl, scrapeSourcePage };
