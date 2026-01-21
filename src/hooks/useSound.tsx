import { useCallback, useRef, useState, createContext, useContext, ReactNode } from 'react';

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
  playSound: (sound: SoundType) => void;
}

type SoundType = 'pop' | 'whoosh' | 'success' | 'click' | 'levelup' | 'notification';

const SoundContext = createContext<SoundContextType | undefined>(undefined);

// Web Audio API based sounds (no external files needed)
const createOscillatorSound = (
  audioContext: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.1
) => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
};

const playSoundEffect = (audioContext: AudioContext, sound: SoundType) => {
  switch (sound) {
    case 'pop':
      createOscillatorSound(audioContext, 600, 0.1, 'sine', 0.15);
      setTimeout(() => createOscillatorSound(audioContext, 800, 0.05, 'sine', 0.1), 50);
      break;
    
    case 'whoosh':
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          createOscillatorSound(audioContext, 200 + i * 100, 0.08, 'sine', 0.05);
        }, i * 30);
      }
      break;
    
    case 'success':
      createOscillatorSound(audioContext, 523.25, 0.15, 'sine', 0.12); // C5
      setTimeout(() => createOscillatorSound(audioContext, 659.25, 0.15, 'sine', 0.12), 100); // E5
      setTimeout(() => createOscillatorSound(audioContext, 783.99, 0.2, 'sine', 0.12), 200); // G5
      break;
    
    case 'click':
      createOscillatorSound(audioContext, 1000, 0.05, 'square', 0.05);
      break;
    
    case 'levelup':
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        setTimeout(() => createOscillatorSound(audioContext, freq, 0.15, 'sine', 0.1), i * 80);
      });
      break;
    
    case 'notification':
      createOscillatorSound(audioContext, 880, 0.1, 'sine', 0.1);
      setTimeout(() => createOscillatorSound(audioContext, 1100, 0.15, 'sine', 0.1), 100);
      break;
  }
};

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('soundEnabled') === 'true';
    }
    return false;
  });
  
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('soundEnabled', String(newValue));
      return newValue;
    });
  }, []);

  const playSound = useCallback((sound: SoundType) => {
    if (!soundEnabled) return;
    
    try {
      const audioContext = getAudioContext();
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      playSoundEffect(audioContext, sound);
    } catch (e) {
      console.warn('Could not play sound:', e);
    }
  }, [soundEnabled, getAudioContext]);

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound, playSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}

/**
 * Sound toggle button component - Clean, minimal design
 */
export function SoundToggle() {
  const { soundEnabled, toggleSound, playSound } = useSound();

  const handleClick = () => {
    toggleSound();
    if (!soundEnabled) {
      setTimeout(() => playSound('pop'), 50);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="p-2.5 rounded-xl text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors"
      aria-label={soundEnabled ? 'Disable sounds' : 'Enable sounds'}
      title={soundEnabled ? 'Sounds on' : 'Sounds off'}
    >
      {soundEnabled ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
      )}
    </button>
  );
}
