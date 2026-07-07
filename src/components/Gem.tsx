import { type Cell } from '../engine/game';

interface GemProps {
  cell: Cell;
  selected: boolean;
  hint: boolean;
  clearing: boolean;
  swapRole: 'a' | 'b' | null;
  onClick: () => void;
}

export default function Gem({ cell, selected, hint, clearing, swapRole, onClick }: GemProps) {
  if (cell === null) {
    return (
      <div className="cell">
        <div className="gem empty" />
      </div>
    );
  }

  const classes = [
    'gem',
    `gem-type-${cell.gem}`,
    cell.special && `special-${cell.special}`,
    selected && 'selected',
    hint && 'hint',
    clearing && 'clearing',
    swapRole === 'a' && 'swap-a',
    swapRole === 'b' && 'swap-b',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="cell" onClick={onClick}>
      <div className={classes}>
        <div className="gem-shape" />
      </div>
    </div>
  );
}
