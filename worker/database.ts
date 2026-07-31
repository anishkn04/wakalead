import { Env, User, DailySummaryStats } from './types';

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
  stats: DailySummaryStats
): Promise<void> {
  const now = Date.now();

  // Upsert daily stats
  await env.DB.prepare(`
    INSERT INTO daily_stats (user_id, date, total_seconds, ai_seconds, human_seconds, ai_lines, human_lines, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) 
    DO UPDATE SET total_seconds = ?, ai_seconds = ?, human_seconds = ?, ai_lines = ?, human_lines = ?, fetched_at = ?
  `).bind(
    userId,
    date,
    stats.total_seconds,
    stats.ai_seconds,
    stats.human_seconds,
    stats.ai_lines,
    stats.human_lines,
    now,
    stats.total_seconds,
    stats.ai_seconds,
    stats.human_seconds,
    stats.ai_lines,
    stats.human_lines,
    now
  ).run();
}

/**
 * Store or update a user's aggregated stats (top language/editor/project,
 * all-time seconds). Used for personalized leaderboard comments.
 */
export async function upsertUserStats(
  env: Env,
  userId: number,
  stats: {
    topLanguage?: string | null;
    topEditor?: string | null;
    topProject?: string | null;
    allTimeSeconds?: number;
  }
): Promise<void> {
  const now = Date.now();

  // Keep existing values when a field isn't provided (e.g. all-time fetch
  // runs separately from language parsing)
  const existing = await env.DB.prepare(
    'SELECT * FROM user_stats WHERE user_id = ?'
  ).bind(userId).first<any>();

  const topLanguage = stats.topLanguage !== undefined ? stats.topLanguage : (existing?.top_language ?? null);
  const topEditor = stats.topEditor !== undefined ? stats.topEditor : (existing?.top_editor ?? null);
  const topProject = stats.topProject !== undefined ? stats.topProject : (existing?.top_project ?? null);
  const allTimeSeconds = stats.allTimeSeconds !== undefined ? stats.allTimeSeconds : (existing?.all_time_seconds ?? 0);

  await env.DB.prepare(`
    INSERT INTO user_stats (user_id, top_language, top_editor, top_project, all_time_seconds, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id)
    DO UPDATE SET top_language = ?, top_editor = ?, top_project = ?, all_time_seconds = ?, updated_at = ?
  `).bind(
    userId,
    topLanguage,
    topEditor,
    topProject,
    allTimeSeconds,
    now,
    topLanguage,
    topEditor,
    topProject,
    allTimeSeconds,
    now
  ).run();
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
      COALESCE(SUM(ds.total_seconds), 0) as total_seconds,
      COALESCE(SUM(ds.ai_seconds), 0) as ai_seconds,
      COALESCE(SUM(ds.human_seconds), 0) as human_seconds,
      COALESCE(SUM(ds.ai_lines), 0) as ai_lines,
      COALESCE(SUM(ds.human_lines), 0) as human_lines,
      us.all_time_seconds,
      us.top_language,
      us.top_editor,
      us.top_project
    FROM users u
    LEFT JOIN daily_stats ds ON u.id = ds.user_id AND ds.date >= ? AND ds.date <= ?
    LEFT JOIN user_stats us ON u.id = us.user_id
    WHERE u.is_banned = 0
    GROUP BY u.id, u.username, u.display_name, u.photo_url, u.is_admin,
             us.all_time_seconds, us.top_language, us.top_editor, us.top_project
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
      ds.total_seconds as seconds,
      ds.ai_seconds,
      ds.human_seconds,
      ds.ai_lines,
      ds.human_lines
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
        ai_seconds: row.ai_seconds || 0,
        human_seconds: row.human_seconds || 0,
        ai_lines: row.ai_lines || 0,
        human_lines: row.human_lines || 0,
      });
    }
  });

  return Array.from(userMap.values());
}

/**
 * Get the timestamp of the last successful data fetch
 * Used to show "last synced" so users don't all hit Sync at once
 */
export async function getLastSyncTime(env: Env): Promise<number | null> {
  const result = await env.DB.prepare(`
    SELECT MAX(fetched_at) as last_synced
    FROM fetch_log
    WHERE status = 'success'
  `).first<{ last_synced: number | null }>();

  return result?.last_synced || null;
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
  const result = await env.DB.prepare(
    `SELECT COUNT(*) as count
    FROM fetch_log
    WHERE user_id = ? AND fetch_date = ? AND status = 'success'`
  ).bind(userId, date).first<{ count: number }>();

  return (result?.count || 0) > 0;
}

/**
 * Check if a successful fetch of a given type happened since a timestamp.
 * Used to gate infrequent calls (e.g. all-time stats) to respect rate limits.
 */
export async function recentFetch(
  env: Env,
  userId: number,
  fetchType: string,
  sinceTs: number
): Promise<boolean> {
  const result = await env.DB.prepare(
    `SELECT COUNT(*) as count
    FROM fetch_log
    WHERE user_id = ? AND fetch_type = ? AND status = 'success' AND fetched_at >= ?`
  ).bind(userId, fetchType, sinceTs).first<{ count: number }>();

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

