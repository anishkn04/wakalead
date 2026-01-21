import { useState, useEffect, useMemo } from 'react';
import { LeaderboardEntry, formatDuration } from '../api';
import { Confetti } from './Confetti';
import { FlameEffect, PulsingDot } from './Animations';
import { useSound } from '../hooks/useSound';

interface LeaderboardProps {
  title: string;
  entries: LeaderboardEntry[];
  loading?: boolean;
}

/**
 * Leaderboard component - displays ranked users by coding time
 */
export function Leaderboard({ title, entries, loading }: LeaderboardProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [hoveredUser, setHoveredUser] = useState<number | null>(null);
  const [animatedEntries, setAnimatedEntries] = useState<number[]>([]);
  const { playSound } = useSound();

  // Trigger confetti when there's a #1 with significant time
  useEffect(() => {
    if (entries.length > 0 && entries[0]?.total_seconds > 3600) {
      // Small delay before confetti
      const timer = setTimeout(() => {
        setShowConfetti(true);
        playSound('success');
        setTimeout(() => setShowConfetti(false), 3500);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [entries, playSound]);

  // Staggered animation for entries
  useEffect(() => {
    setAnimatedEntries([]);
    entries.forEach((entry, index) => {
      setTimeout(() => {
        setAnimatedEntries(prev => [...prev, entry.user_id]);
        if (index < 3) {
          playSound('pop');
        }
      }, index * 80);
    });
  }, [entries, playSound]);

  // Helper function to randomly select a message from an array
  const randomMessage = (messages: string[]): string => {
    return messages[Math.floor(Math.random() * messages.length)];
  };

  // Enhanced status message with Hinglish/Nepali humor and conditional logic
  const getStatusMessageInternal = (rank: number, totalEntries: number, totalSeconds: number, isAdmin?: boolean, dailySeconds?: number): string => {
    const hours = totalSeconds / 3600;
    const dailyHours = dailySeconds ? dailySeconds / 3600 : 0;

    // PRESERVED LOGIC: Top ranks with variety
    if (rank === 1) {
      return randomMessage([
        "fucking crazy 🔥",
        "absolute beast mode 🦁",
        "kya baat hai bhai 💯",
        "pagal hai kya? 🤯",
        "unstoppable force 🚀",
        "touch some grass bro 🥬"
      ]);
    }
    
    if (rank === 2) {
      return randomMessage([
        "hacker hai bhai hacker 💻",
        "silver medal worthy 🥈",
        "almost there bro 👀",
        "solid number 2 💪",
        "runner-up king 👑"
      ]);
    }

    if (rank === 3) {
      return randomMessage([
        "solid grind bhai 💪",
        "bronze but golden 🥉",
        "respectable hustle 💼",
        "top 3 baby! 🎯",
        "podium finish 🏆"
      ]);
    }

    // SPECIAL: Admin in last place gets special message
    if (isAdmin && rank === totalEntries) {
      return "Aaja dai le rest garchha";
    }

    // PRESERVED LOGIC: Bottom performers get roasted
    const bottomPosition = totalEntries - rank + 1;
    
    if (bottomPosition === 1) {
      return randomMessage([
        "bhai ta maryo kya ho 💀",
        "laptop on toh hai? 💀",
        "extinct ho kya? 🦖",
        "are you alive? 👻",
        "sasura gayab nai 🫥",
        "neeche se first 1️⃣"
      ]);
    }
    
    if (bottomPosition === 2) {
      return randomMessage([
        "your routine: chai piyo, biscuit khao 🍪",
        "Tarak Mehta Kaa Ulta Chasma > Code? 📺",
        "biscuit break extended? 🍪",
        "nap time champion 😴",
        "professional procrastinator 🤡"
      ]);
    }
    
    if (bottomPosition === 3) {
      return randomMessage([
        "participation trophy lele 🏆",
        "attendance award 🎖️",
        "you showed up at least 👏",
        "E for Effort 📝",
        "consolation prize incoming 🎁"
      ]);
    }
    
    if (bottomPosition === 4) {
      return randomMessage([
        "aagle saal fir try karna 🤡",
        "better luck next time 🎲",
        "practice more bro 📚",
        "comeback season loading... 🔄",
        "tutorial hell escapee? 🌀"
      ]);
    }
    
    if (bottomPosition === 5) {
      return randomMessage([
        "at least you opened VSCode 😮‍💨",
        "startup time counts right? 🖥️",
        "extension installer pro 🧩",
        "theme customization expert 🎨",
        "README reader champion 📖"
      ]);
    }

    // NEW: Conditional Logic - High daily but low weekly (came out of hiding)
    if (dailyHours > 3 && hours < 5) {
      return randomMessage([
        "aaja ta ghaam laagechha ta! ☀️",
        "finally awake! 🌅",
        "hibernation khatam? 🐻",
        "comeback mode activated 💪"
      ]);
    }

    // NEW: Nepali roast for low rank but on leaderboard
    if (rank > totalEntries * 0.7 && hours > 0) {
      return randomMessage([
        "timi ni coder banne hora? 🤨",
        "ke garirako bro? 🤔",
        "chal aaja try garna 💻",
        "kaam chai ali kam vayo 😅"
      ]);
    }

    // NEW: Random messages based on time ranges
    if (hours === 0 || totalSeconds < 60) {
      return randomMessage([
        "Laptop ta khol bhai 💀",
        "Aaj ghumna jane ho?",
        "Chiya churot break? ☕",
        "Power button kasari press garne? 🔌",
        "PC crashed? 💥",
        "Internet kat-yo? 📡",
        "Are bhai code ta lekh 👀"
      ]);
    }

    if (hours < 1) {
      return randomMessage([
        "Hello World mai atkio?",
        "Warmup chalira cha?",
        "Just getting started? 🏃",
        "Compilation time? ⏳",
        "Installing dependencies? 📦",
        "Git clone running? 🐌"
      ]);
    }

    if (hours >= 1 && hours < 3) {
      return randomMessage([
        "Thikthak kaam 🔥",
        "Sahi ho, carry on",
        "Decent effort bro 👍",
        "Average enjoyer 📊",
        "Balanced lifestyle 🧘",
        "Moderate grinder 💼"
      ]);
    }

    if (hours >= 3 && hours < 6) {
      return randomMessage([
        "Khatra! 🚀",
        "Hacker hai bhai hacker",
        "Serious business 💼",
        "Dedicated developer 💪",
        "Flow state achieved 🌊",
        "Zone mai cha bro 🎯"
      ]);
    }

    if (hours >= 6) {
      return randomMessage([
        "Aakha futla hai bhai 👓",
        "Dev Manush (God Mode) 🙏",
        "Touch grass please 🌱",
        "Water piyo bro 💧",
        "Sleep optional? 😴",
        "Keyboard warrior 🎖️",
        "Code machine 🤖",
        "Bhai rest ni gara 🛌"
      ]);
    }
    
    return "keep grinding 🚀";
  };

  // Memoize status messages so they don't change on hover/re-render
  const statusMessages = useMemo(() => {
    const messages: Record<number, string> = {};
    entries.forEach(entry => {
      messages[entry.user_id] = getStatusMessageInternal(entry.rank, entries.length, entry.total_seconds, entry.is_admin);
    });
    return messages;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-6 relative">
      {/* Confetti celebration for top performer */}
      <Confetti trigger={showConfetti} />
      
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white flex items-center gap-2">
        {title}
        {entries.length > 0 && (
          <PulsingDot color="bg-green-500" className="ml-2" />
        )}
      </h2>
      
      {entries.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-6 sm:py-8 text-sm sm:text-base">No data available</p>
      ) : (
        <div className="space-y-1.5 sm:space-y-2">
          {entries.map((entry) => {
            const hasZeroTime = entry.total_seconds === 0;
            const isAdmin = entry.is_admin === true;
            const isLastPlace = entry.rank === entries.length;
            const isTop3 = entry.rank <= 3;
            const isHovered = hoveredUser === entry.user_id;
            const isAnimated = animatedEntries.includes(entry.user_id);
            
            // Elite styling for Top 3
            let eliteClasses = '';
            if (entry.rank === 1) {
              eliteClasses = 'rank-1-elite';
            } else if (entry.rank === 2) {
              eliteClasses = 'rank-2-elite';
            } else if (entry.rank === 3) {
              eliteClasses = 'rank-3-elite';
            }
            
            // Bottom styling - only for users with 0 coding time
            let bottomClasses = '';
            if (hasZeroTime) {
              bottomClasses = isLastPlace ? 'bottom-legacy last-place-static' : 'bottom-legacy';
            }
            
            return (
            <div
              key={entry.user_id}
              onMouseEnter={() => {
                setHoveredUser(entry.user_id);
                if (entry.rank <= 3) playSound('pop');
              }}
              onMouseLeave={() => setHoveredUser(null)}
              className={`
                flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 
                hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-all duration-300
                ${eliteClasses}
                ${bottomClasses}
                ${!isTop3 && !hasZeroTime ? 'glitch-random' : ''}
                ${isAnimated ? 'animate-fade-in-up' : 'opacity-0'}
                ${isHovered ? 'scale-[1.02] shadow-lg z-10' : ''}
                spotlight-hover cursor-pointer
              `}
              style={{ animationDelay: '0ms' }}
            >
              {/* Rank badge with animation */}
              <div className={`
                flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm
                transition-transform duration-300
                ${entry.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-white shadow-lg shadow-amber-500/30 animate-pulse-glow' : ''}
                ${entry.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-lg shadow-gray-400/30' : ''}
                ${entry.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30' : ''}
                ${entry.rank > 3 ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' : ''}
                ${isHovered ? 'scale-110' : ''}
              `}>
                {entry.rank === 1 ? '👑' : entry.rank}
              </div>

              {/* User avatar with hover effect */}
              <div className={`relative transition-transform duration-300 ${isHovered ? 'scale-110' : ''}`}>
                {entry.photo_url ? (
                  <img
                    src={entry.photo_url}
                    alt={entry.username}
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${entry.rank === 1 ? 'ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-gray-800' : ''}`}
                  />
                ) : (
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm sm:text-base ${entry.rank === 1 ? 'ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-gray-800' : ''}`}>
                    {entry.username.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Online indicator for top 3 */}
                {isTop3 && entry.total_seconds > 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></span>
                )}
              </div>

              {/* User info */}
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm sm:text-base truncate flex items-center gap-1.5 user-name ${
                  entry.rank === 1 ? 'glow-gold text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'
                }`}>
                  <span className={entry.rank === 1 ? 'animate-gradient-text font-bold' : ''}>{entry.display_name || entry.username}</span>
                  {entry.rank === 1 && <FlameEffect intensity="high" />}
                  {entry.rank === 2 && <FlameEffect intensity="medium" />}
                  {entry.rank === 3 && <FlameEffect intensity="low" />}
                  {isAdmin && (
                    <span className="text-[10px] font-mono bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-500/20 animate-pulse">
                      [ROOT@WAKALEAD ~]#
                    </span>
                  )}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                  @{entry.username}
                </p>
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mt-0.5 line-clamp-2 leading-tight">
                  {statusMessages[entry.user_id]}
                </p>
              </div>

              {/* Time with count-up animation on hover */}
              <div className="text-right flex-shrink-0">
                <p className={`font-semibold text-sm sm:text-base transition-all duration-300 ${
                  entry.rank === 1 ? 'text-amber-600 dark:text-amber-400 glow-gold' :
                  entry.rank === 2 ? 'text-gray-600 dark:text-gray-300' :
                  entry.rank === 3 ? 'text-orange-600 dark:text-orange-400' :
                  'text-gray-900 dark:text-white'
                } ${isHovered ? 'scale-110' : ''}`}>
                  {formatDuration(entry.total_seconds)}
                </p>
                {/* Progress bar for top 3 */}
                {isTop3 && entries[0] && (
                  <div className="w-16 sm:w-20 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        entry.rank === 1 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                        entry.rank === 2 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                        'bg-gradient-to-r from-orange-400 to-orange-600'
                      }`}
                      style={{ 
                        width: `${Math.min(100, (entry.total_seconds / entries[0].total_seconds) * 100)}%`,
                      }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
