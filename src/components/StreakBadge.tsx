interface StreakPillProps {
  icon: 'flame' | 'trophy';
  count: number;
  unit: string;
  label: string;
}

const ICON = {
  flame: '🔥',
  trophy: '🏆',
};

const ICON_CLASS = {
  flame: 'flame',
  trophy: '',
};

/**
 * Small inline pill showing a live rank-#1 streak (day flame or week trophy).
 */
export function StreakPill({ icon, count, unit, label }: StreakPillProps) {
  return (
    <span
      title={label}
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/30 text-orange-700 dark:text-orange-400 whitespace-nowrap"
    >
      <span className={ICON_CLASS[icon]}>{ICON[icon]}</span>
      {count}
      {unit}
    </span>
  );
}
