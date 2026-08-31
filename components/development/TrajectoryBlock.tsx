'use client';

import type { TrendTrajectory } from '@/lib/clinical-master/trendTypes';

interface TrajectoryStyle {
  label: string;
  glyph: string;
  colour: string;
}

/**
 * Three words, and only three.
 *
 * The engine grades the run as improving, steady or declining; the page says
 * so plainly and then stops. There is deliberately no confidence qualifier
 * beside it — a hedge next to a verdict either goes unread or quietly voids it,
 * and a trainee who wants to know how much data is behind the word can read the
 * case count in the subtitle.
 */
const TRAJECTORY_STYLES: Record<TrendTrajectory, TrajectoryStyle> = {
  improving: { label: 'Improving', glyph: '↗', colour: '#15803D' },
  steady: { label: 'Holding steady', glyph: '→', colour: '#57534E' },
  declining: { label: 'Slipping', glyph: '↘', colour: '#B91C1C' },
};

interface TrajectoryBlockProps {
  trajectory: TrendTrajectory;
  narrative: string;
}

export default function TrajectoryBlock({ trajectory, narrative }: TrajectoryBlockProps) {
  const style = TRAJECTORY_STYLES[trajectory];

  return (
    <section className="mb-12">
      <h2
        className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.02em]"
        style={{ color: style.colour }}
      >
        {style.label} <span aria-hidden="true">{style.glyph}</span>
      </h2>
      {narrative && (
        <p className="mt-3 max-w-[760px] text-[17px] leading-[1.6] text-body">{narrative}</p>
      )}
    </section>
  );
}
