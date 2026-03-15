/**
 * Geocoding Helper - Google + OpenStreetMap fallback
 */
const axios = require('axios');

// Google Geocoding
async function geocodeWithGoogle(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !address) return null;
  
  try {
    const query = encodeURIComponent(address);
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`,
      { timeout: 5000 }
    );
    
    if (response.data.status === 'OK' && response.data.results[0]) {
      const result = response.data.results[0];
      const components = result.address_components;
      
      const getComponent = (type) => {
        const comp = components.find(c => c.types.includes(type));
        return comp ? comp.long_name : null;
      };
      
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        city: getComponent('locality') || getComponent('sublocality'),
        state: getComponent('administrative_area_level_1'),
        country: getComponent('country'),
      };
    }
  } catch (e) {}
  return null;
}

// Google Places - venue lookup
async function findVenue(venueName, city) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !venueName) return null;
  
  try {
    const query = encodeURIComponent(\`\${venueName} \${city || ''}\`);
    const response = await axios.get(
      \`https://maps.googleapis.com/maps/api/place/textsearch/json?query=\${query}&key=\${apiKey}\`,
      { timeout: 5000 }
    );
    
    if (response.data.status === 'OK' && response.data.results[0]) {
      const place = response.data.results[0];
      const parts = place.formatted_address?.split(',') || [];
      return {
        venue_name: place.name,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        city: parts.length >= 3 ? parts[parts.length - 3]?.trim() : null,
      };
    }
  } catch (e) {}
  return null;
}

// OpenStreetMap fallback
async function geocodeFallback(city, state, country = 'US') {
  if (!city) return null;
  try {
    const query = encodeURIComponent(\`\${city}, \${state || ''} \${country}\`.trim());
    const response = await axios.get(
      \`https://nominatim.openstreetmap.org/search?q=\${query}&format=json&limit=1\`,
      { headers: { 'User-Agent': 'Eventgasm/1.0' }, timeout: 5000 }
    );
    if (response.data?.[0]) {
      return {
        latitude: parseFloat(response.data[0].lat),
        longitude: parseFloat(response.data[0].lon),
      };
    }
  } catch (e) {}
  return null;
}

// Main function - tries all methods
async function fillLocation(data) {
  // Already have coords? Done.
  if (data.latitude && data.longitude) return data;
  
  // Try venue lookup first
  if (data.venue_name) {
    const venue = await findVenue(data.venue_name, data.city);
    if (venue?.latitude) {
      data.latitude = venue.latitude;
      data.longitude = venue.longitude;
      if (!data.city) data.city = venue.city;
      return data;
    }
  }
  
  // Try Google geocoding
  if (data.city) {
    const geo = await geocodeWithGoogle(\`\${data.city}, \${data.state || ''} \${data.country || 'US'}\`);
    if (geo?.latitude) {
      data.latitude = geo.latitude;
      data.longitude = geo.longitude;
      if (!data.state) data.state = geo.state;
      return data;
    }
  }
  
  // Fallback to OSM
  if (data.city) {
    const coords = await geocodeFallback(data.city, data.state, data.country);
    if (coords) {
      data.latitude = coords.latitude;
      data.longitude = coords.longitude;
    }
  }
  
  return data;
}

module.exports = { geocodeWithGoogle, findVenue, geocodeFallback, fillLocation };

// Google Custom Search - find event info online
async function searchEventInfo(eventTitle, venueName) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !eventTitle) return null;
  
  try {
    const query = encodeURIComponent(\`\${eventTitle} \${venueName || ''} event location\`);
    // Note: Custom Search requires a Search Engine ID (cx) to be configured
    // For now, we'll use Places Text Search which is similar
    const response = await axios.get(
      \`https://maps.googleapis.com/maps/api/place/textsearch/json?query=\${query}&type=establishment&key=\${apiKey}\`,
      { timeout: 5000 }
    );
    
    if (response.data.status === 'OK' && response.data.results[0]) {
      const place = response.data.results[0];
      return {
        venue_name: place.name,
        latitude: place.geometry?.location?.lat,
        longitude: place.geometry?.location?.lng,
        formatted_address: place.formatted_address,
      };
    }
  } catch (e) {
    console.error('[Geocoder] Search error:', e.message);
  }
  return null;
}

module.exports.searchEventInfo = searchEventInfo;
