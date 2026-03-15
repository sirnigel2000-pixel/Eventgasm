/**
 * Title Parser - Extract location from event titles
 * Improved to catch more patterns
 */

// Major US cities to look for in titles
const US_CITIES = [
  'New York', 'NYC', 'Los Angeles', 'LA', 'Chicago', 'Houston', 'Phoenix',
  'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin', 'San Jose',
  'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'Indianapolis',
  'San Francisco', 'Seattle', 'Denver', 'Boston', 'Nashville', 'Detroit',
  'Portland', 'Memphis', 'Louisville', 'Baltimore', 'Milwaukee', 'Miami',
  'Tampa', 'Orlando', 'Atlanta', 'Minneapolis', 'Cleveland', 'Raleigh',
  'Kansas City', 'Las Vegas', 'Oakland', 'Pittsburgh', 'Cincinnati',
  'Sacramento', 'Brooklyn', 'Manhattan', 'Queens', 'Bronx', 'Staten Island',
  'Long Beach', 'Virginia Beach', 'Colorado Springs', 'Omaha', 'Albuquerque',
  'Tucson', 'Fresno', 'Mesa', 'Honolulu', 'Satellite Beach', 'Melbourne',
  'Cocoa Beach', 'Cape Canaveral', 'Brevard', 'Space Coast', 'San Bernardino',
  'Anaheim', 'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista',
  'Fremont', 'St. Louis', 'St Louis', 'New Orleans', 'Salt Lake City',
  'Anchorage', 'Henderson', 'Scottsdale', 'Gilbert', 'Glendale', 'Chandler',
  'North Las Vegas', 'Irving', 'Chesapeake', 'Norfolk', 'Birmingham',
  'Rochester', 'Buffalo', 'Providence', 'Richmond', 'Madison', 'Boise'
];

// State abbreviations with major cities as fallback
const STATES = {
  'AL': { name: 'Alabama', city: 'Birmingham' },
  'AK': { name: 'Alaska', city: 'Anchorage' },
  'AZ': { name: 'Arizona', city: 'Phoenix' },
  'AR': { name: 'Arkansas', city: 'Little Rock' },
  'CA': { name: 'California', city: 'Los Angeles' },
  'CO': { name: 'Colorado', city: 'Denver' },
  'CT': { name: 'Connecticut', city: 'Hartford' },
  'DE': { name: 'Delaware', city: 'Wilmington' },
  'FL': { name: 'Florida', city: 'Miami' },
  'GA': { name: 'Georgia', city: 'Atlanta' },
  'HI': { name: 'Hawaii', city: 'Honolulu' },
  'ID': { name: 'Idaho', city: 'Boise' },
  'IL': { name: 'Illinois', city: 'Chicago' },
  'IN': { name: 'Indiana', city: 'Indianapolis' },
  'IA': { name: 'Iowa', city: 'Des Moines' },
  'KS': { name: 'Kansas', city: 'Wichita' },
  'KY': { name: 'Kentucky', city: 'Louisville' },
  'LA': { name: 'Louisiana', city: 'New Orleans' },
  'ME': { name: 'Maine', city: 'Portland' },
  'MD': { name: 'Maryland', city: 'Baltimore' },
  'MA': { name: 'Massachusetts', city: 'Boston' },
  'MI': { name: 'Michigan', city: 'Detroit' },
  'MN': { name: 'Minnesota', city: 'Minneapolis' },
  'MS': { name: 'Mississippi', city: 'Jackson' },
  'MO': { name: 'Missouri', city: 'St. Louis' },
  'MT': { name: 'Montana', city: 'Billings' },
  'NE': { name: 'Nebraska', city: 'Omaha' },
  'NV': { name: 'Nevada', city: 'Las Vegas' },
  'NH': { name: 'New Hampshire', city: 'Manchester' },
  'NJ': { name: 'New Jersey', city: 'Newark' },
  'NM': { name: 'New Mexico', city: 'Albuquerque' },
  'NY': { name: 'New York', city: 'New York' },
  'NC': { name: 'North Carolina', city: 'Charlotte' },
  'ND': { name: 'North Dakota', city: 'Fargo' },
  'OH': { name: 'Ohio', city: 'Columbus' },
  'OK': { name: 'Oklahoma', city: 'Oklahoma City' },
  'OR': { name: 'Oregon', city: 'Portland' },
  'PA': { name: 'Pennsylvania', city: 'Philadelphia' },
  'RI': { name: 'Rhode Island', city: 'Providence' },
  'SC': { name: 'South Carolina', city: 'Charleston' },
  'SD': { name: 'South Dakota', city: 'Sioux Falls' },
  'TN': { name: 'Tennessee', city: 'Nashville' },
  'TX': { name: 'Texas', city: 'Houston' },
  'UT': { name: 'Utah', city: 'Salt Lake City' },
  'VT': { name: 'Vermont', city: 'Burlington' },
  'VA': { name: 'Virginia', city: 'Virginia Beach' },
  'WA': { name: 'Washington', city: 'Seattle' },
  'WV': { name: 'West Virginia', city: 'Charleston' },
  'WI': { name: 'Wisconsin', city: 'Milwaukee' },
  'WY': { name: 'Wyoming', city: 'Cheyenne' },
  'DC': { name: 'District of Columbia', city: 'Washington' }
};

function extractCityFromTitle(title) {
  if (!title) return null;
  
  // 1. Check for parenthetical "City, ST" pattern: "(New York, NY)" or "(Miami, FL)"
  const parenCityState = title.match(/\(([A-Za-z\s]+),\s*([A-Z]{2})\)/);
  if (parenCityState && STATES[parenCityState[2]]) {
    return { 
      city: parenCityState[1].trim(), 
      state: STATES[parenCityState[2]].name, 
      country: 'US' 
    };
  }
  
  // 2. Check for just state abbrev in parens: "(NY)" -> use major city
  const parenState = title.match(/\(([A-Z]{2})\)/);
  if (parenState && STATES[parenState[1]]) {
    const stateInfo = STATES[parenState[1]];
    return { 
      city: stateInfo.city, 
      state: stateInfo.name, 
      country: 'US' 
    };
  }
  
  // 3. Check for "City, State" anywhere in title
  const cityStateMatch = title.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})(?:\s|$|\)|\-)/);
  if (cityStateMatch && STATES[cityStateMatch[2]]) {
    return { 
      city: cityStateMatch[1].trim(), 
      state: STATES[cityStateMatch[2]].name, 
      country: 'US' 
    };
  }
  
  // 4. Check for known city names
  const upperTitle = title.toUpperCase();
  for (const city of US_CITIES) {
    const pattern = new RegExp(`\\b${city.toUpperCase().replace(/\./g, '\\.')}\\b`);
    if (pattern.test(upperTitle)) {
      return { city, country: 'US' };
    }
  }
  
  // 5. Check for "in [City]" or "at [City]" patterns
  const inMatch = title.match(/\b(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (inMatch) {
    const potentialCity = inMatch[1];
    const skipWords = ['The', 'This', 'That', 'Our', 'Your', 'All', 'New', 'Old', 'A', 'An'];
    if (!skipWords.includes(potentialCity)) {
      return { city: potentialCity, country: 'US' };
    }
  }
  
  // 6. Check for venue patterns: "@ Venue Name, City"
  const venueMatch = title.match(/@\s*[^,]+,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (venueMatch) {
    return { city: venueMatch[1].trim(), country: 'US' };
  }
  
  return null;
}

// Detect non-US events by language patterns
function detectLanguage(title) {
  if (!title) return null;
  
  // German indicators
  if (/\b(für|und|oder|bei|mit|von|das|der|die)\b/i.test(title)) {
    return { country: 'Germany', language: 'de' };
  }
  
  // Spanish indicators  
  if (/\b(para|con|del|las|los|una|por)\b/i.test(title)) {
    return { country: 'Spain', language: 'es' };
  }
  
  // French indicators
  if (/\b(pour|avec|dans|les|des|une|est)\b/i.test(title)) {
    return { country: 'France', language: 'fr' };
  }
  
  return null;
}

module.exports = { extractCityFromTitle, detectLanguage, US_CITIES, STATES };
