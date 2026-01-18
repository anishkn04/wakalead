# Quick Reference Guide

## 🚀 Common Commands

### Development

```bash
# Install dependencies
npm install

# Start frontend dev server (http://localhost:5173)
npm run dev

# Start Worker dev server (http://localhost:8787)
npm run worker:dev

# Build frontend for production
npm run build

# Preview production build
npm run preview
```

### Database

```bash
# Create D1 database
npx wrangler d1 create wakalead

# Run migrations
npm run db:migrate

# Query database
npx wrangler d1 execute wakalead --command "SELECT * FROM users"

# Backup users
npx wrangler d1 execute wakalead --command "SELECT * FROM users" --json > backup_users.json

# Backup daily stats
npx wrangler d1 execute wakalead --command "SELECT * FROM daily_stats ORDER BY date DESC LIMIT 100" --json > backup_stats.json
```

### Secrets Management

```bash
# List all secrets
npx wrangler secret list

# Set a secret
npx wrangler secret put SECRET_NAME

# Delete a secret
npx wrangler secret delete SECRET_NAME
```

### Deployment

```bash
# Deploy Worker
npm run worker:deploy

# Deploy to Cloudflare Pages
npm run deploy

# Or deploy manually
npm run build
npx wrangler pages deploy dist --project-name=wakalead
```

### Monitoring

```bash
# Tail Worker logs (real-time)
npx wrangler tail

# View Worker metrics
# Go to: Cloudflare Dashboard → Workers → wakalead-api → Metrics

# Check cron job status
# Go to: Cloudflare Dashboard → Workers → wakalead-api → Triggers
```

### KV Namespace

```bash
# Create KV namespace
npx wrangler kv:namespace create "SESSIONS"

# List KV namespaces
npx wrangler kv:namespace list

# View KV keys
npx wrangler kv:key list --namespace-id=YOUR_KV_ID

# Get KV value
npx wrangler kv:key get "session:xxxxx" --namespace-id=YOUR_KV_ID
```

## 🔧 Troubleshooting Commands

### Clear and Reinstall

```bash
rm -rf node_modules package-lock.json
npm install
```

### Reset Local Environment

```bash
rm -rf .wrangler dist node_modules
npm install
```

### Check Authentication

```bash
npx wrangler whoami
```

### Re-login to Cloudflare

```bash
npx wrangler logout
npx wrangler login
```

## 📊 Useful Database Queries

### View All Users

```bash
npx wrangler d1 execute wakalead --command "SELECT id, username, display_name, is_admin, created_at FROM users"
```

### Check Today's Data

```bash
npx wrangler d1 execute wakalead --command "SELECT u.username, ds.total_seconds FROM users u JOIN daily_stats ds ON u.id = ds.user_id WHERE ds.date = date('now')"
```

### View Fetch Logs (Last 10)

```bash
npx wrangler d1 execute wakalead --command "SELECT u.username, fl.fetch_type, fl.status, fl.fetched_at FROM fetch_log fl JOIN users u ON u.id = fl.user_id ORDER BY fl.fetched_at DESC LIMIT 10"
```

### Check Failed Fetches

```bash
npx wrangler d1 execute wakalead --command "SELECT u.username, fl.error_message, fl.fetched_at FROM fetch_log fl JOIN users u ON u.id = fl.user_id WHERE fl.status = 'error' ORDER BY fl.fetched_at DESC LIMIT 10"
```

### Get User by Username

```bash
npx wrangler d1 execute wakalead --command "SELECT * FROM users WHERE username = 'your_username'"
```

### Delete User by ID

```bash
npx wrangler d1 execute wakalead --command "DELETE FROM users WHERE id = USER_ID"
```

### View Weekly Stats

```bash
npx wrangler d1 execute wakalead --command "SELECT u.username, SUM(ds.total_seconds) as total FROM users u JOIN daily_stats ds ON u.id = ds.user_id WHERE ds.date >= date('now', '-7 days') GROUP BY u.id, u.username ORDER BY total DESC"
```

## 🔍 Debugging

### View Worker Logs in Real-Time

```bash
# All logs
npx wrangler tail

# Filter by status
npx wrangler tail --status error

# Filter by method
npx wrangler tail --method POST
```

### Check Build Issues

```bash
# TypeScript check
npx tsc --noEmit

# Build frontend
npm run build

# Build Worker
npx wrangler publish --dry-run
```

### Test API Endpoints Locally

```bash
# Start Worker dev server
npm run worker:dev

# In another terminal, test endpoints:
curl http://localhost:8787/api/auth/me

# With session
curl -H "Authorization: Bearer YOUR_SESSION_ID" http://localhost:8787/api/leaderboard/today
```

## 🎯 Common Tasks

### Add New User Manually

```bash
# First, get their WakaTime access token
# Then insert into database:
npx wrangler d1 execute wakalead --command "INSERT INTO users (wakatime_id, username, display_name, access_token, is_admin, created_at, updated_at) VALUES ('their_wakatime_id', 'username', 'Display Name', 'their_token', 0, $(date +%s), $(date +%s))"
```

### Trigger Manual Data Fetch

Via Admin Panel in UI, or via API:
```bash
curl -X POST -H "Authorization: Bearer ADMIN_SESSION_ID" http://localhost:8787/api/admin/fetch-now
```

### Update Admin User

```bash
npx wrangler d1 execute wakalead --command "UPDATE users SET is_admin = 1 WHERE wakatime_id = 'your_wakatime_id'"
```

### Clear All Sessions

```bash
# This requires KV bulk delete or manual deletion
# Best done via Cloudflare Dashboard → KV → Your namespace
```

### Export All Data

```bash
# Users
npx wrangler d1 execute wakalead --command "SELECT * FROM users" --json > export_users.json

# Daily stats
npx wrangler d1 execute wakalead --command "SELECT * FROM daily_stats" --json > export_stats.json

# Fetch logs
npx wrangler d1 execute wakalead --command "SELECT * FROM fetch_log" --json > export_logs.json
```

## 📱 URLs

### Local Development
- **Frontend**: http://localhost:5173
- **Worker API**: http://localhost:8787

### Production (after deployment)
- **Frontend**: https://wakalead.pages.dev (or your custom domain)
- **Worker API**: https://wakalead-api.YOUR_SUBDOMAIN.workers.dev

### Cloudflare Dashboard
- **Workers**: https://dash.cloudflare.com/?to=/:account/workers
- **Pages**: https://dash.cloudflare.com/?to=/:account/pages
- **D1**: https://dash.cloudflare.com/?to=/:account/d1
- **KV**: https://dash.cloudflare.com/?to=/:account/workers/kv/namespaces

### WakaTime
- **Apps**: https://wakatime.com/apps
- **API Docs**: https://wakatime.com/developers

## 🎨 Customization

### Change Admin User

Edit `wrangler.toml`:
```toml
ADMIN_WAKATIME_ID = "your_wakatime_id"
```

Then redeploy:
```bash
npm run worker:deploy
```

### Change Cron Schedule

Edit `wrangler.toml`:
```toml
crons = ["0 2 * * *"]  # 2 AM UTC daily
```

Examples:
- Every 6 hours: `"0 */6 * * *"`
- Twice daily: `["0 2 * * *", "0 14 * * *"]`
- Every Monday at 9 AM: `"0 9 * * 1"`

### Change Theme Colors

Edit `tailwind.config.js` or modify component styles in `src/components/`.

## 🆘 Emergency Commands

### Rollback Worker Deployment

```bash
npx wrangler rollback
```

### Disable Cron Temporarily

Edit `wrangler.toml` and comment out crons:
```toml
# [triggers]
# crons = ["0 2 * * *"]
```

Then redeploy:
```bash
npm run worker:deploy
```

### Force Refresh All Tokens

Create a script or manually update:
```bash
npx wrangler d1 execute wakalead --command "UPDATE users SET token_expires_at = 0"
```

Next cron run will refresh all tokens.

## 💡 Tips

- Always test locally before deploying to production
- Keep secrets secure, never commit to git
- Monitor Worker metrics after deployment
- Set up alerts for error rates
- Backup database regularly
- Document any custom changes

---

For more details, see:
- [README.md](README.md) - Full documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Technical overview
