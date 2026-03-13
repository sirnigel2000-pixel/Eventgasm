const axios = require('axios');
const Event = require('../models/Event');

// Open data portals for major US cities
const CITY_APIS = [
  // NYC - Multiple datasets
  {
    name: 'NYC Parks Events',
    url: 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json',
    params: { '$limit': 1000 },
    city: 'New York',
    state: 'NY',
    transform: (item) => ({
      title: item.event_name || item.name,
      description: item.description,
      start_time: item.start_date_time || item.event_date,
      end_time: item.end_date_time,
      venue_name: item.park_name || item.location,
      address: item.location,
      category: 'Community',
      is_free: true,
    }),
  },
  {
    name: 'NYC Cultural Events',
    url: 'https://data.cityofnewyork.us/resource/qb56-5v4h.json',
    params: { '$limit': 500 },
    city: 'New York',
    state: 'NY',
    transform: (item) => ({
      title: item.event_name || item.name,
      description: item.event_description,
      start_time: item.start_date,
      end_time: item.end_date,
      venue_name: item.venue_name,
      address: item.venue_address,
      category: 'Arts',
      is_free: item.free_event === 'Y',
    }),
  },
  // Chicago
  {
    name: 'Chicago Events',
    url: 'https://data.cityofchicago.org/resource/qmn3-gvpq.json',
    params: { '$limit': 1000 },
    city: 'Chicago',
    state: 'IL',
    transform: (item) => ({
      title: item.event_name || item.name,
      description: item.event_description || item.description,
      start_time: item.start_date || item.date,
      venue_name: item.venue || item.location,
      category: 'Community',
      is_free: true,
    }),
  },
  // Los Angeles
  {
    name: 'LA Events',
    url: 'https://data.lacity.org/resource/wg85-iy7c.json',
    params: { '$limit': 500 },
    city: 'Los Angeles',
    state: 'CA',
    transform: (item) => ({
      title: item.event_name || item.title,
      description: item.description,
      start_time: item.event_date || item.start_date,
      venue_name: item.location_name || item.venue,
      address: item.address,
      category: 'Community',
      is_free: true,
    }),
  },
  // San Francisco
  {
    name: 'SF Recreation Events',
    url: 'https://data.sfgov.org/resource/yitu-d5am.json',
    params: { '$limit': 500 },
    city: 'San Francisco',
    state: 'CA',
    transform: (item) => ({
      title: item.title || item.name,
      description: item.description,
      start_time: item.start_datetime || item.start_date,
      end_time: item.end_datetime,
      venue_name: item.location,
      category: 'Recreation',
      is_free: true,
    }),
  },
  // Austin
  {
    name: 'Austin Events',
    url: 'https://data.austintexas.gov/resource/p9pd-7t29.json',
    params: { '$limit': 500 },
    city: 'Austin',
    state: 'TX',
    transform: (item) => ({
      title: item.event_name || item.title,
      description: item.description,
      start_time: item.event_date || item.start_time,
      venue_name: item.location,
      category: 'Community',
      is_free: true,
    }),
  },
  // Denver
  {
    name: 'Denver Events',
    url: 'https://data.denvergov.org/resource/5e3y-yvz2.json',
    params: { '$limit': 500 },
    city: 'Denver',
    state: 'CO',
    transform: (item) => ({
      title: item.name || item.event_name,
      description: item.description,
      start_time: item.start_date,
      venue_name: item.location,
      category: 'Community',
      is_free: true,
    }),
  },
  // Seattle
  {
    name: 'Seattle Events',
    url: 'https://data.seattle.gov/resource/ax7p-k99b.json',
    params: { '$limit': 500 },
    city: 'Seattle',
    state: 'WA',
    transform: (item) => ({
      title: item.event_name || item.name,
      description: item.description,
      start_time: item.start_date,
      venue_name: item.location,
      category: 'Community',
      is_free: true,
    }),
  },
  // Boston
  {
    name: 'Boston Events',
    url: 'https://data.boston.gov/api/3/action/datastore_search',
    params: { resource_id: '12cb3883-56f5-47de-afa5-3b1cf61b257b', limit: 500 },
    city: 'Boston',
    state: 'MA',
    isCkan: true,
    transform: (item) => ({
      title: item.event_name || item.title,
      description: item.description,
      start_time: item.event_date || item.start_date,
      venue_name: item.location,
      category: 'Community',
      is_free: true,
    }),
  },
  // Philadelphia
  {
    name: 'Philadelphia Events',
    url: 'https://phl.carto.com/api/v2/sql',
    params: { q: "SELECT * FROM public_art WHERE 1=1 LIMIT 200" },
    city: 'Philadelphia',
    state: 'PA',
    isCarto: true,
    transform: (item) => ({
      title: item.title || item.name,
      description: item.description,
      venue_name: item.location,
      category: 'Arts',
      is_free: true,
    }),
  },
];

async function fetchCityData(source) {
  try {
    let url = source.url;
    const params = source.params || {};
    
    const response = await axios.get(url, {
      params,
      timeout: 15000,
      headers: { 'User-Agent': 'Eventgasm/1.0' },
    });

    let data = response.data;
    
    // Handle CKAN API format
    if (source.isCkan) {
      data = data.result?.records || [];
    }
    
    // Handle Carto API format
    if (source.isCarto) {
      data = data.rows || [];
    }

    if (!Array.isArray(data)) {
      console.log(`[CityData] ${source.name}: unexpected format`);
      return [];
    }

    console.log(`[CityData] ${source.name}: ${data.length} raw items`);
    return data;
  } catch (err) {
    console.log(`[CityData] ${source.name} error:`, err.message);
    return [];
  }
}

async function syncSource(source) {
  const rawData = await fetchCityData(source);
  let added = 0;

  for (const item of rawData) {
    try {
      const transformed = source.transform(item);
      
      if (!transformed.title) continue;
      
      await Event.upsert({
        source: 'citydata',
        source_id: `city_${source.city.toLowerCase().replace(/\s/g, '')}_${Buffer.from(transformed.title).toString('base64').substring(0, 20)}`,
        title: transformed.title,
        description: transformed.description?.substring(0, 2000),
        category: transformed.category || 'Community',
        subcategory: 'Local Events',
        venue_name: transformed.venue_name,
        address: transformed.address,
        city: source.city,
        state: source.state,
        country: 'US',
        start_time: transformed.start_time ? new Date(transformed.start_time) : null,
        end_time: transformed.end_time ? new Date(transformed.end_time) : null,
        is_free: transformed.is_free ?? true,
      });
      added++;
    } catch (err) {
      // Skip invalid items
    }
  }

  return added;
}

async function syncAll() {
  console.log('[CityData] ====== STARTING CITY DATA SYNC ======');
  console.log(`[CityData] Will sync ${CITY_APIS.length} city data sources`);
  let totalAdded = 0;

  for (const source of CITY_APIS) {
    try {
      const added = await syncSource(source);
      totalAdded += added;
      console.log(`[CityData] ${source.name}: +${added} events`);
    } catch (err) {
      console.log(`[CityData] ${source.name} failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[CityData] ====== SYNC COMPLETE: +${totalAdded} events ======`);
  return totalAdded;
}

const syncMajorCities = syncAll;

module.exports = { syncAll, syncMajorCities, CITY_APIS };
