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
WAKATIME_REDIRECT_URI=http://localhost:5173
SESSION_SECRET=...
ADMIN_WAKATIME_ID=anishkn04
```

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

## DB

Schema in `schema.sql`. Migrations in `migrations/`. Apply all:

```bash
npm run db:migrate:remote
npm run db:migrate:local
```
