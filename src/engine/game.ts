/** Core match-3 game engine — pure logic, no DOM */

export type GemType = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type SpecialType = 'striped-h' | 'striped-v' | 'bomb' | 'color-bomb' | 'rocket';

export interface CellData {
  gem: GemType;
  special?: SpecialType;
}

export type Cell = CellData | null;

export const BASE_SCORE = 10;
export const COMBO_MULTIPLIER = 1.5;

export interface Position {
  row: number;
  col: number;
}

export interface Match {
  positions: Position[];
}

export interface SpecialCreation {
  position: Position;
  special: SpecialType;
}

export type GamePhase =
  | 'idle'
  | 'selected'
  | 'swapping'
  | 'matching'
  | 'clearing'
  | 'falling'
  | 'gameover';

export interface GameConfig {
  level: number;
  rows: number;
  cols: number;
  gemTypes: number;
  moves: number;
  targetScore: number;
}

export interface GameState {
  board: Cell[][];
  score: number;
  movesLeft: number;
  selected: Position | null;
  phase: GamePhase;
  matches: Match[];
  comboCount: number;
  config: GameConfig;
}

/* ── Helpers ─────────────────────────────────── */

function randomGem(numTypes: number): GemType {
  return Math.floor(Math.random() * numTypes) as GemType;
}

export function makeCell(gem: GemType, special?: SpecialType): CellData {
  return special ? { gem, special } : { gem };
}

export function sameColor(a: Cell, b: Cell): boolean {
  return a !== null && b !== null && a.gem === b.gem;
}

export function isColorBomb(cell: Cell): boolean {
  return cell !== null && cell.special === 'color-bomb';
}

export function hasSpecial(cell: Cell): boolean {
  return cell !== null && cell.special !== undefined;
}

export function cellColor(cell: Cell): GemType | null {
  return cell?.gem ?? null;
}

function posKey(r: number, c: number): string {
  return `${r},${c}`;
}

function posInList(list: Position[], r: number, c: number): boolean {
  return list.some((p) => p.row === r && p.col === c);
}

function addUnique(list: Position[], r: number, c: number): void {
  if (!posInList(list, r, c)) {
    list.push({ row: r, col: c });
  }
}

function inBounds(r: number, c: number, rows: number, cols: number): boolean {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

/* ── Board creation ──────────────────────────── */

function wouldMatch(board: Cell[][], row: number, col: number, gem: GemType): boolean {
  // Check left — skip color bombs (they don't form matches)
  if (
    col >= 2 &&
    board[row][col - 1]?.gem === gem &&
    board[row][col - 2]?.gem === gem &&
    !isColorBomb(board[row][col - 1]) &&
    !isColorBomb(board[row][col - 2])
  ) {
    return true;
  }
  // Check up
  if (
    row >= 2 &&
    board[row - 1]?.[col]?.gem === gem &&
    board[row - 2]?.[col]?.gem === gem &&
    !isColorBomb(board[row - 1]?.[col] ?? null) &&
    !isColorBomb(board[row - 2]?.[col] ?? null)
  ) {
    return true;
  }
  return false;
}

export function createBoard(rows: number, cols: number, numTypes: number): Cell[][] {
  const board: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    board.push([]);
    for (let c = 0; c < cols; c++) {
      let gem: GemType;
      let attempts = 0;
      do {
        gem = randomGem(Math.max(numTypes, 3));
        attempts++;
      } while (attempts < 100 && wouldMatch(board, r, c, gem));
      board[r].push(makeCell(gem));
    }
  }
  return board;
}

/* ── Adjacency & swap ────────────────────────── */

export function areAdjacent(a: Position, b: Position): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

export function swap(board: Cell[][], a: Position, b: Position): Cell[][] {
  const next = cloneBoard(board);
  const tmp = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = tmp;
  return next;
}

/* ── Match finding ───────────────────────────── */

export function findMatches(board: Cell[][]): Match[] {
  const rows = board.length;
  const cols = board[0].length;
  const matches: Match[] = [];

  // Horizontal
  for (let r = 0; r < rows; r++) {
    let runStart = 0;
    for (let c = 1; c <= cols; c++) {
      const a = board[r][runStart];
      const b = c < cols ? board[r][c] : null;
      const same =
        c < cols &&
        a !== null &&
        b !== null &&
        !isColorBomb(a) &&
        !isColorBomb(b) &&
        a.gem === b.gem;
      if (!same) {
        const len = c - runStart;
        if (len >= 3) {
          const positions: Position[] = [];
          for (let i = runStart; i < c; i++) {
            positions.push({ row: r, col: i });
          }
          matches.push({ positions });
        }
        runStart = c;
      }
    }
  }

  // Vertical
  for (let c = 0; c < cols; c++) {
    let runStart = 0;
    for (let r = 1; r <= rows; r++) {
      const a = board[runStart]?.[c] ?? null;
      const b = r < rows ? board[r][c] : null;
      const same =
        r < rows &&
        a !== null &&
        b !== null &&
        !isColorBomb(a) &&
        !isColorBomb(b) &&
        a.gem === b.gem;
      if (!same) {
        const len = r - runStart;
        if (len >= 3) {
          const positions: Position[] = [];
          for (let i = runStart; i < r; i++) {
            positions.push({ row: i, col: c });
          }
          matches.push({ positions });
        }
        runStart = r;
      }
    }
  }

  return matches;
}

/** Detect 2x2 squares of same-color gems (not caught by line-based findMatches). */
export function find2x2Squares(board: Cell[][]): Match[] {
  const rows = board.length;
  const cols = board[0].length;
  const matches: Match[] = [];

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = board[r][c];
      const tr = board[r][c + 1];
      const bl = board[r + 1][c];
      const br = board[r + 1][c + 1];
      if (
        tl !== null && tr !== null && bl !== null && br !== null &&
        !isColorBomb(tl) && !isColorBomb(tr) && !isColorBomb(bl) && !isColorBomb(br) &&
        tl.gem === tr.gem && tl.gem === bl.gem && tl.gem === br.gem
      ) {
        matches.push({
          positions: [
            { row: r, col: c },
            { row: r, col: c + 1 },
            { row: r + 1, col: c },
            { row: r + 1, col: c + 1 },
          ],
        });
      }
    }
  }

  return matches;
}

/** Combined match detection: line matches + 2x2 squares. */
export function findAllMatches(board: Cell[][]): Match[] {
  return [...findMatches(board), ...find2x2Squares(board)];
}

/* ── Match shape analysis → special block creation ── */

/**
 * Analyze matches to determine:
 * 1. Which positions get cleared (regular clearing)
 * 2. Where to create special blocks
 *
 * Rules:
 * - Match-3: normal clear, no special
 * - Match-4 horizontal: creates striped-v (clears column) at midpoint
 * - Match-4 vertical: creates striped-h (clears row) at midpoint
 * - Match-5+ horizontal: creates color-bomb at midpoint
 * - Match-5+ vertical: creates color-bomb at midpoint
 * - L/T shape (horiz+vert sharing a cell): creates bomb at intersection
 * - 2x2 square: creates rocket at top-left
 */
export function analyzeMatchShapes(
  board: Cell[][],
  matches: Match[],
): { clearPositions: Position[]; specialCreations: SpecialCreation[] } {
  if (matches.length === 0) return { clearPositions: [], specialCreations: [] };

  const specialCreations: SpecialCreation[] = [];
  const creationPositions: Position[] = []; // track where specials are placed

  // Separate into true line matches (all positions share same row or col).
  // Must check every position — a 2x2 square has positions[0].row===positions[1].row
  // but is not a true horizontal line.
  const horiz = matches.filter((m) =>
    m.positions.length >= 2 && m.positions.every((p) => p.row === m.positions[0].row),
  );
  const vert = matches.filter((m) =>
    m.positions.length >= 2 && m.positions.every((p) => p.col === m.positions[0].col),
  );

  // Find L/T intersections: a horiz and vert match that share a cell
  const usedForIntersection = new Set<string>(); // match index keys: "h<idx>" or "v<idx>"

  for (let hi = 0; hi < horiz.length; hi++) {
    for (let vi = 0; vi < vert.length; vi++) {
      if (usedForIntersection.has(`h${hi}`) || usedForIntersection.has(`v${vi}`)) continue;

      const intersect = horiz[hi].positions.find((hp) =>
        vert[vi].positions.some((vp) => vp.row === hp.row && vp.col === hp.col),
      );

      if (intersect) {
        // L or T shape — create bomb at intersection
        const cell = board[intersect.row][intersect.col];
        if (cell) {
          specialCreations.push({
            position: { row: intersect.row, col: intersect.col },
            special: 'bomb',
          });
          creationPositions.push({ row: intersect.row, col: intersect.col });
          usedForIntersection.add(`h${hi}`);
          usedForIntersection.add(`v${vi}`);
        }
      }
    }
  }

  // Process isolated horizontal matches
  for (let hi = 0; hi < horiz.length; hi++) {
    if (usedForIntersection.has(`h${hi}`)) continue;
    const m = horiz[hi];
    const len = m.positions.length;
    const midIdx = Math.floor(len / 2);
    const mid = m.positions[midIdx];

    if (posInList(creationPositions, mid.row, mid.col)) continue;

    const cell = board[mid.row][mid.col];
    if (!cell) continue;

    if (len === 4) {
      // Striped vertical (clears column, perpendicular to horizontal match)
      specialCreations.push({ position: { ...mid }, special: 'striped-v' });
      creationPositions.push({ ...mid });
    } else if (len >= 5) {
      // Color bomb
      specialCreations.push({ position: { ...mid }, special: 'color-bomb' });
      creationPositions.push({ ...mid });
    }
    // len === 3: no special (but may still be part of L/T already handled)
  }

  // Process isolated vertical matches
  for (let vi = 0; vi < vert.length; vi++) {
    if (usedForIntersection.has(`v${vi}`)) continue;
    const m = vert[vi];
    const len = m.positions.length;
    const midIdx = Math.floor(len / 2);
    const mid = m.positions[midIdx];

    if (posInList(creationPositions, mid.row, mid.col)) continue;

    const cell = board[mid.row][mid.col];
    if (!cell) continue;

    if (len === 4) {
      // Striped horizontal (clears row, perpendicular to vertical match)
      specialCreations.push({ position: { ...mid }, special: 'striped-h' });
      creationPositions.push({ ...mid });
    } else if (len >= 5) {
      // Color bomb
      specialCreations.push({ position: { ...mid }, special: 'color-bomb' });
      creationPositions.push({ ...mid });
    }
  }

  // 2x2 squares → rocket at top-left
  for (const m of matches) {
    const ps = m.positions;
    // Detect 2x2: 4 positions forming a square
    if (ps.length === 4) {
      const rows = ps.map((p) => p.row);
      const cols = ps.map((p) => p.col);
      const minR = Math.min(...rows);
      const maxR = Math.max(...rows);
      const minC = Math.min(...cols);
      const maxC = Math.max(...cols);
      if (maxR - minR === 1 && maxC - minC === 1) {
        // It's a 2x2
        const topLeft = ps.find((p) => p.row === minR && p.col === minC);
        if (topLeft && !posInList(creationPositions, topLeft.row, topLeft.col)) {
          const cell = board[topLeft.row][topLeft.col];
          if (cell) {
            specialCreations.push({ position: { ...topLeft }, special: 'rocket' });
            creationPositions.push({ ...topLeft });
          }
        }
      }
    }
  }

  // Clear positions: all matched positions EXCEPT those that become special blocks
  const allMatchedPositions: Position[] = [];
  const seenPos = new Set<string>();
  for (const m of matches) {
    for (const p of m.positions) {
      const key = posKey(p.row, p.col);
      if (!seenPos.has(key)) {
        seenPos.add(key);
        allMatchedPositions.push({ ...p });
      }
    }
  }

  const clearPositions = allMatchedPositions.filter(
    (p) => !posInList(creationPositions, p.row, p.col),
  );

  return { clearPositions, specialCreations };
}

/* ── Special block activation effects ─────────── */

/**
 * Given a set of positions being cleared, check if any contain special blocks
 * and return the ADDITIONAL positions those specials clear.
 * Handles cascading: if a special's effect hits another special, that one fires too.
 */
export function getSpecialActivations(board: Cell[][], clearing: Position[]): Position[] {
  const rows = board.length;
  const cols = board[0].length;
  const extra: Position[] = [];
  const processed = new Set<string>();
  const queue: Position[] = [...clearing];

  while (queue.length > 0) {
    const pos = queue.shift()!;
    const key = posKey(pos.row, pos.col);
    if (processed.has(key)) continue;
    processed.add(key);

    const cell = board[pos.row]?.[pos.col] ?? null;
    if (!cell?.special) continue;

    switch (cell.special) {
      case 'striped-h': {
        // Clear entire row
        for (let c = 0; c < cols; c++) {
          const cKey = posKey(pos.row, c);
          if (!processed.has(cKey)) {
            addUnique(extra, pos.row, c);
            // If this cell is a special, add to queue for cascading
            const targetCell = board[pos.row]?.[c] ?? null;
            if (targetCell?.special && !processed.has(cKey)) {
              queue.push({ row: pos.row, col: c });
            }
          }
        }
        break;
      }
      case 'striped-v': {
        // Clear entire column
        for (let r = 0; r < rows; r++) {
          const cKey = posKey(r, pos.col);
          if (!processed.has(cKey)) {
            addUnique(extra, r, pos.col);
            const targetCell = board[r]?.[pos.col] ?? null;
            if (targetCell?.special && !processed.has(cKey)) {
              queue.push({ row: r, col: pos.col });
            }
          }
        }
        break;
      }
      case 'bomb': {
        // Clear 5x5 area centered on bomb
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = pos.row + dr;
            const nc = pos.col + dc;
            if (inBounds(nr, nc, rows, cols)) {
              const cKey = posKey(nr, nc);
              if (!processed.has(cKey)) {
                addUnique(extra, nr, nc);
                const targetCell = board[nr]?.[nc] ?? null;
                if (targetCell?.special && !processed.has(cKey)) {
                  queue.push({ row: nr, col: nc });
                }
              }
            }
          }
        }
        break;
      }
      case 'rocket': {
        // Destroy 5 random blocks (non-special preference)
        const candidates: Position[] = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cKey = posKey(r, c);
            if (!processed.has(cKey) && board[r][c] !== null) {
              candidates.push({ row: r, col: c });
            }
          }
        }
        // Shuffle and pick up to 5
        for (let i = candidates.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        const picks = candidates.slice(0, 5);
        for (const p of picks) {
          const cKey = posKey(p.row, p.col);
          if (!processed.has(cKey)) {
            addUnique(extra, p.row, p.col);
            const targetCell = board[p.row]?.[p.col] ?? null;
            if (targetCell?.special && !processed.has(cKey)) {
              queue.push(p);
            }
          }
        }
        break;
      }
      case 'color-bomb':
        // Color bombs only activate via manual swap, not via being caught in a blast.
        // When caught in a blast, they're just cleared.
        break;
    }
  }

  return extra;
}

/**
 * Activate a color bomb swapped with a normal gem: clear ALL gems of the target color.
 */
export function activateColorBomb(board: Cell[][], targetColor: GemType): Position[] {
  const positions: Position[] = [];
  const rows = board.length;
  const cols = board[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (cell !== null && cell.gem === targetColor) {
        positions.push({ row: r, col: c });
      }
    }
  }
  return positions;
}

/**
 * Handle two special blocks swapped together.
 * Returns combined clear positions.
 */
export function getCombinedSpecialEffect(
  board: Cell[][],
  pos1: Position,
  pos2: Position,
): Position[] {
  const cell1 = board[pos1.row]?.[pos1.col] ?? null;
  const cell2 = board[pos2.row]?.[pos2.col] ?? null;
  if (!cell1?.special || !cell2?.special) return [];

  const s1 = cell1.special;
  const s2 = cell2.special;
  const rows = board.length;
  const cols = board[0].length;
  const result: Position[] = [];

  const addAll = (r: number, c: number) => addUnique(result, r, c);

  // Color bomb + color bomb: clear entire board
  if (s1 === 'color-bomb' && s2 === 'color-bomb') {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c] !== null) result.push({ row: r, col: c });
      }
    }
    return result;
  }

  // Color bomb + other special: clear all of a random color, plus the other effect
  if (s1 === 'color-bomb' && s2 !== 'color-bomb') {
    // Clear all of cell2's color, then activate cell2's effect everywhere
    const targetColor = cell2.gem;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (cell !== null && cell.gem === targetColor) {
          addAll(r, c);
        }
      }
    }
    return result;
  }
  if (s2 === 'color-bomb' && s1 !== 'color-bomb') {
    const targetColor = cell1.gem;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (cell !== null && cell.gem === targetColor) {
          addAll(r, c);
        }
      }
    }
    return result;
  }

  // Both stripped: cross pattern (row + column)
  const bothStriped =
    (s1 === 'striped-h' || s1 === 'striped-v') &&
    (s2 === 'striped-h' || s2 === 'striped-v');
  if (bothStriped) {
    // Clear both rows and both columns
    for (let c = 0; c < cols; c++) {
      addAll(pos1.row, c);
      addAll(pos2.row, c);
    }
    for (let r = 0; r < rows; r++) {
      addAll(r, pos1.col);
      addAll(r, pos2.col);
    }
    return result;
  }

  // Bomb + bomb: 7x7 area
  if (s1 === 'bomb' && s2 === 'bomb') {
    const centerR = Math.floor((pos1.row + pos2.row) / 2);
    const centerC = Math.floor((pos1.col + pos2.col) / 2);
    for (let dr = -3; dr <= 3; dr++) {
      for (let dc = -3; dc <= 3; dc++) {
        const nr = centerR + dr;
        const nc = centerC + dc;
        if (inBounds(nr, nc, rows, cols)) addAll(nr, nc);
      }
    }
    return result;
  }

  // Striped + bomb: 3 rows + 3 columns centered
  const stripedBomb =
    (s1 === 'striped-h' || s1 === 'striped-v') && s2 === 'bomb' ||
    (s2 === 'striped-h' || s2 === 'striped-v') && s1 === 'bomb';
  if (stripedBomb) {
    const bombPos = s1 === 'bomb' ? pos1 : pos2;
    for (let dr = -1; dr <= 1; dr++) {
      const nr = bombPos.row + dr;
      if (inBounds(nr, 0, rows, cols)) {
        for (let c = 0; c < cols; c++) addAll(nr, c);
      }
    }
    for (let dc = -1; dc <= 1; dc++) {
      const nc = bombPos.col + dc;
      if (inBounds(0, nc, rows, cols)) {
        for (let r = 0; r < rows; r++) addAll(r, nc);
      }
    }
    return result;
  }

  // Striped + rocket or Bomb + rocket: rocket effect amplified
  if (s1 === 'rocket' || s2 === 'rocket') {
    // Destroy 10 random blocks
    const candidates: Position[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c] !== null) candidates.push({ row: r, col: c });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const p of candidates.slice(0, 10)) addAll(p.row, p.col);
    return result;
  }

  return result;
}

/* ── Board operations ────────────────────────── */

export function clearMatches(board: Cell[][], matches: Match[]): Cell[][] {
  const next = cloneBoard(board);
  for (const match of matches) {
    for (const { row, col } of match.positions) {
      next[row][col] = null;
    }
  }
  return next;
}

export function clearPositions(board: Cell[][], positions: Position[]): Cell[][] {
  const next = cloneBoard(board);
  for (const { row, col } of positions) {
    next[row][col] = null;
  }
  return next;
}

export function transformSpecialBlocks(
  board: Cell[][],
  creations: SpecialCreation[],
): Cell[][] {
  const next = cloneBoard(board);
  for (const { position, special } of creations) {
    const cell = next[position.row][position.col];
    if (cell !== null) {
      next[position.row][position.col] = makeCell(cell.gem, special);
    }
  }
  return next;
}

export function applyGravity(board: Cell[][]): Cell[][] {
  const rows = board.length;
  const cols = board[0].length;
  const next = cloneBoard(board);

  for (let c = 0; c < cols; c++) {
    let writeRow = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (next[r][c] !== null) {
        if (writeRow !== r) {
          next[writeRow][c] = next[r][c];
          next[r][c] = null;
        }
        writeRow--;
      }
    }
  }

  return next;
}

export function fillBoard(board: Cell[][], numTypes: number): Cell[][] {
  const next = cloneBoard(board);
  const rows = next.length;
  const cols = next[0].length;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (next[r][c] === null) {
        next[r][c] = makeCell(randomGem(numTypes));
      }
    }
  }
  return next;
}

/* ── Scoring ─────────────────────────────────── */

export function calculateScore(matches: Match[], comboCount: number): number {
  const totalGems = matches.reduce((sum, m) => sum + m.positions.length, 0);
  const multiplier = Math.pow(COMBO_MULTIPLIER, comboCount);
  return Math.floor(totalGems * BASE_SCORE * multiplier);
}

/** Calculate score based on total positions cleared (for special effects). */
export function calculateScoreFromPositions(totalCleared: number, comboCount: number): number {
  const multiplier = Math.pow(COMBO_MULTIPLIER, comboCount);
  return Math.floor(totalCleared * BASE_SCORE * multiplier);
}

/* ── Hint ────────────────────────────────────── */

export function findHint(board: Cell[][]): { a: Position; b: Position } | null {
  const rows = board.length;
  const cols = board[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (cell === null) continue;

      // If it's a color bomb, swapping with any adjacent non-empty gem is valid
      if (isColorBomb(cell)) {
        if (c < cols - 1 && board[r][c + 1] !== null) {
          return { a: { row: r, col: c }, b: { row: r, col: c + 1 } };
        }
        if (r < rows - 1 && board[r + 1]?.[c] !== null) {
          return { a: { row: r, col: c }, b: { row: r + 1, col: c } };
        }
        continue;
      }

      // Try swap right
      if (c < cols - 1) {
        // Special + special swap is always valid
        if (hasSpecial(cell) && hasSpecial(board[r][c + 1])) {
          return { a: { row: r, col: c }, b: { row: r, col: c + 1 } };
        }
        const swapped = swap(board, { row: r, col: c }, { row: r, col: c + 1 });
        if (findMatches(swapped).length > 0) {
          return { a: { row: r, col: c }, b: { row: r, col: c + 1 } };
        }
        // Also check if swap involves a color bomb (handled above but also here for safety)
        if (isColorBomb(board[r][c + 1])) {
          return { a: { row: r, col: c }, b: { row: r, col: c + 1 } };
        }
      }
      // Try swap down
      if (r < rows - 1) {
        // Special + special swap is always valid
        if (hasSpecial(cell) && hasSpecial(board[r + 1]?.[c] ?? null)) {
          return { a: { row: r, col: c }, b: { row: r + 1, col: c } };
        }
        const swapped = swap(board, { row: r, col: c }, { row: r + 1, col: c });
        if (findMatches(swapped).length > 0) {
          return { a: { row: r, col: c }, b: { row: r + 1, col: c } };
        }
        if (isColorBomb(board[r + 1]?.[c] ?? null)) {
          return { a: { row: r, col: c }, b: { row: r + 1, col: c } };
        }
      }
    }
  }
  return null;
}

export function hasValidMoves(board: Cell[][]): boolean {
  return findHint(board) !== null;
}

/* ── Utilities ───────────────────────────────── */

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => [...row]);
}

export function createInitialState(config: GameConfig): GameState {
  return {
    board: createBoard(config.rows, config.cols, config.gemTypes),
    score: 0,
    movesLeft: config.moves,
    selected: null,
    phase: 'idle',
    matches: [],
    comboCount: 0,
    config,
  };
}
