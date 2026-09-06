import { Env, User, DailySummaryStats, DayBreakdown, TooltipStats, StatBreakdown, CompareAggregates, CompareStats } from './types';

/**
 * Database utilities for managing users and stats
 */

export type LeaderboardMetric = 'total' | 'human' | 'ai' | 'lines';

/** Map a leaderboard metric to its daily_stats column */
const METRIC_COLUMNS: Record<LeaderboardMetric, string> = {
  total: 'total_seconds',
  human: 'human_seconds',
  ai: 'ai_seconds',
  lines: 'ai_lines',
};

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
 * Store or update a user's avatar image bytes (downloaded from WakaTime /
 * Gravatar). Kept in a separate table so `SELECT * FROM users` stays light.
 */
export async function upsertUserPhoto(
  env: Env,
  userId: number,
  data: ArrayBuffer,
  mime: string
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO user_photos (user_id, data, mime, fetched_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id)
    DO UPDATE SET data = excluded.data, mime = excluded.mime, fetched_at = excluded.fetched_at
  `).bind(userId, new Uint8Array(data), mime, Date.now()).run();
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
 * Get leaderboard for a date range. When `today` is provided, each entry is
 * annotated with rank-one consistency/streak stats (batch-loaded, no N+1).
 */
export async function getLeaderboard(
  env: Env,
  startDate: string,
  endDate: string,
  metric: LeaderboardMetric = 'total',
  today?: string
) {
  const orderColumn = METRIC_COLUMNS[metric];

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
    ORDER BY ${orderColumn} DESC
  `).bind(startDate, endDate).all();

  const entries = results.results.map((row: any, index: number) => ({
    ...row,
    is_admin: row.is_admin === 1,
    rank: index + 1,
  }));

  // Rank-one stats are per-user, so they apply to both day and week boards.
  if (today) {
    const stats = await getRankOneStats(env, metric, today);
    for (const entry of entries) {
      const s = stats.get(entry.user_id);
      entry.days_at_rank_one = s?.days_at_rank_one ?? 0;
      entry.weeks_at_rank_one = s?.weeks_at_rank_one ?? 0;
      entry.day_streak = s?.day_streak ?? 0;
      entry.week_streak = s?.week_streak ?? 0;
    }
  }

  return entries;
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
      u.photo_url,
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
        photo_url: row.photo_url,
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

/** Sum a set of daily_stats rows into a CompareAggregates bucket. */
function sumAggregates(rows: any[]): CompareAggregates {
  const out: CompareAggregates = {
    total_seconds: 0,
    human_seconds: 0,
    ai_seconds: 0,
    human_lines: 0,
    ai_lines: 0,
    total_lines: 0,
  };
  for (const row of rows) {
    out.total_seconds += row.total_seconds || 0;
    out.human_seconds += row.human_seconds || 0;
    out.ai_seconds += row.ai_seconds || 0;
    out.human_lines += row.human_lines || 0;
    out.ai_lines += row.ai_lines || 0;
  }
  out.total_lines = out.human_lines + out.ai_lines;
  return out;
}

/**
 * DB-only stats for the compare page: daily (today), weekly (last 7 days) and
 * all-time buckets, plus streaks, best day, AI tokens and favorite items.
 */
export async function getCompareStats(
  env: Env,
  userId: number,
  today: string
): Promise<CompareStats | null> {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<any>();
  if (!user) return null;

  const tooltip = await getUserTooltipStats(env, userId, today);

  const dailyRes = await env.DB.prepare(`
    SELECT date, total_seconds, ai_seconds, human_seconds, ai_lines, human_lines
    FROM daily_stats WHERE user_id = ? ORDER BY date
  `).bind(userId).all<any>();
  const rows: any[] = dailyRes.results || [];

  const todayRows = rows.filter((r) => r.date === today);
  const weekStart = shiftDate(today, -6);
  const weekRows = rows.filter((r) => r.date >= weekStart && r.date <= today);

  const daysTracked = rows.length;
  const daysActive = tooltip?.aggregates.days_active ?? 0;
  const topModel = tooltip?.ai_models[0] ?? null;

  return {
    user_id: user.id,
    username: user.username,
    display_name: user.display_name,
    photo_url: user.photo_url,
    daily: sumAggregates(todayRows),
    weekly: sumAggregates(weekRows),
    all_time: sumAggregates(rows),
    all_time_wakatime: tooltip?.all_time_seconds || 0,
    days_tracked: daysTracked,
    days_active: daysActive,
    active_pct: daysTracked > 0 ? (daysActive / daysTracked) * 100 : 0,
    current_streak: tooltip?.aggregates.current_streak || 0,
    longest_streak: tooltip?.aggregates.longest_streak || 0,
    best_day: tooltip?.aggregates.best_day ?? null,
    ai_tokens: tooltip?.ai_tokens || { input: 0, output: 0, sessions: 0, prompt_events: 0 },
    top_ai_model: topModel?.name ?? null,
    ai_model_lines: topModel?.lines || 0,
    ai_model_cost: topModel?.cost || 0,
    top_language: tooltip?.top_language ?? null,
    top_editor: tooltip?.top_editor ?? null,
    top_project: tooltip?.top_project ?? null,
  };
}

/**
 * Rank all non-banned users for a period and store the result into
 * `leaderboard_history`. One window-function-free ranked query per metric
 * (ranking done in JS over a deterministic ORDER BY), batched upserts.
 *
 * `period` 'day'  -> the anchor date itself.
 * `period` 'week' -> trailing 7-day window [anchor-6, anchor].
 */
async function computeAndStorePeriod(
  env: Env,
  period: 'day' | 'week',
  anchorDate: string
): Promise<void> {
  const metrics: LeaderboardMetric[] = ['total', 'human', 'ai', 'lines'];

  for (const metric of metrics) {
    const column = METRIC_COLUMNS[metric];

    const sql =
      period === 'day'
        ? `
          SELECT
            u.id as user_id,
            COALESCE(SUM(ds.${column}), 0) as metric_value
          FROM users u
          LEFT JOIN daily_stats ds ON u.id = ds.user_id AND ds.date = ?
          WHERE u.is_banned = 0
          GROUP BY u.id
          ORDER BY metric_value DESC, u.id
        `
        : `
          SELECT
            u.id as user_id,
            COALESCE(SUM(ds.${column}), 0) as metric_value
          FROM users u
          LEFT JOIN daily_stats ds ON u.id = ds.user_id
            AND ds.date >= date(?, '-6 day') AND ds.date <= ?
          WHERE u.is_banned = 0
          GROUP BY u.id
          ORDER BY metric_value DESC, u.id
        `;

    const stmt =
      period === 'day'
        ? env.DB.prepare(sql).bind(anchorDate)
        : env.DB.prepare(sql).bind(anchorDate, anchorDate);

    const results = await stmt.all<{ user_id: number; metric_value: number }>();

    const statements: ReturnType<Env['DB']['prepare']>[] = results.results.map(
      (row, index) =>
        env.DB.prepare(`
          INSERT INTO leaderboard_history (user_id, period_start, period, metric, rank, value)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, period_start, period, metric) DO UPDATE SET
            rank = excluded.rank, value = excluded.value
        `).bind(row.user_id, anchorDate, period, metric, index + 1, row.metric_value)
    );

    if (statements.length > 0) {
      await env.DB.batch(statements);
    }
  }
}

/**
 * Compute and store daily leaderboard rankings for all metrics for a given
 * date. Call this after daily stats are synced for a date.
 */
export async function computeAndStoreDailyLeaderboard(
  env: Env,
  date: string
): Promise<void> {
  await computeAndStorePeriod(env, 'day', date);
}

/**
 * Compute and store the weekly (trailing 7-day window ending at `date`)
 * leaderboard rankings for all metrics. Call after daily stats are synced
 * for `date` so each day also records its rolling week.
 */
export async function computeAndStoreWeeklyLeaderboard(
  env: Env,
  date: string
): Promise<void> {
  await computeAndStorePeriod(env, 'week', date);
}

/** Per-user rank-one history: consistency totals + current streaks. */
export interface RankOneStats {
  days_at_rank_one: number;
  weeks_at_rank_one: number;
  day_streak: number;
  week_streak: number;
}

/** Count consecutive `dates` ending at `today` (or today-1 if today is missing). */
function consecutiveCount(dates: string[], today: string): number {
  const set = new Set(dates);
  let cursor = set.has(today) ? today : shiftDate(today, -1);
  let count = 0;
  while (set.has(cursor)) {
    count += 1;
    cursor = shiftDate(cursor, -1);
  }
  return count;
}

/** Monday (ISO week start) date key for a YYYY-MM-DD string. */
function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // 0 = Monday
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

/**
 * Count consecutive ISO weeks in `won` (Set of Monday date keys) ending at
 * `today`. Mirrors `consecutiveCount`'s same-week grace period: if the
 * current week has no representative snapshot yet (`hasRep`), fall back to
 * last week so an active streak doesn't flicker to 0 before this week's
 * first sync lands.
 */
function consecutiveWeeks(won: Set<string>, hasRep: Set<string>, today: string): number {
  const thisWeek = mondayOf(today);
  let cursor = hasRep.has(thisWeek) ? thisWeek : shiftDate(thisWeek, -7);
  let count = 0;
  while (won.has(cursor)) {
    count += 1;
    cursor = shiftDate(cursor, -7);
  }
  return count;
}

/**
 * Batch (no N+1) rank-one stats for every user for a metric:
 *  - consistency: total periods where the user was rank 1 with value > 0
 *  - streaks: consecutive periods at rank 1 (value > 0) anchored at `today`
 *
 * A period only counts when the user actually had activity (value > 0), so
 * all-zero days/weeks never hand out a bogus "#1".
 *
 * Weeks are tracked as daily rolling 7-day snapshots (one row per anchor day),
 * so consistency/streaks collapse each calendar week to its final-day snapshot
 * - whose 7-day window exactly equals that calendar week - and count a week
 * only when that snapshot is rank 1. This makes "weeks at #1" real calendar
 * weeks instead of counting every day the rolling board happened to be #1.
 */
export async function getRankOneStats(
  env: Env,
  metric: LeaderboardMetric,
  today: string
): Promise<Map<number, RankOneStats>> {
  const stats = new Map<number, RankOneStats>();
  const ensure = (userId: number): RankOneStats => {
    let s = stats.get(userId);
    if (!s) {
      s = { days_at_rank_one: 0, weeks_at_rank_one: 0, day_streak: 0, week_streak: 0 };
      stats.set(userId, s);
    }
    return s;
  };

  // Consistency totals (full history). Weeks are counted per calendar week:
  // each calendar week holds up to 7 rolling "week" snapshots (one per day),
  // so we collapse them to the week's final-day snapshot - whose 7-day window
  // exactly equals that calendar week - and only count rank 1 there.
  const [dayCounts, weekCounts] = await Promise.all([
    env.DB.prepare(`
      SELECT user_id, COUNT(*) as count
      FROM leaderboard_history
      WHERE period = 'day' AND metric = ? AND rank = 1 AND value > 0
      GROUP BY user_id
    `).bind(metric).all<{ user_id: number; count: number }>(),
    env.DB.prepare(`
      SELECT user_id, COUNT(*) as count
      FROM (
        SELECT user_id, period_start, rank, value,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, strftime('%Y-%W', period_start)
            ORDER BY period_start DESC
          ) AS rn
        FROM leaderboard_history
        WHERE period = 'week' AND metric = ?
      )
      WHERE rn = 1 AND rank = 1 AND value > 0
        -- Only trust this week's representative if it's the still-in-progress
        -- current week (any snapshot is a fine live proxy) or it actually
        -- closed out on that week's Sunday (the only day whose trailing
        -- 7-day window exactly equals a Mon-Sun calendar week). A week whose
        -- Sunday sync was missed (cron gap) is left uncounted instead of
        -- silently using a mismatched window.
        AND (
          strftime('%w', period_start) = '0'
          OR strftime('%Y-%W', period_start) = strftime('%Y-%W', ?)
        )
      GROUP BY user_id
    `).bind(metric, today).all<{ user_id: number; count: number }>(),
  ]);

  for (const row of dayCounts.results) ensure(row.user_id).days_at_rank_one = row.count;
  for (const row of weekCounts.results) ensure(row.user_id).weeks_at_rank_one = row.count;

  // Streak computation - only need the recent window (a 120-day guard bounds
  // the fetch; streaks beyond that are absurd anyway).
  const since = shiftDate(today, -120);
  const [dayHistory, weekHistory] = await Promise.all([
    env.DB.prepare(`
      SELECT user_id, period_start, rank, value
      FROM leaderboard_history
      WHERE period = 'day' AND metric = ? AND period_start >= ?
      ORDER BY user_id, period_start
    `).bind(metric, since).all<{ user_id: number; period_start: string; rank: number; value: number }>(),
    env.DB.prepare(`
      SELECT user_id, period_start, rank, value
      FROM leaderboard_history
      WHERE period = 'week' AND metric = ? AND period_start >= ?
      ORDER BY user_id, period_start
    `).bind(metric, since).all<{ user_id: number; period_start: string; rank: number; value: number }>(),
  ]);

  const rankOneDays = new Map<number, string[]>();
  for (const row of dayHistory.results) {
    if (row.rank === 1 && (row.value || 0) > 0) {
      const list = rankOneDays.get(row.user_id) || [];
      list.push(row.period_start);
      rankOneDays.set(row.user_id, list);
    }
  }
  for (const [userId, dates] of rankOneDays) {
    ensure(userId).day_streak = consecutiveCount(dates, today);
  }

  const weekReps = new Map<number, Map<string, { period_start: string; rank: number; value: number }>>();
  for (const row of weekHistory.results) {
    const wk = mondayOf(row.period_start);
    const reps = weekReps.get(row.user_id) ?? new Map<string, { period_start: string; rank: number; value: number }>();
    const cur = reps.get(wk);
    if (!cur || row.period_start > cur.period_start) {
      reps.set(wk, { period_start: row.period_start, rank: row.rank, value: row.value });
    }
    weekReps.set(row.user_id, reps);
  }

  const currentWeek = mondayOf(today);
  for (const [userId, reps] of weekReps) {
    const won = new Set<string>();
    const hasRep = new Set<string>();
    for (const [wk, rep] of reps) {
      // Same reliability rule as the consistency query above: trust the
      // current (in-progress) week's snapshot as a live proxy, but a past
      // week only counts if it actually closed out on its Sunday - anything
      // else means that week's cron run was missed, so treat it as unknown
      // rather than using a mismatched window.
      const isCurrent = wk === currentWeek;
      const isClosedProperly = rep.period_start === shiftDate(wk, 6);
      if (!isCurrent && !isClosedProperly) continue;
      hasRep.add(wk);
      if (rep.rank === 1 && rep.value > 0) won.add(wk);
    }
    ensure(userId).week_streak = consecutiveWeeks(won, hasRep, today);
  }

  return stats;
}

/**
 * Season resets - "archive current stats and start fresh" for an admin.
 *
 * Archives every table that drives the leaderboard/streaks/"since tracking"
 * totals by renaming it to `<table>_season_<N>` and creating a fresh empty
 * one in its place, then records the reset. `users`, `user_photos`, and
 * `user_stats` (the real WakaTime lifetime total, explicitly labeled as such
 * in the UI) are deliberately left untouched - accounts, avatars, and true
 * lifetime history all survive a reset unchanged.
 *
 * `fetch_log` is included so the very next sync actually re-fetches "today"
 * instead of thinking it's already up to date (it also un-gates the once-a-
 * week all_time/photo refreshes, which is harmless - they just re-fetch the
 * same values a little early).
 */
interface ResettableTable {
  name: string;
  createSql: string;
  indexes: { name: string; sql: string }[];
}

const SEASON_RESET_TABLES: ResettableTable[] = [
  {
    name: 'daily_stats',
    createSql: `
      CREATE TABLE daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        total_seconds INTEGER NOT NULL DEFAULT 0,
        ai_seconds INTEGER NOT NULL DEFAULT 0,
        human_seconds INTEGER NOT NULL DEFAULT 0,
        ai_lines INTEGER NOT NULL DEFAULT 0,
        human_lines INTEGER NOT NULL DEFAULT 0,
        fetched_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, date)
      )`,
    indexes: [
      { name: 'idx_daily_stats_user_date', sql: 'CREATE INDEX idx_daily_stats_user_date ON daily_stats(user_id, date)' },
      { name: 'idx_daily_stats_date', sql: 'CREATE INDEX idx_daily_stats_date ON daily_stats(date)' },
    ],
  },
  {
    name: 'fetch_log',
    createSql: `
      CREATE TABLE fetch_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        fetch_type TEXT NOT NULL,
        fetch_date TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        fetched_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    indexes: [
      { name: 'idx_fetch_log_user_date', sql: 'CREATE INDEX idx_fetch_log_user_date ON fetch_log(user_id, fetch_date)' },
    ],
  },
  {
    name: 'user_stat_breakdown',
    createSql: `
      CREATE TABLE user_stat_breakdown (
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        seconds INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, date, kind, name),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    indexes: [
      { name: 'idx_breakdown_user_kind', sql: 'CREATE INDEX idx_breakdown_user_kind ON user_stat_breakdown(user_id, kind)' },
      { name: 'idx_breakdown_user_date', sql: 'CREATE INDEX idx_breakdown_user_date ON user_stat_breakdown(user_id, date)' },
    ],
  },
  {
    name: 'user_ai_models',
    createSql: `
      CREATE TABLE user_ai_models (
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        name TEXT NOT NULL,
        lines INTEGER NOT NULL DEFAULT 0,
        cost REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, date, name),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    indexes: [
      { name: 'idx_ai_models_user', sql: 'CREATE INDEX idx_ai_models_user ON user_ai_models(user_id)' },
    ],
  },
  {
    name: 'user_ai_daily',
    createSql: `
      CREATE TABLE user_ai_daily (
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        sessions INTEGER NOT NULL DEFAULT 0,
        prompt_events INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    indexes: [],
  },
  {
    name: 'leaderboard_history',
    createSql: `
      CREATE TABLE leaderboard_history (
        user_id INTEGER NOT NULL,
        period_start TEXT NOT NULL,
        period TEXT NOT NULL,
        metric TEXT NOT NULL,
        rank INTEGER NOT NULL,
        value INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, period_start, period, metric),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    indexes: [
      { name: 'idx_leaderboard_history_period_metric_rank', sql: 'CREATE INDEX idx_leaderboard_history_period_metric_rank ON leaderboard_history(period, metric, rank)' },
      { name: 'idx_leaderboard_history_period_metric_start', sql: 'CREATE INDEX idx_leaderboard_history_period_metric_start ON leaderboard_history(period, metric, period_start)' },
    ],
  },
];

export interface SeasonReset {
  season_number: number;
  archived_at: number;
  reset_by: number | null;
}

/** The season currently being played: 1 + however many resets have happened. */
export async function getCurrentSeason(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COALESCE(MAX(season_number), 0) + 1 as season FROM season_resets'
  ).first<{ season: number }>();
  return row?.season ?? 1;
}

export async function getSeasonHistory(env: Env): Promise<SeasonReset[]> {
  const rows = await env.DB.prepare(
    'SELECT season_number, archived_at, reset_by FROM season_resets ORDER BY season_number DESC'
  ).all<SeasonReset>();
  return rows.results;
}

/**
 * The date (YYYY-MM-DD, Nepal timezone) the current season started - i.e.
 * when the most recent reset happened. Null if a reset has never happened,
 * meaning there's no lower bound and season 1 goes all the way back.
 *
 * Fetchers use this to make a reset actually stick: without it, a normal
 * multi-day sync (refresh-all, cron, backfill) would happily re-pull real
 * WakaTime history from before the reset and repopulate daily_stats for
 * those dates, silently undoing it.
 */
export async function getCurrentSeasonStartDate(env: Env): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT archived_at FROM season_resets ORDER BY season_number DESC LIMIT 1'
  ).first<{ archived_at: number }>();
  if (!row) return null;
  const nepalOffset = 5.75 * 60 * 60 * 1000;
  return new Date(row.archived_at + nepalOffset).toISOString().slice(0, 10);
}

/**
 * Archive the current season's stats tables and start fresh. Runs each
 * table's drop-indexes -> rename -> recreate-table -> recreate-indexes
 * sequence fully before moving to the next table, so a mid-way failure
 * leaves at most one table in a partial state rather than all of them.
 */
export async function resetSeason(env: Env, adminUserId: number): Promise<{ archivedSeason: number }> {
  const archivedSeason = await getCurrentSeason(env);

  for (const table of SEASON_RESET_TABLES) {
    for (const idx of table.indexes) {
      await env.DB.prepare(`DROP INDEX IF EXISTS ${idx.name}`).run();
    }
    await env.DB.prepare(`ALTER TABLE ${table.name} RENAME TO ${table.name}_season_${archivedSeason}`).run();
    await env.DB.prepare(table.createSql).run();
    for (const idx of table.indexes) {
      await env.DB.prepare(idx.sql).run();
    }
  }

  await env.DB.prepare(
    'INSERT INTO season_resets (season_number, archived_at, reset_by) VALUES (?, ?, ?)'
  ).bind(archivedSeason, Date.now(), adminUserId).run();

  return { archivedSeason };
}

export interface UserSeasonStat {
  season_number: number;
  ended_at: number | null;
  total_seconds: number;
  ai_seconds: number;
  human_seconds: number;
  ai_lines: number;
  human_lines: number;
  days_active: number;
  best_day: { date: string; seconds: number } | null;
}

/**
 * One user's aggregated stats for each past (archived) season - what a
 * "view past seasons" button on the profile page shows. Seasons the user
 * had no activity in (e.g. they joined later) are omitted. Table names are
 * built from `season_number`, which only ever comes from our own
 * resetSeason()/getCurrentSeason() - never user input.
 */
export async function getUserSeasonHistory(env: Env, userId: number): Promise<UserSeasonStat[]> {
  const currentSeason = await getCurrentSeason(env);
  const resets = await getSeasonHistory(env);
  const endedAtBySeason = new Map(resets.map((r) => [r.season_number, r.archived_at]));

  const pastSeasons: number[] = [];
  for (let n = currentSeason - 1; n >= 1; n--) pastSeasons.push(n);

  const results = await Promise.allSettled(
    pastSeasons.map(async (n): Promise<UserSeasonStat | null> => {
      const totals = await env.DB.prepare(`
        SELECT
          COALESCE(SUM(total_seconds), 0) as total_seconds,
          COALESCE(SUM(ai_seconds), 0) as ai_seconds,
          COALESCE(SUM(human_seconds), 0) as human_seconds,
          COALESCE(SUM(ai_lines), 0) as ai_lines,
          COALESCE(SUM(human_lines), 0) as human_lines,
          COUNT(*) as days_active
        FROM daily_stats_season_${n}
        WHERE user_id = ?
      `).bind(userId).first<any>();

      if (!totals || totals.days_active === 0) return null; // no activity this user had that season

      const bestDayRow = await env.DB.prepare(`
        SELECT date, total_seconds FROM daily_stats_season_${n}
        WHERE user_id = ? ORDER BY total_seconds DESC LIMIT 1
      `).bind(userId).first<{ date: string; total_seconds: number }>();

      return {
        season_number: n,
        ended_at: endedAtBySeason.get(n) ?? null,
        total_seconds: totals.total_seconds,
        ai_seconds: totals.ai_seconds,
        human_seconds: totals.human_seconds,
        ai_lines: totals.ai_lines,
        human_lines: totals.human_lines,
        days_active: totals.days_active,
        best_day: bestDayRow ? { date: bestDayRow.date, seconds: bestDayRow.total_seconds } : null,
      };
    })
  );

  const stats: UserSeasonStat[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) stats.push(r.value);
    else if (r.status === 'rejected') console.error('Error reading season archive:', r.reason);
  }
  return stats;
}

/**
 * FUT-style player cards: 6 attributes (PAC/SHO/PAS/DRI/DEF/PHY), each
 * scored by PERCENTILE RANK against every other user, never an absolute
 * bar - so card quality reflects standing within the group, not whether
 * anyone hit some fixed number of hours. See docs/FUT_CARD_DESIGN.md for
 * the full design rationale, gaming-vector analysis, and decision log.
 *
 * PAC/SHO deliberately use human_seconds/human_lines (not totals) so
 * someone can't inflate their card by leaving an AI agent running for a
 * long "session" without doing the work themselves - ai_lines still count
 * toward SHO, just discounted. PAS/DRI/DEF/PHY are diversity counts or
 * ratios by nature, already immune to that kind of padding.
 */
export type CardScope = 'season' | 'career';
export type CardType = 'icon' | 'legend_hero' | 'white_icon' | 'featured_red' | 'base_gold' | 'base_silver';
export type CardPosition = 'ST' | 'RW' | 'LW' | 'CAM' | 'CM' | 'CDM' | 'LM' | 'RM' | 'CB' | 'RB' | 'LB' | 'GK';

interface RawUserCardMetrics {
  human_seconds: number;
  output_score: number; // human_lines + 0.7 * ai_lines
  days_active: number;  // days with >= CARD_ACTIVE_SECONDS of total_seconds
  days_tracked: number; // days with any synced row at all
  longest_streak: number;
  distinct_projects: number;
  distinct_languages: number;
  distinct_editors: number;
  distinct_os: number;
}

export interface UserCardAttributes {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  overall: number;
  position: CardPosition;
  cardType: CardType;
  provisional: boolean;
  days_active: number;
}

const CARD_RATING_FLOOR = 55; // worst-in-cohort attribute still reads as solidly average
const CARD_MIN_DAYS_ACTIVE = 7; // below this, personally provisional - not enough data for a meaningful percentile
const CARD_MIN_COHORT = 4; // below this many users with any data, percentile ranking is close to meaningless for everyone
const CARD_ACTIVE_SECONDS = 40 * 60; // a day only counts toward DEF/PHY at 40+ active minutes, not just nonzero
const FEATURED_STREAK_THRESHOLD = 5; // day_streak or week_streak > 5 triggers Featured Red

/**
 * Fractional percentile rank in [0, 1] for each value in `values`, tied
 * values get the same (averaged) rank. A single-user cohort degenerates to
 * everyone at 1.0 - inherent to relative ranking with nothing to compare to
 * (guarded against separately via CARD_MIN_COHORT).
 */
function percentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n <= 1) return values.map(() => 1);
  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const ranks = new Array(n).fill(0);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[order[j + 1]] === values[order[i]]) j++;
    const avgPosition = (i + j) / 2;
    for (let k = i; k <= j; k++) ranks[order[k]] = avgPosition;
    i = j + 1;
  }
  return ranks.map((r) => r / (n - 1));
}

function rescale(percentile: number): number {
  return Math.round(CARD_RATING_FLOOR + percentile * (99 - CARD_RATING_FLOOR));
}

/** Longest run of calendar-consecutive dates in a sorted, deduplicated date array. */
function longestConsecutiveRun(sortedDates: string[]): number {
  let longest = 0, run = 0, prev: string | null = null;
  for (const d of sortedDates) {
    run = prev && d === shiftDate(prev, 1) ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }
  return longest;
}

/**
 * Table names to read for this scope: just the live table for 'season'
 * (the season-start clamp already guarantees it holds nothing from before
 * the current season), or the live table plus every archived "_season_N"
 * table for 'career'.
 *
 * Queried one table at a time and merged in JS, rather than one big
 * UNION ALL - this D1/SQLite build caps compound SELECTs at 5 terms
 * (verified: 5 works, 6 throws "too many terms in compound SELECT"), which
 * a UNION-per-season approach would blow past after only a handful of
 * season resets. Separate queries scale to any number of seasons.
 */
async function getScopedTableNames(env: Env, scope: CardScope, baseTable: string): Promise<string[]> {
  if (scope === 'season') return [baseTable];
  const currentSeason = await getCurrentSeason(env);
  const names = [baseTable];
  for (let n = 1; n < currentSeason; n++) names.push(`${baseTable}_season_${n}`);
  return names;
}

async function getCardMetricsForAllUsers(env: Env, scope: CardScope): Promise<Map<number, RawUserCardMetrics>> {
  const [dailyTables, breakdownTables] = await Promise.all([
    getScopedTableNames(env, scope, 'daily_stats'),
    getScopedTableNames(env, scope, 'user_stat_breakdown'),
  ]);

  const [dailyResults, breakdownResults] = await Promise.all([
    Promise.all(dailyTables.map((t) =>
      env.DB.prepare(`SELECT user_id, date, total_seconds, human_seconds, ai_lines, human_lines FROM ${t}`).all<{
        user_id: number; date: string; total_seconds: number; human_seconds: number; ai_lines: number; human_lines: number;
      }>()
    )),
    Promise.all(breakdownTables.map((t) =>
      env.DB.prepare(`SELECT user_id, kind, name FROM ${t} WHERE kind IN ('project','language','editor','os')`).all<{
        user_id: number; kind: string; name: string;
      }>()
    )),
  ]);

  const dailyRows = { results: dailyResults.flatMap((r) => r.results) };
  const breakdownRows = { results: breakdownResults.flatMap((r) => r.results) };

  const byUser = new Map<number, RawUserCardMetrics>();
  const ensure = (userId: number): RawUserCardMetrics => {
    let m = byUser.get(userId);
    if (!m) {
      m = {
        human_seconds: 0, output_score: 0, days_active: 0, days_tracked: 0, longest_streak: 0,
        distinct_projects: 0, distinct_languages: 0, distinct_editors: 0, distinct_os: 0,
      };
      byUser.set(userId, m);
    }
    return m;
  };

  const activeDatesByUser = new Map<number, string[]>();
  for (const row of dailyRows.results) {
    const m = ensure(row.user_id);
    m.human_seconds += row.human_seconds || 0;
    m.output_score += (row.human_lines || 0) + 0.7 * (row.ai_lines || 0);
    m.days_tracked += 1;
    if ((row.total_seconds || 0) >= CARD_ACTIVE_SECONDS) {
      m.days_active += 1;
      const dates = activeDatesByUser.get(row.user_id) ?? [];
      dates.push(row.date);
      activeDatesByUser.set(row.user_id, dates);
    }
  }
  for (const [userId, dates] of activeDatesByUser) {
    ensure(userId).longest_streak = longestConsecutiveRun([...new Set(dates)].sort());
  }

  const distinctSets = new Map<number, Record<'project' | 'language' | 'editor' | 'os', Set<string>>>();
  for (const row of breakdownRows.results) {
    const kind = row.kind as 'project' | 'language' | 'editor' | 'os';
    const sets = distinctSets.get(row.user_id) ?? { project: new Set(), language: new Set(), editor: new Set(), os: new Set() };
    sets[kind]?.add(row.name);
    distinctSets.set(row.user_id, sets);
  }
  for (const [userId, sets] of distinctSets) {
    const m = ensure(userId);
    m.distinct_projects = sets.project.size;
    m.distinct_languages = sets.language.size;
    m.distinct_editors = sets.editor.size;
    m.distinct_os = sets.os.size;
  }

  return byUser;
}

/**
 * Real FC position codes, assigned by weighted blend of all 6 attributes
 * (matching how FIFA/FC itself computes position suitability), not just
 * whichever single stat is highest. Mirror-image pairs (RW/LW, LM/RM,
 * RB/LB) always tie exactly on our data, so ties are broken by a
 * deterministic hash of the user id - consistent per person, purely
 * cosmetic, not a real signal.
 */
const POSITION_WEIGHTS: Record<Exclude<CardPosition, 'GK'>, Partial<Record<'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy', number>>> = {
  ST: { sho: 0.45, pac: 0.25, dri: 0.15, phy: 0.10, pas: 0.05 },
  RW: { pac: 0.35, dri: 0.30, sho: 0.20, pas: 0.15 },
  LW: { pac: 0.35, dri: 0.30, sho: 0.20, pas: 0.15 },
  CAM: { pas: 0.40, dri: 0.30, sho: 0.20, pac: 0.10 },
  CM: { pas: 0.30, phy: 0.25, dri: 0.20, def: 0.15, pac: 0.10 },
  CDM: { def: 0.40, phy: 0.30, pas: 0.20, dri: 0.10 },
  LM: { pac: 0.30, pas: 0.30, dri: 0.25, def: 0.15 },
  RM: { pac: 0.30, pas: 0.30, dri: 0.25, def: 0.15 },
  CB: { def: 0.55, phy: 0.35, pac: 0.10 },
  RB: { def: 0.35, pac: 0.30, phy: 0.20, pas: 0.15 },
  LB: { def: 0.35, pac: 0.30, phy: 0.20, pas: 0.15 },
};
const LEFT_RIGHT_PAIRS: Array<[Exclude<CardPosition, 'GK'>, Exclude<CardPosition, 'GK'>]> = [['RW', 'LW'], ['RM', 'LM'], ['RB', 'LB']];

function hashUserId(userId: number): number {
  let h = 0;
  const s = String(userId);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function assignPosition(attrs: Pick<UserCardAttributes, 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy'>, userId: number): Exclude<CardPosition, 'GK'> {
  const scores = (Object.keys(POSITION_WEIGHTS) as Array<Exclude<CardPosition, 'GK'>>).map((pos) => {
    const weights = POSITION_WEIGHTS[pos];
    let score = 0;
    for (const key of Object.keys(weights) as Array<keyof typeof weights>) {
      score += (attrs[key] ?? 0) * (weights[key] ?? 0);
    }
    return { pos, score };
  });

  // Collapse each left/right pair to a single tied score entry, side picked by hash.
  const collapsed = scores.filter(({ pos }) => !LEFT_RIGHT_PAIRS.some(([, left]) => left === pos));
  let best = collapsed[0];
  for (const s of collapsed) if (s.score > best.score) best = s;

  const pair = LEFT_RIGHT_PAIRS.find(([right]) => right === best.pos);
  if (pair) {
    const [right, left] = pair;
    return hashUserId(userId) % 2 === 0 ? right : left;
  }
  return best.pos;
}

/** Per-user count of past seasons they were champion of (most rank=1 days, metric='total', period='day'). */
async function getSeasonChampionCounts(env: Env): Promise<Map<number, number>> {
  const currentSeason = await getCurrentSeason(env);
  const counts = new Map<number, number>();
  for (let n = 1; n < currentSeason; n++) {
    try {
      const champion = await env.DB.prepare(`
        SELECT user_id, COUNT(*) as rank1_days
        FROM leaderboard_history_season_${n}
        WHERE period = 'day' AND metric = 'total' AND rank = 1 AND value > 0
        GROUP BY user_id
        ORDER BY rank1_days DESC
        LIMIT 1
      `).first<{ user_id: number; rank1_days: number }>();
      if (champion) counts.set(champion.user_id, (counts.get(champion.user_id) ?? 0) + 1);
    } catch (error) {
      console.error(`Error computing champion for season ${n}:`, error);
    }
  }
  return counts;
}

/** Computes every user's card in one pass - percentiles need the whole cohort anyway. */
export async function computeCardsForAllUsers(env: Env, scope: CardScope, today: string): Promise<Map<number, UserCardAttributes>> {
  const raw = await getCardMetricsForAllUsers(env, scope);
  const userIds = [...raw.keys()];

  const dimensions: Array<{ key: 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy'; extract: (m: RawUserCardMetrics) => number }> = [
    { key: 'pac', extract: (m) => m.human_seconds },
    { key: 'sho', extract: (m) => m.output_score },
    { key: 'pas', extract: (m) => m.distinct_projects + m.distinct_languages },
    { key: 'dri', extract: (m) => m.distinct_editors + m.distinct_os },
    { key: 'def', extract: (m) => (m.days_tracked > 0 ? m.days_active / m.days_tracked : 0) },
    { key: 'phy', extract: (m) => m.longest_streak },
  ];

  const ratingsByUser = new Map<number, Record<string, number>>();
  for (const dim of dimensions) {
    const values = userIds.map((id) => dim.extract(raw.get(id)!));
    const percentiles = percentileRanks(values);
    userIds.forEach((id, i) => {
      const r = ratingsByUser.get(id) ?? {};
      r[dim.key] = rescale(percentiles[i]);
      ratingsByUser.set(id, r);
    });
  }

  const overallByUser = new Map<number, number>();
  for (const id of userIds) {
    const r = ratingsByUser.get(id)!;
    overallByUser.set(id, Math.round((r.pac + r.sho + r.pas + r.dri + r.def + r.phy) / 6));
  }

  const [championCounts, rankOneStats] = await Promise.all([
    getSeasonChampionCounts(env),
    getRankOneStats(env, 'total', today),
  ]);

  const lowestOverallUserId = userIds.length > 0
    ? userIds.reduce((worst, id) => (overallByUser.get(id)! < overallByUser.get(worst)! ? id : worst), userIds[0])
    : null;
  const highestOverallUserId = userIds.length > 0
    ? userIds.reduce((best, id) => (overallByUser.get(id)! > overallByUser.get(best)! ? id : best), userIds[0])
    : null;

  const cohortTooSmall = userIds.length < CARD_MIN_COHORT;

  const cards = new Map<number, UserCardAttributes>();
  for (const id of userIds) {
    const r = ratingsByUser.get(id)!;
    const overall = overallByUser.get(id)!;
    const attrs = { pac: r.pac, sho: r.sho, pas: r.pas, dri: r.dri, def: r.def, phy: r.phy };

    const position: CardPosition = id === lowestOverallUserId ? 'GK' : assignPosition(attrs, id);

    let cardType: CardType;
    const allSixElite = attrs.pac >= 90 && attrs.sho >= 90 && attrs.pas >= 90 && attrs.dri >= 90 && attrs.def >= 90 && attrs.phy >= 90;
    const streak = rankOneStats.get(id);
    const isHot = !!streak && (streak.day_streak > FEATURED_STREAK_THRESHOLD || streak.week_streak > FEATURED_STREAK_THRESHOLD);

    if ((championCounts.get(id) ?? 0) >= 2) cardType = 'icon';
    else if (allSixElite) cardType = 'white_icon';
    else if (id === highestOverallUserId) cardType = 'legend_hero';
    else if (isHot) cardType = 'featured_red';
    else if (overall >= 75) cardType = 'base_gold';
    else cardType = 'base_silver';

    cards.set(id, {
      ...attrs,
      overall,
      position,
      cardType,
      provisional: cohortTooSmall || raw.get(id)!.days_active < CARD_MIN_DAYS_ACTIVE,
      days_active: raw.get(id)!.days_active,
    });
  }
  return cards;
}

export async function getUserCard(env: Env, userId: number, scope: CardScope, today: string): Promise<UserCardAttributes | null> {
  const cards = await computeCardsForAllUsers(env, scope, today);
  return cards.get(userId) ?? null;
}

export interface UserCardWithProfile extends UserCardAttributes {
  user_id: number;
  username: string;
  display_name: string | null;
  photo_url: string | null;
}

/** Every non-banned user's card at once, sorted best overall first - for a leaderboard-style FUT card gallery. */
export async function getAllUserCards(env: Env, scope: CardScope, today: string): Promise<UserCardWithProfile[]> {
  const [cards, users] = await Promise.all([
    computeCardsForAllUsers(env, scope, today),
    env.DB.prepare('SELECT id, username, display_name, photo_url FROM users WHERE is_banned = 0').all<{
      id: number; username: string; display_name: string | null; photo_url: string | null;
    }>(),
  ]);

  const result: UserCardWithProfile[] = [];
  for (const u of users.results) {
    const card = cards.get(u.id);
    if (!card) continue; // no synced data for this user yet
    result.push({ ...card, user_id: u.id, username: u.username, display_name: u.display_name, photo_url: u.photo_url });
  }
  result.sort((a, b) => b.overall - a.overall);
  return result;
}

