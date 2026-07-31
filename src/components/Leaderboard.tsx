import { useState, useEffect, useMemo } from 'react';
import { LeaderboardEntry, Metric, getMetricValue, formatMetric, formatDuration } from '../api';
import { Confetti } from './Confetti';
import { useSound } from '../hooks/useSound';

interface LeaderboardProps {
  title: string;
  entries: LeaderboardEntry[];
  metric?: Metric;
  loading?: boolean;
}

/**
 * Leaderboard component - Clean, professional design with preserved roasts
 */
export function Leaderboard({ title, entries, metric = 'total', loading }: LeaderboardProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [animatedEntries, setAnimatedEntries] = useState<number[]>([]);
  const { playSound } = useSound();

  // Re-rank entries by the selected metric (e.g. Human, AI, AI Lines)
  const rankedEntries = useMemo(() => {
    return entries
      .map((entry) => ({
        ...entry,
        metricValue: getMetricValue(entry, metric),
      }))
      .sort((a, b) => b.metricValue - a.metricValue)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }, [entries, metric]);

  // Trigger confetti when there's a #1 with significant activity
  useEffect(() => {
    if (rankedEntries.length > 0) {
      const topValue = rankedEntries[0]?.metricValue ?? 0;
      const threshold = metric === 'lines' ? 500 : 3600;
      if (topValue > threshold) {
        const timer = setTimeout(() => {
          setShowConfetti(true);
          playSound('success');
          setTimeout(() => setShowConfetti(false), 3500);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [rankedEntries, metric, playSound]);

  // Staggered animation for entries
  useEffect(() => {
    setAnimatedEntries([]);
    rankedEntries.forEach((entry, index) => {
      setTimeout(() => {
        setAnimatedEntries(prev => [...prev, entry.user_id]);
        if (index < 3) {
          playSound('pop');
        }
      }, index * 60);
    });
  }, [rankedEntries, playSound]);

  // Helper function to randomly select a message from an array
  const randomMessage = (messages: string[]): string => {
    return messages[Math.floor(Math.random() * messages.length)];
  };

  // ========================================
  // ROAST MESSAGES - ALL PRESERVED
  // ========================================
  const getStatusMessage = (rank: number, totalEntries: number, totalSeconds: number, isAdmin?: boolean, dailySeconds?: number): string => {
    const hours = totalSeconds / 3600;
    const dailyHours = dailySeconds ? dailySeconds / 3600 : 0;

    // Top ranks with variety
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

    // Admin in last place gets special message
    if (isAdmin && rank === totalEntries) {
      return "Aaja dai le rest garchha";
    }

    // Bottom performers get roasted
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

    // High daily but low weekly (came out of hiding)
    if (dailyHours > 3 && hours < 5) {
      return randomMessage([
        "aaja ta ghaam laagechha ta! ☀️",
        "finally awake! 🌅",
        "hibernation khatam? 🐻",
        "comeback mode activated 💪"
      ]);
    }

    // Nepali roast for low rank but on leaderboard
    if (rank > totalEntries * 0.7 && hours > 0) {
      return randomMessage([
        "timi ni coder banne hora? 🤨",
        "ke garirako bro? 🤔",
        "chal aaja try garna 💻",
        "kaam chai ali kam vayo 😅"
      ]);
    }

    // Messages based on time ranges
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
    rankedEntries.forEach(entry => {
      messages[entry.user_id] = getStatusMessage(entry.rank, rankedEntries.length, entry.total_seconds, entry.is_admin);
    });
    return messages;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankedEntries]);

  // Get status badge style based on message type
  const getStatusStyle = (rank: number, totalSeconds: number): string => {
    const hours = totalSeconds / 3600;
    if (rank <= 3 && hours > 0) return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400';
    if (hours >= 3) return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400';
    if (hours === 0 || totalSeconds < 60) return 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400';
    return 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400';
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 animate-pulse" />
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="w-32 h-4 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="w-24 h-3 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="w-16 h-4 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Confetti celebration for top performer */}
      <Confetti trigger={showConfetti} />
      
      {title && (
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          {title}
          {rankedEntries.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </h2>
      )}
      
      {rankedEntries.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-zinc-500">No data available</p>
        </div>
      ) : (
        <div className="space-y-1">
          {rankedEntries.map((entry) => {
            const hasZeroValue = entry.metricValue === 0;
            const isAdmin = entry.is_admin === true;
            const isTop3 = entry.rank <= 3;
            const isAnimated = animatedEntries.includes(entry.user_id);
            const maxValue = rankedEntries[0]?.metricValue || 1;
            const humanPct = entry.total_seconds > 0 ? (entry.human_seconds / entry.total_seconds) * 100 : 0;
            const aiPct = entry.total_seconds > 0 ? (entry.ai_seconds / entry.total_seconds) * 100 : 0;
            
            return (
              <div
                key={entry.user_id}
                className={`
                  flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl transition-all duration-200
                  ${isTop3 && !hasZeroValue ? 'bg-slate-50 dark:bg-zinc-800/50' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/30'}
                  ${hasZeroValue ? 'opacity-50' : ''}
                  ${isAnimated ? 'animate-fadeInUp' : 'opacity-0'}
                `}
                style={{ animationFillMode: 'forwards' }}
              >
                {/* Rank Badge */}
                <div className={`
                  flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm
                  ${entry.rank === 1 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-amber-900 shadow-lg shadow-amber-400/30' : ''}
                  ${entry.rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700 shadow-lg shadow-slate-400/20' : ''}
                  ${entry.rank === 3 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-800 shadow-lg shadow-orange-400/20' : ''}
                  ${entry.rank > 3 ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500' : ''}
                `}>
                  {entry.rank === 1 ? '👑' : entry.rank}
                </div>

                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {entry.photo_url ? (
                    <img
                      src={entry.photo_url}
                      alt={entry.username}
                      className={`w-10 h-10 rounded-full object-cover ${entry.rank === 1 ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''}`}
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm ${entry.rank === 1 ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''}`}>
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Online indicator for top 3 */}
                  {isTop3 && entry.metricValue > 0 && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900" />
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-medium text-sm truncate ${entry.rank === 1 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                      {entry.display_name || entry.username}
                    </p>
                    {entry.rank === 1 && <span className="flame text-sm">🔥</span>}
                    {entry.rank === 2 && <span className="text-sm">⚡</span>}
                    {entry.rank === 3 && <span className="text-sm">✨</span>}
                    {isAdmin && (
                      <span className="text-[10px] font-mono font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-500 truncate">
                    @{entry.username}
                  </p>
                  {/* Roast Message Badge */}
                  <span className={`inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${getStatusStyle(entry.rank, entry.total_seconds)}`}>
                    {statusMessages[entry.user_id]}
                  </span>
                  {/* AI vs Human split bar */}
                  {entry.total_seconds > 0 && (
                    <div className="mt-2 max-w-[220px]">
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-700">
                        <div className="bg-blue-500" style={{ width: `${humanPct}%` }} />
                        <div className="bg-violet-500" style={{ width: `${aiPct}%` }} />
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-500">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block flex-shrink-0" />
                          <span className="tabular-nums">Human {formatDuration(entry.human_seconds)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-violet-500 inline-block flex-shrink-0" />
                          <span className="tabular-nums">AI {formatDuration(entry.ai_seconds)}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Metric Value */}
                <div className="text-right flex-shrink-0">
                  <p className={`font-semibold text-sm tabular-nums ${
                    entry.rank === 1 ? 'text-amber-700 dark:text-amber-400' :
                    entry.rank === 2 ? 'text-slate-600 dark:text-slate-300' :
                    entry.rank === 3 ? 'text-orange-600 dark:text-orange-400' :
                    'text-slate-700 dark:text-zinc-300'
                  }`}>
                    {formatMetric(entry.metricValue, metric)}
                  </p>
                  {/* Progress bar for top 3 */}
                  {isTop3 && (
                    <div className="w-16 h-1 bg-slate-200 dark:bg-zinc-700 rounded-full mt-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          entry.rank === 1 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                          entry.rank === 2 ? 'bg-gradient-to-r from-slate-400 to-slate-500' :
                          'bg-gradient-to-r from-orange-400 to-orange-500'
                        }`}
                        style={{ 
                          width: `${Math.min(100, (entry.metricValue / maxValue) * 100)}%`,
                        }}
                      />
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
