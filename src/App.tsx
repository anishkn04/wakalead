import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { setSession } from './api';

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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
