import type { Verdict } from '@/lib/clinical-master/types';

/**
 * The verdict band a user reached at a station, as a pill.
 *
 * Colours mirror verdictColours() in FeedbackReport so a station in the library
 * reads the same as the feedback report it came from: green Pass, lime Bare
 * Pass, amber Bare Fail, red Fail. A passed station says PASSED rather than
 * repeating the band — passing is the thing the user is tracking; how narrowly
 * is detail for the report.
 */
interface VerdictPillProps {
  verdict: Verdict;
  passed: boolean;
  size?: 'sm' | 'md';
}

const VERDICT_STYLE: Record<Verdict, { bg: string; color: string }> = {
  Pass: { bg: 'rgba(22,163,74,0.1)', color: '#15803D' },
  'Bare Pass': { bg: 'rgba(101,163,13,0.1)', color: '#4D7C0F' },
  'Bare Fail': { bg: 'rgba(180,83,9,0.1)', color: '#B45309' },
  Fail: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626' },
};

export default function VerdictPill({ verdict, passed, size = 'md' }: VerdictPillProps) {
  const style = VERDICT_STYLE[verdict];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wide rounded-lg whitespace-nowrap ${sizeClass}`}
      style={{ background: style.bg, color: style.color }}
    >
      {passed ? 'Passed' : verdict}
    </span>
  );
}
