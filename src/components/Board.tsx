import { type Cell, type Position } from '../engine/game';
import Gem from './Gem';

interface BoardProps {
  board: Cell[][];
  selected: Position | null;
  hintCells: Position[];
  swappedCells: [Position, Position] | null;
  clearingCells: Position[];
  onCellClick: (pos: Position) => void;
}

export default function Board({
  board,
  selected,
  hintCells,
  swappedCells,
  clearingCells,
  onCellClick,
}: BoardProps) {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  const isHint = (r: number, c: number) =>
    hintCells.some((p) => p.row === r && p.col === c);

  const isSelected = (r: number, c: number) =>
    selected !== null && selected.row === r && selected.col === c;

  const isClearing = (r: number, c: number) =>
    clearingCells.some((p) => p.row === r && p.col === c);

  const isSwapped = (r: number, c: number): 'a' | 'b' | null => {
    if (!swappedCells) return null;
    if (swappedCells[0].row === r && swappedCells[0].col === c) return 'a';
    if (swappedCells[1].row === r && swappedCells[1].col === c) return 'b';
    return null;
  };

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <Gem
          key={`${r}-${c}`}
          cell={board[r][c]}
          selected={isSelected(r, c)}
          hint={isHint(r, c)}
          clearing={isClearing(r, c)}
          swapRole={isSwapped(r, c)}
          onClick={() => onCellClick({ row: r, col: c })}
        />
      );
    }
  }

  return (
    <div className="board-container">
      <div
        className="board"
        style={{
          gridTemplateColumns: `repeat(${cols}, var(--cell-size))`,
          gridTemplateRows: `repeat(${rows}, var(--cell-size))`,
        }}
      >
        {cells}
      </div>
    </div>
  );
}
