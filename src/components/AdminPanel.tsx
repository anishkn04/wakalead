import { useState, useEffect } from 'react';
import { api, User, SeasonInfo } from '../api';

interface AdminPanelProps {
  currentUser: User;
}

/**
 * Admin panel - only visible to admin users
 * Allows managing users and triggering manual data fetches
 */
export function AdminPanel({ currentUser }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [backfillDate, setBackfillDate] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
  const [showSeasonConfirm, setShowSeasonConfirm] = useState(false);
  const [seasonConfirmText, setSeasonConfirmText] = useState('');
  const [resettingSeason, setResettingSeason] = useState(false);

  useEffect(() => {
    loadUsers();
    loadSeasonInfo();
  }, []);

  const loadSeasonInfo = async () => {
    try {
      const info = await api.getSeasonInfo();
      setSeasonInfo(info);
    } catch (error: any) {
      console.error('Error loading season info:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (error: any) {
      console.error('Error loading users:', error);
      setMessage('Error loading users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user ${username}?`)) {
      return;
    }

    try {
      await api.deleteUser(userId);
      setMessage(`User ${username} deleted successfully`);
      await loadUsers();
    } catch (error: any) {
      setMessage('Error deleting user: ' + error.message);
    }
  };

  const handleBan = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to ban user ${username}? They won't be able to log in.`)) {
      return;
    }

    try {
      await api.banUser(userId);
      setMessage(`User ${username} has been banned`);
      await loadUsers();
    } catch (error: any) {
      setMessage('Error banning user: ' + error.message);
    }
  };

  const handleUnban = async (userId: number, username: string) => {
    try {
      await api.unbanUser(userId);
      setMessage(`User ${username} has been unbanned`);
      await loadUsers();
    } catch (error: any) {
      setMessage('Error unbanning user: ' + error.message);
    }
  };

  const handleBackfill = async () => {
    if (!backfillDate) return;
    try {
      setBackfilling(true);
      await api.backfillDate(backfillDate);
      setMessage(`Backfill triggered for ${backfillDate} - re-synced stats and recomputed the leaderboard/streaks for that date`);
    } catch (error: any) {
      setMessage('Error backfilling date: ' + error.message);
    } finally {
      setBackfilling(false);
    }
  };

  const handleResetSeason = async () => {
    if (seasonConfirmText !== 'RESET') return;
    try {
      setResettingSeason(true);
      const result = await api.resetSeason();
      setMessage(`Season ${result.archivedSeason} archived - leaderboard, streaks, and daily stats now start fresh from this week. Accounts, photos, and everyone's real WakaTime lifetime totals are untouched.`);
      setShowSeasonConfirm(false);
      setSeasonConfirmText('');
      await loadSeasonInfo();
    } catch (error: any) {
      setMessage('Error resetting season: ' + error.message);
    } finally {
      setResettingSeason(false);
    }
  };

  if (!currentUser.is_admin) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Admin Panel
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-500 mt-1">
          Manage users
        </p>
      </div>

      <div className="mb-6 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl">
        <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
          Backfill a date
        </p>
        <p className="text-xs text-slate-500 dark:text-zinc-500 mb-3">
          Re-syncs stats and recomputes the leaderboard/streaks for one past date - use this if the daily cron ever missed a day.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={backfillDate}
            onChange={(e) => setBackfillDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white"
          />
          <button
            onClick={handleBackfill}
            disabled={!backfillDate || backfilling}
            className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {backfilling ? 'Backfilling...' : 'Backfill'}
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl">
        <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
          Start a new season {seasonInfo ? `(currently season ${seasonInfo.currentSeason})` : ''}
        </p>
        <p className="text-xs text-slate-500 dark:text-zinc-500 mb-3">
          Archives all daily stats, leaderboard rankings, and streaks under a "season {seasonInfo?.currentSeason ?? '?'}" table set, then starts everyone at zero. Nothing is deleted - archived data stays in the database. Accounts, photos, and everyone's real WakaTime lifetime total are not affected.
        </p>

        {!showSeasonConfirm ? (
          <button
            onClick={() => setShowSeasonConfirm(true)}
            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40 rounded-lg transition-colors"
          >
            Start New Season...
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-red-700 dark:text-red-400">
              Type RESET to confirm archiving season {seasonInfo?.currentSeason ?? '?'} and starting fresh:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={seasonConfirmText}
                onChange={(e) => setSeasonConfirmText(e.target.value)}
                placeholder="RESET"
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white"
              />
              <button
                onClick={handleResetSeason}
                disabled={seasonConfirmText !== 'RESET' || resettingSeason}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {resettingSeason ? 'Resetting...' : 'Confirm Reset'}
              </button>
              <button
                onClick={() => { setShowSeasonConfirm(false); setSeasonConfirmText(''); }}
                disabled={resettingSeason}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {seasonInfo && seasonInfo.history.length > 0 && (
          <p className="text-xs text-slate-400 dark:text-zinc-600 mt-3">
            Past resets: {seasonInfo.history.map(h => `season ${h.season_number} on ${new Date(h.archived_at).toLocaleDateString()}`).join(', ')}
          </p>
        )}
      </div>

      {message && (
        <div className={`
          mb-4 p-3 rounded-xl text-sm
          ${message.includes('Error') || message.includes('error')
            ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900'
            : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
          }
        `}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl">
              <div className="w-10 h-10 bg-slate-200 dark:bg-zinc-700 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-1/3 animate-pulse" />
                <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-1/4 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl"
            >
              <div className="flex items-center gap-3">
                {user.photo_url ? (
                  <img
                    src={user.photo_url}
                    alt={user.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                
                <div>
                  <p className="font-medium text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                    {user.display_name || user.username}
                    {user.is_admin && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 rounded-full">
                        Admin
                      </span>
                    )}
                    {user.is_banned && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-full">
                        Banned
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-zinc-500">
                    @{user.username} • ID: {user.wakatime_id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {user.is_banned ? (
                  <button
                    onClick={() => handleUnban(user.id, user.username)}
                    disabled={user.is_admin}
                    className="px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Unban
                  </button>
                ) : (
                  <button
                    onClick={() => handleBan(user.id, user.username)}
                    disabled={user.is_admin}
                    className="px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Ban
                  </button>
                )}

                <button
                  onClick={() => handleDelete(user.id, user.username)}
                  disabled={user.is_admin}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
