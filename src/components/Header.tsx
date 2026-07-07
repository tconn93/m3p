import { type Difficulty, getDifficultyLabel, getDifficultyColor } from '../engine/levels';

interface HeaderProps {
  score: number;
  movesLeft: number;
  level: number;
  difficulty: Difficulty;
  targetScore: number;
  onProfile: () => void;
  isGuest: boolean;
}

export default function Header({
  score,
  movesLeft,
  level,
  difficulty,
  targetScore,
  onProfile,
  isGuest,
}: HeaderProps) {
  return (
    <header className="game-header">
      {/* Left: Level + Target */}
      <div className="header-left">
        <div className="level-badge" style={{ borderColor: getDifficultyColor(difficulty) }}>
          <span className="level-num">{level}</span>
          <span className="level-tier" style={{ color: getDifficultyColor(difficulty) }}>
            {getDifficultyLabel(difficulty)}
          </span>
        </div>
        <div className="target-display">
          <span className="target-label">Target</span>
          <span className="target-value">{targetScore.toLocaleString()}</span>
        </div>
      </div>

      {/* Center: Title + Profile/Guest */}
      <div className="header-center">
        <h1 className="game-title">Gem Crush</h1>
        {isGuest ? (
          <span className="guest-badge">Guest</span>
        ) : (
          <button className="btn-profile" onClick={onProfile}>
            Profile
          </button>
        )}
      </div>

      {/* Right: Score + Moves */}
      <div className="header-right">
        <div className="header-stat">
          <span className="label">Score</span>
          <span className="value">{score.toLocaleString()}</span>
        </div>
        <div className="header-stat">
          <span className="label">Moves</span>
          <span className="value" style={{ color: movesLeft <= 5 ? '#ff4757' : undefined }}>
            {movesLeft}
          </span>
        </div>
      </div>
    </header>
  );
}
