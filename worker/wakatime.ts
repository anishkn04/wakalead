import { Env, User } from './types';

const WAKATIME_API_BASE = 'https://wakatime.com/api/v1';

/**
 * WakaTime OAuth: Exchange authorization code for tokens
 */
export async function exchangeCodeForToken(
  env: Env,
  code: string
): Promise<any> {
  const params = new URLSearchParams({
    client_id: env.WAKATIME_CLIENT_ID,
    client_secret: env.WAKATIME_CLIENT_SECRET,
    redirect_uri: env.WAKATIME_REDIRECT_URI,
    grant_type: 'authorization_code',
    code,
  });
  
  console.log('Exchanging code for token...');
  
  const response = await fetch('https://wakatime.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const responseText = await response.text();
  console.log('WakaTime response status:', response.status);

  if (!response.ok) {
    console.error('WakaTime token exchange failed:', response.status, responseText);
    throw new Error(`Failed to exchange code for token: ${response.status}`);
  }

  // Parse URL-encoded response (WakaTime returns form data, not JSON)
  const tokenData = Object.fromEntries(new URLSearchParams(responseText));
  console.log('Token received, access_token length:', tokenData.access_token?.length || 0);
  
  return tokenData;
}

/**
 * Fetch user profile from WakaTime
 */
export async function fetchWakaTimeUser(accessToken: string): Promise<any> {
  const response = await fetch(`${WAKATIME_API_BASE}/users/current`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch WakaTime user');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch summaries for a specific date range
 * Returns total seconds coded for the date
 */
export async function fetchWakaTimeSummaries(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<any> {
  const response = await fetch(
    `${WAKATIME_API_BASE}/users/current/summaries?start=${startDate}&end=${endDate}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch WakaTime summaries');
  }

  return response.json();
}

/**
 * Helper to calculate total seconds from summary data
 */
export function calculateTotalSeconds(summaries: any[]): number {
  return summaries.reduce((total, day) => {
    return total + (day.grand_total?.total_seconds || 0);
  }, 0);
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  env: Env,
  refreshToken: string
): Promise<any> {
  const response = await fetch('https://wakatime.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.WAKATIME_CLIENT_ID,
      client_secret: env.WAKATIME_CLIENT_SECRET,
      redirect_uri: env.WAKATIME_REDIRECT_URI,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh access token');
  }

  // Parse URL-encoded response
  const responseText = await response.text();
  return Object.fromEntries(new URLSearchParams(responseText));
}
