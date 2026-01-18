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
  rank: number;
}

export interface WeeklyData {
  dates: string[];
  users: {
    user_id: number;
    username: string;
    display_name: string | null;
    daily_data: {
      date: string;
      seconds: number;
    }[];
  }[];
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
  }> {
    return this.request('/dashboard');
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

  async triggerFetch(): Promise<void> {
    await this.request('/admin/fetch-now', { method: 'POST' });
  }
}

export const api = new ApiClient();

// Utility functions
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
