import { useState, useEffect, useCallback } from 'react';

interface LeaderboardEntry {
  username: string;
  lifetime_score: number;
  current_level: number;
  updated_at: string;
}

interface ProfileModalProps {
  onClose: () => void;
  onLogout: () => void;
}

type AuthMode = 'login' | 'register';

const API = '/api';

export default function ProfileModal({ onClose, onLogout }: ProfileModalProps) {
  const [username, setUsername] = useState(() => localStorage.getItem('gemcrush-username') || '');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [loggedIn, setLoggedIn] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lifetimeScore, setLifetimeScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchProfile = useCallback(async (name: string) => {
    try {
      const res = await fetch(`${API}/profiles/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setLifetimeScore(data.lifetime_score || 0);
        setCurrentLevel(data.current_level || 1);
        setLoggedIn(true);
      }
    } catch {
      // Server offline
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch {
      // Server offline
    }
  }, []);

  useEffect(() => {
    if (username) {
      fetchProfile(username);
      fetchLeaderboard();
    }
  }, [username, fetchProfile, fetchLeaderboard]);

  const handleAuth = async () => {
    const name = username.trim();
    if (!name || !password) return;

    setLoading(true);

    const endpoint = authMode === 'login' ? `${API}/auth/login` : `${API}/auth/register`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name, password }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('gemcrush-username', data.username);
        setUsername(data.username);
        setLifetimeScore(data.lifetime_score || 0);
        setCurrentLevel(data.current_level || 1);
        setLoggedIn(true);
        setPassword('');
        fetchLeaderboard();
      } else {
        // ProfileModal doesn't have inline error display — auth failure is silent
      }
    } catch {
      // Server offline
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('gemcrush-username');
    setUsername('');
    setLoggedIn(false);
    setLifetimeScore(0);
    setCurrentLevel(1);
    onLogout();
  };

  return (
    <div className="profile-modal" onClick={onClose}>
      <div className="profile-card" onClick={(e) => e.stopPropagation()}>
        <h2>Player Profile</h2>

        {!loggedIn ? (
          <>
            <div className="auth-tabs">
              <button
                className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => setAuthMode('login')}
                disabled={loading}
              >
                Login
              </button>
              <button
                className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
                onClick={() => setAuthMode('register')}
                disabled={loading}
              >
                Register
              </button>
            </div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={24}
              autoFocus
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="btn-row">
              <button
                className="game-btn primary"
                onClick={handleAuth}
                disabled={loading || !username.trim() || !password}
              >
                {loading ? '...' : authMode === 'login' ? 'Login' : 'Create Account'}
              </button>
              <button className="game-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="profile-stats">
              <div className="profile-stat">
                <span className="ps-label">Player</span>
                <span className="ps-value">{username}</span>
              </div>
              <div className="profile-stat">
                <span className="ps-label">Lifetime Score</span>
                <span className="ps-value highlight">{lifetimeScore.toLocaleString()}</span>
              </div>
              <div className="profile-stat">
                <span className="ps-label">Current Level</span>
                <span className="ps-value">{currentLevel}</span>
              </div>
            </div>
            <div className="btn-row">
              <button className="game-btn primary" onClick={onClose}>
                Continue
              </button>
              <button className="game-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </>
        )}

        {leaderboard.length > 0 && (
          <div className="leaderboard">
            <h3>🏆 Lifetime Leaderboard</h3>
            <div className="leaderboard-header">
              <span className="rank">#</span>
              <span className="username">Player</span>
              <span className="lb-score">Score</span>
              <span className="lb-level">Lvl</span>
            </div>
            {leaderboard.slice(0, 15).map((entry, i) => (
              <div className={`leaderboard-item ${entry.username === username ? 'is-me' : ''}`} key={i}>
                <span className="rank">{i + 1}</span>
                <span className="username">{entry.username}</span>
                <span className="lb-score">{entry.lifetime_score.toLocaleString()}</span>
                <span className="lb-level">{entry.current_level}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
