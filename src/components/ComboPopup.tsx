interface ComboPopupProps {
  count: number;
  score: number;
}

export default function ComboPopup({ count, score }: ComboPopupProps) {
  const labels: Record<number, string> = {
    2: 'Double!',
    3: 'Triple!',
    4: 'Super!',
    5: 'Amazing!',
  };
  const label = labels[count] || `${count}x Combo!`;

  return (
    <div className="combo-popup">
      <div className="combo-label">{label}</div>
      <div>+{score}</div>
    </div>
  );
}
