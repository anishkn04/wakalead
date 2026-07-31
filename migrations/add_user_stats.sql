-- Migration: Add user_stats table
-- Stores aggregated per-user metadata parsed from WakaTime summaries
-- (top language / editor / project for the last fetched period) and
-- lifetime coding time from the all_time_since_today endpoint.
-- No extra API calls needed for language/editor/project: the summaries
-- endpoint already returns per-day breakdowns that the fetcher consumes.

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
