/**
 * Event Name Fixer
 * Attempts to fix garbage event names by:
 * 1. Parsing the ticket URL for the real name
 * 2. Checking the description for the real name
 * 3. Using venue + date to infer the event
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Patterns that indicate a garbage/placeholder name
const GARBAGE_PATTERNS = [
  /deposit/i,
  /season ticket/i,
  /parking pass/i,
  /presale/i,
  /membership/i,
  /waitlist/i,
  /access pass/i,
  /suite rental/i,
  /vip upgrade/i,
  /^\d+$/,  // Just numbers
  /^tbd$/i,
  /^tba$/i,
];

// Try to extract real name from ticket URL
function extractNameFromUrl(url) {
  if (!url) return null;
  
  try {
    // Ticketmaster: /event/artist-name-tickets/E-xxx
    const tmMatch = url.match(/ticketmaster\.com\/([^\/]+)-tickets/i);
    if (tmMatch) {
      return cleanUrlSlug(tmMatch[1]);
    }
    
    // SeatGeek: /event-name/tickets
    const sgMatch = url.match(/seatgeek\.com\/([^\/]+)\/tickets/i);
    if (sgMatch) {
      return cleanUrlSlug(sgMatch[1]);
    }
    
    // StubHub: /event-name-tickets/
    const shMatch = url.match(/stubhub\.com\/([^\/]+)-tickets/i);
    if (shMatch) {
      return cleanUrlSlug(shMatch[1]);
    }
    
    // VividSeats: /event/artist-name
    const vsMatch = url.match(/vividseats\.com\/[^\/]+\/([^\/]+)/i);
    if (vsMatch) {
      return cleanUrlSlug(vsMatch[1]);
    }
    
    // Eventbrite: /e/event-name-tickets-xxx
    const ebMatch = url.match(/eventbrite\.com\/e\/([^-]+-[^-]+-[^-]+)/i);
    if (ebMatch) {
      return cleanUrlSlug(ebMatch[1].replace(/-tickets.*/, ''));
    }
    
  } catch (e) {}
  
  return null;
}

// Clean URL slug to readable name
function cleanUrlSlug(slug) {
  if (!slug) return null;
  
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\d{4,}/g, '') // Remove years/IDs
    .replace(/tickets?$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

// Extract potential name from description
function extractNameFromDescription(description) {
  if (!description || description.length < 10) return null;
  
  // Look for "presents: X" or "featuring X"
  const presentsMatch = description.match(/presents?:?\s+([^\.!\n]+)/i);
  if (presentsMatch) return presentsMatch[1].trim().slice(0, 100);
  
  const featuringMatch = description.match(/featuring\s+([^\.!\n]+)/i);
  if (featuringMatch) return featuringMatch[1].trim().slice(0, 100);
  
  // Use first sentence if it looks like a name
  const firstSentence = description.split(/[.!?\n]/)[0].trim();
  if (firstSentence.length > 5 && firstSentence.length < 80) {
    // Check if it's not just boilerplate
    if (!firstSentence.match(/ticket|policy|terms|conditions|parking/i)) {
      return firstSentence;
    }
  }
  
  return null;
}

function isGarbageName(title) {
  if (!title) return true;
  for (const pattern of GARBAGE_PATTERNS) {
    if (pattern.test(title)) return true;
  }
  return false;
}

async function fixEventNames(limit = 500) {
  const stats = { checked: 0, fixed: 0, errors: 0 };
  
  try {
    // Find events with garbage names
    const result = await pool.query(`
      SELECT id, title, description, ticket_url, venue_name
      FROM events
      WHERE (
        LOWER(title) LIKE '%deposit%'
        OR LOWER(title) LIKE '%season ticket%'
        OR LOWER(title) LIKE '%parking pass%'
        OR LOWER(title) LIKE '%presale%'
        OR LOWER(title) LIKE '%membership%'
        OR LOWER(title) LIKE '%tbd%'
        OR LOWER(title) LIKE '%tba%'
      )
      LIMIT $1
    `, [limit]);
    
    console.log(`[NameFixer] Found ${result.rows.length} events with garbage names`);
    
    for (const event of result.rows) {
      stats.checked++;
      
      try {
        let newName = null;
        
        // Try URL first (most reliable)
        newName = extractNameFromUrl(event.ticket_url);
        
        // Try description
        if (!newName || newName.length < 3) {
          newName = extractNameFromDescription(event.description);
        }
        
        // If we found a better name, update
        if (newName && newName.length >= 3 && !isGarbageName(newName)) {
          await pool.query(`
            UPDATE events 
            SET title = $1, 
                original_title = COALESCE(original_title, title),
                updated_at = NOW()
            WHERE id = $2
          `, [newName, event.id]);
          
          stats.fixed++;
          console.log(`[NameFixer] "${event.title}" → "${newName}"`);
        }
        
      } catch (e) {
        stats.errors++;
      }
    }
    
    console.log(`[NameFixer] Complete: ${stats.fixed} fixed, ${stats.errors} errors`);
    return stats;
    
  } catch (error) {
    console.error('[NameFixer] Fatal error:', error);
    throw error;
  }
}

module.exports = {
  fixEventNames,
  extractNameFromUrl,
  extractNameFromDescription,
  isGarbageName
};
