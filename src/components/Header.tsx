import { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { SoundToggle, useSound } from '../hooks/useSound';

/**
 * Header component with branding and theme toggle
 */
export function Header() {
  const { theme, toggleTheme } = useTheme();
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const { playSound } = useSound();

  const handleThemeToggle = () => {
    playSound('click');
    toggleTheme();
  };

  return (
    <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group"
            onMouseEnter={() => {
              setIsLogoHovered(true);
              playSound('whoosh');
            }}
            onMouseLeave={() => setIsLogoHovered(false)}
          >
            <div className={`relative transition-transform duration-300 ${isLogoHovered ? 'scale-110 rotate-12' : ''}`}>
              <img 
                src="/wakalead.svg" 
                alt="WakaLead Logo" 
                className="w-8 h-8 sm:w-10 sm:h-10"
              />
              {/* Glow effect on hover */}
              <div className={`absolute inset-0 bg-blue-500 rounded-full blur-md transition-opacity duration-300 ${isLogoHovered ? 'opacity-30' : 'opacity-0'}`}></div>
            </div>
            <div>
              <h1 className={`text-xl sm:text-2xl font-bold transition-all duration-300 ${isLogoHovered ? 'animate-gradient-text' : 'text-gray-900 dark:text-white'}`}>
                WakaLead
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                WakaTime Leaderboard
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* Sound toggle */}
            <SoundToggle />
            
            {/* Theme toggle with animation */}
            <button
              onClick={handleThemeToggle}
              className="p-2 sm:p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 relative group overflow-hidden"
              aria-label="Toggle theme"
            >
              {/* Background ripple effect */}
              <span className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-blue-600 dark:to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-xl"></span>
              
              <div className="relative">
                {theme === 'dark' ? (
                  <svg 
                    className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500 transform transition-transform duration-500 group-hover:rotate-180" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg 
                    className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 transform transition-transform duration-500 group-hover:-rotate-12" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
