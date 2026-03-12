import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = '@eventgasm_user_prefs';
const VIEWS_KEY = '@eventgasm_event_views';

// Category weights - higher = more important signal
const SIGNAL_WEIGHTS = {
  favorite: 5,      // Strong signal
  view: 1,          // Weak signal
  purchase: 10,     // Strongest (if we track)
};

// Default preference profile
const DEFAULT_PREFS = {
  categories: {},         // { "Music": 5, "Sports": 2, ... }
  pricePreference: 0.5,   // 0 = only free, 1 = any price
  timePreference: {
    weekday: 0.5,
    weekend: 0.5,
  },
  venueTypes: {},         // { "arena": 3, "club": 2, ... }
  lastUpdated: null,
};

// Load user preferences
export async function getUserPreferences() {
  try {
    const stored = await AsyncStorage.getItem(PREFS_KEY);
    return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

// Save user preferences
async function savePreferences(prefs) {
  prefs.lastUpdated = Date.now();
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// Record an event view
export async function recordEventView(event) {
  const prefs = await getUserPreferences();
  
  // Update category affinity
  if (event.category) {
    prefs.categories[event.category] = (prefs.categories[event.category] || 0) + SIGNAL_WEIGHTS.view;
  }
  
  // Update price preference
  if (event.isFree) {
    prefs.pricePreference = Math.max(0, prefs.pricePreference - 0.02);
  } else {
    prefs.pricePreference = Math.min(1, prefs.pricePreference + 0.01);
  }
  
  // Update time preference
  const eventDate = new Date(event.timing?.start);
  const dayOfWeek = eventDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) {
    prefs.timePreference.weekend += 0.02;
    prefs.timePreference.weekday -= 0.01;
  } else {
    prefs.timePreference.weekday += 0.02;
    prefs.timePreference.weekend -= 0.01;
  }
  
  // Normalize time preferences
  const total = prefs.timePreference.weekday + prefs.timePreference.weekend;
  prefs.timePreference.weekday /= total;
  prefs.timePreference.weekend /= total;
  
  await savePreferences(prefs);
  
  // Also track view count
  await trackEventView(event.id);
}

// Record a favorite (stronger signal)
export async function recordFavorite(event) {
  const prefs = await getUserPreferences();
  
  if (event.category) {
    prefs.categories[event.category] = (prefs.categories[event.category] || 0) + SIGNAL_WEIGHTS.favorite;
  }
  
  if (event.isFree) {
    prefs.pricePreference = Math.max(0, prefs.pricePreference - 0.1);
  } else {
    prefs.pricePreference = Math.min(1, prefs.pricePreference + 0.05);
  }
  
  await savePreferences(prefs);
}

// Track individual event views
async function trackEventView(eventId) {
  try {
    const stored = await AsyncStorage.getItem(VIEWS_KEY);
    const views = stored ? JSON.parse(stored) : {};
    views[eventId] = (views[eventId] || 0) + 1;
    
    // Keep only last 500 events to prevent storage bloat
    const keys = Object.keys(views);
    if (keys.length > 500) {
      const toRemove = keys.slice(0, keys.length - 500);
      toRemove.forEach(k => delete views[k]);
    }
    
    await AsyncStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  } catch (error) {
    console.error('Error tracking view:', error);
  }
}

// Check if event was viewed
export async function wasEventViewed(eventId) {
  try {
    const stored = await AsyncStorage.getItem(VIEWS_KEY);
    const views = stored ? JSON.parse(stored) : {};
    return views[eventId] > 0;
  } catch {
    return false;
  }
}

// Score an event based on user preferences
export function scoreEvent(event, prefs) {
  let score = 50; // Base score
  
  // Category match (biggest factor)
  if (event.category && prefs.categories[event.category]) {
    const categoryScore = Math.min(prefs.categories[event.category], 30);
    score += categoryScore * 2;
  }
  
  // Price match
  if (event.isFree) {
    score += (1 - prefs.pricePreference) * 20; // Free lovers get boost
  } else {
    score += prefs.pricePreference * 10;
  }
  
  // Time match
  const eventDate = new Date(event.timing?.start);
  const dayOfWeek = eventDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) {
    score += prefs.timePreference.weekend * 15;
  } else {
    score += prefs.timePreference.weekday * 15;
  }
  
  // Recency boost (events sooner get small boost)
  const daysAway = (eventDate - new Date()) / (1000 * 60 * 60 * 24);
  if (daysAway >= 0 && daysAway < 7) {
    score += (7 - daysAway) * 2;
  }
  
  // Popularity boost (if we have view count from API)
  if (event.popularity) {
    score += Math.min(event.popularity / 10, 10);
  }
  
  return Math.round(score);
}

// Get recommended events from a list
export async function getRecommendedEvents(events, limit = 10) {
  const prefs = await getUserPreferences();
  
  // Score all events
  const scored = events.map(event => ({
    ...event,
    recommendationScore: scoreEvent(event, prefs),
  }));
  
  // Sort by score descending
  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
  
  // Return top N
  return scored.slice(0, limit);
}

// Get user's top categories
export async function getTopCategories(limit = 3) {
  const prefs = await getUserPreferences();
  
  const sorted = Object.entries(prefs.categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category]) => category);
  
  return sorted;
}

// Reset preferences (for testing or user request)
export async function resetPreferences() {
  await AsyncStorage.removeItem(PREFS_KEY);
  await AsyncStorage.removeItem(VIEWS_KEY);
}

// Get preference summary for debugging
export async function getPreferenceSummary() {
  const prefs = await getUserPreferences();
  const topCategories = await getTopCategories(5);
  
  return {
    topCategories,
    pricePreference: prefs.pricePreference > 0.6 ? 'Paid events' : prefs.pricePreference < 0.4 ? 'Free events' : 'Mixed',
    timePreference: prefs.timePreference.weekend > 0.6 ? 'Weekends' : prefs.timePreference.weekday > 0.6 ? 'Weekdays' : 'Anytime',
  };
}
