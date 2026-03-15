/**
 * Description Generator
 * Creates engaging descriptions for events that don't have them
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Category-specific templates
const TEMPLATES = {
  'Concert': [
    "Experience an unforgettable night of live music featuring {title}. Get ready for amazing performances and incredible energy!",
    "Don't miss {title} live in concert! An evening of exceptional music awaits at {venue}.",
    "Join us for {title} - a must-see concert event that promises to deliver an amazing musical experience.",
  ],
  'Music': [
    "Immerse yourself in the sounds of {title}. A musical journey you won't want to miss!",
    "Get ready for {title} - live music at its finest. Feel the rhythm and enjoy the show!",
    "Experience {title} live! An evening filled with incredible music and unforgettable moments.",
  ],
  'Sports': [
    "Catch all the action at {title}! Experience the thrill of live sports at {venue}.",
    "Don't miss the excitement of {title}. Cheer on your team and be part of the game!",
    "Game day is here! Join fans for {title} and experience the energy of live sports.",
  ],
  'Comedy': [
    "Get ready to laugh! {title} promises an evening of hilarious comedy that will have you in stitches.",
    "Join us for {title} - a night of non-stop laughs and entertainment. Comedy at its best!",
    "Laugh out loud at {title}! An evening of comedy that's guaranteed to brighten your day.",
  ],
  'Arts & Theatre': [
    "Experience the magic of live theatre with {title}. A captivating performance awaits!",
    "Don't miss {title} - a stunning theatrical production that will move and inspire you.",
    "Immerse yourself in {title}, a remarkable artistic experience at {venue}.",
  ],
  'Theater': [
    "Step into a world of drama and emotion with {title}. Live theatre at its finest!",
    "Experience {title} on stage - a performance that promises to captivate and entertain.",
    "Join us for {title}, bringing stories to life through the art of live theatre.",
  ],
  'Festival': [
    "Celebrate at {title}! A fantastic festival experience with entertainment for everyone.",
    "Join the festivities at {title} - music, food, fun and unforgettable memories await!",
    "Don't miss {title}! A vibrant festival celebrating community, culture, and good times.",
  ],
  'Food': [
    "Indulge your taste buds at {title}! A culinary experience you won't forget.",
    "Savor the flavors at {title} - a delicious event for food lovers everywhere.",
    "Join us for {title} and discover amazing food, drinks, and culinary delights!",
  ],
  'Food & Drink': [
    "Taste, sip, and enjoy at {title}! A celebration of incredible food and beverages.",
    "Experience {title} - a perfect blend of delicious food and refreshing drinks.",
    "Join fellow foodies at {title} for an unforgettable culinary adventure!",
  ],
  'Community': [
    "Connect with your community at {title}! A wonderful opportunity to meet neighbors and make memories.",
    "Join us for {title} - bringing people together for fun, connection, and community spirit.",
    "Be part of {title}, a community event that celebrates what makes our neighborhood special.",
  ],
  'default': [
    "Don't miss {title}! An exciting event you won't want to skip.",
    "Join us for {title} at {venue}. A great time is guaranteed!",
    "Experience {title} - an event that promises entertainment and memorable moments.",
  ]
};

function generateDescription(event) {
  const category = event.category || 'default';
  const templates = TEMPLATES[category] || TEMPLATES['default'];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  const venue = event.venue_name || 'a great venue';
  const city = event.city || '';
  const state = event.state || '';
  const location = city && state ? `${city}, ${state}` : city || state || '';
  
  let description = template
    .replace(/{title}/g, event.title || 'this event')
    .replace(/{venue}/g, venue)
    .replace(/{location}/g, location);
  
  // Add date info if available
  if (event.start_time) {
    try {
      const date = new Date(event.start_time);
      const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
      description += ` Happening on ${dateStr}.`;
    } catch (e) {}
  }
  
  // Add location
  if (location) {
    description += ` Located in ${location}.`;
  }
  
  return description;
}

async function fillMissingDescriptions(limit = 1000) {
  const stats = { processed: 0, updated: 0, errors: 0 };
  
  try {
    // Find events without good descriptions
    const result = await pool.query(`
      SELECT id, title, category, venue_name, city, state, start_time
      FROM events
      WHERE (description IS NULL OR description = '' OR description = 'Event on Eventbrite' OR LENGTH(description) < 20)
        AND title IS NOT NULL
      LIMIT $1
    `, [limit]);
    
    console.log(`[DescGen] Found ${result.rows.length} events needing descriptions`);
    
    for (const event of result.rows) {
      stats.processed++;
      
      try {
        const description = generateDescription(event);
        
        await pool.query(`
          UPDATE events 
          SET description = $1, updated_at = NOW()
          WHERE id = $2
        `, [description, event.id]);
        
        stats.updated++;
        
        if (stats.updated % 100 === 0) {
          console.log(`[DescGen] Updated ${stats.updated} descriptions...`);
        }
      } catch (e) {
        stats.errors++;
        console.error(`[DescGen] Error updating ${event.id}:`, e.message);
      }
    }
    
    console.log(`[DescGen] Complete: ${stats.updated} updated, ${stats.errors} errors`);
    return stats;
    
  } catch (error) {
    console.error('[DescGen] Fatal error:', error);
    throw error;
  }
}

module.exports = {
  generateDescription,
  fillMissingDescriptions
};
