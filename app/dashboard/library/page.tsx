'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getStationIndex, type Station } from '@/lib/supabase/queries/station-library';
import PageHeader from '@/components/ui/PageHeader';
import { getDomainColor } from '@/lib/constants/domains';
import StationBoard from '@/components/library/StationBoard';
import PinnedStations from '@/components/library/PinnedStations';
import { useLibraryFilters } from '@/components/library/useLibraryFilters';
import { summariseDomains } from '@/lib/stations/librarySearch';
import { useCohortAllowlist } from '@/hooks/useCohortAllowlist';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { getRecommendedStationIds } from '@/lib/supabase/queries/trialStations';

function LibrarySpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <motion.div
        className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

function StationLibraryContent() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  // The recommended "Start here" cases, in order. Ids only — the board has
  // already loaded every station, so these are looked up in that array rather
  // than fetched a second time and risking two versions of the same case.
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  // `undefined` = auth hasn't answered yet, `null` = genuinely signed out. The
  // data fetch waits for the difference: firing it on the initial null renders
  // a returning user's whole library as "Not started" before the progress
  // arrives a second later.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  // Kept for `status` alone. The search field and the domain select moved off
  // this page with the redesign, but `?status=` is a link people already hold,
  // and the hook is what keeps it in the URL.
  const { filters, setStatus } = useLibraryFilters();

  // null for everyone without a trainer-pilot seat, and until the answer
  // arrives — so nobody watches their library flash as locked on load.
  const allowlist = useCohortAllowlist();
  // Null for everybody who is not running on the five free stations, and until
  // the answer arrives — same null-until-known rule as the allowlist above.
  const trial = useTrialStatus();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    let cancelled = false;

    async function fetchStations() {
      setLoading(true);
      const data = await getStationIndex(user?.id);
      if (cancelled) return;
      setStations(data);
      setLoading(false);
    }

    fetchStations();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Independent of the station fetch and of who is signed in: the recommended
  // set is a property of the bank, not of the reader, and it fails soft to an
  // empty list (the `free_trial_order` column does not exist until the
  // migration is applied). Only rendered for trial accounts — see `recommended`.
  useEffect(() => {
    let cancelled = false;
    getRecommendedStationIds().then((ids) => {
      if (!cancelled) setRecommendedIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const domains = useMemo(() => summariseDomains(stations), [stations]);
  const passedTotal = useMemo(
    () => stations.reduce((total, station) => total + (station.passed ? 1 : 0), 0),
    [stations],
  );

  /**
   * A cohort student's progress is progress through their five cases, not
   * through the bank. "2 of 200 passed" would be true and useless — it counts a
   * denominator they were never given.
   */
  const assignedPassed = useMemo(
    () =>
      allowlist
        ? stations.reduce(
            (total, station) =>
              total + (allowlist.has(station.id) && station.passed ? 1 : 0),
            0,
          )
        : 0,
    [stations, allowlist],
  );

  const subtitle =
    stations.length === 0
      ? 'No cases available yet'
      : allowlist
        ? `${assignedPassed} of your ${allowlist.size} assigned cases passed`
        : `${passedTotal} of ${stations.length} passed across ${domains.length} topic areas`;

  /**
   * The cohort student's own cases, pulled to the top of the page.
   *
   * Without this the five assigned cases are five marks scattered across two
   * hundred, and on a phone they are not even that: the board is hidden below
   * `sm` (an 18px square cannot be a touch target), so the mobile roll-up shows
   * twenty-eight topic names with nothing to say which of them a student may
   * actually open. Finding their own work meant opening topics one at a time.
   *
   * Shown at every width rather than `sm:hidden`. It is not only a mobile
   * workaround — "which five are mine" is the first question at any size, and
   * the board below still does its own job of showing them in the context of
   * the bank they are a slice of. One list, no media query, no second layout to
   * keep in step.
   *
   * Empty for everyone else, so this renders nothing at all for a paying user —
   * `allowlist` is null both for them and until the answer lands, which is the
   * same null-until-known rule the locks follow.
   */
  const assigned = useMemo(
    () => (allowlist ? stations.filter((station) => allowlist.has(station.id)) : []),
    [stations, allowlist],
  );

  /**
   * The recommended "Start here" cases, for somebody on the five free stations.
   *
   * Ordered by `free_trial_order` — the ids arrive in that order and are mapped
   * back through the loaded station array, so the pairing Ishaq chose (a near
   * miss, then a case where the same "one change" applies) survives. A flagged
   * station missing from the index (staged, or deleted) drops out rather than
   * rendering a hole.
   *
   * NOT A GATE. Nothing here locks the other cases: a trialist may sit any of
   * the two hundred, and what limits them is the count, enforced at the server
   * chokepoints. This is a recommendation, and the board below is unchanged —
   * which is exactly why it does not pass an `allowlist`.
   *
   * Trial accounts only. For a customer three months into the bank, a "start
   * here" list is a section about a decision they made weeks ago.
   */
  const recommended = useMemo(() => {
    if (!trial) return [];
    const byId = new Map(stations.map((station) => [station.id, station]));
    return recommendedIds
      .map((id) => byId.get(id))
      .filter((station): station is Station => station !== undefined);
  }, [stations, recommendedIds, trial]);

  return (
    <div>
      {/* The board's summary line, promoted to the subtitle: the board is now
          the page, and a count of cases and domains restated above it would be
          the same sentence with the progress taken out. */}
      <PageHeader title="Case Library" subtitle={subtitle} />

      {loading ? (
        <LibrarySpinner />
      ) : (
        <>
          {/* Cohort students only — see `assigned`. */}
          <PinnedStations id="assigned-cases" heading="Your cases" stations={assigned} />

          {/* Trial accounts only — see `recommended`. The same section, said
              differently: a cohort student is being told which cases are
              theirs, a trialist which of two hundred to spend a station on
              first. Both render nothing for everybody else, so at most one of
              them ever appears. */}
          <PinnedStations id="start-here" heading="Start here" stations={recommended} />

          {/* The page, above `sm`. Its own chips carry the progress filter. */}
          <StationBoard
            stations={stations}
            status={filters.status}
            onStatusChange={setStatus}
            allowlist={allowlist}
          />

          {/* Mobile only. The board is hidden below `sm` because an 18px square
              cannot be a touch target, so without this list a phone would open
              the library on nothing it could tap. Above `sm` the board's domain
              names are the same twenty-eight links and this would be a second
              set saying the same thing. */}
          <div className="sm:hidden">
            <div className="divide-y divide-hairline">
              {domains.map((domain, index) => {
                const colors = getDomainColor(domain.name, index);
                const hasCompleted = domain.completed_count > 0;

                return (
                  <motion.div
                    key={domain.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 12) * 0.04 }}
                  >
                    <Link
                      href={`/dashboard/library/${domain.id}`}
                      className="group -mx-2 flex items-center gap-4 rounded-[10px] px-2 py-4 transition-colors hover:bg-black/[0.02] focus-visible-ring"
                    >
                      {/* Domain color indicator */}
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {domain.name.charAt(0)}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[15px] font-medium leading-snug text-heading transition-colors group-hover:text-primary">
                          {domain.name}
                        </div>
                        <div className="mt-0.5 text-[13px] text-muted">
                          {domain.station_count} case{domain.station_count !== 1 ? 's' : ''}
                          {hasCompleted && ` · ${domain.completed_count} attempted`}
                          {/* Zero passes stays unsaid, matching the dashboard rule
                              that "Passed 0 of N" is a poor thing to greet someone
                              with. Attempts are already shown above. */}
                          {domain.passed_count > 0 && (
                            <span className="ml-1 font-medium" style={{ color: '#15803D' }}>
                              {`· ${domain.passed_count} of ${domain.station_count} passed`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Coverage, not a grade. This used to feed completed/total
                          into ScoreBadge, whose Pass/Borderline/Refer thresholds
                          turned "3 of 9 done" into a red "33% Refer". */}
                      {hasCompleted && (
                        <span className="flex-shrink-0 text-[11px] font-medium tabular-nums text-muted">
                          {domain.completed_count}/{domain.station_count}
                        </span>
                      )}

                      {/* Chevron */}
                      <svg
                        className="h-4 w-4 flex-shrink-0 text-muted transition-colors group-hover:text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function StationLibraryPage() {
  // useSearchParams (via useLibraryFilters) needs a boundary for the build's
  // prerender pass.
  return (
    <Suspense fallback={<LibrarySpinner />}>
      <StationLibraryContent />
    </Suspense>
  );
}
