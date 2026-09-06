import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, CardScope, UserCardWithProfile } from '../api';
import { PlayerCard, CARD_TYPE_LABEL } from './PlayerCard';

/**
 * Everyone's FUT-style card at once, sorted best overall first - the
 * "squad view" companion to the leaderboard above it.
 */
export function FutCardGallery() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<CardScope>('season');
  const [cards, setCards] = useState<UserCardWithProfile[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getAllCards(scope)
      .then((result) => {
        if (!cancelled) setCards(result.cards);
      })
      .catch((err) => {
        console.error('Error loading card gallery:', err);
        if (!cancelled) setCards([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-6">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">FUT Cards</h2>
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5">
          <button
            onClick={() => setScope('season')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              scope === 'season'
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
            }`}
          >
            This season
          </button>
          <button
            onClick={() => setScope('career')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              scope === 'career'
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
            }`}
          >
            Career
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex flex-wrap justify-center gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-[220px] h-[308px] bg-slate-100 dark:bg-zinc-800 rounded-2xl animate-shimmer" />
            ))}
          </div>
        )}

        {!loading && cards && cards.length === 0 && (
          <p className="text-center text-sm text-slate-400 dark:text-zinc-600 py-8">
            No cards yet - hit Sync to get everyone's stats in.
          </p>
        )}

        {!loading && cards && cards.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-8">
            {cards.map((c) => (
              <button
                key={c.user_id}
                onClick={() => navigate(`/profile/${c.username}`)}
                className="flex flex-col items-center gap-2 transition-transform hover:-translate-y-1"
              >
                <PlayerCard card={c} name={c.display_name || c.username} photoUrl={c.photo_url} width={220} />
                <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                  {CARD_TYPE_LABEL[c.cardType]} · {c.position}
                  {c.provisional && <span className="text-amber-600 dark:text-amber-400"> · provisional</span>}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
