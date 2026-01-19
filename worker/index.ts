import { Env } from './types';
import { exchangeCodeForToken, fetchWakaTimeUser } from './wakatime';
import { createOrUpdateUser, getLeaderboard, getWeeklyData, getAllUsers, deleteUser, banUser, unbanUser, getUserById } from './database';
import { createSession, verifySession, deleteSession, extractSessionId } from './session';
import { fetchDataForAllUsers, fetchTodayDataForUser, fetchWeekDataForUser, fetchTodayDataForAllUsers, fetchWeekDataForAllUsers } from './fetcher';

/**
 * Main Cloudflare Worker
 * Handles all API routes and scheduled tasks
 */

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

export default {
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
          photo_url: user.photo_url,
          is_admin: user.is_admin === 1,
        });
      }

      // Dashboard endpoint - public, optional authentication
      if (path === '/api/dashboard') {
        // Try to get authenticated user (optional)
        const user = await verifySession(env, request).catch(() => null);
        
        const today = new Date().toISOString().split('T')[0];
        
        // Generate last 7 days dates
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          dates.push(date.toISOString().split('T')[0]);
        }
        const weekStart = dates[0]; // 7 days ago
        const weekEnd = dates[dates.length - 1]; // today

        // Fetch all data in parallel
        const [todayLeaderboard, weekLeaderboard, weeklyData] = await Promise.all([
          getLeaderboard(env, today, today),
          getLeaderboard(env, weekStart, weekEnd),
          getWeeklyData(env, dates),
        ]);

        return jsonResponse({
          user: user ? {
            id: user.id,
            wakatime_id: user.wakatime_id,
            username: user.username,
            display_name: user.display_name,
            photo_url: user.photo_url,
            is_admin: user.is_admin === 1,
          } : null,
          today: todayLeaderboard,
          week: weekLeaderboard,
          weeklyData: { dates, users: weeklyData },
        }, 200, 0); // No browser caching - always fetch fresh data
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
        const today = new Date().toISOString().split('T')[0];
        const leaderboard = await getLeaderboard(env, today, today);
        return jsonResponse(leaderboard);
      }

      if (path === '/api/leaderboard/week') {
        // Last 7 days leaderboard - just fetch from database
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          dates.push(date.toISOString().split('T')[0]);
        }
        const start = dates[0];
        const end = dates[dates.length - 1];
        
        const leaderboard = await getLeaderboard(env, start, end);
        return jsonResponse(leaderboard);
      }

      if (path === '/api/weekly-data') {
        // Last 7 days data for chart - just fetch from database
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          dates.push(date.toISOString().split('T')[0]);
        }

        const weeklyData = await getWeeklyData(env, dates);
        return jsonResponse({ dates, users: weeklyData });
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
            photo_url: u.photo_url,
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
          // Trigger manual data fetch for today
          const useToday = url.searchParams.get('today') === 'true';
          await fetchDataForAllUsers(env, useToday);
          return jsonResponse({ success: true, message: `Data fetch initiated for ${useToday ? 'today' : 'yesterday'}` });
        }
      }

      return errorResponse('Not found', 404);
    } catch (error: any) {
      console.error('Worker error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  },
};
