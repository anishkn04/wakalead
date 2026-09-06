import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ProfileData, ProfileDailyRow, UserSeasonStat, UserCard, CardScope, formatDuration, formatLines, formatDate, formatRelativeTime } from '../api';
import { Header } from '../components/Header';
import { hashHue } from '../components/StatsPanel';
import { getLanguageIcon, languageHue } from '../languageIcons';
import { getEditorIcon, getOsIcon } from '../stackIcons';
import { PlayerCard, CARD_TYPE_LABEL } from '../components/PlayerCard';

type BreakdownItem = { name: string; seconds?: number; percent?: number };

function compactTime(seconds: number): string {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds)}s`;
}

function isoRelative(iso: string | undefined | null): string {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return iso;
  return formatRelativeTime(ts);
}

function iconFor(name: string, kind?: 'language' | 'editor' | 'os') {
  const icon = kind === 'editor' ? getEditorIcon(name) : kind === 'os' ? getOsIcon(name) : getLanguageIcon(name);
  if (icon) {
    return <img src={icon} alt={name} className="w-4 h-4 rounded-sm flex-shrink-0" draggable={false} />;
  }
  const hue = languageHue(name);
  return (
    <span
      className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
      style={{ background: `hsl(${hue} 55% 40%)` }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Section({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 sm:p-6 ${className}`}>
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mt-4" />}
      {children}
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-600">{sub}</p>}
    </div>
  );
}

function BreakdownList({
  items,
  kind,
  limit = 12,
}: {
  items: BreakdownItem[];
  kind?: 'language' | 'editor' | 'os';
  limit?: number;
}) {
  const top = items.slice(0, limit);
  const total = top.reduce((sum, i) => sum + (i.seconds ?? 0), 0);
  return (
    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
      {top.map((it) => {
        const pct = it.percent ?? (total > 0 ? ((it.seconds || 0) / total) * 100 : 0);
        return (
          <div key={it.name} className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0 text-sm text-slate-800 dark:text-white">
                {kind && iconFor(it.name, kind)}
                <span className="truncate">{it.name}</span>
              </span>
              <span className="text-xs text-slate-500 dark:text-zinc-500 tabular-nums flex-shrink-0">
                {it.seconds ? formatDuration(it.seconds) : ''} · {pct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${Math.max(0, Math.min(pct, 100)).toFixed(1)}%` }}
              />
            </div>
          </div>
        );
      })}
      {top.length === 0 && <p className="text-sm text-slate-400 dark:text-zinc-600">Nothing yet.</p>}
    </div>
  );
}

function WeekBars({ week }: { week: { date: string; seconds: number }[] }) {
  const max = Math.max(1, ...week.map((d) => d.seconds));
  return (
    <div className="flex items-end gap-2 h-36">
      {week.map((d, i) => {
        const h = Math.max(2, (d.seconds / max) * 100);
        const dt = new Date(d.date + 'T00:00:00');
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <span className="text-[10px] text-slate-500 dark:text-zinc-500 tabular-nums">
              {d.seconds > 0 ? compactTime(d.seconds) : ''}
            </span>
            <div
              className="w-full rounded-t-md transition-all"
              title={`${d.date}: ${formatDuration(d.seconds)}`}
              style={{ height: `${h}%`, background: d.seconds > 0 ? 'var(--lb-ai)' : 'rgba(148,163,184,0.15)' }}
            />
            <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-600">
              {dt.toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DailyTable({ rows }: { rows: ProfileDailyRow[] }) {
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 dark:text-zinc-600">
            <th className="py-2 pr-3 font-medium">Date</th>
            <th className="py-2 pr-3 font-medium text-right">Total</th>
            <th className="py-2 pr-3 font-medium text-right">Human</th>
            <th className="py-2 pr-3 font-medium text-right">AI</th>
            <th className="py-2 pr-3 font-medium text-right">Human lines</th>
            <th className="py-2 font-medium text-right">AI lines</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date} className="border-t border-slate-100 dark:border-zinc-800/70">
              <td className="py-2 pr-3 text-slate-800 dark:text-white whitespace-nowrap">{formatDate(r.date)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-800 dark:text-white">{formatDuration(r.total_seconds)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-500 dark:text-zinc-400">{formatDuration(r.human_seconds)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-violet-600 dark:text-violet-400">{formatDuration(r.ai_seconds)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-500 dark:text-zinc-400">{formatLines(r.human_lines)}</td>
              <td className="py-2 text-right tabular-nums text-slate-500 dark:text-zinc-400">{formatLines(r.ai_lines)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeasonArchiveTable({ seasons }: { seasons: UserSeasonStat[] }) {
  if (seasons.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-zinc-600">No past seasons yet - this is the first one.</p>;
  }
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 dark:text-zinc-600">
            <th className="py-2 pr-3 font-medium">Season</th>
            <th className="py-2 pr-3 font-medium">Ended</th>
            <th className="py-2 pr-3 font-medium text-right">Total</th>
            <th className="py-2 pr-3 font-medium text-right">Human</th>
            <th className="py-2 pr-3 font-medium text-right">AI</th>
            <th className="py-2 pr-3 font-medium text-right">Days active</th>
            <th className="py-2 font-medium text-right">Best day</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((s) => (
            <tr key={s.season_number} className="border-t border-slate-100 dark:border-zinc-800/70">
              <td className="py-2 pr-3 text-slate-800 dark:text-white whitespace-nowrap">Season {s.season_number}</td>
              <td className="py-2 pr-3 text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                {s.ended_at ? new Date(s.ended_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-800 dark:text-white">{formatDuration(s.total_seconds)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-500 dark:text-zinc-400">{formatDuration(s.human_seconds)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-violet-600 dark:text-violet-400">{formatDuration(s.ai_seconds)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-500 dark:text-zinc-400">{s.days_active}</td>
              <td className="py-2 text-right tabular-nums text-slate-500 dark:text-zinc-400">
                {s.best_day ? `${formatDuration(s.best_day.seconds)} · ${formatDate(s.best_day.date)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-zinc-800 animate-shimmer" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-40 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
            <div className="h-3 w-28 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
            <div className="h-3 w-48 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-24 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 animate-shimmer" />
        ))}
      </div>
      <div className="h-64 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 animate-shimmer" />
    </div>
  );
}

export function Profile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const cleanUsername = (username || '').replace(/^@/, '');

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [seasonsOpen, setSeasonsOpen] = useState(false);
  const [seasons, setSeasons] = useState<UserSeasonStat[] | null>(null);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [cardScope, setCardScope] = useState<CardScope>('season');
  const [card, setCard] = useState<UserCard | null>(null);
  const [cardLoading, setCardLoading] = useState(true);
  const [cardError, setCardError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRawOpen(false);
    setSeasonsOpen(false);
    setSeasons(null);
    api
      .getProfile(cleanUsername)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Could not load profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanUsername]);

  useEffect(() => {
    if (!data?.user.user_id) return;
    let cancelled = false;
    setCardLoading(true);
    setCardError(null);
    api
      .getUserCard(data.user.user_id, cardScope)
      .then((c) => {
        if (!cancelled) setCard(c);
      })
      .catch((err: Error) => {
        if (!cancelled) setCardError(err.message || 'Could not load card');
      })
      .finally(() => {
        if (!cancelled) setCardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data?.user.user_id, cardScope]);

  const hue = useMemo(() => hashHue(cleanUsername), [cleanUsername]);

  const liveStatsData = data?.live.stats as Record<string, any> | undefined;
  const liveMe = data?.live.me as Record<string, any> | undefined;
  const db = data?.db;
  const agg = db?.aggregates;

  const allTimeLanguages = liveStatsData?.languages as BreakdownItem[] | undefined;
  const allTimeEditors = liveStatsData?.editors as BreakdownItem[] | undefined;
  const allTimeOs = liveStatsData?.operating_systems as BreakdownItem[] | undefined;
  const allTimeProjects = liveStatsData?.projects as BreakdownItem[] | undefined;

  const humanPct = agg && agg.total_seconds > 0 ? Math.round((agg.human_seconds / agg.total_seconds) * 100) : 0;
  const aiPct = agg && agg.total_seconds > 0 ? Math.round((agg.ai_seconds / agg.total_seconds) * 100) : 0;
  const hasAiTokens = !!db && (db.ai_tokens.input > 0 || db.ai_tokens.output > 0 || db.ai_tokens.sessions > 0);

  const name = data?.user.display_name || data?.user.username || cleanUsername;

  const toggleSeasons = async () => {
    const next = !seasonsOpen;
    setSeasonsOpen(next);
    if (next && seasons === null && data) {
      setSeasonsLoading(true);
      try {
        const result = await api.getUserSeasons(data.user.user_id);
        setSeasons(result.seasons);
      } catch (err) {
        console.error('Error loading past seasons:', err);
        setSeasons([]);
      } finally {
        setSeasonsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0b]">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors mb-5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to leaderboard
        </button>

        {loading && <Skeleton />}

        {!loading && error && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-10 text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">Couldn't load profile</p>
            <p className="text-sm text-slate-500 dark:text-zinc-500 mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && data && db && agg && (
          <div className="space-y-6">
            {/* Live data notice */}
            {!data.live.ok && (
              <div className="rounded-xl border border-amber-300/50 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                Live WakaTime data unavailable ({data.live.error || 'no token'}). Showing synced data only.
              </div>
            )}

            {/* Header card */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
              <div className="h-1.5" style={{ background: `hsl(${hue} 65% 50%)` }} />
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative flex-shrink-0">
                    {data.user.photo_url && !photoFailed ? (
                      <img
                        src={data.user.photo_url}
                        alt={name}
                        onError={() => setPhotoFailed(true)}
                        className="w-20 h-20 rounded-full object-cover ring-2 ring-slate-200 dark:ring-zinc-700"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{name}</h1>
                      {data.user.is_admin && (
                        <span className="text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-500">@{data.user.username}</p>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <a
                        href={`https://wakatime.com/@${data.user.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors"
                      >
                        WakaTime profile
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                  {data.user.email && (
                    <Meta label="Email" value={data.user.email} />
                  )}
                  <Meta label="WakaLead member since" value={new Date(data.user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                  {liveMe?.created_at && <Meta label="WakaTime joined" value={new Date(liveMe.created_at as string).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} />}
                  {liveMe?.timezone && <Meta label="Timezone" value={liveMe.timezone as string} />}
                  {liveMe?.location && <Meta label="Location" value={liveMe.location as string} />}
                  {liveMe?.website && <Meta label="Website" value={<a className="text-blue-600 dark:text-blue-400 hover:underline" href={liveMe.website as string} target="_blank" rel="noopener noreferrer">{liveMe.website as string}</a>} />}
                  {liveMe?.last_heartbeat_at && <Meta label="Last heartbeat" value={isoRelative(liveMe.last_heartbeat_at as string)} />}
                  {liveMe?.last_project && <Meta label="Last project" value={liveMe.last_project as string} />}
                  {liveMe?.last_plugin && <Meta label="Last plugin" value={liveMe.last_plugin as string} />}
                  {liveMe?.is_hireable !== undefined && <Meta label="Hireable" value={liveMe.is_hireable ? 'Yes' : 'No'} />}
                  <Meta label="WakaTime ID" value={data.user.wakatime_id} mono />
                </div>
              </div>
            </section>

            {/* Player card */}
            <Section title="Player card" subtitle="Percentile-ranked against every other user - see the legend below for how it's built">
              <div className="flex items-center justify-center gap-2 mb-6">
                <button
                  onClick={() => setCardScope('season')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    cardScope === 'season'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  This season
                </button>
                <button
                  onClick={() => setCardScope('career')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    cardScope === 'career'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  Career
                </button>
              </div>

              {cardLoading && (
                <div className="flex justify-center">
                  <div className="w-[300px] h-[420px] bg-slate-100 dark:bg-zinc-800 rounded-2xl animate-shimmer" />
                </div>
              )}

              {!cardLoading && cardError && (
                <p className="text-center text-sm text-slate-400 dark:text-zinc-600">
                  Not enough data yet for a {cardScope} card.
                </p>
              )}

              {!cardLoading && !cardError && card && (
                <div className="flex flex-col items-center gap-3">
                  <PlayerCard card={card} name={name} photoUrl={data.user.photo_url} />
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                      {CARD_TYPE_LABEL[card.cardType]} · {card.position}
                    </p>
                    {card.provisional && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        Provisional - not enough {cardScope} data yet for a fully meaningful rating
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-500 space-y-2 max-w-xl mx-auto">
                <p className="font-semibold text-slate-600 dark:text-zinc-400">How this card is made</p>
                <p>
                  Every number is <strong>relative to everyone else</strong>, not an absolute
                  bar - each of the 6 stats is your percentile rank against the whole group,
                  rescaled so even last place still looks respectable. PAC and SHO count both
                  your own time/lines and AI-assisted time/lines (AI counted at a discount) -
                  this app doesn't hide or penalize AI usage, it's part of how you work.
                </p>
                <p>
                  <strong>PAC</strong> active coding time · <strong>SHO</strong> lines written ·{' '}
                  <strong>PAS</strong> breadth of projects/languages · <strong>DRI</strong> tool
                  versatility · <strong>DEF</strong> consistency (active days ratio) ·{' '}
                  <strong>PHY</strong> longest streak.
                </p>
                <p>
                  <strong>This season</strong> resets each time an admin starts a new season.{' '}
                  <strong>Career</strong> spans everything you've ever synced. Cards below{' '}
                  {7} active days (or in a group smaller than 4 people) are marked provisional
                  - not enough data for a meaningful percentile yet.
                </p>
                <p>
                  Card type: <strong>Icon</strong> = champion of 2+ past seasons ·{' '}
                  <strong>White Icon</strong> = every stat 90+ · <strong>Hero</strong> = #1
                  overall right now · <strong>Featured</strong> = an active streak over 5 ·{' '}
                  <strong>Gold/Silver</strong> = everyone else, by overall rating.
                </p>
              </div>
            </Section>

            {/* Lifetime stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="All-time" value={formatDuration(db.all_time_seconds)} sub="from WakaTime" />
              <StatCard label="Total (synced)" value={formatDuration(agg.total_seconds)} sub={`${agg.days_active} active / ${agg.days_tracked} tracked days${agg.days_tracked > 0 ? ` (${Math.round((agg.days_active / agg.days_tracked) * 100)}%)` : ''}`} />
              <StatCard label="Human time" value={formatDuration(agg.human_seconds)} sub={`${humanPct}% of total`} />
              <StatCard label="AI time" value={formatDuration(agg.ai_seconds)} sub={`${aiPct}% of total`} />
              <StatCard label="Lines changed" value={formatLines(agg.ai_lines + agg.human_lines)} sub={`${formatLines(agg.human_lines)} human · ${formatLines(agg.ai_lines)} AI`} />
              <StatCard label="Best day" value={agg.best_day ? formatDuration(agg.best_day.seconds) : '—'} sub={agg.best_day ? formatDate(agg.best_day.date) : 'No activity yet'} />
              <StatCard label="Streak" value={`${agg.current_streak} days`} sub={`longest ${agg.longest_streak} days`} />
              <StatCard label="Today vs yesterday" value={deltaLabel(agg.delta_percent, agg.today_seconds, agg.yesterday_seconds)} sub={`${formatDuration(agg.today_seconds)} today`} />
            </div>

            {/* Human / AI split + weekly bars */}
            <Section title="Human vs AI" subtitle="Time split across all synced days">
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <span className="w-2 h-2 rounded-sm bg-blue-500" /> Human
                </span>
                <span className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                  <span className="w-2 h-2 rounded-sm bg-violet-500" /> AI
                </span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-800">
                <div className="bg-blue-500" style={{ width: `${humanPct}%` }} />
                <div className="bg-violet-500" style={{ width: `${aiPct}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs tabular-nums text-slate-500 dark:text-zinc-500">
                <span>{formatDuration(agg.human_seconds)} · {humanPct}%</span>
                <span>{aiPct}% · {formatDuration(agg.ai_seconds)}</span>
              </div>
            </Section>

            <Section title="Last 7 days" subtitle="Daily coding seconds">
              <WeekBars week={agg.week} />
            </Section>

            {/* Languages */}
            <Section title="Languages" subtitle={liveStatsData?.languages ? 'All-time, from WakaTime' : 'From synced days'}>
              <BreakdownList items={allTimeLanguages || db.languages} kind="language" limit={15} />
            </Section>

            {/* Stack */}
            <Section title="Stack" subtitle={liveStatsData?.editors ? 'All-time, from WakaTime' : 'From synced days'}>
              <div className="grid gap-6 md:grid-cols-3">
                <StackGroup label="Editors" items={(allTimeEditors || db.editors).slice(0, 5)} kind="editor" />
                <StackGroup label="Operating systems" items={(allTimeOs || db.operating_systems).slice(0, 5)} kind="os" />
                <StackGroup label="Machines" items={db.machines.slice(0, 5)} />
              </div>
            </Section>

            {/* Projects */}
            <Section title="Projects" subtitle={liveStatsData?.projects ? 'All-time, from WakaTime' : 'From synced days'}>
              <BreakdownList items={allTimeProjects || db.projects} limit={12} />
            </Section>

            {/* Categories + dependencies + labels (live all-time only) */}
            {liveStatsData?.categories && (
              <Section title="Categories" subtitle="All-time, from WakaTime">
                <BreakdownList items={liveStatsData.categories as BreakdownItem[]} limit={10} />
              </Section>
            )}
            {liveStatsData?.dependencies && (
              <Section title="Dependencies" subtitle="All-time, from WakaTime">
                <BreakdownList items={liveStatsData.dependencies as BreakdownItem[]} limit={12} />
              </Section>
            )}
            {liveStatsData?.labels && liveStatsData.labels.length > 0 && (
              <Section title="Labels" subtitle="All-time, from WakaTime">
                <BreakdownList items={liveStatsData.labels as BreakdownItem[]} limit={12} />
              </Section>
            )}

            {/* AI usage */}
            <Section title="AI usage" subtitle="From synced days">
              <div className="space-y-5">
                {db.ai_models.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-600 mb-2">Models</h3>
                    <div className="space-y-1.5">
                      {db.ai_models.map((m) => (
                        <div key={m.name} className="flex items-center justify-between text-sm">
                          <span className="text-violet-600 dark:text-violet-400 truncate mr-2 min-w-0">🤖 {m.name}</span>
                          <span className="text-slate-500 dark:text-zinc-500 tabular-nums flex-shrink-0">
                            {formatLines(m.lines)} lines{m.cost > 0 ? ` · $${m.cost.toFixed(2)}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hasAiTokens && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <TokenStat label="Input tokens" value={formatLines(db.ai_tokens.input)} />
                    <TokenStat label="Output tokens" value={formatLines(db.ai_tokens.output)} />
                    <TokenStat label="Sessions" value={String(db.ai_tokens.sessions)} />
                    <TokenStat label="Prompt events" value={formatLines(db.ai_tokens.prompt_events)} />
                  </div>
                )}
                {db.ai_models.length === 0 && !hasAiTokens && (
                  <p className="text-sm text-slate-400 dark:text-zinc-600">No AI usage tracked yet.</p>
                )}
              </div>
            </Section>

            {/* Daily history */}
            <Section title="Daily history" subtitle={`${db.daily.length} synced day(s)`}>
              <DailyTable rows={db.daily} />
            </Section>

            {/* Past seasons archive */}
            <Section title="Past seasons" subtitle="Stats from before each admin-triggered reset">
              <button
                onClick={toggleSeasons}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${seasonsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
                {seasonsOpen ? 'Hide past seasons' : 'Show past seasons'}
              </button>
              {seasonsOpen && (
                <div className="mt-4">
                  {seasonsLoading ? (
                    <p className="text-sm text-slate-400 dark:text-zinc-600">Loading...</p>
                  ) : (
                    <SeasonArchiveTable seasons={seasons || []} />
                  )}
                </div>
              )}
            </Section>

            {/* Raw data dump */}
            <Section title="Raw data" subtitle="Every field returned by the API">
              <button
                onClick={() => setRawOpen((o) => !o)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${rawOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
                {rawOpen ? 'Hide raw JSON' : 'Show raw JSON'}
              </button>
              {rawOpen && (
                <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-slate-950 text-slate-100 text-xs p-4 leading-relaxed">
                  {JSON.stringify(data, null, 2)}
                </pre>
              )}
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-600">{label}</p>
      <p className={`mt-0.5 text-sm text-slate-800 dark:text-white truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

function StackGroup({ label, items, kind }: { label: string; items: BreakdownItem[]; kind?: 'editor' | 'os' }) {
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-600 mb-2">{label}</h3>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-zinc-600">—</p>
        ) : (
          items.map((it) => {
            const pct = it.percent ?? 0;
            return (
              <div key={it.name} className="flex items-center gap-2 text-sm text-slate-800 dark:text-white min-w-0">
                {iconFor(it.name, kind)}
                <span className="truncate flex-1">{it.name}</span>
                <span className="text-xs text-slate-500 dark:text-zinc-500 tabular-nums flex-shrink-0">
                  {it.seconds ? formatDuration(it.seconds) : ''} · {pct.toFixed(1)}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function TokenStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-600">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
    </div>
  );
}

function deltaLabel(delta: number | null, today: number, yesterday: number): string {
  if (today === 0 && yesterday === 0) return '—';
  if (delta === null) return 'New';
  if (delta > 0) return `▲ ${delta}%`;
  if (delta < 0) return `▼ ${Math.abs(delta)}%`;
  return '= 0%';
}
