import { useState, useEffect } from 'react';

interface TypingAnimationProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

/**
 * Typewriter effect for text
 * Creates a cool hacker-style typing animation
 */
export function TypingAnimation({ text, speed = 50, className = '', onComplete }: TypingAnimationProps) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    setDisplayText('');
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={className}>
      {displayText}
      <span className={`${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity`}>|</span>
    </span>
  );
}

interface CountUpProps {
  end: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}

/**
 * Animated number counter
 * Counts up from 0 to the target number
 */
export function CountUp({ end, duration = 2000, decimals = 0, suffix = '', className = '' }: CountUpProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(easeOutQuart * end);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return (
    <span className={className}>
      {count.toFixed(decimals)}{suffix}
    </span>
  );
}

interface FlameEffectProps {
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

/**
 * Animated flame effect for top performers - subtle version
 */
export function FlameEffect({ className = '' }: FlameEffectProps) {
  return (
    <span className={`flame inline-block ${className}`}>
      🔥
    </span>
  );
}

interface PulsingDotProps {
  color?: string;
  className?: string;
}

/**
 * Live pulsing indicator - minimal
 */
export function PulsingDot({ color = 'bg-emerald-500', className = '' }: PulsingDotProps) {
  return (
    <span className={`relative inline-flex h-2 w-2 ${className}`}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`}></span>
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`}></span>
    </span>
  );
}

interface GlowingTextProps {
  children: React.ReactNode;
  color?: 'gold' | 'silver' | 'bronze' | 'purple' | 'blue';
  className?: string;
}

/**
 * Text with animated glow effect
 */
export function GlowingText({ children, color = 'gold', className = '' }: GlowingTextProps) {
  const colorClasses = {
    gold: 'text-amber-500 glow-gold',
    silver: 'text-gray-400 glow-silver',
    bronze: 'text-orange-500 glow-bronze',
    purple: 'text-purple-500 glow-purple',
    blue: 'text-blue-500 glow-blue',
  };

  return (
    <span className={`${colorClasses[color]} ${className}`}>
      {children}
    </span>
  );
}

interface ShakeOnHoverProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Element that shakes on hover
 */
export function ShakeOnHover({ children, className = '' }: ShakeOnHoverProps) {
  return (
    <span className={`hover:animate-shake cursor-pointer ${className}`}>
      {children}
    </span>
  );
}

interface RankBadgeProps {
  rank: number;
  previousRank?: number;
  className?: string;
}

/**
 * Animated rank badge with change indicator
 */
export function RankBadge({ rank, previousRank, className = '' }: RankBadgeProps) {
  const change = previousRank ? previousRank - rank : 0;
  
  const getBadgeStyle = () => {
    if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-amber-600 text-white shadow-lg shadow-amber-500/30';
    if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-lg shadow-gray-400/30';
    if (rank === 3) return 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30';
    return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  };

  return (
    <div className={`relative ${className}`}>
      <div className={`
        w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm
        ${getBadgeStyle()}
        ${rank === 1 ? 'animate-pulse-glow' : ''}
      `}>
        {rank}
      </div>
      {change !== 0 && (
        <span className={`
          absolute -top-1 -right-1 text-[10px] font-bold px-1 rounded
          ${change > 0 ? 'bg-green-500 text-white animate-bounce-in' : 'bg-red-500 text-white'}
        `}>
          {change > 0 ? `↑${change}` : `↓${Math.abs(change)}`}
        </span>
      )}
    </div>
  );
}

interface StreakCounterProps {
  days: number;
  className?: string;
}

/**
 * Coding streak counter with fire animation
 */
export function StreakCounter({ days, className = '' }: StreakCounterProps) {
  if (days <= 0) return null;

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <span className={`
        ${days >= 7 ? 'animate-flame' : ''}
        ${days >= 30 ? 'text-2xl' : 'text-lg'}
      `}>
        {days >= 30 ? '🔥🔥🔥' : days >= 7 ? '🔥🔥' : '🔥'}
      </span>
      <span className="font-bold text-orange-500 dark:text-orange-400">
        {days} day{days !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
