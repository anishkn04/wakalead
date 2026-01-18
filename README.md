# WakaLead - WakaTime Leaderboard & Analytics

A modern, minimal web application for tracking and comparing WakaTime coding statistics across team members.

## Features

- 🏆 **Daily & Weekly Leaderboards** - See who's coding the most
- 📊 **Weekly Performance Graph** - Visualize coding trends over 7 days
- 🎨 **Dark/Light Mode** - Automatic theme switching with manual toggle
- 🔐 **Secure Authentication** - OAuth via WakaTime
- 👨‍💼 **Admin Panel** - Manage users and trigger data fetches
- ⚡ **Optimized Data Fetching** - Scheduled cron jobs, no API spam
- 🚀 **Cloudflare-Native** - Deployed on Cloudflare Pages + Workers

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Chart.js
- **Backend**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare KV (sessions)
- **Deployment**: Cloudflare Pages

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- WakaTime account

### 2. Get WakaTime OAuth Credentials

1. Go to https://wakatime.com/apps
2. Create a new OAuth application
3. Set redirect URI to your deployment URL (e.g., `https://wakalead.pages.dev`)
4. Save the Client ID and Client Secret

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Up Cloudflare Resources

```bash
# Login to Cloudflare
npx wrangler login

# Create D1 database
npx wrangler d1 create wakalead

# Note the database ID and update wrangler.toml

# Run database migration
npm run db:migrate

# Create KV namespace for sessions
npx wrangler kv:namespace create "SESSIONS"

# Note the KV namespace ID and update wrangler.toml
```

### 5. Configure Environment Variables

Set these as Wrangler secrets (NOT in version control):

```bash
npx wrangler secret put WAKATIME_CLIENT_ID
npx wrangler secret put WAKATIME_CLIENT_SECRET
npx wrangler secret put WAKATIME_REDIRECT_URI
npx wrangler secret put SESSION_SECRET
```

Update `wrangler.toml`:
- Set your D1 database ID
- Set your KV namespace ID
- Update `WAKATIME_REDIRECT_URI` to your deployment URL

### 6. Deploy

```bash
# Deploy Worker
npm run worker:deploy

# Build and deploy frontend
npm run deploy
```

### 7. Configure API Proxy

After deploying, update [functions/_worker.js](functions/_worker.js#L12) with your Worker URL.

## Local Development

```bash
# Start frontend dev server
npm run dev

# In another terminal, start Worker dev server
npm run worker:dev
```

Create a `.env` file:
```env
VITE_API_BASE=http://localhost:8787/api
```

## Architecture

### Data Fetching Strategy

- **Scheduled Cron**: Runs daily at 2 AM UTC
- Fetches previous day's data for all users
- Stores in D1 database for fast reads
- Logs all fetch attempts to track rate limits
- Token refresh handled automatically

### Caching Strategy

- Daily stats cached in D1 database
- Sessions stored in KV with 7-day TTL
- Frontend makes minimal API calls
- No data fetching on every page load

### Admin Access

- Admin user: WakaTime ID `anishkn04`
- Admin can:
  - View all users
  - Delete users
  - Trigger manual data fetch

### Security

- OAuth tokens stored encrypted (implement encryption in production)
- Session-based authentication
- Admin routes protected
- CORS configured for frontend origin

## Database Schema

See [schema.sql](schema.sql) for full details:

- `users` - User profiles and tokens
- `daily_stats` - Daily coding time per user
- `fetch_log` - API fetch history for debugging

## API Endpoints

### Public
- `GET /api/auth/login` - Redirect to WakaTime OAuth
- `GET /api/auth/callback` - OAuth callback handler

### Authenticated
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/leaderboard/today` - Today's leaderboard
- `GET /api/leaderboard/week` - This week's leaderboard
- `GET /api/weekly-data` - Last 7 days data for chart

### Admin Only
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Add user manually
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/fetch-now` - Trigger data fetch

## Customization

### Change Admin User

Update `ADMIN_WAKATIME_ID` in [wrangler.toml](wrangler.toml):
```toml
ADMIN_WAKATIME_ID = "your_wakatime_id"
```

### Adjust Fetch Schedule

Update cron trigger in [wrangler.toml](wrangler.toml):
```toml
crons = ["0 2 * * *"]  # 2 AM UTC daily
```

### Theme Colors

Customize in [tailwind.config.js](tailwind.config.js) or modify component styles.

## Troubleshooting

### "Not authenticated" error
- Check session is stored in localStorage
- Verify WakaTime OAuth redirect URI matches deployment URL

### No data showing
- Run manual fetch via Admin Panel
- Check Worker logs: `npx wrangler tail`
- Verify WakaTime tokens are valid

### Rate limiting
- Default: 1 fetch per user per day
- Adjust in [worker/fetcher.ts](worker/fetcher.ts)
- Check fetch_log table for errors

## License

MIT

## Support

For issues or questions, create an issue in the repository.
