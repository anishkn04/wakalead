-- Backfill daily_leaderboard from existing daily_stats history.
-- For every date that has any daily stats, rank all non-banned users per metric.
-- Uses OR REPLACE so re-running this file is idempotent.

INSERT OR REPLACE INTO daily_leaderboard (user_id, date, metric, rank)
SELECT u.id AS user_id, d.date AS date, m.metric,
  ROW_NUMBER() OVER (PARTITION BY d.date, m.metric ORDER BY COALESCE(ds.total_seconds, 0) DESC) AS rank
FROM (SELECT DISTINCT date FROM daily_stats) d
CROSS JOIN users u
CROSS JOIN (SELECT 'total' AS metric) m
LEFT JOIN daily_stats ds ON ds.user_id = u.id AND ds.date = d.date
WHERE u.is_banned = 0;

INSERT OR REPLACE INTO daily_leaderboard (user_id, date, metric, rank)
SELECT u.id AS user_id, d.date AS date, m.metric,
  ROW_NUMBER() OVER (PARTITION BY d.date, m.metric ORDER BY COALESCE(ds.human_seconds, 0) DESC) AS rank
FROM (SELECT DISTINCT date FROM daily_stats) d
CROSS JOIN users u
CROSS JOIN (SELECT 'human' AS metric) m
LEFT JOIN daily_stats ds ON ds.user_id = u.id AND ds.date = d.date
WHERE u.is_banned = 0;

INSERT OR REPLACE INTO daily_leaderboard (user_id, date, metric, rank)
SELECT u.id AS user_id, d.date AS date, m.metric,
  ROW_NUMBER() OVER (PARTITION BY d.date, m.metric ORDER BY COALESCE(ds.ai_seconds, 0) DESC) AS rank
FROM (SELECT DISTINCT date FROM daily_stats) d
CROSS JOIN users u
CROSS JOIN (SELECT 'ai' AS metric) m
LEFT JOIN daily_stats ds ON ds.user_id = u.id AND ds.date = d.date
WHERE u.is_banned = 0;

INSERT OR REPLACE INTO daily_leaderboard (user_id, date, metric, rank)
SELECT u.id AS user_id, d.date AS date, m.metric,
  ROW_NUMBER() OVER (PARTITION BY d.date, m.metric ORDER BY COALESCE(ds.ai_lines, 0) DESC) AS rank
FROM (SELECT DISTINCT date FROM daily_stats) d
CROSS JOIN users u
CROSS JOIN (SELECT 'lines' AS metric) m
LEFT JOIN daily_stats ds ON ds.user_id = u.id AND ds.date = d.date
WHERE u.is_banned = 0;
