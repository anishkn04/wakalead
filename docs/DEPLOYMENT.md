# DEPLOY

WakaLead runs on Cloudflare. Two parts:

1. Worker (API) -> Cloudflare Workers (`npm run worker:deploy`)
2. Frontend -> Cloudflare Pages (`npm run deploy`)

## First time

1. Need: Node 18+, Cloudflare account, WakaTime account.

2. Login:

```bash
npx wrangler login
```

3. Make OAuth app at https://wakatime.com/apps
   - redirect URI: `https://<your-project>.pages.dev`
   - scopes: `email`, `read_stats`, `read_logged_time`
   - copy Client ID + Client Secret

4. Make D1 DB:

```bash
npx wrangler d1 create wakalead
```

Copy `database_id` into `wrangler.toml`.

5. Make KV for sessions:

```bash
npx wrangler kv:namespace create "SESSIONS"
```

Copy the `id` into `wrangler.toml`.

6. Install:

```bash
npm install
```

7. Set worker secrets:

```bash
npx wrangler secret put WAKATIME_CLIENT_ID
npx wrangler secret put WAKATIME_CLIENT_SECRET
npx wrangler secret put WAKATIME_REDIRECT_URI
npx wrangler secret put SESSION_SECRET
```

8. Set admin in `wrangler.toml`:

```toml
ADMIN_WAKATIME_ID = "your_wakatime_username"
```

9. Migrate remote DB:

```bash
npm run db:migrate:remote
```

10. Deploy worker:

```bash
npm run worker:deploy
```

Note the URL: `https://wakalead-api.<sub>.workers.dev`

11. Deploy frontend:

```bash
npm run deploy
```

12. Tell Pages where the worker is.
    Cloudflare dashboard -> Pages project -> Settings -> Environment variables, add:

```
WORKER_HOSTNAME = wakalead-api.<sub>.workers.dev
```

This drives the proxy in `functions/api/[[path]].ts`. Without it, `/api` calls break.

13. Point OAuth at the real URL: update the WakaTime app redirect URI to your Pages URL, then:

```bash
npx wrangler secret put WAKATIME_REDIRECT_URI
npm run worker:deploy
```

## Update after code change

```bash
npm run deploy:both
```

(pages + worker in one go)

## Local

```bash
npm install
npm run db:migrate:local
npm run worker:dev   # terminal 1
npm run dev          # terminal 2
```

`.env`:

```
VITE_API_BASE=http://localhost:8787/api
```

`.dev.vars` (worker secrets, never commit):

```
WAKATIME_CLIENT_ID=...
WAKATIME_CLIENT_SECRET=...
WAKATIME_REDIRECT_URI=http://localhost:5173
SESSION_SECRET=...
ADMIN_WAKATIME_ID=...
```

## Check DB

```bash
npx wrangler d1 execute wakalead --remote --command "SELECT * FROM users"
```

## Logs

```bash
npx wrangler tail
```

## Trouble

- API 404 / proxy dead -> `WORKER_HOSTNAME` env missing on Pages.
- "Not authenticated" -> redirect URI mismatch. Must match exactly, no trailing slash.
- No data -> admin force sync, check `fetch_log` table, `wrangler tail`.
