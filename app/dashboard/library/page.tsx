'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getStationIndex, markTrialLocks, type Station } from '@/lib/supabase/queries/station-library';
import PageHeader from '@/components/ui/PageHeader';
import { getDomainColor } from '@/lib/constants/domains';
import StationBoard from '@/components/library/StationBoard';
import PinnedStations from '@/components/library/PinnedStations';
import { useLibraryFilters } from '@/components/library/useLibraryFilters';
import { summariseDomains } from '@/lib/stations/librarySearch';
import { useCohortAllowlist } from '@/hooks/useCohortAllowlist';
import { trialStationAllowlist, useTrialStatus } from '@/hooks/useTrialStatus';

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
  // Null for everybody who is not running on the free week, and until the
  // answer arrives — same null-until-known rule as the allowlist above.
  const trial = useTrialStatus();
  /**
   * The five cases a trial opens, or null when there is no trial limit.
   *
   * THE GATE, not a recommendation — which is the whole difference between this
   * library and the one that shipped a week ago. The old five-consultation
   * trial let a trainee sit any of the two hundred and counted how many they
   * finished, so "Start here" was advice; the offer is now five NAMED cases,
   * enforced at create-session and realtime-token, so the rest of the board has
   * to say so rather than letting somebody read a brief, click Begin and be
   * refused by an API.
   */
  const freeStationIds = trialStationAllowlist(trial);

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

  /**
   * The bank, with a trial account's locks stamped on it.
   *
   * Derived rather than re-fetched when the trial answer lands: the two arrive
   * independently (stations off Supabase, the trial off /api/subscription) and
   * refetching on the second would show a returning trialist their whole
   * library twice. `markTrialLocks` returns the same array untouched when there
   * is no limit, so a paying customer pays nothing for this.
   */
  const marked = useMemo(
    () => markTrialLocks(stations, freeStationIds),
    [stations, freeStationIds],
  );

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
    () => (allowlist ? marked.filter((station) => allowlist.has(station.id)) : []),
    [marked, allowlist],
  );

  /**
   * A trial account's five, pulled to the top and in `free_trial_order`.
   *
   * The ids arrive in that order from /api/subscription and are mapped back
   * through the loaded station array, so the pairing Ishaq chose (a near miss,
   * then a case where the same "one change" applies) survives, and each row
   * carries its own attempt history rather than a second copy of it. A flagged
   * station missing from the index (staged, or deleted) drops out rather than
   * rendering a hole.
   *
   * Empty for everybody else, so this section never renders for a paying
   * customer — and empty until the trial answer lands, which is the same
   * null-until-known rule the locks follow.
   */
  const yourFive = useMemo(() => {
    if (!freeStationIds) return [];
    const byId = new Map(marked.map((station) => [station.id, station]));
    return freeStationIds
      .map((id) => byId.get(id))
      .filter((station): station is Station => station !== undefined);
  }, [marked, freeStationIds]);

  const subtitle =
    stations.length === 0
      ? 'No cases available yet'
      : freeStationIds
        ? // A trialist's denominator is their five, not the bank: "2 of 200
          // passed" would be true and demoralising about a library they were
          // never given. The bank is named so the offer above it makes sense.
          `${yourFive.length} cases open to you · ${stations.length} in the full bank`
        : allowlist
          ? `${assignedPassed} of your ${allowlist.size} assigned cases passed`
          : `${passedTotal} of ${stations.length} passed across ${domains.length} topic areas`;

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

          {/* Trial accounts only — see `yourFive`. The same section as the
              cohort's, said differently and now meaning the same thing: both
              are the whole of what that reader may open. Both render nothing
              for everybody else, so at most one of them ever appears. */}
          <PinnedStations id="your-five" heading="Your five" stations={yourFive} />

          {/* The page, above `sm`. Its own chips carry the progress filter.
              One allowlist, whichever limit is in force — they are mutually
              exclusive by construction (decideAccess: a live trial outranks a
              cohort seat), so this is a choice between two, never a merge. */}
          <StationBoard
            stations={marked}
            status={filters.status}
            onStatusChange={setStatus}
            allowlist={freeStationIds ? new Set(freeStationIds) : allowlist}
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
