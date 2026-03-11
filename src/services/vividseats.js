/**
 * VividSeats Integration
 * Generates search links to find tickets on VividSeats (resale marketplace)
 */

const BASE_URL = 'https://www.vividseats.com';

/**
 * Generate a VividSeats search URL for an event
 * @param {Object} event - Event object with title, venue, date
 * @returns {string} VividSeats search URL
 */
function generateSearchUrl(event) {
  const query = encodeURIComponent(`${event.title}`);
  return `${BASE_URL}/search?searchTerm=${query}`;
}

/**
 * Generate a more specific VividSeats URL based on event details
 * VividSeats URL patterns:
 * - /search?searchTerm={query}
 * - /{category}/{performer-slug}/
 */
function generateEventUrl(event) {
  const query = encodeURIComponent(event.title);
  return `${BASE_URL}/search?searchTerm=${query}`;
}

/**
 * Get ticket link info for an event
 * @param {Object} event - Event from our database
 * @returns {Object} Ticket link info
 */
function getTicketLink(event) {
  return {
    source: 'vividseats',
    name: 'VividSeats',
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
