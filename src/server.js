const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const { pool, initializeDatabase } = require('./db');
const Event = require('./models/Event');
const eventsRouter = require('./routes/events');
const adminRouter = require('./routes/admin');
const usersRouter = require('./routes/users');
// Social features disabled until sequelize is properly configured
// const socialRouter = require('./routes/social');
// const messagesRouter = require('./routes/messages');
// const squadsRouter = require('./routes/squads');
// const activityRouter = require('./routes/activity');
const shareRouter = require('./routes/share');
const submissionsRouter = require('./routes/submissions');
const syncManager = require('./services/syncManager');

const app = express();
const PORT = process.env.PORT || 4600;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline styles for OG pages
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/events', eventsRouter);
app.use('/api/users', usersRouter);
// Social features disabled until sequelize is properly configured
// app.use('/api/social', socialRouter);
// app.use('/api/messages', messagesRouter);
// app.use('/api/squads', squadsRouter);
// app.use('/api/activity', activityRouter);
app.use('/share', shareRouter);
app.use('/admin', adminRouter);
app.use('/api/submissions', submissionsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'eventgasm' });
});

// Shareable event page with Open Graph tags
// This is what makes links look nice when shared on Facebook, iMessage, Twitter, etc.
app.get('/e/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).send('Event not found');
    }

    const eventDate = new Date(event.start_time).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    const location = [event.venue_name, event.city, event.state].filter(Boolean).join(', ');
    const description = event.description 
      ? event.description.substring(0, 200) + (event.description.length > 200 ? '...' : '')
      : `${eventDate} at ${location}`;

    // Generate HTML with Open Graph meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(event.title)} | Eventgasm</title>
  
  <!-- Open Graph (Facebook, iMessage, etc.) -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(event.title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${BASE_URL}/e/${event.id}">
  ${event.image_url ? `<meta property="og:image" content="${escapeHtml(event.image_url)}">` : ''}
  <meta property="og:site_name" content="Eventgasm">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(event.title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${event.image_url ? `<meta name="twitter:image" content="${escapeHtml(event.image_url)}">` : ''}
  
  <!-- App Deep Link (for when we have the mobile app) -->
  <meta property="al:ios:url" content="eventgasm://event/${event.id}">
  <meta property="al:ios:app_store_id" content="YOUR_APP_STORE_ID">
  <meta property="al:ios:app_name" content="Eventgasm">
  <meta property="al:android:url" content="eventgasm://event/${event.id}">
  <meta property="al:android:package" content="com.eventgasm.app">
  <meta property="al:android:app_name" content="Eventgasm">
  
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .image {
      width: 100%;
      height: 250px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      background-size: cover;
      background-position: center;
    }
    .content {
      padding: 24px;
    }
    .category {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 24px;
      color: #1a1a2e;
      margin-bottom: 16px;
      line-height: 1.3;
    }
    .meta {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    }
    .meta-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      color: #555;
    }
    .meta-item .icon {
      font-size: 20px;
      width: 24px;
      text-align: center;
    }
    .meta-item .text {
      flex: 1;
    }
    .description {
      color: #666;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .buttons {
      display: flex;
      gap: 12px;
    }
    .btn {
      flex: 1;
      padding: 14px 20px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      text-align: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .btn-secondary {
      background: #f0f0f0;
      color: #333;
    }
    .price {
      font-size: 18px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 20px;
    }
    .app-banner {
      background: #f8f9fa;
      padding: 16px 24px;
      text-align: center;
      border-top: 1px solid #eee;
    }
    .app-banner a {
      color: #667eea;
      font-weight: 600;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    ${event.image_url 
      ? `<div class="image" style="background-image: url('${escapeHtml(event.image_url)}')"></div>`
      : `<div class="image"></div>`
    }
    <div class="content">
      ${event.category ? `<span class="category">${escapeHtml(event.category)}</span>` : ''}
      <h1>${escapeHtml(event.title)}</h1>
      
      <div class="meta">
        <div class="meta-item">
          <span class="icon">📅</span>
          <span class="text">${eventDate}</span>
        </div>
        <div class="meta-item">
          <span class="icon">📍</span>
          <span class="text">${escapeHtml(location)}</span>
        </div>
      </div>
      
      ${event.price_min !== null || event.is_free ? `
        <div class="price">
          ${event.is_free ? 'Free' : 
            event.price_min === event.price_max ? `$${event.price_min}` :
            `$${event.price_min}${event.price_max ? ` - $${event.price_max}` : '+'}`
          }
        </div>
      ` : ''}
      
      ${event.description ? `<p class="description">${escapeHtml(event.description.substring(0, 500))}</p>` : ''}
      
      <div class="buttons">
        ${event.ticket_url ? `<a href="${escapeHtml(event.ticket_url)}" class="btn btn-primary" target="_blank">Get Tickets</a>` : ''}
        <a href="eventgasm://event/${event.id}" class="btn btn-secondary">Open in App</a>
      </div>
    </div>
    <div class="app-banner">
      Find more events on <a href="${BASE_URL}">Eventgasm</a>
    </div>
  </div>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('Error rendering event page:', error);
    res.status(500).send('Error loading event');
  }
});

// Escape HTML for safe rendering
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start server
async function start() {
  try {
    await initializeDatabase();
    
    // Start sync scheduler
    syncManager.startScheduler();
    
    app.listen(PORT, () => {
      console.log(`🎉 Eventgasm running on ${BASE_URL}`);
      console.log(`   API: ${BASE_URL}/api/events`);
      console.log(`   Share links: ${BASE_URL}/e/{event-id}`);
      console.log(`   Admin: ${BASE_URL}/admin/status`);
    });

    // Run initial sync if no events exist
    const { rows } = await pool.query('SELECT COUNT(*) FROM events');
    if (parseInt(rows[0].count) === 0) {
      console.log('[Startup] No events found, triggering initial sync...');
      // Don't await - let it run in background
      syncManager.runQuickSync();
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Deploy trigger: 2026-03-15T17:31:37Z
// Deploy trigger Sun Mar 15 13:47:08 EDT 2026
// Deploy 1773598968
// Redeploy trigger Sun Mar 15 17:23:50 EDT 2026
// Parser improved Sun Mar 15 17:43:52 EDT 2026
// Redeploy trigger Sun Mar 15 22:55:31 EDT 2026
