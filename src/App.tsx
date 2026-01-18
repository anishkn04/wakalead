import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { getSession, setSession } from './api';

/**
 * Main App component
 * Handles routing and authentication state
 */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check URL for session parameter first (OAuth callback)
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    const errorParam = params.get('error');
    
    if (errorParam) {
      // OAuth error
      console.error('OAuth error:', errorParam);
      alert(`Authentication failed: ${errorParam}`);
      window.history.replaceState({}, '', '/login');
      setIsAuthenticated(false);
      return;
    }
    
    if (sessionParam) {
      // Save session from OAuth callback
      console.log('Session received:', sessionParam);
      setSession(sessionParam);
      setIsAuthenticated(true);
      // Clean up URL
      window.history.replaceState({}, '', '/');
      return;
    }

    // Check if user has an existing session
    const session = getSession();
    setIsAuthenticated(!!session);
  }, []);

  if (isAuthenticated === null) {
    // Loading state
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Routes>
        <Route
          path="/"
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/login"
          element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
