import { Env } from './types';
import { exchangeCodeForToken, fetchWakaTimeUser, fetchPhotoData } from './wakatime';
import { createOrUpdateUser, getLeaderboard, getWeeklyData, getAllUsers, deleteUser, banUser, unbanUser, getUserById, getLastSyncTime, getUserTooltipStats, getCompareStats, upsertUserPhoto } from './database';
import { createSession, verifySession, deleteSession, extractSessionId } from './session';
import { fetchDataForAllUsers, fetchTodayDataForUser, fetchWeekDataForUser, fetchTodayDataForAllUsers, fetchWeekDataForAllUsers, fetchPhotosForAllUsers } from './fetcher';
import { getProfileData } from './profile';

/**
 * Main Cloudflare Worker
 * Handles all API routes and scheduled tasks
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

// CORS headers for frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: any, status = 200, cacheSeconds = 0) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...corsHeaders,
  };
  
  if (cacheSeconds > 0) {
    // Cache for specified seconds with stale-while-revalidate
    headers['Cache-Control'] = `public, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`;
  }
  
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

/**
 * Rewrite a stored WakaTime/Gravatar photo URL to our own photo endpoint so
 * the browser never pings WakaTime for avatars. Photos are served from D1.
 */
function photoUrlFor(request: Request, userId: number, url: string | null): string | null {
  if (!url) return null;
  const origin = new URL(request.url).origin;
  return `${origin}/api/user/${userId}/photo?v=2`;
}

/**
 * Deterministic SVG avatar fallback (hue + initial) served when a user has a
 * photo URL but no stored image bytes yet - avoids broken <img> tags.
 */
function placeholderPhoto(username: string): Response {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const initial = (username.charAt(0) || '?').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue},60%,44%)"/><stop offset="100%" stop-color="hsl(${(hue + 40) % 360},60%,32%)"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/><text x="48" y="61" font-family="Inter,Arial,sans-serif" font-size="40" font-weight="700" fill="rgba(255,255,255,0.94)" text-anchor="middle">${initial}</text></svg>`;
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
      ...corsHeaders,
    },
  });
}

export default {
  /**
   * Scheduled cron handler - runs the daily sync (which refreshes per-day
   * stats for all users plus their all-time lifetime totals).
   */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(fetchDataForAllUsers(env));
  },

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Attach context to env for background tasks
    env.ctx = ctx;
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Public routes
      if (path === '/api/auth/login') {
        // Redirect to WakaTime OAuth
        const authUrl = new URL('https://wakatime.com/oauth/authorize');
        authUrl.searchParams.set('client_id', env.WAKATIME_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', env.WAKATIME_REDIRECT_URI);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'email,read_stats,read_logged_time');

        return Response.redirect(authUrl.toString(), 302);
      }

      if (path === '/api/auth/callback') {
        // OAuth callback - exchange code for token
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        // Check for OAuth errors from WakaTime
        if (error) {
          const redirectUrl = new URL(env.FRONTEND_URL || 'https://wakalead.pages.dev');
          redirectUrl.pathname = '/login';
          redirectUrl.searchParams.set('error', error);
          return Response.redirect(redirectUrl.toString(), 302);
        }
        
        if (!code) {
          const redirectUrl = new URL(env.FRONTEND_URL || 'https://wakalead.pages.dev');
          redirectUrl.pathname = '/login';
          redirectUrl.searchParams.set('error', 'Missing authorization code');
          return Response.redirect(redirectUrl.toString(), 302);
        }

        try {
          // Exchange code for tokens
          const tokenData = await exchangeCodeForToken(env, code);
          
          // Fetch user profile
          const wakaUser = await fetchWakaTimeUser(tokenData.access_token);

          // Create or update user in database
          const user = await createOrUpdateUser(env, {
            wakatime_id: wakaUser.id,
            username: wakaUser.username,
            display_name: wakaUser.display_name,
            email: wakaUser.email,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: tokenData.expires_in ? Date.now() + (parseInt(tokenData.expires_in) * 1000) : null,
            photo_url: wakaUser.photo,
          });

          // Download + store the avatar bytes so the browser never hits
          // WakaTime for photos. Failure never blocks login.
          try {
            const photo = await fetchPhotoData(wakaUser.photo);
            if (photo) await upsertUserPhoto(env, user.id, photo.data, photo.mime);
          } catch (error: any) {
            console.error('Error storing photo for user:', error?.message);
          }

          // Check if user is banned
          if (user.is_banned) {
            const redirectUrl = new URL(env.FRONTEND_URL || 'https://wakalead.pages.dev');
            redirectUrl.pathname = '/login';
            redirectUrl.searchParams.set('error', 'Your account has been restricted by an administrator');
            return Response.redirect(redirectUrl.toString(), 302);
          }

          // Create session
          const sessionId = await createSession(env, user.id, user.wakatime_id);

          // Fetch today's data if not already fetched
          try {
            await fetchTodayDataForUser(env, user.id, user.access_token);
          } catch (error) {
            console.error('Error fetching initial data:', error);
          }

          // Redirect to frontend with session
          const redirectUrl = new URL(env.FRONTEND_URL || env.WAKATIME_REDIRECT_URI);
          redirectUrl.pathname = '/';
          redirectUrl.searchParams.set('session', sessionId);
          
          return Response.redirect(redirectUrl.toString(), 302);
        } catch (error: any) {
          console.error('OAuth callback error:', error);
          // Redirect to frontend with error
          const redirectUrl = new URL(env.FRONTEND_URL || 'https://wakalead.pages.dev');
          redirectUrl.pathname = '/login';
          redirectUrl.searchParams.set('error', error.message || 'Authentication failed');
          return Response.redirect(redirectUrl.toString(), 302);
        }
      }

      if (path === '/api/auth/logout') {
        const sessionId = extractSessionId(request);
        if (sessionId) {
          await deleteSession(env, sessionId);
        }
        return jsonResponse({ success: true });
      }

      if (path === '/api/auth/delete-account' && request.method === 'DELETE') {
        const user = await verifySession(env, request);
        if (!user) {
          return errorResponse('Not authenticated', 401);
        }

        // Delete the user's account
        await deleteUser(env, user.id);
        
        // Delete session
        const sessionId = extractSessionId(request);
        if (sessionId) {
          await deleteSession(env, sessionId);
        }

        return jsonResponse({ success: true, message: 'Account deleted' });
      }

      if (path === '/api/auth/me') {
        // Get current user
        const user = await verifySession(env, request);
        if (!user) {
          return errorResponse('Not authenticated', 401);
        }

        return jsonResponse({
          id: user.id,
          wakatime_id: user.wakatime_id,
          username: user.username,
          display_name: user.display_name,
          photo_url: photoUrlFor(request, user.id, user.photo_url),
          is_admin: user.is_admin === 1,
        });
      }

      // Dashboard endpoint - public, optional authentication
      if (path === '/api/dashboard') {
        // Try to get authenticated user (optional)
        const user = await verifySession(env, request).catch(() => null);
        
        const today = formatDate(getNepalDate());
        const metric = (url.searchParams.get('metric') as 'total' | 'human' | 'ai' | 'lines') || 'total';
        
        // Generate last 7 days dates
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const nepalNow = getNepalDate();
          nepalNow.setUTCDate(nepalNow.getUTCDate() - i);
          dates.push(formatDate(nepalNow));
        }
        const weekStart = dates[0]; // 7 days ago
        const weekEnd = dates[dates.length - 1]; // today

        // Fetch all data in parallel
        const [todayLeaderboard, weekLeaderboard, weeklyData, lastSynced] = await Promise.all([
          getLeaderboard(env, today, today, metric, today),
          getLeaderboard(env, weekStart, weekEnd, metric, today),
          getWeeklyData(env, dates),
          getLastSyncTime(env),
        ]);

        return jsonResponse({
          user: user ? {
            id: user.id,
            wakatime_id: user.wakatime_id,
            username: user.username,
            display_name: user.display_name,
            photo_url: photoUrlFor(request, user.id, user.photo_url),
            is_admin: user.is_admin === 1,
          } : null,
          today: todayLeaderboard.map((e: any) => ({ ...e, photo_url: photoUrlFor(request, e.user_id, e.photo_url) })),
          week: weekLeaderboard.map((e: any) => ({ ...e, photo_url: photoUrlFor(request, e.user_id, e.photo_url) })),
          weeklyData: { dates, users: weeklyData.map((u: any) => ({ ...u, photo_url: photoUrlFor(request, u.user_id, u.photo_url) })) },
          lastSynced,
        }, 200, 0); // No browser caching - always fetch fresh data
      }

      // Hover-card stats for a single user - public, served from D1 only
      if (path.match(/^\/api\/user\/\d+\/stats$/)) {
        const userId = parseInt(path.split('/')[3]);
        const today = formatDate(getNepalDate());
        const stats = await getUserTooltipStats(env, userId, today);
        if (!stats) {
          return errorResponse('User not found', 404);
        }
        return jsonResponse({ ...stats, photo_url: photoUrlFor(request, stats.user_id, stats.photo_url) }, 200, 0);
      }

      // Compare stats for a single user - DB only, daily/weekly/all-time buckets
      if (path.match(/^\/api\/user\/\d+\/compare$/)) {
        const userId = parseInt(path.split('/')[3]);
        const today = formatDate(getNepalDate());
        const stats = await getCompareStats(env, userId, today);
        if (!stats) {
          return errorResponse('User not found', 404);
        }
        return jsonResponse({ ...stats, photo_url: photoUrlFor(request, stats.user_id, stats.photo_url) }, 200, 0);
      }

      // Avatar image - served from our DB so WakaTime is never pinged for
      // photos anywhere except the profile page's live data fetch.
      if (path.match(/^\/api\/user\/\d+\/photo$/)) {
        const userId = parseInt(path.split('/')[3]);
        const row = await env.DB.prepare(
          'SELECT data, mime FROM user_photos WHERE user_id = ?'
        ).bind(userId).first<{ data: ArrayBuffer; mime: string }>();

        if (!row) {
          const user = await env.DB.prepare(
            'SELECT username FROM users WHERE id = ?'
          ).bind(userId).first<{ username: string }>();
          return placeholderPhoto(user?.username || String(userId));
        }

        const raw: any = row.data;
        const bytes = typeof raw === 'string'
          ? Uint8Array.from(raw.split(',').map(Number))
          : new Uint8Array(raw);

        return new Response(bytes, {
          headers: {
            'Content-Type': row.mime || 'image/jpeg',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=3600',
            ...corsHeaders,
          },
        });
      }

      // Full public profile for a user - DB data + live WakaTime fetch
      if (path.match(/^\/api\/profile\/.+$/)) {
        const username = decodeURIComponent(path.slice('/api/profile/'.length)).replace(/^@/, '');
        const profile = await getProfileData(env, username);
        if (!profile) {
          return errorResponse('User not found', 404);
        }
        profile.user.photo_url = photoUrlFor(request, profile.user.user_id, profile.user.photo_url);
        profile.db.photo_url = photoUrlFor(request, profile.db.user_id, profile.db.photo_url);
        return jsonResponse(profile, 200, 0);
      }

      // Protected routes - require authentication
      const user = await verifySession(env, request);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }

      if (path === '/api/refresh-all' && request.method === 'POST') {
        // Refresh week's data for all users from WakaTime API
        // Only available to logged-in users
        try {
          await fetchWeekDataForAllUsers(env);
          return new Response(JSON.stringify({ success: true, message: 'Week data refreshed for all users' }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              ...corsHeaders,
            },
          });
        } catch (error: any) {
          return errorResponse('Error refreshing data: ' + error.message, 500);
        }
      }

      if (path === '/api/leaderboard/today') {
        // Today's leaderboard - just fetch from database
        const today = formatDate(getNepalDate());
        const metric = (url.searchParams.get('metric') as 'total' | 'human' | 'ai' | 'lines') || 'total';
        const leaderboard = await getLeaderboard(env, today, today, metric, today);
        return jsonResponse(leaderboard.map((e: any) => ({ ...e, photo_url: photoUrlFor(request, e.user_id, e.photo_url) })));
      }

      if (path === '/api/leaderboard/week') {
        // Last 7 days leaderboard - just fetch from database
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const nepalNow = getNepalDate();
          nepalNow.setUTCDate(nepalNow.getUTCDate() - i);
          dates.push(formatDate(nepalNow));
        }
        const start = dates[0];
        const end = dates[dates.length - 1];
        const metric = (url.searchParams.get('metric') as 'total' | 'human' | 'ai' | 'lines') || 'total';
        // Weekly board still carries per-user rank-one consistency/streak stats
        const today = formatDate(getNepalDate());
        const leaderboard = await getLeaderboard(env, start, end, metric, today);
        return jsonResponse(leaderboard.map((e: any) => ({ ...e, photo_url: photoUrlFor(request, e.user_id, e.photo_url) })));
      }

      if (path === '/api/weekly-data') {
        // Last 7 days data for chart - just fetch from database
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const nepalNow = getNepalDate();
          nepalNow.setUTCDate(nepalNow.getUTCDate() - i);
          dates.push(formatDate(nepalNow));
        }

        const weeklyData = await getWeeklyData(env, dates);
        return jsonResponse({ dates, users: weeklyData.map((u: any) => ({ ...u, photo_url: photoUrlFor(request, u.user_id, u.photo_url) })) });
      }

      // Admin routes
      if (path.startsWith('/api/admin/')) {
        if (user.is_admin !== 1) {
          return errorResponse('Forbidden: Admin access required', 403);
        }

        if (path === '/api/admin/users' && request.method === 'GET') {
          const users = await getAllUsers(env);
          return jsonResponse(users.map(u => ({
            id: u.id,
            wakatime_id: u.wakatime_id,
            username: u.username,
            display_name: u.display_name,
            email: u.email,
            photo_url: photoUrlFor(request, u.id, u.photo_url),
            is_admin: u.is_admin === 1,
            created_at: u.created_at,
          })));
        }

        if (path === '/api/admin/users' && request.method === 'POST') {
          // Add user manually (for admin)
          const body = await request.json() as any;
          
          // Validate required fields
          if (!body.wakatime_id || !body.username || !body.access_token) {
            return errorResponse('Missing required fields', 400);
          }

          const newUser = await createOrUpdateUser(env, {
            wakatime_id: body.wakatime_id,
            username: body.username,
            display_name: body.display_name,
            email: body.email,
            access_token: body.access_token,
            refresh_token: body.refresh_token,
            photo_url: body.photo_url,
          });

          return jsonResponse(newUser, 201);
        }

        if (path === '/api/admin/refresh-photos' && request.method === 'POST') {
          // Backfill/refresh all users' avatar bytes from WakaTime now
          await fetchPhotosForAllUsers(env);
          return jsonResponse({ success: true, message: 'Photo refresh completed' });
        }

        if (path.match(/^\/api\/admin\/users\/\d+$/) && request.method === 'DELETE') {
          const userId = parseInt(path.split('/').pop()!);
          await deleteUser(env, userId);
          return jsonResponse({ success: true });
        }

        if (path.match(/^\/api\/admin\/users\/\d+\/ban$/) && request.method === 'POST') {
          const userId = parseInt(path.split('/')[4]);
          await banUser(env, userId);
          return jsonResponse({ success: true, message: 'User banned' });
        }

        if (path.match(/^\/api\/admin\/users\/\d+\/unban$/) && request.method === 'POST') {
          const userId = parseInt(path.split('/')[4]);
          await unbanUser(env, userId);
          return jsonResponse({ success: true, message: 'User unbanned' });
        }

        if (path === '/api/admin/fetch-now') {
          // Trigger manual data fetch for today/yesterday, or an explicit
          // past date (e.g. to repair a day the cron missed).
          const dateParam = url.searchParams.get('date');
          if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            return errorResponse('Invalid date, expected YYYY-MM-DD', 400);
          }
          const useToday = url.searchParams.get('today') === 'true';
          await fetchDataForAllUsers(env, useToday, dateParam || undefined);
          return jsonResponse({ success: true, message: `Data fetch initiated for ${dateParam || (useToday ? 'today' : 'yesterday')}` });
        }
      }

      return errorResponse('Not found', 404);
    } catch (error: any) {
      console.error('Worker error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  },
};
