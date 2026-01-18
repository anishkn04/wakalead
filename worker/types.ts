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
  fetched_at: number;
}

export interface LeaderboardEntry {
  user_id: number;
  username: string;
  display_name: string | null;
  photo_url: string | null;
  total_seconds: number;
  rank: number;
}

export interface WeeklyData {
  user_id: number;
  username: string;
  display_name: string | null;
  daily_data: {
    date: string;
    seconds: number;
  }[];
}
