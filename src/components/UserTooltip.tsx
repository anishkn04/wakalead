import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { LeaderboardEntry, TooltipStats, formatDuration, formatLines } from '../api';
import { getLanguageIcon, languageHue } from '../languageIcons';

interface UserTooltipProps {
  entry: LeaderboardEntry;
  stats: TooltipStats | null;
  loading: boolean;
  error: string | null;
  anchorRef: RefObject<HTMLDivElement | null>;
  initialPoint: { x: number; y: number } | null;
  onCardEnter: () => void;
  onCardLeave: () => void;
}

const WIDTH = 640;
const MARGIN = 12;
const OFFSET = 16;

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

function Block({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-4 py-2.5 ${className}`}>
      {title && (
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40 mb-1.5">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function StatCell({
  label,
  children,
  align = 'left',
}: {
  label: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <p className="text-[9px] font-medium text-white/40">{label}</p>
      <div className="mt-0.5 text-[13px] font-semibold text-white tabular-nums">{children}</div>
    </div>
  );
}

function LanguageTile({ name, percent }: { name: string; percent: number }) {
  const icon = getLanguageIcon(name);
  const hue = languageHue(name);
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-lg bg-white/[0.04] border border-white/[0.06] px-1 py-2 min-w-0"
      title={`${name} · ${percent}%`}
    >
      {icon ? (
        <img src={icon} alt={name} className="w-5 h-5 flex-shrink-0" draggable={false} />
      ) : (
        <span
          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `hsl(${hue} 55% 38%)` }}
          title="No icon for this language"
        >
          <svg className="w-3 h-3 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
        </span>
      )}
      <span className="w-full text-[9px] text-white/80 truncate text-center">{name}</span>
      <span className="text-[9px] text-white/40 tabular-nums">{percent}%</span>
    </div>
  );
}

function StackCol({
  accent,
  label,
  items,
}: {
  accent: string;
  label: string;
  items: { name: string; percent: number }[];
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${accent}`} />
        {label}
      </p>
      {items.length === 0 ? (
        <p className="text-[10px] text-white/30">—</p>
      ) : (
        items.map((it) => (
          <div
            key={it.name}
            className="flex items-center justify-between gap-1 text-[10px] py-0.5"
            title={`${it.name} · ${it.percent}%`}
          >
            <span className="text-white/80 truncate min-w-0">{it.name}</span>
            <span className="text-white/40 tabular-nums flex-shrink-0">{it.percent}%</span>
          </div>
        ))
      )}
    </div>
  );
}

function Sparkline({
  data,
  height = 56,
}: {
  data: { date: string; seconds: number }[];
  height?: number;
}) {
  const values = data.map((d) => d.seconds);
  const max = Math.max(...values, 1);
  const W = 296;
  const H = height;
  const P = 6;
  const step = (W - P * 2) / (values.length - 1 || 1);

  const pts = values.map((v, i) => [P + i * step, H - P - (v / max) * (H - P * 2)]);

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
      <div className="mt-1 flex justify-between text-[8px] text-white/35 tabular-nums">
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
    <div className="w-[640px] max-w-[94vw] overflow-hidden rounded-2xl border border-white/10 bg-[#101014] shadow-2xl">
      <div className="h-24 bg-zinc-800/60 animate-shimmer" />
      <div className="grid grid-cols-2 divide-x divide-white/[0.06] p-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-3 rounded bg-zinc-800/80 animate-shimmer" style={{ width: `${90 - i * 18}%` }} />
            <div className="h-3 rounded bg-zinc-800/80 animate-shimmer" style={{ width: `${70 - i * 14}%` }} />
            <div className="h-3 rounded bg-zinc-800/80 animate-shimmer" style={{ width: `${80 - i * 16}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Enka.network-style hover card showing a user's overall WakaTime stats.
 * Always dark-glass so it pops on top of both app themes. Follows the pointer
 * inside the hovered row (keqingmains-style), flipping sides near the edges.
 * Compact 2-column layout so it fits on screen without scrolling.
 */
export function UserTooltip({ entry, stats, loading, error, anchorRef, initialPoint, onCardEnter, onCardLeave }: UserTooltipProps) {
  const hue = useMemo(() => hashHue(entry.username || String(entry.user_id)), [entry.username, entry.user_id]);

  // Pointer position inside the hovered row (rAF-throttled)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPoint = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;

    // Start where the pointer entered the row, then follow it on move
    const rect = el.getBoundingClientRect();
    setPos(initialPoint ?? { x: rect.right, y: rect.top + rect.height / 2 });

    const onMove = (e: MouseEvent) => {
      pendingPoint.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setPos(pendingPoint.current);
      });
    };
    const onLeave = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // anchorRef.current changes when the hovered row switches, but the ref
    // object stays the same - key off the user so the listeners re-attach
    // and the card reseeds at the new row's pointer position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorRef, entry.user_id]);

  const position = useMemo(() => {
    if (!pos) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer the right of the pointer; flip to the left when out of room
    let left = pos.x + OFFSET;
    if (left + WIDTH > vw - MARGIN) {
      left = pos.x - OFFSET - WIDTH;
    }
    left = Math.max(MARGIN, Math.min(left, vw - MARGIN - WIDTH));

    // Slightly below the pointer, clamped so the card stays on screen
    const top = Math.max(MARGIN, Math.min(pos.y + 10, vh - MARGIN - 140));

    return { left, top, maxHeight: vh - MARGIN * 2 };
  }, [pos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCardLeave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCardLeave]);

  if (!position) return null;

  const meta = rankMeta(entry.rank);
  const total = stats?.aggregates.total_seconds ?? 0;
  const humanPct = total > 0 ? Math.round(((stats?.aggregates.human_seconds ?? 0) / total) * 100) : 0;
  const aiPct = total > 0 ? Math.round(((stats?.aggregates.ai_seconds ?? 0) / total) * 100) : 0;
  const hasAiTokens = (stats?.ai_tokens.input ?? 0) > 0 || (stats?.ai_tokens.output ?? 0) > 0 || (stats?.ai_tokens.sessions ?? 0) > 0;
  const isEmpty =
    stats != null &&
    total === 0 &&
    stats.languages.length === 0 &&
    stats.ai_models.length === 0;

  return createPortal(
    <div
      role="tooltip"
      className="fixed z-[999] w-[580px] max-w-[94vw] overflow-hidden rounded-2xl border border-white/10 bg-[#101014]/95 backdrop-blur-xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] animate-scaleIn"
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
        <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: position.maxHeight }}>
          {/* Flat header with per-user accent stripe */}
          <div className="relative border-b border-white/[0.07] bg-[#17171d] px-4 pt-3 pb-2.5">
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: `hsl(${hue} 65% 50%)` }}
            />
            <div className="flex items-center gap-2.5">
              {stats.photo_url ? (
                <img
                  src={stats.photo_url}
                  alt={stats.username}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-white/40 shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-base ring-2 ring-white/40 shadow-lg flex-shrink-0">
                  {(stats.display_name || stats.username).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-white text-sm truncate">
                    {stats.display_name || stats.username}
                  </p>
                  {stats.is_admin && (
                    <span className="text-[8px] font-mono font-bold bg-emerald-400/25 text-emerald-200 border border-emerald-300/40 px-1 py-0.5 rounded flex-shrink-0">
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/75 truncate">@{stats.username}</p>
              </div>
              <span
                className={`flex-shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-lg border backdrop-blur ${meta.cls}`}
                title={`Rank #${entry.rank}`}
              >
                {meta.icon}
              </span>
            </div>

            <div className="relative mt-2 flex items-center justify-between gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">
                All-time
              </span>
              <span className="text-xl font-extrabold text-white tabular-nums leading-none">
                {formatDuration(stats.all_time_seconds)}
              </span>
              <span className="text-[10px] text-white/60 tabular-nums">
                since{' '}
                {new Date(stats.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {isEmpty ? (
            <div className="px-4 py-5 text-xs text-white/45">
              No coding activity tracked yet — tell them to hit Sync.
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
              {/* Left column */}
              <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-white/[0.06]">
                {/* AI vs Human split */}
                <Block>
                  <div className="flex items-center justify-between text-[10px] font-medium mb-1.5">
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <span className="w-2 h-2 rounded-sm bg-blue-500" />
                      Human
                    </span>
                    <span className="flex items-center gap-1.5 text-violet-400">
                      <span className="w-2 h-2 rounded-sm bg-violet-500" />
                      AI
                    </span>
                  </div>
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-white/[0.08]">
                    <div
                      className="bg-blue-500"
                      style={{ width: `${total > 0 ? humanPct : 0}%` }}
                    />
                    <div
                      className="bg-violet-500"
                      style={{ width: `${total > 0 ? aiPct : 0}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] tabular-nums">
                    <span className="text-blue-300">{formatDuration(stats.aggregates.human_seconds)}</span>
                    <span className="text-white/50">{humanPct}%</span>
                    <span className="text-white/50">{aiPct}%</span>
                    <span className="text-violet-300">{formatDuration(stats.aggregates.ai_seconds)}</span>
                  </div>
                </Block>

                {/* Stat grid */}
                <Block>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
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
                      <span className={deltaInfo(stats.aggregates.delta_percent, stats.aggregates.today_seconds, stats.aggregates.yesterday_seconds).cls}>
                        {deltaInfo(stats.aggregates.delta_percent, stats.aggregates.today_seconds, stats.aggregates.yesterday_seconds).text}
                      </span>
                    </StatCell>
                    <StatCell label="Today" align="right">
                      <span className="tabular-nums">{formatDuration(stats.aggregates.today_seconds)}</span>
                    </StatCell>
                  </div>
                </Block>

                {/* Last 7 days sparkline */}
                <Block className="mt-auto">
                  <Sparkline data={stats.aggregates.week} height={40} />
                </Block>
              </div>

              {/* Right column */}
              <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-white/[0.06]">
                {/* Top languages */}
                <Block title="Top languages">
                  {stats.languages.length === 0 ? (
                    <p className="text-[11px] text-white/40">No languages yet</p>
                  ) : (
                    <div className="grid grid-cols-5 gap-1.5">
                      {stats.languages.slice(0, 5).map((l) => (
                        <LanguageTile key={l.name} name={l.name} percent={l.percent} />
                      ))}
                    </div>
                  )}
                </Block>

                {/* Editors / OS / Machines */}
                <Block title="Stack">
                  <div className="grid grid-cols-3 gap-2">
                    <StackCol accent="bg-cyan-400" label="Editors" items={stats.editors.slice(0, 2)} />
                    <StackCol accent="bg-slate-400" label="OS" items={stats.operating_systems.slice(0, 2)} />
                    <StackCol accent="bg-fuchsia-400" label="Machines" items={stats.machines.slice(0, 2)} />
                  </div>
                </Block>

                {/* Top projects */}
                <Block title="Top projects">
                  {stats.projects.length === 0 ? (
                    <p className="text-[11px] text-white/40">No projects yet</p>
                  ) : (
                    stats.projects.slice(0, 3).map((p) => (
                      <div key={p.name} className="flex items-center justify-between text-[11px] py-0.5">
                        <span className="text-white/85 truncate mr-2 min-w-0">📁 {p.name}</span>
                        <span className="text-white/45 tabular-nums flex-shrink-0">
                          {formatDuration(p.seconds)} · {p.percent}%
                        </span>
                      </div>
                    ))
                  )}
                </Block>

                {/* AI models + usage */}
                <Block title="AI">
                  {stats.ai_models.length === 0 && !hasAiTokens ? (
                    <p className="text-[11px] text-white/40">No AI usage yet</p>
                  ) : (
                    <>
                      {stats.ai_models.slice(0, 3).map((m) => (
                        <div key={m.name} className="flex items-center justify-between text-[11px] py-0.5">
                          <span className="text-violet-300 truncate mr-2 min-w-0">🤖 {m.name}</span>
                          <span className="text-white/45 tabular-nums flex-shrink-0">
                            {formatLines(m.lines)} lines{m.cost > 0 ? ` · $${m.cost.toFixed(2)}` : ''}
                          </span>
                        </div>
                      ))}
                      {hasAiTokens && (
                        <div className="mt-1 pt-1.5 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[10px] text-white/50">
                          <span className="flex-shrink-0">Tokens</span>
                          <span className="tabular-nums truncate min-w-0 text-right">
                            {formatLines(stats.ai_tokens.input)} in · {formatLines(stats.ai_tokens.output)} out
                            {stats.ai_tokens.sessions > 0 ? ` · ${stats.ai_tokens.sessions} sessions` : ''}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </Block>
              </div>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
