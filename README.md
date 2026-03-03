# Eventorator 🎉

Nationwide event aggregation service that pulls from multiple sources to give you a comprehensive view of events happening everywhere.

## Features

- **Multi-source aggregation**: Ticketmaster, Eventbrite, SeatGeek, and more
- **Automatic deduplication**: Same event from multiple sources → one listing
- **Geospatial search**: Find events within X miles of any location
- **Shareable links**: Beautiful preview cards when shared on iMessage, Facebook, Twitter
- **REST API**: Power mobile apps, websites, or integrations
- **Auto-sync**: Scheduled syncs keep data fresh

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (with PostGIS for geospatial queries)
- API keys for event sources (see below)

### Setup

1. Clone and install:
```bash
cd eventorator
npm install
```

2. Create `.env` from sample:
```bash
cp .env.sample .env
```

3. Configure your `.env`:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/eventorator
PORT=4600
BASE_URL=http://localhost:4600

# Get these from each provider's developer portal
TICKETMASTER_API_KEY=your_key
EVENTBRITE_API_KEY=your_key
SEATGEEK_CLIENT_ID=your_id
SEATGEEK_CLIENT_SECRET=your_secret
```

4. Create database:
```bash
createdb eventorator
```

5. Start the server:
```bash
npm start
```

The server will initialize the database schema automatically.

## API Endpoints

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List events with filters |
| GET | `/api/events/trending` | Get trending events |
| GET | `/api/events/categories` | Get categories with counts |
| GET | `/api/events/:id` | Get single event |

### Query Parameters

- `lat`, `lng` - Coordinates for geospatial search
- `radius` - Miles radius (default: 25)
- `city`, `state` - Location filter
- `category` - Category filter
- `start_date`, `end_date` - Date range filter
- `q` - Text search
- `limit`, `offset` - Pagination

### Examples

```bash
# Events near Philadelphia
curl "http://localhost:4600/api/events?lat=39.95&lng=-75.16&radius=30"

# Music events in New York
curl "http://localhost:4600/api/events?city=New%20York&state=NY&category=Music"

# Search for Taylor Swift
curl "http://localhost:4600/api/events?q=Taylor%20Swift"

# Trending events
curl "http://localhost:4600/api/events/trending"
```

### Admin

Protected with `x-admin-token` header or `?token=` query param.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/status` | Sync status and stats |
| POST | `/admin/sync/full` | Trigger full sync |
| POST | `/admin/sync/quick` | Trigger quick sync |
| GET | `/admin/events/stats` | Detailed statistics |

```bash
curl -H "x-admin-token: eventorator-admin" http://localhost:4600/admin/status
```

### Shareable Event Pages

Every event has a shareable URL at `/e/{event-id}` with full Open Graph support:

```
https://your-domain.com/e/abc123-def456
```

When shared on Facebook, iMessage, Twitter, etc., it shows a rich preview with:
- Event title
- Date and time
- Venue and location
- Event image
- "Get Tickets" link

## Event Sources

### Currently Implemented

1. **Ticketmaster** - Concerts, sports, theatre nationwide
2. **Eventbrite** - Community events, classes, meetups
3. **SeatGeek** - Sports, concerts with pricing

### Coming Soon

- Bandsintown (concerts by artist)
- Songkick (concerts/tours)
- Meetup (community events)
- Facebook Events
- Local venue calendars (scrapers)

## Sync Schedule

By default:
- **Full sync**: Every 6 hours (all sources, all regions)
- **Quick sync**: Every hour (major cities only)

Configure in `src/services/syncManager.js`.

## Deployment (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repo
3. Set environment variables (DATABASE_URL, API keys, etc.)
4. Set BASE_URL to your Render URL
5. Build command: `npm install`
6. Start command: `npm start`

You'll also need a PostgreSQL database on Render (or elsewhere).

## Project Structure

```
eventorator/
├── src/
│   ├── server.js          # Express app entry point
│   ├── db.js              # Database connection + schema
│   ├── models/
│   │   └── Event.js       # Event model with queries
│   ├── routes/
│   │   ├── events.js      # Public API routes
│   │   └── admin.js       # Admin routes
│   └── services/
│       ├── ticketmaster.js
│       ├── eventbrite.js
│       ├── seatgeek.js
│       └── syncManager.js  # Orchestrates all syncs
├── public/                 # Static assets
├── .env.sample
├── package.json
└── README.md
```

## Getting API Keys

1. **Ticketmaster**: https://developer.ticketmaster.com/
2. **Eventbrite**: https://www.eventbrite.com/platform/
3. **SeatGeek**: https://seatgeek.com/build

## License

ISC
