const axios = require('axios');
const Event = require('../models/Event');

// Meetup's GraphQL API (no key needed for public events)
const GRAPHQL_URL = 'https://www.meetup.com/gql';

// Categories that map to niche/community events
const CATEGORY_MAP = {
  'outdoors-adventure': 'Outdoors',
  'tech': 'Education',
  'sports-fitness': 'Sports',
  'learning': 'Education',
  'photography': 'Arts & Theatre',
  'food-drink': 'Food & Drink',
  'writing': 'Arts & Theatre',
  'language': 'Education',
  'music': 'Music',
  'movies': 'Film',
  'games': 'Games',
  'book-clubs': 'Education',
  'art': 'Arts & Theatre',
  'dancing': 'Music',
  'pets': 'Family & Kids',
  'hobbies-crafts': 'Arts & Theatre',
  'socializing': 'Community',
  'lgbtq': 'Community',
  'singles': 'Community',
  'health-wellness': 'Fitness',
  'sci-fi-games': 'Games',
  'career-business': 'Education',
  'parents-family': 'Family & Kids',
  'beliefs': 'Community',
  'movements': 'Community',
  'new-age': 'Community'
};

// Fetch events using GraphQL
async function fetchEvents({ lat, lng, radius = 50, page = 1 }) {
  const query = `
    query($lat: Float!, $lon: Float!, $radius: Int!, $first: Int!, $after: String) {
      rankedEvents(
        lat: $lat
        lon: $lon
        radius: $radius
        first: $first
        after: $after
        eventType: PHYSICAL
        sortField: RELEVANCE
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            description
            dateTime
            endTime
            timezone
            eventUrl
            imageUrl
            going
            waiting
            isFree
            feeSettings {
              amount
              currency
            }
            venue {
              name
              address
              city
              state
              postalCode
              country
              lat
              lng
            }
            group {
              name
              urlname
              topics {
                name
                urlkey
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(GRAPHQL_URL, {
      query,
      variables: {
        lat,
        lon: lng,
        radius,
        first: 50,
        after: page > 1 ? btoa(`arrayconnection:${(page - 1) * 50}`) : null
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    });

    const data = response.data?.data?.rankedEvents;
    if (!data) {
      return { events: [], hasMore: false };
    }

    const events = data.edges.map(edge => parseEvent(edge.node));
    return { 
      events, 
      hasMore: data.pageInfo.hasNextPage 
    };
  } catch (error) {
    console.error('Meetup API error:', error.response?.data || error.message);
    return { events: [], hasMore: false };
  }
}

function parseEvent(raw) {
  const venue = raw.venue || {};
  
  // Determine category from group topics
  let category = 'Community';
  const topics = raw.group?.topics || [];
  for (const topic of topics) {
    if (CATEGORY_MAP[topic.urlkey]) {
      category = CATEGORY_MAP[topic.urlkey];
      break;
    }
  }

  // Parse price
  let priceMin = null;
  let isFree = raw.isFree;
  if (raw.feeSettings?.amount) {
    priceMin = raw.feeSettings.amount / 100; // Convert cents to dollars
  }

  return {
    source: 'meetup',
    source_id: raw.id,
    title: raw.title || 'Meetup Event',
    description: raw.description ? raw.description.replace(/<[^>]*>/g, '').substring(0, 2000) : null,
    category,
    subcategory: raw.group?.name || null,
    
    venue_name: venue.name || raw.group?.name,
    address: venue.address,
    city: venue.city,
    state: venue.state,
    zip: venue.postalCode,
    country: venue.country || 'US',
    latitude: venue.lat || null,
    longitude: venue.lng || null,
    
    start_time: raw.dateTime,
    end_time: raw.endTime,
    timezone: raw.timezone,
    is_all_day: false,
    
    image_url: raw.imageUrl || null,
    ticket_url: raw.eventUrl,
    price_min: priceMin,
    price_max: priceMin,
    is_free: isFree,
    
    popularity: (raw.going || 0) + (raw.waiting || 0),
    
    raw_data: raw
  };
}

// Sync events for a location
async function syncLocation(lat, lng, locationName) {
  console.log(`[Meetup] Syncing ${locationName}...`);
  
  let page = 1;
  let totalAdded = 0;
  let hasMore = true;

  while (hasMore && page <= 5) {
    const { events, hasMore: more } = await fetchEvents({ lat, lng, page });
    
    for (const eventData of events) {
      try {
        await Event.upsert(eventData);
        totalAdded++;
      } catch (err) {
        console.error(`Failed to upsert event: ${err.message}`);
      }
    }

    hasMore = more;
    page++;
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[Meetup] ${locationName}: ${totalAdded} events synced`);
  return totalAdded;
}

// Sync major cities
async function syncMajorCities() {
  const cities = [
    { lat: 40.7128, lng: -74.0060, name: 'New York, NY' },
    { lat: 34.0522, lng: -118.2437, name: 'Los Angeles, CA' },
    { lat: 41.8781, lng: -87.6298, name: 'Chicago, IL' },
    { lat: 29.7604, lng: -95.3698, name: 'Houston, TX' },
    { lat: 33.4484, lng: -112.0740, name: 'Phoenix, AZ' },
    { lat: 39.9526, lng: -75.1652, name: 'Philadelphia, PA' },
    { lat: 32.7767, lng: -96.7970, name: 'Dallas, TX' },
    { lat: 30.2672, lng: -97.7431, name: 'Austin, TX' },
    { lat: 37.7749, lng: -122.4194, name: 'San Francisco, CA' },
    { lat: 47.6062, lng: -122.3321, name: 'Seattle, WA' },
    { lat: 39.7392, lng: -104.9903, name: 'Denver, CO' },
    { lat: 38.9072, lng: -77.0369, name: 'Washington, DC' },
    { lat: 42.3601, lng: -71.0589, name: 'Boston, MA' },
    { lat: 33.7490, lng: -84.3880, name: 'Atlanta, GA' },
    { lat: 25.7617, lng: -80.1918, name: 'Miami, FL' },
    { lat: 28.5383, lng: -81.3792, name: 'Orlando, FL' },
    { lat: 36.1627, lng: -86.7816, name: 'Nashville, TN' },
    { lat: 29.9511, lng: -90.0715, name: 'New Orleans, LA' },
    { lat: 45.5152, lng: -122.6784, name: 'Portland, OR' },
    { lat: 44.9778, lng: -93.2650, name: 'Minneapolis, MN' },
    { lat: 36.1699, lng: -115.1398, name: 'Las Vegas, NV' },
    { lat: 32.7157, lng: -117.1611, name: 'San Diego, CA' },
    { lat: 27.9506, lng: -82.4572, name: 'Tampa, FL' },
    { lat: 18.4655, lng: -66.1057, name: 'San Juan, PR' },
  ];

  let totalEvents = 0;
  for (const city of cities) {
    const added = await syncLocation(city.lat, city.lng, city.name);
    totalEvents += added;
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log(`[Meetup] Total sync complete: ${totalEvents} events`);
  return totalEvents;
}

module.exports = { fetchEvents, syncLocation, syncMajorCities };
