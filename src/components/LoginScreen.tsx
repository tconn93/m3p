import { useState, useCallback } from 'react';

interface LoginScreenProps {
  onLogin: (username: string) => void;
  onGuest: () => void;
}

type AuthMode = 'login' | 'register';

const API = '/api';

export default function LoginScreen({ onLogin, onGuest }: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const endpoint = mode === 'login'
    ? API + '/auth/login'
    : API + '/auth/register';

  const handleSubmit = useCallback(async () => {
    const name = username.trim();
    if (!name || !password) return;

    setLoading(true);
    setError('');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(function () { controller.abort(); }, 5000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name, password: password }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('gemcrush-username', data.username);
        onLogin(data.username);
        return;
      } else {
        const body = await res.json().catch(function () { return { error: 'Server error' }; });
        setError(body.error || 'Authentication failed');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError('Server unavailable. Please try again or play as guest.');
      }
    }
    setLoading(false);
  }, [username, password, endpoint, onLogin]);

  const handleKeyDown = function (e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
  };

  const switchMode = function (newMode: AuthMode) {
    setMode(newMode);
    setError('');
  };

  const tabClass = function (tabMode: AuthMode) {
    return 'auth-tab' + (mode === tabMode ? ' active' : '');
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-icon">💎</div>
          <h1 className="login-title">Gem Crush</h1>
          <p className="login-subtitle">Match, crush, and climb the leaderboard!</p>
        </div>

        <div className="auth-tabs">
          <button
            className={tabClass('login')}
            onClick={function () { switchMode('login'); }}
            disabled={loading}
          >
            Login
          </button>
          <button
            className={tabClass('register')}
            onClick={function () { switchMode('register'); }}
            disabled={loading}
          >
            Register
          </button>
        </div>

        <div className="login-form">
          <input
            className="login-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={function (e) {
              setUsername(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            maxLength={24}
            autoFocus
            disabled={loading}
          />
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={function (e) {
              setPassword(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          {error && <p className="login-error">{error}</p>}

          <button
            className="login-btn primary"
            onClick={handleSubmit}
            disabled={loading || !username.trim() || !password}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </div>

        <div className="login-divider">
          <span className="login-divider-text">or</span>
        </div>

        <button className="login-btn guest" onClick={onGuest}>
          Play as Guest
        </button>
        <p className="login-guest-note">Progress won't be saved</p>
      </div>
    </div>
  );
}
