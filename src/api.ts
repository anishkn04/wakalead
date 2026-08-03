// API configuration
export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Types
export interface User {
  id: number;
  wakatime_id: string;
  username: string;
  display_name: string | null;
  photo_url: string | null;
  is_admin: boolean;
  is_banned: boolean;
}

export interface LeaderboardEntry {
  user_id: number;
  username: string;
  display_name: string | null;
  photo_url: string | null;
  total_seconds: number;
  ai_seconds: number;
  human_seconds: number;
  ai_lines: number;
  human_lines: number;
  all_time_seconds?: number;
  top_language?: string | null;
  top_editor?: string | null;
  top_project?: string | null;
  rank: number;
  is_admin?: boolean;
}

/** Metric used to rank / display coding activity */
export type Metric = 'total' | 'human' | 'ai' | 'lines';

/** Labeled metric options for UI controls */
export const METRICS: { value: Metric; label: string }[] = [
  { value: 'total', label: 'All' },
  { value: 'human', label: 'Human' },
  { value: 'ai', label: 'AI' },
  { value: 'lines', label: 'AI Lines' },
];

export interface WeeklyData {
  dates: string[];
  users: {
    user_id: number;
    username: string;
    display_name: string | null;
    photo_url: string | null;
    daily_data: {
      date: string;
      seconds: number;
      ai_seconds: number;
      human_seconds: number;
      ai_lines: number;
      human_lines: number;
    }[];
  }[];
}

/** One aggregated breakdown entry (name + total seconds + share %) */
export interface TooltipStatBreakdown {
  name: string;
  seconds: number;
  percent: number;
}

/** Full hover-card payload from GET /api/user/:id/stats */
export interface TooltipStats {
  user_id: number;
  username: string;
  display_name: string | null;
  photo_url: string | null;
  is_admin: boolean;
  created_at: number;
  all_time_seconds: number;
  top_language: string | null;
  top_editor: string | null;
  top_project: string | null;
  aggregates: {
    total_seconds: number;
    ai_seconds: number;
    human_seconds: number;
    ai_lines: number;
    human_lines: number;
    days_tracked: number;
    days_active: number;
    best_day: { date: string; seconds: number } | null;
    current_streak: number;
    longest_streak: number;
    today_seconds: number;
    yesterday_seconds: number;
    delta_percent: number | null;
    week: { date: string; seconds: number }[];
  };
  languages: TooltipStatBreakdown[];
  editors: TooltipStatBreakdown[];
  operating_systems: TooltipStatBreakdown[];
  projects: TooltipStatBreakdown[];
  machines: TooltipStatBreakdown[];
  ai_models: { name: string; lines: number; cost: number }[];
  ai_tokens: { input: number; output: number; sessions: number; prompt_events: number };
}

/** Live WakaTime data fetched server-side for the profile page (best-effort). */
export interface ProfileLiveData {
  ok: boolean;
  error: string | null;
  fetchedAt: number | null;
  me: Record<string, any> | null;
  stats: Record<string, any> | null;
  allTimeSinceToday: Record<string, any> | null;
}

export interface ProfileUser {
  user_id: number;
  wakatime_id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  photo_url: string | null;
  is_admin: boolean;
  created_at: number;
}

export interface ProfileDailyRow {
  date: string;
  total_seconds: number;
  ai_seconds: number;
  human_seconds: number;
  ai_lines: number;
  human_lines: number;
}

/** Period-aggregated totals (daily / weekly / all-time) for the compare table */
export interface CompareAggregates {
  total_seconds: number;
  human_seconds: number;
  ai_seconds: number;
  human_lines: number;
  ai_lines: number;
  total_lines: number;
}

/** Full payload from GET /api/user/:id/compare (DB-only comparison data) */
export interface CompareStats {
  user_id: number;
  username: string;
  display_name: string | null;
  photo_url: string | null;
  daily: CompareAggregates;
  weekly: CompareAggregates;
  all_time: CompareAggregates;
  all_time_wakatime: number;
  days_tracked: number;
  days_active: number;
  active_pct: number;
  current_streak: number;
  longest_streak: number;
  best_day: { date: string; seconds: number } | null;
  ai_tokens: { input: number; output: number; sessions: number; prompt_events: number };
  top_ai_model: string | null;
  ai_model_lines: number;
  ai_model_cost: number;
  top_language: string | null;
  top_editor: string | null;
  top_project: string | null;
}

/** Full profile payload from GET /api/profile/:username */
export interface ProfileData {
  user: ProfileUser;
  db: TooltipStats & { daily: ProfileDailyRow[] };
  live: ProfileLiveData;
}

// Session management
export function getSession(): string | null {
  return localStorage.getItem('session');
}

export function setSession(sessionId: string): void {
  localStorage.setItem('session', sessionId);
}

export function clearSession(): void {
  localStorage.removeItem('session');
}

// API client
class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const session = getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (session) {
      headers['Authorization'] = `Bearer ${session}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
    clearSession();
  }

  async deleteSelf(): Promise<void> {
    await this.request('/auth/delete-account', { method: 'DELETE' });
    clearSession();
  }

  async getTodayLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.request<LeaderboardEntry[]>('/leaderboard/today');
  }

  async getWeekLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.request<LeaderboardEntry[]>('/leaderboard/week');
  }

  async getWeeklyData(): Promise<WeeklyData> {
    return this.request<WeeklyData>('/weekly-data');
  }

  async getDashboard(): Promise<{
    user: User | null;
    today: LeaderboardEntry[];
    week: LeaderboardEntry[];
    weeklyData: WeeklyData;
    lastSynced: number | null;
  }> {
    return this.request('/dashboard');
  }

  async getUserStats(userId: number): Promise<TooltipStats> {
    return this.request<TooltipStats>(`/user/${userId}/stats`);
  }

  async getCompareStats(userId: number): Promise<CompareStats> {
    return this.request<CompareStats>(`/user/${userId}/compare`);
  }

  async getProfile(username: string): Promise<ProfileData> {
    return this.request<ProfileData>(`/profile/${encodeURIComponent(username)}`);
  }

  // Admin endpoints
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/admin/users');
  }

  async deleteUser(userId: number): Promise<void> {
    await this.request(`/admin/users/${userId}`, { method: 'DELETE' });
  }

  async banUser(userId: number): Promise<void> {
    await this.request(`/admin/users/${userId}/ban`, { method: 'POST' });
  }

  async unbanUser(userId: number): Promise<void> {
    await this.request(`/admin/users/${userId}/unban`, { method: 'POST' });
  }

  async triggerFetch(today = true): Promise<void> {
    await this.request(`/admin/fetch-now?today=${today}`, { method: 'POST' });
  }

  async refreshAll(): Promise<void> {
    await this.request('/refresh-all', { method: 'POST' });
  }
}

export const api = new ApiClient();

// Browser-persisted cache for hover-card stats so re-hovers (and hovers on
// a fresh page load) are instant. Refreshed in the background after syncs.
const TOOLTIP_CACHE_KEY = 'wakalead:tooltip:v2';
const TOOLTIP_TTL_MS = 6 * 60 * 60 * 1000;

interface CachedTooltip {
  ts: number;
  stats: TooltipStats;
}

const tooltipStatsCache = new Map<number, CachedTooltip>();
const pendingTooltipFetches = new Map<number, Promise<TooltipStats>>();

function readTooltipCache(): void {
  try {
    const raw = localStorage.getItem(TOOLTIP_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedTooltip>;
    for (const [id, entry] of Object.entries(parsed)) {
      if (entry && entry.stats && typeof entry.ts === 'number') {
        tooltipStatsCache.set(Number(id), entry);
      }
    }
  } catch {
    // Corrupted or unavailable storage - start fresh
  }
}
readTooltipCache();

function persistTooltipCache(): void {
  try {
    const snapshot: Record<string, CachedTooltip> = {};
    for (const [id, entry] of tooltipStatsCache) snapshot[String(id)] = entry;
    localStorage.setItem(TOOLTIP_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full or blocked - cache just stays in-memory this session
  }
}

function fetchAndCache(userId: number): Promise<TooltipStats> {
  const inFlight = pendingTooltipFetches.get(userId);
  if (inFlight) return inFlight;
  const promise = api.getUserStats(userId).then((stats) => {
    tooltipStatsCache.set(userId, { ts: Date.now(), stats });
    persistTooltipCache();
    return stats;
  });
  pendingTooltipFetches.set(userId, promise);
  void promise.finally(() => pendingTooltipFetches.delete(userId));
  return promise;
}

export async function getUserStats(userId: number): Promise<TooltipStats> {
  const cached = tooltipStatsCache.get(userId);
  if (cached) return cached.stats;
  return fetchAndCache(userId);
}

/** Warm the hover-card cache for many users in the background. */
export async function prefetchTooltipStats(userIds: number[], force = false): Promise<void> {
  const targets = [...new Set(userIds)].filter((id) => {
    if (force) return true;
    const cached = tooltipStatsCache.get(id);
    return !cached || Date.now() - cached.ts > TOOLTIP_TTL_MS;
  });
  const BATCH = 5;
  for (let i = 0; i < targets.length; i += BATCH) {
    await Promise.all(targets.slice(i, i + BATCH).map(fetchAndCache));
  }
}

// Utility functions
export function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${rounded}s`;
}

export function formatLines(lines: number): string {
  const value = Math.max(0, Math.round(lines));
  if (value >= 1000) {
    const k = (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1);
    return `${k}k`;
  }
  return `${value}`;
}

/** Get the value for a given metric from a leaderboard entry */
export function getMetricValue(entry: LeaderboardEntry, metric: Metric): number {
  switch (metric) {
    case 'human':
      return entry.human_seconds;
    case 'ai':
      return entry.ai_seconds;
    case 'lines':
      return entry.ai_lines;
    case 'total':
    default:
      return entry.total_seconds;
  }
}

/** Format a metric value with the right unit */
export function formatMetric(value: number, metric: Metric): string {
  if (metric === 'lines') {
    return formatLines(value);
  }
  return formatDuration(value);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.max(0, Math.floor(diff / 1000));

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
