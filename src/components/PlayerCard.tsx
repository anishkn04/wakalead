import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  featured_red: 'On Form',
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

interface ActiveTip {
  text: string;
  rect: { top: number; left: number; width: number };
}

function CardStat({
  label,
  value,
  tip,
  onShow,
  onHide,
}: {
  label: string;
  value: number;
  tip?: string;
  onShow: (text: string, el: HTMLElement) => void;
  onHide: () => void;
}) {
  if (!tip) {
    return (
      <div className="stat">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    );
  }
  return (
    <div
      className="stat stat-live"
      tabIndex={0}
      onMouseEnter={(e) => onShow(tip, e.currentTarget)}
      onMouseLeave={onHide}
      onFocus={(e) => onShow(tip, e.currentTarget)}
      onBlur={onHide}
      // Tapping a stat inside the gallery must not follow the card link.
      onClick={(e) => {
        e.stopPropagation();
        onShow(tip, e.currentTarget);
      }}
    >
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/**
 * Body-portalled tooltip for card stats. The card itself is clipped by its
 * silhouette (clip-path + overflow hidden), so any bubble rendered inside
 * it gets cut off at the edges - this one lives in document.body and is
 * positioned from the stat's bounding rect instead.
 */
function TipLayer({ tip }: { tip: ActiveTip | null }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!tip) return;
    const cx = tip.rect.left + tip.rect.width / 2;
    // Clamp without measuring the bubble: half of its max-width as margin.
    setLeft(Math.min(Math.max(cx, 120), window.innerWidth - 120));
  }, [tip]);
  if (!tip || left === null) return null;
  return createPortal(
    <div
      className="card-tip-portal"
      role="tooltip"
      style={{ left, top: Math.max(tip.rect.top - 8, 4) }}
    >
      {tip.text}
    </div>,
    document.body
  );
}

export function PlayerCard({ card, name, photoUrl, width = 300, downloadable = false }: PlayerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [tip, setTip] = useState<ActiveTip | null>(null);

  useEffect(() => {
    ensureCardShapeDef();
  }, []);

  // The anchor moves on scroll/resize - dismiss instead of chasing it.
  useEffect(() => {
    if (!tip) return;
    const dismiss = () => setTip(null);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [tip]);

  const showTip = (text: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setTip({ text, rect: { top: r.top, left: r.left, width: r.width } });
  };
  const hideTip = () => setTip(null);

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
          <div
            className="rating flex items-center gap-1 stat-live"
            tabIndex={0}
            onMouseEnter={(e) => card.catchUp?.overall.text && showTip(card.catchUp.overall.text, e.currentTarget)}
            onMouseLeave={hideTip}
            onFocus={(e) => card.catchUp?.overall.text && showTip(card.catchUp.overall.text, e.currentTarget)}
            onBlur={hideTip}
            onClick={(e) => {
              e.stopPropagation();
              if (card.catchUp?.overall.text) showTip(card.catchUp.overall.text, e.currentTarget);
            }}
          >
            {card.overall}
            {card.trend !== 'flat' && (
              <span style={{ color: TREND_COLOR[card.trend], fontSize: '0.4em' }}>{TREND_GLYPH[card.trend]}</span>
            )}
          </div>
          <div className="position">{card.position}</div>
        </div>
        <div className="card-name">{name}</div>
        <div className="card-stats">
          <CardStat label="PAC" value={card.pac} tip={card.catchUp?.pac.text} onShow={showTip} onHide={hideTip} />
          <CardStat label="SHO" value={card.sho} tip={card.catchUp?.sho.text} onShow={showTip} onHide={hideTip} />
          <CardStat label="PAS" value={card.pas} tip={card.catchUp?.pas.text} onShow={showTip} onHide={hideTip} />
          <CardStat label="DRI" value={card.dri} tip={card.catchUp?.dri.text} onShow={showTip} onHide={hideTip} />
          <CardStat label="DEF" value={card.def} tip={card.catchUp?.def.text} onShow={showTip} onHide={hideTip} />
          <CardStat label="PHY" value={card.phy} tip={card.catchUp?.phy.text} onShow={showTip} onHide={hideTip} />
        </div>
      </div>

      {/* Tap readout for touch (no hover there): desktop uses the portal
          bubble above and never sees this line. */}
      {tip && <p className="card-tip-caption">{tip.text}</p>}
      <TipLayer tip={tip} />

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
