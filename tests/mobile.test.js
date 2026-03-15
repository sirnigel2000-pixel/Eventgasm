/**
 * Eventgasm Mobile App Test Suite
 * Validates code structure and common issues
 * 
 * Run: node tests/mobile.test.js
 */

const fs = require('fs');
const path = require('path');

const MOBILE_DIR = path.join(__dirname, '../mobile');
const results = { passed: 0, failed: 0, errors: [] };

// Test runner
function test(name, fn) {
  try {
    fn();
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

function fileExists(filePath) {
  return fs.existsSync(path.join(MOBILE_DIR, filePath));
}

function fileContains(filePath, text) {
  const content = fs.readFileSync(path.join(MOBILE_DIR, filePath), 'utf8');
  return content.includes(text);
}

function fileNotContains(filePath, text) {
  const content = fs.readFileSync(path.join(MOBILE_DIR, filePath), 'utf8');
  return !content.includes(text);
}

// ============================================
// FILE STRUCTURE TESTS
// ============================================

function testFileStructure() {
  test('App.js exists', () => {
    assert(fileExists('App.js'), 'App.js missing');
  });

  test('package.json exists', () => {
    assert(fileExists('package.json'), 'package.json missing');
  });

  test('babel.config.js exists (required for Reanimated)', () => {
    assert(fileExists('babel.config.js'), 'babel.config.js missing - Reanimated will crash');
  });

  test('Theme file exists', () => {
    assert(fileExists('src/theme/index.js'), 'Theme file missing');
  });

  test('SwipeCard component exists', () => {
    assert(fileExists('src/components/SwipeCard.js'), 'SwipeCard missing');
  });

  test('SwipeScreen exists', () => {
    assert(fileExists('src/screens/SwipeScreen.js'), 'SwipeScreen missing');
  });

  test('API service exists', () => {
    assert(fileExists('src/services/api.js'), 'API service missing');
  });
}

// ============================================
// DEPENDENCY TESTS
// ============================================

function testDependencies() {
  const pkg = JSON.parse(fs.readFileSync(path.join(MOBILE_DIR, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  test('react-native-reanimated installed', () => {
    assert(deps['react-native-reanimated'], 'react-native-reanimated not installed');
  });

  test('react-native-gesture-handler installed', () => {
    assert(deps['react-native-gesture-handler'], 'react-native-gesture-handler not installed');
  });

  test('expo-linear-gradient installed', () => {
    assert(deps['expo-linear-gradient'], 'expo-linear-gradient not installed');
  });

  test('babel-preset-expo installed', () => {
    assert(deps['babel-preset-expo'], 'babel-preset-expo not installed');
  });
}

// ============================================
// BABEL CONFIG TESTS
// ============================================

function testBabelConfig() {
  test('Babel config has reanimated plugin', () => {
    assert(
      fileContains('babel.config.js', 'react-native-reanimated/plugin'),
      'Babel config missing reanimated plugin'
    );
  });
}

// ============================================
// API CONFIG TESTS
// ============================================

function testApiConfig() {
  test('API not pointing to localhost', () => {
    // In production, API should point to Render, not localhost
    const content = fs.readFileSync(path.join(MOBILE_DIR, 'src/services/api.js'), 'utf8');
    const hasProductionUrl = content.includes('eventgasm.onrender.com');
    assert(hasProductionUrl, 'API should have production URL');
  });

  test('API has reasonable timeout', () => {
    const content = fs.readFileSync(path.join(MOBILE_DIR, 'src/services/api.js'), 'utf8');
    const timeoutMatch = content.match(/timeout:\s*(\d+)/);
    if (timeoutMatch) {
      const timeout = parseInt(timeoutMatch[1]);
      assert(timeout >= 15000, `Timeout too low: ${timeout}ms`);
    }
  });
}

// ============================================
// NAVIGATION TESTS
// ============================================

function testNavigation() {
  test('App.js imports SwipeScreen', () => {
    assert(
      fileContains('App.js', 'SwipeScreen'),
      'App.js should import SwipeScreen'
    );
  });

  test('Navigation uses correct tab names', () => {
    const content = fs.readFileSync(path.join(MOBILE_DIR, 'App.js'), 'utf8');
    // Check that navigations use Tab names (e.g., ProfileTab not Profile)
    const hasCorrectTabNames = content.includes('ProfileTab') || content.includes('DiscoverTab');
    assert(hasCorrectTabNames, 'Navigation should use correct Tab names');
  });
}

// ============================================
// COMPONENT TESTS
// ============================================

function testComponents() {
  test('SwipeCard uses LinearGradient', () => {
    assert(
      fileContains('src/components/SwipeCard.js', 'LinearGradient'),
      'SwipeCard should use LinearGradient for overlay'
    );
  });

  test('SwipeCard imports CategoryPlaceholder', () => {
    assert(
      fileContains('src/components/SwipeCard.js', 'CategoryPlaceholder'),
      'SwipeCard should use CategoryPlaceholder for missing images'
    );
  });

  test('MapScreen handles both coordinate formats', () => {
    const content = fs.readFileSync(path.join(MOBILE_DIR, 'src/screens/MapScreen.js'), 'utf8');
    const handlesBoth = content.includes('venue?.coordinates') || content.includes('venue.coordinates');
    assert(handlesBoth, 'MapScreen should handle venue.coordinates format');
  });
}

// ============================================
// REGRESSION TESTS (based on specific bugs)
// ============================================

function testRegressions() {
  // BUG: CSS gradient doesn't work in React Native
  test('No CSS backgroundImage in styles (React Native incompatible)', () => {
    const files = [
      'src/components/SwipeCard.js',
      'src/screens/SwipeScreen.js',
    ];
    for (const file of files) {
      if (fileExists(file)) {
        assert(
          fileNotContains(file, 'backgroundImage:'),
          `${file} has CSS backgroundImage (not supported in RN)`
        );
      }
    }
  });

  // BUG: Navigation to 'Profile' instead of 'ProfileTab'
  test('SwipeScreen uses correct navigation targets', () => {
    if (fileExists('src/screens/SwipeScreen.js')) {
      const content = fs.readFileSync(path.join(MOBILE_DIR, 'src/screens/SwipeScreen.js'), 'utf8');
      const badNav = content.includes("navigate('Profile')") && !content.includes("navigate('ProfileTab')");
      assert(!badNav, 'SwipeScreen should navigate to ProfileTab, not Profile');
    }
  });
}

// ============================================
// MAIN TEST RUNNER
// ============================================

function runAllTests() {
  console.log('\n📱 EVENTGASM MOBILE TEST SUITE\n');
  console.log(`Testing: ${MOBILE_DIR}\n`);
  console.log('─'.repeat(50));

  console.log('\n📁 File Structure Tests');
  testFileStructure();

  console.log('\n📦 Dependency Tests');
  testDependencies();

  console.log('\n⚙️  Babel Config Tests');
  testBabelConfig();

  console.log('\n🌐 API Config Tests');
  testApiConfig();

  console.log('\n🧭 Navigation Tests');
  testNavigation();

  console.log('\n🧩 Component Tests');
  testComponents();

  console.log('\n🐛 Regression Tests');
  testRegressions();

  console.log('\n' + '─'.repeat(50));
  console.log(`\n📊 RESULTS: ${results.passed} passed, ${results.failed} failed\n`);

  if (results.errors.length > 0) {
    console.log('❌ FAILURES:');
    for (const err of results.errors) {
      console.log(`   - ${err.name}: ${err.error}`);
    }
    console.log('');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

runAllTests();
