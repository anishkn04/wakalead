// Cloudflare Worker Types
export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  WAKATIME_CLIENT_ID: string;
  WAKATIME_CLIENT_SECRET: string;
  WAKATIME_REDIRECT_URI: string;
  FRONTEND_URL: string;
  SESSION_SECRET: string;
  ADMIN_WAKATIME_ID: string;
  ctx?: ExecutionContext;
}

export interface User {
  id: number;
  wakatime_id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: number | null;
  photo_url: string | null;
  is_admin: boolean;
  is_banned: boolean;
  created_at: number;
  updated_at: number;
}

export interface DailyStats {
  id: number;
  user_id: number;
  date: string;
  total_seconds: number;
  ai_seconds: number;
  human_seconds: number;
  ai_lines: number;
  human_lines: number;
  fetched_at: number;
}

/** Parsed per-day summary extracted from the WakaTime summaries API */
export interface DailySummaryStats {
  total_seconds: number;
  ai_seconds: number;
  human_seconds: number;
  ai_lines: number;
  human_lines: number;
}

/** Aggregated per-user metadata used for personalized comments */
export interface UserStats {
  user_id: number;
  top_language: string | null;
  top_editor: string | null;
  top_project: string | null;
  all_time_seconds: number;
  updated_at: number;
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

export interface WeeklyData {
  user_id: number;
  username: string;
  display_name: string | null;
  daily_data: {
    date: string;
    seconds: number;
    ai_seconds: number;
    human_seconds: number;
    ai_lines: number;
    human_lines: number;
  }[];
}
