-- Migration: Add AI vs Human coding stats to daily_stats
-- AI time comes from the "ai coding" category in WakaTime summaries
-- AI lines = ai_additions + ai_deletions from grand_total

ALTER TABLE daily_stats ADD COLUMN ai_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN human_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN ai_lines INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN human_lines INTEGER NOT NULL DEFAULT 0;
