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
  days_at_rank_one?: number;     // Total days at rank 1 (consistency)
  weeks_at_rank_one?: number;    // Total weeks at rank 1 (consistency)
  day_streak?: number;           // Current consecutive days at rank 1
  week_streak?: number;          // Current consecutive weeks at rank 1
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

/** Per-day breakdown captured from one WakaTime summary day */
export interface DayBreakdown {
  date: string;
  timeRows: { kind: string; name: string; seconds: number }[];
  modelRows: { name: string; lines: number; cost: number }[];
  aiDaily: {
    input_tokens: number;
    output_tokens: number;
    sessions: number;
    prompt_events: number;
  };
}

/** One aggregated breakdown entry for the tooltip (name + total + share %) */
export interface StatBreakdown {
  name: string;
  seconds: number;
  percent: number;
}

/** Full payload served by GET /api/user/:id/stats (hover card data) */
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
  languages: StatBreakdown[];
  editors: StatBreakdown[];
  operating_systems: StatBreakdown[];
  projects: StatBreakdown[];
  machines: StatBreakdown[];
  ai_models: { name: string; lines: number; cost: number }[];
  ai_tokens: { input: number; output: number; sessions: number; prompt_events: number };
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

/** Payload served by GET /api/user/:id/compare (DB-only comparison data) */
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
