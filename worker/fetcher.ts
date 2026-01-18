import { Env } from './types';
import {
  fetchWakaTimeSummaries,
  calculateTotalSeconds,
  refreshAccessToken,
} from './wakatime';
import {
  getAllUsers,
  storeDailyStats,
  logFetch,
  wasFetchedToday,
  createOrUpdateUser,
} from './database';

/**
 * Data fetcher - runs on a scheduled cron job
 * Fetches yesterday's data for all users to stay within rate limits
 * 
 * Strategy:
 * - Runs once per day at 2 AM UTC
 * - Fetches previous day's data (which is now complete)
 * - Stores in daily_stats table
 * - Logs all fetch attempts for debugging and rate limit tracking
 */
export async function fetchDataForAllUsers(env: Env): Promise<void> {
  console.log('Starting scheduled data fetch...');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

  // Get all users
  const users = await getAllUsers(env);
  console.log(`Fetching data for ${users.length} users`);

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
      
      const totalSeconds = calculateTotalSeconds(summaries.data || []);
      
      // Store in database
      await storeDailyStats(env, user.id, dateStr, totalSeconds);
      await logFetch(env, user.id, 'daily', dateStr, 'success');
      
      console.log(`Successfully fetched data for ${user.username}: ${totalSeconds}s`);

      // Small delay to be nice to WakaTime API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`Error fetching data for user ${user.username}:`, error);
      await logFetch(env, user.id, 'daily', dateStr, 'error', error.message);
    }
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
  const today = new Date().toISOString().split('T')[0];

  // Check if already fetched today
  if (await wasFetchedToday(env, userId, today)) {
    return; // Already have today's data
  }

  try {
    const summaries = await fetchWakaTimeSummaries(accessToken, today, today);
    const totalSeconds = calculateTotalSeconds(summaries.data || []);
    
    await storeDailyStats(env, userId, today, totalSeconds);
    await logFetch(env, userId, 'daily', today, 'success');
  } catch (error: any) {
    console.error('Error fetching today data:', error);
    await logFetch(env, userId, 'daily', today, 'error', error.message);
    throw error;
  }
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
  // Generate last 7 days dates
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  try {
    // Fetch entire week in one API call (more efficient)
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    console.log(`Fetching week data for user ${userId} from ${startDate} to ${endDate}`);
    const summaries = await fetchWakaTimeSummaries(accessToken, startDate, endDate);
    
    // Store each day's data
    if (summaries.data && Array.isArray(summaries.data)) {
      for (const daySummary of summaries.data) {
        const date = daySummary.range.date;
        const totalSeconds = daySummary.grand_total?.total_seconds || 0;
        
        // Store in database (will update if already exists)
        await storeDailyStats(env, userId, date, totalSeconds);
      }
      
      await logFetch(env, userId, 'weekly', endDate, 'success');
      console.log(`Successfully fetched week data for user ${userId}`);
    }
  } catch (error: any) {
    console.error('Error fetching week data:', error);
    await logFetch(env, userId, 'weekly', dates[dates.length - 1], 'error', error.message);
    throw error;
  }
}
