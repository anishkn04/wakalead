import { useState, useEffect, useMemo } from 'react';
import { LeaderboardEntry, Metric, getMetricValue, formatMetric, formatDuration } from '../api';
import { Confetti } from './Confetti';
import { useSound } from '../hooks/useSound';
import {
  getRoast,
  computeBoardStats,
  getSeenMessages,
  rememberMessage,
  getBoardCache,
  setBoardCache,
  boardSignature,
  TONE_STYLES,
  TONE_LABELS,
  RoastResult,
} from '../roasts';

interface LeaderboardProps {
  title: string;
  entries: LeaderboardEntry[];
  metric?: Metric;
  loading?: boolean;
}

/**
 * Leaderboard component - clean, professional, roast engine powered
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

  // Roast engine - stable per-board messages.
  // Roasts are assigned once per "board signature" (metric + all numbers
  // that can affect a roast) and persisted, so they only change when a
  // real sync brings new data, not on reloads or tab switches.
  const roastState = useMemo(() => {
    const signature = boardSignature(metric, rankedEntries);
    const cached = getBoardCache();
    if (cached && cached.signature === signature) {
      return cached;
    }

    const minMean = metric === 'lines' ? 500 : 3600;
    const board = computeBoardStats(
      rankedEntries.map((e) => e.metricValue),
      minMean
    );

    const results: Record<number, RoastResult> = {};
    const usedTexts = new Set<string>();
    rankedEntries.forEach((entry) => {
      results[entry.user_id] = getRoast(
        {
          user_id: entry.user_id,
          rank: entry.rank,
          totalEntries: rankedEntries.length,
          totalSeconds: entry.total_seconds,
          humanSeconds: entry.human_seconds,
          aiSeconds: entry.ai_seconds,
          aiLines: entry.ai_lines,
          humanLines: entry.human_lines,
          allTimeSeconds: entry.all_time_seconds,
          topLanguage: entry.top_language,
          topEditor: entry.top_editor,
          topProject: entry.top_project,
          isAdmin: entry.is_admin,
          metric,
          board,
        },
        getSeenMessages(entry.user_id),
        usedTexts
      );
    });

    const next = { signature, results, board };
    setBoardCache(next);
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankedEntries, metric]);

  // Persist chosen messages so they don't repeat on subsequent loads
  useEffect(() => {
    Object.entries(roastState.results).forEach(([userId, result]) => {
      rememberMessage(Number(userId), result.text);
    });
  }, [roastState]);

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

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 animate-shimmer" />
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800 animate-shimmer" />
            <div className="flex-1 space-y-2">
              <div className="w-32 h-4 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
              <div className="w-24 h-3 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
            </div>
            <div className="w-16 h-4 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
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
        <div className="text-center py-14">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-zinc-500 font-medium">No data available yet</p>
          <p className="text-sm text-slate-400 dark:text-zinc-600 mt-1">
            Hit <span className="font-medium">Sync</span> to pull today's coding stats.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {rankedEntries.map((entry) => {
            const roast = roastState.results[entry.user_id];
            const hasZeroValue = entry.metricValue === 0;
            const isAdmin = entry.is_admin === true;
            const isTop3 = entry.rank <= 3;
            const isAnimated = animatedEntries.includes(entry.user_id);
            const maxValue = rankedEntries[0]?.metricValue || 1;
            const humanPct = entry.total_seconds > 0 ? (entry.human_seconds / entry.total_seconds) * 100 : 0;
            const aiPct = entry.total_seconds > 0 ? (entry.ai_seconds / entry.total_seconds) * 100 : 0;
            const toneStyle = roast ? TONE_STYLES[roast.tone] : '';

            return (
              <div
                key={entry.user_id}
                className={`
                  group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl transition-all duration-200
                  ${isTop3 && !hasZeroValue ? 'bg-slate-50 dark:bg-zinc-800/50' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/30'}
                  ${hasZeroValue ? 'opacity-60' : ''}
                  ${isAnimated ? 'animate-fadeInUp' : 'opacity-0'}
                `}
                style={{ animationFillMode: 'forwards' }}
              >
                {/* Rank Badge */}
                <div className={`
                  flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-transform duration-200 group-hover:scale-105
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
                      loading="lazy"
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
                  {roast && (
                    <span
                      className={`inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${toneStyle}`}
                      title={`status: ${TONE_LABELS[roast.tone]}`}
                    >
                      {roast.text}
                    </span>
                  )}
                  {/* AI vs Human split bar */}
                  {entry.total_seconds > 0 && (
                    <div className="mt-2 max-w-[240px]">
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-700">
                        <div className="bg-blue-500 transition-all duration-500" style={{ width: `${humanPct}%` }} />
                        <div className="bg-violet-500 transition-all duration-500" style={{ width: `${aiPct}%` }} />
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-500">
                        <span className="flex items-center gap-1 tabular-nums">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block flex-shrink-0" />
                          <span>Human {formatDuration(entry.human_seconds)}</span>
                        </span>
                        <span className="flex items-center gap-1 tabular-nums">
                          <span className="w-2 h-2 rounded-full bg-violet-500 inline-block flex-shrink-0" />
                          <span>AI {formatDuration(entry.ai_seconds)}</span>
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
                  {/* Progress bar for all entries */}
                  <div className="w-16 h-1 bg-slate-200 dark:bg-zinc-700 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        entry.rank === 1 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                        entry.rank === 2 ? 'bg-gradient-to-r from-slate-400 to-slate-500' :
                        entry.rank === 3 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                        'bg-slate-400/60 dark:bg-zinc-600'
                      }`}
                      style={{ width: `${Math.max(hasZeroValue ? 0 : 4, Math.min(100, (entry.metricValue / maxValue) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
