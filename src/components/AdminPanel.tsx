import { useState, useEffect } from 'react';
import { api, User } from '../api';

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

  useEffect(() => {
    loadUsers();
  }, []);

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
