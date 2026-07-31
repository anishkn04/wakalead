import { Env, User, DailySummaryStats, DayBreakdown, TooltipStats, StatBreakdown } from './types';

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

/**
 * Store a day's breakdowns (top languages/editors/os/projects/machines plus
 * AI models and token/session totals) into the tooltip tables.
 * Re-syncing a day replaces that day's snapshot (delete + insert in one
 * atomic batch) so stale entries never linger.
 */
export async function upsertDayBreakdowns(
  env: Env,
  userId: number,
  date: string,
  breakdown: Pick<DayBreakdown, 'timeRows' | 'modelRows' | 'aiDaily'>
): Promise<void> {
  const statements: ReturnType<Env['DB']['prepare']>[] = [];

  statements.push(
    env.DB.prepare('DELETE FROM user_stat_breakdown WHERE user_id = ? AND date = ?').bind(userId, date),
    env.DB.prepare('DELETE FROM user_ai_models WHERE user_id = ? AND date = ?').bind(userId, date)
  );

  for (const row of breakdown.timeRows) {
    statements.push(
      env.DB.prepare(`
        INSERT INTO user_stat_breakdown (user_id, date, kind, name, seconds)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, date, kind, name) DO UPDATE SET seconds = excluded.seconds
      `).bind(userId, date, row.kind, row.name, row.seconds)
    );
  }

  for (const row of breakdown.modelRows) {
    statements.push(
      env.DB.prepare(`
        INSERT INTO user_ai_models (user_id, date, name, lines, cost)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, date, name) DO UPDATE SET lines = excluded.lines, cost = excluded.cost
      `).bind(userId, date, row.name, row.lines, row.cost)
    );
  }

  statements.push(
    env.DB.prepare(`
      INSERT INTO user_ai_daily (user_id, date, input_tokens, output_tokens, sessions, prompt_events)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        sessions = excluded.sessions,
        prompt_events = excluded.prompt_events
    `).bind(
      userId,
      date,
      breakdown.aiDaily.input_tokens,
      breakdown.aiDaily.output_tokens,
      breakdown.aiDaily.sessions,
      breakdown.aiDaily.prompt_events
    )
  );

  await env.DB.batch(statements);
}

/** Shift a YYYY-MM-DD date by a signed number of days (UTC-safe). */
function shiftDate(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function withPercent(items: { name: string; seconds: number }[]): StatBreakdown[] {
  const total = items.reduce((sum, item) => sum + item.seconds, 0);
  return items.map((item) => ({
    name: item.name,
    seconds: item.seconds,
    percent: total > 0 ? Math.round((item.seconds / total) * 1000) / 10 : 0,
  }));
}

/**
 * Full per-user stats for the hover card, aggregated live from D1.
 * `today` is the app's notion of "today" (Nepal timezone), used for
 * today-vs-yesterday deltas, streaks and the 7-day sparkline series.
 */
export async function getUserTooltipStats(
  env: Env,
  userId: number,
  today: string
): Promise<TooltipStats | null> {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<any>();
  if (!user) return null;

  const userStats = await env.DB.prepare(
    'SELECT * FROM user_stats WHERE user_id = ?'
  ).bind(userId).first<any>();

  const dailyRes = await env.DB.prepare(`
    SELECT date, total_seconds, ai_seconds, human_seconds, ai_lines, human_lines
    FROM daily_stats WHERE user_id = ? ORDER BY date
  `).bind(userId).all<any>();
  const dailyRows: any[] = dailyRes.results || [];

  const breakdownRes = await env.DB.prepare(`
    SELECT kind, name, SUM(seconds) as seconds
    FROM user_stat_breakdown WHERE user_id = ?
    GROUP BY kind, name ORDER BY seconds DESC
  `).bind(userId).all<any>();

  const byKind: Record<string, { name: string; seconds: number }[]> = {};
  for (const row of breakdownRes.results || []) {
    (byKind[row.kind] = byKind[row.kind] || []).push({
      name: row.name,
      seconds: row.seconds,
    });
  }

  const modelsRes = await env.DB.prepare(`
    SELECT name, SUM(lines) as lines, SUM(cost) as cost
    FROM user_ai_models WHERE user_id = ?
    GROUP BY name ORDER BY lines DESC
  `).bind(userId).all<any>();
  const aiModels: { name: string; lines: number; cost: number }[] =
    (modelsRes.results || []).map((row: any) => ({
      name: row.name,
      lines: row.lines || 0,
      cost: row.cost || 0,
    }));

  const aiDaily = await env.DB.prepare(`
    SELECT SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens,
           SUM(sessions) as sessions, SUM(prompt_events) as prompt_events
    FROM user_ai_daily WHERE user_id = ?
  `).bind(userId).first<any>();

  // Aggregates over all tracked days
  let totalSeconds = 0, aiSeconds = 0, humanSeconds = 0, aiLines = 0, humanLines = 0;
  let daysActive = 0;
  let bestDay: { date: string; seconds: number } | null = null;
  for (const row of dailyRows) {
    totalSeconds += row.total_seconds || 0;
    aiSeconds += row.ai_seconds || 0;
    humanSeconds += row.human_seconds || 0;
    aiLines += row.ai_lines || 0;
    humanLines += row.human_lines || 0;
    if ((row.total_seconds || 0) > 0) daysActive += 1;
    if (!bestDay || (row.total_seconds || 0) > bestDay.seconds) {
      bestDay = { date: row.date, seconds: row.total_seconds || 0 };
    }
  }

  // Streaks (a day counts when total_seconds > 0)
  const activeDays = new Set(
    dailyRows.filter((row) => (row.total_seconds || 0) > 0).map((row) => row.date)
  );
  let currentStreak = 0;
  let cursor = activeDays.has(today) ? today : shiftDate(today, -1);
  while (activeDays.has(cursor)) {
    currentStreak += 1;
    cursor = shiftDate(cursor, -1);
  }
  let longestStreak = 0, run = 0, prevDate: string | null = null;
  for (const row of dailyRows) {
    if ((row.total_seconds || 0) > 0) {
      run = prevDate && row.date === shiftDate(prevDate, 1) ? run + 1 : 1;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0; // an idle day breaks the streak
    }
    prevDate = row.date;
  }

  const todayRow = dailyRows.find((row) => row.date === today);
  const yesterday = shiftDate(today, -1);
  const yesterdayRow = dailyRows.find((row) => row.date === yesterday);
  const todaySeconds = todayRow?.total_seconds || 0;
  const yesterdaySeconds = yesterdayRow?.total_seconds || 0;
  const deltaPercent =
    yesterdaySeconds > 0
      ? Math.round(((todaySeconds - yesterdaySeconds) / yesterdaySeconds) * 100)
      : null;

  const week: { date: string; seconds: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = shiftDate(today, -i);
    const row = dailyRows.find((r) => r.date === date);
    week.push({ date, seconds: row?.total_seconds || 0 });
  }

  return {
    user_id: user.id,
    username: user.username,
    display_name: user.display_name,
    photo_url: user.photo_url,
    is_admin: user.is_admin === 1,
    created_at: user.created_at,
    all_time_seconds: userStats?.all_time_seconds || 0,
    top_language: userStats?.top_language ?? null,
    top_editor: userStats?.top_editor ?? null,
    top_project: userStats?.top_project ?? null,
    aggregates: {
      total_seconds: totalSeconds,
      ai_seconds: aiSeconds,
      human_seconds: humanSeconds,
      ai_lines: aiLines,
      human_lines: humanLines,
      days_tracked: dailyRows.length,
      days_active: daysActive,
      best_day: bestDay,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      today_seconds: todaySeconds,
      yesterday_seconds: yesterdaySeconds,
      delta_percent: deltaPercent,
      week,
    },
    languages: withPercent(byKind.language || []),
    editors: withPercent(byKind.editor || []),
    operating_systems: withPercent(byKind.os || []),
    projects: withPercent(byKind.project || []),
    machines: withPercent(byKind.machine || []),
    ai_models: aiModels,
    ai_tokens: {
      input: aiDaily?.input_tokens || 0,
      output: aiDaily?.output_tokens || 0,
      sessions: aiDaily?.sessions || 0,
      prompt_events: aiDaily?.prompt_events || 0,
    },
  };
}

