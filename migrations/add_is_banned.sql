-- Migration: Add is_banned column to users table
-- This allows admins to restrict users from logging in

ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT 0;

CREATE INDEX idx_users_is_banned ON users(is_banned);
