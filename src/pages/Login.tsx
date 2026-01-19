import { useState, useEffect } from 'react';
import { API_BASE } from '../api';
import { TypingAnimation } from '../components/Animations';

// Code snippets to display in the background
const codeSnippets = [
  'const developer = "awesome";',
  'while(coding) { improve(); }',
  'git commit -m "ship it 🚀"',
  'npm install --save caffeine',
  'console.log("Hello World!");',
  'function grind() { return 💪; }',
  'const sleep = null; // overrated',
  'if (bugs > 0) { squash(bugs); }',
  '// TODO: fix later (never)',
  'export default awesomeness;',
  '<Code quality="100%" />',
  'await Promise.all(dreams);',
  'try { succeed(); } finally {}',
  'const skills = skills.map(s => s++);',
  '🔥.forEach(code => ship(code));',
];

/**
 * Floating Code Component
 */
function FloatingCode() {
  const [snippets, setSnippets] = useState<Array<{
    id: number;
    text: string;
    x: number;
    y: number;
    speed: number;
    opacity: number;
  }>>([]);

  useEffect(() => {
    const newSnippets = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      text: codeSnippets[Math.floor(Math.random() * codeSnippets.length)],
      x: Math.random() * 100,
      y: Math.random() * 100,
      speed: 15 + Math.random() * 20,
      opacity: 0.1 + Math.random() * 0.2,
    }));
    setSnippets(newSnippets);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {snippets.map((snippet) => (
        <div
          key={snippet.id}
          className="absolute font-mono text-xs sm:text-sm whitespace-nowrap animate-float"
          style={{
            left: `${snippet.x}%`,
            top: `${snippet.y}%`,
            opacity: snippet.opacity,
            animationDuration: `${snippet.speed}s`,
            animationDelay: `${snippet.id * 0.5}s`,
          }}
        >
          <span className="text-blue-500 dark:text-blue-400">{snippet.text}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Login page - redirects to WakaTime OAuth
 */
export function Login() {
  const [isHovering, setIsHovering] = useState(false);
  const [showTyping, setShowTyping] = useState(true);

  const handleLogin = () => {
    // Redirect to API login endpoint
    window.location.href = `${API_BASE}/auth/login`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Floating Code Background */}
      <FloatingCode />
      
      {/* Animated gradient orbs */}
      <div className="absolute top-20 -left-20 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float" style={{ animationDuration: '7s' }}></div>
      <div className="absolute top-40 -right-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float" style={{ animationDuration: '8s', animationDelay: '2s' }}></div>
      <div className="absolute -bottom-20 left-40 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float" style={{ animationDuration: '9s', animationDelay: '4s' }}></div>

      <div className="max-w-md w-full relative z-10">
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-gray-200/50 dark:border-gray-700/50 animate-scale-pop card-hover-lift">
          {/* Logo with animation */}
          <div className="flex justify-center mb-6">
            <div 
              className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center transform hover:rotate-12 transition-transform duration-300 shadow-lg animate-gradient-border p-[2px]"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <svg 
                  className={`w-12 h-12 text-white transition-transform duration-300 ${isHovering ? 'scale-110' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Title with gradient animation */}
          <h1 className="text-3xl font-bold text-center mb-2">
            <span className="animate-gradient-text">Welcome to WakaLead</span>
          </h1>
          
          {/* Typing animation tagline */}
          <div className="text-center text-gray-600 dark:text-gray-400 mb-8 h-6">
            {showTyping ? (
              <TypingAnimation 
                text="Track your coding time and compete with others" 
                speed={30}
                onComplete={() => setTimeout(() => setShowTyping(false), 3000)}
              />
            ) : (
              <span>Track your coding time and compete with others</span>
            )}
          </div>

          {/* Features with staggered animation */}
          <div className="space-y-4 mb-8">
            {[
              {
                icon: (
                  <svg className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: "Daily & Weekly Leaderboards",
                subtitle: "See how you rank against other coders"
              },
              {
                icon: (
                  <svg className="w-6 h-6 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: "Performance Analytics",
                subtitle: "Visualize your coding trends over time"
              },
              {
                icon: (
                  <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                title: "Secure & Private",
                subtitle: "Your data is encrypted and secure"
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="flex items-start space-x-3 animate-fade-in-up spotlight-hover rounded-lg p-2 -mx-2"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {feature.icon}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{feature.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{feature.subtitle}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Login button with ripple effect */}
          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] hover:shadow-xl shadow-lg ripple-container relative overflow-hidden group"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Sign in with WakaTime
            </span>
            <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
          </button>

          {/* Stats teaser */}
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="animate-fade-in-up" style={{ animationDelay: '500ms' }}>
              <p className="text-2xl font-bold text-blue-500">🏆</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Compete</p>
            </div>
            <div className="animate-fade-in-up" style={{ animationDelay: '600ms' }}>
              <p className="text-2xl font-bold text-purple-500">📊</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Track</p>
            </div>
            <div className="animate-fade-in-up" style={{ animationDelay: '700ms' }}>
              <p className="text-2xl font-bold text-pink-500">🚀</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Improve</p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">
            By signing in, you agree to share your WakaTime coding statistics
          </p>
        </div>
        
        {/* Footer credit */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4 animate-fade-in-up" style={{ animationDelay: '800ms' }}>
          Made with ❤️ for coders who grind
        </p>
      </div>
    </div>
  );
}
