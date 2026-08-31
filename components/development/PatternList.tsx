'use client';

import PatternBlock from '@/components/development/PatternBlock';
import type { TrendPattern } from '@/lib/clinical-master/trendTypes';

interface PatternListProps {
  /** One to three, already in the engine's priority order. */
  patterns: TrendPattern[];
  casesIncluded: number;
  /** sessionId → station title, for the evidence rows. */
  titles: Map<string, string>;
}

/**
 * "What's costing you marks" — the body of the page.
 *
 * The engine sends at most three patterns and they arrive ranked, so the order
 * is preserved rather than re-sorted here. Three is a ceiling someone can act
 * on before their next case; a longer list is a reading task, and reading tasks
 * do not change consultations.
 *
 * Hairline rules between blocks, no cards. Boxing each pattern would turn the
 * page into a dashboard of equal-weight tiles, when the whole point is that
 * these are ordered and the first one matters most.
 */
export default function PatternList({ patterns, casesIncluded, titles }: PatternListProps) {
  if (patterns.length === 0) return null;

  return (
    <section>
      {/* Stacks below `sm`: side by side, the eyebrow wraps to two lines with
          the caption hanging off the first, which reads as a broken heading. */}
      <div className="mb-1 flex flex-col gap-0.5 border-b border-hairline pb-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
          What&rsquo;s costing you marks
        </h2>
        <span className="flex-shrink-0 text-[11px] text-stone-400">
          from your own consultations
        </span>
      </div>

      <div className="divide-y divide-hairline">
        {patterns.map((pattern, index) => (
          <PatternBlock
            key={`${pattern.domain}-${index}-${pattern.headline}`}
            pattern={pattern}
            position={index + 1}
            casesIncluded={casesIncluded}
            titles={titles}
          />
        ))}
      </div>
    </section>
  );
}
