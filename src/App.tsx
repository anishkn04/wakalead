import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import { setSession } from './api';

// Lazy load pages for better initial load time
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));

/**
 * Main App component
 * Handles routing and session management
 */
function App() {
  useEffect(() => {
    // Check URL for session parameter (OAuth callback)
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    const errorParam = params.get('error');
    
    if (errorParam) {
      // OAuth error
      console.error('OAuth error:', errorParam);
      alert(`Authentication failed: ${errorParam}`);
      window.history.replaceState({}, '', '/login');
      return;
    }
    
    if (sessionParam) {
      // Save session from OAuth callback
      console.log('Session received:', sessionParam);
      setSession(sessionParam);
      // Clean up URL
      window.history.replaceState({}, '', '/');
    }
  }, []);

  return (
    <ThemeProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      }>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </ThemeProvider>
  );
}

export default App;
