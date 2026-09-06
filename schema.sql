-- WakaLead Database Schema
-- Cloudflare D1 SQLite database

-- Users table - stores authenticated users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wakatime_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    email TEXT,
    access_token TEXT NOT NULL, -- Encrypted in production
    refresh_token TEXT,
    token_expires_at INTEGER,
    photo_url TEXT,
    is_admin BOOLEAN DEFAULT 0,
    is_banned BOOLEAN DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_wakatime_id ON users(wakatime_id);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);

-- Daily stats table - stores daily coding time per user
CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    total_seconds INTEGER NOT NULL DEFAULT 0,
    ai_seconds INTEGER NOT NULL DEFAULT 0,   -- time spent in the "ai coding" category
    human_seconds INTEGER NOT NULL DEFAULT 0, -- total_seconds - ai_seconds
    ai_lines INTEGER NOT NULL DEFAULT 0,      -- ai_additions + ai_deletions
    human_lines INTEGER NOT NULL DEFAULT 0,   -- human_additions + human_deletions
    fetched_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON daily_stats(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- Data fetch log - tracks API fetches to prevent rate limiting
CREATE TABLE IF NOT EXISTS fetch_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    fetch_type TEXT NOT NULL, -- 'daily', 'weekly', etc.
    fetch_date TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'error', 'rate_limited'
    error_message TEXT,
    fetched_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fetch_log_user_date ON fetch_log(user_id, fetch_date);

-- User stats table - aggregated metadata for personalized comments
-- Top language/editor/project parsed from summaries, lifetime time from
-- the all_time_since_today endpoint
CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY,
    top_language TEXT,
    top_editor TEXT,
    top_project TEXT,
    all_time_seconds INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_stats_updated ON user_stats(updated_at);

-- Per-user tooltip breakdowns - captured from WakaTime summaries during syncs.
-- Everything is keyed by (user_id, date) so re-syncing a day is idempotent.

-- Time-based breakdowns (languages, editors, operating systems, projects, machines)
CREATE TABLE IF NOT EXISTS user_stat_breakdown (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    kind TEXT NOT NULL, -- 'language' | 'editor' | 'os' | 'project' | 'machine'
    name TEXT NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date, kind, name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_breakdown_user_kind ON user_stat_breakdown(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_breakdown_user_date ON user_stat_breakdown(user_id, date);

-- AI model usage per day (line changes + estimated cost), from
-- summaries grand_total.ai_model_breakdown
CREATE TABLE IF NOT EXISTS user_ai_models (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    name TEXT NOT NULL,
    lines INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date, name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_models_user ON user_ai_models(user_id);

-- Daily AI token / session totals (0 when WakaTime omits the fields)
CREATE TABLE IF NOT EXISTS user_ai_daily (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    sessions INTEGER NOT NULL DEFAULT 0,
    prompt_events INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Per-period leaderboard snapshots - each user's rank + value per metric per
-- day (period='day') and trailing 7-day window (period='week'). Powers
-- rank-1 consistency ("Nd/Nw at #1") and streak (fire/trophy) features.
CREATE TABLE IF NOT EXISTS leaderboard_history (
    user_id INTEGER NOT NULL,
    period_start TEXT NOT NULL, -- Format: YYYY-MM-DD, anchor date for the period
    period TEXT NOT NULL,       -- 'day' | 'week'
    metric TEXT NOT NULL,       -- 'total' | 'human' | 'ai' | 'lines'
    rank INTEGER NOT NULL,
    value INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, period_start, period, metric),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_history_period_metric_rank
    ON leaderboard_history(period, metric, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_history_period_metric_start
    ON leaderboard_history(period, metric, period_start);

-- User avatar image bytes, downloaded from WakaTime/Gravatar so the browser
-- never hits WakaTime for photos. Served via GET /api/user/:id/photo.
CREATE TABLE IF NOT EXISTS user_photos (
    user_id INTEGER PRIMARY KEY,
    data BLOB NOT NULL,
    mime TEXT NOT NULL DEFAULT 'image/jpeg',
    fetched_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- History of admin-triggered "season resets" (archive current stats, start
-- fresh). season_number is the season being archived at reset time; the
-- live tables always represent season (MAX(season_number) + 1), or season 1
-- if this table is empty. See resetSeason() in worker/database.ts.
CREATE TABLE IF NOT EXISTS season_resets (
    season_number INTEGER PRIMARY KEY,
    archived_at INTEGER NOT NULL,
    reset_by INTEGER,
    FOREIGN KEY (reset_by) REFERENCES users(id) ON DELETE SET NULL
);
