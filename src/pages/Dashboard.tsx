import { useEffect, useState } from 'react';
import { api, API_BASE, User, LeaderboardEntry, WeeklyData } from '../api';
import { Header } from '../components/Header';
import { Leaderboard } from '../components/Leaderboard';
import { WeeklyChart } from '../components/WeeklyChart';
import { AdminPanel } from '../components/AdminPanel';

/**
 * Main dashboard page
 * Shows today's leaderboard, weekly leaderboard, performance chart, and admin panel
 */
export function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [todayLeaderboard, setTodayLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weekLeaderboard, setWeekLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load user profile
      const userData = await api.getCurrentUser();
      setUser(userData);

      // Load all dashboard data in parallel
      const [today, week, weekly] = await Promise.all([
        api.getTodayLeaderboard(),
        api.getWeekLeaderboard(),
        api.getWeeklyData(),
      ]);

      setTodayLeaderboard(today);
      setWeekLeaderboard(week);
      setWeeklyData(weekly);
    } catch (error: any) {
      console.error('Error loading data:', error);
      if (error.message.includes('Not authenticated')) {
        // Redirect to login
        window.location.href = `${API_BASE}/auth/login`;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      window.location.reload();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User info and logout */}
        {user && (
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {user.photo_url ? (
                <img
                  src={user.photo_url}
                  alt={user.username}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-lg">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {user.display_name || user.username}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  @{user.username}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        )}

        {/* Leaderboards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Leaderboard
            title="🏆 Today's Leaderboard"
            entries={todayLeaderboard}
            loading={loading}
          />
          <Leaderboard
            title="📊 This Week's Leaderboard"
            entries={weekLeaderboard}
            loading={loading}
          />
        </div>

        {/* Weekly chart */}
        <div className="mb-6">
          <WeeklyChart data={weeklyData} loading={loading} />
        </div>

        {/* Admin panel (only visible to admins) */}
        {user?.is_admin && (
          <AdminPanel currentUser={user} />
        )}
      </main>
    </div>
  );
}
