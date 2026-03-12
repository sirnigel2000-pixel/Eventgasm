const axios = require('axios');

// Rotating user agents (looks like different browsers)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];

// Track blocked domains and backoff times
const blockedDomains = new Map(); // domain -> unblock timestamp

// Get random user agent
function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Get domain from URL
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Check if domain is currently blocked
function isBlocked(url) {
  const domain = getDomain(url);
  const unblockTime = blockedDomains.get(domain);
  if (!unblockTime) return false;
  if (Date.now() > unblockTime) {
    blockedDomains.delete(domain);
    return false;
  }
  return true;
}

// Mark domain as blocked with exponential backoff
function markBlocked(url, attemptCount = 1) {
  const domain = getDomain(url);
  // Exponential backoff: 1min, 2min, 4min, 8min, max 30min
  const backoffMs = Math.min(60000 * Math.pow(2, attemptCount - 1), 30 * 60000);
  blockedDomains.set(domain, Date.now() + backoffMs);
  console.log(`[Scraper] ${domain} blocked, backing off ${backoffMs / 1000}s`);
}

// Resilient fetch with auto-retry and block detection
async function resilientFetch(url, options = {}) {
  const {
    maxRetries = 3,
    timeout = 15000,
    headers = {},
    validateStatus = (s) => s < 400,
  } = options;

  // Check if domain is blocked
  if (isBlocked(url)) {
    const domain = getDomain(url);
    const waitTime = blockedDomains.get(domain) - Date.now();
    console.log(`[Scraper] ${domain} in cooldown, ${Math.round(waitTime / 1000)}s remaining`);
    return null;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout,
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...headers,
        },
        validateStatus: () => true, // Don't throw on any status
      });

      // Success
      if (response.status >= 200 && response.status < 300) {
        return response;
      }

      // Rate limited - back off
      if (response.status === 429) {
        console.log(`[Scraper] 429 Rate Limited: ${url}`);
        const retryAfter = parseInt(response.headers['retry-after']) || 60;
        markBlocked(url, attempt);
        
        if (attempt < maxRetries) {
          await sleep(retryAfter * 1000);
          continue;
        }
        return null;
      }

      // Forbidden/blocked
      if (response.status === 403) {
        console.log(`[Scraper] 403 Forbidden: ${url}`);
        markBlocked(url, attempt);
        return null;
      }

      // Server error - retry
      if (response.status >= 500) {
        console.log(`[Scraper] ${response.status} Server Error: ${url}`);
        if (attempt < maxRetries) {
          await sleep(2000 * attempt);
          continue;
        }
      }

      // Other error
      console.log(`[Scraper] ${response.status} Error: ${url}`);
      return null;

    } catch (err) {
      console.log(`[Scraper] Request failed (attempt ${attempt}): ${err.message}`);
      
      // Network error - retry with backoff
      if (attempt < maxRetries) {
        await sleep(2000 * attempt);
        continue;
      }
      return null;
    }
  }

  return null;
}

// Polite batch fetching with delays
async function batchFetch(urls, options = {}) {
  const {
    delayMs = 1500,      // Delay between requests
    concurrency = 1,      // Parallel requests (keep low to be polite)
    onProgress = null,    // Progress callback
  } = options;

  const results = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    
    // Skip if domain is blocked
    if (isBlocked(url)) {
      results.push({ url, data: null, blocked: true });
      continue;
    }

    const response = await resilientFetch(url, options);
    results.push({ 
      url, 
      data: response?.data || null,
      status: response?.status,
    });

    // Progress callback
    if (onProgress) {
      onProgress(i + 1, urls.length, url);
    }

    // Polite delay between requests
    if (i < urls.length - 1) {
      await sleep(delayMs + Math.random() * 500); // Add jitter
    }
  }

  return results;
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get blocked domains status
function getBlockedStatus() {
  const status = {};
  for (const [domain, unblockTime] of blockedDomains) {
    const remaining = unblockTime - Date.now();
    if (remaining > 0) {
      status[domain] = {
        blocked: true,
        remainingSeconds: Math.round(remaining / 1000),
      };
    }
  }
  return status;
}

module.exports = {
  resilientFetch,
  batchFetch,
  isBlocked,
  getBlockedStatus,
  getRandomUA,
  sleep,
};
