import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LeaderboardEntry, TooltipStats, formatDuration, formatLines } from '../api';

interface UserTooltipProps {
  entry: LeaderboardEntry;
  stats: TooltipStats | null;
  loading: boolean;
  error: string | null;
  anchorRect: DOMRect;
  onCardEnter: () => void;
  onCardLeave: () => void;
}

const WIDTH = 332;
const MARGIN = 12;

/** Deterministic hue from a username so each user gets a stable accent tint. */
function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

const RANK_META: Record<number, { icon: string; cls: string }> = {
  1: { icon: '👑', cls: 'bg-amber-400/20 text-amber-300 border-amber-300/40' },
  2: { icon: '⚡', cls: 'bg-slate-300/15 text-slate-200 border-slate-200/30' },
  3: { icon: '✨', cls: 'bg-orange-400/20 text-orange-300 border-orange-300/40' },
};

function rankMeta(rank: number) {
  return RANK_META[rank] ?? {
    icon: `#${rank}`,
    cls: 'bg-white/10 text-white/80 border-white/20',
  };
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function deltaInfo(delta: number | null, today: number, yesterday: number) {
  if (today === 0 && yesterday === 0) return { text: '—', cls: 'text-white/40' };
  if (delta === null) return { text: 'New', cls: 'text-emerald-400' };
  if (delta > 0) return { text: `▲ ${delta}%`, cls: 'text-emerald-400' };
  if (delta < 0) return { text: `▼ ${Math.abs(delta)}%`, cls: 'text-rose-400' };
  return { text: '= 0%', cls: 'text-white/50' };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5 border-t border-white/[0.07]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40 mb-2.5">
        {title}
      </p>
      {children}
    </div>
  );
}

function StatCell({ label, children, align = 'left' }: { label: string; children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <p className="text-[10px] font-medium text-white/40">{label}</p>
      <div className="mt-0.5 text-sm font-semibold text-white tabular-nums">{children}</div>
    </div>
  );
}

function BarRow({
  name,
  value,
  percent,
  gradient,
}: {
  name: string;
  value: string;
  percent: number;
  gradient: string;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-white/85 font-medium truncate mr-2">{name}</span>
        <span className="text-white/45 tabular-nums flex-shrink-0 ml-auto pl-2">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className={`h-full rounded-full ${gradient}`}
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

function BreakdownSection({
  title,
  items,
  gradient,
}: {
  title: string;
  items: { name: string; seconds: number; percent: number }[];
  gradient: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <Section title={title}>
      {items.slice(0, 5).map((item) => (
        <BarRow
          key={item.name}
          name={item.name}
          value={`${formatDuration(item.seconds)} · ${item.percent}%`}
          percent={item.percent}
          gradient={gradient}
        />
      ))}
    </Section>
  );
}

function Sparkline({ data }: { data: { date: string; seconds: number }[] }) {
  const values = data.map((d) => d.seconds);
  const max = Math.max(...values, 1);
  const W = 296;
  const H = 56;
  const P = 6;
  const step = (W - P * 2) / (values.length - 1 || 1);

  const pts = values.map((v, i) => [
    P + i * step,
    H - P - (v / max) * (H - P * 2),
  ]);

  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ');
  const area = `${line} L${(P + (values.length - 1) * step).toFixed(1)},${H - P} L${P},${H - P} Z`;
  const hasActivity = values.some((v) => v > 0);

  return (
    <div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </linearGradient>
        </defs>
        {hasActivity && (
          <>
            <path d={area} fill="url(#spark-fill)" />
            <path
              d={line}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {pts.map((p, i) =>
              values[i] > 0 ? (
                <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#93c5fd" stroke="#131316" strokeWidth="1" />
              ) : null
            )}
          </>
        )}
        {!hasActivity && (
          <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="4 4" />
        )}
      </svg>
      <div className="mt-1.5 flex justify-between text-[9px] text-white/35 tabular-nums">
        {data.map((d, i) => (
          <span key={i}>
            {d.date === new Date().toISOString().slice(0, 10)
              ? 'Today'
              : new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
        ))}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="w-[332px] overflow-hidden rounded-2xl border border-white/10 bg-[#101014] shadow-2xl">
      <div className="h-28 bg-zinc-800/60 animate-shimmer" />
      <div className="p-4 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-3 rounded bg-zinc-800/80 animate-shimmer" style={{ width: `${90 - i * 18}%` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Enka.network-style hover card showing a user's overall WakaTime stats.
 * Always dark-glass so it pops on top of both app themes.
 */
export function UserTooltip({ entry, stats, loading, error, anchorRect, onCardEnter, onCardLeave }: UserTooltipProps) {
  const hue = useMemo(() => hashHue(entry.username || String(entry.user_id)), [entry.username, entry.user_id]);

  const position = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rightSpace = vw - anchorRect.right - MARGIN;
    const leftSpace = anchorRect.left - MARGIN;
    const left =
      rightSpace >= WIDTH || rightSpace >= leftSpace
        ? anchorRect.right + MARGIN
        : Math.max(MARGIN, anchorRect.left - WIDTH - MARGIN);
    const top = Math.max(MARGIN, Math.min(anchorRect.top, vh - MARGIN - 260));
    return { left, top, maxHeight: vh - MARGIN * 2 };
  }, [anchorRect]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCardLeave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCardLeave]);

  const meta = rankMeta(entry.rank);

  return createPortal(
    <div
      role="tooltip"
      className="fixed z-[999] w-[332px] overflow-hidden rounded-2xl border border-white/10 bg-[#101014]/95 backdrop-blur-xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] animate-scaleIn"
      style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }}
      onMouseEnter={onCardEnter}
      onMouseLeave={onCardLeave}
    >
      {loading && <Skeleton />}

      {!loading && error && (
        <div className="px-4 py-6 text-sm text-white/60">
          <p className="font-semibold text-white/80 mb-1">Couldn't load stats</p>
          {error}
        </div>
      )}

      {!loading && !error && stats && (
        <>
          {/* Tinted gradient header */}
          <div
            className="relative px-4 pt-4 pb-5"
            style={{
              background: `linear-gradient(135deg, hsl(${hue} 68% 40%) 0%, hsl(${(hue + 48) % 360} 72% 24%) 100%)`,
            }}
          >
            <div
              className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-40 blur-2xl"
              style={{ background: `hsl(${(hue + 120) % 360} 80% 55%)` }}
            />
            <div
              className="absolute -bottom-14 -left-8 w-28 h-28 rounded-full opacity-30 blur-2xl"
              style={{ background: `hsl(${hue} 85% 60%)` }}
            />
            <div className="relative flex items-center gap-3">
              {stats.photo_url ? (
                <img
                  src={stats.photo_url}
                  alt={stats.username}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-white/40 shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-lg ring-2 ring-white/40 shadow-lg flex-shrink-0">
                  {(stats.display_name || stats.username).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-white truncate drop-shadow">
                    {stats.display_name || stats.username}
                  </p>
                  {stats.is_admin && (
                    <span className="text-[9px] font-mono font-bold bg-emerald-400/25 text-emerald-200 border border-emerald-300/40 px-1.5 py-0.5 rounded flex-shrink-0">
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/75 truncate">@{stats.username}</p>
              </div>
              <span
                className={`ml-auto flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg border backdrop-blur ${meta.cls}`}
                title={`Rank #${entry.rank}`}
              >
                {meta.icon}
              </span>
            </div>

            {/* All-time hero */}
            <div className="relative mt-4 flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  All-time coded
                </p>
                <p className="text-3xl font-extrabold text-white tabular-nums drop-shadow leading-tight">
                  {formatDuration(stats.all_time_seconds)}
                </p>
              </div>
              <p className="text-[11px] text-white/70 tabular-nums pb-1">
                since {new Date(stats.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* AI vs Human split */}
          <div className="px-4 py-3.5 border-b border-white/[0.07]">
            <div className="flex items-center justify-between text-xs font-medium mb-1.5">
              <span className="text-blue-300">Human</span>
              <span className="text-white/40 tabular-nums">
                {stats.aggregates.total_seconds > 0
                  ? `${Math.round((stats.aggregates.human_seconds / stats.aggregates.total_seconds) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.07]">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-400"
                style={{ width: `${stats.aggregates.total_seconds > 0 ? (stats.aggregates.human_seconds / stats.aggregates.total_seconds) * 100 : 0}%` }}
              />
              <div
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500"
                style={{ width: `${stats.aggregates.total_seconds > 0 ? (stats.aggregates.ai_seconds / stats.aggregates.total_seconds) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs font-medium">
              <span className="text-white/85 tabular-nums">{formatDuration(stats.aggregates.human_seconds)}</span>
              <span className="text-violet-300 tabular-nums">{formatDuration(stats.aggregates.ai_seconds)} AI</span>
            </div>
          </div>

          {/* Stat grid */}
          <div className="px-4 py-3.5 border-b border-white/[0.07] grid grid-cols-2 gap-x-4 gap-y-3">
            <StatCell label="Lines changed">
              {formatLines(stats.aggregates.ai_lines + stats.aggregates.human_lines)}
            </StatCell>
            <StatCell label="Days active" align="right">
              {stats.aggregates.days_active}
              <span className="text-white/40 text-xs font-medium"> / {stats.aggregates.days_tracked}</span>
            </StatCell>
            <StatCell label="Best day">
              {stats.aggregates.best_day
                ? `${formatShortDate(stats.aggregates.best_day.date)} · ${formatDuration(stats.aggregates.best_day.seconds)}`
                : '—'}
            </StatCell>
            <StatCell label="Streak" align="right">
              <span className="mr-1">🔥</span>
              {stats.aggregates.current_streak}
              <span className="text-white/40 text-xs font-medium"> / {stats.aggregates.longest_streak}</span>
            </StatCell>
            <StatCell label="Today vs yesterday">
              <span className={`${deltaInfo(stats.aggregates.delta_percent, stats.aggregates.today_seconds, stats.aggregates.yesterday_seconds).cls}`}>
                {deltaInfo(stats.aggregates.delta_percent, stats.aggregates.today_seconds, stats.aggregates.yesterday_seconds).text}
              </span>
            </StatCell>
            <StatCell label="Today" align="right">
              <span className="tabular-nums">{formatDuration(stats.aggregates.today_seconds)}</span>
            </StatCell>
          </div>

          {/* Last 7 days sparkline */}
          <Section title="Last 7 days">
            <Sparkline data={stats.aggregates.week} />
          </Section>

          {/* Breakdowns */}
          <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
            <BreakdownSection title="Top languages" items={stats.languages} gradient="bg-gradient-to-r from-blue-500 to-indigo-500" />
            <BreakdownSection title="Editors" items={stats.editors} gradient="bg-gradient-to-r from-cyan-500 to-teal-500" />
            <BreakdownSection title="Operating systems" items={stats.operating_systems} gradient="bg-gradient-to-r from-slate-400 to-zinc-500" />
            <BreakdownSection title="Top projects" items={stats.projects} gradient="bg-gradient-to-r from-amber-500 to-orange-500" />
            <BreakdownSection title="Machines" items={stats.machines} gradient="bg-gradient-to-r from-fuchsia-500 to-pink-500" />

            {stats.ai_models.length > 0 && (
              <Section title="AI models">
                {stats.ai_models.slice(0, 5).map((m) => (
                  <div key={m.name} className="flex items-center justify-between text-xs mb-1.5 last:mb-0">
                    <span className="text-white/85 font-medium truncate mr-2">🤖 {m.name}</span>
                    <span className="text-white/45 tabular-nums flex-shrink-0 pl-2">
                      {formatLines(m.lines)} lines{m.cost > 0 ? ` · $${m.cost.toFixed(2)}` : ''}
                    </span>
                  </div>
                ))}
              </Section>
            )}

            {(stats.ai_tokens.input > 0 || stats.ai_tokens.output > 0 || stats.ai_tokens.sessions > 0) && (
              <Section title="AI usage">
                <div className="flex items-center justify-between text-xs text-white/85">
                  <span className="font-medium">Tokens</span>
                  <span className="tabular-nums text-white/60">
                    {formatLines(stats.ai_tokens.input)} in · {formatLines(stats.ai_tokens.output)} out
                  </span>
                </div>
                {stats.ai_tokens.sessions > 0 && (
                  <div className="mt-1.5 flex items-center justify-between text-xs text-white/85">
                    <span className="font-medium">AI sessions</span>
                    <span className="tabular-nums text-white/60">{stats.ai_tokens.sessions}</span>
                  </div>
                )}
              </Section>
            )}
          </div>

          {stats.aggregates.total_seconds === 0 &&
            stats.languages.length === 0 &&
            stats.ai_models.length === 0 && (
              <div className="px-4 py-4 text-xs text-white/45">
                No coding activity tracked yet — tell them to hit Sync.
              </div>
            )}
        </>
      )}
    </div>,
    document.body
  );
}
