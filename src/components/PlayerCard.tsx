import { useEffect } from 'react';
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
}

export function PlayerCard({ card, name, photoUrl, width = 300 }: PlayerCardProps) {
  useEffect(() => {
    ensureCardShapeDef();
  }, []);

  const skinClass = SKIN_CLASS[card.cardType];

  return (
    <div
      className={`pitch-card ${skinClass} ${card.provisional ? 'opacity-60 grayscale-[0.4]' : ''}`}
      style={{ '--card-width': `${width}px`, '--card-height': `${Math.round(width * 1.4)}px` } as React.CSSProperties}
    >
      <div className="card-body">
        <div className="card-pattern" />
        <div className="card-shine" />
      </div>
      <div className="card-edge" />
      <div className="card-player">
        <img src={photoUrl || '/player-avatar-placeholder.png'} alt={name} />
      </div>
      <div className="card-meta">
        <div className="rating">{card.overall}</div>
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
  );
}
