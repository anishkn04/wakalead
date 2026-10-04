import { Link } from 'react-router-dom';
import { Header } from '../components/Header';

/**
 * The full rulebook - how FUT cards, tiers, and the season title are
 * decided. Mirrors docs/CRITERIA.md; update both when rules change.
 */

const ATTRS = [
  { short: 'PAC', name: 'Pace', desc: 'Active coding time', formula: 'human_seconds + 0.7 × ai_seconds', chip: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  { short: 'SHO', name: 'Shooting', desc: 'Lines written', formula: 'human_lines + 0.3 × ai_lines', chip: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  { short: 'PAS', name: 'Passing', desc: 'Projects + languages with 30+ minutes each', formula: 'count(names ≥ 30 min)', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { short: 'DRI', name: 'Dribbling', desc: 'Editors + OSs with 30+ minutes each', formula: 'count(names ≥ 30 min)', chip: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  { short: 'DEF', name: 'Defending', desc: 'Consistency: active days ÷ tracked days (a day counts at 40+ min)', formula: 'active ÷ tracked', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { short: 'PHY', name: 'Physical', desc: '60% longest streak + 40% avg time across your top 2 projects, ranked separately then blended', formula: '0.6 × streak + 0.4 × projects', chip: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
];

const TIERS = [
  { name: 'White Icon', desc: 'Every stat 90+ and reigning champion and 2+ titles. The crowned legend — absorbs the Icon slot, so no separate Icon exists that season.', badge: 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' },
  { name: 'Icon', desc: 'Reigning champion — most daily wins last season. Exactly one holder, passes at every reset.', badge: 'bg-yellow-400 text-yellow-950' },
  { name: 'Hero', desc: '#1 overall in the cohort right now. Re-decided every computation.', badge: 'bg-purple-500 text-white' },
  { name: 'On Form', desc: 'More than 24 hours coded in the trailing 7 days. The red-hot right-now card.', badge: 'bg-red-500 text-white' },
  { name: 'Gold', desc: 'Overall 75+, and none of the above.', badge: 'bg-gradient-to-r from-yellow-500 to-amber-400 text-white' },
  { name: 'Silver', desc: 'Everyone else. Still a card. Still on the board.', badge: 'bg-slate-300 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200' },
];

export function Criteria() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0b]">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Link
          to="/"
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to leaderboard
        </Link>

        {/* Hero */}
        <div className="mt-3 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-[1.5px] shadow-lg shadow-purple-500/20">
          <div className="rounded-3xl bg-white/95 dark:bg-zinc-900/95 px-6 py-8 text-center backdrop-blur">
            <p className="text-3xl">📜⚖️🏆</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                The Rulebook
              </span>
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              How cards, tiers &amp; titles are <em>actually</em> decided. No dhadhali. Only math. Every number below is live right now.
            </p>
          </div>
        </div>

        {/* Attributes */}
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            ✨ The 6 attributes
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
            Each stat is your <strong>percentile rank against everyone else</strong>, rescaled so
            even last place still looks respectable:{' '}
            <code className="text-xs bg-slate-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">
              rating = round(55 + percentile × 44)
            </code>{' '}
            <strong>Overall</strong> is the average of the six, rounded.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ATTRS.map((a) => (
              <div
                key={a.short}
                className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-11 h-8 rounded-lg text-xs font-black ${a.chip}`}>
                    {a.short}
                  </span>
                  <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">{a.name}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">{a.desc}</p>
                <code className="mt-2 inline-block text-[11px] bg-slate-100 dark:bg-zinc-800 rounded-lg px-2 py-1 text-slate-600 dark:text-zinc-300">
                  {a.formula}
                </code>
              </div>
            ))}
          </div>
        </section>

        {/* Tiers */}
        <section className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            🏅 Card tiers — first match wins
          </h2>
          <div className="mt-4 space-y-3">
            {TIERS.map((t, i) => (
              <div
                key={t.name}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <span className="mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 text-xs font-black text-slate-500 dark:text-zinc-400 shrink-0">
                  {i + 1}
                </span>
                <div>
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-black ${t.badge}`}>
                    {t.name}
                  </span>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-zinc-300">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Title race */}
        <section className="mt-10 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-950/40 dark:to-yellow-950/20 border border-amber-200 dark:border-amber-900/50 p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            🏁 The season title race
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
            Each season crowns one champion from its frozen history: whoever has the{' '}
            <strong>most daily wins</strong> (topped the daily board, with real activity —
            dead days crown nobody). Ties go to the lower user id. The previous season's
            champion is the reigning <strong>Icon</strong>.
          </p>
        </section>

        {/* Standings */}
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            🏎️ Season standings table
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {[
              ['Pts', 'F1 points per daily rank'],
              ['P1 / P2 / P3', 'Daily podiums'],
              ['DNF', 'Synced day, zero time'],
              ['Avg', 'Points per day, own window'],
            ].map(([k, v]) => (
              <div
                key={k}
                className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2"
                title={v}
              >
                <span className="font-black text-slate-800 dark:text-zinc-100">{k}</span>
                <span className="text-slate-500 dark:text-zinc-400"> — {v}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
            Ordered by wins. Most daily wins takes the crown if the season ended today.
          </p>
        </section>

        {/* Provisional */}
        <section className="mt-8 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            🐣 Provisional &amp; scope
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
            Cards with fewer than <strong>7 active days</strong> (or in a group smaller than{' '}
            <strong>4 people</strong>) are marked provisional — not enough data for a meaningful
            percentile yet. <strong>This season</strong> resets on every admin reset;{' '}
            <strong>Career</strong> spans everything ever synced.
          </p>
        </section>

        {/* The verdict */}
        <div className="mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-red-500 to-orange-400 p-[1.5px] shadow-lg shadow-red-500/20">
          <div className="rounded-3xl bg-zinc-950 px-6 py-8 text-center">
            <p className="text-3xl">⚖️🔥</p>
            <p className="mt-3 text-lg sm:text-xl font-black leading-snug text-white">
              "Dhadhali bhayo bhanera aayo bhane koi,<br />
              all we want to say is kaam gar randi haru, badi nabol."
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              — the official appeals process. Made with ❤️ for coders who grind.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
