/**
 * Eventgasm API Test Suite
 * Based on historical bugs and fixes
 * 
 * Run: node tests/api.test.js
 * Or: npm test
 */

const https = require('https');
const http = require('http');

const API_BASE = process.env.API_URL || 'https://eventgasm.onrender.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'eventgasm-admin';

// Test results
const results = { passed: 0, failed: 0, errors: [] };

// Helper to make HTTP requests
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    const timeout = options.timeout || 30000;
    
    const req = lib.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Test runner
async function test(name, fn) {
  try {
    await fn();
    results.passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    results.failed++;
    results.errors.push({ name, error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ============================================
// API HEALTH TESTS
// ============================================

async function testApiHealth() {
  await test('API is responding', async () => {
    const res = await request(`${API_BASE}/api/events?limit=1`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success: true');
  });

  await test('API returns events array', async () => {
    const res = await request(`${API_BASE}/api/events?limit=5`);
    assert(Array.isArray(res.data.events), 'Events should be an array');
    assert(res.data.events.length > 0, 'Should have at least 1 event');
  });
}

// ============================================
// EVENT DATA TESTS (based on past bugs)
// ============================================

async function testEventData() {
  await test('Events have required fields', async () => {
    const res = await request(`${API_BASE}/api/events?limit=10`);
    for (const event of res.data.events) {
      assert(event.id, 'Event missing id');
      assert(event.title, 'Event missing title');
    }
  });

  await test('Events have venue data', async () => {
    const res = await request(`${API_BASE}/api/events?limit=10`);
    let hasVenue = false;
    for (const event of res.data.events) {
      if (event.venue?.name || event.venue_name) {
        hasVenue = true;
        break;
      }
    }
    assert(hasVenue, 'At least one event should have venue data');
  });

  await test('Free events filter works', async () => {
    const res = await request(`${API_BASE}/api/events?free=true&limit=10`);
    // Should not error
    assert(res.status === 200, 'Free filter should work');
  });

  await test('Category filter works', async () => {
    const res = await request(`${API_BASE}/api/events?category=Music&limit=10`);
    assert(res.status === 200, 'Category filter should work');
  });
}

// ============================================
// BOUNDING BOX TESTS (map feature)
// ============================================

async function testBoundingBox() {
  await test('Bounding box query works', async () => {
    const res = await request(
      `${API_BASE}/api/events?min_lat=25&max_lat=50&min_lng=-125&max_lng=-65&limit=10`
    );
    assert(res.status === 200, 'Bounding box query should work');
    assert(res.data.success === true, 'Should return success');
  });

  await test('Bounding box returns events with coordinates', async () => {
    const res = await request(
      `${API_BASE}/api/events?min_lat=25&max_lat=50&min_lng=-125&max_lng=-65&limit=50`
    );
    let hasCoords = false;
    for (const event of res.data.events || []) {
      if (event.venue?.coordinates?.lat || event.latitude) {
        hasCoords = true;
        break;
      }
    }
    assert(hasCoords, 'Bounding box should return events with coordinates');
  });
}

// ============================================
// ADMIN ENDPOINT TESTS
// ============================================

async function testAdminEndpoints() {
  await test('Admin status endpoint works', async () => {
    const res = await request(`${API_BASE}/admin/status?token=${ADMIN_TOKEN}`);
    assert(res.status === 200, 'Admin status should work');
    assert(res.data.events?.total, 'Should have event count');
  });

  await test('Admin status shows event counts', async () => {
    const res = await request(`${API_BASE}/admin/status?token=${ADMIN_TOKEN}`);
    const total = parseInt(res.data.events?.total || 0);
    assert(total > 0, `Should have events, got ${total}`);
  });

  await test('Geocode stats endpoint works', async () => {
    const res = await request(`${API_BASE}/admin/geocode/stats?token=${ADMIN_TOKEN}`);
    assert(res.status === 200, 'Geocode stats should work');
  });
}

// ============================================
// USER INTERACTION TESTS
// ============================================

async function testUserEndpoints() {
  await test('Users route exists', async () => {
    // Just check the route is mounted (will return method not allowed for GET)
    const res = await request(`${API_BASE}/api/users/signin`);
    // Any response that's not 500 means the route exists
    assert(res.status !== 500 && res.status !== 502, 'Users route should exist');
  });

  await test('Interactions endpoint exists', async () => {
    const res = await request(`${API_BASE}/api/users/interactions?user_id=00000000-0000-0000-0000-000000000000&status=going`);
    // 200 or 400 means endpoint exists
    assert(res.status === 200 || res.status === 400 || res.status === 404, 'Interactions endpoint should exist');
  });
}

// ============================================
// PERFORMANCE TESTS
// ============================================

async function testPerformance() {
  await test('API responds within 10 seconds', async () => {
    const start = Date.now();
    await request(`${API_BASE}/api/events?limit=50`);
    const duration = Date.now() - start;
    assert(duration < 10000, `Response took ${duration}ms, expected < 10000ms`);
  });

  await test('Large bounding box query completes', async () => {
    const start = Date.now();
    const res = await request(
      `${API_BASE}/api/events?min_lat=25&max_lat=50&min_lng=-125&max_lng=-65&limit=500`
    );
    const duration = Date.now() - start;
    assert(res.status === 200, 'Large query should complete');
    console.log(`   ⏱️  Large query took ${duration}ms`);
  });
}

// ============================================
// REGRESSION TESTS (based on specific bugs)
// ============================================

async function testRegressions() {
  // BUG: admin.js was truncated/corrupted (March 15, 2026)
  await test('Admin routes not corrupted', async () => {
    const res = await request(`${API_BASE}/admin/status?token=${ADMIN_TOKEN}`);
    assert(res.status !== 500, 'Admin routes should not crash');
    assert(!res.data?.error?.includes('router is not defined'), 'Admin routes corrupted');
  });

  // BUG: Social routes crashed due to missing sequelize
  await test('API does not crash on startup', async () => {
    const res = await request(`${API_BASE}/api/events?limit=1`);
    assert(res.status === 200, 'API should be running');
  });

  // BUG: Events without coordinates broke map
  await test('Events endpoint handles missing coordinates gracefully', async () => {
    const res = await request(`${API_BASE}/api/events?limit=100`);
    assert(res.status === 200, 'Should handle events without coords');
  });
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  console.log('\n🧪 EVENTGASM API TEST SUITE\n');
  console.log(`Testing: ${API_BASE}\n`);
  console.log('─'.repeat(50));

  console.log('\n📡 API Health Tests');
  await testApiHealth();

  console.log('\n📦 Event Data Tests');
  await testEventData();

  console.log('\n🗺️  Bounding Box Tests');
  await testBoundingBox();

  console.log('\n🔐 Admin Endpoint Tests');
  await testAdminEndpoints();

  console.log('\n👤 User Endpoint Tests');
  await testUserEndpoints();

  console.log('\n⚡ Performance Tests');
  await testPerformance();

  console.log('\n🐛 Regression Tests');
  await testRegressions();

  console.log('\n' + '─'.repeat(50));
  console.log(`\n📊 RESULTS: ${results.passed} passed, ${results.failed} failed\n`);

  if (results.errors.length > 0) {
    console.log('❌ FAILURES:');
    for (const err of results.errors) {
      console.log(`   - ${err.name}: ${err.error}`);
    }
    console.log('');
  }

  // Exit with error code if tests failed
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
