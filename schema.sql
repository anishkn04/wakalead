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

CREATE INDEX idx_users_wakatime_id ON users(wakatime_id);
CREATE INDEX idx_users_is_admin ON users(is_admin);
CREATE INDEX idx_users_is_banned ON users(is_banned);

-- Daily stats table - stores daily coding time per user
CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    total_seconds INTEGER NOT NULL DEFAULT 0,
    fetched_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_stats_user_date ON daily_stats(user_id, date);
CREATE INDEX idx_daily_stats_date ON daily_stats(date);

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

CREATE INDEX idx_fetch_log_user_date ON fetch_log(user_id, fetch_date);
