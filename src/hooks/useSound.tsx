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
      return localStorage.getItem('soundEnabled') !== 'false';
    }
    return true;
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
 * Sound toggle button component
 */
export function SoundToggle() {
  const { soundEnabled, toggleSound, playSound } = useSound();

  const handleClick = () => {
    toggleSound();
    if (!soundEnabled) {
      // Play a sound to confirm it's enabled
      setTimeout(() => playSound('pop'), 50);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group"
      aria-label={soundEnabled ? 'Disable sounds' : 'Enable sounds'}
      title={soundEnabled ? 'Sounds on' : 'Sounds off'}
    >
      {soundEnabled ? (
        <svg 
          className="w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:scale-110 transition-transform" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      ) : (
        <svg 
          className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:scale-110 transition-transform" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      )}
    </button>
  );
}
