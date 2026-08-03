import { Env, User, DailySummaryStats, DayBreakdown } from './types';

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
 * Download a user's avatar image bytes (WakaTime photo or Gravatar) so it
 * can be stored in our DB and served without pinging WakaTime from the
 * browser. Returns null when the URL is missing or unreachable.
 */
export async function fetchPhotoData(
  url: string | null
): Promise<{ data: ArrayBuffer; mime: string } | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    const mime = contentType.startsWith('image/')
      ? contentType.split(';')[0].trim()
      : 'image/jpeg';
    const data = await response.arrayBuffer();
    if (!data.byteLength) return null;
    return { data, mime };
  } catch {
    return null;
  }
}

/**
 * Fetch a user's all-time stats breakdown from WakaTime
 * (languages, editors, operating systems, projects, categories,
 * dependencies, machines, labels + grand totals). Backed by their cached
 * stats; may return 202 while WakaTime is still computing them.
 */
export async function fetchWakaTimeAllTimeStats(accessToken: string): Promise<any> {
  const response = await fetch(
    `${WAKATIME_API_BASE}/users/current/stats/all_time`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch WakaTime all-time stats');
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
 * Parse a single day's summary into total / AI / human stats.
 *
 * WakaTime tracks AI coding in two ways:
 *  - The "ai coding" activity category (time spent with AI tools)
 *  - Line changes attributed to GenAI vs old-school typing
 *
 * Human time = total time minus AI coding time, matching WakaTime's own
 * "manual coding" definition.
 */
export function parseDailySummary(daySummary: any): DailySummaryStats {
  const grandTotal = daySummary?.grand_total || {};
  const totalSeconds = Math.round(grandTotal.total_seconds || 0);

  const aiCodingCategory = (daySummary?.categories || []).find(
    (category: any) => (category.name || '').toLowerCase() === 'ai coding'
  );
  const aiSeconds = Math.round(aiCodingCategory?.total_seconds || 0);

  return {
    total_seconds: totalSeconds,
    ai_seconds: aiSeconds,
    human_seconds: Math.max(0, totalSeconds - aiSeconds),
    ai_lines:
      Math.round(grandTotal.ai_additions || 0) +
      Math.round(grandTotal.ai_deletions || 0),
    human_lines:
      Math.round(grandTotal.human_additions || 0) +
      Math.round(grandTotal.human_deletions || 0),
  };
}

/** How many entries to keep per breakdown kind (keeps the table bounded). */
const BREAKDOWN_LIMITS: Record<string, number> = {
  language: 15,
  editor: 5,
  os: 5,
  project: 15,
  machine: 10,
};

/**
 * Extract per-day breakdowns from one WakaTime summary day: top languages /
 * editors / operating systems / projects / machines by seconds, plus AI model
 * usage (from grand_total.ai_model_breakdown) and AI token/session totals.
 *
 * Reuses data the fetcher already downloads - zero extra API requests.
 */
export function collectDayBreakdowns(daySummary: any): {
  timeRows: { kind: string; name: string; seconds: number }[];
  modelRows: { name: string; lines: number; cost: number }[];
  aiDaily: DayBreakdown['aiDaily'];
} {
  const timeRows: { kind: string; name: string; seconds: number }[] = [];
  const kinds: Array<[string, string]> = [
    ['language', 'languages'],
    ['editor', 'editors'],
    ['os', 'operating_systems'],
    ['project', 'projects'],
    ['machine', 'machines'],
  ];

  for (const [kind, apiKey] of kinds) {
    const list = Array.isArray(daySummary?.[apiKey]) ? daySummary[apiKey] : [];
    const top = [...list]
      .filter((item: any) => item && item.name)
      .sort((a: any, b: any) => (b.total_seconds || 0) - (a.total_seconds || 0))
      .slice(0, BREAKDOWN_LIMITS[kind]);
    for (const item of top) {
      timeRows.push({
        kind,
        name: item.name,
        seconds: Math.round(item.total_seconds || 0),
      });
    }
  }

  const modelRows: { name: string; lines: number; cost: number }[] = [];
  const models = Array.isArray(daySummary?.grand_total?.ai_model_breakdown)
    ? daySummary.grand_total.ai_model_breakdown
    : [];
  for (const m of [...models]
    .sort((a: any, b: any) => (b.lines || 0) - (a.lines || 0))
    .slice(0, 10)) {
    if (m && m.name) {
      modelRows.push({
        name: m.name,
        lines: Math.round(m.lines || 0),
        cost: m.cost || 0,
      });
    }
  }

  const grand = daySummary?.grand_total || {};
  const aiDaily = {
    input_tokens: Math.round(grand.ai_input_tokens || 0),
    output_tokens: Math.round(grand.ai_output_tokens || 0),
    sessions: Math.round(grand.ai_sessions || 0),
    prompt_events: Math.round(grand.ai_prompt_events_total || 0),
  };

  return { timeRows, modelRows, aiDaily };
}

/** Returns the most-active entry by seconds from a WakaTime breakdown array. */
function topEntry(
  breakdown: any[] | undefined,
  key: 'name'
): string | null {
  if (!Array.isArray(breakdown) || breakdown.length === 0) return null;
  const top = breakdown.reduce((best, item) =>
    (item.total_seconds || 0) > (best.total_seconds || 0) ? item : best,
    breakdown[0]
  );
  return top?.[key] || null;
}

/**
 * Aggregate the top language / editor / project across a batch of day
 * summaries (e.g. the 7 days returned by a weekly summaries call).
 * Reuses data the fetcher already downloads - no extra API requests.
 */
export function parseTopStats(
  daySummaries: any[]
): { topLanguage: string | null; topEditor: string | null; topProject: string | null } {
  const byField: Record<'topLanguage' | 'topEditor' | 'topProject', any[]> = {
    topLanguage: [],
    topEditor: [],
    topProject: [],
  };

  const fieldMap: Array<[keyof typeof byField, string]> = [
    ['topLanguage', 'languages'],
    ['topEditor', 'editors'],
    ['topProject', 'projects'],
  ];

  for (const day of daySummaries) {
    if (!day) continue;
    for (const [field, apiKey] of fieldMap) {
      const list = day[apiKey];
      if (Array.isArray(list)) byField[field].push(...list);
    }
  }

  return {
    topLanguage: topEntry(byField.topLanguage, 'name'),
    topEditor: topEntry(byField.topEditor, 'name'),
    topProject: topEntry(byField.topProject, 'name'),
  };
}

/**
 * Fetch the user's all-time coding seconds (since account creation).
 * Lightweight endpoint, gated by fetch_log to respect rate limits.
 */
export async function fetchAllTimeSinceToday(
  accessToken: string
): Promise<number> {
  const response = await fetch(
    `${WAKATIME_API_BASE}/users/current/all_time_since_today`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch all-time stats');
  }

  const data = await response.json();
  return Math.round(data?.data?.total_seconds || 0);
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
