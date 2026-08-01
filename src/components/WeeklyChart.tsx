import { useMemo } from 'react';
import { WeeklyData, Metric, METRICS, formatDuration, formatLines, formatMetric } from '../api';

interface WeeklyChartProps {
  data: WeeklyData | null;
  metric?: Metric;
  onMetricChange?: (metric: Metric) => void;
  loading?: boolean;
}

/** RGB triplets for the heatmap accent per metric */
const ACCENTS: Record<Metric, string> = {
  total: '59, 130, 246',
  human: '16, 185, 129',
  ai: '139, 92, 246',
  lines: '244, 63, 94',
};

function metricValue(
  d: WeeklyData['users'][number]['daily_data'][number],
  metric: Metric
): number {
  switch (metric) {
    case 'human':
      return d.human_seconds;
    case 'ai':
      return d.ai_seconds;
    case 'lines':
      return d.ai_lines;
    case 'total':
    default:
      return d.seconds;
  }
}

/** Compact per-day value label (e.g. "3.4h", "42m", "1.2k"). */
function formatCompact(value: number, metric: Metric): string {
  if (metric === 'lines') return formatLines(value);
  if (value >= 3600) return `${(value / 3600).toFixed(1)}h`;
  if (value >= 60) return `${Math.round(value / 60)}m`;
  return `${Math.round(value)}s`;
}

function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * Weekly performance heatmap - a contribution-grid style view of the last
 * 7 days. Rows are users ranked by their weekly total for the selected
 * metric; columns are days; cells are shaded by that day's value.
 */
export function WeeklyChart({ data, metric = 'total', onMetricChange, loading }: WeeklyChartProps) {
  const accent = ACCENTS[metric];

  const rows = useMemo(() => {
    if (!data) return [];
    const mapped = data.users.map((user) => {
      const byDate = new Map(user.daily_data.map((d) => [d.date, d]));
      const values = data.dates.map((date) => byDate.get(date) ?? null);
      const weekTotal = values.reduce((sum, d) => sum + (d ? metricValue(d, metric) : 0), 0);
      return { user, values, weekTotal };
    });
    return mapped.sort((a, b) => b.weekTotal - a.weekTotal);
  }, [data, metric]);

  const max = useMemo(
    () =>
      Math.max(
        1,
        ...rows.flatMap((r) => r.values.map((d) => (d ? metricValue(d, metric) : 0)))
      ),
    [rows, metric]
  );

  if (loading || !data) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Weekly Performance
        </h2>
        <div className="h-64 sm:h-72 bg-slate-100 dark:bg-zinc-800 rounded-xl animate-shimmer" />
      </div>
    );
  }

  if (data.users.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Weekly Performance
        </h2>
        <div className="h-64 sm:h-72 flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-1">
            <svg className="w-7 h-7 text-slate-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h9.826a.75.75 0 01.643.397l.447.893a.75.75 0 01.643.397l1.24 2.48a.75.75 0 01.643.397l1.033 2.065a.75.75 0 01-.643 1.065l-1.5.375a.75.75 0 01-.643-.397l-1.034-2.065a.75.75 0 01-.643-.397L10.5 6.75H6.75" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-zinc-500 font-medium">No weekly data yet</p>
          <p className="text-sm text-slate-400 dark:text-zinc-600">
            Sync once and the 7-day trend appears here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Weekly Performance
        </h2>
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5">
          {METRICS.map((m) => (
            <button
              key={m.value}
              onClick={() => onMetricChange?.(m.value)}
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

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Column headers */}
          <div className="grid gap-1.5 pb-1.5" style={{ gridTemplateColumns: '150px repeat(7, 1fr)' }}>
            <div />
            {data.dates.map((date, i) => {
              const dt = new Date(date + 'T00:00:00');
              return (
                <div key={i} className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                    {dt.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 tabular-nums">
                    {Number(date.slice(8, 10))}
                  </p>
                </div>
              );
            })}
          </div>

          {/* User rows */}
          <div className="space-y-1.5">
            {rows.map(({ user, values, weekTotal }) => {
              const name = user.display_name || user.username;
              return (
                <div
                  key={user.user_id}
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: '150px repeat(7, 1fr)' }}
                >
                  <div className="flex items-center gap-2 pr-2 min-w-0">
                    {user.photo_url ? (
                      <img
                        src={user.photo_url}
                        alt={user.username}
                        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                        draggable={false}
                      />
                    ) : (
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ background: `hsl(${hashHue(user.username || String(user.user_id))} 60% 45%)` }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-white min-w-0 flex-1" title={name}>
                      {name}
                    </span>
                    <span className="ml-auto text-xs font-semibold tabular-nums text-slate-500 dark:text-zinc-400">
                      {formatMetric(weekTotal, metric)}
                    </span>
                  </div>

                  {values.map((d, i) => {
                    const v = d ? metricValue(d, metric) : 0;
                    const alpha = v / max;
                    const light = alpha > 0.45;
                    return (
                      <div
                        key={i}
                        title={
                          d
                            ? `${name}: ${formatDuration(d.seconds)}${d.ai_seconds > 0 ? ` · AI ${formatDuration(d.ai_seconds)}` : ''}`
                            : `${name}: no activity`
                        }
                        className={`flex items-center justify-center rounded-md h-9 text-[11px] font-medium tabular-nums transition-colors ${
                          v > 0 ? (light ? 'text-white' : 'text-slate-700 dark:text-zinc-300') : 'bg-slate-100 dark:bg-white/[0.03] text-slate-400 dark:text-zinc-600'
                        }`}
                        style={v > 0 ? { background: `rgba(${accent}, ${(0.1 + alpha * 0.8).toFixed(3)})` } : undefined}
                      >
                        {v > 0 ? formatCompact(v, metric) : ''}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Intensity legend */}
          <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-slate-400 dark:text-zinc-500">
            <span>Less</span>
            <div
              className="w-24 h-2 rounded-full"
              style={{ background: `linear-gradient(to right, rgba(${accent}, 0.1), rgba(${accent}, 0.9))` }}
            />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
