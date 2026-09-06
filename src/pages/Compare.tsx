import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  LeaderboardEntry,
  CompareStats,
  CardScope,
  UserCard,
  UserCardWithProfile,
  formatDuration,
  formatLines,
  formatDate,
} from '../api';
import { Header } from '../components/Header';
import { PlayerCard, CARD_TYPE_LABEL } from '../components/PlayerCard';
import { hashHue } from '../components/StatsPanel';

const MAX_USERS = 8;
const MIN_USERS = 2;

/** Per-user avatar with an error fallback to a hue-tinted initial. */
function ColumnAvatar({ user }: { user: LeaderboardEntry }) {
  const [failed, setFailed] = useState(false);
  const hue = hashHue(user.username);
  if (user.photo_url && !failed) {
    return (
      <img
        src={user.photo_url}
        alt={user.username}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200 dark:ring-zinc-700 flex-shrink-0"
      />
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ring-2 ring-slate-200 dark:ring-zinc-700"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 46%), hsl(${(hue + 40) % 360} 60% 36%))` }}
    >
      {(user.display_name || user.username).charAt(0).toUpperCase()}
    </div>
  );
}

type RowKind = 'duration' | 'lines' | 'number' | 'percent' | 'tokens' | 'money' | 'date' | 'text';
type RowDirection = 'win' | 'loss';

interface CompareRow {
  label: string;
  kind: RowKind;
  get: (s: CompareStats) => number | string | null;
  /**
   * Card-sourced rows read from the user's FUT card instead of CompareStats.
   * When present, SectionRows and the score footer use this over `get`.
   */
  getCard?: (c: UserCard) => number | string | null;
  /** win = higher is better (default), loss = lower is better (e.g. AI usage) */
  direction?: RowDirection;
  sub?: (s: CompareStats) => string | null;
}

interface CompareSection {
  title: string;
  rows: CompareRow[];
}

interface Column {
  id: number;
  user: LeaderboardEntry | null;
  stats: CompareStats | null | undefined;
  loading: boolean;
  card: UserCardWithProfile | null | undefined;
  cardLoading: boolean;
}

const NUMERIC_KINDS: RowKind[] = ['duration', 'lines', 'number', 'percent', 'tokens', 'money'];

const timeRows = (p: 'daily' | 'weekly' | 'all_time'): CompareRow[] => [
  { label: 'Total time', kind: 'duration', get: (s) => s[p].total_seconds },
  { label: 'Human time', kind: 'duration', get: (s) => s[p].human_seconds },
  { label: 'AI time', kind: 'duration', direction: 'loss', get: (s) => s[p].ai_seconds },
  { label: 'Human lines', kind: 'lines', get: (s) => s[p].human_lines },
  { label: 'AI lines', kind: 'lines', direction: 'loss', get: (s) => s[p].ai_lines },
];

const SECTIONS: CompareSection[] = [
  { title: 'Daily · today', rows: timeRows('daily') },
  { title: 'Weekly · last 7 days', rows: timeRows('weekly') },
  { title: 'All-time · since tracking', rows: timeRows('all_time') },
  {
    title: 'Overall',
    rows: [
      { label: 'All-time (WakaTime)', kind: 'duration', get: (s) => s.all_time_wakatime },
      {
        label: 'Days active',
        kind: 'number',
        get: (s) => s.days_active,
        sub: (s) => `/ ${s.days_tracked} tracked`,
      },
      { label: 'Active %', kind: 'percent', get: (s) => s.active_pct },
      {
        label: 'Current streak',
        kind: 'number',
        get: (s) => s.current_streak,
        sub: (s) => `/ ${s.longest_streak} best`,
      },
      { label: 'Longest streak', kind: 'number', get: (s) => s.longest_streak },
      {
        label: 'Best day',
        kind: 'duration',
        get: (s) => s.best_day?.seconds ?? 0,
        sub: (s) => (s.best_day ? formatDate(s.best_day.date) : null),
      },
      { label: 'AI tokens (input)', kind: 'tokens', direction: 'loss', get: (s) => s.ai_tokens.input },
      { label: 'AI tokens (output)', kind: 'tokens', direction: 'loss', get: (s) => s.ai_tokens.output },
      { label: 'AI sessions', kind: 'number', direction: 'loss', get: (s) => s.ai_tokens.sessions },
      {
        label: 'Top AI model',
        kind: 'text',
        get: (s) => s.top_ai_model,
        sub: (s) =>
          s.top_ai_model ? `${formatLines(s.ai_model_lines)} lines · $${s.ai_model_cost.toFixed(2)}` : null,
      },
      { label: 'AI model cost', kind: 'money', direction: 'loss', get: (s) => s.ai_model_cost },
    ],
  },
  {
    title: 'Favorites',
    rows: [
      { label: 'Top language', kind: 'text', get: (s) => s.top_language },
      { label: 'Top editor', kind: 'text', get: (s) => s.top_editor },
      { label: 'Top project', kind: 'text', get: (s) => s.top_project },
    ],
  },
];

/**
 * FUT card ratings, compared like any other stat. Card numbers are
 * percentile ranks (55-99) against the whole group, so higher is better
 * across the board - they join the scored rows automatically.
 */
const FUT_SECTION: CompareSection = {
  title: 'FUT Card',
  rows: [
    { label: 'Overall', kind: 'number', get: () => null, getCard: (c) => c.overall },
    { label: 'PAC', kind: 'number', get: () => null, getCard: (c) => c.pac },
    { label: 'SHO', kind: 'number', get: () => null, getCard: (c) => c.sho },
    { label: 'PAS', kind: 'number', get: () => null, getCard: (c) => c.pas },
    { label: 'DRI', kind: 'number', get: () => null, getCard: (c) => c.dri },
    { label: 'DEF', kind: 'number', get: () => null, getCard: (c) => c.def },
    { label: 'PHY', kind: 'number', get: () => null, getCard: (c) => c.phy },
    { label: 'Position', kind: 'text', get: () => null, getCard: (c) => c.position },
    {
      label: 'Card type',
      kind: 'text',
      get: () => null,
      getCard: (c) => `${CARD_TYPE_LABEL[c.cardType]}${c.provisional ? ' · provisional' : ''}`,
    },
  ],
};

const ALL_SECTIONS = [FUT_SECTION, ...SECTIONS];
const ALL_ROWS = ALL_SECTIONS.flatMap((s) => s.rows);
const SCORED_ROWS = ALL_ROWS.filter((r) => NUMERIC_KINDS.includes(r.kind));

function formatCount(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${(v % 1_000_000 === 0 ? m.toFixed(0) : m.toFixed(1)).replace(/\.0$/, '')}M`;
  }
  if (v >= 1000) {
    const k = v / 1000;
    return `${(v % 1000 === 0 ? k.toFixed(0) : k.toFixed(1)).replace(/\.0$/, '')}k`;
  }
  return String(v);
}

function formatCell(kind: RowKind, value: number | string | null): string {
  if (value === null || value === undefined) return '—';
  switch (kind) {
    case 'duration':
      return formatDuration(Number(value));
    case 'lines':
      return formatLines(Number(value));
    case 'number':
      return Math.round(Number(value)).toLocaleString();
    case 'percent':
      return `${Math.round(Number(value))}%`;
    case 'tokens':
      return formatCount(Number(value));
    case 'money':
      return `$${Number(value).toFixed(2)}`;
    case 'date':
      return value ? formatDate(String(value)) : '—';
    default:
      return String(value) || '—';
  }
}

/**
 * Compare page - side-by-side, table-style stat comparison for two or more
 * users. Pure DB data (getCompareStats -> /api/user/:id/compare). Daily,
 * weekly and all-time buckets are compared; the better value per metric is
 * tinted green, and a score footer shows who won the most stats.
 */
export function Compare() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<LeaderboardEntry[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [statsMap, setStatsMap] = useState<Record<number, CompareStats | null>>({});
  const [loadingIds, setLoadingIds] = useState<number[]>([]);
  const pendingRef = useRef<Set<number>>(new Set());
  const [cardScope, setCardScope] = useState<CardScope>('season');
  const [cardsByScope, setCardsByScope] = useState<
    Partial<Record<CardScope, Record<number, UserCardWithProfile>>>
  >({});

  useEffect(() => {
    let cancelled = false;
    api
      .getDashboard()
      .then((data) => {
        if (cancelled) return;
        const list = data.today;
        setUsers(list);
        setSelectedIds(list.slice(0, MIN_USERS).map((e) => e.user_id));
      })
      .catch((err: Error) => {
        if (!cancelled) setUsersError(err.message || 'Could not load users');
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch compare stats (DB only) for every selected user that isn't pending.
  useEffect(() => {
    for (const id of selectedIds) {
      if (statsMap[id] !== undefined || pendingRef.current.has(id)) continue;
      pendingRef.current.add(id);
      setLoadingIds((prev) => [...prev, id]);
      api
        .getCompareStats(id)
        .then((stats) => setStatsMap((m) => ({ ...m, [id]: stats })))
        .catch(() => setStatsMap((m) => ({ ...m, [id]: null })))
        .finally(() => {
          pendingRef.current.delete(id);
          setLoadingIds((prev) => prev.filter((x) => x !== id));
        });
    }
  }, [selectedIds, statsMap]);

  // FUT cards for the selected scope, one bulk request per scope - cached so
  // toggling back and forth doesn't refetch.
  useEffect(() => {
    if (cardsByScope[cardScope] !== undefined) return;
    let cancelled = false;
    api
      .getAllCards(cardScope)
      .then((result) => {
        if (cancelled) return;
        const map: Record<number, UserCardWithProfile> = {};
        for (const c of result.cards) map[c.user_id] = c;
        setCardsByScope((m) => ({ ...m, [cardScope]: map }));
      })
      .catch(() => {
        if (!cancelled) setCardsByScope((m) => ({ ...m, [cardScope]: {} }));
      });
    return () => {
      cancelled = true;
    };
  }, [cardScope, cardsByScope]);

  const userById = useMemo(() => {
    const map = new Map<number, LeaderboardEntry>();
    for (const u of users) map.set(u.user_id, u);
    return map;
  }, [users]);

  const scopeCards = cardsByScope[cardScope];

  const columns = useMemo<Column[]>(
    () =>
      selectedIds.map((id) => ({
        id,
        user: userById.get(id) ?? null,
        stats: statsMap[id] === undefined ? undefined : statsMap[id],
        loading: loadingIds.includes(id),
        card: scopeCards === undefined ? undefined : (scopeCards[id] ?? null),
        cardLoading: scopeCards === undefined,
      })),
    [selectedIds, userById, statsMap, loadingIds, scopeCards]
  );

  // Score: count how many numeric stats each user wins (ties count for all).
  const score = useMemo(() => {
    const counts = columns.map(() => 0);
    for (const row of SCORED_ROWS) {
      const vals = columns.map((c) => {
        if (row.getCard) return c.card ? Number(row.getCard(c.card)) : NaN;
        return c.stats ? Number(row.get(c.stats)) : NaN;
      });
      const max = Math.max(...vals);
      if (Number.isFinite(max) && max > 0) {
        vals.forEach((v, i) => {
          if (v === max) counts[i] += 1;
        });
      }
    }
    return counts;
  }, [columns]);

  const overallMax = score.length ? Math.max(...score) : 0;
  const leaders = columns
    .map((col, i) => ({ col, wins: score[i] }))
    .filter((s) => s.wins === overallMax && s.wins > 0);

  const handleChangeUser = (index: number, newId: number) => {
    setSelectedIds((prev) => prev.map((id, i) => (i === index ? newId : id)));
  };

  const handleRemoveUser = (id: number) => {
    setSelectedIds((prev) => (prev.length <= MIN_USERS ? prev : prev.filter((x) => x !== id)));
  };

  const handleAddUser = () => {
    setSelectedIds((prev) => {
      if (prev.length >= MAX_USERS) return prev;
      const next = users.find((u) => !prev.includes(u.user_id));
      return next ? [...prev, next.user_id] : prev;
    });
  };

  const allSelected = selectedIds.length >= users.length || selectedIds.length >= MAX_USERS;

  if (usersLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0b]">
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="w-40 h-5 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
            <div className="h-64 bg-slate-200 dark:bg-zinc-800 rounded animate-shimmer" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0b]">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors mb-5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
              <line x1="13" y1="19" x2="19" y2="13" />
              <line x1="16" y1="16" x2="20" y2="20" />
              <line x1="19" y1="21" x2="21" y2="19" />
              <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
              <line x1="5" y1="14" x2="9" y2="18" />
              <line x1="7" y1="17" x2="4" y2="20" />
              <line x1="3" y1="19" x2="5" y2="21" />
            </svg>
            Compare users
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-500 mt-1">
            Two or more users, every comparable stat from our database — daily, weekly,
            all-time, plus FUT card ratings (relative to the whole group, not absolute).
            Green = best value for that stat.
          </p>
          </div>
          <div
            className="inline-flex rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5 shrink-0"
            title="FUT card scope"
          >
            <button
              onClick={() => setCardScope('season')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                cardScope === 'season'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
              }`}
            >
              This season
            </button>
            <button
              onClick={() => setCardScope('career')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                cardScope === 'career'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
              }`}
            >
              Career
            </button>
          </div>
        </div>

        {usersError ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-10 text-center">
            <p className="text-slate-500 dark:text-zinc-500 font-medium">Could not load users</p>
            <p className="text-sm text-slate-400 dark:text-zinc-600 mt-1">{usersError}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-10 text-center">
            <p className="text-slate-500 dark:text-zinc-500 font-medium">No users yet</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800">
                      <th className="sticky left-0 bg-white dark:bg-zinc-900 z-10 text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                        Metric
                      </th>
                      {columns.map((col, index) => {
                        const hue = col.user ? hashHue(col.user.username) : 0;
                        return (
                          <th key={col.id} className="px-4 py-3 text-left align-top min-w-[160px]">
                            <div className="relative">
                              <div
                                className="absolute -top-3 left-0 right-0 h-[3px]"
                                style={{ background: `hsl(${hue} 65% 50%)` }}
                              />
                              <div className="mb-3 flex flex-col items-center">
                                {col.cardLoading ? (
                                  <div className="w-[160px] h-[224px] bg-slate-100 dark:bg-zinc-800 rounded-2xl animate-shimmer" />
                                ) : col.card ? (
                                  <>
                                    <PlayerCard
                                      card={col.card}
                                      name={
                                        col.user?.display_name ||
                                        col.user?.username ||
                                        col.card.display_name ||
                                        col.card.username
                                      }
                                      photoUrl={col.user?.photo_url ?? col.card.photo_url}
                                      width={160}
                                    />
                                    <p className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                                      {CARD_TYPE_LABEL[col.card.cardType]} · {col.card.position}
                                      {col.card.provisional && (
                                        <span className="text-amber-600 dark:text-amber-400"> · provisional</span>
                                      )}
                                    </p>
                                  </>
                                ) : (
                                  <div className="w-[160px] h-[224px] flex items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 text-[11px] text-slate-400 dark:text-zinc-600 text-center px-4">
                                    No card yet
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {col.user && <ColumnAvatar user={col.user} />}
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 dark:text-white truncate leading-tight">
                                    {col.user ? col.user.display_name || col.user.username : '…'}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-zinc-500 truncate">
                                    {col.user ? `@${col.user.username}` : '…'}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2.5 flex items-center gap-2">
                                <select
                                  value={col.id}
                                  onChange={(e) => handleChangeUser(index, Number(e.target.value))}
                                  className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-xs text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                  {users.map((u) => (
                                    <option
                                      key={u.user_id}
                                      value={u.user_id}
                                      disabled={selectedIds.some((id, i) => i !== index && id === u.user_id)}
                                    >
                                      {u.display_name || u.username}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleRemoveUser(col.id)}
                                  disabled={selectedIds.length <= MIN_USERS}
                                  title={selectedIds.length <= MIN_USERS ? 'Need at least two users' : 'Remove user'}
                                  className="flex-shrink-0 w-6 h-6 rounded-md text-slate-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                      <th className="px-4 py-3 align-top">
                        <button
                          onClick={handleAddUser}
                          disabled={allSelected}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 border border-dashed border-slate-300 dark:border-zinc-700 rounded-lg hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Add user
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <SectionRows
                      section={{
                        ...FUT_SECTION,
                        title: `FUT Card · ${cardScope === 'season' ? 'season' : 'career'}`,
                      }}
                      columns={columns}
                    />
                    {SECTIONS.map((section) => (
                      <SectionRows key={section.title} section={section} columns={columns} />
                    ))}
                    {/* Score footer */}
                    <tr className="bg-slate-50 dark:bg-zinc-800/50 border-t-2 border-slate-200 dark:border-zinc-700">
                      <td className="sticky left-0 bg-slate-50 dark:bg-zinc-800/50 z-10 px-4 py-3 font-bold text-slate-700 dark:text-zinc-200 whitespace-nowrap">
                        Stats won
                      </td>
                      {columns.map((col, i) => {
                        const isBest = score[i] === overallMax && overallMax > 0;
                        return (
                          <td
                            key={col.id}
                            className={`px-4 py-3 text-center whitespace-nowrap font-bold ${
                              isBest
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-500 dark:text-zinc-400'
                            }`}
                          >
                            {score[i]}
                            <span className="block text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                              / {SCORED_ROWS.length}
                            </span>
                          </td>
                        );
                      })}
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Overall verdict */}
            {overallMax > 0 && (
              <div className="mt-4 bg-gradient-to-r from-emerald-500/10 via-transparent to-amber-500/10 dark:from-emerald-500/10 dark:via-transparent dark:to-amber-500/10 border border-emerald-500/20 dark:border-emerald-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
                <span className="text-2xl">{leaders.length === 1 ? '🏆' : '🤝'}</span>
                <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-200">
                  {leaders.length === 1 ? (
                    <>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {(leaders[0].col.user?.display_name || leaders[0].col.user?.username)}
                      </span>{' '}
                      wins <span className="font-semibold">{overallMax}</span> of{' '}
                      <span className="font-semibold">{SCORED_ROWS.length}</span> stats
                    </>
                  ) : (
                    <>
                      It's a tie between{' '}
                      <span className="font-semibold">
                        {leaders.map((l) => l.col.user?.display_name || l.col.user?.username).join(' & ')}
                      </span>{' '}
                      — <span className="font-semibold">{overallMax}</span> stats each
                    </>
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SectionRows({ section, columns }: { section: CompareSection; columns: Column[] }) {
  return (
    <>
      <tr className="bg-slate-100/70 dark:bg-zinc-800/60">
        <td
          colSpan={columns.length + 1}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400"
        >
          {section.title}
        </td>
      </tr>
      {section.rows.map((row) => {
        const isNumeric = NUMERIC_KINDS.includes(row.kind);
        const values = columns.map((col) =>
          row.getCard
            ? col.card
              ? Number(row.getCard(col.card))
              : null
            : col.stats && isNumeric
              ? Number(row.get(col.stats))
              : null
        );
        const max = values.some((v) => v !== null)
          ? Math.max(...values.map((v) => v ?? -Infinity))
          : null;
        const highlight = max !== null && max > 0;
        return (
          <tr key={row.label} className="border-b border-slate-200 dark:border-zinc-800 last:border-b-0">
            <td className="sticky left-0 bg-white dark:bg-zinc-900 z-10 px-4 py-3 font-medium text-slate-600 dark:text-zinc-300 whitespace-nowrap">
              {row.label}
            </td>
            {columns.map((col) => {
              const loading = col.loading || (row.getCard ? col.cardLoading : false);
              let content: React.ReactNode;
              if (loading) {
                content = (
                  <span className="inline-block w-12 h-3 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
                );
              } else if (row.getCard ? !col.card : !col.stats) {
                content = '—';
              } else {
                const value =
                  row.getCard && col.card ? row.getCard(col.card) : row.get(col.stats!);
                const raw = isNumeric ? Number(value) : null;
                const isBest = highlight && raw !== null && raw === max;
                content = (
                  <>
                    <span>{formatCell(row.kind, value)}</span>
                    {isBest && (
                      <span className="text-[10px] font-semibold align-top ml-1">▲</span>
                    )}
                    {row.sub && col.stats && (
                      <span className="block text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                        {row.sub(col.stats)}
                      </span>
                    )}
                  </>
                );
              }
              const isBestCell =
                !loading &&
                highlight &&
                (row.getCard
                  ? col.card
                    ? Number(row.getCard(col.card)) === max
                    : false
                  : col.stats
                    ? Number(row.get(col.stats)) === max
                    : false);
              return (
                <td
                  key={col.id}
                  className={`px-4 py-3 text-center whitespace-nowrap ${
                    isBestCell
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  {content}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
