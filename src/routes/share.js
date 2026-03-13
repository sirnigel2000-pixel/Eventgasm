const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// Generate share page with OG meta tags for rich previews
router.get('/event/:id', async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    
    if (!event) {
      return res.status(404).send('Event not found');
    }
    
    const date = event.start_time 
      ? new Date(event.start_time).toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        })
      : 'Date TBA';
    
    const venue = event.venue_name || 'Venue TBA';
    const location = [event.city, event.state].filter(Boolean).join(', ');
    const description = event.description 
      ? event.description.slice(0, 160) + (event.description.length > 160 ? '...' : '')
      : `${date} at ${venue}`;
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.title} | Eventgasm</title>
  
  <!-- Open Graph -->
  <meta property="og:title" content="${event.title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${event.image_url || 'https://eventgasm.onrender.com/og-default.png'}">
  <meta property="og:url" content="https://eventgasm.onrender.com/share/event/${event.id}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Eventgasm">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${event.title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${event.image_url || 'https://eventgasm.onrender.com/og-default.png'}">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f9fa;
      min-height: 100vh;
    }
    .card {
      max-width: 600px;
      margin: 20px auto;
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .image {
      width: 100%;
      height: 300px;
      object-fit: cover;
      background: linear-gradient(135deg, #667eea, #764ba2);
    }
    .content { padding: 24px; }
    .category {
      display: inline-block;
      background: #667eea15;
      color: #667eea;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 24px;
      color: #1a1a1a;
      margin-bottom: 12px;
    }
    .date {
      color: #667eea;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .venue {
      color: #666;
      margin-bottom: 16px;
    }
    .description {
      color: #444;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .cta {
      display: block;
      background: #667eea;
      color: #fff;
      text-align: center;
      padding: 14px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: background 0.2s;
    }
    .cta:hover { background: #5a6fd6; }
    .footer {
      text-align: center;
      padding: 20px;
      color: #888;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    ${event.image_url ? `<img src="${event.image_url}" class="image" alt="${event.title}">` : '<div class="image"></div>'}
    <div class="content">
      <span class="category">${event.category || 'Event'}</span>
      <h1>${event.title}</h1>
      <div class="date">📅 ${date}</div>
      <div class="venue">📍 ${venue}${location ? ` • ${location}` : ''}</div>
      ${event.description ? `<p class="description">${event.description.slice(0, 300)}</p>` : ''}
      <a href="https://eventgasm.onrender.com/app.html" class="cta">View on Eventgasm</a>
    </div>
  </div>
  <div class="footer">🎉 Find more events at eventgasm.onrender.com</div>
</body>
</html>`;
    
    res.send(html);
  } catch (err) {
    res.status(500).send('Error loading event');
  }
});

module.exports = router;
