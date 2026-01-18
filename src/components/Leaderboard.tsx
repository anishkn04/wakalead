import { LeaderboardEntry, formatDuration } from '../api';

interface LeaderboardProps {
  title: string;
  entries: LeaderboardEntry[];
  loading?: boolean;
}

/**
 * Leaderboard component - displays ranked users by coding time
 */
export function Leaderboard({ title, entries, loading }: LeaderboardProps) {
  // Dynamic meme subtitles based on position (top vs bottom)
  const getSubtitle = (rank: number, totalEntries: number): string => {
    // Top performer gets praise
    if (rank === 1) {
      return "fucking crazy 🔥";
    }
    
    if (rank === 2) {
      return "hacker hai bhai hacker 💻";
    }

    // Bottom performers get roasted
    const bottomPosition = totalEntries - rank + 1;
    
    if (bottomPosition === 1) {
      // Absolute last
      return "laptop on toh hai? 💀";
    }
    
    if (bottomPosition === 2) {
      return "your routine: chai piyo, biscuit khao 🍪";
    }
    
    if (bottomPosition === 3) {
      return "participation trophy lele 🏆";
    }
    
    if (bottomPosition === 4) {
      return "aagle saal fir try karna 🤡";
    }
    
    if (bottomPosition === 5) {
      return "at least you opened VSCode 😅";
    }

    // Middle ranks - neutral/encouraging
    if (rank === 3) {
      return "solid grind bhai 💪";
    }
    
    return "keep grinding 🚀";
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white">{title}</h2>
        <div className="space-y-2 sm:space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 dark:bg-gray-600 rounded-full" />
              <div className="flex-1">
                <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-1 sm:mb-2" />
                <div className="h-2 sm:h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white">{title}</h2>
      
      {entries.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-6 sm:py-8 text-sm sm:text-base">No data available</p>
      ) : (
        <div className="space-y-1.5 sm:space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.user_id}
              className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {/* Rank badge */}
              <div className={`
                flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm
                ${entry.rank === 1 ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' : ''}
                ${entry.rank === 2 ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : ''}
                ${entry.rank === 3 ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' : ''}
                ${entry.rank > 3 ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' : ''}
              `}>
                {entry.rank}
              </div>

              {/* User avatar */}
              {entry.photo_url ? (
                <img
                  src={entry.photo_url}
                  alt={entry.username}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm sm:text-base">
                  {entry.username.charAt(0).toUpperCase()}
                </div>
              )}

              {/* User info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">
                  {entry.display_name || entry.username}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                  @{entry.username}
                </p>
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mt-0.5 line-clamp-2 leading-tight">
                  {getSubtitle(entry.rank, entries.length)}
                </p>
              </div>

              {/* Time */}
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">
                  {formatDuration(entry.total_seconds)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
