# WakaLead

Leaderboard for WakaTime. See who code most. Roast lazy people.

Full setup steps: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## What it does

- Leaderboard: today + this week
- Rank by: total time, human time, AI time, AI lines
- Hover card: per-user stats (streak, languages, AI models) - cached in browser, instant
- Weekly heatmap: 7 day coding grid, all users
- Login with WakaTime OAuth
- Admin can delete users + force sync
- Cron sync every day 2 AM UTC

## Tech

- Frontend: React + TypeScript + Tailwind (Vite)
- Backend: Cloudflare Worker (`worker/`)
- DB: Cloudflare D1
- Sessions: Cloudflare KV
- Host: Cloudflare Pages

## Run local

```bash
npm install
npm run dev          # frontend on :5173
npm run worker:dev   # backend on :8787
```

Make `.env`:

```
VITE_API_BASE=http://localhost:8787/api
```

Make `.dev.vars` (worker secrets for local, NEVER commit):

```
WAKATIME_CLIENT_ID=...
WAKATIME_CLIENT_SECRET=...
WAKATIME_REDIRECT_URI=http://localhost:8787/api/auth/callback
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=...
ADMIN_WAKATIME_ID=anishkn04
```

`WAKATIME_REDIRECT_URI` must point at the **worker's** callback route (not the frontend) - it's the URL WakaTime redirects the browser to directly, and only the worker knows how to exchange the code. Register this exact URL on your WakaTime OAuth app at wakatime.com/apps. `FRONTEND_URL` is where the worker sends the browser back to *after* login finishes.

## Deploy

```bash
npm run deploy:both   # build + pages + worker
```

Or one at a time:

```bash
npm run deploy         # pages only (also builds)
npm run worker:deploy  # worker only
```

`wrangler.toml` is NOT in git. It holds live DB/KV ids + secrets. Keep it private.

## Secrets

```bash
npx wrangler secret put WAKATIME_CLIENT_ID
npx wrangler secret put WAKATIME_CLIENT_SECRET
npx wrangler secret put WAKATIME_REDIRECT_URI
npx wrangler secret put SESSION_SECRET
```

## Admin

Set `ADMIN_WAKATIME_ID` to your WakaTime username in `wrangler.toml`. Admin can delete users and force sync.

## API

Public:

- `GET /api/dashboard` - everything at once
- `GET /api/user/:id/stats` - hover card data

OAuth:

- `GET /api/auth/login`
- `GET /api/auth/callback`

Routes live in `worker/index.ts`.

## Data

Everything comes from WakaTime's API (`worker/wakatime.ts`):

- `GET /users/current/summaries` - the main source. Per day: `grand_total.total_seconds` (total time), the `"ai coding"` category's seconds (AI time; human = total - AI), `ai_additions`/`ai_deletions`/`human_additions`/`human_deletions` (line counts), top languages/editors/OS/projects/machines, `ai_model_breakdown` (per-model lines + cost), AI token/session counts. All synced into D1.
- `GET /users/current` - id, username, display_name, email, avatar. Synced at login; refetched live on the Profile page.
- `GET /users/current/stats/all_time` - full lifetime breakdown. Live-only on Profile, never stored.
- `GET /users/current/all_time_since_today` - lifetime total seconds. Cached in `user_stats`.

## DB

`schema.sql` is a full snapshot - creates every table from scratch, matches what a synced DB actually looks like. `migrations/` holds the incremental changes that got it there (some already folded into `schema.sql` and safe to skip; `add_user_stats.sql`, `add_user_tooltip.sql`, `add_user_photos.sql` are still applied on top since new tables use `CREATE TABLE IF NOT EXISTS` and no-op harmlessly if already present).

Apply all:

```bash
npm run db:migrate:remote
npm run db:migrate:local
```

When you change the schema: write a migration (safe against a DB that already has data), then fold the same change into `schema.sql` so a fresh setup matches in one shot. A plain `ALTER TABLE ... ADD COLUMN` migration can't be re-run once folded in (no `IF NOT EXISTS` guard) - drop it from the `db:migrate:*` scripts in `package.json` once it's baked into `schema.sql`.
