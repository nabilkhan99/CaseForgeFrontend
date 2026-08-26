import { TONE_COLOUR, passMarkPercent, toneForPercent } from '@/lib/clinical-master/scoring';

/**
 * A percentage score, coloured by whether it passes.
 *
 * The thresholds used to be 70/50, invented rather than derived: the SCA pass
 * mark is 6.0 out of 10.5, i.e. 57%, so a genuine Bare Pass at 58% rendered
 * amber "Borderline" and a clear pass at 60% never went green. They now come
 * from lib/clinical-master/scoring, the same place the feedback report reads.
 */
interface ScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const TONE_LABEL = {
  pass: 'Pass',
  borderline: 'Borderline',
  fail: 'Fail',
} as const;

const TONE_BACKGROUND = {
  pass: 'rgba(22,163,74,0.1)',
  borderline: 'rgba(180,83,9,0.1)',
  fail: 'rgba(220,38,38,0.1)',
} as const;

export default function ScoreBadge({ score, showLabel = false, size = 'md' }: ScoreBadgeProps) {
  const tone = toneForPercent(score);
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold font-mono rounded-lg ${sizeClass}`}
      style={{ background: TONE_BACKGROUND[tone], color: TONE_COLOUR[tone] }}
      title={`${passMarkPercent()}% is the pass mark (6.0 out of 10.5)`}
    >
      {score}%
      {showLabel && <span className="font-medium text-[10px] uppercase">{TONE_LABEL[tone]}</span>}
    </span>
  );
}
