import { Env } from './types';
import { getUserTooltipStats } from './database';
import {
  fetchWakaTimeUser,
  fetchWakaTimeAllTimeStats,
  fetchAllTimeSinceToday,
  refreshAccessToken,
} from './wakatime';

/**
 * Full public profile for a WakaLead user. Combines what we already have in
 * D1 (daily stats, streaks, breakdowns, AI usage) with fresh WakaTime data
 * fetched server-side using the user's own OAuth token. Live fetches are
 * best-effort: if the token is missing/expired/revoked we fall back to the
 * synced data only, so the endpoint never fails because of a bad token.
 */

// Helper to get date in Nepal timezone (UTC+5:45)
function getNepalDate(date = new Date()): Date {
  const utc = date.getTime();
  const nepalOffset = 5.75 * 60 * 60 * 1000; // UTC+5:45 in milliseconds
  return new Date(utc + nepalOffset);
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Return a usable access token, refreshing it (and persisting the new tokens)
 * when it's expired or about to expire. Returns null when there's nothing to
 * use - the caller then falls back to DB-only data.
 */
async function getValidAccessToken(env: Env, user: any): Promise<string | null> {
  let accessToken = user.access_token;
  const expiresSoon =
    user.token_expires_at && user.token_expires_at < Date.now() + 5 * 60 * 1000;

  if (expiresSoon) {
    if (!user.refresh_token) return null;
    try {
      const tokenData = await refreshAccessToken(env, user.refresh_token);
      accessToken = tokenData.access_token;
      await env.DB.prepare(`
        UPDATE users SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        tokenData.access_token,
        tokenData.refresh_token || null,
        tokenData.expires_in ? Date.now() + parseInt(tokenData.expires_in) * 1000 : null,
        Date.now(),
        user.id
      ).run();
    } catch {
      return null;
    }
  }

  return accessToken;
}

export async function getProfileData(env: Env, username: string) {
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE LOWER(username) = LOWER(?)'
  ).bind(username.replace(/^@/, '')).first<any>();

  if (!user) return null;

  const today = formatDate(getNepalDate());
  const db = await getUserTooltipStats(env, user.id, today);

  const dailyRes = await env.DB.prepare(`
    SELECT date, total_seconds, ai_seconds, human_seconds, ai_lines, human_lines
    FROM daily_stats WHERE user_id = ? ORDER BY date DESC
  `).bind(user.id).all<any>();

  const live = {
    ok: false,
    error: null as string | null,
    fetchedAt: null as number | null,
    me: null as any,
    stats: null as any,
    allTimeSinceToday: null as any,
  };

  const accessToken = await getValidAccessToken(env, user);
  if (!accessToken) {
    live.error = 'No valid WakaTime token - showing synced data only';
  } else {
    const [meRes, statsRes, allTimeRes] = await Promise.allSettled([
      fetchWakaTimeUser(accessToken),
      fetchWakaTimeAllTimeStats(accessToken),
      fetchAllTimeSinceToday(accessToken),
    ]);

    if (meRes.status === 'fulfilled') live.me = meRes.value;
    if (statsRes.status === 'fulfilled') live.stats = statsRes.value;
    if (allTimeRes.status === 'fulfilled') live.allTimeSinceToday = allTimeRes.value;

    live.ok =
      meRes.status === 'fulfilled' ||
      statsRes.status === 'fulfilled' ||
      allTimeRes.status === 'fulfilled';

    const rejected = [meRes, statsRes, allTimeRes].filter(
      (r) => r.status === 'rejected'
    ) as PromiseRejectedResult[];
    if (rejected.length === 3) {
      live.error = (rejected[0].reason as Error)?.message || 'Live data unavailable';
    }
    live.fetchedAt = Date.now();
  }

  return {
    user: {
      user_id: user.id,
      wakatime_id: user.wakatime_id,
      username: user.username,
      display_name: user.display_name,
      email: user.email,
      photo_url: user.photo_url,
      is_admin: user.is_admin === 1,
      created_at: user.created_at,
    },
    db: { ...db, daily: dailyRes.results || [] },
    live,
  };
}
