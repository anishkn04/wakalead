import { Env } from './types';
import {
  fetchWakaTimeSummaries,
  parseDailySummary,
  refreshAccessToken,
  parseTopStats,
  fetchAllTimeSinceToday,
  collectDayBreakdowns,
  fetchWakaTimeUser,
  fetchPhotoData,
} from './wakatime';
import {
  getAllUsers,
  storeDailyStats,
  logFetch,
  wasFetchedToday,
  createOrUpdateUser,
  upsertUserStats,
  recentFetch,
  upsertDayBreakdowns,
  upsertUserPhoto,
  computeAndStoreDailyLeaderboard,
  computeAndStoreWeeklyLeaderboard,
  getCurrentSeasonStartDate,
} from './database';

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
 * Keeps a season reset "stuck": every sync path must check this before
 * touching daily_stats/leaderboard_history for a date, or a normal
 * multi-day sync (refresh-all, cron, backfill) would silently re-pull real
 * WakaTime history from before the reset and undo it.
 */
function isDateInCurrentSeason(date: string, seasonStart: string | null): boolean {
  return !seasonStart || date >= seasonStart;
}

const ALL_TIME_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Refresh a user's stored avatar bytes (from WakaTime/Gravatar) on every
 * sync so the leaderboard always shows the latest profile picture. Purely
 * server-side - the browser only ever loads avatars from our own photo
 * endpoint. Failures are logged and swallowed.
 */
async function ensurePhoto(env: Env, userId: number, username: string, accessToken: string, fetchDate: string): Promise<void> {
  try {
    const wakaUser = await fetchWakaTimeUser(accessToken);
    const photo = await fetchPhotoData(wakaUser?.photo || null);
    if (photo) {
      await upsertUserPhoto(env, userId, photo.data, photo.mime);
      console.log(`Stored photo for ${username}`);
    }
    await logFetch(env, userId, 'photo', fetchDate, 'success');
  } catch (error: any) {
    console.error(`Error refreshing photo for ${username}:`, error);
  }
}

/**
 * Refresh stored avatar bytes for every user right now (admin-triggered
 * backfill, also covers anyone missing from the daily cron). Uses each
 * user's own access token, refreshing expired ones like the normal sync.
 */
export async function fetchPhotosForAllUsers(env: Env): Promise<void> {
  const users = await getAllUsers(env);
  console.log(`Refreshing photos for ${users.length} users`);
  const fetchDate = formatDate(getNepalDate());

  const BATCH_SIZE = 5;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (user) => {
      try {
        let accessToken = user.access_token;
        if (user.token_expires_at && user.token_expires_at < Date.now()) {
          if (user.refresh_token) {
            const tokenData = await refreshAccessToken(env, user.refresh_token);
            accessToken = tokenData.access_token;
            await createOrUpdateUser(env, {
              wakatime_id: user.wakatime_id,
              username: user.username,
              display_name: user.display_name || undefined,
              email: user.email || undefined,
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              token_expires_at: Date.now() + tokenData.expires_in * 1000,
              photo_url: user.photo_url || undefined,
            });
          } else {
            console.error(`Token expired and no refresh token for user ${user.username}`);
            return;
          }
        }
        await ensurePhoto(env, user.id, user.username, accessToken, fetchDate);
      } catch (error: any) {
        console.error(`Error refreshing photo for ${user.username}:`, error);
      }
    }));
    if (i + BATCH_SIZE < users.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  console.log('Photo refresh completed');
}

/**
 * Best-effort refresh of a user's lifetime coding seconds from the
 * all_time_since_today endpoint. Gated to once a week per user to stay
 * gentle on WakaTime rate limits; failures are logged and swallowed so a
 * problem here never breaks the surrounding sync.
 */
async function ensureAllTimeStats(env: Env, userId: number, username: string, accessToken: string, fetchDate: string): Promise<void> {
  try {
    if (await recentFetch(env, userId, 'all_time', Date.now() - ALL_TIME_WEEK_MS)) {
      return;
    }
    const allTimeSeconds = await fetchAllTimeSinceToday(accessToken);
    await upsertUserStats(env, userId, { allTimeSeconds });
    await logFetch(env, userId, 'all_time', fetchDate, 'success');
    console.log(`Fetched all-time stats for ${username}: ${allTimeSeconds}s`);
  } catch (error: any) {
    console.error(`Error fetching all-time stats for ${username}:`, error);
  }
}

/**
 * Data fetcher - runs on a scheduled cron job
 * Fetches yesterday's data for all users to stay within rate limits
 *
 * Strategy:
 * - Runs once per day at 2 AM UTC
 * - Fetches previous day's data (which is now complete)
 * - Stores in daily_stats table
 * - Logs all fetch attempts for debugging and rate limit tracking
 *
 * `explicitDate` (YYYY-MM-DD) overrides `useToday` entirely - used by the
 * admin backfill endpoint to repair a specific past date (e.g. one the cron
 * missed) instead of only ever being able to target today/yesterday. Safe to
 * re-run on a date that's already synced: per-user fetches are skipped via
 * `wasFetchedToday`, but the leaderboard recompute at the end always runs,
 * which is exactly what a `leaderboard_history` repair needs.
 */
export async function fetchDataForAllUsers(env: Env, useToday = false, explicitDate?: string): Promise<void> {
  console.log('Starting scheduled data fetch...');

  let dateStr: string;
  if (explicitDate) {
    dateStr = explicitDate;
  } else {
    const targetDate = getNepalDate();
    if (!useToday) {
      targetDate.setUTCDate(targetDate.getUTCDate() - 1);
    }
    dateStr = formatDate(targetDate);
  }

  const seasonStart = await getCurrentSeasonStartDate(env);
  if (!isDateInCurrentSeason(dateStr, seasonStart)) {
    console.log(`Skipping fetch for ${dateStr} - before current season start (${seasonStart})`);
    return;
  }

  // Get all users
  const users = await getAllUsers(env);
  console.log(`Fetching data for ${users.length} users for date ${dateStr}`);

  // Fetch data for each user sequentially to avoid rate limits
  for (const user of users) {
    try {
      // Check if already fetched
      if (await wasFetchedToday(env, user.id, dateStr)) {
        console.log(`Data already fetched for user ${user.username} on ${dateStr}`);
        continue;
      }

      // Check if token needs refresh
      let accessToken = user.access_token;
      if (user.token_expires_at && user.token_expires_at < Date.now()) {
        if (user.refresh_token) {
          console.log(`Refreshing token for user ${user.username}`);
          const tokenData = await refreshAccessToken(env, user.refresh_token);
          accessToken = tokenData.access_token;

          // Update user with new token
          await createOrUpdateUser(env, {
            wakatime_id: user.wakatime_id,
            username: user.username,
            display_name: user.display_name || undefined,
            email: user.email || undefined,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: Date.now() + tokenData.expires_in * 1000,
            photo_url: user.photo_url || undefined,
          });
        } else {
          console.error(`Token expired and no refresh token for user ${user.username}`);
          await logFetch(env, user.id, 'daily', dateStr, 'error', 'Token expired');
          continue;
        }
      }

      // Fetch WakaTime data
      console.log(`Fetching WakaTime data for user ${user.username}`);
      const summaries = await fetchWakaTimeSummaries(accessToken, dateStr, dateStr);
      
      const daySummary = (summaries.data || [])[0];
      const stats = parseDailySummary(daySummary || {});
      
      // Store in database
      await storeDailyStats(env, user.id, dateStr, stats);
      await upsertDayBreakdowns(env, user.id, dateStr, collectDayBreakdowns(daySummary || {}));
      await logFetch(env, user.id, 'daily', dateStr, 'success');
      
      console.log(`Successfully fetched data for user ${user.username}: ${stats.total_seconds}s (AI: ${stats.ai_seconds}s)`);

      // Refresh aggregated metadata (top language/editor/project) from the
      // summary we just downloaded - zero extra API calls.
      try {
        await upsertUserStats(env, user.id, parseTopStats([daySummary]));

        // Refresh lifetime coding time at most once a week to stay gentle
        // on WakaTime rate limits.
        await ensureAllTimeStats(env, user.id, user.username, accessToken, dateStr);

        // Refresh avatar bytes at most once a week (server-side only).
        await ensurePhoto(env, user.id, user.username, accessToken, dateStr);
      } catch (error: any) {
        console.error(`Error updating user stats for ${user.username}:`, error);
      }

      // Small delay to be nice to WakaTime API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`Error fetching data for user ${user.username}:`, error);
      await logFetch(env, user.id, 'daily', dateStr, 'error', error.message);
    }
  }

  // Compute daily + weekly (trailing 7-day) leaderboard rankings for the
  // synced date so consistency/streaks stay current.
  try {
    await computeAndStoreDailyLeaderboard(env, dateStr);
    await computeAndStoreWeeklyLeaderboard(env, dateStr);
    console.log(`Computed daily + weekly leaderboard for ${dateStr}`);
  } catch (error: any) {
    console.error(`Error computing leaderboards for ${dateStr}:`, error);
  }

  console.log('Scheduled data fetch completed');
}

/**
 * Fetch current day data on-demand (with caching)
 * Only fetches if not already fetched today
 */
export async function fetchTodayDataForUser(
  env: Env,
  userId: number,
  accessToken: string
): Promise<void> {
  const today = formatDate(getNepalDate());

  // Check if already fetched today
  if (await wasFetchedToday(env, userId, today)) {
    return; // Already have today's data
  }

  const seasonStart = await getCurrentSeasonStartDate(env);
  if (!isDateInCurrentSeason(today, seasonStart)) {
    return; // Shouldn't happen in practice (today is never before a past reset), but stay consistent
  }

  try {
    const summaries = await fetchWakaTimeSummaries(accessToken, today, today);
    const daySummary = (summaries.data || [])[0];
    const stats = parseDailySummary(daySummary || {});
    
    await storeDailyStats(env, userId, today, stats);
    await upsertDayBreakdowns(env, userId, today, collectDayBreakdowns(daySummary || {}));
    await logFetch(env, userId, 'daily', today, 'success');

    // Keep the aggregated metadata fresh for personalized comments
    try {
      await upsertUserStats(env, userId, parseTopStats([daySummary]));
      await ensureAllTimeStats(env, userId, `user-${userId}`, accessToken, today);
      await ensurePhoto(env, userId, `user-${userId}`, accessToken, today);
    } catch (error: any) {
      console.error('Error updating user stats:', error);
    }

    // Refresh today's rank-one/streak data now that this user's numbers
    // changed - ranks are global, so this recomputes for everyone, not just
    // the logging-in user. Without this, streaks only ever update when an
    // admin force-syncs or the daily cron runs (which only closes out
    // *yesterday*), so a normal login would otherwise never move "today".
    try {
      await computeAndStoreDailyLeaderboard(env, today);
      await computeAndStoreWeeklyLeaderboard(env, today);
    } catch (error: any) {
      console.error('Error computing leaderboards after login sync:', error);
    }
  } catch (error: any) {
    console.error('Error fetching today data:', error);
    await logFetch(env, userId, 'daily', today, 'error', error.message);
    throw error;
  }
}

/**
 * Fetch today's data for all users (background task)
 * Used when anyone accesses the dashboard to refresh everyone's data
 * @param forceRefresh - If true, skip the wasFetchedToday check and always fetch fresh data
 * 
 * Optimized: Fetches data in parallel batches for better performance
 */
export async function fetchTodayDataForAllUsers(env: Env, forceRefresh = false): Promise<void> {
  const today = formatDate(getNepalDate());

  const seasonStart = await getCurrentSeasonStartDate(env);
  if (!isDateInCurrentSeason(today, seasonStart)) {
    return;
  }

  const users = await getAllUsers(env);

  console.log(`Fetching today's data for ${users.length} users (forceRefresh: ${forceRefresh})`);

  // Filter out users that have already been fetched (unless forceRefresh)
  const usersToFetch = forceRefresh 
    ? users 
    : await Promise.all(users.map(async (user) => {
        const alreadyFetched = await wasFetchedToday(env, user.id, today);
        return alreadyFetched ? null : user;
      })).then(results => results.filter(Boolean));

  console.log(`Actually fetching for ${usersToFetch.length} users after filtering`);

  // Process users in parallel batches (5 at a time to avoid rate limits)
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < usersToFetch.length; i += BATCH_SIZE) {
    const batch = usersToFetch.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (user: any) => {
      try {
        let accessToken = user.access_token;
        
        // Check if token needs refresh
        if (user.token_expires_at && user.token_expires_at < Date.now()) {
          if (user.refresh_token) {
            const tokenData = await refreshAccessToken(env, user.refresh_token);
            accessToken = tokenData.access_token;
            
            await createOrUpdateUser(env, {
              wakatime_id: user.wakatime_id,
              username: user.username,
              display_name: user.display_name || undefined,
              email: user.email || undefined,
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              token_expires_at: Date.now() + tokenData.expires_in * 1000,
              photo_url: user.photo_url || undefined,
            });
          } else {
            console.error(`Token expired for user ${user.username}`);
            return;
          }
        }

        const summaries = await fetchWakaTimeSummaries(accessToken, today, today);
        const daySummary = (summaries.data || [])[0];
        const stats = parseDailySummary(daySummary || {});
        
        await storeDailyStats(env, user.id, today, stats);
        await upsertDayBreakdowns(env, user.id, today, collectDayBreakdowns(daySummary || {}));
        await logFetch(env, user.id, 'daily', today, 'success');

        try {
          await upsertUserStats(env, user.id, parseTopStats([daySummary]));
          await ensurePhoto(env, user.id, user.username, accessToken, today);
        } catch (error: any) {
          console.error(`Error updating stats for ${user.username}:`, error);
        }
      } catch (error: any) {
        console.error(`Error fetching today data for ${user.username}:`, error);
        await logFetch(env, user.id, 'daily', today, 'error', error.message);
      }
    }));
    
    // Small delay between batches (only if more batches remain)
    if (i + BATCH_SIZE < usersToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Compute daily + weekly leaderboard rankings for today after all users synced
  try {
    await computeAndStoreDailyLeaderboard(env, today);
    await computeAndStoreWeeklyLeaderboard(env, today);
    console.log(`Computed daily + weekly leaderboard for ${today}`);
  } catch (error: any) {
    console.error(`Error computing leaderboards for ${today}:`, error);
  }

  console.log(`Completed fetching today's data for all users`);
}

/**
 * Fetch entire week's data for a user (last 7 days)
 * Fetches all days that haven't been fetched yet
 */
export async function fetchWeekDataForUser(
  env: Env,
  userId: number,
  accessToken: string
): Promise<void> {
  const seasonStart = await getCurrentSeasonStartDate(env);

  // Generate last 7 days dates, clamped to the current season - otherwise
  // this would happily re-pull real WakaTime history from before a reset.
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const nepalNow = getNepalDate();
    nepalNow.setUTCDate(nepalNow.getUTCDate() - i);
    const d = formatDate(nepalNow);
    if (isDateInCurrentSeason(d, seasonStart)) dates.push(d);
  }
  if (dates.length === 0) return; // entire trailing week is before the season start

  try {
    // Fetch entire (clamped) window in one API call (more efficient)
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    console.log(`Fetching week data for user ${userId} from ${startDate} to ${endDate}`);
    const summaries = await fetchWakaTimeSummaries(accessToken, startDate, endDate);

    // Store each day's data
    if (summaries.data && Array.isArray(summaries.data)) {
      for (const daySummary of summaries.data) {
        const date = daySummary.range.date;
        if (!isDateInCurrentSeason(date, seasonStart)) continue;
        const stats = parseDailySummary(daySummary);

        // Store in database (will update if already exists)
        await storeDailyStats(env, userId, date, stats);
        await upsertDayBreakdowns(env, userId, date, collectDayBreakdowns(daySummary));
      }
      
      // Aggregate top language/editor/project across the week (free - the
      // data is already part of the summaries response we just fetched)
      await upsertUserStats(env, userId, parseTopStats(summaries.data));
      await ensureAllTimeStats(env, userId, `user-${userId}`, accessToken, endDate);
      
      await logFetch(env, userId, 'weekly', endDate, 'success');
      console.log(`Successfully fetched week data for user ${userId}`);
    }
  } catch (error: any) {
    console.error('Error fetching week data:', error);
    await logFetch(env, userId, 'weekly', dates[dates.length - 1], 'error', error.message);
    throw error;
  }
}

/**
 * Fetch week's data for all users (background task)
 * Used when refresh button is clicked to update everyone's week data
 * 
 * Optimized: Fetches data in parallel batches for better performance
 */
export async function fetchWeekDataForAllUsers(env: Env): Promise<void> {
  const users = await getAllUsers(env);
  const seasonStart = await getCurrentSeasonStartDate(env);

  // Generate last 7 days dates, clamped to the current season - otherwise
  // this would happily re-pull real WakaTime history from before a reset.
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const nepalNow = getNepalDate();
    nepalNow.setUTCDate(nepalNow.getUTCDate() - i);
    const d = formatDate(nepalNow);
    if (isDateInCurrentSeason(d, seasonStart)) dates.push(d);
  }
  if (dates.length === 0) return; // entire trailing week is before the season start
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  console.log(`Fetching week data for ${users.length} users from ${startDate} to ${endDate}`);

  // Process users in parallel batches (5 at a time to avoid rate limits)
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (user) => {
      try {
        let accessToken = user.access_token;
        
        // Check if token needs refresh
        if (user.token_expires_at && user.token_expires_at < Date.now()) {
          if (user.refresh_token) {
            console.log(`Refreshing token for user ${user.username}`);
            const tokenData = await refreshAccessToken(env, user.refresh_token);
            accessToken = tokenData.access_token;
            
            await createOrUpdateUser(env, {
              wakatime_id: user.wakatime_id,
              username: user.username,
              display_name: user.display_name || undefined,
              email: user.email || undefined,
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              token_expires_at: Date.now() + tokenData.expires_in * 1000,
              photo_url: user.photo_url || undefined,
            });
          } else {
            console.error(`Token expired for user ${user.username}`);
            return;
          }
        }

        // Fetch entire week in one API call
        const summaries = await fetchWakaTimeSummaries(accessToken, startDate, endDate);
        
        // Store each day's data in parallel
        if (summaries.data && Array.isArray(summaries.data)) {
          await Promise.all(summaries.data.map(async (daySummary: any) => {
            const date = daySummary.range.date;
            if (!isDateInCurrentSeason(date, seasonStart)) return;
            const stats = parseDailySummary(daySummary);
            await storeDailyStats(env, user.id, date, stats);
            await upsertDayBreakdowns(env, user.id, date, collectDayBreakdowns(daySummary));
          }));

          // Aggregate top language/editor/project across the week
          await upsertUserStats(env, user.id, parseTopStats(summaries.data));

          // Refresh lifetime coding time (at most once a week per user)
          await ensureAllTimeStats(env, user.id, user.username, accessToken, endDate);

          // Refresh avatar bytes (each sync keeps the leaderboard photo fresh)
          await ensurePhoto(env, user.id, user.username, accessToken, endDate);
          
          await logFetch(env, user.id, 'weekly', endDate, 'success');
          console.log(`Successfully fetched week data for ${user.username}`);
        }
      } catch (error: any) {
        console.error(`Error fetching week data for ${user.username}:`, error);
        await logFetch(env, user.id, 'weekly', endDate, 'error', error.message);
      }
    }));
    
    // Small delay between batches to avoid rate limits (only if more batches remain)
    if (i + BATCH_SIZE < users.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Compute daily + weekly leaderboard rankings for each date in the week
  // (each date is the anchor of its own trailing 7-day window).
  for (const date of dates) {
    try {
      await computeAndStoreDailyLeaderboard(env, date);
      await computeAndStoreWeeklyLeaderboard(env, date);
      console.log(`Computed daily + weekly leaderboard for ${date}`);
    } catch (error: any) {
      console.error(`Error computing leaderboards for ${date}:`, error);
    }
  }

  console.log(`Completed fetching week data for all users`);
}
