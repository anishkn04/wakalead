-- Daily leaderboard rankings - stores each user's rank per metric per day
-- Used for consistency (total days at #1) and streak (consecutive days at #1) features
CREATE TABLE IF NOT EXISTS daily_leaderboard (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,  -- Format: YYYY-MM-DD (Nepal timezone)
    metric TEXT NOT NULL DEFAULT 'total',  -- 'total' | 'human' | 'ai' | 'lines'
    rank INTEGER NOT NULL,
    PRIMARY KEY (user_id, date, metric),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_leaderboard_date_metric ON daily_leaderboard(date, metric);
CREATE INDEX IF NOT EXISTS idx_daily_leaderboard_user_metric ON daily_leaderboard(user_id, metric);