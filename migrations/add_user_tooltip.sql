-- Migration: Add user tooltip breakdown tables
-- Captures per-day WakaTime breakdowns (languages, editors, operating systems,
-- projects, machines) plus AI model usage and token/session totals from the
-- summaries endpoint during normal syncs - zero extra API calls.
-- All tables are keyed by (user_id, date) so re-syncing a day is idempotent.

-- Time-based breakdowns
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

-- AI model usage per day
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

-- Daily AI token / session totals
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
