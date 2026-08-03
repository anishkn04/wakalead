-- Migration: Add user_photos table
-- Stores avatar image bytes downloaded from WakaTime/Gravatar so the
-- browser never hits WakaTime for photos. Everything except the profile
-- page serves avatars from this table via GET /api/user/:id/photo.

CREATE TABLE IF NOT EXISTS user_photos (
    user_id INTEGER PRIMARY KEY,
    data BLOB NOT NULL,
    mime TEXT NOT NULL DEFAULT 'image/jpeg',
    fetched_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
