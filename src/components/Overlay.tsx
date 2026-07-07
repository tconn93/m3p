interface OverlayProps {
  type: 'win' | 'lose';
  score: number;
  level: number;
  stars: number;
  targetScore: number;
  onRestart: () => void;
}

export default function Overlay({ type, score, level, stars, targetScore, onRestart }: OverlayProps) {
  const won = type === 'win';

  return (
    <div className="overlay">
      <div className={`overlay-content overlay-type-${type}`}>
        <h2>{won ? '🌟 Level Complete!' : 'Game Over'}</h2>

        <div className="overlay-level">Level {level}</div>

        {won && (
          <div className="stars-display">
            {[1, 2, 3].map((s) => (
              <span key={s} className={`star ${s <= stars ? 'filled' : 'empty'}`}>
                {s <= stars ? '★' : '☆'}
              </span>
            ))}
          </div>
        )}

        <div className="overlay-detail">
          <div className="detail-row">
            <span>Your Score</span>
            <strong>{score.toLocaleString()}</strong>
          </div>
          <div className="detail-row">
            <span>Target</span>
            <strong>{targetScore.toLocaleString()}</strong>
          </div>
        </div>

        <div className="overlay-buttons">
          <button className="game-btn primary large" onClick={onRestart}>
            {won ? 'Next Level →' : 'Try Again'}
          </button>
        </div>
      </div>
    </div>
  );
}
