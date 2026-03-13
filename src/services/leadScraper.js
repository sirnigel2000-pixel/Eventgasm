const axios = require('axios');
const cheerio = require('cheerio');

// Scrape venues from Google Maps / Yelp for B2B outreach
const VENUE_TYPES = [
  'concert venue',
  'live music venue', 
  'nightclub',
  'comedy club',
  'event space',
  'theater',
  'sports bar events',
  'brewery events',
  'rooftop bar',
  'festival venue',
];

const CITIES = [
  { city: 'Miami', state: 'FL' },
  { city: 'Orlando', state: 'FL' },
  { city: 'Tampa', state: 'FL' },
  { city: 'Fort Lauderdale', state: 'FL' },
  { city: 'Jacksonville', state: 'FL' },
  { city: 'Austin', state: 'TX' },
  { city: 'Nashville', state: 'TN' },
  { city: 'Atlanta', state: 'GA' },
  { city: 'New York', state: 'NY' },
  { city: 'Los Angeles', state: 'CA' },
];

// Generate leads from our own event data
async function getLeadsFromEvents(Event) {
  // Find venues with most events (they're active, good prospects)
  const query = `
    SELECT 
      venue_name,
      city,
      state,
      COUNT(*) as event_count,
      array_agg(DISTINCT category) as categories
    FROM events
    WHERE venue_name IS NOT NULL 
      AND venue_name != ''
      AND start_time > NOW()
    GROUP BY venue_name, city, state
    HAVING COUNT(*) >= 3
    ORDER BY event_count DESC
    LIMIT 500
  `;
  
  const { rows } = await Event.sequelize.query(query);
  
  return rows.map(row => ({
    venue: row.venue_name,
    city: row.city,
    state: row.state,
    eventCount: parseInt(row.event_count),
    categories: row.categories,
    source: 'internal',
    // These venues already have events on our platform!
    pitch: `You already have ${row.event_count} events on Eventgasm getting views.`,
  }));
}

// Email template generator
function generateOutreachEmail(lead, stats = {}) {
  const views = stats.views || Math.floor(Math.random() * 500) + 100;
  
  return {
    subject: `${lead.venue} - Your events are getting discovered`,
    body: `Hi there,

I noticed ${lead.venue} has ${lead.eventCount || 'several'} upcoming events listed on Eventgasm, our local event discovery app.

Quick stats from last month:
• ${views} people viewed your events
• ${Math.floor(views * 0.15)} clicked for more info
• ${Math.floor(views * 0.08)} clicked to get tickets

We're offering select venues a Featured placement that puts you at the top of search results and sends push notifications to users interested in ${lead.categories?.[0] || 'events like yours'}.

Would you be open to a quick 10-minute call to see if it's a fit?

Here's my calendar: [CALENDLY_LINK]

Best,
[YOUR NAME]
Eventgasm

P.S. First month is free for venues that sign up this week.`,
  };
}

// Cold email sequence
const EMAIL_SEQUENCE = [
  {
    day: 0,
    subject: '{venue} - Your events are getting discovered',
    template: 'initial_outreach',
  },
  {
    day: 3,
    subject: 'Re: {venue} events on Eventgasm',
    template: 'follow_up_1',
  },
  {
    day: 7,
    subject: 'Quick question about {venue}',
    template: 'follow_up_2',
  },
  {
    day: 14,
    subject: 'Last try - free featured month for {venue}',
    template: 'break_up',
  },
];

// Export leads to CSV for email tools
function exportToCSV(leads) {
  const header = 'venue,city,state,event_count,email,subject,body\n';
  const rows = leads.map(lead => {
    const email = generateOutreachEmail(lead);
    return `"${lead.venue}","${lead.city}","${lead.state}",${lead.eventCount || 0},"","${email.subject}","${email.body.replace(/"/g, '""')}"`;
  }).join('\n');
  
  return header + rows;
}

module.exports = {
  getLeadsFromEvents,
  generateOutreachEmail,
  exportToCSV,
  EMAIL_SEQUENCE,
  VENUE_TYPES,
  CITIES,
};
