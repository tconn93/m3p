/** Level configuration and difficulty scaling */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface LevelConfig {
  level: number;
  difficulty: Difficulty;
  gemTypes: number;
  rows: number;
  cols: number;
  moves: number;
  targetScore: number;
}

export function getDifficulty(level: number): Difficulty {
  if (level <= 999) return 'easy';
  if (level <= 1999) return 'medium';
  return 'hard';
}

export function getDifficultyLabel(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'easy':   return 'Easy';
    case 'medium': return 'Medium';
    case 'hard':   return 'Hard';
  }
}

export function getDifficultyColor(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'easy':   return '#2ed573';
    case 'medium': return '#ffa502';
    case 'hard':   return '#ff4757';
  }
}

export function getLevelConfig(level: number): LevelConfig {
  const difficulty = getDifficulty(level);

  // ── Easy: levels 1–999 ──────────────────────
  if (difficulty === 'easy') {
    const t = (level - 1) / 998; // 0 → 1 progression within tier
    return {
      level,
      difficulty,
      gemTypes: 5,
      rows: 8,
      cols: 8,
      moves: Math.round(35 - t * 10),       // 35 → 25
      targetScore: Math.round(500 + t * 4500), // 500 → 5,000
    };
  }

  // ── Medium: levels 1000–1999 ───────────────
  if (difficulty === 'medium') {
    const t = (level - 1000) / 999;
    return {
      level,
      difficulty,
      gemTypes: 6,
      rows: 8,
      cols: 8,
      moves: Math.round(28 - t * 8),          // 28 → 20
      targetScore: Math.round(5000 + t * 10000), // 5,000 → 15,000
    };
  }

  // ── Hard: levels 2000+ ─────────────────────
  const t = Math.min((level - 2000) / 1000, 1); // cap scaling at level 3000
  return {
    level,
    difficulty,
    gemTypes: level >= 3000 ? 7 : 6,          // 7 gem types at 3000+
    rows: 8,
    cols: 8,
    moves: Math.round(22 - t * 7),             // 22 → 15
    targetScore: Math.round(15000 + t * 35000), // 15,000 → 50,000
  };
}

/** How many stars earned (0-3) based on score vs target */
export function getStars(score: number, target: number): number {
  if (score >= target * 2) return 3;
  if (score >= target * 1.4) return 2;
  if (score >= target) return 1;
  return 0;
}
