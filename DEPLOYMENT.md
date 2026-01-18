# Deployment Guide for WakaLead

## Quick Start Checklist

- [ ] Node.js 18+ installed
- [ ] Cloudflare account created
- [ ] WakaTime OAuth app created
- [ ] Wrangler CLI logged in

## Step-by-Step Deployment

### 1. Clone and Install

```bash
cd /home/anishkn/src/tries/2026-01-18-wakalead
npm install
```

### 2. Set Up WakaTime OAuth

1. Visit https://wakatime.com/apps
2. Click "Create Application"
3. Fill in:
   - **Name**: WakaLead
   - **Description**: WakaTime Leaderboard
   - **Redirect URI**: `https://your-project.pages.dev` (you'll update this after first deploy)
   - **Scopes**: `email`, `read_stats`, `read_logged_time`
4. Save **Client ID** and **Client Secret**

### 3. Set Up Cloudflare

```bash
# Login to Cloudflare
npx wrangler login

# Create D1 database
npx wrangler d1 create wakalead
```

Output will show:
```
database_id = "xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy this ID and update [wrangler.toml](wrangler.toml) line 10:
```toml
database_id = "YOUR_ACTUAL_DATABASE_ID"
```

### 4. Initialize Database

```bash
npm run db:migrate
```

This creates all necessary tables.

### 5. Create KV Namespace

```bash
npx wrangler kv:namespace create "SESSIONS"
```

Output will show:
```
id = "xxxxx..."
```

Update [wrangler.toml](wrangler.toml) line 15:
```toml
id = "YOUR_ACTUAL_KV_ID"
```

### 6. Set Worker Secrets

```bash
# Set WakaTime OAuth credentials
npx wrangler secret put WAKATIME_CLIENT_ID
# Paste your Client ID and press Enter

npx wrangler secret put WAKATIME_CLIENT_SECRET
# Paste your Client Secret and press Enter

npx wrangler secret put WAKATIME_REDIRECT_URI
# Enter: https://waka-lead.pages.dev (or your custom domain)

npx wrangler secret put SESSION_SECRET
# Generate a random string: openssl rand -base64 32
```

### 7. Deploy Worker

```bash
npm run worker:deploy
```

Note the Worker URL from output:
```
Published wakalead-api
  https://wakalead-api.YOUR_SUBDOMAIN.workers.dev
```

### 8. Update API Proxy

Edit [functions/_worker.js](functions/_worker.js) line 12:
```javascript
workerUrl.hostname = 'wakalead-api.YOUR_SUBDOMAIN.workers.dev';
```

Replace with your actual Worker hostname.

### 9. Deploy Frontend to Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy dist --project-name=wakalead
```

Or use Cloudflare Dashboard:
1. Go to Cloudflare Dashboard → Pages
2. Create new project
3. Connect to Git repository (or use direct upload)
4. Build settings:
   - **Build command**: `npm run build`
   - **Build output**: `dist`
5. Deploy

### 10. Update OAuth Redirect URI

After deployment, you'll get a URL like: `https://wakalead.pages.dev`

1. Go back to WakaTime Apps settings
2. Update **Redirect URI** to your Pages URL
3. Save changes

### 11. Update Worker Secret

```bash
npx wrangler secret put WAKATIME_REDIRECT_URI
# Enter your actual Pages URL
```

### 12. Redeploy Worker

```bash
npm run worker:deploy
```

### 13. Test the Application

1. Visit your Pages URL
2. Click "Sign in with WakaTime"
3. Authorize the application
4. You should be redirected to the dashboard

## Post-Deployment

### Set Up Custom Domain (Optional)

In Cloudflare Pages:
1. Go to your project → Custom domains
2. Add your domain
3. Update DNS records as instructed
4. Update `WAKATIME_REDIRECT_URI` secret to your custom domain

### Monitor Cron Jobs

```bash
# View Worker logs
npx wrangler tail

# Check scheduled runs in Cloudflare Dashboard
# Workers → wakalead-api → Triggers → Cron Triggers
```

### Verify Database

```bash
# Query users
npx wrangler d1 execute wakalead --command "SELECT * FROM users"

# Query daily stats
npx wrangler d1 execute wakalead --command "SELECT * FROM daily_stats ORDER BY date DESC LIMIT 10"

# Check fetch logs
npx wrangler d1 execute wakalead --command "SELECT * FROM fetch_log ORDER BY fetched_at DESC LIMIT 10"
```

## Local Development

Create `.env`:
```env
VITE_API_BASE=http://localhost:8787/api
```

Start dev servers:
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Worker
npm run worker:dev
```

Use `.dev.vars` for local Worker secrets:
```
WAKATIME_CLIENT_ID=your_client_id
WAKATIME_CLIENT_SECRET=your_client_secret
WAKATIME_REDIRECT_URI=http://localhost:5173
SESSION_SECRET=your_secret
ADMIN_WAKATIME_ID=anishkn04
```

## Troubleshooting

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Database Not Accessible

```bash
# Verify database exists
npx wrangler d1 list

# Re-run migration
npm run db:migrate
```

### OAuth Not Working

1. Verify redirect URI matches exactly (no trailing slash)
2. Check secrets are set correctly:
   ```bash
   npx wrangler secret list
   ```
3. Check Worker logs for errors

### No Data Showing

1. Manually trigger fetch in Admin Panel
2. Check Worker logs during fetch
3. Verify WakaTime API key has correct permissions

## Security Notes

### Production Checklist

- [ ] Token encryption implemented (add encryption library)
- [ ] CORS restricted to your domain only
- [ ] Rate limiting on admin endpoints
- [ ] Regular backups of D1 database
- [ ] Monitor Worker logs for suspicious activity

### Recommended: Token Encryption

For production, encrypt tokens before storing in D1:

```typescript
// Add to worker/database.ts
import { encrypt, decrypt } from 'some-encryption-library';

// When storing:
access_token: encrypt(userData.access_token, env.ENCRYPTION_KEY)

// When retrieving:
access_token: decrypt(user.access_token, env.ENCRYPTION_KEY)
```

## Maintenance

### Update Dependencies

```bash
npm update
npm audit fix
```

### Backup Database

```bash
# Export data
npx wrangler d1 execute wakalead --command "SELECT * FROM users" --json > users_backup.json
npx wrangler d1 execute wakalead --command "SELECT * FROM daily_stats" --json > stats_backup.json
```

### Monitor Costs

- D1: Free tier includes 5 GB storage, 5M reads/day
- Workers: Free tier includes 100k requests/day
- KV: Free tier includes 100k reads/day
- Pages: Free tier includes unlimited requests

## Support

For issues:
1. Check Worker logs: `npx wrangler tail`
2. Check browser console for frontend errors
3. Review README.md for common issues
4. Create GitHub issue with logs

## Next Steps

After successful deployment:
1. Invite team members to authenticate
2. Wait for first cron run (or trigger manually)
3. Customize theme/branding as needed
4. Set up monitoring/alerts (optional)

Enjoy your WakaTime Leaderboard! 🚀
