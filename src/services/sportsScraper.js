const axios = require('axios');
const Event = require('../models/Event');

// ESPN API endpoints
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const SPORTS = [
  { path: 'basketball/nba', name: 'NBA', category: 'Sports', subcategory: 'Basketball' },
  { path: 'basketball/wnba', name: 'WNBA', category: 'Sports', subcategory: 'Basketball' },
  { path: 'basketball/mens-college-basketball', name: 'NCAA Basketball', category: 'Sports', subcategory: 'Basketball' },
  { path: 'football/nfl', name: 'NFL', category: 'Sports', subcategory: 'Football' },
  { path: 'football/college-football', name: 'College Football', category: 'Sports', subcategory: 'Football' },
  { path: 'hockey/nhl', name: 'NHL', category: 'Sports', subcategory: 'Hockey' },
  { path: 'soccer/usa.1', name: 'MLS', category: 'Sports', subcategory: 'Soccer' },
  { path: 'soccer/eng.1', name: 'Premier League', category: 'Sports', subcategory: 'Soccer' },
  { path: 'golf/pga', name: 'PGA Golf', category: 'Sports', subcategory: 'Golf' },
  { path: 'racing/f1', name: 'Formula 1', category: 'Sports', subcategory: 'Racing' },
  { path: 'mma/ufc', name: 'UFC', category: 'Sports', subcategory: 'MMA' },
  { path: 'tennis/atp', name: 'ATP Tennis', category: 'Sports', subcategory: 'Tennis' },
];

// MLB has its own API with more data
const MLB_API = 'https://statsapi.mlb.com/api/v1/schedule';

async function fetchESPNSchedule(sport, days = 30) {
  const events = [];
  
  try {
    // Get upcoming games
    const url = `${ESPN_BASE}/${sport.path}/scoreboard`;
    const resp = await axios.get(url, { timeout: 10000 });
    
    for (const event of resp.data?.events || []) {
      const competition = event.competitions?.[0];
      const venue = competition?.venue;
      const teams = competition?.competitors?.map(c => c.team?.displayName).filter(Boolean);
      
      events.push({
        id: event.id,
        title: event.name || teams?.join(' vs ') || 'Game',
        date: event.date,
        venue: venue?.fullName || venue?.name,
        city: venue?.address?.city,
        state: venue?.address?.state,
        league: sport.name,
        category: sport.category,
        subcategory: sport.subcategory,
        ticketUrl: event.links?.find(l => l.text?.includes('Tickets'))?.href,
      });
    }
  } catch (err) {
    console.log(`[Sports] Error fetching ${sport.name}:`, err.message);
  }
  
  return events;
}

async function fetchMLBSchedule() {
  const events = [];
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const url = `${MLB_API}?sportId=1&startDate=${today}&endDate=${endDate}&hydrate=team,venue`;
    const resp = await axios.get(url, { timeout: 15000 });
    
    for (const dateObj of resp.data?.dates || []) {
      for (const game of dateObj.games || []) {
        const venue = game.venue;
        const home = game.teams?.home?.team?.name;
        const away = game.teams?.away?.team?.name;
        
        events.push({
          id: `mlb_${game.gamePk}`,
          title: `${away} at ${home}`,
          date: game.gameDate,
          venue: venue?.name,
          city: venue?.location?.city,
          state: venue?.location?.stateAbbrev,
          league: 'MLB',
          category: 'Sports',
          subcategory: 'Baseball',
          ticketUrl: `https://www.mlb.com/tickets/events/${game.gamePk}`,
        });
      }
    }
    
    console.log(`[Sports] MLB: ${events.length} games found`);
  } catch (err) {
    console.log('[Sports] Error fetching MLB:', err.message);
  }
  
  return events;
}

async function fetchNHLSchedule() {
  const events = [];
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://api-web.nhle.com/v1/schedule/${today}`;
    const resp = await axios.get(url, { timeout: 10000 });
    
    for (const week of resp.data?.gameWeek || []) {
      for (const game of week.games || []) {
        events.push({
          id: `nhl_${game.id}`,
          title: `${game.awayTeam?.placeName?.default || ''} ${game.awayTeam?.commonName?.default || ''} at ${game.homeTeam?.placeName?.default || ''} ${game.homeTeam?.commonName?.default || ''}`.trim(),
          date: game.startTimeUTC,
          venue: game.venue?.default,
          city: game.homeTeam?.placeName?.default,
          state: null,
          league: 'NHL',
          category: 'Sports',
          subcategory: 'Hockey',
          ticketUrl: game.ticketsLink,
        });
      }
    }
    
    console.log(`[Sports] NHL: ${events.length} games found`);
  } catch (err) {
    console.log('[Sports] Error fetching NHL:', err.message);
  }
  
  return events;
}

async function saveEvents(events) {
  let added = 0;
  
  for (const e of events) {
    if (!e.title || !e.date) continue;
    
    try {
      await Event.upsert({
        source: 'sports',
        source_id: `sports_${e.id || Buffer.from(e.title + e.date).toString('base64').substring(0, 20)}`,
        title: e.title,
        description: `${e.league} - ${e.subcategory}`,
        category: e.category,
        subcategory: e.subcategory,
        venue_name: e.venue,
        city: e.city,
        state: e.state,
        country: 'US',
        start_time: new Date(e.date),
        ticket_url: e.ticketUrl,
        is_free: false,
      });
      added++;
    } catch (err) {
      // Skip duplicates
    }
  }
  
  return added;
}

async function syncAll() {
  console.log('[Sports] ====== STARTING SPORTS SYNC ======');
  let totalAdded = 0;
  const allEvents = [];

  // Fetch MLB (biggest source)
  const mlbEvents = await fetchMLBSchedule();
  allEvents.push(...mlbEvents);

  // Fetch NHL
  const nhlEvents = await fetchNHLSchedule();
  allEvents.push(...nhlEvents);

  // Fetch ESPN sports
  for (const sport of SPORTS) {
    const events = await fetchESPNSchedule(sport);
    console.log(`[Sports] ${sport.name}: ${events.length} events`);
    allEvents.push(...events);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[Sports] Total events found: ${allEvents.length}`);
  
  // Save all events
  totalAdded = await saveEvents(allEvents);

  console.log(`[Sports] ====== SYNC COMPLETE: +${totalAdded} events ======`);
  return totalAdded;
}

const syncMajorCities = syncAll;

module.exports = { syncAll, syncMajorCities, fetchMLBSchedule, fetchNHLSchedule, SPORTS };
