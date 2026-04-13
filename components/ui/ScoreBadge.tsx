interface ScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

function getScoreStyle(score: number) {
  if (score >= 70) return { bg: 'rgba(34,197,94,0.1)', color: '#16A34A', label: 'Pass' };
  if (score >= 50) return { bg: 'rgba(217,119,6,0.1)', color: '#D97706', label: 'Borderline' };
  return { bg: 'rgba(220,38,38,0.1)', color: '#DC2626', label: 'Refer' };
}

export default function ScoreBadge({ score, showLabel = false, size = 'md' }: ScoreBadgeProps) {
  const style = getScoreStyle(score);
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold font-mono rounded-lg ${sizeClass}`}
      style={{ background: style.bg, color: style.color }}
    >
      {score}%
      {showLabel && <span className="font-semibold text-[10px] uppercase">{style.label}</span>}
    </span>
  );
}
