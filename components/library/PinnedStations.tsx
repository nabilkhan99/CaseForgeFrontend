'use client';

import { motion, useReducedMotion } from 'framer-motion';
import StationRow from '@/components/library/StationRow';
import type { Station } from '@/lib/supabase/queries/station-library';

/**
 * A short list of cases pulled to the top of the library board.
 *
 * Extracted from the cohort students' "Your cases" section, which was inline in
 * the library page, because the five-station trial needs the same thing said
 * differently: "which handful of these two hundred is for me". The two headings
 * are the only difference, so they are a prop rather than a second copy of the
 * markup.
 *
 * Rules rather than a card, and the same StationRow the topic pages use, so a
 * case reads identically wherever it is met and keeps its attempt history.
 *
 * Shown at every width, not `sm:hidden`. It is not only a mobile workaround —
 * "which ones are mine" is the first question at any size — though on a phone
 * it is load-bearing: the board is hidden below `sm` (an 18px square cannot be
 * a touch target), so without this list a phone opens the library on
 * twenty-eight topic names with nothing to say where to start.
 *
 * Renders nothing when the list is empty, which is the case for everybody the
 * section is not for and for everybody before the answer has loaded.
 */
export default function PinnedStations({
  stations,
  heading,
  id,
}: {
  stations: Station[];
  heading: string;
  /** Unique per section, so two of these on one page keep distinct labels. */
  id: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  if (stations.length === 0) return null;

  return (
    <motion.section
      aria-labelledby={`${id}-heading`}
      className="mb-8 border-y border-hairline py-4"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <h2
        id={`${id}-heading`}
        className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted"
      >
        {heading}
      </h2>
      <div className="mt-1">
        {stations.map((station) => (
          // The domain is worth naming here in a way it is not on a topic page:
          // this list crosses topics, so without it the rows arrive with no
          // sense of what they cover.
          <StationRow key={station.id} station={station} showDomain />
        ))}
      </div>
    </motion.section>
  );
}
