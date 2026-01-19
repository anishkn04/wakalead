import { Env, User } from './types';

/**
 * Database utilities for managing users and stats
 */

export async function createOrUpdateUser(
  env: Env,
  userData: {
    wakatime_id: string;
    username: string;
    display_name?: string;
    email?: string;
    access_token: string;
    refresh_token?: string;
    token_expires_at?: number;
    photo_url?: string;
  }
): Promise<User> {
  const now = Date.now();
  const isAdmin = userData.username === env.ADMIN_WAKATIME_ID;

  // Check if user exists
  const existing = await env.DB.prepare(
    'SELECT * FROM users WHERE wakatime_id = ?'
  ).bind(userData.wakatime_id).first<User>();

  if (existing) {
    // Update existing user
    await env.DB.prepare(`
      UPDATE users 
      SET username = ?, display_name = ?, email = ?, access_token = ?,
          refresh_token = ?, token_expires_at = ?, photo_url = ?,
          is_admin = ?, updated_at = ?
      WHERE wakatime_id = ?
    `).bind(
      userData.username,
      userData.display_name || null,
      userData.email || null,
      userData.access_token,
      userData.refresh_token || null,
      userData.token_expires_at || null,
      userData.photo_url || null,
      isAdmin ? 1 : 0,
      now,
      userData.wakatime_id
    ).run();

    return {
      ...existing,
      ...userData,
      is_admin: isAdmin,
      updated_at: now,
    };
  } else {
    // Insert new user
    const result = await env.DB.prepare(`
      INSERT INTO users (
        wakatime_id, username, display_name, email, access_token,
        refresh_token, token_expires_at, photo_url, is_admin,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userData.wakatime_id,
      userData.username,
      userData.display_name || null,
      userData.email || null,
      userData.access_token,
      userData.refresh_token || null,
      userData.token_expires_at || null,
      userData.photo_url || null,
      isAdmin ? 1 : 0,
      now,
      now
    ).run();

    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(result.meta.last_row_id).first<User>();

    return user!;
  }
}

/**
 * Store daily stats for a user
 */
export async function storeDailyStats(
  env: Env,
  userId: number,
  date: string,
  totalSeconds: number
): Promise<void> {
  const now = Date.now();

  // Upsert daily stats
  await env.DB.prepare(`
    INSERT INTO daily_stats (user_id, date, total_seconds, fetched_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date) 
    DO UPDATE SET total_seconds = ?, fetched_at = ?
  `).bind(userId, date, totalSeconds, now, totalSeconds, now).run();
}

/**
 * Get leaderboard for a date range
 */
export async function getLeaderboard(
  env: Env,
  startDate: string,
  endDate: string
) {
  const results = await env.DB.prepare(`
    SELECT 
      u.id as user_id,
      u.username,
      u.display_name,
      u.photo_url,
      u.is_admin,
      COALESCE(SUM(ds.total_seconds), 0) as total_seconds
    FROM users u
    LEFT JOIN daily_stats ds ON u.id = ds.user_id AND ds.date >= ? AND ds.date <= ?
    WHERE u.is_banned = 0
    GROUP BY u.id, u.username, u.display_name, u.photo_url, u.is_admin
    ORDER BY total_seconds DESC
  `).bind(startDate, endDate).all();

  return results.results.map((row: any, index: number) => ({
    ...row,
    is_admin: row.is_admin === 1,
    rank: index + 1,
  }));
}

/**
 * Get weekly data for chart (last 7 days)
 */
export async function getWeeklyData(env: Env, dates: string[]) {
  const placeholders = dates.map(() => '?').join(',');
  
  const results = await env.DB.prepare(`
    SELECT 
      u.id as user_id,
      u.username,
      u.display_name,
      ds.date,
      ds.total_seconds as seconds
    FROM users u
    LEFT JOIN daily_stats ds ON u.id = ds.user_id AND ds.date IN (${placeholders})
    ORDER BY u.id, ds.date
  `).bind(...dates).all();

  // Group by user
  const userMap = new Map();
  results.results.forEach((row: any) => {
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, {
        user_id: row.user_id,
        username: row.username,
        display_name: row.display_name,
        daily_data: [],
      });
    }
    
    if (row.date) {
      userMap.get(row.user_id).daily_data.push({
        date: row.date,
        seconds: row.seconds || 0,
      });
    }
  });

  return Array.from(userMap.values());
}

/**
 * Log data fetch attempt
 */
export async function logFetch(
  env: Env,
  userId: number,
  fetchType: string,
  fetchDate: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO fetch_log (user_id, fetch_type, fetch_date, status, error_message, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(userId, fetchType, fetchDate, status, errorMessage || null, Date.now()).run();
}

/**
 * Check if data was already fetched today for a user
 */
export async function wasFetchedToday(
  env: Env,
  userId: number,
  date: string
): Promise<boolean> {
  const result = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM fetch_log
    WHERE user_id = ? AND fetch_date = ? AND status = 'success'
  `).bind(userId, date).first<{ count: number }>();

  return (result?.count || 0) > 0;
}

/**
 * Get all users
 */
export async function getAllUsers(env: Env): Promise<User[]> {
  const results = await env.DB.prepare('SELECT * FROM users').all();
  return results.results as User[];
}

/**
 * Delete user (admin only)
 */
export async function deleteUser(env: Env, userId: number): Promise<void> {
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}

/**
 * Ban user (admin only)
 */
export async function banUser(env: Env, userId: number): Promise<void> {
  await env.DB.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').bind(userId).run();
}

/**
 * Unban user (admin only)
 */
export async function unbanUser(env: Env, userId: number): Promise<void> {
  await env.DB.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').bind(userId).run();
}

/**
 * Get user by ID
 */
export async function getUserById(env: Env, userId: number): Promise<User | null> {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
  return user || null;
}

