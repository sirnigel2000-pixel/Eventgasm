const axios = require('axios');
const Event = require('../models/Event');

const GRAPHQL_URL = 'https://ra.co/graphql';

// US Area IDs for RA
const US_AREAS = [
  { id: 8, city: 'New York', state: 'NY' },
  { id: 17, city: 'Los Angeles', state: 'CA' },
  { id: 218, city: 'Miami', state: 'FL' },
  { id: 38, city: 'Chicago', state: 'IL' },
  { id: 23, city: 'San Francisco', state: 'CA' },
  { id: 62, city: 'Detroit', state: 'MI' },
  { id: 88, city: 'Seattle', state: 'WA' },
  { id: 67, city: 'Denver', state: 'CO' },
  { id: 19, city: 'Austin', state: 'TX' },
  { id: 92, city: 'Portland', state: 'OR' },
  { id: 15, city: 'Atlanta', state: 'GA' },
  { id: 51, city: 'Boston', state: 'MA' },
  { id: 75, city: 'Las Vegas', state: 'NV' },
  { id: 68, city: 'New Orleans', state: 'LA' },
  { id: 47, city: 'Philadelphia', state: 'PA' },
  { id: 9, city: 'Washington', state: 'DC' },
  { id: 26, city: 'Dallas', state: 'TX' },
  { id: 104, city: 'Nashville', state: 'TN' },
  { id: 179, city: 'Phoenix', state: 'AZ' },
  { id: 24, city: 'San Diego', state: 'CA' },
];

const QUERY = `
  query GetEvents($type: EventQueryType!, $areaId: ID!, $limit: Int) {
    events(type: $type, areaId: $areaId, limit: $limit) {
      id
      title
      date
      startTime
      endTime
      cost
      content
      minimumAge
      images {
        filename
      }
      venue {
        id
        name
        address
        area {
          name
        }
      }
      pick {
        blurb
      }
    }
  }
`;

async function fetchEvents(areaId, type = 'TODAY', limit = 100) {
  try {
    const response = await axios.post(GRAPHQL_URL, {
      query: QUERY,
      variables: { type, areaId, limit }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 15000
    });

    return response.data?.data?.events || [];
  } catch (err) {
    console.log(`[RA] Error fetching area ${areaId} (${type}):`, err.message);
    return [];
  }
}

async function syncArea(area) {
  console.log(`[RA] Syncing ${area.city}, ${area.state}...`);
  let added = 0;

  // Fetch TODAY events and PICKS (editor's picks, often upcoming)
  const types = ['TODAY', 'PICKS'];
  
  for (const type of types) {
    const events = await fetchEvents(area.id, type, 100);
    console.log(`[RA] ${area.city} ${type}: ${events.length} events`);

    for (const event of events) {
      if (!event || !event.title) continue;

      try {
        const imageUrl = event.images?.[0]?.filename 
          ? `https://ra.co/images/events/flyer/${event.images[0].filename}`
          : null;

        await Event.upsert({
          source: 'resident_advisor',
          source_id: `ra_${event.id}`,
          title: event.title,
          description: event.content || event.pick?.blurb || null,
          category: 'Music',
          subcategory: 'Electronic',
          venue_name: event.venue?.name || 'TBA',
          address: event.venue?.address || null,
          city: area.city,
          state: area.state,
          country: 'US',
          start_time: event.date ? new Date(event.date) : null,
          end_time: event.endTime ? new Date(event.endTime) : null,
          image_url: imageUrl,
          ticket_url: `https://ra.co/events/${event.id}`,
          price_min: event.cost ? parseFloat(event.cost.replace(/[^0-9.]/g, '')) || null : null,
          is_free: event.cost?.toLowerCase()?.includes('free') || false,
          age_restriction: event.minimumAge ? `${event.minimumAge}+` : null,
        });
        added++;
      } catch (err) {
        // Skip duplicates silently
      }
    }
    
    await new Promise(r => setTimeout(r, 500)); // Rate limit
  }

  return added;
}

async function syncAll() {
  console.log('[RA] ====== STARTING SYNC ======');
  console.log(`[RA] Will sync ${US_AREAS.length} US cities`);
  let totalAdded = 0;

  for (const area of US_AREAS) {
    try {
      const added = await syncArea(area);
      totalAdded += added;
      console.log(`[RA] ${area.city}: +${added} events`);
    } catch (err) {
      console.log(`[RA] Error syncing ${area.city}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1000)); // Rate limit between cities
  }

  console.log(`[RA] ====== SYNC COMPLETE: +${totalAdded} events ======`);
  return totalAdded;
}

// Alias for sync manager
const syncMajorCities = syncAll;

module.exports = { syncAll, syncMajorCities, fetchEvents, US_AREAS };
