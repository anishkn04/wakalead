import { useState, useEffect, useMemo } from 'react';
import { LeaderboardEntry, Metric, getMetricValue, getUserStats, TooltipStats } from '../api';
import { Confetti } from './Confetti';
import { useSound } from '../hooks/useSound';
import { StatsPanel } from './StatsPanel';
import { LeaderboardCard } from './LeaderboardCard';
import {
  getRoast,
  computeBoardStats,
  getSeenMessages,
  rememberMessage,
  getBoardCache,
  setBoardCache,
  boardSignature,
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

  // Accordion state - click a row to expand its stats inline (desktop + mobile)
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [expandedStats, setExpandedStats] = useState<TooltipStats | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const handleRowClick = (entry: LeaderboardEntry) => {
    if (expandedUserId === entry.user_id) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(entry.user_id);
    setExpandedLoading(true);
    setExpandedError(null);
    setExpandedStats(null);
    getUserStats(entry.user_id)
      .then((stats) => setExpandedStats(stats))
      .catch((err: Error) => setExpandedError(err.message))
      .finally(() => setExpandedLoading(false));
  };

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
            const isExpanded = expandedUserId === entry.user_id;

            return (
              <div key={entry.user_id} className="space-y-2">
                <LeaderboardCard
                  entry={entry}
                  metric={metric}
                  metricValue={entry.metricValue}
                  roast={roast}
                  expanded={isExpanded}
                  animated={animatedEntries.includes(entry.user_id)}
                  panelId={`lb-panel-${entry.user_id}`}
                  onToggleExpand={() => handleRowClick(entry)}
                />

                {/* Inline stats accordion (desktop + mobile) */}
                {isExpanded && (
                  <div id={`lb-panel-${entry.user_id}`}>
                    <StatsPanel
                      entry={entry}
                      stats={expandedStats}
                      loading={expandedLoading}
                      error={expandedError}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
