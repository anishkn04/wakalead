# WakaTime API - what we use, what we don't, what we could build

Full endpoint inventory pulled from wakatime.com/developers, evaluated against
what WakaLead actually calls today (`worker/wakatime.ts`).

## Currently used

| Endpoint | Used for |
|---|---|
| `POST /oauth/token` | Login + token refresh |
| `GET /users/current` | Profile (username, display_name, email, photo) |
| `GET /users/current/summaries` | **The main source.** Daily total/AI/human time, line counts, top languages/editors/OS/projects/machines, AI model usage, AI token/session counts. Synced to D1 every day. |
| `GET /users/current/stats/all_time` | Full lifetime breakdown. Live-only on Profile page, never stored. |
| `GET /users/current/all_time_since_today` | Lifetime total seconds. Cached in `user_stats`. |

Everything the leaderboard, streaks, and hover-card stats run on comes from
`summaries` alone.

## Full API surface (unused endpoints)

**Stats & Insights**
- `GET /users/:user/stats/:range` - range stats (`best_day`, `daily_average`, `holidays`, human-readable strings, full breakdown arrays) - same shape as `all_time` but for `last_7_days`/`last_30_days`/etc.
- `GET /users/:user/stats/aggregated` - stats across multiple dimensions at once
- `GET /users/:user/insights/:insight_type/:range` - `stats`, `weekdays`, `days`, `best_day`, `daily_average`, `projects`, `languages`, `editors`, `categories`, `machines`, `operating_systems`, `ai_days`

**Durations & Heartbeats** (granular, below the daily-summary level)
- `GET /users/:user/durations` - joined heartbeat durations per day: `project`, `time`, `duration`, `ai_additions/deletions`, `human_additions/deletions`, `ai_model_costs`, token/prompt counts
- `GET /users/:user/heartbeats` - raw pings: `entity`, `type`, `category`, `project`, `branch`, `language`, `is_write`, `lineno`/`cursorpos`, `ai_line_changes`, `ai_session`

**Goals**
- `GET /users/:user/goals`, `GET /users/:user/goals/:goal` - `delta` (day/week), `seconds` target, `status` (success/fail/ignored/pending), `cumulative_status`, `chart_data` per period, `is_inverse` (code-less goals), `ignore_days`, scoped by `editors`/`languages`/`projects`

**Projects & Commits**
- `GET /users/:user/projects` - project list
- `GET /users/:user/projects/:project/commits` / `.../commits/:hash` - commit messages + time spent per commit

**Machines & Editors**
- `GET /users/:user/machine_names` - devices + last-seen
- `GET /editors` - IDE plugin metadata + color codes (WakaTime's own per-editor brand colors)

**Public & Private Leaderboards**
- `GET /leaders` - the *global* public WakaTime leaderboard. Filterable by `language`, `country_code`, `is_hireable`, `board_type` (`time`/`manual`/`ai`/`spend`). Returns rank, `running_total`, per-language totals.
- `GET /users/:user/private_leaderboards[/:board/leaders]` - a user's own private WakaTime leaderboards (if they belong to any)

**Status bar**
- `GET /users/:user/status_bar` - the same lightweight "today" aggregate the WakaTime editor plugin status bar shows

**Bulk export**
- `GET/POST /users/:user/data_dumps` - full-history export (daily or heartbeat granularity)

**Org / team** (needs a WakaTime team plan)
- `orgs`, `orgs/:org/dashboards[/:dashboard/...]` - team-wide summaries/durations per member

**Custom rules, external durations, meta** - data-transform and calendar-integration endpoints, not relevant to a leaderboard app.

## What we could build with it

**"Year/Month in Code" summary page** - the highest-value idea. Combine
several insight types into one shareable recap per user, similar in spirit
to a music-service wrap-up:
- `insights/best_day/last_year` -> "Your best day: Aug 14, 11h 42m"
- `insights/weekdays/...` -> "You code most on Wednesdays" (or the roast
  version: "You've never touched code on a Sunday")
- `insights/ai_days/...` -> a heatmap of AI-vs-human line share over time -
  fits the existing human/AI split bar perfectly, just extended across days
  instead of one aggregate
- `stats/last_year` -> total time, `holidays` (zero-activity days), top
  language/project for the whole period
- `machine_names` -> "coded from 3 devices"

This reuses data WakaLead already has synced (`daily_stats`,
`user_stat_breakdown`) for most of it - `weekdays`/`best_day`/`ai_days` can
actually be computed from existing D1 tables without new API calls at all,
since we already store per-day totals and AI/human split.

**Goals -> streak/roast integration** - let a user set a WakaTime goal, pull
`status`/`cumulative_status` from `GET /goals`, and feed goal failures into
the existing roast system (`src/roasts.ts`) - "missed your own goal 3 days
running" is a stronger roast than a generic low-time one.

**Real "online now" indicator** - the leaderboard already shows a static
green dot for top-3 with nonzero time (`LeaderboardCard.tsx`). `status_bar`
or recent `heartbeats` would make that a real live-presence indicator
("coding right now") instead of a same-day-activity proxy. Heavier: heartbeats
are the highest-volume endpoint and would need real rate-limit handling
(see below).

**Session-level stats instead of daily-only** - `durations` gives actual
joined coding sessions (start time + length), not just a daily sum. Could
power a real "longest focus session today" stat or a session-count metric,
which `summaries` can't provide.

**Global leaderboard flex/humble-brag** - `GET /leaders` is the public,
site-wide WakaTime leaderboard. Showing a user's real global rank next to
their WakaLead rank ("#2 here, #48,213 worldwide") is an easy, on-theme
addition given the roast/leaderboard tone of the app.

**Commit-level detail on Profile** - `projects/:project/commits` gives real
commit messages + time-per-commit. Could replace the generic "top project"
line with an actual "last commit: 'fix: week streak fixed' - 42m" - more
concrete than a project name.

**Faster new-user backfill** - `data_dumps` (bulk export) could replace the
current one-day-at-a-time `summaries` backfill loop for a newly-joined
user's history, at the cost of it being an async job (WakaTime generates the
dump in the background, you poll for completion) rather than a simple
request/response.

## Caveats before building any of this

- **Plan gating**: some of the richer endpoints (full insights, durations,
  heartbeats, data dumps) may require the user's own WakaTime plan to
  support them - not all of this is available on every free account. Treat
  failures here as "unavailable", not a bug, same as `profile.ts` already
  does for expired tokens.
- **Rate limits**: `fetcher.ts` already gates calls through `fetch_log` to
  avoid hammering WakaTime. Any new endpoint (especially `heartbeats`,
  which is high-volume) needs the same discipline - don't add a new call
  per page load.
- **Redundant fetching**: several of the "unused" insights (`weekdays`,
  `best_day`, `ai_days`, `daily_average`) can be derived entirely from data
  already stored in D1 (`daily_stats`, `user_stat_breakdown`) - no new API
  call needed, just new queries against existing tables. Prefer that over
  a live fetch wherever possible.
