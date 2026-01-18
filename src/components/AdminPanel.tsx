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
  const [fetchingData, setFetchingData] = useState(false);
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

  const handleTriggerFetch = async () => {
    if (!confirm('This will fetch data for all users. Continue?')) {
      return;
    }

    try {
      setFetchingData(true);
      setMessage('Fetching data for all users...');
      await api.triggerFetch();
      setMessage('Data fetch completed successfully!');
      setTimeout(() => setMessage(''), 5000);
    } catch (error: any) {
      setMessage('Error fetching data: ' + error.message);
    } finally {
      setFetchingData(false);
    }
  };

  if (!currentUser.is_admin) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Admin Panel
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage users and data fetching
          </p>
        </div>
        
        <button
          onClick={handleTriggerFetch}
          disabled={fetchingData}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
        >
          {fetchingData ? 'Fetching...' : 'Fetch Data Now'}
        </button>
      </div>

      {message && (
        <div className={`
          mb-4 p-3 rounded-lg text-sm
          ${message.includes('Error') || message.includes('error')
            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
            : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
          }
        `}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {user.photo_url ? (
                  <img
                    src={user.photo_url}
                    alt={user.username}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.display_name || user.username}
                    {user.is_admin && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                        Admin
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    @{user.username} • ID: {user.wakatime_id}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDelete(user.id, user.username)}
                disabled={user.is_admin}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
