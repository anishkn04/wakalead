import { useEffect, useState } from 'react';
import { api, API_BASE, User, LeaderboardEntry, WeeklyData } from '../api';
import { Header } from '../components/Header';
import { Leaderboard } from '../components/Leaderboard';
import { WeeklyChart } from '../components/WeeklyChart';
import { AdminPanel } from '../components/AdminPanel';

/**
 * Main dashboard page - Clean, professional design
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
        await api.refreshAll();
      } else {
        setLoading(true);
      }
      
      const data = await api.getDashboard();
      
      setUser(data.user);
      setTodayLeaderboard(data.today);
      setWeekLeaderboard(data.week);
      setWeeklyData(data.weeklyData);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Error loading data:', error);
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0b]">
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            {/* Skeleton for user section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                <div className="space-y-2">
                  <div className="w-32 h-4 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="w-24 h-3 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
              </div>
            </div>
            {/* Skeleton for leaderboard */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-4 p-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="w-32 h-4 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
                      <div className="w-24 h-3 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0b]">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* User Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="relative">
                {user.photo_url ? (
                  <img
                    src={user.photo_url}
                    alt={user.username}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-zinc-800 shadow-md"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg shadow-md">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {user.display_name || user.username}
                </p>
                <p className="text-sm text-slate-500 dark:text-zinc-500">
                  @{user.username}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Guest</p>
                <p className="text-sm text-slate-500 dark:text-zinc-500">Not logged in</p>
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {lastUpdated && (
              <span className="text-xs text-slate-400 dark:text-zinc-600 mr-2 hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            
            {user && (
              <>
                <button
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:border-slate-300 dark:hover:border-zinc-700 transition-colors disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  {refreshing ? 'Syncing...' : 'Sync'}
                </button>
                
                <button
                  onClick={handleDeleteAccount}
                  className="px-3.5 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                >
                  Delete
                </button>
                
                <button
                  onClick={handleLogout}
                  className="px-3.5 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  Logout
                </button>
              </>
            )}
            
            {!user ? (
              <a
                href={`${API_BASE}/auth/login`}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Join Leaderboard
              </a>
            ) : (
              <a
                href={`${API_BASE}/auth/login`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 rounded-xl transition-colors"
              >
                Reconnect
              </a>
            )}
          </div>
        </div>

        {/* Leaderboard Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-6">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab('today')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === 'today'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
              }`}
            >
              Today
              {activeTab === 'today' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('week')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === 'week'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
              }`}
            >
              This Week
              {activeTab === 'week' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4 sm:p-6">
            <Leaderboard
              title=""
              entries={activeTab === 'today' ? todayLeaderboard : weekLeaderboard}
              loading={loading}
            />
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="mb-6">
          <WeeklyChart data={weeklyData} loading={loading} />
        </div>

        {/* Admin Panel */}
        {user?.is_admin && (
          <div className="mb-6">
            <AdminPanel currentUser={user} />
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-8 border-t border-slate-200 dark:border-zinc-800 mt-8">
          <p className="text-sm text-slate-400 dark:text-zinc-600">
            Made with ❤️ for coders who grind
          </p>
        </footer>
      </main>
    </div>
  );
}
