/**
 * Title Parser - Extract location from event titles
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
  'Cocoa Beach', 'Cape Canaveral', 'Brevard', 'Space Coast'
];

// State abbreviations
const STATES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};

function extractCityFromTitle(title) {
  if (!title) return null;
  
  const upperTitle = title.toUpperCase();
  
  // Check for city names
  for (const city of US_CITIES) {
    const pattern = new RegExp(`\\b${city.toUpperCase()}\\b`);
    if (pattern.test(upperTitle)) {
      return { city, country: 'US' };
    }
  }
  
  // Check for "in [City]" or "at [City]" patterns
  const inMatch = title.match(/\b(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (inMatch) {
    const potentialCity = inMatch[1];
    // Verify it looks like a city (starts with capital, not common words)
    const skipWords = ['The', 'This', 'That', 'Our', 'Your', 'All', 'New', 'Old'];
    if (!skipWords.includes(potentialCity)) {
      return { city: potentialCity, country: 'US' };
    }
  }
  
  // Check for state abbreviations like "Orlando, FL"
  const stateMatch = title.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*([A-Z]{2})\b/);
  if (stateMatch && STATES[stateMatch[2]]) {
    return { 
      city: stateMatch[1], 
      state: STATES[stateMatch[2]], 
      country: 'US' 
    };
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
