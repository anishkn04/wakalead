import { useState } from 'react';
import { LeaderboardEntry, Metric, formatMetric, formatDuration } from '../api';
import { RoastResult, TONE_STYLES, TONE_LABELS } from '../roasts';

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  metric: Metric;
  metricValue: number;
  roast: RoastResult | undefined;
  expanded: boolean;
  animated: boolean;
  panelId: string;
  onToggleExpand: () => void;
}

const RANK_CHIP: Record<number, string> = {
  1: 'bg-gradient-to-br from-amber-400 to-amber-500 text-amber-900',
  2: 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700',
  3: 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-800',
};

const RANK_EMOJI: Record<number, string> = {
  1: '🔥',
  2: '⚡',
  3: '✨',
};

/**
 * One leaderboard row. Uses the `.lb-*` grid in index.css: a single horizontal
 * row on desktop (rank | avatar | identity | metric | chevron) that reflows into
 * five stacked zones (identity, roast, metric, split) below the 480px breakpoint.
 * Clicking anywhere on the row toggles the inline stats accordion.
 */
export function LeaderboardCard({
  entry,
  metric,
  metricValue,
  roast,
  expanded,
  animated,
  panelId,
  onToggleExpand,
}: LeaderboardCardProps) {
  const rank = entry.rank;
  const isTop3 = rank <= 3;
  const isAdmin = entry.is_admin === true;
  const hasZeroValue = metricValue === 0;
  const [photoFailed, setPhotoFailed] = useState(false);
  const toneStyle = roast ? TONE_STYLES[roast.tone] : '';
  const tierClass = rank === 1 ? 'lb-text-1' : rank === 2 ? 'lb-text-2' : rank === 3 ? 'lb-text-3' : 'lb-text-n';

  const totalSeconds = entry.total_seconds > 0 ? entry.total_seconds : 0;
  const humanPct = totalSeconds > 0 ? (entry.human_seconds / totalSeconds) * 100 : 0;
  const aiPct = totalSeconds > 0 ? (entry.ai_seconds / totalSeconds) * 100 : 0;
  const metricLabel = metric === 'lines' ? 'lines' : metric === 'total' ? 'total' : metric;

  // Streak fire: show when rank is 1 AND streak > 1
  const showStreakFire = rank === 1 && (entry.rank_one_streak || 0) > 1;
  const streakCount = entry.rank_one_streak || 0;

  // Consistency: total days at rank 1
  const daysAtRankOne = entry.days_at_rank_one || 0;
  const consistencyText = daysAtRankOne > 0
    ? daysAtRankOne >= 7
      ? `${Math.floor(daysAtRankOne / 7)}w`
      : `${daysAtRankOne}d`
    : '';

  return (
    <div
      onClick={onToggleExpand}
      className={`
        lb-row group p-3 card:p-4 rounded-xl transition-all duration-200
        cursor-pointer select-none touch-manipulation
        ${isTop3 && !hasZeroValue ? 'bg-slate-50 dark:bg-zinc-800/50' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/30'}
        ${hasZeroValue ? 'opacity-60' : ''}
        ${animated ? 'animate-fadeInUp' : 'opacity-0'}
      `}
      style={{ animationFillMode: 'forwards' }}
    >
      {/* Zone A — rank */}
      <div
        className={`lb-rank flex-shrink-0 w-10 h-10 card:w-8 card:h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-transform duration-200 group-hover:scale-105 ${
          RANK_CHIP[rank] ?? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500'
        }`}
        role="img"
        aria-label={`Rank ${rank}`}
      >
        {rank === 1 ? '👑' : rank}
        {showStreakFire && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0 rounded-full leading-none min-w-[18px] text-center">
            🔥 {streakCount}
          </span>
        )}
      </div>

      {/* Zone A — avatar + online dot */}
      <div className="lb-avatar relative flex-shrink-0">
        {entry.photo_url && !photoFailed ? (
          <img
            src={entry.photo_url}
            alt={entry.display_name || entry.username}
            loading="lazy"
            draggable={false}
            onError={() => setPhotoFailed(true)}
            className={`w-11 h-11 card:w-10 card:h-10 rounded-full object-cover ${
              rank === 1
                ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900'
                : ''
            }`}
          />
        ) : (
          <span
            className={`inline-flex w-11 h-11 card:w-10 card:h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center text-white font-semibold text-sm ${
              rank === 1
                ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900'
                : ''
            }`}
          >
            {entry.username.charAt(0).toUpperCase()}
          </span>
        )}
        {isTop3 && metricValue > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900" />
        )}
      </div>

      {/* Identity column — meta + roast + split. Wrapped so desktop keeps a
          vertical column; below 480px `display: contents` lifts the three
          children into the card grid as full-width zones. */}
      <div className="lb-identity flex flex-col min-w-0">
        {/* Zone A — identity (name + handle + inline badges) */}
        <div className="lb-meta min-w-0">
          <p className={`text-base card:text-sm font-semibold leading-tight break-words [overflow-wrap:anywhere] line-clamp-2 ${
            rank === 1 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'
          }`}>
            {entry.display_name || entry.username}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] card:text-xs font-medium text-slate-500 dark:text-zinc-500 min-w-0 [overflow-wrap:anywhere]">
              @{entry.username}
            </span>
            {RANK_EMOJI[rank] && <span className="text-sm" aria-hidden="true">{RANK_EMOJI[rank]}</span>}
            {isAdmin && (
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                ADMIN
              </span>
            )}
            {consistencyText && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 whitespace-nowrap">
                {consistencyText} at #1
              </span>
            )}
          </div>
        </div>

        {/* Zone B — roast: rounded rectangle, low-chroma tint, clamped until expanded */}
        {roast && (
          <div
            className={`lb-roast min-w-0 text-left rounded-xl border px-3.5 py-2.5 text-[13px] leading-[1.4] font-medium break-words card:px-2 card:py-1 card:rounded-lg card:text-[11px] card:leading-normal card:mt-2 ${toneStyle} ${
              expanded ? '' : 'line-clamp-3'
            }`}
            title={`status: ${TONE_LABELS[roast.tone]}`}
          >
            {roast.text}
          </div>
        )}

        {/* Zones D + E — single split bar + legend */}
        <div className="lb-split min-w-0 card:mt-2 card:max-w-[240px]">
          <div
            className="flex h-2 card:h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-700"
            role="img"
            aria-label={`Human ${formatDuration(entry.human_seconds)}, AI ${formatDuration(entry.ai_seconds)}`}
          >
            <div className="bg-[var(--lb-human)] transition-all duration-500" style={{ width: `${humanPct}%` }} />
            <div className="bg-[var(--lb-ai)] transition-all duration-500" style={{ width: `${aiPct}%` }} />
          </div>
          <div className="mt-1.5 card:mt-1 grid grid-cols-2 gap-x-4 card:flex card:items-center card:gap-3">
            <div className="flex items-center gap-1.5 whitespace-nowrap min-w-0 text-[11px] text-slate-500 dark:text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-[var(--lb-human)] flex-shrink-0" aria-hidden="true" />
              <span className="font-medium">Human</span>
              <span className="ml-auto card:ml-1 font-semibold tabular-nums">{formatDuration(entry.human_seconds)}</span>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap min-w-0 text-[11px] text-slate-500 dark:text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-[var(--lb-ai)] flex-shrink-0" aria-hidden="true" />
              <span className="font-medium">AI</span>
              <span className="ml-auto card:ml-1 font-semibold tabular-nums">{formatDuration(entry.ai_seconds)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Zone A — expand control (top-right, 44x44 target) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={expanded ? 'Collapse stats' : 'Expand stats'}
        className="lb-chevron flex items-center justify-center w-11 h-11 rounded-full text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors active:scale-95"
      >
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Zone C — primary metric */}
      <div className="lb-metric flex items-baseline justify-between card:block card:text-right">
        <div className="min-w-0 flex items-baseline gap-2">
          <p className={`text-2xl card:text-sm font-semibold leading-none tabular-nums ${tierClass}`}>
            {formatMetric(metricValue, metric)}
          </p>
          <span className="text-xs card:hidden font-medium text-slate-500 dark:text-zinc-500">
            {metricLabel}
          </span>
        </div>
        <div className="card:hidden flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-500">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-[var(--lb-human)] flex-shrink-0" aria-hidden="true" />
            Human
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-[var(--lb-ai)] flex-shrink-0" aria-hidden="true" />
            AI
          </span>
        </div>
      </div>
    </div>
  );
}
