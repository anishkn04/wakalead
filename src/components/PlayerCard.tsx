import { useEffect, useRef, useState } from 'react';
import { UserCard, CardType } from '../api';
import './PlayerCard.css';

const SKIN_CLASS: Record<CardType, string> = {
  icon: 'card-black',
  legend_hero: 'card-purple',
  white_icon: 'card-white',
  featured_red: 'card-red',
  base_gold: 'card-gold',
  base_silver: 'card-silver',
};

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  icon: 'Icon',
  legend_hero: 'Hero',
  white_icon: 'White Icon',
  featured_red: 'Featured',
  base_gold: 'Gold',
  base_silver: 'Silver',
};

const TREND_GLYPH: Record<UserCard['trend'], string> = {
  up: '▲',
  down: '▼',
  flat: '',
};

const TREND_COLOR: Record<UserCard['trend'], string> = {
  up: '#16a34a',
  down: '#dc2626',
  flat: 'transparent',
};

/**
 * Injects the card silhouette <clipPath> once per document - same shape
 * export/card-shape.js defines, ported to run once via a mounted component
 * instead of a plain script tag.
 */
function ensureCardShapeDef() {
  if (document.getElementById('pitch-card-shape')) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  const defs = document.createElementNS(NS, 'defs');
  const clipPath = document.createElementNS(NS, 'clipPath');
  clipPath.setAttribute('id', 'pitch-card-shape');
  clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M0.030,0.008 L0.970,0.008 C0.990,0.008 1,0.016 1,0.030 L1,0.800 C0.95,0.856 0.88,0.881 0.80,0.902 C0.68,0.928 0.58,0.946 0.50,1 C0.42,0.946 0.32,0.928 0.20,0.902 C0.12,0.881 0.05,0.856 0,0.800 L0,0.030 C0,0.016 0.010,0.008 0.030,0.008 Z');
  clipPath.appendChild(path);
  defs.appendChild(clipPath);
  svg.appendChild(defs);
  document.body.appendChild(svg);
}

interface PlayerCardProps {
  card: UserCard;
  name: string;
  photoUrl: string | null;
  width?: number;
  /** Shows a "Download card" button below the card that exports it as a PNG. */
  downloadable?: boolean;
}

export function PlayerCard({ card, name, photoUrl, width = 300, downloadable = false }: PlayerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    ensureCardShapeDef();
  }, []);

  const skinClass = SKIN_CLASS[card.cardType];
  const showHotStreakBadge = card.hotStreak !== null && card.cardType !== 'featured_red';

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });
      const link = document.createElement('a');
      link.download = `${name.replace(/\s+/g, '_')}_card.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error exporting card image:', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={cardRef}
        className={`pitch-card ${skinClass} ${card.provisional ? 'opacity-60 grayscale-[0.4]' : ''}`}
        style={{ '--card-width': `${width}px`, '--card-height': `${Math.round(width * 1.4)}px` } as React.CSSProperties}
      >
        <div className="card-body">
          <div className="card-pattern" />
          <div className="card-shine" />
        </div>
        <div className="card-edge" />

        {showHotStreakBadge && (
          <div
            className="absolute top-[9%] right-[9%] z-10 flex items-center gap-0.5 rounded-full bg-orange-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow"
            title={`${card.hotStreak} period streak`}
          >
            🔥 {card.hotStreak}
          </div>
        )}

        <div className="card-player">
          <img src={photoUrl || '/player-avatar-placeholder.png'} alt={name} />
        </div>
        <div className="card-meta">
          <div className="rating flex items-center gap-1">
            {card.overall}
            {card.trend !== 'flat' && (
              <span style={{ color: TREND_COLOR[card.trend], fontSize: '0.4em' }}>{TREND_GLYPH[card.trend]}</span>
            )}
          </div>
          <div className="position">{card.position}</div>
        </div>
        <div className="card-name">{name}</div>
        <div className="card-stats">
          <div className="stat"><span className="stat-value">{card.pac}</span><span className="stat-label">PAC</span></div>
          <div className="stat"><span className="stat-value">{card.sho}</span><span className="stat-label">SHO</span></div>
          <div className="stat"><span className="stat-value">{card.pas}</span><span className="stat-label">PAS</span></div>
          <div className="stat"><span className="stat-value">{card.dri}</span><span className="stat-label">DRI</span></div>
          <div className="stat"><span className="stat-value">{card.def}</span><span className="stat-label">DEF</span></div>
          <div className="stat"><span className="stat-value">{card.phy}</span><span className="stat-label">PHY</span></div>
        </div>
      </div>

      {downloadable && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {downloading ? 'Exporting...' : 'Download card'}
        </button>
      )}
    </div>
  );
}
