/**
 * StubHub Integration
 * Generates search links to find tickets on StubHub (resale marketplace)
 */

const BASE_URL = 'https://www.stubhub.com';

/**
 * Generate a StubHub search URL for an event
 * @param {Object} event - Event object with title, venue, date
 * @returns {string} StubHub search URL
 */
function generateSearchUrl(event) {
  const query = encodeURIComponent(`${event.title} ${event.venue_name || ''}`);
  return `${BASE_URL}/search?q=${query}`;
}

/**
 * Generate a more specific StubHub URL based on event details
 * StubHub URL patterns:
 * - /event/{event-name}-tickets/{event-id}
 * - /search?q={query}
 * - /{category}/{performer-name}-tickets/
 */
function generateEventUrl(event) {
  // Clean up title for URL
  const slug = event.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  
  // For now, use search URL (most reliable without API access)
  const query = encodeURIComponent(event.title);
  const date = event.start_time ? new Date(event.start_time).toISOString().split('T')[0] : '';
  
  // Add location context for better results
  const location = event.city ? encodeURIComponent(event.city) : '';
  
  return `${BASE_URL}/search?q=${query}${location ? `&loc=${location}` : ''}`;
}

/**
 * Get ticket link info for an event
 * @param {Object} event - Event from our database
 * @returns {Object} Ticket link info
 */
function getTicketLink(event) {
  return {
    source: 'stubhub',
    name: 'StubHub',
    type: 'resale',
    url: generateEventUrl(event),
    icon: '🔄',
    note: 'Resale tickets'
  };
}

module.exports = {
  generateSearchUrl,
  generateEventUrl,
  getTicketLink
};
