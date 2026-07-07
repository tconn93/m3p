import { useState, useCallback } from 'react';

interface LoginScreenProps {
  onLogin: (username: string) => void;
  onGuest: () => void;
}

const API = '/api';

export default function LoginScreen({ onLogin, onGuest }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = useCallback(async () => {
    const name = username.trim();
    if (!name) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('gemcrush-username', data.username);
        onLogin(data.username);
      } else {
        const body = await res.json().catch(() => ({ error: 'Server error' }));
        setError(body.error || 'Failed to log in');
      }
    } catch {
      // Server offline — allow local play
      localStorage.setItem('gemcrush-username', name);
      onLogin(name);
    }
    setLoading(false);
  }, [username, onLogin]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-icon">💎</div>
          <h1 className="login-title">Gem Crush</h1>
          <p className="login-subtitle">Match, crush, and climb the leaderboard!</p>
        </div>

        {/* Input */}
        <div className="login-form">
          <input
            className="login-input"
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            maxLength={24}
            autoFocus
            disabled={loading}
          />
          {error && <p className="login-error">{error}</p>}

          <button
            className="login-btn primary"
            onClick={handleLogin}
            disabled={loading || !username.trim()}
          >
            {loading ? 'Loading...' : 'Play'}
          </button>
        </div>

        {/* Divider */}
        <div className="login-divider">
          <span className="login-divider-text">or</span>
        </div>

        {/* Guest */}
        <button className="login-btn guest" onClick={onGuest} disabled={loading}>
          Play as Guest
        </button>
        <p className="login-guest-note">Progress won't be saved</p>
      </div>
    </div>
  );
}
