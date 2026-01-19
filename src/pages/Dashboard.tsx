import { useEffect, useState } from 'react';
import { api, API_BASE, User, LeaderboardEntry, WeeklyData } from '../api';
import { Header } from '../components/Header';
import { Leaderboard } from '../components/Leaderboard';
import { WeeklyChart } from '../components/WeeklyChart';
import { AdminPanel } from '../components/AdminPanel';
import { ParticleBackground } from '../components/ParticleBackground';
import { PulsingDot } from '../components/Animations';

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
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'week'>('today');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
        // Trigger WakaTime API fetch for all users
        await api.refreshAll();
      } else {
        setLoading(true);
      }
      
      // Load all dashboard data from database
      const data = await api.getDashboard();
      
      setUser(data.user);
      setTodayLeaderboard(data.today);
      setWeekLeaderboard(data.week);
      setWeeklyData(data.weeklyData);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Error loading data:', error);
      // Don't redirect - allow viewing without login
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    if (!confirm('This will permanently delete all your data. Are you absolutely sure?')) {
      return;
    }

    try {
      await api.deleteSelf();
      alert('Your account has been deleted.');
      window.location.href = '/login';
    } catch (error: any) {
      alert('Error deleting account: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-shimmer" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg animate-shimmer" />
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg animate-shimmer" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Header with refresh button - only for logged in users */}
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            {lastUpdated && (
              <>
                <PulsingDot color="bg-green-500" />
                <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              </>
            )}
          </div>
          {user && (
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono spotlight-hover group"
            >
              {refreshing ? (
                <span className="terminal-loader"></span>
              ) : (
                <>
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4 group-hover:rotate-180 transition-transform duration-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>Refresh</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* User info / Join button */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up">
          {user ? (
            <div className="flex items-center space-x-3 group">
              <div className="relative">
                {user.photo_url ? (
                  <img
                    src={user.photo_url}
                    alt={user.username}
                    className="w-12 h-12 rounded-full ring-2 ring-transparent group-hover:ring-blue-500 transition-all duration-300"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-lg group-hover:scale-110 transition-transform duration-300">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse"></span>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">
                  {user.display_name || user.username}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  @{user.username}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3 animate-float" style={{ animationDuration: '4s' }}>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white animate-pulse">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Viewing as Guest
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Join to appear on the leaderboard
                </p>
              </div>
            </div>
          )}
          
          {user ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDeleteAccount}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all hover:scale-105"
              >
                Delete Account
              </button>
              <button
                onClick={handleLogout}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all hover:scale-105"
              >
                Logout
              </button>
              <a
                href={`${API_BASE}/auth/login`}
                className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-xl text-xs sm:text-sm whitespace-nowrap spotlight-hover"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reconnect Account</span>
              </a>
            </div>
          ) : (
            <a
              href={`${API_BASE}/auth/login`}
              className="px-4 sm:px-6 py-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-xl text-sm sm:text-base whitespace-nowrap animate-gradient-border spotlight-hover"
            >
              🚀 Join Leaderboard
            </a>
          )}
        </div>

        {/* Leaderboard with tabs */}
        <div className="mb-6 animate-scale-pop" style={{ animationDelay: '100ms' }}>
          <div className={`bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden relative ${refreshing ? 'crt-flicker' : ''}`}>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('today')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === 'today'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                Today's Leaderboard
              </button>
              <button
                onClick={() => setActiveTab('week')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === 'week'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                This Week's Leaderboard
              </button>
            </div>
            
            {/* Content */}
            <div className="p-3 sm:p-6">
              {activeTab === 'today' ? (
                <Leaderboard
                  title=""
                  entries={todayLeaderboard}
                  loading={loading}
                />
              ) : (
                <Leaderboard
                  title=""
                  entries={weekLeaderboard}
                  loading={loading}
                />
              )}
            </div>
          </div>
        </div>

        {/* Weekly chart */}
        <div className="mb-6 animate-scale-pop" style={{ animationDelay: '200ms' }}>
          <WeeklyChart data={weeklyData} loading={loading} />
        </div>

        {/* Admin panel (only visible to admins) */}
        {user?.is_admin && (
          <div className="animate-scale-pop" style={{ animationDelay: '300ms' }}>
            <AdminPanel currentUser={user} />
          </div>
        )}

        {/* Fun footer */}
        <footer className="mt-12 text-center text-xs text-gray-400 dark:text-gray-500 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <p className="mb-1">Made with ❤️ and ☕ for coders who grind</p>
          <p>Keep coding, keep climbing 🚀</p>
        </footer>
      </main>
    </div>
  );
}
