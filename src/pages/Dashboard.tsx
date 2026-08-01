import { useEffect, useRef, useState } from 'react';
import { api, API_BASE, User, LeaderboardEntry, WeeklyData, Metric, METRICS, formatRelativeTime, prefetchTooltipStats } from '../api';
import { Header } from '../components/Header';
import { Leaderboard } from '../components/Leaderboard';
import { WeeklyChart } from '../components/WeeklyChart';
import { AdminPanel } from '../components/AdminPanel';

/**
 * User dropdown - keeps the action bar clean. Account info, Reconnect,
 * Logout, and the destructive Delete Account live here instead of as loose
 * buttons next to Sync.
 */
function UserMenu({ user, onLogout, onDelete }: { user: User; onLogout: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open user menu"
        title="Account menu"
        className="relative flex-shrink-0 rounded-full hover:ring-2 hover:ring-blue-500/50 transition-shadow active:scale-95"
      >
        {user.photo_url ? (
          <img
            src={user.photo_url}
            alt={user.username}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200 dark:ring-zinc-700"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold ring-2 ring-slate-200 dark:ring-zinc-700">
            {(user.display_name || user.username).charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden animate-fadeInUp z-50">
          <div className="px-3.5 py-3 border-b border-slate-200 dark:border-zinc-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {user.display_name || user.username}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-500 truncate">@{user.username}</p>
          </div>
          <a
            href={`${API_BASE}/auth/login`}
            className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Reconnect to WakaTime
          </a>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Logout
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400 border-t border-slate-200 dark:border-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete Account
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Main dashboard page - Clean, professional design
 */
export function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [todayLeaderboard, setTodayLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weekLeaderboard, setWeekLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'week'>('today');
  const [metric, setMetric] = useState<Metric>('total');

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
      setLastSynced(data.lastSynced);

      // Warm the hover-card cache so tooltips are instant. On a forced sync
      // we refetch everything, otherwise just the stale/missing users.
      const userIds = [
        ...data.today.map((e: LeaderboardEntry) => e.user_id),
        ...data.week.map((e: LeaderboardEntry) => e.user_id),
      ];
      void prefetchTooltipStats(userIds, forceRefresh);
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
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-zinc-800 animate-shimmer" />
                <div className="space-y-2">
                  <div className="w-32 h-4 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
                  <div className="w-24 h-3 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
                </div>
              </div>
            </div>
            {/* Skeleton for leaderboard */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-4 p-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 animate-shimmer" />
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800 animate-shimmer" />
                    <div className="flex-1 space-y-2">
                      <div className="w-32 h-4 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
                      <div className="w-24 h-3 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
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
            {user && (
              <>
                <div className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl" title={lastSynced ? `Last successful sync: ${new Date(lastSynced).toLocaleString()}` : 'No successful sync yet'}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">Last synced:</span>
                  <span className="font-medium text-slate-700 dark:text-zinc-300">
                    {lastSynced ? formatRelativeTime(lastSynced) : 'never'}
                  </span>
                </div>

                <button
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:border-slate-300 dark:hover:border-zinc-700 transition-colors active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  {refreshing ? 'Syncing...' : 'Sync'}
                </button>

                <UserMenu user={user} onLogout={handleLogout} onDelete={handleDeleteAccount} />
              </>
            )}

            {!user && (
              <a
                href={`${API_BASE}/auth/login`}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Join Leaderboard
              </a>
            )}
          </div>
        </div>

        {/* Leaderboard Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-6">
          {/* Tabs + Metric Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center border-b border-slate-200 dark:border-zinc-800">
            <div className="flex flex-1">
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

            {/* Metric selector */}
            <div className="flex items-center gap-0.5 p-2 sm:pr-4 border-t sm:border-t-0 border-slate-200 dark:border-zinc-800">
              <span className="hidden md:inline text-xs font-medium text-slate-400 dark:text-zinc-600 mr-2">
                Rank by
              </span>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5">
                {METRICS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMetric(m.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      metric === m.value
                        ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-4 sm:p-6">
            <Leaderboard
              title=""
              entries={activeTab === 'today' ? todayLeaderboard : weekLeaderboard}
              metric={metric}
              loading={loading}
            />
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="mb-6">
          <WeeklyChart data={weeklyData} metric={metric} onMetricChange={setMetric} loading={loading} />
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
