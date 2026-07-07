import { useCallback, useRef, useState } from 'react';
import {
  type GameState,
  type Position,
  createInitialState,
  findAllMatches,
  findHint,
  applyGravity,
  fillBoard,
  calculateScoreFromPositions,
  hasValidMoves,
  areAdjacent,
  swap,
  isColorBomb,
  hasSpecial,
  analyzeMatchShapes,
  getSpecialActivations,
  activateColorBomb,
  getCombinedSpecialEffect,
  transformSpecialBlocks,
  clearPositions,
} from './engine/game';
import { getLevelConfig, getStars, type LevelConfig } from './engine/levels';
import Board from './components/Board';
import Header from './components/Header';
import Overlay from './components/Overlay';
import ComboPopup from './components/ComboPopup';
import ProfileModal from './components/ProfileModal';
import LoginScreen from './components/LoginScreen';

type Screen = 'login' | 'game' | 'profile';

function getStoredLevel(): number {
  const stored = localStorage.getItem('gemcrush-level');
  return stored ? Math.max(1, parseInt(stored) || 1) : 1;
}

function setStoredLevel(level: number): void {
  localStorage.setItem('gemcrush-level', String(level));
}

function getStoredUsername(): string | null {
  return localStorage.getItem('gemcrush-username');
}

export default function App() {
  const [level, setLevel] = useState(getStoredLevel);
  const [levelConfig, setLevelConfig] = useState<LevelConfig>(() => getLevelConfig(getStoredLevel()));
  const [game, setGame] = useState<GameState>(() => createInitialState(levelConfig));
  const [screen, setScreen] = useState<Screen>(() =>
    getStoredUsername() ? 'game' : 'login'
  );
  const [isGuest, setIsGuest] = useState(false);
  const [combo, setCombo] = useState<{ count: number; score: number } | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayType, setOverlayType] = useState<'win' | 'lose'>('lose');
  const [overlayStars, setOverlayStars] = useState(0);
  const [hintCells, setHintCells] = useState<Position[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [swappedCells, setSwappedCells] = useState<[Position, Position] | null>(null);
  const [clearingCells, setClearingCells] = useState<Position[]>([]);
  const processingRef = useRef(false);
  /* ── Login handlers ─────────────────────────── */

  const handleLogin = useCallback((_name: string) => {
    setIsGuest(false);
    setScreen('game');
    // Force re-read of username
    setGame(createInitialState(levelConfig));
  }, [levelConfig]);

  const handleGuest = useCallback(() => {
    setIsGuest(true);
    setScreen('game');
    setGame(createInitialState(levelConfig));
  }, [levelConfig]);

  const handleProfileOpen = useCallback(() => {
    if (!isGuest) {
      setScreen('profile');
    }
  }, [isGuest]);

  /* ── Level management ───────────────────────── */

  const startLevel = useCallback((lvl: number) => {
    const cfg = getLevelConfig(lvl);
    setLevelConfig(cfg);
    setLevel(lvl);
    setStoredLevel(lvl);
    setGame(createInitialState(cfg));
    setShowOverlay(false);
    setHintCells([]);
    setSwappedCells(null);
    setClearingCells([]);
    processingRef.current = false;
    setIsProcessing(false);
  }, []);

  /* ── Score submission ───────────────────────── */

  const submitResult = useCallback(async (finalScore: number, lvl: number, completed: boolean, movesUsed: number) => {
    const name = !isGuest ? getStoredUsername() : null;
    if (!name) return;
    const stars = completed ? getStars(finalScore, levelConfig.targetScore) : 0;
    try {
      await fetch('/api/highscores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name, score: finalScore, level: lvl, movesUsed, stars }),
      });
      if (completed) {
        await fetch(`/api/profiles/${encodeURIComponent(name)}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: lvl, stars, bestScore: finalScore, completed: true }),
        });
      }
    } catch {
      // Server not available — game still works offline
    }
  }, [isGuest, levelConfig.targetScore]);

  /* ── Board processing loop ──────────────────── */

  const processBoard = useCallback(async (currentGame: GameState) => {
    let g = { ...currentGame };
    let comboCount = 0;

    for (;;) {
      const matches = findAllMatches(g.board);
      if (matches.length === 0) break;

      comboCount++;

      // Analyze matches: which get cleared, which become specials
      const { clearPositions: matchClears, specialCreations } = analyzeMatchShapes(g.board, matches);

      // Get extra clears from special blocks being caught in the match blast
      const specialBlastClears = getSpecialActivations(g.board, matchClears);

      // Merge all clear positions (unique)
      const allClears: Position[] = [];
      const seenClear = new Set<string>();
      const addClear = (p: Position) => {
        const k = `${p.row},${p.col}`;
        if (!seenClear.has(k)) {
          seenClear.add(k);
          allClears.push(p);
        }
      };

      for (const p of matchClears) addClear(p);
      for (const p of specialBlastClears) addClear(p);

      // Ensure special creation positions are NOT cleared
      const finalClears = allClears.filter(
        (p) => !specialCreations.some(
          (sc) => sc.position.row === p.row && sc.position.col === p.col
        )
      );

      // Score based on total cleared
      const totalCleared = finalClears.length;
      const points = calculateScoreFromPositions(totalCleared, comboCount - 1);

      // Animation: show clearing
      setClearingCells([...finalClears]);
      // Longer pause for bigger clears
      const clearDelay = totalCleared > 20 ? 500 : totalCleared > 10 ? 400 : 350;
      await sleep(clearDelay);

      // Apply clears and create specials
      let nextBoard = clearPositions(g.board, finalClears);
      nextBoard = transformSpecialBlocks(nextBoard, specialCreations);

      g = {
        ...g,
        board: nextBoard,
        score: g.score + points,
        comboCount,
      };
      setGame({ ...g });
      setClearingCells([]);

      if (comboCount > 1) {
        setCombo({ count: comboCount, score: points });
        setTimeout(() => setCombo(null), 1200);
      }

      await sleep(100);
      const fallen = applyGravity(g.board);
      g = { ...g, board: fillBoard(fallen, g.config.gemTypes) };
      setGame({ ...g });
      await sleep(300);
    }

    // Check end conditions
    if (g.movesLeft <= 0) {
      const won = g.score >= g.config.targetScore;
      g = { ...g, phase: 'gameover' };
      setGame(g);
      setOverlayStars(won ? getStars(g.score, g.config.targetScore) : 0);
      setOverlayType(won ? 'win' : 'lose');
      setShowOverlay(true);
      await submitResult(g.score, currentGame.config.level, won, currentGame.config.moves - g.movesLeft);
    } else if (!hasValidMoves(g.board)) {
      // No valid moves but still have moves left — reshuffle
      g = {
        ...g,
        board: fillBoard(
          g.board.map((row) => row.map(() => null)),
          g.config.gemTypes
        ),
        phase: 'idle',
      };
      setGame(g);
    } else {
      g = { ...g, phase: 'idle', comboCount: 0 };
      setGame(g);
    }

    processingRef.current = false;
    setIsProcessing(false);
  }, [submitResult]);

  /* ── Cell click handler ─────────────────────── */

  const handleCellClick = useCallback(
    (pos: Position) => {
      if (processingRef.current || game.phase === 'gameover') return;
      setHintCells([]);

      if (game.selected === null) {
        setGame((g) => ({ ...g, selected: pos, phase: 'selected' }));
        return;
      }

      if (game.selected.row === pos.row && game.selected.col === pos.col) {
        setGame((g) => ({ ...g, selected: null, phase: 'idle' }));
        return;
      }

      if (!areAdjacent(game.selected, pos)) {
        setGame((g) => ({ ...g, selected: pos, phase: 'selected' }));
        return;
      }

      const from = game.selected;
      const to = pos;
      processingRef.current = true;
      setIsProcessing(true);

      const fromCell = game.board[from.row][from.col];
      const toCell = game.board[to.row][to.col];

      // ── Color bomb + normal gem swap ──
      if (isColorBomb(fromCell) && toCell !== null && !isColorBomb(toCell)) {
        const swappedBoard = swap(game.board, from, to);
        const colorClears = activateColorBomb(swappedBoard, toCell.gem);
        // Include the swap positions themselves
        const allClears = [...colorClears];
        const seen = new Set<string>();
        for (const p of allClears) seen.add(`${p.row},${p.col}`);
        for (const p of [from, to]) {
          const k = `${p.row},${p.col}`;
          if (!seen.has(k)) {
            seen.add(k);
            allClears.push(p);
          }
        }
        setSwappedCells([from, to]);
        const afterMove: GameState = {
          ...game,
          board: swappedBoard,
          movesLeft: game.movesLeft - 1,
          selected: null,
          phase: 'swapping',
          score: game.score + calculateScoreFromPositions(allClears.length, 0),
        };
        setGame(afterMove);
        setTimeout(() => {
          setSwappedCells(null);
          // Clear and continue
          let nextBoard = clearPositions(afterMove.board, allClears);
          nextBoard = applyGravity(nextBoard);
          nextBoard = fillBoard(nextBoard, afterMove.config.gemTypes);
          const nextState = { ...afterMove, board: nextBoard, phase: 'idle' as const };
          setGame(nextState);
          processingRef.current = false;
          setIsProcessing(false);
          // Trigger cascade check
          setTimeout(() => {
            if (!processingRef.current) {
              processingRef.current = true;
              setIsProcessing(true);
              processBoard(nextState);
            }
          }, 100);
        }, 300);
        return;
      }

      if (isColorBomb(toCell) && fromCell !== null && !isColorBomb(fromCell)) {
        const swappedBoard = swap(game.board, from, to);
        const colorClears = activateColorBomb(swappedBoard, fromCell.gem);
        const allClears = [...colorClears];
        const seen = new Set<string>();
        for (const p of allClears) seen.add(`${p.row},${p.col}`);
        for (const p of [from, to]) {
          const k = `${p.row},${p.col}`;
          if (!seen.has(k)) {
            seen.add(k);
            allClears.push(p);
          }
        }
        setSwappedCells([from, to]);
        const afterMove: GameState = {
          ...game,
          board: swappedBoard,
          movesLeft: game.movesLeft - 1,
          selected: null,
          phase: 'swapping',
          score: game.score + calculateScoreFromPositions(allClears.length, 0),
        };
        setGame(afterMove);
        setTimeout(() => {
          setSwappedCells(null);
          let nextBoard = clearPositions(afterMove.board, allClears);
          nextBoard = applyGravity(nextBoard);
          nextBoard = fillBoard(nextBoard, afterMove.config.gemTypes);
          const nextState = { ...afterMove, board: nextBoard, phase: 'idle' as const };
          setGame(nextState);
          processingRef.current = false;
          setIsProcessing(false);
          setTimeout(() => {
            if (!processingRef.current) {
              processingRef.current = true;
              setIsProcessing(true);
              processBoard(nextState);
            }
          }, 100);
        }, 300);
        return;
      }

      // ── Special + special swap ──
      if (hasSpecial(fromCell) && hasSpecial(toCell)) {
        const swappedBoard = swap(game.board, from, to);
        const combinedClears = getCombinedSpecialEffect(swappedBoard, from, to);
        // Include the swap positions
        const allClears = [...combinedClears];
        const seen = new Set<string>();
        for (const p of allClears) seen.add(`${p.row},${p.col}`);
        for (const p of [from, to]) {
          const k = `${p.row},${p.col}`;
          if (!seen.has(k)) {
            seen.add(k);
            allClears.push(p);
          }
        }
        setSwappedCells([from, to]);
        const afterMove: GameState = {
          ...game,
          board: swappedBoard,
          movesLeft: game.movesLeft - 1,
          selected: null,
          phase: 'swapping',
          score: game.score + calculateScoreFromPositions(allClears.length, 0),
        };
        setGame(afterMove);
        setTimeout(() => {
          setSwappedCells(null);
          // Expand clears for any cascading specials caught in blast
          const extraClears = getSpecialActivations(swappedBoard, allClears);
          const finalAllClears = [...allClears];
          const fs = new Set<string>();
          for (const p of allClears) fs.add(`${p.row},${p.col}`);
          for (const p of extraClears) {
            const k = `${p.row},${p.col}`;
            if (!fs.has(k)) { fs.add(k); finalAllClears.push(p); }
          }
          let nextBoard = clearPositions(afterMove.board, finalAllClears);
          nextBoard = applyGravity(nextBoard);
          nextBoard = fillBoard(nextBoard, afterMove.config.gemTypes);
          const nextState = { ...afterMove, board: nextBoard, phase: 'idle' as const };
          setGame(nextState);
          processingRef.current = false;
          setIsProcessing(false);
          setTimeout(() => {
            if (!processingRef.current) {
              processingRef.current = true;
              setIsProcessing(true);
              processBoard(nextState);
            }
          }, 100);
        }, 300);
        return;
      }

      // ── Normal swap ──
      const swapped = swap(game.board, from, to);
      const matches = findAllMatches(swapped);

      if (matches.length === 0) {
        setSwappedCells([from, to]);
        setGame((g) => ({ ...g, selected: null, phase: 'swapping' }));
        setTimeout(() => {
          setSwappedCells(null);
          if (!processingRef.current) return;
          setGame((g) => ({ ...g, selected: null, phase: 'idle' }));
          processingRef.current = false;
          setIsProcessing(false);
        }, 350);
        return;
      }

      setSwappedCells([from, to]);
      const afterMove: GameState = {
        ...game,
        board: swapped,
        movesLeft: game.movesLeft - 1,
        selected: null,
        phase: 'swapping',
      };
      setGame(afterMove);

      setTimeout(() => {
        setSwappedCells(null);
        processBoard(afterMove);
      }, 300);
    },
    [game, processBoard]
  );

  /* ── Hint ───────────────────────────────────── */

  const handleHint = useCallback(() => {
    if (processingRef.current || game.phase === 'gameover') return;
    const hint = findHint(game.board);
    if (hint) {
      setHintCells([hint.a, hint.b]);
      setTimeout(() => setHintCells([]), 2000);
    }
  }, [game]);

  const handleNextLevel = useCallback(() => {
    startLevel(level + 1);
  }, [level, startLevel]);

  const handleRestart = useCallback(() => {
    startLevel(level);
  }, [level, startLevel]);

  /* ── Render ─────────────────────────────────── */

  if (screen === 'login') {
    return <LoginScreen onLogin={handleLogin} onGuest={handleGuest} />;
  }

  return (
    <div className="app">
      <Header
        score={game.score}
        movesLeft={game.movesLeft}
        level={levelConfig.level}
        difficulty={levelConfig.difficulty}
        targetScore={levelConfig.targetScore}
        onProfile={handleProfileOpen}
        isGuest={isGuest}
      />

      <main className="game-area">
        <Board
          board={game.board}
          selected={game.selected}
          hintCells={hintCells}
          swappedCells={swappedCells}
          clearingCells={clearingCells}
          onCellClick={handleCellClick}
        />
      </main>

      <footer className="game-footer">
        <button className="game-btn" onClick={handleHint} disabled={isProcessing}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 22h20L12 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <circle cx="12" cy="8" r="1" />
          </svg>
        </button>
        <button className="game-btn primary" onClick={handleRestart}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </footer>

      {combo && <ComboPopup count={combo.count} score={combo.score} />}

      {showOverlay && (
        <Overlay
          type={overlayType}
          score={game.score}
          level={levelConfig.level}
          stars={overlayStars}
          targetScore={levelConfig.targetScore}
          onRestart={overlayType === 'win' ? handleNextLevel : handleRestart}
        />
      )}

      {screen === 'profile' && (
        <ProfileModal onClose={() => setScreen('game')} />
      )}
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
